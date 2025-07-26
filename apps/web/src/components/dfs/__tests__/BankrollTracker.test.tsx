/**
 * Tests for BankrollTracker component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/lib/testing/test-utils';
import { BankrollTracker } from '../BankrollTracker';
import { mockApiResponse, mockApiError } from '@/lib/testing/test-utils';

describe('BankrollTracker', () => {
  const mockInitialData = {
    balance: 1000,
    deposits: 500,
    withdrawals: 100,
    profit: 600,
    roi: 120,
    history: [
      { date: '2024-01-01', balance: 800, change: 100, type: 'win' },
      { date: '2024-01-02', balance: 750, change: -50, type: 'loss' },
      { date: '2024-01-03', balance: 850, change: 100, type: 'win' },
      { date: '2024-01-04', balance: 1000, change: 150, type: 'win' },
    ],
  };

  beforeEach(() => {
    mockApiResponse('/api/dfs/bankroll', mockInitialData);
  });

  it('should render loading state initially', () => {
    render(<BankrollTracker />);
    expect(screen.getByText('Loading bankroll data...')).toBeInTheDocument();
  });

  it('should display bankroll data after loading', async () => {
    render(<BankrollTracker />);

    await waitFor(() => {
      expect(screen.getByText('Bankroll Tracker')).toBeInTheDocument();
      expect(screen.getByText('Current Balance')).toBeInTheDocument();
      expect(screen.getByText('$1,000')).toBeInTheDocument();
      expect(screen.getByText('Total Profit')).toBeInTheDocument();
      expect(screen.getByText('$600')).toBeInTheDocument();
      expect(screen.getByText('ROI')).toBeInTheDocument();
      expect(screen.getByText('120%')).toBeInTheDocument();
    });
  });

  it('should display transaction history', async () => {
    render(<BankrollTracker />);

    await waitFor(() => {
      expect(screen.getByText('Recent Transactions')).toBeInTheDocument();
      expect(screen.getByText('+$100')).toBeInTheDocument();
      expect(screen.getByText('-$50')).toBeInTheDocument();
      expect(screen.getByText('+$150')).toBeInTheDocument();
    });
  });

  it('should handle deposit action', async () => {
    const mockDepositResponse = { ...mockInitialData, balance: 1100, deposits: 600 };
    
    render(<BankrollTracker />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /deposit/i })).toBeInTheDocument();
    });

    mockApiResponse('/api/dfs/bankroll/deposit', mockDepositResponse);

    const depositButton = screen.getByRole('button', { name: /deposit/i });
    fireEvent.click(depositButton);

    // Mock deposit dialog interaction
    await waitFor(() => {
      expect(screen.getByText('Enter deposit amount')).toBeInTheDocument();
    });

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '100' } });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('$1,100')).toBeInTheDocument();
    });
  });

  it('should handle withdrawal action', async () => {
    const mockWithdrawResponse = { ...mockInitialData, balance: 900, withdrawals: 200 };
    
    render(<BankrollTracker />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /withdraw/i })).toBeInTheDocument();
    });

    mockApiResponse('/api/dfs/bankroll/withdraw', mockWithdrawResponse);

    const withdrawButton = screen.getByRole('button', { name: /withdraw/i });
    fireEvent.click(withdrawButton);

    await waitFor(() => {
      expect(screen.getByText('Enter withdrawal amount')).toBeInTheDocument();
    });

    const input = screen.getByRole('spinbutton');
    fireEvent.change(input, { target: { value: '100' } });

    const confirmButton = screen.getByRole('button', { name: /confirm/i });
    fireEvent.click(confirmButton);

    await waitFor(() => {
      expect(screen.getByText('$900')).toBeInTheDocument();
    });
  });

  it('should handle API errors gracefully', async () => {
    mockApiError('/api/dfs/bankroll', 'Failed to load bankroll data');

    render(<BankrollTracker />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load bankroll data')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('should retry on error', async () => {
    mockApiError('/api/dfs/bankroll', 'Failed to load bankroll data');

    render(<BankrollTracker />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load bankroll data')).toBeInTheDocument();
    });

    // Now mock successful response for retry
    mockApiResponse('/api/dfs/bankroll', mockInitialData);

    const retryButton = screen.getByRole('button', { name: /retry/i });
    fireEvent.click(retryButton);

    await waitFor(() => {
      expect(screen.getByText('$1,000')).toBeInTheDocument();
    });
  });

  it('should display correct profit/loss styling', async () => {
    render(<BankrollTracker />);

    await waitFor(() => {
      const profitElement = screen.getByText('+$100');
      const lossElement = screen.getByText('-$50');

      expect(profitElement).toHaveClass('text-green-600');
      expect(lossElement).toHaveClass('text-red-600');
    });
  });

  it('should calculate statistics correctly', async () => {
    render(<BankrollTracker />);

    await waitFor(() => {
      expect(screen.getByText('Net Deposits')).toBeInTheDocument();
      expect(screen.getByText('$400')).toBeInTheDocument(); // 500 - 100
    });
  });

  it('should refresh data periodically', async () => {
    vi.useFakeTimers();

    render(<BankrollTracker />);

    await waitFor(() => {
      expect(screen.getByText('$1,000')).toBeInTheDocument();
    });

    // Update mock response
    const updatedData = { ...mockInitialData, balance: 1200 };
    mockApiResponse('/api/dfs/bankroll', updatedData);

    // Fast forward 60 seconds (default refresh interval)
    vi.advanceTimersByTime(60000);

    await waitFor(() => {
      expect(screen.getByText('$1,200')).toBeInTheDocument();
    });

    vi.useRealTimers();
  });

  it('should handle empty transaction history', async () => {
    mockApiResponse('/api/dfs/bankroll', {
      ...mockInitialData,
      history: [],
    });

    render(<BankrollTracker />);

    await waitFor(() => {
      expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    });
  });

  it('should format dates correctly', async () => {
    render(<BankrollTracker />);

    await waitFor(() => {
      expect(screen.getByText('Jan 1, 2024')).toBeInTheDocument();
      expect(screen.getByText('Jan 2, 2024')).toBeInTheDocument();
    });
  });

  it('should show chart visualization', async () => {
    render(<BankrollTracker />);

    await waitFor(() => {
      expect(screen.getByTestId('bankroll-chart')).toBeInTheDocument();
    });
  });

  it('should toggle between chart types', async () => {
    render(<BankrollTracker />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /line chart/i })).toBeInTheDocument();
    });

    const chartToggle = screen.getByRole('button', { name: /bar chart/i });
    fireEvent.click(chartToggle);

    expect(screen.getByTestId('bankroll-bar-chart')).toBeInTheDocument();
  });
});
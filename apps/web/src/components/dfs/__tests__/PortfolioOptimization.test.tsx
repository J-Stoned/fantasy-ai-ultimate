/**
 * Tests for PortfolioOptimization component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/lib/testing/test-utils';
import { PortfolioOptimization } from '../PortfolioOptimization';
import { mockApiResponse, mockApiError } from '@/lib/testing/test-utils';

describe('PortfolioOptimization', () => {
  const mockContests = [
    {
      id: 'contest-1',
      name: 'NFL GPP $100K',
      entryFee: 10,
      totalPrize: 100000,
      maxEntries: 10000,
      currentEntries: 5000,
      sport: 'NFL',
      platform: 'DraftKings',
    },
    {
      id: 'contest-2',
      name: 'NBA 50/50 $20',
      entryFee: 20,
      totalPrize: 2000,
      maxEntries: 100,
      currentEntries: 50,
      sport: 'NBA',
      platform: 'FanDuel',
    },
  ];

  const mockOptimizationResult = {
    allocations: [
      {
        contestId: 'contest-1',
        entries: 5,
        allocation: 50,
        expectedReturn: 75,
        risk: 0.3,
      },
      {
        contestId: 'contest-2',
        entries: 2,
        allocation: 40,
        expectedReturn: 45,
        risk: 0.1,
      },
    ],
    totalExpectedReturn: 120,
    totalRisk: 0.2,
    sharpeRatio: 2.5,
    kellyFraction: 0.15,
  };

  it('should render initial state', () => {
    render(<PortfolioOptimization contests={mockContests} bankroll={1000} />);

    expect(screen.getByText('Portfolio Optimization')).toBeInTheDocument();
    expect(screen.getByText('Bankroll: $1,000')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /optimize portfolio/i })).toBeInTheDocument();
  });

  it('should display contest list', () => {
    render(<PortfolioOptimization contests={mockContests} bankroll={1000} />);

    expect(screen.getByText('NFL GPP $100K')).toBeInTheDocument();
    expect(screen.getByText('NBA 50/50 $20')).toBeInTheDocument();
    expect(screen.getByText('Entry: $10')).toBeInTheDocument();
    expect(screen.getByText('Entry: $20')).toBeInTheDocument();
  });

  it('should handle optimization successfully', async () => {
    mockApiResponse('/api/dfs/optimize-portfolio', mockOptimizationResult);

    render(<PortfolioOptimization contests={mockContests} bankroll={1000} />);
    
    const optimizeButton = screen.getByRole('button', { name: /optimize portfolio/i });
    fireEvent.click(optimizeButton);

    await waitFor(() => {
      expect(screen.getByText('Optimization Results')).toBeInTheDocument();
      expect(screen.getByText('Expected Return: $120')).toBeInTheDocument();
      expect(screen.getByText('Sharpe Ratio: 2.50')).toBeInTheDocument();
      expect(screen.getByText('Kelly Fraction: 15.0%')).toBeInTheDocument();
    });
  });

  it('should display allocation details', async () => {
    mockApiResponse('/api/dfs/optimize-portfolio', mockOptimizationResult);

    render(<PortfolioOptimization contests={mockContests} bankroll={1000} />);
    
    fireEvent.click(screen.getByRole('button', { name: /optimize portfolio/i }));

    await waitFor(() => {
      // Check first allocation
      expect(screen.getByText('5 entries')).toBeInTheDocument();
      expect(screen.getByText('$50 (5.0%)')).toBeInTheDocument();
      expect(screen.getByText('Expected: $75')).toBeInTheDocument();

      // Check second allocation
      expect(screen.getByText('2 entries')).toBeInTheDocument();
      expect(screen.getByText('$40 (4.0%)')).toBeInTheDocument();
      expect(screen.getByText('Expected: $45')).toBeInTheDocument();
    });
  });

  it('should handle optimization errors', async () => {
    mockApiError('/api/dfs/optimize-portfolio', 'Optimization failed');

    render(<PortfolioOptimization contests={mockContests} bankroll={1000} />);
    
    fireEvent.click(screen.getByRole('button', { name: /optimize portfolio/i }));

    await waitFor(() => {
      expect(screen.getByText('Optimization failed')).toBeInTheDocument();
    });
  });

  it('should show loading state during optimization', async () => {
    // Delay the response to see loading state
    mockApiResponse('/api/dfs/optimize-portfolio', mockOptimizationResult);

    render(<PortfolioOptimization contests={mockContests} bankroll={1000} />);
    
    fireEvent.click(screen.getByRole('button', { name: /optimize portfolio/i }));

    expect(screen.getByText('Optimizing...')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.queryByText('Optimizing...')).not.toBeInTheDocument();
    });
  });

  it('should handle empty contest list', () => {
    render(<PortfolioOptimization contests={[]} bankroll={1000} />);

    expect(screen.getByText('No contests available')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /optimize portfolio/i })).toBeDisabled();
  });

  it('should handle zero bankroll', () => {
    render(<PortfolioOptimization contests={mockContests} bankroll={0} />);

    expect(screen.getByText('Bankroll: $0')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /optimize portfolio/i })).toBeDisabled();
  });

  it('should update when props change', () => {
    const { rerender } = render(
      <PortfolioOptimization contests={mockContests} bankroll={1000} />
    );

    expect(screen.getByText('Bankroll: $1,000')).toBeInTheDocument();

    rerender(<PortfolioOptimization contests={mockContests} bankroll={2000} />);

    expect(screen.getByText('Bankroll: $2,000')).toBeInTheDocument();
  });

  it('should calculate risk levels correctly', async () => {
    mockApiResponse('/api/dfs/optimize-portfolio', mockOptimizationResult);

    render(<PortfolioOptimization contests={mockContests} bankroll={1000} />);
    
    fireEvent.click(screen.getByRole('button', { name: /optimize portfolio/i }));

    await waitFor(() => {
      const riskIndicators = screen.getAllByText(/Risk:/);
      expect(riskIndicators[0].nextSibling?.textContent).toContain('30.0%');
      expect(riskIndicators[1].nextSibling?.textContent).toContain('10.0%');
    });
  });

  it('should disable optimization when loading', async () => {
    mockApiResponse('/api/dfs/optimize-portfolio', mockOptimizationResult);

    render(<PortfolioOptimization contests={mockContests} bankroll={1000} />);
    
    const optimizeButton = screen.getByRole('button', { name: /optimize portfolio/i });
    fireEvent.click(optimizeButton);

    expect(optimizeButton).toBeDisabled();

    await waitFor(() => {
      expect(optimizeButton).not.toBeDisabled();
    });
  });
});
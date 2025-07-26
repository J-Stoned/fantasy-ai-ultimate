/**
 * Tests for ContestSelector component
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@/lib/testing/test-utils';
import { ContestSelector } from '../ContestSelector';
import { mockApiResponse, mockApiError } from '@/lib/testing/test-utils';

describe('ContestSelector', () => {
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
      startTime: '2024-01-15T13:00:00Z',
      guaranteed: true,
    },
    {
      id: 'contest-2',
      name: 'NBA 50/50 $20',
      entryFee: 20,
      totalPrize: 2000,
      maxEntries: 100,
      currentEntries: 100,
      sport: 'NBA',
      platform: 'FanDuel',
      startTime: '2024-01-15T19:00:00Z',
      guaranteed: false,
    },
    {
      id: 'contest-3',
      name: 'MLB Double Up',
      entryFee: 5,
      totalPrize: 500,
      maxEntries: 50,
      currentEntries: 25,
      sport: 'MLB',
      platform: 'DraftKings',
      startTime: '2024-01-15T16:00:00Z',
      guaranteed: false,
    },
  ];

  const mockOnSelect = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockApiResponse('/api/dfs/contests', mockContests);
  });

  it('should render loading state initially', () => {
    render(<ContestSelector onSelect={mockOnSelect} />);
    expect(screen.getByText('Loading contests...')).toBeInTheDocument();
  });

  it('should display contests after loading', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('NFL GPP $100K')).toBeInTheDocument();
      expect(screen.getByText('NBA 50/50 $20')).toBeInTheDocument();
      expect(screen.getByText('MLB Double Up')).toBeInTheDocument();
    });
  });

  it('should display contest details', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      // Check first contest details
      expect(screen.getByText('Entry: $10')).toBeInTheDocument();
      expect(screen.getByText('Prize: $100,000')).toBeInTheDocument();
      expect(screen.getByText('5,000 / 10,000')).toBeInTheDocument();
      expect(screen.getByText('GUARANTEED')).toBeInTheDocument();
    });
  });

  it('should filter contests by sport', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('NFL GPP $100K')).toBeInTheDocument();
    });

    const sportFilter = screen.getByRole('combobox', { name: /sport/i });
    fireEvent.change(sportFilter, { target: { value: 'NBA' } });

    await waitFor(() => {
      expect(screen.queryByText('NFL GPP $100K')).not.toBeInTheDocument();
      expect(screen.getByText('NBA 50/50 $20')).toBeInTheDocument();
      expect(screen.queryByText('MLB Double Up')).not.toBeInTheDocument();
    });
  });

  it('should filter contests by platform', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('NFL GPP $100K')).toBeInTheDocument();
    });

    const platformFilter = screen.getByRole('combobox', { name: /platform/i });
    fireEvent.change(platformFilter, { target: { value: 'FanDuel' } });

    await waitFor(() => {
      expect(screen.queryByText('NFL GPP $100K')).not.toBeInTheDocument();
      expect(screen.getByText('NBA 50/50 $20')).toBeInTheDocument();
      expect(screen.queryByText('MLB Double Up')).not.toBeInTheDocument();
    });
  });

  it('should filter contests by entry fee range', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('NFL GPP $100K')).toBeInTheDocument();
    });

    const minFeeInput = screen.getByLabelText(/min fee/i);
    const maxFeeInput = screen.getByLabelText(/max fee/i);

    fireEvent.change(minFeeInput, { target: { value: '15' } });
    fireEvent.change(maxFeeInput, { target: { value: '25' } });

    await waitFor(() => {
      expect(screen.queryByText('NFL GPP $100K')).not.toBeInTheDocument();
      expect(screen.getByText('NBA 50/50 $20')).toBeInTheDocument();
      expect(screen.queryByText('MLB Double Up')).not.toBeInTheDocument();
    });
  });

  it('should handle contest selection', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('NFL GPP $100K')).toBeInTheDocument();
    });

    const selectButton = screen.getAllByRole('button', { name: /select/i })[0];
    fireEvent.click(selectButton);

    expect(mockOnSelect).toHaveBeenCalledWith(mockContests[0]);
  });

  it('should disable selection for full contests', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('NBA 50/50 $20')).toBeInTheDocument();
    });

    const selectButtons = screen.getAllByRole('button', { name: /select|full/i });
    const fullContestButton = selectButtons.find(btn => btn.textContent === 'FULL');

    expect(fullContestButton).toBeDisabled();
  });

  it('should sort contests', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('NFL GPP $100K')).toBeInTheDocument();
    });

    const sortSelect = screen.getByRole('combobox', { name: /sort by/i });
    fireEvent.change(sortSelect, { target: { value: 'entryFee' } });

    await waitFor(() => {
      const contestNames = screen.getAllByTestId('contest-name');
      expect(contestNames[0]).toHaveTextContent('MLB Double Up');
      expect(contestNames[1]).toHaveTextContent('NFL GPP $100K');
      expect(contestNames[2]).toHaveTextContent('NBA 50/50 $20');
    });
  });

  it('should handle API errors', async () => {
    mockApiError('/api/dfs/contests', 'Failed to load contests');

    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('Failed to load contests')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
    });
  });

  it('should refresh contests', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('NFL GPP $100K')).toBeInTheDocument();
    });

    // Update mock response
    const updatedContests = [
      ...mockContests,
      {
        id: 'contest-4',
        name: 'NHL Tournament',
        entryFee: 50,
        totalPrize: 5000,
        maxEntries: 100,
        currentEntries: 10,
        sport: 'NHL',
        platform: 'DraftKings',
        startTime: '2024-01-15T20:00:00Z',
        guaranteed: true,
      },
    ];

    mockApiResponse('/api/dfs/contests', updatedContests);

    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      expect(screen.getByText('NHL Tournament')).toBeInTheDocument();
    });
  });

  it('should display contest status', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('50% filled')).toBeInTheDocument(); // NFL contest
      expect(screen.getByText('FULL')).toBeInTheDocument(); // NBA contest
      expect(screen.getByText('50% filled')).toBeInTheDocument(); // MLB contest
    });
  });

  it('should show time until start', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      // Should show relative time for each contest
      const timeElements = screen.getAllByText(/starts in|started/i);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  it('should handle empty contest list', async () => {
    mockApiResponse('/api/dfs/contests', []);

    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('No contests available')).toBeInTheDocument();
    });
  });

  it('should persist filters when refreshing', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('NFL GPP $100K')).toBeInTheDocument();
    });

    // Apply sport filter
    const sportFilter = screen.getByRole('combobox', { name: /sport/i });
    fireEvent.change(sportFilter, { target: { value: 'NFL' } });

    await waitFor(() => {
      expect(screen.queryByText('NBA 50/50 $20')).not.toBeInTheDocument();
    });

    // Refresh
    const refreshButton = screen.getByRole('button', { name: /refresh/i });
    fireEvent.click(refreshButton);

    await waitFor(() => {
      // Filter should still be applied
      expect(screen.getByText('NFL GPP $100K')).toBeInTheDocument();
      expect(screen.queryByText('NBA 50/50 $20')).not.toBeInTheDocument();
    });
  });

  it('should search contests by name', async () => {
    render(<ContestSelector onSelect={mockOnSelect} />);

    await waitFor(() => {
      expect(screen.getByText('NFL GPP $100K')).toBeInTheDocument();
    });

    const searchInput = screen.getByPlaceholderText(/search contests/i);
    fireEvent.change(searchInput, { target: { value: 'GPP' } });

    await waitFor(() => {
      expect(screen.getByText('NFL GPP $100K')).toBeInTheDocument();
      expect(screen.queryByText('NBA 50/50 $20')).not.toBeInTheDocument();
      expect(screen.queryByText('MLB Double Up')).not.toBeInTheDocument();
    });
  });
});
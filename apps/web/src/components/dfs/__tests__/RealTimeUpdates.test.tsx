/**
 * Tests for RealTimeUpdates component
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@/lib/testing/test-utils';
import { RealTimeUpdates } from '../RealTimeUpdates';
import { MockWebSocket } from '@/lib/testing/test-utils';

describe('RealTimeUpdates', () => {
  let mockWebSocket: MockWebSocket;

  beforeEach(() => {
    // Reset WebSocket mock
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (mockWebSocket) {
      mockWebSocket.close();
    }
  });

  it('should render initial state', () => {
    render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    expect(screen.getByText('Live Updates')).toBeInTheDocument();
    expect(screen.getByText('Connecting...')).toBeInTheDocument();
  });

  it('should establish WebSocket connection', async () => {
    render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    await waitFor(() => {
      mockWebSocket = (global as any).WebSocket.mock.instances[0];
      expect(mockWebSocket).toBeDefined();
      expect(mockWebSocket.url).toContain('ws://localhost:3001');
    });
  });

  it('should display connected status', async () => {
    render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    await waitFor(() => {
      mockWebSocket = (global as any).WebSocket.mock.instances[0];
    });

    act(() => {
      mockWebSocket.readyState = 1;
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen(new Event('open'));
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });
  });

  it('should handle score updates', async () => {
    render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    await waitFor(() => {
      mockWebSocket = (global as any).WebSocket.mock.instances[0];
    });

    const scoreUpdate = {
      type: 'score_update',
      data: {
        playerId: 'player-1',
        playerName: 'Patrick Mahomes',
        points: 25.5,
        change: 6.0,
        reason: 'Passing TD',
      },
    };

    act(() => {
      mockWebSocket.mockMessage(scoreUpdate);
    });

    await waitFor(() => {
      expect(screen.getByText('Patrick Mahomes')).toBeInTheDocument();
      expect(screen.getByText('+6.0')).toBeInTheDocument();
      expect(screen.getByText('25.5 pts')).toBeInTheDocument();
      expect(screen.getByText('Passing TD')).toBeInTheDocument();
    });
  });

  it('should handle rank updates', async () => {
    render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    await waitFor(() => {
      mockWebSocket = (global as any).WebSocket.mock.instances[0];
    });

    const rankUpdate = {
      type: 'rank_update',
      data: {
        currentRank: 25,
        previousRank: 30,
        totalEntries: 1000,
        percentile: 97.5,
      },
    };

    act(() => {
      mockWebSocket.mockMessage(rankUpdate);
    });

    await waitFor(() => {
      expect(screen.getByText('Rank: 25 / 1,000')).toBeInTheDocument();
      expect(screen.getByText('↑ 5')).toBeInTheDocument();
      expect(screen.getByText('Top 2.5%')).toBeInTheDocument();
    });
  });

  it('should handle contest updates', async () => {
    render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    await waitFor(() => {
      mockWebSocket = (global as any).WebSocket.mock.instances[0];
    });

    const contestUpdate = {
      type: 'contest_update',
      data: {
        prizePool: 100000,
        currentEntries: 8500,
        maxEntries: 10000,
        timeRemaining: '02:30:00',
      },
    };

    act(() => {
      mockWebSocket.mockMessage(contestUpdate);
    });

    await waitFor(() => {
      expect(screen.getByText('Prize Pool: $100,000')).toBeInTheDocument();
      expect(screen.getByText('Entries: 8,500 / 10,000')).toBeInTheDocument();
      expect(screen.getByText('Time: 02:30:00')).toBeInTheDocument();
    });
  });

  it('should handle multiple updates', async () => {
    render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    await waitFor(() => {
      mockWebSocket = (global as any).WebSocket.mock.instances[0];
    });

    const updates = [
      {
        type: 'score_update',
        data: {
          playerId: 'player-1',
          playerName: 'Player 1',
          points: 10,
          change: 5,
        },
      },
      {
        type: 'score_update',
        data: {
          playerId: 'player-2',
          playerName: 'Player 2',
          points: 15,
          change: 3,
        },
      },
    ];

    act(() => {
      updates.forEach(update => mockWebSocket.mockMessage(update));
    });

    await waitFor(() => {
      expect(screen.getByText('Player 1')).toBeInTheDocument();
      expect(screen.getByText('Player 2')).toBeInTheDocument();
    });
  });

  it('should handle connection errors', async () => {
    render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    await waitFor(() => {
      mockWebSocket = (global as any).WebSocket.mock.instances[0];
    });

    act(() => {
      if (mockWebSocket.onerror) {
        mockWebSocket.onerror(new Event('error'));
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Connection Error')).toBeInTheDocument();
    });
  });

  it('should handle disconnection', async () => {
    render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    await waitFor(() => {
      mockWebSocket = (global as any).WebSocket.mock.instances[0];
    });

    // First connect
    act(() => {
      mockWebSocket.readyState = 1;
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen(new Event('open'));
      }
    });

    await waitFor(() => {
      expect(screen.getByText('Connected')).toBeInTheDocument();
    });

    // Then disconnect
    act(() => {
      mockWebSocket.close();
    });

    await waitFor(() => {
      expect(screen.getByText('Disconnected')).toBeInTheDocument();
    });
  });

  it('should clean up on unmount', async () => {
    const { unmount } = render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    await waitFor(() => {
      mockWebSocket = (global as any).WebSocket.mock.instances[0];
    });

    const closeSpy = vi.spyOn(mockWebSocket, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('should send subscription message on connect', async () => {
    render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    await waitFor(() => {
      mockWebSocket = (global as any).WebSocket.mock.instances[0];
    });

    const sendSpy = vi.spyOn(mockWebSocket, 'send');

    act(() => {
      mockWebSocket.readyState = 1;
      if (mockWebSocket.onopen) {
        mockWebSocket.onopen(new Event('open'));
      }
    });

    await waitFor(() => {
      expect(sendSpy).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'subscribe',
          contestId: 'contest-1',
          userId: 'user-1',
        })
      );
    });
  });

  it('should limit update history', async () => {
    render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    await waitFor(() => {
      mockWebSocket = (global as any).WebSocket.mock.instances[0];
    });

    // Send more than 10 updates
    const updates = Array.from({ length: 15 }, (_, i) => ({
      type: 'score_update',
      data: {
        playerId: `player-${i}`,
        playerName: `Player ${i}`,
        points: i * 10,
        change: 5,
      },
    }));

    act(() => {
      updates.forEach(update => mockWebSocket.mockMessage(update));
    });

    await waitFor(() => {
      // Should only show last 10 updates
      const playerElements = screen.getAllByText(/Player \d+/);
      expect(playerElements).toHaveLength(10);
      // Should show latest updates (Player 5 through Player 14)
      expect(screen.queryByText('Player 0')).not.toBeInTheDocument();
      expect(screen.getByText('Player 14')).toBeInTheDocument();
    });
  });

  it('should display timestamps for updates', async () => {
    render(<RealTimeUpdates contestId="contest-1" userId="user-1" />);

    await waitFor(() => {
      mockWebSocket = (global as any).WebSocket.mock.instances[0];
    });

    const update = {
      type: 'score_update',
      data: {
        playerId: 'player-1',
        playerName: 'Test Player',
        points: 10,
        change: 5,
        timestamp: new Date().toISOString(),
      },
    };

    act(() => {
      mockWebSocket.mockMessage(update);
    });

    await waitFor(() => {
      // Check for time format (e.g., "12:34 PM")
      const timeRegex = /\d{1,2}:\d{2}\s?(AM|PM)/;
      const timeElements = screen.getAllByText(timeRegex);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });
});
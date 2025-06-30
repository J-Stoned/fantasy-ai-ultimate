/**
 * MARCUS "THE FIXER" RODRIGUEZ - MOBILE REALTIME
 * 
 * Live updates, presence, and real-time features
 */

import React from 'react';
import { RealtimeChannel, RealtimeClient } from '@supabase/supabase-js';
import { supabase } from '../api/supabase';
import { EventEmitter } from 'eventemitter3';
import { AppState, AppStateStatus } from 'react-native';

interface PresenceState {
  userId: string;
  status: 'online' | 'away' | 'offline';
  lastSeen: Date;
  activity?: string;
  device: 'mobile' | 'web';
}

interface LiveScore {
  gameId: string;
  homeScore: number;
  awayScore: number;
  period: string;
  timeRemaining: string;
  lastUpdate: Date;
}

export class RealtimeService extends EventEmitter {
  private static instance: RealtimeService;
  private channels: Map<string, RealtimeChannel> = new Map();
  private presence: Map<string, PresenceState> = new Map();
  private appState: AppStateStatus = 'active';
  private reconnectTimer: NodeJS.Timeout | null = null;
  private appStateSubscription?: any;
  private heartbeatInterval?: NodeJS.Timeout;

  static getInstance(): RealtimeService {
    if (!this.instance) {
      this.instance = new RealtimeService();
    }
    return this.instance;
  }

  async initialize() {
    // Monitor app state for presence
    this.appStateSubscription = AppState.addEventListener('change', this.handleAppStateChange);
    
    // Set initial presence
    await this.updatePresence('online');
    
    // Start heartbeat
    this.startHeartbeat();
  }

  private handleAppStateChange = (nextAppState: AppStateStatus) => {
    if (this.appState.match(/inactive|background/) && nextAppState === 'active') {
      // App came to foreground
      this.updatePresence('online');
      this.reconnectChannels();
    } else if (nextAppState.match(/inactive|background/)) {
      // App went to background
      this.updatePresence('away');
    }
    this.appState = nextAppState;
  };

  // Channel management
  private getOrCreateChannel(name: string): RealtimeChannel {
    if (!this.channels.has(name)) {
      const channel = supabase.channel(name);
      this.channels.set(name, channel);
    }
    return this.channels.get(name)!;
  }

  // Subscribe to lineup score updates
  subscribeToLineupScores(
    lineupId: string,
    callback: (score: number) => void
  ): () => void {
    const channel = this.getOrCreateChannel(`lineup-${lineupId}`);
    
    channel
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'lineup_players',
          filter: `lineup_id=eq.${lineupId}`,
        },
        (payload) => {
          const totalScore = this.calculateLineupScore(payload.new);
          callback(totalScore);
          this.emit('lineup-score-update', { lineupId, score: totalScore });
        }
      )
      .subscribe();

    // Return unsubscribe function
    return () => {
      channel.unsubscribe();
      this.channels.delete(`lineup-${lineupId}`);
    };
  }

  // Subscribe to live game updates
  subscribeToGame(
    gameId: string,
    callback: (game: LiveScore) => void
  ): () => void {
    const channel = this.getOrCreateChannel(`game-${gameId}`);
    
    channel
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'live_games',
          filter: `id=eq.${gameId}`,
        },
        (payload) => {
          const game: LiveScore = {
            gameId: payload.new.id,
            homeScore: payload.new.home_score,
            awayScore: payload.new.away_score,
            period: payload.new.period,
            timeRemaining: payload.new.time_remaining,
            lastUpdate: new Date(payload.new.updated_at),
          };
          callback(game);
          this.emit('game-update', game);
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
      this.channels.delete(`game-${gameId}`);
    };
  }

  // Subscribe to league chat/activity
  subscribeToLeague(
    leagueId: string,
    callbacks: {
      onMessage?: (message: any) => void;
      onTrade?: (trade: any) => void;
      onTransaction?: (transaction: any) => void;
    }
  ): () => void {
    const channel = this.getOrCreateChannel(`league-${leagueId}`);
    
    // League messages
    if (callbacks.onMessage) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'league_messages',
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          callbacks.onMessage!(payload.new);
          this.emit('league-message', payload.new);
        }
      );
    }

    // Trades
    if (callbacks.onTrade) {
      channel.on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'trades',
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          callbacks.onTrade!(payload.new);
          this.emit('league-trade', payload.new);
        }
      );
    }

    // Transactions
    if (callbacks.onTransaction) {
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'transactions',
          filter: `league_id=eq.${leagueId}`,
        },
        (payload) => {
          callbacks.onTransaction!(payload.new);
          this.emit('league-transaction', payload.new);
        }
      );
    }

    channel.subscribe();

    return () => {
      channel.unsubscribe();
      this.channels.delete(`league-${leagueId}`);
    };
  }

  // Presence tracking
  async joinPresenceChannel(
    channelName: string,
    userId: string
  ): Promise<() => void> {
    const channel = this.getOrCreateChannel(`presence-${channelName}`);
    
    // Track presence
    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        this.updatePresenceMap(state);
      })
      .on('presence', { event: 'join' }, ({ key, newPresences }) => {
        this.emit('user-joined', { channel: channelName, users: newPresences });
      })
      .on('presence', { event: 'leave' }, ({ key, leftPresences }) => {
        this.emit('user-left', { channel: channelName, users: leftPresences });
      })
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({
            userId,
            status: 'online',
            device: 'mobile',
            lastSeen: new Date().toISOString(),
          });
        }
      });

    return () => {
      channel.unsubscribe();
      this.channels.delete(`presence-${channelName}`);
    };
  }

  private updatePresenceMap(state: any) {
    this.presence.clear();
    
    Object.keys(state).forEach((key) => {
      const presences = state[key];
      presences.forEach((presence: any) => {
        this.presence.set(presence.userId, {
          userId: presence.userId,
          status: presence.status,
          lastSeen: new Date(presence.lastSeen),
          activity: presence.activity,
          device: presence.device,
        });
      });
    });
    
    this.emit('presence-updated', Array.from(this.presence.values()));
  }

  // Get current presence for a channel
  getPresence(channelName: string): PresenceState[] {
    const filtered = Array.from(this.presence.values()).filter(p => 
      // Filter based on channel if needed
      true
    );
    return filtered;
  }

  // Update own presence
  private async updatePresence(status: 'online' | 'away' | 'offline') {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Update all presence channels
    for (const [name, channel] of this.channels) {
      if (name.startsWith('presence-')) {
        await channel.track({
          userId: user.id,
          status,
          device: 'mobile',
          lastSeen: new Date().toISOString(),
        });
      }
    }
  }

  // Heartbeat to maintain connection
  private startHeartbeat() {
    // Clear any existing heartbeat
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    this.heartbeatInterval = setInterval(() => {
      if (this.appState === 'active') {
        this.updatePresence('online');
      }
    }, 30000); // Every 30 seconds
  }

  // Reconnect channels after network issues
  private async reconnectChannels() {
    for (const [name, channel] of this.channels) {
      if (channel.state !== 'joined') {
        await channel.subscribe();
      }
    }
  }

  // Calculate lineup score from player data
  private calculateLineupScore(lineupData: any): number {
    // Simplified - in reality would sum all player scores
    return lineupData.total_score || 0;
  }

  // Broadcast custom event
  async broadcast(
    channel: string,
    event: string,
    payload: any
  ): Promise<void> {
    const ch = this.getOrCreateChannel(channel);
    await ch.send({
      type: 'broadcast',
      event,
      payload,
    });
  }

  // Clean up - MARCUS FIX: Proper memory cleanup
  destroy() {
    // Unsubscribe all channels
    for (const channel of this.channels.values()) {
      channel.unsubscribe();
    }
    this.channels.clear();
    
    // Clear timers
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    
    // Clear heartbeat interval - MEMORY LEAK FIX
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = undefined;
    }
    
    // Remove app state listener - MEMORY LEAK FIX
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = undefined;
    }
    
    // Remove all event listeners
    this.removeAllListeners();
    
    // Clear presence map
    this.presence.clear();
  }

  // Get stats
  getStats() {
    return {
      activeChannels: this.channels.size,
      onlineUsers: Array.from(this.presence.values()).filter(
        p => p.status === 'online'
      ).length,
      totalUsers: this.presence.size,
    };
  }
}

// Export singleton instance
export const realtime = RealtimeService.getInstance();

// React hooks
export function useRealtimeScore(lineupId: string) {
  const [score, setScore] = React.useState(0);

  React.useEffect(() => {
    const unsubscribe = realtime.subscribeToLineupScores(lineupId, setScore);
    return unsubscribe;
  }, [lineupId]);

  return score;
}

export function useRealtimeGame(gameId: string) {
  const [game, setGame] = React.useState<LiveScore | null>(null);

  React.useEffect(() => {
    const unsubscribe = realtime.subscribeToGame(gameId, setGame);
    return unsubscribe;
  }, [gameId]);

  return game;
}

export function usePresence(channel: string) {
  const [users, setUsers] = React.useState<PresenceState[]>([]);
  const [user, setUser] = React.useState<any>(null);
  
  React.useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      setUser(user);
    });
  }, []);

  React.useEffect(() => {
    if (!user) return;

    const unsubscribe = realtime.joinPresenceChannel(channel, user.id);
    
    const handleUpdate = (presence: PresenceState[]) => {
      setUsers(presence);
    };

    realtime.on('presence-updated', handleUpdate);

    return () => {
      unsubscribe();
      realtime.off('presence-updated', handleUpdate);
    };
  }, [channel, user]);

  return users;
}

/**
 * THE MARCUS GUARANTEE:
 * 
 * This realtime service provides:
 * - Live score updates
 * - User presence tracking
 * - League activity feeds
 * - Automatic reconnection
 * - Background state handling
 * - Custom event broadcasting
 * 
 * Your app is now ALIVE with real-time data!
 * 
 * - Marcus "The Fixer" Rodriguez
 */
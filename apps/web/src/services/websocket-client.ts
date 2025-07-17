/**
 * 🔥 WebSocket Client for Pattern Alerts
 * Connects to Fantasy AI WebSocket Server
 */

import { io, Socket } from 'socket.io-client';
import * as React from 'react';

export interface PatternAlert {
  opportunity: {
    id: string;
    gameId: string;
    patternName: string;
    confidence: number;
    expectedValue: number;
    sport: string;
    homeTeam: string;
    awayTeam: string;
    startTime: Date;
    recommendation: string;
  };
  reason: string;
  timestamp: string;
}

export interface LiveGame {
  id: string;
  sport: string;
  homeTeam: string;
  awayTeam: string;
  homeScore: number;
  awayScore: number;
  status: string;
  quarter?: string;
  timeRemaining?: string;
}

export interface Prediction {
  id: string;
  playerId: string;
  playerName: string;
  prediction: number;
  confidence: number;
  patterns: string[];
  timestamp: string;
}

class PatternWebSocketClient {
  private socket: Socket | null = null;
  private userId: string | null = null;
  private reconnectAttempts = 0;
  private maxReconnectAttempts = 5;
  private listeners: Map<string, Set<Function>> = new Map();

  constructor() {
    this.connect();
  }

  /**
   * Connect to WebSocket server
   */
  connect(userId?: string, apiKey?: string) {
    const wsUrl = process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'http://localhost:3338';
    
    this.socket = io(wsUrl, {
      transports: ['websocket'],
      reconnection: true,
      reconnectionAttempts: this.maxReconnectAttempts,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('🔌 Connected to Pattern WebSocket Server');
      this.reconnectAttempts = 0;
      
      // Authenticate if credentials provided
      if (userId) {
        this.authenticate(userId, apiKey);
      }
      
      // Subscribe to default channels
      this.subscribe('patterns:alerts');
      this.subscribe('games:updates');
    });

    this.socket.on('disconnect', (reason) => {
      console.log('🔌 Disconnected:', reason);
      this.reconnectAttempts++;
    });

    this.socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    // Pattern alerts
    this.socket.on('new_patterns', (data) => {
      this.emit('patterns', data);
    });

    this.socket.on('pattern_alert', (alert: PatternAlert) => {
      this.emit('alert', alert);
    });

    // Game updates
    this.socket.on('live_games', (data) => {
      this.emit('games', data);
    });

    // Predictions
    this.socket.on('new_prediction', (prediction: Prediction) => {
      this.emit('prediction', prediction);
    });

    // Critical alerts
    this.socket.on('critical_alert', (alert) => {
      this.emit('critical', alert);
    });
  }

  /**
   * Authenticate with the server
   */
  authenticate(userId: string, apiKey?: string) {
    if (!this.socket) return;
    
    this.userId = userId;
    this.socket.emit('authenticate', { userId, apiKey });
    
    this.socket.once('authenticated', (response) => {
      if (response.success) {
        console.log('✅ Authenticated with WebSocket server');
        // Subscribe to user-specific channel
        this.subscribe(`users:${userId}`);
      } else {
        console.error('❌ Authentication failed:', response.error);
      }
    });
  }

  /**
   * Subscribe to a channel
   */
  subscribe(channel: string) {
    if (!this.socket) return;
    this.socket.emit('subscribe', channel);
  }

  /**
   * Unsubscribe from a channel
   */
  unsubscribe(channel: string) {
    if (!this.socket) return;
    this.socket.emit('unsubscribe', channel);
  }

  /**
   * Request live patterns
   */
  getLivePatterns(sport?: string) {
    if (!this.socket) return;
    this.socket.emit('get_live_patterns', sport);
    
    return new Promise((resolve) => {
      this.socket!.once('live_patterns', resolve);
    });
  }

  /**
   * Request game analysis
   */
  analyzeGame(gameData: { gameId: string; sport: string; homeTeam: string; awayTeam: string }) {
    if (!this.socket) return;
    this.socket.emit('analyze_game', gameData);
    
    return new Promise((resolve) => {
      this.socket!.once('game_analysis', resolve);
    });
  }

  /**
   * Add event listener
   */
  on(event: string, callback: Function) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback);
  }

  /**
   * Remove event listener
   */
  off(event: string, callback: Function) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.delete(callback);
    }
  }

  /**
   * Emit event to all listeners
   */
  private emit(event: string, data: any) {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }

  /**
   * Disconnect from server
   */
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  /**
   * Get connection status
   */
  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

// Export singleton instance
export const patternWebSocket = new PatternWebSocketClient();

// React hook for WebSocket
export function usePatternWebSocket() {
  const [connected, setConnected] = React.useState(false);
  const [patterns, setPatterns] = React.useState<PatternAlert[]>([]);
  const [games, setGames] = React.useState<LiveGame[]>([]);
  const [predictions, setPredictions] = React.useState<Prediction[]>([]);

  React.useEffect(() => {
    // Connection status
    const checkConnection = setInterval(() => {
      setConnected(patternWebSocket.isConnected());
    }, 1000);

    // Event listeners
    patternWebSocket.on('alert', (alert: PatternAlert) => {
      setPatterns(prev => [alert, ...prev].slice(0, 50)); // Keep last 50
    });

    patternWebSocket.on('games', (data) => {
      setGames(data.games);
    });

    patternWebSocket.on('prediction', (prediction: Prediction) => {
      setPredictions(prev => [prediction, ...prev].slice(0, 50));
    });

    return () => {
      clearInterval(checkConnection);
    };
  }, []);

  return {
    connected,
    patterns,
    games,
    predictions,
    subscribe: patternWebSocket.subscribe.bind(patternWebSocket),
    unsubscribe: patternWebSocket.unsubscribe.bind(patternWebSocket),
    getLivePatterns: patternWebSocket.getLivePatterns.bind(patternWebSocket),
    analyzeGame: patternWebSocket.analyzeGame.bind(patternWebSocket),
  };
}

// Auto-connect on import
if (typeof window !== 'undefined') {
  // Get user ID from localStorage or auth context
  const userId = localStorage.getItem('userId');
  if (userId) {
    patternWebSocket.authenticate(userId);
  }
}
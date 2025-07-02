/**
 * WEBSOCKET REACT HOOKS
 * 
 * Connect frontend to real-time WebSocket server
 * Handles 10K+ concurrent connections with priority messaging
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import { useAuth } from './useAuth';

export interface WebSocketMessage {
  type: string;
  channel?: string;
  data: any;
  priority?: number;
  timestamp?: string;
}

export interface WebSocketState {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  connectionCount: number;
  error: string | null;
}

interface UseWebSocketOptions {
  url?: string;
  autoConnect?: boolean;
  reconnectInterval?: number;
  maxReconnectAttempts?: number;
  heartbeatInterval?: number;
}

/**
 * Main WebSocket hook for real-time updates
 */
export function useWebSocket(options: UseWebSocketOptions = {}) {
  const {
    url = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
    autoConnect = true,
    reconnectInterval = 5000,
    maxReconnectAttempts = 10,
    heartbeatInterval = 30000
  } = options;

  const { user } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const heartbeatIntervalRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    lastMessage: null,
    connectionCount: 0,
    error: null
  });

  const [subscribedChannels, setSubscribedChannels] = useState<Set<string>>(new Set());

  /**
   * Send message to WebSocket server
   */
  const sendMessage = useCallback((message: WebSocketMessage) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({
        ...message,
        timestamp: new Date().toISOString(),
        userId: user?.id
      }));
    } else {
      console.warn('WebSocket not connected');
    }
  }, [user]);

  /**
   * Subscribe to a channel
   */
  const subscribe = useCallback((channel: string) => {
    if (subscribedChannels.has(channel)) return;
    
    sendMessage({
      type: 'subscribe',
      channel,
      data: { userId: user?.id }
    });
    
    setSubscribedChannels(prev => new Set([...prev, channel]));
  }, [sendMessage, subscribedChannels, user]);

  /**
   * Unsubscribe from a channel
   */
  const unsubscribe = useCallback((channel: string) => {
    if (!subscribedChannels.has(channel)) return;
    
    sendMessage({
      type: 'unsubscribe',
      channel,
      data: { userId: user?.id }
    });
    
    setSubscribedChannels(prev => {
      const next = new Set(prev);
      next.delete(channel);
      return next;
    });
  }, [sendMessage, subscribedChannels, user]);

  /**
   * Connect to WebSocket server
   */
  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    try {
      const wsUrl = new URL(url);
      if (user?.id) {
        wsUrl.searchParams.set('userId', user.id);
      }
      
      wsRef.current = new WebSocket(wsUrl.toString());
      
      wsRef.current.onopen = () => {
        console.log('WebSocket connected');
        setState(prev => ({
          ...prev,
          isConnected: true,
          error: null
        }));
        reconnectAttemptsRef.current = 0;
        
        // Re-subscribe to channels
        subscribedChannels.forEach(channel => {
          sendMessage({
            type: 'subscribe',
            channel,
            data: { userId: user?.id }
          });
        });
        
        // Start heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        heartbeatIntervalRef.current = setInterval(() => {
          sendMessage({ type: 'ping', data: {} });
        }, heartbeatInterval);
      };
      
      wsRef.current.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage;
          
          setState(prev => ({
            ...prev,
            lastMessage: message,
            connectionCount: message.type === 'connection_count' 
              ? message.data.count 
              : prev.connectionCount
          }));
          
          // Handle pong messages
          if (message.type === 'pong') {
            console.debug('Heartbeat received');
          }
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      };
      
      wsRef.current.onerror = (error) => {
        console.error('WebSocket error:', error);
        setState(prev => ({
          ...prev,
          error: 'Connection error'
        }));
      };
      
      wsRef.current.onclose = () => {
        console.log('WebSocket disconnected');
        setState(prev => ({
          ...prev,
          isConnected: false
        }));
        
        // Clear heartbeat
        if (heartbeatIntervalRef.current) {
          clearInterval(heartbeatIntervalRef.current);
        }
        
        // Attempt reconnection
        if (reconnectAttemptsRef.current < maxReconnectAttempts) {
          reconnectAttemptsRef.current++;
          reconnectTimeoutRef.current = setTimeout(() => {
            console.log(`Reconnecting... (attempt ${reconnectAttemptsRef.current})`);
            connect();
          }, reconnectInterval);
        } else {
          setState(prev => ({
            ...prev,
            error: 'Max reconnection attempts reached'
          }));
        }
      };
      
    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setState(prev => ({
        ...prev,
        error: 'Failed to connect'
      }));
    }
  }, [url, user, subscribedChannels, sendMessage, heartbeatInterval, reconnectInterval, maxReconnectAttempts]);

  /**
   * Disconnect from WebSocket server
   */
  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
    }
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }
  }, []);

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect) {
      connect();
    }
    
    return () => {
      disconnect();
    };
  }, [autoConnect, connect, disconnect]);

  return {
    state,
    sendMessage,
    subscribe,
    unsubscribe,
    connect,
    disconnect,
    isConnected: state.isConnected,
    lastMessage: state.lastMessage,
    error: state.error
  };
}

/**
 * Hook for game updates channel
 */
export function useGameUpdates(gameId?: string) {
  const { state, subscribe, unsubscribe, lastMessage } = useWebSocket();
  const [gameUpdate, setGameUpdate] = useState<any>(null);
  
  useEffect(() => {
    if (gameId) {
      subscribe(`game:${gameId}`);
      subscribe('games:all');
      
      return () => {
        unsubscribe(`game:${gameId}`);
        unsubscribe('games:all');
      };
    }
  }, [gameId, subscribe, unsubscribe]);
  
  useEffect(() => {
    if (lastMessage?.type === 'game_update' && 
        (lastMessage.channel === `game:${gameId}` || lastMessage.channel === 'games:all')) {
      setGameUpdate(lastMessage.data);
    }
  }, [lastMessage, gameId]);
  
  return {
    isConnected: state.isConnected,
    gameUpdate,
    error: state.error
  };
}

/**
 * Hook for ML predictions channel
 */
export function useMLPredictions() {
  const { state, subscribe, unsubscribe, lastMessage } = useWebSocket();
  const [predictions, setPredictions] = useState<any[]>([]);
  
  useEffect(() => {
    subscribe('ml:predictions');
    
    return () => {
      unsubscribe('ml:predictions');
    };
  }, [subscribe, unsubscribe]);
  
  useEffect(() => {
    if (lastMessage?.type === 'ml_prediction' && lastMessage.channel === 'ml:predictions') {
      setPredictions(prev => [...prev, lastMessage.data].slice(-50)); // Keep last 50
    }
  }, [lastMessage]);
  
  return {
    isConnected: state.isConnected,
    predictions,
    error: state.error
  };
}

/**
 * Hook for user notifications
 */
export function useNotifications(userId?: string) {
  const { state, subscribe, unsubscribe, lastMessage, sendMessage } = useWebSocket();
  const [notifications, setNotifications] = useState<any[]>([]);
  
  useEffect(() => {
    if (userId) {
      subscribe(`user:${userId}:notifications`);
      
      return () => {
        unsubscribe(`user:${userId}:notifications`);
      };
    }
  }, [userId, subscribe, unsubscribe]);
  
  useEffect(() => {
    if (lastMessage?.type === 'notification' && 
        lastMessage.channel === `user:${userId}:notifications`) {
      setNotifications(prev => [lastMessage.data, ...prev]);
    }
  }, [lastMessage, userId]);
  
  const markAsRead = useCallback((notificationId: string) => {
    sendMessage({
      type: 'notification_read',
      data: { notificationId, userId }
    });
    
    setNotifications(prev => 
      prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
    );
  }, [sendMessage, userId]);
  
  return {
    isConnected: state.isConnected,
    notifications,
    markAsRead,
    error: state.error
  };
}

/**
 * Hook for voice command updates
 */
export function useVoiceUpdates() {
  const { state, subscribe, unsubscribe, lastMessage } = useWebSocket();
  const [voiceCommand, setVoiceCommand] = useState<any>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  
  useEffect(() => {
    subscribe('voice:commands');
    subscribe('voice:responses');
    
    return () => {
      unsubscribe('voice:commands');
      unsubscribe('voice:responses');
    };
  }, [subscribe, unsubscribe]);
  
  useEffect(() => {
    if (lastMessage?.channel === 'voice:commands') {
      setVoiceCommand(lastMessage.data);
      setIsProcessing(true);
    } else if (lastMessage?.channel === 'voice:responses') {
      setIsProcessing(false);
    }
  }, [lastMessage]);
  
  return {
    isConnected: state.isConnected,
    voiceCommand,
    isProcessing,
    error: state.error
  };
}
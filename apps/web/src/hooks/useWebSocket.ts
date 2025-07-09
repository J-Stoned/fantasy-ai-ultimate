/**
 * WebSocket Hook for Real-time Updates
 * Uses Socket.IO for better compatibility and features
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';
import { WEBSOCKET_CONFIG, getWebSocketUrl } from '@/lib/config/websocket.config';

export interface WebSocketMessage {
  type: string;
  data: any;
  timestamp: Date;
}

export interface WebSocketState {
  isConnected: boolean;
  lastMessage: WebSocketMessage | null;
  error: string | null;
  reconnectAttempts: number;
}

export function useWebSocket(channels: string[] = WEBSOCKET_CONFIG.defaultChannels) {
  const [state, setState] = useState<WebSocketState>({
    isConnected: false,
    lastMessage: null,
    error: null,
    reconnectAttempts: 0
  });
  
  const socketRef = useRef<Socket | null>(null);
  const messageHandlersRef = useRef<Map<string, (data: any) => void>>(new Map());
  
  const connect = useCallback(() => {
    if (socketRef.current?.connected) return;
    
    const wsUrl = getWebSocketUrl();
    console.log('🔌 Connecting to WebSocket:', wsUrl);
    
    try {
      const socket = io(wsUrl, {
        ...WEBSOCKET_CONFIG.options,
        auth: {
          token: localStorage.getItem('auth-token') || ''
        }
      });
      
      // Connection events
      socket.on('connect', () => {
        console.log('✅ WebSocket connected');
        setState(prev => ({
          ...prev,
          isConnected: true,
          error: null,
          reconnectAttempts: 0
        }));
        
        // Subscribe to channels
        channels.forEach(channel => {
          socket.emit('subscribe', { channel });
          console.log(`📡 Subscribed to channel: ${channel}`);
        });
      });
      
      socket.on('disconnect', (reason) => {
        console.log('❌ WebSocket disconnected:', reason);
        setState(prev => ({
          ...prev,
          isConnected: false
        }));
      });
      
      socket.on('connect_error', (error) => {
        console.error('🚨 WebSocket connection error:', error.message);
        setState(prev => ({
          ...prev,
          error: error.message,
          reconnectAttempts: prev.reconnectAttempts + 1
        }));
      });
      
      // Custom events
      Object.values(WEBSOCKET_CONFIG.events).forEach(eventName => {
        if (['connect', 'disconnect', 'error', 'reconnect'].includes(eventName)) return;
        
        socket.on(eventName, (data) => {
          console.log(`📨 Received ${eventName}:`, data);
          
          const message: WebSocketMessage = {
            type: eventName,
            data,
            timestamp: new Date()
          };
          
          setState(prev => ({
            ...prev,
            lastMessage: message
          }));
          
          // Call registered handlers
          const handler = messageHandlersRef.current.get(eventName);
          if (handler) {
            handler(data);
          }
        });
      });
      
      // Generic message handler
      socket.on('message', (data) => {
        console.log('📨 Received message:', data);
        
        const message: WebSocketMessage = {
          type: data.type || 'message',
          data: data.data || data,
          timestamp: new Date(data.timestamp || Date.now())
        };
        
        setState(prev => ({
          ...prev,
          lastMessage: message
        }));
        
        // Call registered handlers
        const handler = messageHandlersRef.current.get(message.type);
        if (handler) {
          handler(message.data);
        }
      });
      
      socketRef.current = socket;
      
    } catch (err) {
      console.error('Failed to create WebSocket:', err);
      setState(prev => ({
        ...prev,
        error: 'Failed to connect'
      }));
    }
  }, [channels]);
  
  const disconnect = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
  }, []);
  
  const send = useCallback((event: string, data?: any) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit(event, data);
    } else {
      console.warn('WebSocket not connected');
    }
  }, []);
  
  const subscribe = useCallback((type: string, handler: (data: any) => void) => {
    messageHandlersRef.current.set(type, handler);
    
    return () => {
      messageHandlersRef.current.delete(type);
    };
  }, []);
  
  const subscribeToChannel = useCallback((channel: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('subscribe', { channel });
    }
  }, []);
  
  const unsubscribeFromChannel = useCallback((channel: string) => {
    if (socketRef.current?.connected) {
      socketRef.current.emit('unsubscribe', { channel });
    }
  }, []);
  
  useEffect(() => {
    connect();
    
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);
  
  return {
    ...state,
    send,
    subscribe,
    subscribeToChannel,
    unsubscribeFromChannel,
    reconnect: connect,
    disconnect,
    socket: socketRef.current
  };
}
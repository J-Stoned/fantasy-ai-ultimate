'use client';

import React, { createContext, useContext, ReactNode } from 'react';
import { useWebSocket, WebSocketState, WebSocketMessage } from '../hooks/useWebSocket';

interface WebSocketContextValue {
  state: WebSocketState;
  sendMessage: (message: WebSocketMessage) => void;
  subscribe: (channel: string) => void;
  unsubscribe: (channel: string) => void;
  connect: () => void;
  disconnect: () => void;
}

const WebSocketContext = createContext<WebSocketContextValue | null>(null);

export function WebSocketProvider({ children }: { children: ReactNode }) {
  const websocket = useWebSocket({
    autoConnect: true,
    reconnectInterval: 5000,
    maxReconnectAttempts: 10
  });

  return (
    <WebSocketContext.Provider value={websocket}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocketContext() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocketContext must be used within WebSocketProvider');
  }
  return context;
}
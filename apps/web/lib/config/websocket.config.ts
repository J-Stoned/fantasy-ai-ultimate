/**
 * WebSocket Configuration
 * Centralized configuration for real-time connections
 */

export const WEBSOCKET_CONFIG = {
  // Use the same port as the HTTP server
  url: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3000',
  
  // Socket.IO specific options
  options: {
    // Reconnection settings
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    
    // Transport settings
    transports: ['websocket', 'polling'],
    
    // Timeout settings
    timeout: 20000,
    
    // Enable binary data
    forceNew: true,
    
    // Authentication
    auth: {
      token: typeof window !== 'undefined' ? localStorage.getItem('token') : null
    }
  },
  
  // Channels to auto-subscribe
  defaultChannels: [
    'predictions',
    'patterns',
    'system-alerts',
    'lineup-updates'
  ],
  
  // Event types
  events: {
    // System events
    CONNECT: 'connect',
    DISCONNECT: 'disconnect',
    ERROR: 'error',
    RECONNECT: 'reconnect',
    
    // Custom events
    PREDICTION_UPDATE: 'prediction:update',
    PATTERN_DETECTED: 'pattern:detected',
    LINEUP_OPTIMIZED: 'lineup:optimized',
    SYSTEM_ALERT: 'system:alert',
    GAME_UPDATE: 'game:update',
    PLAYER_UPDATE: 'player:update'
  }
};

// Helper to get WebSocket URL with proper protocol
export function getWebSocketUrl(): string {
  if (typeof window === 'undefined') return WEBSOCKET_CONFIG.url;
  
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  const host = process.env.NEXT_PUBLIC_WS_HOST || window.location.host;
  
  return `${protocol}//${host}`;
}
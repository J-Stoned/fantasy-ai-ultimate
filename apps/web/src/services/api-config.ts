/**
 * API Configuration for Fantasy AI Platform
 * Central configuration for all backend services
 */

export const API_CONFIG = {
  // Pattern Detection Services
  PATTERN_API_V4: process.env.NEXT_PUBLIC_PATTERN_API_V4_URL || 'http://localhost:3336', // Using unified API
  UNIFIED_PATTERN_API: process.env.NEXT_PUBLIC_UNIFIED_PATTERN_API_URL || 'http://localhost:3336',
  
  // Fantasy Services
  FANTASY_PATTERN_API: process.env.NEXT_PUBLIC_FANTASY_PATTERN_API_URL || 'http://localhost:3340',
  
  // WebSocket Services
  WEBSOCKET_URL: process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'ws://localhost:8080',
  
  // API Keys (for pattern licensing platform)
  PATTERN_API_KEY: process.env.NEXT_PUBLIC_PATTERN_API_KEY || '',
  
  // Timeouts
  DEFAULT_TIMEOUT: 30000, // 30 seconds
  WEBSOCKET_RECONNECT_DELAY: 5000, // 5 seconds
  
  // Feature Flags
  ENABLE_WEBSOCKET: process.env.NEXT_PUBLIC_ENABLE_WEBSOCKET !== 'false',
  ENABLE_VOICE: process.env.NEXT_PUBLIC_ENABLE_VOICE !== 'false',
}

// API Endpoints
export const ENDPOINTS = {
  // Pattern API V4
  PATTERN: {
    STATS: '/api/v4/stats',
    PATTERNS: '/api/v4/patterns',
    ANALYZE: '/api/v4/analyze',
    OPPORTUNITIES: '/api/v4/opportunities',
    PERFORMANCE: '/api/v4/performance',
  },
  
  // Unified API
  UNIFIED: {
    ANALYZE: '/api/unified/analyze',
    SCAN: '/api/unified/scan', 
    TOP_PLAYS: '/api/unified/top-plays',
    STATS: '/api/unified/stats',
    LIVE: '/api/unified/live',
    INSIGHTS: '/api/unified/insights',
    VOICE_COMMAND: '/api/unified/voice-command',
  },
  
  // Fantasy Specific
  FANTASY: {
    OPTIMIZE_LINEUP: '/api/optimize/lineup',
    ANALYZE_TRADE: '/voice/trade',
    WAIVER_TARGETS: '/api/fantasy/waiver-targets',
    PLAYER_PROJECTION: '/api/fantasy/player-projection',
  },
  
  // Real-time
  ALERTS: {
    ACTIVE: '/api/alerts',
    CRITICAL: '/api/alerts/critical',
  }
}

// WebSocket Channels
export const WS_CHANNELS = {
  PATTERN_ALERTS: 'pattern:alerts',
  GAME_UPDATES: 'game:updates',
  PLAYER_NEWS: 'player:news',
  LINEUP_CHANGES: 'lineup:changes',
}

// Sport Types
export type SportType = 'NFL' | 'NBA' | 'MLB' | 'NHL'

// Pattern Types
export interface Pattern {
  id: string
  name: string
  description: string
  accuracy: number
  roi: number
  occurrences: number
  lastTriggered?: Date
  sport: SportType
  conditions: Record<string, any>
}

// Opportunity Types
export interface Opportunity {
  id: string
  gameId: string
  patternId: string
  patternName: string
  confidence: number
  expectedValue: number
  sport: SportType
  homeTeam: string
  awayTeam: string
  startTime: Date
  recommendation: string
}

// Fantasy Types
export interface LineupConfig {
  sport: SportType
  format: 'season' | 'dfs'
  contest?: 'gpp' | 'cash'
  salaryCap?: number
  positions: Record<string, number>
  excludedPlayers?: string[]
  lockedPlayers?: string[]
}

export interface PlayerProjection {
  playerId: string
  playerName: string
  team: string
  position: string
  projection: number
  patternBoost?: number
  patternEffects?: Array<{
    patternName: string
    effect: number
  }>
  ownership?: number
  salary?: number
}
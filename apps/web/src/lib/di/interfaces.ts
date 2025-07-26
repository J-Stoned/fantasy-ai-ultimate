/**
 * Service interfaces for dependency injection
 * These define contracts that implementations must follow
 */

// Database interfaces
export interface IDatabase {
  query<T>(sql: string, params?: any[]): Promise<T[]>;
  queryOne<T>(sql: string, params?: any[]): Promise<T | null>;
  execute(sql: string, params?: any[]): Promise<number>;
  transaction<T>(callback: (client: any) => Promise<T>): Promise<T>;
}

// Cache interfaces
export interface ICache {
  get<T>(key: string): Promise<T | null>;
  set<T>(key: string, value: T, ttl?: number): Promise<void>;
  delete(key: string): Promise<void>;
  clear(): Promise<void>;
  has(key: string): Promise<boolean>;
}

// Logger interfaces
export interface ILogger {
  debug(message: string, meta?: any): void;
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, error?: any, meta?: any): void;
}

// ML Service interfaces
export interface IPredictionService {
  predictPlayerPerformance(playerId: string, context?: any): Promise<number>;
  predictLineupScore(lineup: any[], context?: any): Promise<number>;
  getModelInfo(): Promise<{ name: string; version: string; accuracy: number }>;
}

// Auth interfaces
export interface IAuthService {
  login(email: string, password: string): Promise<{ user: any; token: string }>;
  logout(): Promise<void>;
  getCurrentUser(): Promise<any | null>;
  refreshToken(): Promise<string>;
  verifyToken(token: string): Promise<boolean>;
}

// WebSocket interfaces
export interface IWebSocketService {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  subscribe(channel: string, handler: (data: any) => void): () => void;
  send(event: string, data: any): void;
  isConnected(): boolean;
}

// Fantasy service interfaces
export interface IFantasyService {
  getPlayers(sport: string, filters?: any): Promise<any[]>;
  getContests(platform: string, sport?: string): Promise<any[]>;
  optimizeLineup(contest: any, players: any[]): Promise<any[]>;
  calculateFantasyPoints(player: any, scoring: any): number;
}

// Configuration interfaces
export interface IConfig {
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: any): void;
  has(key: string): boolean;
  getAll(): Record<string, any>;
}

// Feature flags interface
export interface IFeatureFlags {
  isEnabled(feature: string): boolean;
  getAllFlags(): Record<string, boolean>;
  setFlag(feature: string, enabled: boolean): void;
}

// Service tokens for dependency injection
export const SERVICE_TOKENS = {
  Database: Symbol('Database'),
  Cache: Symbol('Cache'),
  Logger: Symbol('Logger'),
  PredictionService: Symbol('PredictionService'),
  AuthService: Symbol('AuthService'),
  WebSocketService: Symbol('WebSocketService'),
  FantasyService: Symbol('FantasyService'),
  Config: Symbol('Config'),
  FeatureFlags: Symbol('FeatureFlags'),
} as const;
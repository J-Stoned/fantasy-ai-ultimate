// WebSocket Event Types

// Base Types
export interface WebSocketEventBase {
  id: string;
  timestamp: string;
  version?: string;
}

export interface WebSocketRequest<T = unknown> extends WebSocketEventBase {
  type: string;
  payload: T;
}

export interface WebSocketResponse<T = unknown> extends WebSocketEventBase {
  type: string;
  success: boolean;
  data?: T;
  error?: WebSocketError;
}

export interface WebSocketError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// Connection Events
export interface ConnectionEvent extends WebSocketEventBase {
  type: 'connection' | 'disconnect' | 'reconnect' | 'error';
  clientId: string;
  reason?: string;
}

// Authentication Events
export interface AuthEvent extends WebSocketEventBase {
  type: 'auth' | 'auth_success' | 'auth_failure' | 'logout';
  token?: string;
  userId?: string;
  error?: string;
}

// Subscription Events
export interface SubscriptionEvent extends WebSocketEventBase {
  type: 'subscribe' | 'unsubscribe' | 'subscription_update';
  channel: string;
  filters?: Record<string, unknown>;
}

// Draft Events
export interface DraftEvent extends WebSocketEventBase {
  type: 'draft_started' | 'draft_pick' | 'draft_paused' | 'draft_resumed' | 'draft_completed';
  draftId: string;
  leagueId: string;
}

export interface DraftPickEvent extends DraftEvent {
  type: 'draft_pick';
  pick: {
    pickNumber: number;
    round: number;
    teamId: string;
    playerId: string;
    timeUsed: number;
  };
  nextPick?: {
    teamId: string;
    pickNumber: number;
    timeRemaining: number;
  };
}

export interface DraftTimerEvent extends DraftEvent {
  type: 'draft_timer';
  timeRemaining: number;
  onClock: string;
}

// Live Scoring Events
export interface LiveScoreEvent extends WebSocketEventBase {
  type: 'score_update' | 'game_started' | 'game_final' | 'quarter_end' | 'half_end';
  gameId: string;
  sport: string;
}

export interface PlayerScoreUpdate extends LiveScoreEvent {
  type: 'player_score_update';
  playerId: string;
  points: number;
  stats: Record<string, number>;
  play?: {
    type: string;
    description: string;
    yards?: number;
    points?: number;
  };
}

export interface GameScoreUpdate extends LiveScoreEvent {
  type: 'game_score_update';
  homeScore: number;
  awayScore: number;
  quarter?: number;
  timeRemaining?: string;
}

// Contest Events
export interface ContestEvent extends WebSocketEventBase {
  type: 'contest_update' | 'contest_started' | 'contest_locked' | 'contest_final';
  contestId: string;
  platform: string;
}

export interface ContestEntryUpdate extends ContestEvent {
  type: 'contest_entry_update';
  entryId: string;
  rank: number;
  points: number;
  percentile: number;
  winnings?: number;
}

export interface ContestOwnershipUpdate extends ContestEvent {
  type: 'contest_ownership_update';
  ownership: Array<{
    playerId: string;
    ownership: number;
    delta: number;
  }>;
}

// Trading Events
export interface TradingEvent extends WebSocketEventBase {
  type: 'portfolio_update' | 'position_opened' | 'position_closed' | 'order_filled';
  userId: string;
}

export interface PortfolioUpdate extends TradingEvent {
  type: 'portfolio_update';
  portfolio: {
    totalValue: number;
    cashBalance: number;
    positions: number;
    dayChange: number;
    dayChangePercent: number;
  };
}

export interface PositionUpdate extends TradingEvent {
  type: 'position_update';
  position: {
    id: string;
    contestId: string;
    size: number;
    avgPrice: number;
    currentPrice: number;
    pnl: number;
    pnlPercent: number;
  };
}

// ML Training Events
export interface MLTrainingEvent extends WebSocketEventBase {
  type: 'training_started' | 'training_progress' | 'training_completed' | 'training_failed';
  jobId: string;
  modelName: string;
}

export interface TrainingProgressUpdate extends MLTrainingEvent {
  type: 'training_progress';
  epoch: number;
  totalEpochs: number;
  loss: number;
  accuracy?: number;
  validationLoss?: number;
  validationAccuracy?: number;
  timeElapsed: number;
  estimatedTimeRemaining: number;
}

export interface TrainingMetricsUpdate extends MLTrainingEvent {
  type: 'training_metrics';
  metrics: {
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1Score?: number;
    r2Score?: number;
    mse?: number;
    mae?: number;
  };
  confusionMatrix?: number[][];
}

// Admin Events
export interface AdminEvent extends WebSocketEventBase {
  type: 'system_alert' | 'user_activity' | 'error_spike' | 'performance_warning';
  severity: 'info' | 'warning' | 'error' | 'critical';
}

export interface SystemMetricsUpdate extends AdminEvent {
  type: 'system_metrics';
  metrics: {
    cpu: number;
    memory: number;
    disk: number;
    activeUsers: number;
    requestsPerMinute: number;
    avgResponseTime: number;
    errorRate: number;
  };
}

export interface RateLimitUpdate extends AdminEvent {
  type: 'rate_limit_update';
  limits: Array<{
    endpoint: string;
    current: number;
    limit: number;
    resetAt: string;
    blocked: string[];
  }>;
}

// Chat Events
export interface ChatEvent extends WebSocketEventBase {
  type: 'chat_message' | 'chat_typing' | 'chat_user_joined' | 'chat_user_left';
  channel: string;
  userId: string;
  username: string;
}

export interface ChatMessage extends ChatEvent {
  type: 'chat_message';
  message: {
    id: string;
    text: string;
    attachments?: Array<{
      type: string;
      url: string;
      name?: string;
    }>;
    replyTo?: string;
    edited?: boolean;
    editedAt?: string;
  };
}

// Notification Events
export interface NotificationEvent extends WebSocketEventBase {
  type: 'notification';
  category: 'trade' | 'injury' | 'lineup' | 'score' | 'system';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  message: string;
  actionUrl?: string;
  data?: Record<string, unknown>;
}

// Event Maps for Type Safety
export interface WebSocketEventMap {
  // Connection
  connection: ConnectionEvent;
  disconnect: ConnectionEvent;
  reconnect: ConnectionEvent;
  error: ConnectionEvent;
  
  // Auth
  auth: AuthEvent;
  auth_success: AuthEvent;
  auth_failure: AuthEvent;
  logout: AuthEvent;
  
  // Subscriptions
  subscribe: SubscriptionEvent;
  unsubscribe: SubscriptionEvent;
  subscription_update: SubscriptionEvent;
  
  // Draft
  draft_started: DraftEvent;
  draft_pick: DraftPickEvent;
  draft_timer: DraftTimerEvent;
  draft_paused: DraftEvent;
  draft_resumed: DraftEvent;
  draft_completed: DraftEvent;
  
  // Live Scoring
  player_score_update: PlayerScoreUpdate;
  game_score_update: GameScoreUpdate;
  game_started: LiveScoreEvent;
  game_final: LiveScoreEvent;
  
  // Contest
  contest_entry_update: ContestEntryUpdate;
  contest_ownership_update: ContestOwnershipUpdate;
  contest_started: ContestEvent;
  contest_locked: ContestEvent;
  contest_final: ContestEvent;
  
  // Trading
  portfolio_update: PortfolioUpdate;
  position_update: PositionUpdate;
  
  // ML Training
  training_started: MLTrainingEvent;
  training_progress: TrainingProgressUpdate;
  training_metrics: TrainingMetricsUpdate;
  training_completed: MLTrainingEvent;
  training_failed: MLTrainingEvent;
  
  // Admin
  system_metrics: SystemMetricsUpdate;
  rate_limit_update: RateLimitUpdate;
  system_alert: AdminEvent;
  
  // Chat
  chat_message: ChatMessage;
  chat_typing: ChatEvent;
  chat_user_joined: ChatEvent;
  chat_user_left: ChatEvent;
  
  // Notifications
  notification: NotificationEvent;
}

// Type-safe event emitter types
export type WebSocketEventType = keyof WebSocketEventMap;
export type WebSocketEventData<T extends WebSocketEventType> = WebSocketEventMap[T];

// WebSocket Client Types
export interface WebSocketClientOptions {
  url: string;
  reconnect?: boolean;
  reconnectInterval?: number;
  reconnectAttempts?: number;
  heartbeatInterval?: number;
  timeout?: number;
  auth?: {
    token: string;
  };
}

export interface WebSocketClient {
  connect(): Promise<void>;
  disconnect(): void;
  send<T extends WebSocketEventType>(event: T, data: Omit<WebSocketEventData<T>, 'id' | 'timestamp'>): void;
  on<T extends WebSocketEventType>(event: T, handler: (data: WebSocketEventData<T>) => void): void;
  off<T extends WebSocketEventType>(event: T, handler: (data: WebSocketEventData<T>) => void): void;
  once<T extends WebSocketEventType>(event: T, handler: (data: WebSocketEventData<T>) => void): void;
  subscribe(channel: string, filters?: Record<string, unknown>): void;
  unsubscribe(channel: string): void;
  getState(): 'connecting' | 'connected' | 'disconnecting' | 'disconnected';
}
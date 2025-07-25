// Common API Response Types
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
  timestamp?: string;
}

export interface PaginatedResponse<T = unknown> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Auth Types
export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  avatar?: string;
  role?: 'user' | 'admin' | 'superadmin';
  createdAt: string;
  updatedAt: string;
}

export interface AuthSession {
  id: string;
  userId: string;
  token: string;
  expiresAt: string;
  createdAt: string;
  ipAddress?: string;
  userAgent?: string;
}

// League Types
export interface League {
  id: string;
  platformId: string;
  platform: 'espn' | 'yahoo' | 'cbs' | 'sleeper' | 'draftkings' | 'fanduel';
  name: string;
  sport: 'nfl' | 'nba' | 'mlb' | 'nhl' | 'ncaa_fb' | 'ncaa_bb';
  season: string;
  teamCount: number;
  scoringType: string;
  isActive: boolean;
  myTeamId?: string;
  myTeamName?: string;
  currentStanding?: number;
  settings: LeagueSettings;
  lastSynced?: Date;
}

export interface LeagueSettings {
  rosterPositions: RosterPosition[];
  scoringSettings: ScoringSettings;
  draftSettings?: DraftSettings;
  waiverSettings?: WaiverSettings;
  tradeSettings?: TradeSettings;
  playoffSettings?: PlayoffSettings;
  [key: string]: unknown; // For platform-specific settings
}

export interface RosterPosition {
  position: string;
  count: number;
  eligible?: string[];
}

export interface ScoringSettings {
  passingTouchdown?: number;
  passingYards?: number;
  rushingTouchdown?: number;
  rushingYards?: number;
  receivingTouchdown?: number;
  receivingYards?: number;
  [key: string]: number | undefined;
}

export interface DraftSettings {
  type: 'snake' | 'auction' | 'linear';
  rounds: number;
  secondsPerPick?: number;
  budget?: number;
}

export interface WaiverSettings {
  type: 'rolling' | 'faab' | 'reverse_standings';
  budget?: number;
  processTime?: string;
}

export interface TradeSettings {
  deadline?: string;
  reviewPeriod?: number;
  votesRequired?: number;
}

export interface PlayoffSettings {
  teams: number;
  weeks: number[];
  seedingType: 'record' | 'points' | 'h2h';
}

// Player Types
export interface Player {
  id: string;
  platformId?: string;
  name: string;
  team: string;
  position: string;
  jerseyNumber?: string;
  height?: string;
  weight?: string;
  age?: number;
  experience?: number;
  college?: string;
  injuryStatus?: 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir';
  injuryDetails?: string;
  imageUrl?: string;
  stats?: PlayerStats;
  projections?: PlayerProjections;
  ownership?: PlayerOwnership;
}

export interface PlayerStats {
  season: SeasonStats;
  lastGame?: GameStats;
  last5Games?: GameStats;
  career?: SeasonStats;
}

export interface SeasonStats {
  gamesPlayed: number;
  points: number;
  [statKey: string]: number;
}

export interface GameStats {
  date: string;
  opponent: string;
  points: number;
  [statKey: string]: number | string;
}

export interface PlayerProjections {
  week?: number;
  season?: number;
  nextGame?: GameProjection;
  restOfSeason?: number;
}

export interface GameProjection {
  opponent: string;
  date: string;
  projectedPoints: number;
  confidence: number;
  weather?: WeatherConditions;
}

export interface PlayerOwnership {
  rostered: number;
  started: number;
  trending: 'up' | 'down' | 'stable';
  delta24h?: number;
  delta7d?: number;
}

// Contest Types (DFS)
export interface Contest {
  id: string;
  platform: 'draftkings' | 'fanduel' | 'yahoo';
  name: string;
  sport: string;
  contestType: 'gpp' | 'cash' | 'satellite' | 'qualifier';
  entryFee: number;
  totalPrize: number;
  maxEntries: number;
  totalEntries: number;
  currentEntries: number;
  salaryCap: number;
  startTime: string;
  games: GameInfo[];
  payoutStructure: PayoutTier[];
}

export interface GameInfo {
  id: string;
  homeTeam: string;
  awayTeam: string;
  startTime: string;
  venue?: string;
  weather?: WeatherConditions;
}

export interface WeatherConditions {
  temperature: number;
  windSpeed: number;
  windDirection: string;
  precipitation: number;
  conditions: string;
}

export interface PayoutTier {
  minRank: number;
  maxRank: number;
  prize: number;
}

// Lineup Types
export interface Lineup {
  id: string;
  contestId: string;
  players: LineupPlayer[];
  totalSalary: number;
  projectedPoints: number;
  actualPoints?: number;
  rank?: number;
  winnings?: number;
}

export interface LineupPlayer {
  playerId: string;
  position: string;
  salary: number;
  projectedPoints: number;
  actualPoints?: number;
  ownership?: number;
}

// Trade Types
export interface Trade {
  id: string;
  leagueId: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'expired' | 'completed';
  proposedBy: string;
  proposedTo: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  teamADraftPicks?: DraftPick[];
  teamBDraftPicks?: DraftPick[];
  teamAFAAB?: number;
  teamBFAAB?: number;
  proposedAt: string;
  expiresAt?: string;
  completedAt?: string;
  analysis?: TradeAnalysis;
}

export interface DraftPick {
  year: number;
  round: number;
  originalOwner?: string;
}

export interface TradeAnalysis {
  teamAValue: number;
  teamBValue: number;
  fairness: number;
  teamAProjectedWins: number;
  teamBProjectedWins: number;
  recommendation: 'accept' | 'reject' | 'neutral';
  reasoning: string;
}

// Draft Types
export interface DraftState {
  id: string;
  leagueId: string;
  status: 'not_started' | 'in_progress' | 'paused' | 'completed';
  currentPick: number;
  currentRound: number;
  onClock?: string;
  timeRemaining?: number;
  picks: DraftPickResult[];
}

export interface DraftPickResult {
  pick: number;
  round: number;
  teamId: string;
  playerId: string;
  timestamp: string;
  timeUsed?: number;
  isKeeper?: boolean;
}

export interface DraftRecommendation {
  playerId: string;
  score: number;
  reasoning: string;
  alternatives: string[];
  positionScarcity: number;
  valueOverReplacement: number;
}

// Waiver Types
export interface WaiverClaim {
  id: string;
  leagueId: string;
  teamId: string;
  status: 'pending' | 'processed' | 'failed' | 'cancelled';
  priority: number;
  addPlayerId: string;
  dropPlayerId?: string;
  bidAmount?: number;
  processedAt?: string;
  reason?: string;
}

export interface WaiverRecommendation {
  playerId: string;
  score: number;
  trending: boolean;
  projectedPoints: number;
  restOfSeasonValue: number;
  dropCandidate?: string;
  bidSuggestion?: number;
}

// ML/Prediction Types
export interface Prediction {
  playerId: string;
  gameId?: string;
  type: 'points' | 'ceiling' | 'floor' | 'boom_bust';
  value: number;
  confidence: number;
  factors: PredictionFactor[];
}

export interface PredictionFactor {
  name: string;
  impact: number;
  description: string;
}

// Admin Types
export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalLeagues: number;
  totalContests: number;
  systemHealth: SystemHealth;
  recentActivity: ActivityLog[];
}

export interface SystemHealth {
  cpu: number;
  memory: number;
  disk: number;
  database: 'healthy' | 'degraded' | 'down';
  cache: 'healthy' | 'degraded' | 'down';
  queues: QueueHealth[];
}

export interface QueueHealth {
  name: string;
  pending: number;
  processing: number;
  failed: number;
  status: 'healthy' | 'backed_up' | 'failing';
}

export interface ActivityLog {
  id: string;
  userId?: string;
  action: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
  severity: 'info' | 'warning' | 'error';
}

// WebSocket Types
export interface WebSocketMessage<T = unknown> {
  type: string;
  channel?: string;
  data: T;
  timestamp: string;
  id?: string;
}

export interface WebSocketError {
  code: string;
  message: string;
  details?: unknown;
}

// Error Types
export interface ApiError {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface ValidationError {
  field: string;
  message: string;
  value?: unknown;
}

// Bankroll Types
export interface BankrollStats {
  totalDeposited: number;
  totalWithdrawn: number;
  currentBalance: number;
  totalWinnings: number;
  totalLosses: number;
  roi: number;
  kellyMultiplier: number;
  riskLevel: 'conservative' | 'moderate' | 'aggressive';
}

export interface BankrollRecommendation {
  contestId: string;
  recommendedStake: number;
  kellyPercentage: number;
  expectedValue: number;
  riskScore: number;
  reasoning: string;
}
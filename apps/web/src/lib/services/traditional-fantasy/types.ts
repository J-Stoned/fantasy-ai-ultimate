/**
 * Universal Fantasy League Import System - Type Definitions
 * Supports Yahoo, ESPN, CBS Sports, and Sleeper platforms
 */

// Platform Types
export type FantasyPlatform = 'yahoo' | 'espn' | 'cbs' | 'sleeper';

// Authentication Types
export interface AuthCredentials {
  platform: FantasyPlatform;
  accessToken?: string;
  refreshToken?: string;
  expiresAt?: Date;
  userId?: string;
  apiKey?: string;
  clientId?: string;
  clientSecret?: string;
}

export interface OAuthConfig {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scope: string[];
  authorizationUrl: string;
  tokenUrl: string;
}

// League Types
export interface League {
  id: string;
  platform: FantasyPlatform;
  platformLeagueId: string;
  name: string;
  season: number;
  sport: SportType;
  isActive: boolean;
  settings: LeagueSettings;
  teams: Team[];
  draftInfo?: DraftInfo;
  currentWeek?: number;
  totalWeeks: number;
  playoffWeeks?: number[];
  createdAt: Date;
  updatedAt: Date;
}

export interface LeagueSettings {
  scoringSystem: ScoringSystem;
  rosterPositions: RosterPosition[];
  waiverType: WaiverType;
  tradeDeadline?: Date;
  playoffStartWeek?: number;
  maxTeams: number;
  draftType: DraftType;
  scoringPeriod: 'weekly' | 'daily';
  categories?: string[]; // For category leagues
}

export interface ScoringSystem {
  type: 'points' | 'category' | 'h2h_points' | 'h2h_category' | 'roto';
  scoringItems: ScoringItem[];
}

export interface ScoringItem {
  statId: string;
  statName: string;
  points: number;
  isDecimal?: boolean;
}

export interface RosterPosition {
  position: string;
  abbreviation: string;
  count: number;
  isActive: boolean;
  isFlex?: boolean;
  eligiblePositions?: string[];
}

// Team Types
export interface Team {
  id: string;
  platformTeamId: string;
  leagueId: string;
  name: string;
  abbreviation?: string;
  logoUrl?: string;
  ownerId: string;
  ownerName: string;
  standing?: TeamStanding;
  roster: Roster;
  draftGrade?: string;
  projectedRank?: number;
  currentRank?: number;
}

export interface TeamStanding {
  rank: number;
  wins: number;
  losses: number;
  ties: number;
  points?: number;
  pointsAgainst?: number;
  categories?: CategoryStanding[];
  streakType?: 'W' | 'L' | 'T';
  streakLength?: number;
}

export interface CategoryStanding {
  categoryId: string;
  categoryName: string;
  value: number;
  rank: number;
}

// Roster Types
export interface Roster {
  teamId: string;
  players: RosterPlayer[];
  startingLineup?: string[]; // Player IDs
  benchPlayers?: string[]; // Player IDs
  injuredReserve?: string[]; // Player IDs
  
  // ELITE: Team analytics from real performance data! 🔥
  teamAnalytics?: {
    avgOverallRating: number;
    projectedWeeklyPoints: number;
    avgConsistency: number;
    injuryRisk: number;
    strengthOfRoster: number;
    matchedPlayerCount: number;
    totalPlayerCount: number;
  };
}

export interface RosterPlayer {
  id: string;
  platformPlayerId: string;
  name: string;
  position: string;
  eligiblePositions: string[];
  team: string;
  status: PlayerStatus;
  injuryStatus?: InjuryStatus;
  stats?: PlayerStats;
  projectedStats?: PlayerStats;
  acquisitionInfo?: AcquisitionInfo;
  imageUrl?: string;
  
  // ELITE: Real performance data from 1.57M game stats! 🔥
  realPlayerId?: number;
  realPerformanceData?: {
    seasonStats?: any;
    recentGames?: any[];
    overallRating?: number;
    injuryHistory?: any[];
    consistencyScore: number;
    avgFantasyPoints: number;
    gamesPlayed: number;
    lastUpdated: Date;
  };
}

export interface PlayerStatus {
  isActive: boolean;
  isStarting: boolean;
  positionType: 'starter' | 'bench' | 'ir' | 'na';
}

export interface InjuryStatus {
  status: 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir';
  description?: string;
  returnDate?: Date;
}

export interface PlayerStats {
  season?: SeasonStats;
  week?: WeekStats;
  projections?: ProjectionStats;
}

export interface SeasonStats {
  [statKey: string]: number;
}

export interface WeekStats {
  week: number;
  [statKey: string]: number;
}

export interface ProjectionStats {
  [statKey: string]: number;
}

export interface AcquisitionInfo {
  type: 'draft' | 'waiver' | 'trade' | 'freeagent';
  date: Date;
  cost?: number; // For auction waivers
  tradedFrom?: string; // Team ID
  draftRound?: number;
  draftPick?: number;
}

// Draft Types
export interface DraftInfo {
  id: string;
  leagueId: string;
  type: DraftType;
  status: DraftStatus;
  startTime: Date;
  picks: DraftPick[];
  rounds: number;
  secondsPerPick?: number;
}

export interface DraftPick {
  round: number;
  pick: number;
  overallPick: number;
  teamId: string;
  playerId: string;
  playerName: string;
  position: string;
  keeperRound?: number;
  auctionValue?: number;
  timestamp: Date;
}

// Transaction Types
export interface Transaction {
  id: string;
  leagueId: string;
  type: TransactionType;
  status: TransactionStatus;
  teams: string[]; // Team IDs involved
  players: TransactionPlayer[];
  proposedDate: Date;
  processedDate?: Date;
  effectiveDate?: Date;
  bidAmount?: number; // For waiver claims
  priority?: number; // For waiver priority
}

export interface TransactionPlayer {
  playerId: string;
  playerName: string;
  fromTeamId?: string;
  toTeamId?: string;
  action: 'add' | 'drop' | 'trade';
}

// Matchup Types
export interface Matchup {
  id: string;
  leagueId: string;
  week: number;
  team1Id: string;
  team2Id: string;
  team1Score?: number;
  team2Score?: number;
  team1Projection?: number;
  team2Projection?: number;
  winnerId?: string;
  status: MatchupStatus;
  startDate: Date;
  endDate: Date;
  isPlayoffs: boolean;
  isConsolation: boolean;
}

// Enum Types
export type SportType = 'nfl' | 'nba' | 'mlb' | 'nhl';
export type WaiverType = 'standard' | 'faab' | 'continuous' | 'none';
export type DraftType = 'snake' | 'auction' | 'linear' | 'keeper' | 'dynasty';
export type DraftStatus = 'pre_draft' | 'drafting' | 'post_draft' | 'paused';
export type TransactionType = 'waiver' | 'trade' | 'freeagent' | 'drop';
export type TransactionStatus = 'pending' | 'approved' | 'rejected' | 'executed' | 'cancelled';
export type MatchupStatus = 'scheduled' | 'in_progress' | 'final';

// API Response Types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  metadata?: ResponseMetadata;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
  retryable?: boolean;
  retryAfter?: number;
}

// Raw Platform Data Types for normalization
export interface RawLeagueData {
  id?: string;
  league_id?: string;
  platformLeagueId?: string;
  name?: string;
  season?: number | string;
  sport?: string;
  isActive?: boolean;
  settings?: Record<string, unknown>;
  teams?: RawTeamData[];
  draftInfo?: unknown;
  currentWeek?: number;
  totalWeeks?: number;
  playoffWeeks?: number[];
  createdAt?: Date | string;
  updatedAt?: Date | string;
}

export interface RawTeamData {
  id?: string;
  team_id?: string;
  platformTeamId?: string;
  leagueId?: string;
  league_id?: string;
  name?: string;
  teamName?: string;
  abbreviation?: string;
  abbrev?: string;
  logoUrl?: string;
  logo?: string;
  avatar?: string;
  ownerId?: string;
  owner_id?: string;
  userId?: string;
  ownerName?: string;
  owner_name?: string;
  userName?: string;
  standing?: TeamStanding;
  roster?: RawRosterData;
  draftGrade?: string;
  projectedRank?: number;
  currentRank?: number;
}

export interface RawRosterData {
  teamId?: string;
  team_id?: string;
  players?: RawPlayerData[];
  startingLineup?: string[];
  benchPlayers?: string[];
  injuredReserve?: string[];
}

export interface RawPlayerData {
  id?: string;
  player_id?: string;
  platformPlayerId?: string;
  name?: string;
  playerName?: string;
  fullName?: string;
  position?: string;
  primaryPosition?: string;
  eligiblePositions?: string[];
  team?: string;
  proTeam?: string;
  nflTeam?: string;
  status?: PlayerStatus;
  injury?: RawInjuryData;
  injuryStatus?: InjuryStatus | RawInjuryData;
  stats?: PlayerStats;
  projectedStats?: PlayerStats;
  acquisitionInfo?: AcquisitionInfo;
  imageUrl?: string;
  photo?: string;
  headshot?: string;
}

export interface RawInjuryData {
  status?: string;
  designation?: string;
  description?: string;
  details?: string;
  bodyPart?: string;
  returnDate?: Date | string;
}

export interface RawDraftData {
  id?: string;
  draft_id?: string;
  leagueId?: string;
  league_id?: string;
  type?: string;
  status?: string;
  startTime?: Date | string;
  start_time?: Date | string;
  picks?: unknown[];
  rounds?: number;
  secondsPerPick?: number;
  seconds_per_pick?: number;
}

export interface RawTransactionData {
  id?: string;
  transaction_id?: string;
  leagueId?: string;
  league_id?: string;
  type?: string;
  status?: string;
  teams?: string[];
  players?: unknown[];
  proposedDate?: Date | string;
  proposed_date?: Date | string;
  processedDate?: Date | string;
  processed_date?: Date | string;
  effectiveDate?: Date | string;
  effective_date?: Date | string;
  bidAmount?: number;
  bid_amount?: number;
  priority?: number;
}

export interface RawMatchupData {
  id?: string;
  matchup_id?: string;
  leagueId?: string;
  league_id?: string;
  week?: number;
  team1Id?: string;
  team1_id?: string;
  team2Id?: string;
  team2_id?: string;
  team1Score?: number;
  team1_score?: number;
  team2Score?: number;
  team2_score?: number;
  team1Projection?: number;
  team1_projection?: number;
  team2Projection?: number;
  team2_projection?: number;
  winnerId?: string;
  winner_id?: string;
  status?: string;
  startDate?: Date | string;
  start_date?: Date | string;
  endDate?: Date | string;
  end_date?: Date | string;
  isPlayoffs?: boolean;
  is_playoffs?: boolean;
  isConsolation?: boolean;
  is_consolation?: boolean;
}

export interface RawPositionData {
  position?: string;
  name?: string;
  abbreviation?: string;
  count?: number;
  isActive?: boolean;
  is_active?: boolean;
  isFlex?: boolean;
  is_flex?: boolean;
  eligiblePositions?: string[];
  eligible_positions?: string[];
}

export interface ResponseMetadata {
  requestId: string;
  timestamp: Date;
  rateLimit?: RateLimitInfo;
  pagination?: PaginationInfo;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: Date;
}

export interface PaginationInfo {
  page: number;
  pageSize: number;
  totalPages: number;
  totalItems: number;
  hasNext: boolean;
  hasPrev: boolean;
}

// Sync Types
export interface SyncConfig {
  platform: FantasyPlatform;
  leagueId: string;
  syncInterval: number; // milliseconds
  syncTypes: SyncType[];
  priority: SyncPriority;
  retryConfig: RetryConfig;
}

export type SyncType = 'roster' | 'standings' | 'matchups' | 'transactions' | 'stats' | 'all';
export type SyncPriority = 'high' | 'medium' | 'low';

export interface RetryConfig {
  maxRetries: number;
  baseDelay: number;
  maxDelay: number;
  backoffMultiplier: number;
}

export interface SyncStatus {
  leagueId: string;
  platform: FantasyPlatform;
  lastSync: Date;
  nextSync: Date;
  status: 'idle' | 'syncing' | 'error' | 'scheduled';
  error?: string;
  syncedData: {
    [key in SyncType]?: Date;
  };
}

// Import/Export Types
export interface ImportConfig {
  platform: FantasyPlatform;
  credentials: AuthCredentials;
  leagueIds?: string[];
  importOptions: ImportOptions;
}

export interface ImportOptions {
  includeHistory: boolean;
  historicalSeasons?: number[];
  includeTransactions: boolean;
  includeDraftData: boolean;
  includePlayerStats: boolean;
  overwriteExisting: boolean;
}

export interface ExportConfig {
  leagueId: string;
  targetPlatform?: FantasyPlatform;
  exportFormat: 'json' | 'csv' | 'xlsx';
  includeOptions: ExportOptions;
}

export interface ExportOptions {
  includeRosters: boolean;
  includeStandings: boolean;
  includeTransactions: boolean;
  includeDraftData: boolean;
  includeStats: boolean;
  dateRange?: {
    start: Date;
    end: Date;
  };
}

// Platform-specific API interfaces
export interface PlatformApiClient {
  authenticate(credentials: AuthCredentials): Promise<AuthCredentials>;
  refreshToken?(credentials: AuthCredentials): Promise<AuthCredentials>;
  getLeagues(userId: string): Promise<League[]>;
  getLeague(leagueId: string): Promise<League>;
  getTeams(leagueId: string): Promise<Team[]>;
  getRosters(leagueId: string): Promise<Roster[]>;
  getDraftData(leagueId: string): Promise<DraftInfo>;
  getTransactions(leagueId: string, options?: TransactionOptions): Promise<Transaction[]>;
  getMatchups(leagueId: string, week?: number): Promise<Matchup[]>;
  getPlayerStats(playerId: string, options?: StatsOptions): Promise<PlayerStats>;
  testConnection(): Promise<boolean>;
}

export interface TransactionOptions {
  types?: TransactionType[];
  startDate?: Date;
  endDate?: Date;
  teamId?: string;
  limit?: number;
}

export interface StatsOptions {
  season?: number;
  week?: number;
  includeProjections?: boolean;
}
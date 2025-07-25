// Database Table Types - Matching PostgreSQL schema

// User Tables
export interface DbUser {
  id: string;
  email: string;
  name: string | null;
  avatar_url: string | null;
  role: 'user' | 'admin' | 'superadmin';
  created_at: Date;
  updated_at: Date;
  last_login: Date | null;
  is_active: boolean;
  metadata: Record<string, unknown> | null;
}

export interface DbUserPreferences {
  id: string;
  user_id: string;
  preferred_sports: string[];
  preferred_platforms: string[];
  risk_tolerance: 'conservative' | 'moderate' | 'aggressive';
  notification_settings: NotificationSettings;
  display_settings: DisplaySettings;
  created_at: Date;
  updated_at: Date;
}

export interface NotificationSettings {
  email: boolean;
  push: boolean;
  sms: boolean;
  lineup_alerts: boolean;
  trade_alerts: boolean;
  injury_alerts: boolean;
  price_alerts: boolean;
}

export interface DisplaySettings {
  theme: 'light' | 'dark' | 'auto';
  compact_mode: boolean;
  show_projections: boolean;
  default_scoring: string;
}

// League Tables
export interface DbLeague {
  id: string;
  platform_id: string;
  platform: string;
  user_id: string;
  name: string;
  sport: string;
  season: string;
  team_count: number;
  scoring_type: string;
  is_active: boolean;
  my_team_id: string | null;
  my_team_name: string | null;
  current_standing: number | null;
  settings: Record<string, unknown>;
  last_synced: Date;
  created_at: Date;
  updated_at: Date;
}

export interface DbLeagueRoster {
  id: string;
  league_id: string;
  team_id: string;
  team_name: string;
  players: string[];
  roster_spots: Record<string, string[]>;
  created_at: Date;
  updated_at: Date;
}

// Player Tables
export interface DbPlayer {
  id: string;
  external_id: string | null;
  name: string;
  team: string;
  position: string;
  sport: string;
  jersey_number: string | null;
  height: string | null;
  weight: string | null;
  birth_date: Date | null;
  college: string | null;
  draft_year: number | null;
  draft_round: number | null;
  draft_pick: number | null;
  status: 'active' | 'injured' | 'suspended' | 'retired';
  injury_status: string | null;
  injury_details: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbPlayerStats {
  id: string;
  player_id: string;
  season: number;
  week: number | null;
  game_id: string | null;
  stats: Record<string, number>;
  fantasy_points: Record<string, number>;
  created_at: Date;
}

export interface DbPlayerProjection {
  id: string;
  player_id: string;
  game_id: string | null;
  week: number | null;
  season: number;
  projection_type: 'game' | 'week' | 'season';
  source: string;
  projected_stats: Record<string, number>;
  projected_points: Record<string, number>;
  confidence: number;
  created_at: Date;
  updated_at: Date;
}

// Contest Tables (DFS)
export interface DbContest {
  id: string;
  platform: string;
  platform_id: string;
  name: string;
  sport: string;
  contest_type: string;
  entry_fee: number;
  total_prize: number;
  max_entries: number;
  total_entries: number;
  current_entries: number;
  salary_cap: number;
  start_time: Date;
  end_time: Date | null;
  games: string[];
  payout_structure: Record<string, number>[];
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface DbContestEntry {
  id: string;
  contest_id: string;
  user_id: string;
  lineup: string[];
  total_salary: number;
  projected_points: number;
  actual_points: number | null;
  rank: number | null;
  winnings: number | null;
  submitted_at: Date;
  updated_at: Date;
}

// Trading Tables
export interface DbTrade {
  id: string;
  league_id: string;
  proposed_by: string;
  proposed_to: string;
  status: 'proposed' | 'accepted' | 'rejected' | 'expired' | 'completed' | 'cancelled';
  team_a_players: string[];
  team_b_players: string[];
  team_a_picks: Record<string, unknown>[] | null;
  team_b_picks: Record<string, unknown>[] | null;
  team_a_faab: number | null;
  team_b_faab: number | null;
  proposed_at: Date;
  expires_at: Date | null;
  resolved_at: Date | null;
  notes: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface DbTradeAnalysis {
  id: string;
  trade_id: string;
  team_a_value: number;
  team_b_value: number;
  fairness_score: number;
  team_a_projected_wins: number;
  team_b_projected_wins: number;
  recommendation: 'accept' | 'reject' | 'neutral';
  reasoning: string;
  factors: Record<string, unknown>;
  created_at: Date;
}

// Draft Tables
export interface DbDraft {
  id: string;
  league_id: string;
  draft_type: 'snake' | 'auction' | 'linear';
  status: 'scheduled' | 'in_progress' | 'paused' | 'completed';
  total_rounds: number;
  current_round: number | null;
  current_pick: number | null;
  seconds_per_pick: number | null;
  auction_budget: number | null;
  start_time: Date | null;
  end_time: Date | null;
  draft_order: string[];
  settings: Record<string, unknown>;
  created_at: Date;
  updated_at: Date;
}

export interface DbDraftPick {
  id: string;
  draft_id: string;
  pick_number: number;
  round: number;
  team_id: string;
  player_id: string;
  pick_time: Date;
  time_used: number | null;
  is_keeper: boolean;
  auction_amount: number | null;
  created_at: Date;
}

// ML Model Tables
export interface DbMLModel {
  id: string;
  name: string;
  version: string;
  model_type: string;
  sport: string;
  target_metric: string;
  features: string[];
  hyperparameters: Record<string, unknown>;
  training_metrics: TrainingMetrics;
  validation_metrics: ValidationMetrics;
  is_active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface TrainingMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  r2_score?: number;
  mse?: number;
  mae?: number;
  training_samples: number;
  training_time: number;
}

export interface ValidationMetrics {
  accuracy?: number;
  precision?: number;
  recall?: number;
  f1_score?: number;
  r2_score?: number;
  mse?: number;
  mae?: number;
  validation_samples: number;
  cross_validation_scores?: number[];
}

export interface DbMLPrediction {
  id: string;
  model_id: string;
  player_id: string;
  game_id: string | null;
  prediction_type: string;
  predicted_value: number;
  confidence: number;
  features_used: Record<string, number>;
  created_at: Date;
}

// Session Tables
export interface DbSession {
  id: string;
  user_id: string;
  token_hash: string;
  ip_address: string | null;
  user_agent: string | null;
  last_activity: Date;
  expires_at: Date;
  created_at: Date;
}

// Bankroll Tables
export interface DbBankrollTransaction {
  id: string;
  user_id: string;
  type: 'deposit' | 'withdrawal' | 'contest_entry' | 'contest_winning';
  amount: number;
  balance_before: number;
  balance_after: number;
  contest_id: string | null;
  description: string | null;
  metadata: Record<string, unknown> | null;
  created_at: Date;
}

export interface DbBankrollStats {
  id: string;
  user_id: string;
  total_deposited: number;
  total_withdrawn: number;
  total_contest_entries: number;
  total_contest_winnings: number;
  current_balance: number;
  highest_balance: number;
  lowest_balance: number;
  roi: number;
  win_rate: number;
  avg_contest_roi: number;
  updated_at: Date;
}

// Query Result Types
export type DbQueryResult<T> = T | null;
export type DbQueryResults<T> = T[];
export type DbCountResult = { count: number };
export type DbExistsResult = { exists: boolean };

// Transaction Types
export interface DbTransaction {
  begin(): Promise<void>;
  commit(): Promise<void>;
  rollback(): Promise<void>;
  query<T>(sql: string, params?: unknown[]): Promise<DbQueryResults<T>>;
  queryOne<T>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>>;
}

// Connection Pool Types
export interface DbConnectionPool {
  query<T>(sql: string, params?: unknown[]): Promise<DbQueryResults<T>>;
  queryOne<T>(sql: string, params?: unknown[]): Promise<DbQueryResult<T>>;
  transaction<T>(fn: (tx: DbTransaction) => Promise<T>): Promise<T>;
  end(): Promise<void>;
}
// Lineup and Optimization Types

export type Sport = 'NFL' | 'NBA' | 'MLB' | 'NHL';
export type OptimizationStrategy = 'balanced' | 'ceiling' | 'floor' | 'contrarian' | 'stacking';

export interface RosterRequirements {
  positions: Record<string, number>;
  flexPositions?: string[];
  gPositions?: string[];
  fPositions?: string[];
  utilPositions?: string[];
  allowedPositions: string[];
}

export interface OptimizedPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  opponent: string;
  salary: number;
  projectedPoints: number;
  ownership?: number;
  ceiling?: number;
  floor?: number;
  volatility?: number;
  correlation?: number;
}

export interface LineupConstraints {
  excludedPlayers?: string[];
  lockedPlayers?: string[];
  maxFromTeam?: number;
  minSalaryUsed?: number;
  targetOwnership?: number;
  stackingRules?: StackingRule[];
}

export interface StackingRule {
  type: 'QB-WR' | 'QB-TE' | 'QB-STACK' | 'GAME-STACK' | 'MINI-STACK';
  required: boolean;
  maxPlayers?: number;
  minPlayers?: number;
  teams?: string[];
}

export interface LineupMetrics {
  projectedPoints: number;
  ceiling: number;
  floor: number;
  ownership: number;
  correlation: number;
  volatility: number;
  leverage: number;
  stackExposure: Record<string, number>;
}

export interface OptimizationResult {
  lineup: OptimizedPlayer[];
  metrics: LineupMetrics;
  sport: Sport;
  contestId: string;
  strategy: OptimizationStrategy;
  totalSalary: number;
  projectedPoints: number;
  optimizationTime: number;
  confidence: number;
}

export interface PlayerPoolEntry {
  id?: string;
  player_id?: string;
  external_id?: string;
  name?: string;
  player_name?: string;
  position: string;
  team: string;
  opponent: string;
  salary: number;
  projected_points: number;
  projected_ownership?: number;
  ownership_projection?: number;
  game_time?: string | Date;
  injury_status?: string;
  weather_impact?: number;
  vegas_total?: number;
  team_total?: number;
  team_implied_total?: number;
  spread?: number;
}
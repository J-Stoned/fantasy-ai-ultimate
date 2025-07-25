// MCP (Model Context Protocol) Types

export interface ServerStatus {
  id: string;
  name: string;
  status: 'active' | 'inactive' | 'error';
  capabilities: ServerCapability[];
  version?: string;
  lastHeartbeat?: string;
  metrics?: ServerMetrics;
}

export type ServerCapability = 
  | 'player-analysis'
  | 'dfs-optimization'
  | 'live-monitoring'
  | 'trade-analysis'
  | 'ml-training'
  | 'data-collection'
  | 'prediction'
  | 'backtesting';

export interface ServerMetrics {
  uptime: number;
  requestsHandled: number;
  avgResponseTime: number;
  errorRate: number;
  memoryUsage: number;
  cpuUsage: number;
}

// Workflow Types
export interface WorkflowResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: WorkflowError;
  executionTime?: number;
  metadata?: WorkflowMetadata;
}

export interface WorkflowError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
  stack?: string;
}

export interface WorkflowMetadata {
  startTime: string;
  endTime: string;
  stepsCompleted: number;
  totalSteps: number;
  warnings?: string[];
}

// Player Analysis Workflow
export interface PlayerAnalysisInput {
  playerId: string;
  timeframe?: 'game' | 'week' | 'season' | 'career';
  includeProjections?: boolean;
  includeComparisons?: boolean;
  comparisonPlayerIds?: string[];
}

export interface PlayerAnalysisResult {
  player: {
    id: string;
    name: string;
    team: string;
    position: string;
  };
  analysis: {
    performance: PerformanceAnalysis;
    trends: TrendAnalysis;
    projections?: ProjectionAnalysis;
    comparisons?: ComparisonAnalysis[];
  };
  recommendations: string[];
}

export interface PerformanceAnalysis {
  averagePoints: number;
  consistency: number;
  ceiling: number;
  floor: number;
  boomRate: number;
  bustRate: number;
}

export interface TrendAnalysis {
  direction: 'up' | 'down' | 'stable';
  magnitude: number;
  confidence: number;
  factors: string[];
}

export interface ProjectionAnalysis {
  projectedPoints: number;
  confidence: number;
  range: {
    low: number;
    high: number;
  };
  keyFactors: Array<{
    factor: string;
    impact: number;
  }>;
}

export interface ComparisonAnalysis {
  playerId: string;
  playerName: string;
  metrics: {
    points: number;
    value: number;
    consistency: number;
    upside: number;
  };
  advantage: number;
}

// DFS Optimization Workflow
export interface DFSOptimizationInput {
  contestId: string;
  salaryCap: number;
  rosterRequirements: RosterRequirement[];
  playerPool?: string[];
  excludedPlayers?: string[];
  lockedPlayers?: string[];
  optimizationStrategy?: OptimizationStrategy;
  numberOfLineups?: number;
}

export interface RosterRequirement {
  position: string;
  count: number;
  eligiblePositions?: string[];
}

export type OptimizationStrategy = 
  | 'max_points'
  | 'balanced'
  | 'contrarian'
  | 'game_stack'
  | 'mini_stack'
  | 'leverage';

export interface DFSOptimizationResult {
  lineups: OptimizedLineup[];
  statistics: {
    avgProjectedPoints: number;
    avgSalaryUsed: number;
    playerExposure: Record<string, number>;
    stackExposure: Record<string, number>;
    uniqueness: number;
  };
}

export interface OptimizedLineup {
  players: LineupSlot[];
  totalSalary: number;
  projectedPoints: number;
  confidence: number;
  leverage: number;
  correlation: number;
  stacks: GameStack[];
}

export interface LineupSlot {
  position: string;
  playerId: string;
  playerName: string;
  team: string;
  opponent: string;
  salary: number;
  projectedPoints: number;
  ownership: number;
}

export interface GameStack {
  gameId: string;
  type: 'game' | 'team' | 'mini';
  players: string[];
  correlation: number;
}

// Trade Analysis Workflow
export interface TradeAnalysisInput {
  leagueId: string;
  teamAPlayers: string[];
  teamBPlayers: string[];
  teamADraftPicks?: DraftPickAsset[];
  teamBDraftPicks?: DraftPickAsset[];
  teamAFAAB?: number;
  teamBFAAB?: number;
  scoringSettings?: Record<string, number>;
}

export interface DraftPickAsset {
  year: number;
  round: number;
  originalOwner?: string;
  protections?: string[];
}

export interface TradeAnalysisResult {
  fairness: {
    score: number;
    rating: 'very_unfair' | 'unfair' | 'fair' | 'good' | 'excellent';
    favoredTeam?: 'A' | 'B';
  };
  teamA: TeamTradeImpact;
  teamB: TeamTradeImpact;
  recommendation: {
    teamA: 'accept' | 'reject' | 'counter';
    teamB: 'accept' | 'reject' | 'counter';
    reasoning: string;
  };
}

export interface TeamTradeImpact {
  valueGained: number;
  valueLost: number;
  netValue: number;
  projectedWinsChange: number;
  championshipOddsChange: number;
  positionImpact: Record<string, number>;
  timelineImpact: {
    immediate: number;
    restOfSeason: number;
    nextSeason: number;
    longTerm: number;
  };
}

// Response Types
export interface MCPStatusResponse {
  success: boolean;
  servers: ServerStatus[];
  error?: string;
}

export interface MCPWorkflowResponse<T = unknown> {
  success: boolean;
  result?: WorkflowResult<T>;
  error?: string;
}

export interface MCPServerActionResponse {
  success: boolean;
  result: {
    serverId: string;
    action: ServerAction;
    newStatus: ServerStatus['status'];
    message?: string;
  };
  error?: string;
}

// Request Types
export type WorkflowType = 'player-analysis' | 'dfs-optimization' | 'live-monitoring' | 'trade-analysis';
export type ServerAction = 'start' | 'stop' | 'restart' | 'test' | 'health-check';

export interface MCPWorkflowRequest<T = unknown> {
  type: WorkflowType;
  input: T;
  options?: WorkflowOptions;
}

export interface WorkflowOptions {
  timeout?: number;
  priority?: 'low' | 'normal' | 'high';
  cache?: boolean;
  cacheKey?: string;
  cacheTTL?: number;
}
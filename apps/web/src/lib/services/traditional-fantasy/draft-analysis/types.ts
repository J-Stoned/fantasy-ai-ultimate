// Draft Analysis Engine - Type Definitions

export type Sport = 'NFL' | 'NBA' | 'MLB' | 'NHL';
export type Position = string; // Sport-specific positions
export type DraftType = 'snake' | 'auction' | 'bestball' | 'dynasty';
export type ScoringType = 'standard' | 'ppr' | 'halfppr' | 'superflex' | 'custom';

// Core Player Data
export interface Player {
  id: string;
  name: string;
  team: string;
  position: Position;
  sport: Sport;
  age?: number;
  experience?: number;
  injuryStatus?: 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir';
}

// Player Projections & Stats
export interface PlayerProjection {
  playerId: string;
  projectedPoints: number;
  projectedStats: Record<string, number>;
  confidenceInterval: {
    low: number;
    high: number;
  };
  consistency: number; // 0-1 score
  upside: number; // 0-1 score
  floor: number; // points
  ceiling: number; // points
}

// League Settings
export interface LeagueSettings {
  sport: Sport;
  draftType: DraftType;
  scoringType: ScoringType;
  teamCount: number;
  rosterSize: number;
  rosterRequirements: {
    [position: string]: {
      min: number;
      max: number;
      flex?: boolean;
    };
  };
  scoringRules: Record<string, number>;
  keeperRules?: {
    enabled: boolean;
    maxKeepers: number;
    keeperCost: 'round' | 'auction' | 'none';
  };
  tradeSettings?: {
    deadline: Date;
    reviewPeriod: number;
    vetoThreshold: number;
  };
}

// Draft State
export interface DraftState {
  draftId: string;
  leagueSettings: LeagueSettings;
  currentPick: number;
  currentRound: number;
  draftOrder: string[]; // Team IDs
  picks: DraftPick[];
  availablePlayers: Set<string>;
  teams: Map<string, TeamState>;
  myTeamId: string;
  startTime: Date;
  timePerPick?: number;
  isPaused: boolean;
}

export interface DraftPick {
  pickNumber: number;
  round: number;
  teamId: string;
  playerId: string;
  timestamp: Date;
  valueScore: number; // How good was this pick
  reachScore: number; // How much of a reach/value
}

export interface TeamState {
  teamId: string;
  teamName: string;
  roster: string[]; // Player IDs
  needs: PositionNeed[];
  draftStrategy: DraftStrategy;
  budget?: number; // For auction drafts
}

export interface PositionNeed {
  position: Position;
  priority: number; // 0-1
  currentCount: number;
  targetCount: number;
  qualityScore: number; // Average quality of current players
}

// Value Calculations
export interface PlayerValue {
  playerId: string;
  adp: number; // Average Draft Position
  ecr: number; // Expert Consensus Ranking
  vorp: number; // Value Over Replacement Player
  vbd: number; // Value Based Drafting score
  tier: number;
  positionRank: number;
  overallRank: number;
  auctionValue?: number;
  keeperValue?: number;
  dynastyValue?: number;
  tradeValue: number;
}

// Scarcity Modeling
export interface PositionScarcity {
  position: Position;
  scarcityIndex: number; // 0-1, higher = more scarce
  remainingStarters: number;
  remainingBackups: number;
  dropOffPoints: number; // Points drop to next tier
  replacementLevel: number; // Points for replacement player
  supplyDemandRatio: number;
  projectedRun: {
    probability: number;
    expectedPicks: number;
  };
}

// AI Recommendations
export interface DraftRecommendation {
  playerId: string;
  score: number; // 0-100
  reasons: RecommendationReason[];
  alternativePicks: AlternativePick[];
  confidenceLevel: number; // 0-1
  strategy: RecommendationStrategy;
}

export interface RecommendationReason {
  type: 'value' | 'need' | 'scarcity' | 'tier_break' | 'stack' | 'hedge';
  description: string;
  impact: number; // -1 to 1
  weight: number; // Importance of this reason
}

export interface AlternativePick {
  playerId: string;
  score: number;
  tradeOff: string; // What you're giving up
}

export type RecommendationStrategy = 
  | 'best_player_available'
  | 'position_scarcity'
  | 'balanced_roster'
  | 'upside_chase'
  | 'safe_floor'
  | 'stack_building'
  | 'handcuff_target';

// Draft Analysis
export interface DraftAnalysis {
  overallGrade: string; // A+ to F
  teamStrength: number; // 0-100
  projectedFinish: number; // 1-N
  strengths: string[];
  weaknesses: string[];
  bestPicks: PickAnalysis[];
  worstPicks: PickAnalysis[];
  missedOpportunities: MissedOpportunity[];
  tradeTargets: TradeTarget[];
}

export interface PickAnalysis {
  pick: DraftPick;
  expectedValue: number;
  actualValue: number;
  alternativesAvailable: Player[];
}

export interface MissedOpportunity {
  round: number;
  playerId: string;
  pickedInstead: string;
  valueLost: number;
  reason: string;
}

// Mock Draft
export interface MockDraftSettings {
  aiDifficulty: 'easy' | 'medium' | 'hard' | 'expert';
  aiPersonalities: AIPersonality[];
  speed: 'instant' | 'fast' | 'realistic';
  startFromRound?: number;
  customBoardImport?: string;
}

export interface AIPersonality {
  teamId: string;
  style: 'aggressive' | 'conservative' | 'balanced' | 'contrarian' | 'homer';
  positionPreference?: Position[];
  teamPreference?: string[];
  riskTolerance: number; // 0-1
}

// Trade Analysis
export interface TradeProposal {
  teamGiving: string;
  teamReceiving: string;
  playersGiving: string[];
  playersReceiving: string[];
  draftPicksGiving?: DraftPickTrade[];
  draftPicksReceiving?: DraftPickTrade[];
}

export interface DraftPickTrade {
  year: number;
  round: number;
  originalTeam?: string;
}

export interface TradeAnalysis {
  fairnessScore: number; // -100 to 100, 0 is fair
  teamAGain: number; // Points gained/lost
  teamBGain: number;
  winProbabilityChange: {
    teamA: number;
    teamB: number;
  };
  recommendation: 'accept' | 'reject' | 'counter';
  reasoning: string[];
}

export interface TradeTarget {
  playerId: string;
  targetTeams: string[];
  fairOffers: Player[][];
  reason: string;
}

// Auction Draft
export interface AuctionState extends DraftState {
  currentNominee?: string;
  currentBid: number;
  currentBidder: string;
  bidHistory: AuctionBid[];
  teamBudgets: Map<string, number>;
  inflationRate: number;
}

export interface AuctionBid {
  playerId: string;
  teamId: string;
  amount: number;
  timestamp: Date;
}

export interface AuctionStrategy {
  targetSpend: {
    [position: string]: {
      min: number;
      max: number;
      target: number;
    };
  };
  maxBid: Map<string, number>; // Player ID to max bid
  nomineePriority: string[]; // Players to nominate
  budgetPacing: 'aggressive' | 'balanced' | 'conservative';
}

// Best Ball Specific
export interface BestBallSettings extends LeagueSettings {
  playoffWeeks: number[];
  advancementRules: {
    regularSeason: number; // Top N teams advance
    playoffs: number; // Top N per group
  };
}

// Dynasty Specific
export interface DynastyPlayer extends Player {
  contractYears?: number;
  contractValue?: number;
  rookieStatus: boolean;
  developmentScore: number; // 0-1, likelihood to improve
}

// Draft Strategy
export interface DraftStrategy {
  type: 'balanced' | 'hero_rb' | 'zero_rb' | 'robust_rb' | 'modified_zero' | 'best_available';
  targetPositions: {
    rounds: { [round: number]: Position[] };
    priority: Position[];
  };
  stackTargets?: {
    quarterback: string;
    receivers: string[];
  };
  avoidList: string[]; // Player IDs to avoid
  targetList: string[]; // Player IDs to target
}

// Performance Metrics
export interface DraftPerformance {
  avgResponseTime: number;
  peakConcurrentDrafts: number;
  recommendationAccuracy: number;
  userSatisfactionScore: number;
}

// Events
export interface DraftEvent {
  type: 'pick' | 'trade' | 'bid' | 'pause' | 'resume' | 'complete';
  timestamp: Date;
  data: any;
}

// Utility Types
export type PlayerMap = Map<string, Player>;
export type ProjectionMap = Map<string, PlayerProjection>;
export type ValueMap = Map<string, PlayerValue>;

// Export constants
export const POSITIONS_BY_SPORT: Record<Sport, Position[]> = {
  NFL: ['QB', 'RB', 'WR', 'TE', 'K', 'DST'],
  NBA: ['PG', 'SG', 'SF', 'PF', 'C'],
  MLB: ['C', '1B', '2B', '3B', 'SS', 'OF', 'DH', 'SP', 'RP'],
  NHL: ['C', 'LW', 'RW', 'D', 'G']
};

export const DEFAULT_ROSTER_REQUIREMENTS = {
  NFL: {
    QB: { min: 1, max: 4 },
    RB: { min: 2, max: 8 },
    WR: { min: 2, max: 8 },
    TE: { min: 1, max: 3 },
    FLEX: { min: 1, max: 2, flex: true },
    K: { min: 1, max: 2 },
    DST: { min: 1, max: 2 },
    BENCH: { min: 5, max: 7 }
  }
  // Add other sports as needed
};
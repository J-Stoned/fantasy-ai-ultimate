// League Memory Types - Complete historical tracking and analysis

export interface LeagueMemory {
  leagueId: string;
  platform: 'espn' | 'yahoo' | 'sleeper' | 'fleaflicker';
  sport: string;
  seasons: SeasonMemory[];
  managers: ManagerProfile[];
  patterns: LeaguePatterns;
  predictions: LeaguePredictions;
  metadata: LeagueMetadata;
}

export interface SeasonMemory {
  year: number;
  transactions: Transaction[];
  trades: Trade[];
  draftResults: DraftResult[];
  waiverClaims: WaiverClaim[];
  lineupDecisions: LineupDecision[];
  chatMessages: ChatMessage[];
  standings: StandingsSnapshot[];
  playoffs: PlayoffResult;
}

export interface ManagerProfile {
  managerId: string;
  name: string;
  joinDate: Date;
  personality: ManagerPersonality;
  tendencies: ManagerTendencies;
  performance: ManagerPerformance;
  relationships: ManagerRelationships;
  predictedBehavior: PredictedBehavior;
}

export interface ManagerPersonality {
  riskTolerance: number; // 0-1 scale
  tradeActivity: 'passive' | 'moderate' | 'aggressive';
  draftStyle: 'bestPlayer' | 'positional' | 'contrarian' | 'homer';
  waiverAggression: number; // 0-1 scale
  chatActivity: 'silent' | 'moderate' | 'active' | 'provocateur';
  decisionSpeed: 'impulsive' | 'calculated' | 'overthinking';
}

export interface ManagerTendencies {
  favoritePositions: string[];
  avoidedPositions: string[];
  preferredTeams: string[];
  tradingPartners: { managerId: string; frequency: number }[];
  draftPatterns: DraftPattern[];
  waiverPatterns: WaiverPattern[];
  lineupPatterns: LineupPattern[];
}

export interface ManagerPerformance {
  winRate: number;
  playoffRate: number;
  championshipRate: number;
  draftGrade: number;
  tradeGrade: number;
  waiverGrade: number;
  pointsPerGame: number;
  consistency: number;
  clutchFactor: number;
}

export interface ManagerRelationships {
  rivals: { managerId: string; intensity: number }[];
  allies: { managerId: string; tradeFrequency: number }[];
  grudges: { managerId: string; reason: string; date: Date }[];
  headToHead: { [managerId: string]: HeadToHeadRecord };
}

export interface Transaction {
  transactionId: string;
  type: 'add' | 'drop' | 'trade' | 'draft';
  timestamp: Date;
  managerId: string;
  players: PlayerAction[];
  cost?: number;
  context: TransactionContext;
}

export interface Trade {
  tradeId: string;
  timestamp: Date;
  team1: { managerId: string; playersGiven: string[]; playersReceived: string[] };
  team2: { managerId: string; playersGiven: string[]; playersReceived: string[] };
  vetoVotes: string[];
  chatReactions: string[];
  outcome: TradeOutcome;
}

export interface DraftResult {
  pick: number;
  round: number;
  managerId: string;
  playerId: string;
  playerName: string;
  position: string;
  adp: number;
  reachValue: number; // How much they reached/got value
  seasonOutcome: PlayerSeasonOutcome;
}

export interface WaiverClaim {
  timestamp: Date;
  managerId: string;
  priority: number;
  playerId: string;
  dropped?: string;
  successful: boolean;
  bidAmount?: number;
  competingClaims: string[];
}

export interface LineupDecision {
  week: number;
  managerId: string;
  starters: string[];
  bench: string[];
  lastMinuteChanges: LineupChange[];
  outcome: LineupOutcome;
}

export interface ChatMessage {
  timestamp: Date;
  managerId: string;
  message: string;
  sentiment: 'positive' | 'negative' | 'neutral' | 'trash-talk';
  reactions: { managerId: string; reaction: string }[];
  context: 'trade' | 'waiver' | 'matchup' | 'general';
}

export interface LeaguePatterns {
  draftPatterns: {
    positionRuns: PositionRun[];
    reachTendencies: ReachPattern[];
    valueIdentification: ValuePattern[];
  };
  tradePatterns: {
    seasonalTrends: SeasonalTrend[];
    buyLowSellHigh: MarketPattern[];
    panicTrades: PanicPattern[];
  };
  waiverPatterns: {
    claimTiming: TimingPattern[];
    bidPatterns: BidPattern[];
    priorityUsage: PriorityPattern[];
  };
  behavioralPatterns: {
    tiltBehavior: TiltPattern[];
    rivalryIntensity: RivalryPattern[];
    groupThink: GroupThinkPattern[];
  };
}

export interface LeaguePredictions {
  draftPredictions: DraftPrediction[];
  tradePredictions: TradePrediction[];
  waiverPredictions: WaiverPrediction[];
  seasonPredictions: SeasonPrediction[];
  behaviorPredictions: BehaviorPrediction[];
}

export interface DraftPrediction {
  managerId: string;
  round: number;
  predictedPicks: { playerId: string; probability: number }[];
  reasoning: string[];
}

export interface TradePrediction {
  likelihood: number;
  manager1Id: string;
  manager2Id: string;
  predictedPlayers: string[];
  timing: 'preseason' | 'early' | 'mid' | 'late' | 'deadline';
  triggers: string[];
}

export interface WaiverPrediction {
  playerId: string;
  interestedManagers: { managerId: string; likelihood: number; bidEstimate?: number }[];
  optimalBid: number;
  reasoning: string[];
}

export interface SeasonPrediction {
  standings: { managerId: string; predictedRank: number; confidence: number }[];
  playoffTeams: { managerId: string; probability: number }[];
  champion: { managerId: string; probability: number }[];
  surpriseFactors: string[];
}

export interface BehaviorPrediction {
  managerId: string;
  predictedActions: {
    type: string;
    probability: number;
    timing: string;
    trigger: string;
  }[];
}

export interface MemoryInsight {
  type: 'pattern' | 'anomaly' | 'prediction' | 'recommendation';
  title: string;
  description: string;
  confidence: number;
  evidence: Evidence[];
  actionable: boolean;
  actions?: string[];
}

export interface Evidence {
  type: 'historical' | 'pattern' | 'statistical' | 'behavioral';
  description: string;
  relevance: number;
  data: any;
}

// Pattern Detection Types
export interface PositionRun {
  position: string;
  startRound: number;
  endRound: number;
  participants: string[];
  frequency: number;
}

export interface ReachPattern {
  managerId: string;
  averageReach: number;
  consistency: number;
  targetPlayers: string[];
}

export interface ValuePattern {
  rounds: number[];
  positions: string[];
  managers: string[];
  successRate: number;
}

export interface SeasonalTrend {
  week: number;
  tradeVolume: number;
  commonThemes: string[];
  triggers: string[];
}

export interface MarketPattern {
  managerId: string;
  buyTargets: { playerId: string; timing: string }[];
  sellTargets: { playerId: string; timing: string }[];
  successRate: number;
}

export interface PanicPattern {
  trigger: string;
  managers: string[];
  overreactionRate: number;
  recoveryTime: number;
}

export interface TimingPattern {
  dayOfWeek: string;
  hourOfDay: number;
  successRate: number;
  competition: number;
}

export interface BidPattern {
  managerId: string;
  averageBid: number;
  overbidRate: number;
  underbidRate: number;
  adaptability: number;
}

export interface PriorityPattern {
  managerId: string;
  earlyUsage: number;
  lateUsage: number;
  effectiveness: number;
}

export interface TiltPattern {
  managerId: string;
  triggers: string[];
  reactions: string[];
  duration: number;
  impact: number;
}

export interface RivalryPattern {
  manager1Id: string;
  manager2Id: string;
  intensity: number;
  escalationRate: number;
  impactOnDecisions: number;
}

export interface GroupThinkPattern {
  topic: string;
  participants: string[];
  contrarians: string[];
  outcome: string;
}

// Helper Types
export interface PlayerAction {
  playerId: string;
  action: 'add' | 'drop' | 'trade';
  value: number;
}

export interface TransactionContext {
  injury?: string;
  news?: string;
  matchup?: string;
  standings?: string;
}

export interface TradeOutcome {
  winner?: string;
  value: { [managerId: string]: number };
  seasonImpact: { [managerId: string]: number };
}

export interface PlayerSeasonOutcome {
  totalPoints: number;
  gamesPlayed: number;
  seasonRank: number;
  value: 'bust' | 'underperform' | 'meet' | 'exceed' | 'league-winner';
}

export interface LineupChange {
  timestamp: Date;
  playerOut: string;
  playerIn: string;
  reason: string;
}

export interface LineupOutcome {
  points: number;
  optimalPoints: number;
  rank: number;
  missedPoints: number;
}

export interface HeadToHeadRecord {
  wins: number;
  losses: number;
  totalPoints: number;
  averageMargin: number;
}

export interface StandingsSnapshot {
  week: number;
  rankings: { managerId: string; rank: number; record: string; points: number }[];
}

export interface PlayoffResult {
  bracket: PlayoffBracket;
  champion: string;
  runnerUp: string;
  thirdPlace: string;
}

export interface PlayoffBracket {
  rounds: PlayoffRound[];
}

export interface PlayoffRound {
  matchups: PlayoffMatchup[];
}

export interface PlayoffMatchup {
  team1: string;
  team2: string;
  winner: string;
  score1: number;
  score2: number;
}

export interface LeagueMetadata {
  created: Date;
  lastUpdated: Date;
  totalSeasons: number;
  totalTransactions: number;
  totalTrades: number;
  totalMessages: number;
  dataQuality: number;
  memoryDepth: number;
}

export interface PredictedBehavior {
  nextAction: {
    type: string;
    probability: number;
    timing: string;
  };
  seasonTrajectory: {
    expectedFinish: number;
    confidenceInterval: [number, number];
  };
  keyDecisions: {
    decision: string;
    recommendation: string;
    impact: number;
  }[];
}
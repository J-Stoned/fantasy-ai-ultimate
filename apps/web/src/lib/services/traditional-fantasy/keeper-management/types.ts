/**
 * Keeper League Management Types
 * Comprehensive type definitions for multi-year fantasy sports management
 */

export interface Player {
  id: string;
  name: string;
  team: string;
  position: string;
  age: number;
  yearsInLeague: number;
  injuryHistory: InjuryRecord[];
  performanceHistory: SeasonPerformance[];
  contractDetails?: ContractDetails;
  draftDetails?: DraftDetails;
}

export interface ContractDetails {
  salary: number;
  yearsRemaining: number;
  guaranteedMoney: number;
  restructurable: boolean;
  deadMoneyIfCut: number;
  extensionEligible: boolean;
  franchiseTagEligible: boolean;
  contractType: 'rookie' | 'extension' | 'freeAgent' | 'franchise';
}

export interface DraftDetails {
  year: number;
  round: number;
  pick: number;
  keeperRoundPenalty: number;
  keeperEligibleYears: number;
  timesKept: number;
}

export interface SeasonPerformance {
  year: number;
  gamesPlayed: number;
  fantasyPoints: number;
  fantasyPointsPerGame: number;
  positionRank: number;
  consistency: number; // 0-1 score
  clutchPerformance: number; // Performance in playoffs/key weeks
}

export interface InjuryRecord {
  date: Date;
  type: string;
  severity: 'minor' | 'moderate' | 'severe' | 'career-threatening';
  gamesM issed: number;
  recoveryTime: number;
  recurringRisk: number; // 0-1 probability
}

export interface KeeperDecision {
  player: Player;
  recommendationScore: number; // 0-100
  projectedValue: ValueProjection;
  opportunityCost: number;
  riskAssessment: RiskProfile;
  alternativeOptions: AlternativeOption[];
  aiConfidence: number;
}

export interface ValueProjection {
  currentYearValue: number;
  threeYearValue: number;
  fiveYearValue: number;
  careerRemainingValue: number;
  peakValueYear: number;
  declineStartYear: number;
  confidenceIntervals: {
    low: number[];
    median: number[];
    high: number[];
  };
}

export interface RiskProfile {
  injuryRisk: number;
  ageRisk: number;
  performanceVolatility: number;
  teamSituationRisk: number;
  overallRisk: number;
  riskTrend: 'increasing' | 'stable' | 'decreasing';
}

export interface AlternativeOption {
  action: 'draft' | 'trade' | 'freeAgent';
  expectedValue: number;
  cost: number;
  probability: number;
}

export interface DynastyAsset {
  type: 'player' | 'pick';
  currentValue: number;
  futureValue: number[];
  liquidity: number; // How easy to trade
  demandScore: number;
}

export interface ChampionshipWindow {
  status: 'competing' | 'fringe' | 'rebuilding' | 'retooling';
  peakYear: number;
  windowDuration: number;
  championshipProbability: number[];
  recommendedStrategy: TeamStrategy;
}

export interface TeamStrategy {
  approach: 'win-now' | 'balanced' | 'rebuild';
  targetPositions: string[];
  tradeTargets: TradeSuggestion[];
  draftStrategy: DraftApproach;
  keeperStrategy: KeeperApproach;
}

export interface TradeSuggestion {
  give: DynastyAsset[];
  receive: DynastyAsset[];
  netValueGain: number;
  windowImpact: number;
  riskAdjustedValue: number;
}

export interface LeagueContext {
  scoringSystem: any;
  rosterSize: number;
  keeperRules: KeeperRules;
  salaryCap?: number;
  inflationRate: number;
  tradeDeadline: Date;
  draftDate: Date;
}

export interface KeeperRules {
  maxKeepers: number;
  roundPenalty: number;
  maxYearsKept: number;
  positionLimits?: Record<string, number>;
  salaryIncrease?: number;
  rookieKeeperRules?: any;
}

export interface HistoricalKeeperData {
  playerId: string;
  yearKept: number;
  cost: number;
  actualValue: number;
  wasSuccessful: boolean;
  leagueAverage: number;
}

export interface MarketInefficiency {
  type: 'undervalued' | 'overvalued';
  position: string;
  ageRange: [number, number];
  inefficiencyScore: number;
  exploitationStrategy: string;
}

export interface DraftPickValue {
  year: number;
  round: number;
  expectedValue: number;
  positionProbability: Record<string, number>;
  bustRate: number;
  starRate: number;
}

export interface AgingCurve {
  position: string;
  peakAgeRange: [number, number];
  declineRate: number;
  cliffAge: number;
  exceptionProbability: number;
}

export interface KeeperRecommendation {
  decision: KeeperDecision;
  reasoning: string[];
  confidenceFactors: ConfidenceFactor[];
  alternativeScenarios: ScenarioAnalysis[];
}

export interface ConfidenceFactor {
  factor: string;
  impact: number;
  direction: 'positive' | 'negative';
  weight: number;
}

export interface ScenarioAnalysis {
  scenario: string;
  probability: number;
  outcomeValue: number;
  strategyAdjustment: string;
}

export interface ContractOptimization {
  currentStructure: ContractDetails;
  optimizedStructure: ContractDetails;
  capSavings: number[];
  performanceIncentives: any[];
  riskMitigation: string[];
}

export interface TeamMetrics {
  currentRosterValue: number;
  futureRosterValue: number[];
  capSpace: number[];
  draftCapital: DraftPickValue[];
  competitiveBalance: number;
  sustainabilityScore: number;
}

export interface KeeperEngineConfig {
  aggressiveness: number; // 0-1, conservative to aggressive
  timeHorizon: number; // years to optimize for
  riskTolerance: number; // 0-1
  positionPriority: Record<string, number>;
  leagueSpecificFactors: any;
}

// Additional types for UI components
export interface DynastyRoster {
  players: DynastyAsset[];
  picks: DraftPickValue[];
  totalValue: number;
  composition: {
    QB: number;
    RB: number;
    WR: number;
    TE: number;
  };
}

export interface RosterAnalysis {
  overallGrade: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  ageAnalysis: {
    average: number;
    distribution: Record<string, number>;
  };
  positionDepth: Record<string, number>;
  injuryRisk: number;
  futureOutlook: string;
}
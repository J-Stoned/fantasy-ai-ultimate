// Roster and Recommendation Types

export interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  projectedPoints?: number;
  ownership?: number;
  matchupRating?: 'elite' | 'good' | 'average' | 'poor' | 'avoid';
  injuryStatus?: 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir';
  byeWeek?: number;
  trends?: {
    direction: 'up' | 'down' | 'stable';
    weekly?: number;
  };
  consistency?: number;
  isLocked?: boolean;
  opponent?: string;
}

export interface LineupSlot {
  position: string;
  player?: RosterPlayer;
}

export interface LeagueSettings {
  settings?: Record<string, unknown>;
}

export interface RecommendationRequest {
  leagueId: string;
  currentLineup: LineupSlot[];
  bench: RosterPlayer[];
  analysisType?: 'comprehensive' | 'quick' | 'detailed';
  focusAreas?: string[];
}

export interface Recommendation {
  id: string;
  category: 'lineup' | 'risk' | 'value' | 'injury' | 'waiver' | 'trade';
  type: 'start_sit' | 'warning' | 'risk_warning' | 'sleeper_pick' | 'injury_alert' | 'bye_week' | 'sell_high' | 'buy_low';
  priority: number;
  confidence: number;
  title: string;
  description: string;
  expectedGain: number;
  reasoning: string[];
  action: RecommendationAction;
  tags: string[];
  severity?: string;
  riskScore?: number;
}

export interface RecommendationAction {
  type: 'swap' | 'monitor' | 'consider_backup' | 'monitor_injury' | 'replace_required' | 'claim';
  playerId?: string;
  out?: string;
  in?: string;
  position?: string;
  checkInterval?: string;
}

export interface RiskFactors {
  totalRisk: number;
  factors: string[];
}

export interface InjurySeverity {
  label: string;
  priority: number;
  riskPoints: number;
  checkInterval: string;
}

export interface WaiverWireSuggestion {
  id: string;
  player: {
    name: string;
    position: string;
    team: string;
    projectedPoints: number;
    ownership: number;
  };
  priority: number;
  reasoning: string;
  action: string;
}

export interface TradeRecommendation {
  id: string;
  type: 'sell_high' | 'buy_low';
  player: {
    name: string;
    position: string;
    tradeValue: number;
  };
  reasoning: string;
  confidence: number;
}

export interface MatchupAnalysis {
  overallRating: number;
  bestMatchups: RosterPlayer[];
  worstMatchups: RosterPlayer[];
  weatherConcerns: Array<{
    player: string;
    concern: string;
  }>;
  gameLogs: Array<{
    player: string;
    recent: number[];
    trend: string;
  }>;
}

export interface LineupAnalysis {
  overallGrade: string;
  riskLevel: 'low' | 'moderate' | 'high';
  projectedPoints: number;
  ceiling: number;
  floor: number;
  consistency: number;
}

export interface RecommendationsResponse {
  success: boolean;
  recommendations: {
    startSit: Recommendation[];
    waiverWire: WaiverWireSuggestion[];
    trades: TradeRecommendation[];
    injury: Recommendation[];
    matchup: MatchupAnalysis;
  };
  analysis: LineupAnalysis;
  generated: string;
}

export interface RecommendationGenerationParams {
  league: DatabaseLeagueInfo;
  players: DatabasePlayerInfo[];
  currentLineup: LineupSlot[];
  bench: RosterPlayer[];
  analysisType: string;
  focusAreas: string[];
}

export interface DatabaseLeagueInfo {
  id: string;
  sport: string;
  scoring_type: string;
  settings?: Record<string, unknown>;
}

export interface DatabasePlayerInfo {
  id: string;
  name: string;
  position: string;
  team: string;
  projected_points?: number;
  ownership?: number;
  matchup_rating?: string;
  injury_status?: string;
  bye_week?: number;
}
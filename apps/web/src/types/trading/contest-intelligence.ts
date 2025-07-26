/**
 * Contest intelligence types for DFS trading analysis
 */

export type ContestRecommendation = 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
export type PriceMovement = 'UP' | 'DOWN' | 'STABLE';

export interface ContestIntelligence {
  // Identifiers
  contestId: string;
  name: string;
  platform: string;
  sport: string;
  slate: string;
  
  // Financial Metrics
  entryFee: number;
  totalPrize: number;
  currentEntries: number;
  maxEntries: number;
  overlay: number;
  rake: number;
  
  // Intelligence Scores
  edgeScore: number;
  leverageScore: number;
  fieldStrength: number;
  sharkPercentage: number;
  fishPercentage: number;
  avgROIofField: number;
  
  // Recommendations
  recommendation: ContestRecommendation;
  expectedROI: number;
  variance: number;
  kellySize: number;
  optimalEntries: number;
  confidence: number;
  reasoning: string[];
  
  // Real-time Data
  timeToStart: number; // minutes
  fillRate: number; // how fast it's filling
  lastAnalyzed: Date;
  priceMovement: PriceMovement;
}

export interface ContestFilter {
  sports?: string[];
  platforms?: string[];
  minEntryFee?: number;
  maxEntryFee?: number;
  minExpectedROI?: number;
  recommendations?: ContestRecommendation[];
}
export interface MLPrediction {
  id: string;
  modelId: string;
  playerId: string;
  gameId?: string;
  predictionType: 'points' | 'performance' | 'injury_risk' | 'ownership';
  predictedValue: number;
  confidence: number;
  features: MLFeatures;
  timestamp: Date;
}

export interface MLFeatures {
  // Player features
  recentForm: number; // Last 5 games average
  seasonAverage: number;
  homeAway: boolean;
  restDays: number;
  
  // Matchup features
  opponentRank: number;
  paceOfPlay: number;
  weather?: WeatherConditions;
  
  // Historical features
  h2hAverage: number; // vs this opponent
  venueAverage: number; // at this venue
  
  // External factors
  vegasTotal: number;
  spread: number;
  ownership?: number; // DFS ownership %
}

export interface WeatherConditions {
  temperature: number;
  windSpeed: number;
  precipitation: number;
  isDome: boolean;
}

export interface MLModel {
  id: string;
  name: string;
  version: string;
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  targetMetric: string;
  accuracy: number;
  features: string[];
  lastTrainedAt: Date;
  isActive: boolean;
}

export interface MLPerformance {
  modelId: string;
  date: Date;
  predictions: number;
  accuracy: number;
  precision: number;
  recall: number;
  f1Score: number;
  profitLoss: number; // For DFS models
}
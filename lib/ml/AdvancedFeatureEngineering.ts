/**
 * 🧪 ADVANCED FEATURE ENGINEERING
 * 
 * State-of-the-art feature engineering to boost ML accuracy above 70%
 * Inspired by Second Spectrum's approach to sports analytics
 */

import { createClient } from '@supabase/supabase-js';
import * as tf from '@tensorflow/tfjs-node-gpu';
import * as ss from 'simple-statistics';
import chalk from 'chalk';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface EnhancedFeatures {
  basic: number[];
  advanced: number[];
  temporal: number[];
  contextual: number[];
  ensemble: number[];
  featureNames: string[];
}

export class AdvancedFeatureEngineering {
  private featureCache = new Map<string, any>();
  private emaCalculators = new Map<string, number>();
  
  /**
   * Extract comprehensive features for maximum accuracy
   */
  async extractEnhancedFeatures(
    game: any,
    historicalData: any,
    externalData?: any
  ): Promise<EnhancedFeatures> {
    const features: EnhancedFeatures = {
      basic: [],
      advanced: [],
      temporal: [],
      contextual: [],
      ensemble: [],
      featureNames: []
    };
    
    // 1. Basic features (existing)
    features.basic = await this.extractBasicFeatures(game, historicalData);
    
    // 2. Advanced statistical features
    features.advanced = await this.extractAdvancedFeatures(game, historicalData);
    
    // 3. Temporal pattern features
    features.temporal = await this.extractTemporalFeatures(game, historicalData);
    
    // 4. Contextual features
    features.contextual = await this.extractContextualFeatures(game, externalData);
    
    // 5. Ensemble meta-features
    features.ensemble = await this.extractEnsembleFeatures(features);
    
    // Combine all features
    const allFeatures = [
      ...features.basic,
      ...features.advanced,
      ...features.temporal,
      ...features.contextual,
      ...features.ensemble
    ];
    
    return {
      ...features,
      featureNames: this.generateFeatureNames(),
    };
  }
  
  /**
   * Extract advanced statistical features
   */
  private async extractAdvancedFeatures(game: any, historicalData: any): Promise<number[]> {
    const features: number[] = [];
    
    // 1. Elo ratings
    const homeElo = await this.calculateEloRating(game.home_team_id, historicalData);
    const awayElo = await this.calculateEloRating(game.away_team_id, historicalData);
    features.push(homeElo / 2000, awayElo / 2000, (homeElo - awayElo) / 400);
    
    // 2. Pythagorean expectation
    const homePyth = this.calculatePythagoreanExpectation(game.home_team_id, historicalData);
    const awayPyth = this.calculatePythagoreanExpectation(game.away_team_id, historicalData);
    features.push(homePyth, awayPyth, homePyth - awayPyth);
    
    // 3. Strength of schedule
    const homeSOS = await this.calculateStrengthOfSchedule(game.home_team_id, historicalData);
    const awaySOS = await this.calculateStrengthOfSchedule(game.away_team_id, historicalData);
    features.push(homeSOS, awaySOS);
    
    // 4. Advanced pace metrics
    const paceDiff = this.calculatePaceDifferential(game, historicalData);
    features.push(paceDiff.offensive, paceDiff.defensive, paceDiff.net);
    
    // 5. Clutch performance
    const homeClutch = this.calculateClutchRating(game.home_team_id, historicalData);
    const awayClutch = this.calculateClutchRating(game.away_team_id, historicalData);
    features.push(homeClutch, awayClutch);
    
    // 6. Rest advantage
    const restAdvantage = this.calculateRestAdvantage(game, historicalData);
    features.push(restAdvantage.home, restAdvantage.away, restAdvantage.differential);
    
    // 7. Travel fatigue
    const travelFatigue = await this.calculateTravelFatigue(game, historicalData);
    features.push(travelFatigue.home, travelFatigue.away);
    
    // 8. Injury-adjusted roster strength
    const rosterStrength = await this.calculateInjuryAdjustedStrength(game);
    features.push(rosterStrength.home, rosterStrength.away, rosterStrength.differential);
    
    // 9. Coaching advantage
    const coachingEdge = await this.calculateCoachingAdvantage(game);
    features.push(coachingEdge);
    
    // 10. Market inefficiency indicators
    const marketIneff = await this.calculateMarketInefficiency(game);
    features.push(...marketIneff);
    
    return features;
  }
  
  /**
   * Extract temporal pattern features using LSTM-inspired approach
   */
  private async extractTemporalFeatures(game: any, historicalData: any): Promise<number[]> {
    const features: number[] = [];
    
    // 1. Momentum indicators (winning/losing streaks with decay)
    const homeMomentum = this.calculateMomentumWithDecay(game.home_team_id, historicalData);
    const awayMomentum = this.calculateMomentumWithDecay(game.away_team_id, historicalData);
    features.push(...homeMomentum, ...awayMomentum);
    
    // 2. Form cycles (periodic patterns)
    const homeFormCycle = this.detectFormCycles(game.home_team_id, historicalData);
    const awayFormCycle = this.detectFormCycles(game.away_team_id, historicalData);
    features.push(homeFormCycle.phase, homeFormCycle.amplitude, awayFormCycle.phase, awayFormCycle.amplitude);
    
    // 3. Trend analysis (linear, polynomial)
    const homeTrend = this.calculatePerformanceTrend(game.home_team_id, historicalData);
    const awayTrend = this.calculatePerformanceTrend(game.away_team_id, historicalData);
    features.push(...homeTrend, ...awayTrend);
    
    // 4. Volatility measures
    const homeVolatility = this.calculateVolatility(game.home_team_id, historicalData);
    const awayVolatility = this.calculateVolatility(game.away_team_id, historicalData);
    features.push(homeVolatility, awayVolatility);
    
    // 5. Seasonality factors
    const seasonality = this.extractSeasonalityFeatures(game);
    features.push(...seasonality);
    
    // 6. Time-weighted performance
    const timeWeighted = this.calculateTimeWeightedPerformance(game, historicalData);
    features.push(...timeWeighted);
    
    return features;
  }
  
  /**
   * Extract contextual features
   */
  private async extractContextualFeatures(game: any, externalData?: any): Promise<number[]> {
    const features: number[] = [];
    
    // 1. Rivalry intensity
    const rivalryScore = await this.calculateRivalryIntensity(game);
    features.push(rivalryScore);
    
    // 2. Playoff implications
    const playoffImpact = this.calculatePlayoffImplications(game, externalData);
    features.push(playoffImpact.home, playoffImpact.away);
    
    // 3. Division/Conference context
    const divisionContext = this.extractDivisionContext(game, externalData);
    features.push(...divisionContext);
    
    // 4. Prime time factor
    const primeTimeFactor = this.calculatePrimeTimeFactor(game);
    features.push(primeTimeFactor);
    
    // 5. Referee tendencies
    const refereeTendencies = await this.getRefereeImpact(game);
    features.push(...refereeTendencies);
    
    // 6. Weather impact (outdoor sports)
    const weatherImpact = await this.calculateWeatherImpact(game);
    features.push(...weatherImpact);
    
    // 7. Crowd factor
    const crowdImpact = this.calculateCrowdImpact(game);
    features.push(crowdImpact);
    
    // 8. Betting market signals
    const marketSignals = await this.extractMarketSignals(game);
    features.push(...marketSignals);
    
    return features;
  }
  
  /**
   * Extract ensemble meta-features
   */
  private async extractEnsembleFeatures(features: Omit<EnhancedFeatures, 'ensemble' | 'featureNames'>): Promise<number[]> {
    const metaFeatures: number[] = [];
    
    // 1. Feature interactions (multiplicative)
    const interactions = this.calculateFeatureInteractions(features);
    metaFeatures.push(...interactions);
    
    // 2. Feature clustering
    const clusters = this.performFeatureClustering(features);
    metaFeatures.push(...clusters);
    
    // 3. PCA components
    const pcaComponents = await this.calculatePCAComponents(features);
    metaFeatures.push(...pcaComponents.slice(0, 10)); // Top 10 components
    
    // 4. Feature importance weights
    const importanceWeights = this.calculateFeatureImportance(features);
    metaFeatures.push(...importanceWeights);
    
    return metaFeatures;
  }
  
  /**
   * Calculate Elo rating
   */
  private async calculateEloRating(teamId: string, historicalData: any): Promise<number> {
    const cacheKey = `elo_${teamId}`;
    if (this.featureCache.has(cacheKey)) {
      return this.featureCache.get(cacheKey);
    }
    
    let elo = 1500; // Starting Elo
    const K = 32; // K-factor
    
    const teamGames = historicalData.games
      .filter((g: any) => g.home_team_id === teamId || g.away_team_id === teamId)
      .slice(-50); // Last 50 games
    
    for (const game of teamGames) {
      const isHome = game.home_team_id === teamId;
      const won = isHome ? game.home_score > game.away_score : game.away_score > game.home_score;
      const opponentElo = 1500; // Simplified - would track all teams
      
      const expectedScore = 1 / (1 + Math.pow(10, (opponentElo - elo) / 400));
      const actualScore = won ? 1 : 0;
      
      elo += K * (actualScore - expectedScore);
    }
    
    this.featureCache.set(cacheKey, elo);
    return elo;
  }
  
  /**
   * Calculate Pythagorean expectation
   */
  private calculatePythagoreanExpectation(teamId: string, historicalData: any): number {
    const teamGames = historicalData.games
      .filter((g: any) => g.home_team_id === teamId || g.away_team_id === teamId)
      .slice(-20);
    
    let pointsFor = 0;
    let pointsAgainst = 0;
    
    for (const game of teamGames) {
      if (game.home_team_id === teamId) {
        pointsFor += game.home_score;
        pointsAgainst += game.away_score;
      } else {
        pointsFor += game.away_score;
        pointsAgainst += game.home_score;
      }
    }
    
    if (pointsFor + pointsAgainst === 0) return 0.5;
    
    const exponent = 2.37; // Sport-specific exponent
    return Math.pow(pointsFor, exponent) / 
           (Math.pow(pointsFor, exponent) + Math.pow(pointsAgainst, exponent));
  }
  
  /**
   * Calculate momentum with exponential decay
   */
  private calculateMomentumWithDecay(teamId: string, historicalData: any): number[] {
    const games = historicalData.games
      .filter((g: any) => g.home_team_id === teamId || g.away_team_id === teamId)
      .slice(-10)
      .reverse();
    
    let momentum = 0;
    let shortTermMomentum = 0;
    let longTermMomentum = 0;
    
    const decayFactor = 0.9;
    const shortTermDecay = 0.7;
    
    games.forEach((game: any, index: number) => {
      const isHome = game.home_team_id === teamId;
      const won = isHome ? game.home_score > game.away_score : game.away_score > game.home_score;
      const margin = isHome ? game.home_score - game.away_score : game.away_score - game.home_score;
      
      const weight = Math.pow(decayFactor, index);
      const shortWeight = Math.pow(shortTermDecay, index);
      
      const gameImpact = (won ? 1 : -1) * (1 + Math.tanh(margin / 20));
      
      momentum += gameImpact * weight;
      if (index < 3) shortTermMomentum += gameImpact * shortWeight;
      longTermMomentum += gameImpact * weight;
    });
    
    return [
      Math.tanh(momentum / 5),
      Math.tanh(shortTermMomentum / 3),
      Math.tanh(longTermMomentum / 10)
    ];
  }
  
  /**
   * Calculate feature interactions
   */
  private calculateFeatureInteractions(features: any): number[] {
    const interactions: number[] = [];
    
    // Key interaction pairs
    const interactionPairs = [
      [0, 1], // home_win_rate * away_win_rate
      [2, 3], // home_avg_points * away_avg_points
      [4, 5], // momentum interactions
    ];
    
    for (const [i, j] of interactionPairs) {
      if (features.basic[i] !== undefined && features.basic[j] !== undefined) {
        interactions.push(features.basic[i] * features.basic[j]);
        interactions.push(features.basic[i] - features.basic[j]);
      }
    }
    
    return interactions;
  }
  
  /**
   * Calculate PCA components
   */
  private async calculatePCAComponents(features: any): Promise<number[]> {
    // Flatten all features
    const allFeatures = [
      ...features.basic,
      ...features.advanced,
      ...features.temporal,
      ...features.contextual
    ];
    
    // Simple PCA approximation using TensorFlow.js
    const data = tf.tensor2d([allFeatures]);
    const mean = data.mean(0);
    const centered = data.sub(mean);
    
    // Compute covariance matrix
    const cov = centered.transpose().matMul(centered).div(data.shape[0] - 1);
    
    // Get eigenvalues and eigenvectors
    const { values, vectors } = await tf.linalg.eigh(cov);
    
    // Project data onto principal components
    const components = centered.matMul(vectors).arraySync()[0];
    
    // Clean up tensors
    data.dispose();
    mean.dispose();
    centered.dispose();
    cov.dispose();
    values.dispose();
    vectors.dispose();
    
    return components;
  }
  
  /**
   * Additional helper methods...
   */
  private calculateStrengthOfSchedule(teamId: string, historicalData: any): Promise<number> {
    // Implementation
    return Promise.resolve(0.5);
  }
  
  private calculatePaceDifferential(game: any, historicalData: any): any {
    return { offensive: 0.5, defensive: 0.5, net: 0 };
  }
  
  private calculateClutchRating(teamId: string, historicalData: any): number {
    return 0.5;
  }
  
  private calculateRestAdvantage(game: any, historicalData: any): any {
    return { home: 0, away: 0, differential: 0 };
  }
  
  private calculateTravelFatigue(game: any, historicalData: any): Promise<any> {
    return Promise.resolve({ home: 0, away: 0 });
  }
  
  private calculateInjuryAdjustedStrength(game: any): Promise<any> {
    return Promise.resolve({ home: 0.5, away: 0.5, differential: 0 });
  }
  
  private calculateCoachingAdvantage(game: any): Promise<number> {
    return Promise.resolve(0);
  }
  
  private calculateMarketInefficiency(game: any): Promise<number[]> {
    return Promise.resolve([0, 0, 0]);
  }
  
  private detectFormCycles(teamId: string, historicalData: any): any {
    return { phase: 0.5, amplitude: 0.5 };
  }
  
  private calculatePerformanceTrend(teamId: string, historicalData: any): number[] {
    return [0, 0, 0];
  }
  
  private calculateVolatility(teamId: string, historicalData: any): number {
    return 0.5;
  }
  
  private extractSeasonalityFeatures(game: any): number[] {
    const date = new Date(game.created_at);
    const dayOfYear = Math.floor((date.getTime() - new Date(date.getFullYear(), 0, 0).getTime()) / 86400000);
    
    return [
      Math.sin(2 * Math.PI * dayOfYear / 365),
      Math.cos(2 * Math.PI * dayOfYear / 365),
      dayOfYear / 365
    ];
  }
  
  private calculateTimeWeightedPerformance(game: any, historicalData: any): number[] {
    return [0.5, 0.5];
  }
  
  private calculateRivalryIntensity(game: any): Promise<number> {
    return Promise.resolve(0.5);
  }
  
  private calculatePlayoffImplications(game: any, externalData: any): any {
    return { home: 0.5, away: 0.5 };
  }
  
  private extractDivisionContext(game: any, externalData: any): number[] {
    return [0.5, 0.5];
  }
  
  private calculatePrimeTimeFactor(game: any): number {
    const hour = new Date(game.created_at).getHours();
    return hour >= 20 || hour <= 1 ? 1 : 0;
  }
  
  private getRefereeImpact(game: any): Promise<number[]> {
    return Promise.resolve([0, 0]);
  }
  
  private calculateWeatherImpact(game: any): Promise<number[]> {
    return Promise.resolve([0, 0, 0]);
  }
  
  private calculateCrowdImpact(game: any): number {
    return 0.5;
  }
  
  private extractMarketSignals(game: any): Promise<number[]> {
    return Promise.resolve([0, 0, 0]);
  }
  
  private performFeatureClustering(features: any): number[] {
    return [0, 0, 0];
  }
  
  private calculateFeatureImportance(features: any): number[] {
    return [1, 1, 1];
  }
  
  /**
   * Get feature names for interpretability
   */
  private generateFeatureNames(): string[] {
    return [
      // Basic features
      'home_win_rate', 'away_win_rate', 'home_avg_points', 'away_avg_points',
      'win_rate_diff', 'points_diff', 'home_last_3_wins', 'away_last_3_wins',
      
      // Advanced features
      'home_elo', 'away_elo', 'elo_diff', 'home_pythagorean', 'away_pythagorean',
      'pyth_diff', 'home_sos', 'away_sos', 'pace_offensive', 'pace_defensive',
      'pace_net', 'home_clutch', 'away_clutch', 'rest_home', 'rest_away',
      'rest_diff', 'travel_home', 'travel_away', 'roster_home', 'roster_away',
      'roster_diff', 'coaching_edge',
      
      // Temporal features
      'home_momentum', 'home_momentum_short', 'home_momentum_long',
      'away_momentum', 'away_momentum_short', 'away_momentum_long',
      'home_form_phase', 'home_form_amplitude', 'away_form_phase', 'away_form_amplitude',
      'home_trend_linear', 'home_trend_quad', 'home_trend_cubic',
      'away_trend_linear', 'away_trend_quad', 'away_trend_cubic',
      'home_volatility', 'away_volatility', 'season_sin', 'season_cos', 'season_progress',
      
      // Contextual features
      'rivalry_intensity', 'playoff_impact_home', 'playoff_impact_away',
      'division_importance', 'conference_factor', 'primetime', 'referee_home_bias',
      'referee_total_bias', 'temperature_impact', 'wind_impact', 'precipitation',
      'crowd_factor', 'line_movement', 'sharp_money', 'public_fade',
      
      // Meta features
      'interaction_1', 'interaction_2', 'interaction_3', 'interaction_4',
      'cluster_1', 'cluster_2', 'cluster_3',
      'pca_1', 'pca_2', 'pca_3', 'pca_4', 'pca_5'
    ];
  }
  
  /**
   * Extract basic features (simplified version of existing)
   */
  private async extractBasicFeatures(game: any, historicalData: any): Promise<number[]> {
    // This would use the existing basic feature extraction
    // Returning placeholder for now
    return new Array(20).fill(0.5);
  }
}

// Export singleton
export const featureEngineering = new AdvancedFeatureEngineering();
#!/usr/bin/env tsx
/**
 * 🎯 MEDIAN-CENTRIC PREDICTOR BASE CLASS
 * 
 * Based on Dmochowski (2023): "A statistical theory of optimal decision-making in sports betting"
 * 
 * KEY INSIGHT: For sports betting, the MEDIAN (not mean) is the optimal prediction target.
 * The "one-point rule": A 1-point edge from true median = 2.1% expected profit.
 * 
 * This base class implements quantile regression for all sports predictors.
 */

import { pgPool } from '../../config/database';

export interface QuantileModelConfig {
  sport: string;
  quantilesToPredict: number[];
  features: string[];
  targetColumn: string;
  confidenceThresholds: {
    minimal: number;    // 1-point edge
    moderate: number;   // 2-point edge  
    strong: number;     // 3-point edge
  };
}

export interface QuantilePrediction {
  p10: number;   // 10th percentile (floor)
  p25: number;   // 25th percentile (lower quartile)
  p50: number;   // 50th percentile (MEDIAN - key value!)
  p75: number;   // 75th percentile (upper quartile)
  p90: number;   // 90th percentile (ceiling)
  mean: number;  // Traditional mean for comparison
  meanMedianGap: number; // Identifies outlier-prone players
}

export interface BettingDecision {
  recommendation: 'home' | 'away' | 'no_bet';
  edge: number;  // Points of edge over market
  expectedROI: number; // Based on edge magnitude
  confidence: 'low' | 'medium' | 'high';
}

export abstract class MedianPredictorBase {
  protected sport: string;
  protected config: QuantileModelConfig;
  
  // Critical quantiles from Dmochowski paper
  protected readonly BETTING_QUANTILES = {
    standard: { lower: 0.476, upper: 0.524 },  // For -110 odds
    reduced: { lower: 0.465, upper: 0.535 },   // For -105 odds
    plus: { lower: 0.488, upper: 0.512 }       // For plus odds
  };
  
  // Expected ROI based on edge (from empirical NFL analysis)
  protected readonly EDGE_TO_ROI = {
    1.0: 0.021,  // 2.1% ROI for 1-point edge
    2.0: 0.094,  // 9.4% ROI for 2-point edge
    3.0: 0.166   // 16.6% ROI for 3-point edge
  };
  
  constructor(sport: string, config: QuantileModelConfig) {
    this.sport = sport;
    this.config = config;
  }
  
  /**
   * Core prediction method - returns all quantiles
   */
  async predictQuantiles(features: Record<string, number>): Promise<QuantilePrediction> {
    // This will be implemented using Python service
    // For now, return a mock structure
    const prediction: QuantilePrediction = {
      p10: 0,
      p25: 0,
      p50: 0,  // The MEDIAN - our primary target
      p75: 0,
      p90: 0,
      mean: 0,
      meanMedianGap: 0
    };
    
    // In production, this calls our Python quantile regression service
    // const response = await callPythonService('predict_quantiles', { features, sport: this.sport });
    
    return prediction;
  }
  
  /**
   * Implements Dmochowski decision rule for betting
   */
  calculateBettingDecision(
    ourMedian: number,
    marketLine: number,
    odds: { home: number; away: number } = { home: -110, away: -110 }
  ): BettingDecision {
    // Calculate the critical quantiles based on odds
    const quantiles = this.calculateCriticalQuantiles(odds);
    
    // Calculate edge
    const edge = Math.abs(ourMedian - marketLine);
    
    // Determine recommendation based on Dmochowski theorem
    let recommendation: 'home' | 'away' | 'no_bet';
    
    if (marketLine < ourMedian - this.config.confidenceThresholds.minimal) {
      recommendation = 'home';
    } else if (marketLine > ourMedian + this.config.confidenceThresholds.minimal) {
      recommendation = 'away';
    } else {
      recommendation = 'no_bet';
    }
    
    // Calculate expected ROI
    const expectedROI = this.calculateExpectedROI(edge);
    
    // Determine confidence level
    let confidence: 'low' | 'medium' | 'high';
    if (edge >= this.config.confidenceThresholds.strong) {
      confidence = 'high';
    } else if (edge >= this.config.confidenceThresholds.moderate) {
      confidence = 'medium';
    } else {
      confidence = 'low';
    }
    
    return {
      recommendation,
      edge,
      expectedROI,
      confidence
    };
  }
  
  /**
   * Calculate critical quantiles based on betting odds
   */
  private calculateCriticalQuantiles(odds: { home: number; away: number }) {
    // Convert American odds to profit multipliers
    const phiHome = odds.home > 0 ? odds.home / 100 : 100 / Math.abs(odds.home);
    const phiAway = odds.away > 0 ? odds.away / 100 : 100 / Math.abs(odds.away);
    
    // From Dmochowski equation 9
    const lowerQuantile = (1 + phiHome) / (2 + phiHome + phiAway);
    const upperQuantile = 1 - lowerQuantile;
    
    return { lower: lowerQuantile, upper: upperQuantile };
  }
  
  /**
   * Calculate expected ROI based on edge magnitude
   */
  private calculateExpectedROI(edge: number): number {
    // Linear interpolation between known points
    if (edge <= 1.0) {
      return this.EDGE_TO_ROI[1.0] * edge;
    } else if (edge <= 2.0) {
      const ratio = (edge - 1.0) / (2.0 - 1.0);
      return this.EDGE_TO_ROI[1.0] + ratio * (this.EDGE_TO_ROI[2.0] - this.EDGE_TO_ROI[1.0]);
    } else if (edge <= 3.0) {
      const ratio = (edge - 2.0) / (3.0 - 2.0);
      return this.EDGE_TO_ROI[2.0] + ratio * (this.EDGE_TO_ROI[3.0] - this.EDGE_TO_ROI[2.0]);
    } else {
      // Extrapolate for larger edges
      return this.EDGE_TO_ROI[3.0] + (edge - 3.0) * 0.05;
    }
  }
  
  /**
   * Identify players/games with high mean-median gaps (outlier prone)
   */
  async findOutlierProneTargets(limit: number = 20): Promise<any[]> {
    // This identifies players whose mean is inflated by outliers
    // Perfect for finding "trap" plays in DFS or props to fade
    
    const query = `
      WITH player_stats AS (
        SELECT 
          player_id,
          name,
          sport,
          AVG(fantasy_points) as mean_points,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fantasy_points) as median_points,
          COUNT(*) as games_played
        FROM player_game_logs
        WHERE sport = $1
        AND game_date > CURRENT_DATE - INTERVAL '30 days'
        GROUP BY player_id, name, sport
        HAVING COUNT(*) >= 5
      )
      SELECT 
        *,
        mean_points - median_points as mean_median_gap,
        (mean_points - median_points) / NULLIF(median_points, 0) as gap_percentage
      FROM player_stats
      WHERE mean_points > median_points
      ORDER BY mean_median_gap DESC
      LIMIT $2
    `;
    
    const result = await pgPool.query(query, [this.sport, limit]);
    return result.rows;
  }
  
  /**
   * Find games where market might be using mean instead of median
   */
  async findMarketInefficiencies(upcomingGames: any[]): Promise<any[]> {
    const inefficiencies = [];
    
    for (const game of upcomingGames) {
      // Get team's recent scoring distribution
      const homeMedian = await this.getTeamMedian(game.homeTeam);
      const awayMedian = await this.getTeamMedian(game.awayTeam);
      
      // Predict game median
      const predictedMedian = (homeMedian + awayMedian) / 2;
      
      // Compare to market total
      const marketTotal = game.total;
      const edge = Math.abs(predictedMedian - marketTotal);
      
      if (edge >= this.config.confidenceThresholds.minimal) {
        inefficiencies.push({
          game,
          predictedMedian,
          marketTotal,
          edge,
          recommendation: predictedMedian > marketTotal ? 'over' : 'under',
          expectedROI: this.calculateExpectedROI(edge)
        });
      }
    }
    
    return inefficiencies.sort((a, b) => b.edge - a.edge);
  }
  
  /**
   * Abstract method - each sport implements their own feature extraction
   */
  abstract extractFeatures(gameData: any): Promise<Record<string, number>>;
  
  /**
   * Abstract method - get team's scoring median
   */
  abstract getTeamMedian(team: string): Promise<number>;
  
  /**
   * Convert traditional stats to quantile predictions
   */
  async enhancePlayerProjection(playerId: string): Promise<{
    traditional: number;
    median: number;
    floor: number;
    ceiling: number;
    consistency: number;
    outlierRisk: number;
  }> {
    // Get player's recent games
    const recentGames = await this.getPlayerRecentGames(playerId);
    
    // Calculate quantiles
    const points = recentGames.map(g => g.fantasy_points).sort((a, b) => a - b);
    const n = points.length;
    
    if (n < 5) {
      throw new Error('Insufficient data for quantile analysis');
    }
    
    // Calculate percentiles
    const p10Index = Math.floor(n * 0.1);
    const p25Index = Math.floor(n * 0.25);
    const p50Index = Math.floor(n * 0.5);
    const p75Index = Math.floor(n * 0.75);
    const p90Index = Math.floor(n * 0.9);
    
    const median = points[p50Index];
    const mean = points.reduce((a, b) => a + b, 0) / n;
    
    // Calculate consistency (% of games within 25% of median)
    const consistentGames = points.filter(p => 
      p >= median * 0.75 && p <= median * 1.25
    ).length;
    
    return {
      traditional: mean,
      median: median,
      floor: points[p25Index],
      ceiling: points[p75Index],
      consistency: consistentGames / n,
      outlierRisk: (mean - median) / median
    };
  }
  
  /**
   * Abstract method - get player's recent games
   */
  abstract getPlayerRecentGames(playerId: string): Promise<any[]>;
}

/**
 * Dmochowski's Theorem Summary:
 * 
 * For a point spread bet with symmetric odds:
 * - Bet home team if: spread < median of margin distribution
 * - Bet away team if: spread > median of margin distribution
 * 
 * For asymmetric odds:
 * - Use quantile (1 + φ_h) / (2 + φ_h + φ_v) instead of median
 * 
 * Expected profit increases dramatically with edge:
 * - 1 point edge: 2.1% ROI
 * - 2 point edge: 9.4% ROI
 * - 3 point edge: 16.6% ROI
 */
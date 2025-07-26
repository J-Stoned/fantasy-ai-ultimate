#!/usr/bin/env tsx
/**
 * 🏈 NFL ELITE MEDIAN PREDICTOR - 90%+ ACCURACY TARGET
 * 
 * Implements Dmochowski (2023) median-centric approach for NFL.
 * Key insight: NFL games have frequent outliers (blowouts, garbage time TDs)
 * that inflate mean predictions. Median filtering provides more robust predictions.
 */

import chalk from 'chalk';
import { MedianPredictorBase, QuantilePrediction, BettingDecision } from '../core/median-predictor-base';
import { pgPool } from '../../config/database';

interface NFLGameContext {
  isHome: boolean;
  isDivisionRival: boolean;
  isPrimeTime: boolean;
  weather: 'dome' | 'clear' | 'wind' | 'rain' | 'snow';
  temperature?: number;
  windSpeed?: number;
  restDays: number;
  isPlayoffs: boolean;
  vegasTotal: number;
  vegasSpread: number;
  qbStatus: 'starter' | 'backup' | 'injured';
}

interface NFLMedianPrediction {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  opponent: string;
  // Quantile predictions
  median: number;           // 50th percentile (KEY VALUE)
  floor: number;           // 25th percentile  
  ceiling: number;         // 75th percentile
  boom: number;           // 90th percentile
  bust: number;           // 10th percentile
  // Comparison metrics
  traditionalMean: number;
  meanMedianGap: number;
  garbageTimeRisk: number;
  // Context adjustments
  weatherImpact: number;
  divisionalAdjustment: number;
  primeTimeBonus: number;
  // Betting insights
  projectedSpread: number;
  spreadEdge: number;
  totalEdge: number;
  recommendation: string;
  confidence: 'low' | 'medium' | 'high';
  expectedROI?: number;
}

export class NFLEliteMedianPredictor extends MedianPredictorBase {
  // NFL-specific constants
  private readonly WEATHER_IMPACT = {
    dome: 1.00,
    clear: 1.00,
    wind: 0.88,    // 12% reduction for wind
    rain: 0.93,    // 7% reduction for rain
    snow: 0.85     // 15% reduction for snow
  };
  
  private readonly GARBAGE_TIME_THRESHOLD = 21; // Point differential
  private readonly QB_BACKUP_PENALTY = 0.78;    // 22% reduction
  private readonly DIVISION_GAME_FACTOR = 0.96; // Tighter, lower-scoring
  private readonly PRIME_TIME_FACTOR = 1.03;    // Slight boost
  private readonly PLAYOFF_FACTOR = 0.94;       // More conservative
  
  constructor() {
    super('NFL', {
      sport: 'NFL',
      quantilesToPredict: [0.10, 0.25, 0.476, 0.50, 0.524, 0.75, 0.90],
      features: [
        'team_offensive_rating', 'team_defensive_rating',
        'opponent_offensive_rating', 'opponent_defensive_rating',
        'avg_last_3', 'avg_last_5', 'avg_last_10',
        'home_away_split', 'weather_factor', 'rest_days',
        'qb_rating', 'opponent_pass_defense_rank',
        'vegas_total', 'vegas_spread'
      ],
      targetColumn: 'fantasy_points',
      confidenceThresholds: {
        minimal: 1.0,   // 1-point edge = 2.1% ROI
        moderate: 2.0,  // 2-point edge = 9.4% ROI
        strong: 3.0     // 3-point edge = 16.6% ROI
      }
    });
  }
  
  /**
   * Predict player performance using median approach
   */
  async predictPlayer(playerId: string, gameContext: NFLGameContext): Promise<NFLMedianPrediction | null> {
    try {
      // 1. Get player data
      const playerData = await this.getPlayerData(playerId);
      if (!playerData) return null;
      
      // 2. Extract features
      const features = await this.extractFeatures({ playerData, gameContext });
      
      // 3. Get quantile predictions
      const quantiles = await this.predictQuantiles(features);
      
      // 4. Apply NFL-specific adjustments
      const adjusted = this.applyNFLAdjustments(quantiles, gameContext, playerData);
      
      // 5. Calculate betting edges
      const bettingAnalysis = this.analyzeBettingOpportunity(
        adjusted.p50,
        gameContext.vegasSpread,
        gameContext.vegasTotal
      );
      
      // 6. Assess garbage time risk
      const garbageTimeRisk = this.assessGarbageTimeRisk(
        gameContext.vegasSpread,
        playerData.position
      );
      
      return {
        playerId,
        playerName: playerData.name,
        position: playerData.position,
        team: playerData.team,
        opponent: gameContext.opponent || 'UNK',
        // Quantiles
        median: adjusted.p50,
        floor: adjusted.p25,
        ceiling: adjusted.p75,
        boom: adjusted.p90,
        bust: adjusted.p10,
        // Comparison
        traditionalMean: quantiles.mean,
        meanMedianGap: quantiles.meanMedianGap,
        garbageTimeRisk,
        // Context
        weatherImpact: this.WEATHER_IMPACT[gameContext.weather],
        divisionalAdjustment: gameContext.isDivisionRival ? this.DIVISION_GAME_FACTOR : 1.0,
        primeTimeBonus: gameContext.isPrimeTime ? this.PRIME_TIME_FACTOR : 1.0,
        // Betting
        projectedSpread: bettingAnalysis.projectedSpread,
        spreadEdge: bettingAnalysis.spreadEdge,
        totalEdge: bettingAnalysis.totalEdge,
        recommendation: bettingAnalysis.recommendation,
        confidence: bettingAnalysis.confidence,
        expectedROI: bettingAnalysis.expectedROI
      };
      
    } catch (error) {
      console.error(chalk.red(`Error predicting NFL player ${playerId}:`), error);
      return null;
    }
  }
  
  /**
   * Extract NFL-specific features
   */
  async extractFeatures(data: any): Promise<Record<string, number>> {
    const { playerData, gameContext } = data;
    
    // Get team ratings
    const teamRatings = await this.getTeamRatings(playerData.team, gameContext.opponent);
    
    // Get recent performance with median focus
    const recentPerf = await this.getRecentMedianPerformance(playerData.player_id);
    
    // Weather adjustment
    const weatherFactor = this.WEATHER_IMPACT[gameContext.weather] || 1.0;
    
    // QB impact for skill position players
    let qbFactor = 1.0;
    if (['WR', 'TE'].includes(playerData.position) && gameContext.qbStatus !== 'starter') {
      qbFactor = this.QB_BACKUP_PENALTY;
    }
    
    return {
      // Team metrics
      team_offensive_rating: teamRatings.teamOffense,
      team_defensive_rating: teamRatings.teamDefense,
      opponent_offensive_rating: teamRatings.oppOffense,
      opponent_defensive_rating: teamRatings.oppDefense,
      
      // Recent performance (median-based)
      avg_last_3: recentPerf.median_last_3,
      avg_last_5: recentPerf.median_last_5,
      avg_last_10: recentPerf.median_last_10,
      
      // Situational
      home_away_split: gameContext.isHome ? 1.03 : 0.97,
      weather_factor: weatherFactor,
      rest_days: Math.min(gameContext.restDays, 14) / 7, // Normalize to 0-2
      
      // Matchup
      qb_rating: qbFactor,
      opponent_pass_defense_rank: teamRatings.oppPassDefRank / 32, // Normalize
      
      // Vegas lines (market's median estimate)
      vegas_total: gameContext.vegasTotal,
      vegas_spread: Math.abs(gameContext.vegasSpread)
    };
  }
  
  /**
   * Get team ratings with focus on median performance
   */
  private async getTeamRatings(team: string, opponent: string) {
    const result = await pgPool.query(`
      WITH team_games AS (
        SELECT 
          team,
          opponent,
          points_scored,
          points_allowed,
          total_yards,
          passing_yards_allowed,
          game_date
        FROM nfl_games
        WHERE (team = $1 OR team = $2)
        AND game_date > CURRENT_DATE - INTERVAL '60 days'
      ),
      team_medians AS (
        SELECT 
          team,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY points_scored) as median_points_scored,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY points_allowed) as median_points_allowed,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_yards) as median_yards,
          AVG(points_scored) as mean_points_scored -- For comparison
        FROM team_games
        GROUP BY team
      ),
      defense_ranks AS (
        SELECT 
          team,
          RANK() OVER (ORDER BY median_pass_yards_allowed) as pass_def_rank
        FROM (
          SELECT 
            team,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY passing_yards_allowed) as median_pass_yards_allowed
          FROM team_games
          GROUP BY team
        ) t
      )
      SELECT 
        t1.median_points_scored as team_offense,
        t2.median_points_allowed as team_defense,
        t2.median_points_scored as opp_offense,
        t1.median_points_allowed as opp_defense,
        COALESCE(dr.pass_def_rank, 16) as opp_pass_def_rank
      FROM team_medians t1
      JOIN team_medians t2 ON t2.team = $2
      LEFT JOIN defense_ranks dr ON dr.team = $2
      WHERE t1.team = $1
    `, [team, opponent]);
    
    return result.rows[0] || {
      teamOffense: 21,
      teamDefense: 21,
      oppOffense: 21,
      oppDefense: 21,
      oppPassDefRank: 16
    };
  }
  
  /**
   * Get recent MEDIAN performance (not mean)
   */
  private async getRecentMedianPerformance(playerId: string) {
    const result = await pgPool.query(`
      WITH recent_games AS (
        SELECT 
          fantasy_points,
          game_date,
          ROW_NUMBER() OVER (ORDER BY game_date DESC) as game_recency
        FROM nfl_player_stats
        WHERE player_id = $1
        AND fantasy_points IS NOT NULL
        ORDER BY game_date DESC
        LIMIT 10
      )
      SELECT 
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fantasy_points) FILTER (WHERE game_recency <= 3) as median_last_3,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fantasy_points) FILTER (WHERE game_recency <= 5) as median_last_5,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fantasy_points) as median_last_10,
        -- Also get means for comparison
        AVG(fantasy_points) FILTER (WHERE game_recency <= 3) as mean_last_3,
        AVG(fantasy_points) FILTER (WHERE game_recency <= 5) as mean_last_5,
        AVG(fantasy_points) as mean_last_10
      FROM recent_games
    `, [playerId]);
    
    const data = result.rows[0];
    return {
      median_last_3: data?.median_last_3 || 0,
      median_last_5: data?.median_last_5 || 0,
      median_last_10: data?.median_last_10 || 0,
      mean_median_gap_3: (data?.mean_last_3 || 0) - (data?.median_last_3 || 0)
    };
  }
  
  /**
   * Apply NFL-specific adjustments to quantile predictions
   */
  private applyNFLAdjustments(
    quantiles: QuantilePrediction,
    gameContext: NFLGameContext,
    playerData: any
  ): QuantilePrediction {
    const adjusted = { ...quantiles };
    
    // Weather impact (affects all quantiles)
    const weatherMultiplier = this.WEATHER_IMPACT[gameContext.weather];
    Object.keys(adjusted).forEach(key => {
      if (key.startsWith('p') && typeof adjusted[key as keyof QuantilePrediction] === 'number') {
        (adjusted as any)[key] *= weatherMultiplier;
      }
    });
    
    // Division games are tighter (compress the distribution)
    if (gameContext.isDivisionRival) {
      const median = adjusted.p50;
      // Reduce variance
      adjusted.p10 = median - (median - adjusted.p10) * 0.8;
      adjusted.p90 = median + (adjusted.p90 - median) * 0.8;
      adjusted.p25 = median - (median - adjusted.p25) * 0.9;
      adjusted.p75 = median + (adjusted.p75 - median) * 0.9;
    }
    
    // Prime time slight boost
    if (gameContext.isPrimeTime) {
      Object.keys(adjusted).forEach(key => {
        if (key.startsWith('p') && typeof adjusted[key as keyof QuantilePrediction] === 'number') {
          (adjusted as any)[key] *= this.PRIME_TIME_FACTOR;
        }
      });
    }
    
    // Backup QB impact
    if (gameContext.qbStatus === 'backup' && ['WR', 'TE', 'RB'].includes(playerData.position)) {
      Object.keys(adjusted).forEach(key => {
        if (key.startsWith('p') && typeof adjusted[key as keyof QuantilePrediction] === 'number') {
          (adjusted as any)[key] *= this.QB_BACKUP_PENALTY;
        }
      });
    }
    
    return adjusted;
  }
  
  /**
   * Analyze betting opportunity using Dmochowski theory
   */
  private analyzeBettingOpportunity(
    ourMedian: number,
    vegasSpread: number,
    vegasTotal: number
  ) {
    // For team performance, we'd calculate spread edge
    // For player props, we'd compare to prop lines
    // This is simplified for illustration
    
    const projectedTeamMedian = ourMedian * 0.3; // Rough player contribution
    const spreadEdge = Math.abs(projectedTeamMedian - vegasSpread);
    const totalContribution = ourMedian * 0.15; // Player's contribution to total
    const totalEdge = Math.abs(totalContribution);
    
    let recommendation = 'no_edge';
    let confidence: 'low' | 'medium' | 'high' = 'low';
    let expectedROI = 0;
    
    if (spreadEdge >= this.config.confidenceThresholds.strong) {
      recommendation = 'strong_play';
      confidence = 'high';
      expectedROI = 0.166; // 16.6% for 3+ point edge
    } else if (spreadEdge >= this.config.confidenceThresholds.moderate) {
      recommendation = 'moderate_play';
      confidence = 'medium';
      expectedROI = 0.094; // 9.4% for 2-point edge
    } else if (spreadEdge >= this.config.confidenceThresholds.minimal) {
      recommendation = 'slight_edge';
      confidence = 'low';
      expectedROI = 0.021; // 2.1% for 1-point edge
    }
    
    return {
      projectedSpread: projectedTeamMedian,
      spreadEdge,
      totalEdge,
      recommendation,
      confidence,
      expectedROI
    };
  }
  
  /**
   * Assess risk of garbage time affecting projections
   */
  private assessGarbageTimeRisk(spread: number, position: string): number {
    const blowoutRisk = Math.abs(spread) / this.GARBAGE_TIME_THRESHOLD;
    
    // Different positions affected differently
    const positionSensitivity = {
      'QB': 0.8,   // QBs often pulled in blowouts
      'RB': 0.9,   // RBs see reduced usage
      'WR': 0.6,   // WR1s may still play
      'TE': 0.7,   // TEs moderate risk
      'K': 0.4,    // Kickers less affected
      'DST': 1.0   // DST very affected by garbage time
    };
    
    const sensitivity = positionSensitivity[position as keyof typeof positionSensitivity] || 0.7;
    
    return Math.min(blowoutRisk * sensitivity, 1.0);
  }
  
  /**
   * Get team's scoring median
   */
  async getTeamMedian(team: string): Promise<number> {
    const result = await pgPool.query(`
      SELECT 
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY points_scored) as median_points,
        AVG(points_scored) as mean_points
      FROM nfl_games
      WHERE team = $1
      AND game_date > CURRENT_DATE - INTERVAL '365 days'
    `, [team]);
    
    return result.rows[0]?.median_points || 21;
  }
  
  /**
   * Get player's recent games for quantile analysis
   */
  async getPlayerRecentGames(playerId: string): Promise<any[]> {
    const result = await pgPool.query(`
      SELECT 
        player_id,
        game_date,
        fantasy_points,
        opponent,
        is_home,
        weather_conditions
      FROM nfl_player_stats
      WHERE player_id = $1
      AND game_date > CURRENT_DATE - INTERVAL '365 days'
      ORDER BY game_date DESC
      LIMIT 16
    `, [playerId]);
    
    return result.rows;
  }
  
  /**
   * Get player data
   */
  private async getPlayerData(playerId: string): Promise<any> {
    const result = await pgPool.query(`
      SELECT 
        player_id,
        name,
        position,
        team
      FROM nfl_players
      WHERE player_id = $1
    `, [playerId]);
    
    return result.rows[0];
  }
  
  /**
   * Find outlier games that skew means
   */
  async identifyOutlierGames(limit: number = 20): Promise<any[]> {
    const result = await pgPool.query(`
      WITH game_scores AS (
        SELECT 
          game_id,
          home_team,
          away_team,
          home_score,
          away_score,
          ABS(home_score - away_score) as margin,
          game_date
        FROM nfl_games
        WHERE game_date > CURRENT_DATE - INTERVAL '30 days'
      ),
      team_medians AS (
        SELECT 
          team,
          PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY points_scored) as median_score,
          AVG(points_scored) as mean_score
        FROM (
          SELECT home_team as team, home_score as points_scored FROM game_scores
          UNION ALL
          SELECT away_team as team, away_score as points_scored FROM game_scores
        ) t
        GROUP BY team
      )
      SELECT 
        gs.*,
        hm.median_score as home_median,
        am.median_score as away_median,
        GREATEST(
          ABS(gs.home_score - hm.median_score),
          ABS(gs.away_score - am.median_score)
        ) as outlier_score
      FROM game_scores gs
      JOIN team_medians hm ON hm.team = gs.home_team
      JOIN team_medians am ON am.team = gs.away_team
      WHERE gs.margin > $1
      ORDER BY outlier_score DESC
      LIMIT $2
    `, [this.GARBAGE_TIME_THRESHOLD, limit]);
    
    return result.rows;
  }
}

// Export factory function
export function createNFLEliteMedianPredictor(): NFLEliteMedianPredictor {
  return new NFLEliteMedianPredictor();
}
#!/usr/bin/env tsx
/**
 * 🏆 Multi-Sport Fantasy ML Predictor
 * Universal prediction system for all sports
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';

// Sport-specific configuration
interface SportConfig {
  name: string;
  scoringSystem: 'DK' | 'FD' | 'YAHOO' | 'ESPN';
  positions: string[];
  keyStats: string[];
  seasonLength: number;
  gamesPerWeek: number;
  fantasyMultipliers: Record<string, number>;
}

// Sport configurations
const SPORT_CONFIGS: Record<string, SportConfig> = {
  NFL: {
    name: 'National Football League',
    scoringSystem: 'DK',
    positions: ['QB', 'RB', 'WR', 'TE', 'K', 'DST'],
    keyStats: ['passing_yards', 'passing_touchdowns', 'rushing_yards', 'receptions', 'receiving_yards'],
    seasonLength: 18,
    gamesPerWeek: 1,
    fantasyMultipliers: {
      passing_yards: 0.04,
      passing_touchdowns: 4,
      rushing_yards: 0.1,
      rushing_touchdowns: 6,
      receptions: 1,
      receiving_yards: 0.1,
      receiving_touchdowns: 6,
      passing_interceptions: -2,
      fumbles_lost: -2
    }
  },
  NBA: {
    name: 'National Basketball Association',
    scoringSystem: 'DK',
    positions: ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL'],
    keyStats: ['points', 'rebounds', 'assists', 'steals', 'blocks', 'turnovers'],
    seasonLength: 82,
    gamesPerWeek: 3.5,
    fantasyMultipliers: {
      points: 1,
      rebounds: 1.25,
      assists: 1.5,
      steals: 2,
      blocks: 2,
      turnovers: -0.5,
      three_pointers_made: 0.5,
      double_double: 1.5,
      triple_double: 3
    }
  },
  MLB: {
    name: 'Major League Baseball',
    scoringSystem: 'DK',
    positions: ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'],
    keyStats: ['hits', 'runs', 'rbis', 'home_runs', 'stolen_bases', 'strikeouts', 'innings_pitched'],
    seasonLength: 162,
    gamesPerWeek: 6,
    fantasyMultipliers: {
      // Batting
      singles: 3,
      doubles: 5,
      triples: 8,
      home_runs: 10,
      rbis: 2,
      runs: 2,
      walks: 2,
      stolen_bases: 5,
      // Pitching
      innings_pitched: 2.25,
      strikeouts: 2,
      wins: 4,
      earned_runs: -2,
      hits_allowed: -0.6,
      walks_allowed: -0.6,
      complete_game: 2.5,
      no_hitter: 5
    }
  },
  NHL: {
    name: 'National Hockey League',
    scoringSystem: 'DK',
    positions: ['C', 'W', 'D', 'G', 'UTIL'],
    keyStats: ['goals', 'assists', 'shots', 'blocked_shots', 'saves', 'goals_against'],
    seasonLength: 82,
    gamesPerWeek: 3.5,
    fantasyMultipliers: {
      // Skaters
      goals: 3,
      assists: 2,
      shots: 0.5,
      blocked_shots: 0.5,
      plus_minus: 1,
      penalty_minutes: 0.5,
      // Goalies
      wins: 3,
      saves: 0.2,
      goals_against: -1,
      shutouts: 2
    }
  }
};

export interface PlayerPrediction {
  playerId: string;
  playerName: string;
  sport: string;
  position: string;
  team: string;
  projectedPoints: number;
  floor: number;
  ceiling: number;
  consistency: number;
  trend: 'up' | 'down' | 'stable';
  confidence: number;
  recentForm: number;
  matchupDifficulty: number;
  injuryRisk: number;
  ownership?: number;
  value?: number;
  recommendations: string[];
}

export class MultiSportPredictor {
  private sportConfig: SportConfig;
  
  constructor(private sport: string) {
    this.sportConfig = SPORT_CONFIGS[sport] || SPORT_CONFIGS.NFL;
  }
  
  /**
   * Predict fantasy performance for a player
   */
  async predictPlayer(playerId: string): Promise<PlayerPrediction | null> {
    try {
      // Get player info and recent performance
      const playerData = await this.getPlayerData(playerId);
      if (!playerData) return null;
      
      // Calculate base projection
      const baseProjection = await this.calculateBaseProjection(playerId);
      
      // Apply adjustments
      const matchupAdjustment = await this.getMatchupAdjustment(playerId);
      const trendAdjustment = this.calculateTrend(playerData.recentGames);
      const consistencyScore = this.calculateConsistency(playerData.recentGames);
      
      // Calculate final projection
      const projectedPoints = baseProjection * matchupAdjustment * trendAdjustment;
      
      // Calculate floor/ceiling
      const variance = playerData.stdDev || projectedPoints * 0.3;
      const floor = Math.max(0, projectedPoints - variance * 1.5);
      const ceiling = projectedPoints + variance * 2;
      
      // Generate recommendations
      const recommendations = this.generateRecommendations({
        projectedPoints,
        consistency: consistencyScore,
        trend: trendAdjustment > 1.05 ? 'up' : trendAdjustment < 0.95 ? 'down' : 'stable',
        matchupDifficulty: matchupAdjustment
      });
      
      return {
        playerId,
        playerName: playerData.name,
        sport: this.sport,
        position: playerData.position,
        team: playerData.team,
        projectedPoints: Math.round(projectedPoints * 10) / 10,
        floor: Math.round(floor * 10) / 10,
        ceiling: Math.round(ceiling * 10) / 10,
        consistency: consistencyScore,
        trend: trendAdjustment > 1.05 ? 'up' : trendAdjustment < 0.95 ? 'down' : 'stable',
        confidence: this.calculateConfidence(playerData, consistencyScore),
        recentForm: trendAdjustment,
        matchupDifficulty: matchupAdjustment,
        injuryRisk: 0, // TODO: Implement injury risk
        recommendations
      };
      
    } catch (error) {
      console.error(chalk.red(`Error predicting player ${playerId}:`), error);
      return null;
    }
  }
  
  /**
   * Get player data from appropriate view
   */
  private async getPlayerData(playerId: string): Promise<any> {
    const viewMap: Record<string, string> = {
      NFL: 'v_nfl_player_stats',
      NBA: 'v_nba_player_stats',
      MLB: 'v_mlb_player_stats',
      NHL: 'v_nhl_player_stats'
    };
    
    const view = viewMap[this.sport] || viewMap.NFL;
    
    const result = await pgPool.query(`
      WITH player_games AS (
        SELECT 
          player_id,
          name,
          position,
          team,
          game_date,
          ${this.sport === 'MLB' ? 'fantasy_points' : 
            this.sport === 'NFL' ? 'calculated_fantasy_points' : 
            'dk_fantasy_points'} as fantasy_points
        FROM ${view}
        WHERE player_id = $1
        ORDER BY game_date DESC
        LIMIT 20
      ),
      player_stats AS (
        SELECT 
          player_id,
          name,
          position,
          team,
          AVG(fantasy_points) as avg_points,
          STDDEV(fantasy_points) as std_dev,
          COUNT(*) as game_count,
          ARRAY_AGG(fantasy_points ORDER BY game_date DESC) as recent_points
        FROM player_games
        GROUP BY player_id, name, position, team
      )
      SELECT 
        ps.*,
        ARRAY(
          SELECT json_build_object(
            'date', game_date,
            'points', fantasy_points
          )
          FROM player_games pg
          WHERE pg.player_id = ps.player_id
          ORDER BY game_date DESC
        ) as recent_games
      FROM player_stats ps
    `, [playerId]);
    
    return result.rows[0];
  }
  
  /**
   * Calculate base projection using weighted average
   */
  private async calculateBaseProjection(playerId: string): Promise<number> {
    const features = await pgPool.query(`
      SELECT 
        avg_fantasy_points,
        avg_last_3,
        avg_last_5,
        avg_last_10
      FROM v_ml_player_features
      WHERE player_id = $1
      AND sport = $2
    `, [playerId, this.sport]);
    
    if (!features.rows[0]) return 0;
    
    const f = features.rows[0];
    
    // Weighted average with more weight on recent games
    const projection = 
      (f.avg_last_3 || 0) * 0.4 +
      (f.avg_last_5 || 0) * 0.3 +
      (f.avg_last_10 || 0) * 0.2 +
      (f.avg_fantasy_points || 0) * 0.1;
    
    return projection;
  }
  
  /**
   * Get matchup-based adjustment factor
   */
  private async getMatchupAdjustment(playerId: string): Promise<number> {
    // TODO: Implement opponent strength analysis
    // For now, return neutral adjustment
    return 1.0;
  }
  
  /**
   * Calculate trend from recent games
   */
  private calculateTrend(recentGames: any[]): number {
    if (!recentGames || recentGames.length < 3) return 1.0;
    
    // Compare last 3 games to previous 3
    const last3 = recentGames.slice(0, 3);
    const prev3 = recentGames.slice(3, 6);
    
    if (prev3.length < 3) return 1.0;
    
    const last3Avg = last3.reduce((sum, g) => sum + (g.points || 0), 0) / 3;
    const prev3Avg = prev3.reduce((sum, g) => sum + (g.points || 0), 0) / 3;
    
    if (prev3Avg === 0) return 1.0;
    
    const trendRatio = last3Avg / prev3Avg;
    
    // Cap trend adjustment between 0.8 and 1.2
    return Math.max(0.8, Math.min(1.2, trendRatio));
  }
  
  /**
   * Calculate consistency score (0-1)
   */
  private calculateConsistency(recentGames: any[]): number {
    if (!recentGames || recentGames.length < 5) return 0.5;
    
    const points = recentGames.map(g => g.points || 0);
    const avg = points.reduce((a, b) => a + b, 0) / points.length;
    
    if (avg === 0) return 0;
    
    const variance = points.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / points.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / avg;
    
    // Convert to 0-1 scale (lower CV = higher consistency)
    return Math.max(0, Math.min(1, 1 - coefficientOfVariation));
  }
  
  /**
   * Calculate confidence in prediction
   */
  private calculateConfidence(playerData: any, consistency: number): number {
    const factors = [
      playerData.game_count >= 10 ? 0.3 : 0.1, // Sample size
      consistency * 0.4, // Consistency weight
      playerData.std_dev < playerData.avg_points * 0.5 ? 0.2 : 0.1, // Low variance
      0.1 // Base confidence
    ];
    
    return Math.min(0.95, factors.reduce((a, b) => a + b, 0));
  }
  
  /**
   * Generate actionable recommendations
   */
  private generateRecommendations(factors: any): string[] {
    const recs: string[] = [];
    
    if (factors.projectedPoints > 20) {
      recs.push('CORE PLAY: High projected output');
    }
    
    if (factors.consistency > 0.7) {
      recs.push('CASH GAME: High consistency for safety');
    } else if (factors.consistency < 0.3) {
      recs.push('GPP ONLY: High variance player');
    }
    
    if (factors.trend === 'up') {
      recs.push('HOT STREAK: Positive recent trend');
    } else if (factors.trend === 'down') {
      recs.push('FADE CANDIDATE: Declining performance');
    }
    
    if (factors.matchupDifficulty > 1.1) {
      recs.push('PLUS MATCHUP: Favorable opponent');
    } else if (factors.matchupDifficulty < 0.9) {
      recs.push('TOUGH MATCHUP: Strong opponent defense');
    }
    
    return recs;
  }
  
  /**
   * Predict multiple players for DFS lineup building
   */
  async predictLineup(playerIds: string[]): Promise<PlayerPrediction[]> {
    const predictions = await Promise.all(
      playerIds.map(id => this.predictPlayer(id))
    );
    
    return predictions.filter(p => p !== null) as PlayerPrediction[];
  }
  
  /**
   * Get top players by position
   */
  async getTopPlayers(position: string, limit: number = 10): Promise<PlayerPrediction[]> {
    const viewMap: Record<string, string> = {
      NFL: 'v_nfl_player_stats',
      NBA: 'v_nba_player_stats', 
      MLB: 'v_mlb_player_stats',
      NHL: 'v_nhl_player_stats'
    };
    
    const view = viewMap[this.sport];
    
    // Get top players by recent average
    const topPlayers = await pgPool.query(`
      SELECT DISTINCT
        player_id,
        name as player_name,
        position,
        team,
        AVG(${this.sport === 'MLB' ? 'fantasy_points' : 
             this.sport === 'NFL' ? 'calculated_fantasy_points' : 
             'dk_fantasy_points'}) as avg_points
      FROM ${view}
      WHERE position = $1
      AND game_date > CURRENT_DATE - INTERVAL '30 days'
      GROUP BY player_id, name, position, team
      HAVING COUNT(*) >= 3
      ORDER BY avg_points DESC
      LIMIT $2
    `, [position, limit]);
    
    const predictions = await Promise.all(
      topPlayers.rows.map(p => this.predictPlayer(p.player_id))
    );
    
    return predictions.filter(p => p !== null) as PlayerPrediction[];
  }
}

// Export factory function
export function createPredictor(sport: string): MultiSportPredictor {
  return new MultiSportPredictor(sport);
}
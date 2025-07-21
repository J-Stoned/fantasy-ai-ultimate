#!/usr/bin/env tsx
/**
 * 🎯 Simple Player Predictor (No TensorFlow)
 * Uses statistical methods instead of neural networks
 */

import chalk from 'chalk';

export interface SimplePrediction {
  player_id: string;
  player_name: string;
  predicted_points: number;
  floor: number;
  ceiling: number;
  confidence: number;
  trend: 'up' | 'down' | 'stable';
}

export class SimplePlayerPredictor {
  /**
   * Predict player performance using weighted moving average
   */
  predict(playerHistory: any[]): SimplePrediction {
    // Sort by most recent first
    const sorted = [...playerHistory].sort((a, b) => 
      new Date(b.date || b.created_at).getTime() - new Date(a.date || a.created_at).getTime()
    );
    
    // Get recent games
    const recentGames = sorted.slice(0, 10);
    const lastGame = recentGames[0];
    
    // Calculate weighted average (more recent = higher weight)
    let weightedSum = 0;
    let weightSum = 0;
    
    recentGames.forEach((game, index) => {
      const weight = 1 / (index + 1); // Recent games weighted more
      weightedSum += (game.fantasy_points || 0) * weight;
      weightSum += weight;
    });
    
    const predicted = weightSum > 0 ? weightedSum / weightSum : 0;
    
    // Calculate standard deviation for floor/ceiling
    const points = recentGames.map(g => g.fantasy_points || 0);
    const avg = points.reduce((a, b) => a + b, 0) / points.length;
    const variance = points.reduce((sum, p) => sum + Math.pow(p - avg, 2), 0) / points.length;
    const stdDev = Math.sqrt(variance);
    
    // Calculate trend
    const recentAvg = points.slice(0, 3).reduce((a, b) => a + b, 0) / 3;
    const olderAvg = points.slice(3, 6).reduce((a, b) => a + b, 0) / 3;
    const trend = recentAvg > olderAvg * 1.1 ? 'up' : 
                  recentAvg < olderAvg * 0.9 ? 'down' : 'stable';
    
    return {
      player_id: lastGame.player_id,
      player_name: lastGame.player_name || `Player ${lastGame.player_id}`,
      predicted_points: Math.round(predicted * 10) / 10,
      floor: Math.max(0, Math.round((predicted - (stdDev || 0)) * 10) / 10),
      ceiling: Math.round((predicted + (stdDev || 0) * 1.5) * 10) / 10,
      confidence: Math.min(0.95, 0.5 + (points.length / 20)), // More games = higher confidence
      trend
    };
  }
  
  /**
   * Batch predict for multiple players
   */
  async predictBatch(playersData: Map<string, any[]>): Promise<SimplePrediction[]> {
    console.log(chalk.cyan(`Predicting for ${playersData.size} players...`));
    
    const predictions: SimplePrediction[] = [];
    
    for (const [playerId, history] of playersData) {
      if (history.length >= 3) { // Need at least 3 games
        predictions.push(this.predict(history));
      }
    }
    
    // Sort by predicted points
    predictions.sort((a, b) => b.predicted_points - a.predicted_points);
    
    return predictions;
  }
}

// Export singleton
export const simplePredictor = new SimplePlayerPredictor();
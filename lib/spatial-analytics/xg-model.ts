/**
 * Expected Goals (xG) Model Implementation
 * Based on Dr. Aris Thorne's methodology from File 1
 * 
 * This model calculates the probability of a shot resulting in a goal
 * based on spatial characteristics like location, angle, and distance.
 */

import { createClient } from '@supabase/supabase-js';

export interface ShotData {
  x_coordinate: number;
  y_coordinate: number;
  shot_distance?: number;
  shot_angle?: number;
  defender_distance?: number;
  shot_type?: string; // 'header', 'left_foot', 'right_foot', etc.
  game_situation?: string; // 'open_play', 'free_kick', 'corner', etc.
}

export interface XGResult {
  xg_value: number;
  confidence_interval: [number, number];
  factors: {
    distance_factor: number;
    angle_factor: number;
    defender_factor: number;
    situation_factor: number;
  };
}

export class ExpectedGoalsModel {
  // Court/field dimensions (NBA court as example)
  private readonly COURT_LENGTH = 94; // feet
  private readonly COURT_WIDTH = 50; // feet
  private readonly BASKET_X = 94; // at the end of court
  private readonly BASKET_Y = 25; // center of court

  // Model coefficients (would be trained on historical data)
  private readonly coefficients = {
    intercept: 2.5,
    distance: -0.08,
    angle: 0.015,
    defender_distance: 0.05,
    distance_squared: -0.001,
    is_header: -0.3,
    is_free_kick: 0.2,
    is_corner: -0.1,
  };

  /**
   * Calculate xG for a single shot
   */
  calculateXG(shot: ShotData): XGResult {
    // Calculate distance if not provided
    const distance = shot.shot_distance || this.calculateDistance(
      shot.x_coordinate,
      shot.y_coordinate
    );

    // Calculate angle if not provided
    const angle = shot.shot_angle || this.calculateAngle(
      shot.x_coordinate,
      shot.y_coordinate
    );

    // Feature engineering
    const features = {
      distance,
      angle,
      defender_distance: shot.defender_distance || 10, // default if not provided
      distance_squared: distance * distance,
      is_header: shot.shot_type === 'header' ? 1 : 0,
      is_free_kick: shot.game_situation === 'free_kick' ? 1 : 0,
      is_corner: shot.game_situation === 'corner' ? 1 : 0,
    };

    // Logistic regression calculation
    let logit = this.coefficients.intercept;
    logit += this.coefficients.distance * features.distance;
    logit += this.coefficients.angle * features.angle;
    logit += this.coefficients.defender_distance * features.defender_distance;
    logit += this.coefficients.distance_squared * features.distance_squared;
    logit += this.coefficients.is_header * features.is_header;
    logit += this.coefficients.is_free_kick * features.is_free_kick;
    logit += this.coefficients.is_corner * features.is_corner;

    // Convert to probability
    const xg_value = 1 / (1 + Math.exp(-logit));

    // Calculate individual factors for interpretability
    const factors = {
      distance_factor: this.sigmoid(this.coefficients.distance * features.distance),
      angle_factor: this.sigmoid(this.coefficients.angle * features.angle),
      defender_factor: this.sigmoid(this.coefficients.defender_distance * features.defender_distance),
      situation_factor: this.sigmoid(
        this.coefficients.is_header * features.is_header +
        this.coefficients.is_free_kick * features.is_free_kick +
        this.coefficients.is_corner * features.is_corner
      ),
    };

    // Simple confidence interval (would be more sophisticated with proper model uncertainty)
    const confidence_interval: [number, number] = [
      Math.max(0, xg_value - 0.05),
      Math.min(1, xg_value + 0.05)
    ];

    return {
      xg_value,
      confidence_interval,
      factors,
    };
  }

  /**
   * Calculate distance from shot location to goal/basket
   */
  private calculateDistance(x: number, y: number): number {
    const dx = this.BASKET_X - x;
    const dy = this.BASKET_Y - y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Calculate shot angle (in degrees)
   * Wider angles are generally better for scoring
   */
  private calculateAngle(x: number, y: number): number {
    // Calculate angle to goal posts (simplified for basketball - would be different for soccer)
    const goalWidth = 6; // feet (basketball hoop is ~6 feet from backboard edges)
    const post1_y = this.BASKET_Y - goalWidth / 2;
    const post2_y = this.BASKET_Y + goalWidth / 2;

    // Vectors from shot location to each "post"
    const vec1 = { x: this.BASKET_X - x, y: post1_y - y };
    const vec2 = { x: this.BASKET_X - x, y: post2_y - y };

    // Calculate angle between vectors
    const dot = vec1.x * vec2.x + vec1.y * vec2.y;
    const det = vec1.x * vec2.y - vec1.y * vec2.x;
    const angle = Math.atan2(det, dot);

    return Math.abs(angle) * (180 / Math.PI); // Convert to degrees
  }

  /**
   * Sigmoid activation function
   */
  private sigmoid(x: number): number {
    return 1 / (1 + Math.exp(-x));
  }

  /**
   * Batch calculate xG for multiple shots
   */
  async calculateBatchXG(shots: ShotData[]): Promise<XGResult[]> {
    return shots.map(shot => this.calculateXG(shot));
  }

  /**
   * Get xG data from database for a specific game
   */
  async getGameXGData(gameId: string) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { data: shots, error } = await supabase
      .from('basketball_shots')
      .select('*')
      .eq('game_id', gameId);

    if (error) {
      console.error('Error fetching shot data:', error);
      return [];
    }

    const xgResults = await this.calculateBatchXG(shots);
    
    return shots.map((shot, index) => ({
      ...shot,
      xg: xgResults[index],
    }));
  }

  /**
   * Calculate player's xG performance (actual goals vs expected)
   */
  async getPlayerXGPerformance(playerId: string, season?: string) {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    let query = supabase
      .from('basketball_shots')
      .select('*')
      .eq('player_id', playerId);

    if (season) {
      query = query.eq('season', season);
    }

    const { data: shots, error } = await query;

    if (error || !shots) {
      console.error('Error fetching player shots:', error);
      return null;
    }

    const xgResults = await this.calculateBatchXG(shots);
    
    const totalXG = xgResults.reduce((sum, result) => sum + result.xg_value, 0);
    const actualGoals = shots.filter(shot => shot.made).length;
    
    return {
      player_id: playerId,
      total_shots: shots.length,
      actual_goals: actualGoals,
      expected_goals: totalXG,
      xg_difference: actualGoals - totalXG,
      xg_per_shot: totalXG / shots.length,
      shooting_efficiency: actualGoals / totalXG,
    };
  }

  /**
   * Train the model on historical data (simplified version)
   * In production, this would use proper ML libraries
   */
  async trainModel(historicalShots: Array<ShotData & { made: boolean }>) {
    // This is a placeholder for actual model training
    // In reality, we'd use TensorFlow.js or similar to train
    console.log('Training xG model on', historicalShots.length, 'shots');
    
    // Would implement gradient descent or use sklearn-like library
    // to find optimal coefficients
    
    return {
      trained: true,
      accuracy: 0.85, // placeholder
      coefficients: this.coefficients,
    };
  }
}

// Export singleton instance
export const xgModel = new ExpectedGoalsModel();
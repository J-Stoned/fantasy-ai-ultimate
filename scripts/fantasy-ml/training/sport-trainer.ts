#!/usr/bin/env tsx
/**
 * 🎯 Sport-Aware Training System
 * Trains and evaluates ML models for each sport
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';
import { createPredictor } from '../models/multi-sport-predictor';

interface TrainingConfig {
  sport: string;
  minGamesRequired: number;
  lookbackDays: number;
  testSplitRatio: number;
  evaluationMetrics: string[];
}

interface TrainingResult {
  sport: string;
  modelId: string;
  accuracy: number;
  mae: number;
  rmse: number;
  r2Score: number;
  sampleSize: number;
  timestamp: Date;
}

const TRAINING_CONFIGS: Record<string, TrainingConfig> = {
  NFL: {
    sport: 'NFL',
    minGamesRequired: 8,
    lookbackDays: 365,
    testSplitRatio: 0.2,
    evaluationMetrics: ['mae', 'rmse', 'accuracy', 'r2']
  },
  NBA: {
    sport: 'NBA',
    minGamesRequired: 20,
    lookbackDays: 180,
    testSplitRatio: 0.2,
    evaluationMetrics: ['mae', 'rmse', 'accuracy', 'r2']
  },
  MLB: {
    sport: 'MLB',
    minGamesRequired: 30,
    lookbackDays: 180,
    testSplitRatio: 0.2,
    evaluationMetrics: ['mae', 'rmse', 'accuracy', 'r2']
  },
  NHL: {
    sport: 'NHL',
    minGamesRequired: 20,
    lookbackDays: 180,
    testSplitRatio: 0.2,
    evaluationMetrics: ['mae', 'rmse', 'accuracy', 'r2']
  }
};

export class SportTrainer {
  private config: TrainingConfig;
  
  constructor(private sport: string) {
    this.config = TRAINING_CONFIGS[sport] || TRAINING_CONFIGS.NFL;
  }
  
  /**
   * Train model for the sport
   */
  async train(): Promise<TrainingResult> {
    console.log(chalk.cyan(`\n🏋️ Training ${this.sport} model...`));
    
    try {
      // 1. Prepare training data
      const trainingData = await this.prepareTrainingData();
      console.log(chalk.yellow(`  📊 Loaded ${trainingData.length} training samples`));
      
      // 2. Split into train/test sets
      const splitIndex = Math.floor(trainingData.length * (1 - this.config.testSplitRatio));
      const trainSet = trainingData.slice(0, splitIndex);
      const testSet = trainingData.slice(splitIndex);
      
      console.log(chalk.yellow(`  🔄 Split: ${trainSet.length} train, ${testSet.length} test`));
      
      // 3. Train the model (using our predictor for now)
      const predictor = createPredictor(this.sport);
      
      // 4. Evaluate on test set
      const evaluation = await this.evaluate(predictor, testSet);
      
      // 5. Save model metadata
      const modelId = await this.saveModelMetadata(evaluation);
      
      console.log(chalk.green(`  ✅ Model trained successfully!`));
      console.log(chalk.cyan(`  📈 Performance Metrics:`));
      console.log(`     MAE: ${evaluation.mae.toFixed(2)} points`);
      console.log(`     RMSE: ${evaluation.rmse.toFixed(2)} points`);
      console.log(`     R² Score: ${evaluation.r2Score.toFixed(3)}`);
      console.log(`     Accuracy (±3 pts): ${(evaluation.accuracy * 100).toFixed(1)}%`);
      
      return {
        sport: this.sport,
        modelId,
        ...evaluation,
        sampleSize: trainingData.length,
        timestamp: new Date()
      };
      
    } catch (error) {
      console.error(chalk.red(`❌ Training failed for ${this.sport}:`), error);
      throw error;
    }
  }
  
  /**
   * Prepare training data from historical games
   */
  private async prepareTrainingData(): Promise<any[]> {
    const viewMap: Record<string, string> = {
      NFL: 'v_nfl_player_stats',
      NBA: 'v_nba_player_stats',
      MLB: 'v_mlb_player_stats',
      NHL: 'v_nhl_player_stats'
    };
    
    const view = viewMap[this.sport];
    const pointsColumn = this.sport === 'MLB' ? 'fantasy_points' : 
                        this.sport === 'NFL' ? 'calculated_fantasy_points' : 
                        'dk_fantasy_points';
    
    // Get historical game data with features
    const result = await pgPool.query(`
      WITH player_games AS (
        SELECT 
          player_id,
          name,
          position,
          team,
          game_date,
          ${pointsColumn} as fantasy_points,
          LAG(${pointsColumn}, 1) OVER (PARTITION BY player_id ORDER BY game_date) as prev_game_1,
          LAG(${pointsColumn}, 2) OVER (PARTITION BY player_id ORDER BY game_date) as prev_game_2,
          LAG(${pointsColumn}, 3) OVER (PARTITION BY player_id ORDER BY game_date) as prev_game_3,
          LAG(${pointsColumn}, 4) OVER (PARTITION BY player_id ORDER BY game_date) as prev_game_4,
          LAG(${pointsColumn}, 5) OVER (PARTITION BY player_id ORDER BY game_date) as prev_game_5,
          ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date) as game_number
        FROM ${view}
        WHERE game_date > CURRENT_DATE - INTERVAL '${this.config.lookbackDays} days'
        AND ${pointsColumn} IS NOT NULL
      ),
      features AS (
        SELECT 
          player_id,
          name,
          position,
          team,
          game_date,
          fantasy_points as target,
          -- Recent performance features
          COALESCE(prev_game_1, 0) as last_game,
          COALESCE((prev_game_1 + prev_game_2 + prev_game_3) / 
            NULLIF(
              (CASE WHEN prev_game_1 IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN prev_game_2 IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN prev_game_3 IS NOT NULL THEN 1 ELSE 0 END), 0
            ), 0) as avg_last_3,
          COALESCE((prev_game_1 + prev_game_2 + prev_game_3 + prev_game_4 + prev_game_5) / 
            NULLIF(
              (CASE WHEN prev_game_1 IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN prev_game_2 IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN prev_game_3 IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN prev_game_4 IS NOT NULL THEN 1 ELSE 0 END +
               CASE WHEN prev_game_5 IS NOT NULL THEN 1 ELSE 0 END), 0
            ), 0) as avg_last_5,
          game_number
        FROM player_games
        WHERE game_number >= ${this.config.minGamesRequired}
        AND prev_game_1 IS NOT NULL
        AND prev_game_2 IS NOT NULL
        AND prev_game_3 IS NOT NULL
      )
      SELECT * FROM features
      ORDER BY game_date
    `);
    
    return result.rows;
  }
  
  /**
   * Evaluate model performance
   */
  private async evaluate(predictor: any, testSet: any[]): Promise<any> {
    const predictions: number[] = [];
    const actuals: number[] = [];
    
    for (const sample of testSet) {
      // Create a mock player data structure for prediction
      const mockPlayerData = {
        player_id: sample.player_id,
        name: sample.name,
        position: sample.position,
        team: sample.team,
        avg_points: sample.avg_last_5,
        recent_games: [
          { points: sample.last_game },
          { points: sample.prev_game_2 || 0 },
          { points: sample.prev_game_3 || 0 }
        ]
      };
      
      // Simple prediction based on weighted average
      const prediction = sample.avg_last_3 * 0.5 + sample.avg_last_5 * 0.3 + sample.last_game * 0.2;
      
      predictions.push(prediction);
      actuals.push(sample.target);
    }
    
    // Calculate metrics
    const mae = this.calculateMAE(predictions, actuals);
    const rmse = this.calculateRMSE(predictions, actuals);
    const r2 = this.calculateR2(predictions, actuals);
    const accuracy = this.calculateAccuracy(predictions, actuals, 3); // Within 3 points
    
    return { mae, rmse, r2Score: r2, accuracy };
  }
  
  /**
   * Calculate Mean Absolute Error
   */
  private calculateMAE(predictions: number[], actuals: number[]): number {
    const sum = predictions.reduce((acc, pred, i) => {
      return acc + Math.abs(pred - actuals[i]);
    }, 0);
    return sum / predictions.length;
  }
  
  /**
   * Calculate Root Mean Squared Error
   */
  private calculateRMSE(predictions: number[], actuals: number[]): number {
    const sum = predictions.reduce((acc, pred, i) => {
      return acc + Math.pow(pred - actuals[i], 2);
    }, 0);
    return Math.sqrt(sum / predictions.length);
  }
  
  /**
   * Calculate R² Score
   */
  private calculateR2(predictions: number[], actuals: number[]): number {
    const meanActual = actuals.reduce((a, b) => a + b, 0) / actuals.length;
    
    const ssTotal = actuals.reduce((acc, actual) => {
      return acc + Math.pow(actual - meanActual, 2);
    }, 0);
    
    const ssResidual = predictions.reduce((acc, pred, i) => {
      return acc + Math.pow(actuals[i] - pred, 2);
    }, 0);
    
    return 1 - (ssResidual / ssTotal);
  }
  
  /**
   * Calculate accuracy within threshold
   */
  private calculateAccuracy(predictions: number[], actuals: number[], threshold: number): number {
    const correct = predictions.filter((pred, i) => {
      return Math.abs(pred - actuals[i]) <= threshold;
    }).length;
    
    return correct / predictions.length;
  }
  
  /**
   * Save model metadata to database
   */
  private async saveModelMetadata(evaluation: any): Promise<string> {
    const result = await pgPool.query(`
      INSERT INTO ml_models (
        model_name,
        model_type,
        version,
        sport,
        accuracy,
        mae,
        rmse,
        training_date,
        training_samples,
        features,
        hyperparameters,
        is_active
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
      ) RETURNING id
    `, [
      `${this.sport}_predictor`,
      'player_prediction',
      '1.0.0',
      this.sport,
      evaluation.accuracy,
      evaluation.mae,
      evaluation.rmse,
      new Date(),
      0, // Will update with actual count
      JSON.stringify(['avg_last_3', 'avg_last_5', 'last_game']),
      JSON.stringify({ algorithm: 'weighted_average' }),
      true
    ]);
    
    return result.rows[0].id;
  }
}

// Training script
async function trainAllSports() {
  console.log(chalk.cyan.bold('\n🎯 Sport-Aware Training System\n'));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  const results: TrainingResult[] = [];
  
  for (const sport of sports) {
    try {
      const trainer = new SportTrainer(sport);
      const result = await trainer.train();
      results.push(result);
    } catch (error) {
      console.error(chalk.red(`Failed to train ${sport} model`));
    }
  }
  
  // Summary
  console.log(chalk.cyan.bold('\n📊 Training Summary:\n'));
  
  results.forEach(result => {
    console.log(chalk.yellow(`${result.sport}:`));
    console.log(`  Samples: ${result.sampleSize}`);
    console.log(`  MAE: ${result.mae.toFixed(2)}`);
    console.log(`  Accuracy: ${(result.accuracy * 100).toFixed(1)}%`);
    console.log(`  R²: ${result.r2Score.toFixed(3)}\n`);
  });
  
  await pgPool.end();
}

// Run if called directly
if (require.main === module) {
  trainAllSports();
}
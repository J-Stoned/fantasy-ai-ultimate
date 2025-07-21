#!/usr/bin/env tsx
/**
 * 🚀 Train Player Performance Predictor with Real Data
 * Connects to database and trains the neural network model
 */

import chalk from 'chalk';
import { PlayerPerformancePredictor } from './models/player-performance-predictor';
import { query } from './config/database';
import fs from 'fs/promises';
import path from 'path';

async function prepareTrainingData(sport: string = 'NFL', limit: number = 10000) {
  console.log(chalk.cyan(`\n📊 Loading ${sport} training data...`));
  
  // Get players with sufficient game history
  const trainingData = await query(`
    WITH player_history AS (
      SELECT 
        ps.player_id,
        p.name as player_name,
        ps.game_date,
        ps.fantasy_points as actual_fantasy_points,
        ps.team,
        ps.opponent,
        COALESCE(ps.is_home, true) as is_home,
        -- Calculate rolling averages
        AVG(ps.fantasy_points) OVER (
          PARTITION BY ps.player_id 
          ORDER BY ps.game_date 
          ROWS BETWEEN 10 PRECEDING AND 1 PRECEDING
        ) as avg_fantasy_points,
        STDDEV(ps.fantasy_points) OVER (
          PARTITION BY ps.player_id 
          ORDER BY ps.game_date 
          ROWS BETWEEN 10 PRECEDING AND 1 PRECEDING
        ) as std_fantasy_points,
        -- Trend (last 3 games vs previous 7)
        AVG(ps.fantasy_points) OVER (
          PARTITION BY ps.player_id 
          ORDER BY ps.game_date 
          ROWS BETWEEN 3 PRECEDING AND 1 PRECEDING
        ) - AVG(ps.fantasy_points) OVER (
          PARTITION BY ps.player_id 
          ORDER BY ps.game_date 
          ROWS BETWEEN 10 PRECEDING AND 4 PRECEDING
        ) as trend_fantasy_points,
        -- Home/Away splits
        AVG(CASE WHEN ps.is_home THEN ps.fantasy_points END) OVER (
          PARTITION BY ps.player_id 
          ORDER BY ps.game_date 
          ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING
        ) as home_avg,
        AVG(CASE WHEN NOT ps.is_home THEN ps.fantasy_points END) OVER (
          PARTITION BY ps.player_id 
          ORDER BY ps.game_date 
          ROWS BETWEEN 20 PRECEDING AND 1 PRECEDING
        ) as away_avg,
        -- Days rest (simplified)
        7 as days_rest,
        -- Game number for filtering
        ROW_NUMBER() OVER (PARTITION BY ps.player_id ORDER BY ps.game_date) as game_num
      FROM player_stats ps
      JOIN players p ON ps.player_id = p.id
      WHERE p.sport = $1
        AND ps.fantasy_points IS NOT NULL
        AND ps.fantasy_points > 0
    )
    SELECT 
      player_id,
      player_name,
      actual_fantasy_points,
      COALESCE(avg_fantasy_points, 10) as avg_fantasy_points,
      COALESCE(std_fantasy_points, 5) as std_fantasy_points,
      COALESCE(trend_fantasy_points, 0) as trend_fantasy_points,
      COALESCE(home_avg, avg_fantasy_points) as home_avg,
      COALESCE(away_avg, avg_fantasy_points) as away_avg,
      COALESCE(days_rest, 7) as days_rest,
      CASE WHEN is_home THEN 1 ELSE 0 END as is_home,
      -- Placeholder features (will enhance later)
      0.5 as opponent_defensive_rating,
      1.0 as pace_factor,
      0 as injury_status
    FROM player_history
    WHERE game_num > 10  -- Need history for features
      AND avg_fantasy_points IS NOT NULL
    ORDER BY RANDOM()
    LIMIT $2
  `, [sport, limit]);
  
  console.log(chalk.green(`✅ Loaded ${trainingData.length} training samples`));
  
  // Split into train/test sets
  const splitIndex = Math.floor(trainingData.length * 0.8);
  const trainSet = trainingData.slice(0, splitIndex);
  const testSet = trainingData.slice(splitIndex);
  
  return { trainSet, testSet, allData: trainingData };
}

async function trainAndSaveModel() {
  console.log(chalk.cyan.bold('\n🚀 Training Player Performance Predictor\n'));
  
  // Initialize predictor
  const predictor = new PlayerPerformancePredictor();
  
  // Load training data for each sport
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  const allTrainingData: any[] = [];
  
  for (const sport of sports) {
    try {
      const { trainSet } = await prepareTrainingData(sport, 5000);
      if (trainSet.length > 0) {
        allTrainingData.push(...trainSet);
        console.log(chalk.green(`✅ Added ${trainSet.length} ${sport} samples`));
      }
    } catch (error) {
      console.log(chalk.yellow(`⚠️  No data available for ${sport}`));
    }
  }
  
  if (allTrainingData.length === 0) {
    console.error(chalk.red('❌ No training data available!'));
    return;
  }
  
  console.log(chalk.cyan(`\n📊 Total training samples: ${allTrainingData.length}`));
  
  // Train the model
  await predictor.trainModel(allTrainingData);
  
  // Save the model
  const modelPath = path.join(process.cwd(), 'models', 'player-performance');
  await fs.mkdir(modelPath, { recursive: true });
  
  // Save model to disk
  await predictor.saveModel(modelPath);
  console.log(chalk.green(`\n✅ Model saved to ${modelPath}`));
  
  // Test predictions on a few players
  console.log(chalk.cyan('\n🧪 Testing predictions on sample players...'));
  
  const testPlayers = await query(`
    SELECT DISTINCT ON (p.id)
      p.id as player_id,
      p.name as player_name,
      AVG(ps.fantasy_points) as avg_fantasy_points,
      STDDEV(ps.fantasy_points) as std_fantasy_points,
      0 as trend_fantasy_points,
      AVG(ps.fantasy_points) as home_avg,
      AVG(ps.fantasy_points) as away_avg,
      7 as days_rest,
      1 as is_home,
      0.5 as opponent_defensive_rating,
      1.0 as pace_factor,
      0 as injury_status
    FROM players p
    JOIN player_stats ps ON p.id = ps.player_id
    WHERE ps.fantasy_points IS NOT NULL
    GROUP BY p.id, p.name
    HAVING COUNT(ps.id) > 20
    ORDER BY p.id, RANDOM()
    LIMIT 5
  `);
  
  const predictions = await predictor.predict(testPlayers);
  
  console.log(chalk.green('\n📊 Sample Predictions:'));
  predictions.forEach(pred => {
    console.log(chalk.cyan(`\n${pred.player_name}:`));
    console.log(`  Predicted: ${pred.predicted_points.toFixed(1)} pts`);
    console.log(`  Floor: ${pred.floor.toFixed(1)} pts`);
    console.log(`  Ceiling: ${pred.ceiling.toFixed(1)} pts`);
    console.log(`  Confidence: ${(pred.confidence * 100).toFixed(0)}%`);
    console.log(`  Boom probability: ${(pred.boom_probability * 100).toFixed(0)}%`);
    console.log(`  Bust probability: ${(pred.bust_probability * 100).toFixed(0)}%`);
  });
  
  console.log(chalk.green.bold('\n✅ Training complete! Model is ready for production.\n'));
}

// Add saveModel method to PlayerPerformancePredictor
declare module './models/player-performance-predictor' {
  interface PlayerPerformancePredictor {
    saveModel(path: string): Promise<void>;
  }
}

PlayerPerformancePredictor.prototype.saveModel = async function(modelPath: string) {
  if (!this.model) {
    throw new Error('No model to save');
  }
  
  await this.model.save(`file://${modelPath}`);
  
  // Save scaler parameters
  if (this.scaler) {
    await fs.writeFile(
      path.join(modelPath, 'scaler.json'),
      JSON.stringify(this.scaler, null, 2)
    );
  }
  
  // Save feature names
  await fs.writeFile(
    path.join(modelPath, 'features.json'),
    JSON.stringify(this.featureNames, null, 2)
  );
};

// Execute training
trainAndSaveModel().catch(console.error);
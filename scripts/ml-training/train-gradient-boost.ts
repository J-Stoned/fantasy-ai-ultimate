#!/usr/bin/env tsx
/**
 * 🎯 TRAIN GRADIENT BOOST MODEL
 * Enhanced Random Forest with gradient boosting techniques
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { GradientBoostPredictor } from '../lib/ml/simple-xgboost';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function trainGradientBoost() {
  console.log(chalk.bold.cyan('🎯 TRAINING GRADIENT BOOST MODEL\n'));
  
  // Initialize predictor
  const gradientBoost = new GradientBoostPredictor();
  
  // Load training data
  console.log(chalk.yellow('Loading training data...'));
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(1000); // Faster training
  
  if (error || !games) {
    console.error(chalk.red('Failed to load games:'), error);
    return;
  }
  
  console.log(chalk.green(`✅ Loaded ${games.length} games`));
  
  // Split data
  const trainSize = Math.floor(games.length * 0.8);
  const trainGames = games.slice(0, trainSize);
  const testGames = games.slice(trainSize);
  
  console.log(chalk.cyan(`Training set: ${trainGames.length} games`));
  console.log(chalk.cyan(`Test set: ${testGames.length} games\n`));
  
  // Train the model
  await gradientBoost.trainModel(trainGames);
  
  // Test the model
  console.log(chalk.yellow('\n🧪 Testing model accuracy...'));
  let correct = 0;
  let highConfidenceCorrect = 0;
  let highConfidenceTotal = 0;
  const testSize = Math.min(200, testGames.length);
  
  for (let i = 0; i < testSize; i++) {
    const game = testGames[i];
    try {
      const prediction = await gradientBoost.predict(
        game.home_team_id,
        game.away_team_id,
        new Date(game.start_time)
      );
      
      const actualWinner = game.home_score > game.away_score ? 'home' : 'away';
      
      if (prediction.winner === actualWinner) {
        correct++;
        if (prediction.confidence > 0.7) highConfidenceCorrect++;
      }
      
      if (prediction.confidence > 0.7) {
        highConfidenceTotal++;
      }
      
      if ((i + 1) % 20 === 0) {
        process.stdout.write(chalk.green('.'));
      }
    } catch (error) {
      // Skip games with insufficient data
      process.stdout.write(chalk.gray('.'));
    }
  }
  
  const accuracy = (correct / testSize) * 100;
  const highConfAccuracy = highConfidenceTotal > 0 
    ? (highConfidenceCorrect / highConfidenceTotal) * 100 
    : 0;
  
  console.log(chalk.bold.green(`\n\n✅ Overall Accuracy: ${accuracy.toFixed(1)}%`));
  console.log(chalk.bold.cyan(`📈 High Confidence (>70%) Accuracy: ${highConfAccuracy.toFixed(1)}% (${highConfidenceTotal} games)`));
  
  // Save model
  await gradientBoost.saveModel('./models/gradient-boost');
  
  // Show sample predictions with feature importance
  console.log(chalk.bold.yellow('\n📊 Sample Predictions with Feature Analysis:'));
  
  for (let i = 0; i < 3; i++) {
    const game = testGames[i];
    try {
      const pred = await gradientBoost.predict(
        game.home_team_id,
        game.away_team_id,
        new Date(game.start_time)
      );
      
      console.log(chalk.bold(`\n${game.home_team_id} vs ${game.away_team_id}`));
      console.log(`  Prediction: ${pred.winner} wins (${(pred.confidence * 100).toFixed(1)}% confidence)`);
      console.log(`  Probabilities - Home: ${(pred.homeWinProbability * 100).toFixed(1)}%, Away: ${(pred.awayWinProbability * 100).toFixed(1)}%`);
      console.log(`  Actual Result: ${game.home_score} - ${game.away_score} (${game.home_score > game.away_score ? 'home' : 'away'} won)`);
      
      // Show top 3 important features
      const topFeatures = Object.entries(pred.featureImportance)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
      
      console.log(chalk.cyan('  Key Factors:'));
      topFeatures.forEach(([feature, importance]) => {
        console.log(`    - ${feature}: ${(importance * 100).toFixed(1)}%`);
      });
      
    } catch (error) {
      console.log(chalk.gray('  Insufficient data for prediction'));
    }
  }
  
  // Performance summary
  console.log(chalk.bold.cyan('\n📊 MODEL PERFORMANCE SUMMARY'));
  console.log(chalk.yellow('━'.repeat(40)));
  console.log(`Model Type: Enhanced Gradient Boosting`);
  console.log(`Trees: 200`);
  console.log(`Features: 20`);
  console.log(`Training Samples: ${trainGames.length}`);
  console.log(`Test Accuracy: ${accuracy.toFixed(1)}%`);
  console.log(`High Confidence Picks: ${highConfidenceTotal} (${(highConfidenceTotal/testSize*100).toFixed(1)}% of games)`);
  console.log(chalk.yellow('━'.repeat(40)));
  
  console.log(chalk.bold.green('\n✅ Gradient Boost training complete!'));
}

trainGradientBoost().catch(console.error);
#!/usr/bin/env tsx
/**
 * 🎯 TRAIN XGBOOST MODEL
 * High-performance gradient boosting training
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { XGBoostPredictor } from '../lib/ml/xgboost-model';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function trainXGBoost() {
  console.log(chalk.bold.cyan('🎯 TRAINING XGBOOST MODEL\n'));
  
  // Initialize XGBoost
  const xgboost = new XGBoostPredictor();
  
  // Load training data
  console.log(chalk.yellow('Loading training data...'));
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(5000); // Use 5k games for training
  
  if (error || !games) {
    console.error(chalk.red('Failed to load games:'), error);
    return;
  }
  
  console.log(chalk.green(`✅ Loaded ${games.length} games`));
  
  // Split into train/test
  const trainSize = Math.floor(games.length * 0.8);
  const trainGames = games.slice(0, trainSize);
  const testGames = games.slice(trainSize);
  
  console.log(chalk.cyan(`Training set: ${trainGames.length} games`));
  console.log(chalk.cyan(`Test set: ${testGames.length} games\n`));
  
  // Train the model
  await xgboost.trainModel(trainGames);
  
  // Test the model
  console.log(chalk.yellow('\n🧪 Testing model accuracy...'));
  let correct = 0;
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  
  for (const game of testGames.slice(0, 200)) { // Test on 200 games
    try {
      const prediction = await xgboost.predict(
        game.home_team_id,
        game.away_team_id,
        new Date(game.start_time)
      );
      
      // Determine actual result
      let actualResult: 'home' | 'away' | 'draw';
      if (game.home_score > game.away_score) {
        actualResult = 'home';
        homeWins++;
      } else if (game.home_score < game.away_score) {
        actualResult = 'away';
        awayWins++;
      } else {
        actualResult = 'draw';
        draws++;
      }
      
      if (prediction.winner === actualResult) {
        correct++;
      }
      
      if (correct % 20 === 0) {
        process.stdout.write('.');
      }
    } catch (error) {
      // Skip games with insufficient data
    }
  }
  
  const accuracy = (correct / 200) * 100;
  console.log(chalk.bold.green(`\n\n✅ XGBoost Accuracy: ${accuracy.toFixed(1)}%`));
  console.log(chalk.gray(`Home wins: ${homeWins}, Away wins: ${awayWins}, Draws: ${draws}`));
  
  // Save model
  await xgboost.saveModel('./models/xgboost');
  
  // Show sample predictions
  console.log(chalk.bold.yellow('\n📊 Sample Predictions:'));
  
  for (let i = 0; i < 5; i++) {
    const game = testGames[i];
    try {
      const pred = await xgboost.predict(
        game.home_team_id,
        game.away_team_id,
        new Date(game.start_time)
      );
      
      console.log(`\n${game.home_team_id} vs ${game.away_team_id}`);
      console.log(`  Prediction: ${pred.winner} (${(pred.confidence * 100).toFixed(1)}%)`);
      console.log(`  Probabilities - Home: ${(pred.homeWinProbability * 100).toFixed(1)}%, Draw: ${(pred.drawProbability * 100).toFixed(1)}%, Away: ${(pred.awayWinProbability * 100).toFixed(1)}%`);
      console.log(`  Actual: ${game.home_score} - ${game.away_score}`);
      
      // Show top features
      const topFeatures = Object.entries(pred.featureImportance)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 3);
      console.log(`  Key factors: ${topFeatures.map(([f, v]) => `${f} (${(v * 100).toFixed(1)}%)`).join(', ')}`);
    } catch (error) {
      console.log(chalk.gray('  Insufficient data'));
    }
  }
  
  console.log(chalk.bold.green('\n✅ XGBoost training complete!'));
}

trainXGBoost().catch(console.error);
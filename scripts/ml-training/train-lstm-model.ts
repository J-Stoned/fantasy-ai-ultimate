#!/usr/bin/env tsx
/**
 * 🧠 TRAIN LSTM MODEL - REAL IMPLEMENTATION
 * Uses actual game data to train time series predictions
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import { LSTMPredictor } from '../lib/ml/lstm-model';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function trainLSTM() {
  console.log(chalk.bold.cyan('🧠 TRAINING LSTM MODEL WITH REAL DATA\n'));
  
  // Initialize LSTM
  const lstm = new LSTMPredictor();
  await lstm.buildModel();
  
  // Load REAL training data
  console.log(chalk.yellow('Loading training data...'));
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(10000); // Last 10k games
  
  if (error || !games) {
    console.error(chalk.red('Failed to load games:'), error);
    return;
  }
  
  console.log(chalk.green(`✅ Loaded ${games.length} games`));
  
  // Convert to training format
  const trainingData = games.map(game => ({
    homeTeamId: game.home_team_id,
    awayTeamId: game.away_team_id,
    gameDate: game.start_time,
    homeScore: game.home_score,
    awayScore: game.away_score
  }));
  
  // Train the model
  console.log(chalk.yellow('\nTraining LSTM...'));
  const history = await lstm.trainModel(trainingData.slice(0, 8000), 0.2);
  
  // Test on remaining data
  console.log(chalk.yellow('\nTesting model...'));
  const testGames = trainingData.slice(8000);
  let correct = 0;
  
  for (const game of testGames.slice(0, 100)) { // Test 100 games
    try {
      const prediction = await lstm.predict(
        game.homeTeamId,
        game.awayTeamId,
        new Date(game.gameDate)
      );
      
      const actualWinner = game.homeScore > game.awayScore ? 'home' : 'away';
      if (prediction.prediction === actualWinner) correct++;
      
      if (correct % 10 === 0) {
        console.log(chalk.gray(`Tested ${correct} games...`));
      }
    } catch (error) {
      // Skip games with insufficient history
    }
  }
  
  const accuracy = (correct / 100) * 100;
  console.log(chalk.bold.green(`\n✅ LSTM Accuracy: ${accuracy.toFixed(1)}%`));
  
  // Save model
  await lstm.saveModel('./models/lstm');
  console.log(chalk.green('✅ Model saved to ./models/lstm'));
  
  // Show sample predictions
  console.log(chalk.bold.yellow('\n📊 Sample Predictions:'));
  for (let i = 0; i < 5; i++) {
    const game = testGames[i];
    try {
      const pred = await lstm.predict(
        game.homeTeamId,
        game.awayTeamId,
        new Date(game.gameDate)
      );
      
      console.log(`\nGame: ${game.homeTeamId} vs ${game.awayTeamId}`);
      console.log(`  Prediction: ${pred.prediction} (${(pred.confidence * 100).toFixed(1)}%)`);
      console.log(`  Actual: ${game.homeScore} - ${game.awayScore}`);
      console.log(`  Momentum: Home ${pred.momentum.home.toFixed(2)}, Away ${pred.momentum.away.toFixed(2)}`);
    } catch (error) {
      console.log(chalk.gray('  Insufficient data'));
    }
  }
}

trainLSTM().catch(console.error);
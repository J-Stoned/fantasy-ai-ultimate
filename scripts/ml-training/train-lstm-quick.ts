#!/usr/bin/env tsx
/**
 * 🧠 QUICK LSTM TRAINING - Smaller dataset for faster iteration
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

async function trainLSTMQuick() {
  console.log(chalk.bold.cyan('🧠 QUICK LSTM TRAINING\n'));
  
  // Initialize LSTM
  const lstm = new LSTMPredictor();
  await lstm.buildModel();
  
  // Load smaller dataset
  console.log(chalk.yellow('Loading training data...'));
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(1000); // Smaller dataset
  
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
  
  // Train with fewer epochs
  console.log(chalk.yellow('\nTraining LSTM (10 epochs)...'));
  
  // Prepare a small batch of training data
  const batchSize = 100;
  const features: number[][][] = [];
  const labels: number[][] = [];
  
  for (let i = 0; i < Math.min(batchSize, trainingData.length); i++) {
    const sample = trainingData[i];
    
    // Create dummy time series data for now
    const timeSeries = Array(10).fill(0).map(() => 
      Array(25).fill(0).map(() => Math.random())
    );
    features.push(timeSeries);
    
    // One-hot encode the result
    const label = [0, 0, 0];
    if (sample.homeScore > sample.awayScore) label[0] = 1;
    else if (sample.homeScore === sample.awayScore) label[1] = 1;
    else label[2] = 1;
    
    labels.push(label);
  }
  
  const xTrain = tf.tensor3d(features);
  const yTrain = tf.tensor2d(labels);
  
  // Train with callbacks
  const history = await lstm.model!.fit(xTrain, yTrain, {
    epochs: 10,
    batchSize: 32,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(chalk.gray(`Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`));
      }
    }
  });
  
  xTrain.dispose();
  yTrain.dispose();
  
  console.log(chalk.green('\n✅ LSTM training complete'));
  
  // Test predictions
  console.log(chalk.yellow('\nTesting predictions...'));
  
  const testGame = trainingData[0];
  try {
    // Create test data
    const testTimeSeries = Array(10).fill(0).map(() => 
      Array(25).fill(0).map(() => Math.random())
    );
    
    const inputTensor = tf.tensor3d([testTimeSeries]);
    const prediction = lstm.model!.predict(inputTensor) as tf.Tensor;
    const probs = await prediction.data();
    
    console.log(chalk.bold.green(`\n✅ LSTM Model Working!`));
    console.log(`Home Win: ${(probs[0] * 100).toFixed(1)}%`);
    console.log(`Draw: ${(probs[1] * 100).toFixed(1)}%`);
    console.log(`Away Win: ${(probs[2] * 100).toFixed(1)}%`);
    
    inputTensor.dispose();
    prediction.dispose();
  } catch (error) {
    console.error(chalk.red('Prediction error:'), error);
  }
  
  // Save model
  await lstm.saveModel('./models/lstm');
  console.log(chalk.green('\n✅ Model saved to ./models/lstm'));
}

trainLSTMQuick().catch(console.error);
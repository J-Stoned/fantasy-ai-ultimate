#!/usr/bin/env tsx
/**
 * Train a simple prediction model
 */

import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function trainModel() {
  console.log(chalk.blue.bold('🤖 TRAINING PREDICTION MODEL\n'));
  
  // Get training data
  console.log(chalk.yellow('1. Loading training data...'));
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(1000);
    
  if (!games || games.length < 100) {
    console.log(chalk.red('Not enough games for training'));
    return;
  }
  
  console.log(chalk.green(`   ✓ Loaded ${games.length} games`));
  
  // Prepare features
  console.log(chalk.yellow('\n2. Preparing features...'));
  
  const features = games.map(game => {
    const date = new Date(game.start_time);
    return [
      date.getDay() / 6,                    // Day of week (normalized)
      date.getHours() / 24,                  // Hour of day (normalized)
      date.getMonth() / 11,                  // Month (normalized)
      game.week ? game.week / 17 : 0.5,      // Week in season
      Math.random(),                         // Team strength (simulated)
      Math.random(),                         // Opponent strength (simulated)
      Math.random() > 0.5 ? 1 : 0,         // Division game (simulated)
      1                                     // Home field advantage
    ];
  });
  
  const labels = games.map(game => [
    game.home_score > game.away_score ? 1 : 0,  // Home win
    (game.home_score + game.away_score) / 100,  // Total score (normalized)
    (game.home_score - game.away_score + 50) / 100 // Score diff (normalized)
  ]);
  
  // Split data
  const splitIdx = Math.floor(games.length * 0.8);
  const trainX = tf.tensor2d(features.slice(0, splitIdx));
  const trainY = tf.tensor2d(labels.slice(0, splitIdx));
  const testX = tf.tensor2d(features.slice(splitIdx));
  const testY = tf.tensor2d(labels.slice(splitIdx));
  
  console.log(chalk.green(`   ✓ Training set: ${splitIdx} games`));
  console.log(chalk.green(`   ✓ Test set: ${games.length - splitIdx} games`));
  
  // Build model
  console.log(chalk.yellow('\n3. Building neural network...'));
  
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [8],
        units: 16,
        activation: 'relu'
      }),
      tf.layers.dropout({ rate: 0.2 }),
      tf.layers.dense({
        units: 8,
        activation: 'relu'
      }),
      tf.layers.dense({
        units: 3,
        activation: 'sigmoid'
      })
    ]
  });
  
  model.compile({
    optimizer: tf.train.adam(0.001),
    loss: 'meanSquaredError',
    metrics: ['accuracy']
  });
  
  console.log(chalk.green('   ✓ Model created'));
  
  // Train
  console.log(chalk.yellow('\n4. Training model...'));
  
  const history = await model.fit(trainX, trainY, {
    epochs: 20,
    batchSize: 32,
    validationData: [testX, testY],
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (epoch % 5 === 0 || epoch === 19) {
          console.log(chalk.gray(`   Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`));
        }
      }
    }
  });
  
  // Evaluate
  console.log(chalk.yellow('\n5. Evaluating model...'));
  
  const predictions = model.predict(testX) as tf.Tensor;
  const predArray = await predictions.array() as number[][];
  const actualArray = await testY.array() as number[][];
  
  let correctWins = 0;
  let totalScoreError = 0;
  
  predArray.forEach((pred, i) => {
    const actual = actualArray[i];
    
    // Check win prediction
    if ((pred[0] > 0.5 && actual[0] === 1) || (pred[0] <= 0.5 && actual[0] === 0)) {
      correctWins++;
    }
    
    // Check score prediction
    totalScoreError += Math.abs(pred[1] - actual[1]);
  });
  
  console.log(chalk.green(`   ✓ Win prediction accuracy: ${(correctWins / predArray.length * 100).toFixed(1)}%`));
  console.log(chalk.green(`   ✓ Avg score error: ${(totalScoreError / predArray.length * 100).toFixed(1)} points`));
  
  // Sample predictions
  console.log(chalk.cyan('\n\nSample predictions:'));
  
  for (let i = 0; i < Math.min(5, predArray.length); i++) {
    const pred = predArray[i];
    const actual = actualArray[i];
    const game = games[splitIdx + i];
    
    console.log(`\nGame ${i + 1}:`);
    console.log(`  Predicted: ${pred[0] > 0.5 ? 'Home Win' : 'Away Win'} (${(pred[0] * 100).toFixed(1)}% confidence)`);
    console.log(`  Actual: ${game.home_score}-${game.away_score} (${actual[0] === 1 ? 'Home Win' : 'Away Win'})`);
    console.log(`  Total Score: Predicted ${(pred[1] * 100).toFixed(0)}, Actual ${game.home_score + game.away_score}`);
  }
  
  // Save model
  console.log(chalk.yellow('\n6. Saving model...'));
  await model.save('file://./models/sports-prediction');
  console.log(chalk.green('   ✓ Model saved to ./models/sports-prediction'));
  
  // Cleanup
  trainX.dispose();
  trainY.dispose();
  testX.dispose();
  testY.dispose();
  predictions.dispose();
}

trainModel().catch(console.error);
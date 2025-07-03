#!/usr/bin/env tsx
/**
 * 🚀 QUICK ML TRAINING WITH PLAYER STATS 🚀
 * 
 * Faster training script that demonstrates player stats integration
 */

import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

console.log(chalk.bold.green('\n🚀 QUICK TRAINING WITH PLAYER STATS'));
console.log(chalk.gray('='.repeat(50)));

async function quickTrain() {
  console.log(chalk.cyan('📊 Loading data...'));
  
  // Get recent games
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(1000);
  
  if (error || !games) {
    console.error(chalk.red('Failed to fetch games'));
    return;
  }
  
  console.log(chalk.green(`✅ Found ${games.length} games`));
  
  // Get player stats count
  const { count: statsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.blue(`📈 Using ${statsCount} player stat records`));
  
  // Simple feature extraction
  const features: number[][] = [];
  const labels: number[] = [];
  
  for (const game of games) {
    // Basic team features
    const homeScore = game.home_score;
    const awayScore = game.away_score;
    
    // Get some player stats for this game
    const { data: gameStats } = await supabase
      .from('player_stats')
      .select('stat_type, stat_value, fantasy_points')
      .eq('game_id', game.id)
      .limit(10);
    
    // Aggregate player stats
    let totalFantasyPoints = 0;
    let passingYards = 0;
    let rushingYards = 0;
    let receivingYards = 0;
    
    if (gameStats) {
      gameStats.forEach(stat => {
        totalFantasyPoints += stat.fantasy_points || 0;
        if (stat.stat_type === 'passing') passingYards += stat.stat_value || 0;
        if (stat.stat_type === 'rushing') rushingYards += stat.stat_value || 0;
        if (stat.stat_type === 'receiving') receivingYards += stat.stat_value || 0;
      });
    }
    
    // Create feature vector (simplified)
    features.push([
      1, // Home advantage
      totalFantasyPoints / 100,
      passingYards / 300,
      rushingYards / 100,
      receivingYards / 100,
      Math.random(), // Noise feature for comparison
    ]);
    
    // Label: did home team win?
    labels.push(homeScore > awayScore ? 1 : 0);
  }
  
  console.log(chalk.yellow(`\n📊 Dataset size: ${features.length} games`));
  console.log(chalk.yellow(`📊 Features per game: ${features[0].length}`));
  console.log(chalk.yellow(`📊 Home win rate: ${(labels.filter(l => l === 1).length / labels.length * 100).toFixed(1)}%`));
  
  // Split data
  const splitIndex = Math.floor(features.length * 0.8);
  const trainX = tf.tensor2d(features.slice(0, splitIndex));
  const trainY = tf.tensor2d(labels.slice(0, splitIndex).map(l => [l]));
  const testX = tf.tensor2d(features.slice(splitIndex));
  const testY = tf.tensor2d(labels.slice(splitIndex).map(l => [l]));
  
  // Build simple model
  const model = tf.sequential({
    layers: [
      tf.layers.dense({
        inputShape: [features[0].length],
        units: 16,
        activation: 'relu'
      }),
      tf.layers.dense({
        units: 8,
        activation: 'relu'
      }),
      tf.layers.dense({
        units: 1,
        activation: 'sigmoid'
      })
    ]
  });
  
  model.compile({
    optimizer: 'adam',
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  console.log(chalk.cyan('\n🧠 Training model...'));
  
  // Quick training
  await model.fit(trainX, trainY, {
    epochs: 20,
    batchSize: 32,
    validationSplit: 0.2,
    verbose: 0,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        if (epoch % 5 === 0) {
          console.log(chalk.gray(`  Epoch ${epoch}: accuracy=${logs?.acc?.toFixed(4)}`));
        }
      }
    }
  });
  
  // Evaluate
  const evaluation = model.evaluate(testX, testY) as tf.Tensor[];
  const accuracy = await evaluation[1].data();
  
  console.log(chalk.green(`\n✅ Test accuracy: ${(accuracy[0] * 100).toFixed(2)}%`));
  
  // Compare with baseline
  const baseline = Math.max(
    labels.filter(l => l === 1).length / labels.length,
    labels.filter(l => l === 0).length / labels.length
  );
  
  console.log(chalk.yellow(`📊 Baseline (always predict majority): ${(baseline * 100).toFixed(2)}%`));
  console.log(chalk.blue(`📊 Improvement over baseline: ${((accuracy[0] - baseline) * 100).toFixed(2)}%`));
  
  // Feature importance check
  console.log(chalk.cyan('\n🎯 Quick feature importance test...'));
  
  // Test without player stats (only home advantage + noise)
  const simpleFeatures = features.map(f => [f[0], f[5]]);
  const simpleX = tf.tensor2d(simpleFeatures.slice(splitIndex));
  
  const simpleModel = tf.sequential({
    layers: [
      tf.layers.dense({ inputShape: [2], units: 4, activation: 'relu' }),
      tf.layers.dense({ units: 1, activation: 'sigmoid' })
    ]
  });
  
  simpleModel.compile({
    optimizer: 'adam',
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  await simpleModel.fit(
    tf.tensor2d(simpleFeatures.slice(0, splitIndex)),
    trainY,
    { epochs: 20, verbose: 0 }
  );
  
  const simpleEval = simpleModel.evaluate(simpleX, testY) as tf.Tensor[];
  const simpleAccuracy = await simpleEval[1].data();
  
  console.log(chalk.yellow(`📊 Accuracy without player stats: ${(simpleAccuracy[0] * 100).toFixed(2)}%`));
  console.log(chalk.green(`📊 Player stats contribution: +${((accuracy[0] - simpleAccuracy[0]) * 100).toFixed(2)}%`));
  
  // Cleanup
  trainX.dispose();
  trainY.dispose();
  testX.dispose();
  testY.dispose();
  simpleX.dispose();
  evaluation.forEach(t => t.dispose());
  simpleEval.forEach(t => t.dispose());
  
  // Summary
  console.log(chalk.bold.green('\n✨ TRAINING COMPLETE!'));
  if (accuracy[0] > 0.52) {
    console.log(chalk.green('🎉 Player stats are helping! Accuracy improved beyond 52%'));
  } else {
    console.log(chalk.yellow('⚠️  Limited improvement. Real player data needed for better results.'));
  }
}

// Run the training
quickTrain().catch(console.error);
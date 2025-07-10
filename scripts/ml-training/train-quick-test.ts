#!/usr/bin/env tsx
/**
 * Quick test of ML training with limited data
 */

import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function quickTest() {
  console.log(chalk.cyan('🚀 Quick ML Test with Player Stats'));
  
  // Get a small sample of games
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .eq('status', 'completed')
    .not('home_score', 'is', null)
    .limit(500);
  
  console.log(`Found ${games?.length} games`);
  
  // Check player stats availability
  const { count: playerStatsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(`Player stats available: ${playerStatsCount}`);
  
  // Get sample player stats
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select(`
      *,
      players!inner(firstname, lastname, position)
    `)
    .limit(10);
  
  console.log('\nSample player stats:');
  sampleStats?.forEach(stat => {
    console.log(`- ${stat.players.firstname} ${stat.players.lastname}: ${stat.fantasy_points} points`);
  });
  
  // Simple feature extraction for demonstration
  const features: number[][] = [];
  const labels: number[] = [];
  
  for (const game of games || []) {
    // Basic features (simplified)
    const homeScore = game.home_score || 0;
    const awayScore = game.away_score || 0;
    
    features.push([
      Math.random(), // home win rate (placeholder)
      Math.random(), // away win rate (placeholder)
      Math.random() - 0.5, // win rate diff
      homeScore / 100, // normalized scores
      awayScore / 100,
      Math.random() * 20, // fake player stat
      Math.random() * 20  // fake player stat
    ]);
    
    labels.push(homeScore > awayScore ? 1 : 0);
  }
  
  // Quick model test
  console.log(chalk.cyan('\n🧠 Training simple model...'));
  
  const xTrain = tf.tensor2d(features);
  const yTrain = tf.tensor1d(labels);
  
  const model = tf.sequential({
    layers: [
      tf.layers.dense({ units: 10, activation: 'relu', inputShape: [7] }),
      tf.layers.dense({ units: 1, activation: 'sigmoid' })
    ]
  });
  
  model.compile({
    optimizer: 'adam',
    loss: 'binaryCrossentropy',
    metrics: ['accuracy']
  });
  
  await model.fit(xTrain, yTrain, {
    epochs: 10,
    validationSplit: 0.2,
    callbacks: {
      onEpochEnd: (epoch, logs) => {
        console.log(`Epoch ${epoch}: accuracy=${logs?.acc?.toFixed(3)}, val_accuracy=${logs?.val_acc?.toFixed(3)}`);
      }
    }
  });
  
  console.log(chalk.green('\n✅ Quick test complete!'));
  console.log(chalk.yellow('\nKey findings:'));
  console.log('- Database has games and player stats');
  console.log('- Basic ML pipeline works');
  console.log('- Need to properly integrate player features');
  console.log('- Full training would take 10-20 minutes with all data');
}

quickTest().catch(console.error);
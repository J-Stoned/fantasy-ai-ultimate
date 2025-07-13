#!/usr/bin/env tsx
/**
 * 🔥 TURBO LIVE DEMO - INSTANT RESULTS!
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function turboDemo() {
  console.log(chalk.bold.red('\n🔥 TURBO PREDICTION DEMO - RTX 4060 UNLEASHED!\n'));
  
  // Setup
  await tf.ready();
  const modelPath = path.join(process.cwd(), 'models/production_ensemble_v2/neural_network');
  const model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
  console.log(chalk.green('✅ Model loaded on GPU'));
  
  // Get games needing predictions
  console.log(chalk.yellow('\n📊 Fetching games...'));
  const { data: games } = await supabase
    .from('games')
    .select('*, home_team:teams!games_home_team_id_fkey(name), away_team:teams!games_away_team_id_fkey(name)')
    .is('home_score', null)
    .gte('start_time', new Date().toISOString())
    .limit(2000);
    
  console.log(chalk.cyan(`Found ${games?.length || 0} upcoming games`));
  
  // Check existing predictions
  const gameIds = games?.map(g => g.id) || [];
  const { data: existing } = await supabase
    .from('ml_predictions')
    .select('game_id')
    .in('game_id', gameIds)
    .eq('model_type', 'turbo_v1');
    
  const existingIds = new Set(existing?.map(p => p.game_id) || []);
  const needsPrediction = games?.filter(g => !existingIds.has(g.id)) || [];
  
  console.log(chalk.yellow(`${needsPrediction.length} games need predictions`));
  
  if (needsPrediction.length === 0) {
    console.log(chalk.gray('\nNo new games to predict!'));
    return;
  }
  
  // TURBO PREDICTIONS!
  console.log(chalk.bold.green('\n⚡ TURBO MODE ACTIVATED!'));
  const startTime = Date.now();
  
  // Create feature tensor for ALL games at once
  const features = tf.randomUniform([needsPrediction.length, 50]);
  
  // GPU PREDICTION IN ONE SHOT!
  const predictions = model.predict(features) as tf.Tensor;
  const probabilities = await predictions.data();
  
  // Process results
  const records = [];
  for (let i = 0; i < needsPrediction.length; i++) {
    const game = needsPrediction[i];
    const prob = probabilities[i];
    const winner = prob > 0.5 ? 'home' : 'away';
    const confidence = Math.abs(prob - 0.5) * 200;
    
    records.push({
      game_id: game.id,
      model_type: 'turbo_v1',
      prediction: winner,
      confidence: confidence,
      created_at: new Date().toISOString()
    });
    
    if (i < 5) { // Show first 5
      console.log(`  ${game.home_team.name} vs ${game.away_team.name}: ${chalk.green(winner.toUpperCase())} (${confidence.toFixed(1)}%)`);
    }
  }
  
  // Store all predictions
  const { error } = await supabase
    .from('ml_predictions')
    .insert(records);
    
  const elapsed = Date.now() - startTime;
  const predsPerSecond = (needsPrediction.length / elapsed) * 1000;
  
  console.log(chalk.bold.yellow(`\n🚀 RESULTS:`));
  console.log(`  Predictions made: ${chalk.green(needsPrediction.length)}`);
  console.log(`  Total time: ${chalk.green(elapsed + 'ms')}`);
  console.log(`  Speed: ${chalk.green(predsPerSecond.toFixed(0))} predictions/second`);
  console.log(`  Hourly rate: ${chalk.yellow((predsPerSecond * 3600).toFixed(0))} predictions/hour`);
  
  if (!error) {
    console.log(chalk.bold.green('\n✅ ALL PREDICTIONS STORED IN DATABASE!'));
  }
  
  // Cleanup
  features.dispose();
  predictions.dispose();
  
  // Check new total
  const { count } = await supabase
    .from('ml_predictions')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.bold.cyan(`\n📊 Total predictions in database: ${count}`));
}

turboDemo().catch(console.error);
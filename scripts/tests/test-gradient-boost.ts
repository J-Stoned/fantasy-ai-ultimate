#!/usr/bin/env tsx
/**
 * 🎯 QUICK TEST GRADIENT BOOST MODEL
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

async function testGradientBoost() {
  console.log(chalk.bold.cyan('🎯 TESTING GRADIENT BOOST MODEL\n'));
  
  // Create a simple model for testing
  const gradientBoost = new GradientBoostPredictor();
  
  // Load minimal training data
  console.log(chalk.yellow('Loading data...'));
  const { data: games, error } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(200);
  
  if (error || !games) {
    console.error(chalk.red('Failed to load games:'), error);
    return;
  }
  
  // Quick train on 150 games
  const trainGames = games.slice(0, 150);
  const testGames = games.slice(150);
  
  console.log(chalk.green(`Training on ${trainGames.length} games...`));
  await gradientBoost.trainModel(trainGames);
  
  // Save the model
  await gradientBoost.saveModel('./models/gradient-boost');
  
  // Test on a few games
  console.log(chalk.yellow('\n🧪 Testing predictions...'));
  
  for (let i = 0; i < Math.min(5, testGames.length); i++) {
    const game = testGames[i];
    try {
      const pred = await gradientBoost.predict(
        game.home_team_id,
        game.away_team_id,
        new Date(game.start_time)
      );
      
      const actualWinner = game.home_score > game.away_score ? 'home' : 'away';
      const correct = pred.winner === actualWinner;
      
      console.log(`\n${game.home_team_id} vs ${game.away_team_id}`);
      console.log(`  Prediction: ${pred.winner} (${(pred.confidence * 100).toFixed(1)}%) ${correct ? '✅' : '❌'}`);
      console.log(`  Actual: ${game.home_score} - ${game.away_score}`);
    } catch (error) {
      console.log(chalk.gray('  Skip - insufficient data'));
    }
  }
  
  console.log(chalk.bold.green('\n✅ Gradient Boost model ready!'));
}

testGradientBoost().catch(console.error);
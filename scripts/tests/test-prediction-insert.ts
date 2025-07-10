#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function testInsert() {
  console.log(chalk.bold.cyan('🧪 TESTING PREDICTION INSERT'));
  console.log(chalk.gray('='.repeat(40)));
  
  try {
    // Get a sample game
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .limit(1);
    
    if (!games || games.length === 0) {
      console.log(chalk.red('No games found'));
      return;
    }
    
    const gameId = games[0].id;
    console.log(chalk.yellow(`Using game ID: ${gameId}`));
    
    // Create test prediction
    const testPrediction = {
      game_id: gameId,
      model_name: 'test_ensemble',
      predicted_winner: 'home',
      home_win_probability: 0.65,
      confidence: 0.75,
      features: { test: true },
      model_predictions: { nn: 0.65, rf: 0.5 },
      top_factors: ['test factor 1', 'test factor 2'],
      created_at: new Date().toISOString()
    };
    
    console.log(chalk.yellow('Inserting prediction...'));
    const { data, error } = await supabase
      .from('ml_predictions')
      .insert(testPrediction)
      .select();
    
    if (error) {
      console.error(chalk.red('Insert error:'), error);
    } else {
      console.log(chalk.green('✅ Prediction inserted successfully!'));
      console.log('Inserted data:', data);
    }
    
    // Verify it was saved
    const { count } = await supabase
      .from('ml_predictions')
      .select('*', { count: 'exact' })
      .eq('model_name', 'test_ensemble');
    
    console.log(chalk.cyan(`\nTotal test predictions: ${count}`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

testInsert().catch(console.error);
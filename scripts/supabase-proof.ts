#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function showSupabaseProof() {
  console.log(chalk.bold.red('\n🔥 SUPABASE PROOF - DIRECT FROM DATABASE!\n'));
  
  // Get 5 most recent turbo predictions
  const { data: recent, error } = await supabase
    .from('ml_predictions')
    .select('*')
    .eq('model_name', 'turbo_v1')
    .order('created_at', { ascending: false })
    .limit(5);
    
  if (error) {
    console.error('Error:', error);
    return;
  }
  
  console.log(chalk.yellow('ACTUAL RECORDS FROM SUPABASE:'));
  recent?.forEach((pred, i) => {
    console.log(chalk.cyan(`\n${i + 1}. Record ID: ${pred.id}`));
    console.log(`   Game ID: ${pred.game_id}`);
    console.log(`   Model: ${pred.model_name}`);
    console.log(`   Prediction: ${pred.prediction} (${pred.metadata?.predicted_winner})`);
    console.log(`   Confidence: ${(pred.confidence * 100).toFixed(1)}%`);
    console.log(`   Created: ${new Date(pred.created_at).toLocaleString()}`);
  });
  
  // Count predictions by time buckets
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 3600000);
  
  const { count: lastHour } = await supabase
    .from('ml_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('model_name', 'turbo_v1')
    .gte('created_at', oneHourAgo.toISOString());
    
  console.log(chalk.bold.green(`\n📊 TURBO PREDICTIONS IN LAST HOUR: ${lastHour?.toLocaleString()}`));
  console.log(chalk.gray('(This is ACTUAL data from your Supabase database)'));
}

showSupabaseProof().catch(console.error);
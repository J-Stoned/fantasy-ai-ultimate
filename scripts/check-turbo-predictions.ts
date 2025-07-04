#!/usr/bin/env tsx
/**
 * Check the REALITY of turbo predictions in the database
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function checkTurboPredictions() {
  console.log(chalk.bold.yellow('\n🔍 CHECKING TURBO PREDICTIONS REALITY...\n'));
  
  // 1. Total predictions count
  const { count: totalCount } = await supabase
    .from('ml_predictions')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.cyan(`Total predictions in database: ${totalCount}`));
  
  // 2. Turbo predictions count
  const { count: turboCount } = await supabase
    .from('ml_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('model_name', 'turbo_v1');
    
  console.log(chalk.green(`Turbo v1 predictions: ${turboCount || 0}`));
  
  // 3. Get recent turbo predictions with timestamps
  const { data: recentTurbo } = await supabase
    .from('ml_predictions')
    .select('id, game_id, created_at, confidence')
    .eq('model_name', 'turbo_v1')
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (recentTurbo && recentTurbo.length > 0) {
    console.log(chalk.yellow('\n📅 Recent turbo predictions:'));
    
    const now = new Date();
    recentTurbo.forEach((pred, i) => {
      const createdAt = new Date(pred.created_at);
      const ageMs = now.getTime() - createdAt.getTime();
      const ageMinutes = Math.floor(ageMs / 60000);
      const ageSeconds = Math.floor((ageMs % 60000) / 1000);
      
      console.log(`  ${i + 1}. Game ${pred.game_id}: ${ageMinutes}m ${ageSeconds}s ago (${pred.confidence.toFixed(2)} confidence)`);
    });
    
    // Calculate creation rate
    const oldestTime = new Date(recentTurbo[recentTurbo.length - 1].created_at);
    const newestTime = new Date(recentTurbo[0].created_at);
    const timeDiffMs = newestTime.getTime() - oldestTime.getTime();
    
    if (timeDiffMs > 0) {
      const predictionsPerHour = (recentTurbo.length / (timeDiffMs / 3600000));
      console.log(chalk.bold.green(`\n⚡ Recent creation rate: ${predictionsPerHour.toFixed(0)} predictions/hour`));
    }
  } else {
    console.log(chalk.red('\nNo turbo predictions found!'));
  }
  
  // 4. Check if predictions are being created NOW
  const oneMinuteAgo = new Date(Date.now() - 60000).toISOString();
  const { count: recentCount } = await supabase
    .from('ml_predictions')
    .select('*', { count: 'exact', head: true })
    .eq('model_name', 'turbo_v1')
    .gte('created_at', oneMinuteAgo);
    
  console.log(chalk.bold.cyan(`\n🔥 Predictions created in last minute: ${recentCount || 0}`));
  
  if (recentCount && recentCount > 0) {
    const ratePerHour = recentCount * 60;
    console.log(chalk.bold.yellow(`   That's ${ratePerHour} predictions/hour pace!`));
  }
  
  // Summary
  console.log(chalk.bold.red('\n📊 REALITY CHECK:'));
  if (turboCount === 0) {
    console.log('  ❌ No turbo predictions in database - service may be failing to save');
  } else if (recentCount === 0) {
    console.log('  ⚠️  Turbo predictions exist but none created recently - service may be stopped');
  } else {
    console.log('  ✅ Turbo predictions are being created RIGHT NOW!');
    console.log(`  🚀 Current rate: ${(recentCount * 60).toLocaleString()} predictions/hour`);
  }
}

checkTurboPredictions().catch(console.error);
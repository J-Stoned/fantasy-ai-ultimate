#!/usr/bin/env tsx
/**
 * Check player_stats table schema
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkSchema() {
  console.log(chalk.bold.cyan('\n🔍 CHECKING PLAYER_STATS SCHEMA\n'));
  
  // Try to get some sample data to understand the structure
  const { data: sampleStats, error } = await supabase
    .from('player_stats')
    .select('*')
    .limit(3);
    
  if (error) {
    console.error('Error fetching stats:', error);
    return;
  }
  
  console.log(chalk.yellow('Sample player_stats records:'));
  console.log(JSON.stringify(sampleStats, null, 2));
  
  // Try to insert a duplicate to see the constraint error
  if (sampleStats && sampleStats.length > 0) {
    const sample = sampleStats[0];
    console.log(chalk.cyan('\nTesting duplicate insert...'));
    
    const { error: insertError } = await supabase
      .from('player_stats')
      .insert([{
        player_id: sample.player_id,
        game_id: sample.game_id,
        stat_type: sample.stat_type,
        stat_value: 'test_value'
      }]);
      
    if (insertError) {
      console.log(chalk.red('Insert error (expected):'), insertError.message);
    }
  }
  
  // Test the conflict specification we're using
  console.log(chalk.cyan('\nTesting onConflict specification...'));
  const { error: conflictError } = await supabase
    .from('player_stats')
    .upsert([{
      player_id: 999999,
      game_id: 999999,
      stat_type: 'test_stat',
      stat_value: 'test_value'
    }], {
      onConflict: 'player_id,game_id,stat_type',
      ignoreDuplicates: true
    });
    
  if (conflictError) {
    console.log(chalk.red('OnConflict error:'), conflictError.message);
  } else {
    console.log(chalk.green('✓ OnConflict specification works'));
  }
}

checkSchema().catch(console.error);
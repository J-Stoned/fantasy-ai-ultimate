#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPlayerStatsStructure() {
  console.log(chalk.blue('🔍 Checking player_stats table structure...\n'));

  // Query a sample record to see the structure
  const { data, error } = await supabase
    .from('player_stats')
    .select('*')
    .limit(1);

  if (error) {
    console.log(chalk.red('Error:'), error.message);
    console.log(chalk.yellow('\nDetails:'), error.details);
    console.log(chalk.yellow('Hint:'), error.hint);
  } else if (data && data.length > 0) {
    console.log(chalk.green('Sample player_stats record:'));
    console.log(JSON.stringify(data[0], null, 2));
    console.log(chalk.cyan('\nColumns:'), Object.keys(data[0]));
    
    // Check the data types
    console.log(chalk.yellow('\nColumn types:'));
    for (const [key, value] of Object.entries(data[0])) {
      console.log(`  ${key}: ${typeof value} ${Array.isArray(value) ? '(array)' : ''}`);
    }
  } else {
    console.log(chalk.yellow('No records found in player_stats table'));
    
    // Try to insert a test record to see what columns are expected
    console.log(chalk.blue('\nTrying to insert a test record to discover schema...'));
    
    const testRecord = {
      player_id: 1,
      game_id: 1,
      stat_type: 'test',
      stats: { test: true },
      stat_value: { test: true }
    };
    
    const { error: insertError } = await supabase
      .from('player_stats')
      .insert(testRecord);
    
    if (insertError) {
      console.log(chalk.red('\nInsert error:'), insertError.message);
      console.log(chalk.yellow('Details:'), insertError.details);
      console.log(chalk.yellow('Hint:'), insertError.hint);
    }
  }

  // Count total records
  const { count } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });

  console.log(chalk.green(`\nTotal records in player_stats: ${count || 0}`));
}

checkPlayerStatsStructure().catch(console.error);
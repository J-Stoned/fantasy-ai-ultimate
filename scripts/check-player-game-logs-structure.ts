#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPlayerGameLogsStructure() {
  console.log(chalk.blue('🔍 Checking player_game_logs table structure...\n'));

  // Query a sample record to see the structure
  const { data, error } = await supabase
    .from('player_game_logs')
    .select('*')
    .limit(1);

  if (error) {
    console.log(chalk.red('Error:'), error.message);
    console.log(chalk.yellow('\nDetails:'), error.details);
    console.log(chalk.yellow('Hint:'), error.hint);
  } else if (data && data.length > 0) {
    console.log(chalk.green('Sample player_game_logs record:'));
    console.log(JSON.stringify(data[0], null, 2));
    console.log(chalk.cyan('\nColumns:'), Object.keys(data[0]));
    
    // Check the data types
    console.log(chalk.yellow('\nColumn types:'));
    for (const [key, value] of Object.entries(data[0])) {
      console.log(`  ${key}: ${typeof value} ${Array.isArray(value) ? '(array)' : ''}`);
    }
    
    // Check if stats column is JSONB
    if (data[0].stats) {
      console.log(chalk.cyan('\nStats structure:'));
      console.log(JSON.stringify(data[0].stats, null, 2));
    }
  } else {
    console.log(chalk.yellow('No records found in player_game_logs table'));
  }

  // Count total records
  const { count } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });

  console.log(chalk.green(`\nTotal records in player_game_logs: ${count || 0}`));
  
  // Check games with stats
  const { data: gamesWithStats } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .limit(1000);
  
  if (gamesWithStats) {
    const uniqueGames = new Set(gamesWithStats.map(g => g.game_id));
    console.log(chalk.cyan(`Unique games with player_game_logs: ${uniqueGames.size}`));
  }
}

checkPlayerGameLogsStructure().catch(console.error);
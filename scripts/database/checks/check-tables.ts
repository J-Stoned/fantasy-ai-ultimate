#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTables() {
  console.log(chalk.blue.bold('\n📊 CHECKING TABLE STRUCTURES\n'));
  
  // Check critical tables
  const tables = [
    'players',
    'player_stats',
    'player_injuries',
    'weather_data',
    'team_stats',
    'games',
    'teams'
  ];
  
  for (const table of tables) {
    try {
      const { data, count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
        
      if (error) {
        console.log(chalk.red(`❌ ${table}: ERROR - ${error.message}`));
      } else {
        console.log(chalk.green(`✅ ${table}: ${count} records`));
      }
    } catch (e) {
      console.log(chalk.red(`❌ ${table}: Table may not exist`));
    }
  }
  
  // Check sample player data
  console.log(chalk.yellow('\n📋 Sample player data:'));
  const { data: players, error: playerError } = await supabase
    .from('players')
    .select('*')
    .limit(3);
    
  if (playerError) {
    console.log(chalk.red('Error fetching players:', playerError.message));
  } else if (!players || players.length === 0) {
    console.log(chalk.red('No players found!'));
  } else {
    console.log('Found', players.length, 'players');
    console.log('First player keys:', Object.keys(players[0]));
    console.log('Sample player:', JSON.stringify(players[0], null, 2));
  }
  
  // Check games with teams
  console.log(chalk.yellow('\n🏈 Sample games:'));
  const { data: games } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .limit(2);
    
  if (games && games.length > 0) {
    console.log('Sample game:', JSON.stringify(games[0], null, 2));
  }
}

checkTables();
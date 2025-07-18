#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNCAAData() {
  // Count games by sport for 2021
  const sports = ['NCAA_FB', 'NCAA_BB', 'NCAA_BASEBALL'];
  
  console.log(chalk.cyan('\n📊 NCAA 2021 Collection Status:\n'));
  
  let totalGames = 0;
  let totalPlayers = 0;
  let totalStats = 0;
  
  for (const sport of sports) {
    const { count: gameCount } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport)
      .eq('metadata->>season', '2021');
      
    const { count: playerCount } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    const { count: statCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
      
    console.log(chalk.yellow(sport + ':'));
    console.log(chalk.green('  Games:'), gameCount || 0);
    console.log(chalk.green('  Players:'), playerCount || 0);
    console.log(chalk.green('  Stats:'), statCount || 0);
    
    totalGames += gameCount || 0;
    totalPlayers += playerCount || 0;
    totalStats += statCount || 0;
  }
  
  console.log(chalk.blue('\nTotals:'));
  console.log(chalk.blue('  Total NCAA 2021 games:'), totalGames);
  console.log(chalk.blue('  Total NCAA players:'), totalPlayers);
  console.log(chalk.blue('  Total NCAA stats:'), totalStats);
  
  // Check overall stats
  const { count: allStats } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
    
  console.log(chalk.gray('\nTotal stats in entire database:'), allStats || 0);
}

checkNCAAData().catch(console.error);
#!/usr/bin/env tsx
/**
 * Verify NBA data before stats collection
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyData() {
  console.log(chalk.bold.blue('\n🏀 NBA DATA VERIFICATION\n'));
  
  // Count teams
  const { count: teamCount } = await supabase
    .from('teams')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
  
  console.log(chalk.cyan(`✅ NBA Teams: ${teamCount}`));
  
  // Count players
  const { count: playerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .or('sport.eq.NBA,sport.eq.nba,sport.eq.basketball');
  
  console.log(chalk.cyan(`✅ NBA Players: ${playerCount}`));
  
  // Count games
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA');
  
  const { count: completedGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'NBA')
    .eq('status', 'completed')
    .not('home_score', 'is', null);
  
  console.log(chalk.cyan(`✅ NBA Games: ${totalGames} total (${completedGames} completed)`));
  
  // Count existing stats
  const { count: statsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.cyan(`✅ Player Game Logs: ${statsCount || 0}`));
  
  // Estimate stats to collect
  const estimatedStats = completedGames! * 20; // ~10 players per team * 2 teams
  console.log(chalk.yellow(`\n📊 Estimated stats to collect: ~${estimatedStats.toLocaleString()}`));
  
  console.log(chalk.green('\n✅ Ready to collect stats!'));
}

verifyData().catch(console.error);
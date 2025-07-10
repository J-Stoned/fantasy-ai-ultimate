#!/usr/bin/env tsx
/**
 * 🚀 QUICK COVERAGE CHECK - Fast verification
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function quickCoverageCheck() {
  console.log(chalk.bold.cyan('\n🚀 QUICK DATABASE COVERAGE CHECK\n'));
  
  const sports = ['nfl', 'nba', 'mlb', 'nhl'];
  
  for (const sport of sports) {
    // Get game count
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', sport)
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null);
    
    // Get unique games with stats using a more efficient query
    const { data: gamesWithLogs } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', 
        await supabase
          .from('games')
          .select('id')
          .eq('sport_id', sport)
          .gte('start_time', '2024-01-01')
          .lt('start_time', '2025-01-01')
          .not('home_score', 'is', null)
          .then(res => res.data?.map(g => g.id) || [])
      );
    
    const uniqueGamesWithStats = new Set(gamesWithLogs?.map(g => g.game_id) || []).size;
    const coverage = totalGames ? ((uniqueGamesWithStats / totalGames) * 100).toFixed(1) : '0.0';
    
    let status = '❌';
    if (parseFloat(coverage) >= 95) status = '✅';
    else if (parseFloat(coverage) >= 90) status = '🟡';
    else if (parseFloat(coverage) >= 85) status = '🔵';
    
    console.log(`${sport.toUpperCase()}: ${uniqueGamesWithStats}/${totalGames} (${coverage}%) ${status}`);
  }
  
  // Database totals
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.yellow(`\nTotal logs in database: ${totalLogs?.toLocaleString()}`));
}

quickCoverageCheck();
#\!/usr/bin/env tsx
/**
 * 📊 ACCURATE COVERAGE CHECK - Get the real stats coverage
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL\!,
  process.env.SUPABASE_SERVICE_ROLE_KEY\!
);

async function accurateCoverageCheck() {
  console.log(chalk.bold.cyan('\n📊 ACCURATE DATABASE COVERAGE CHECK\n'));
  
  const sports = ['nfl', 'nba', 'mlb', 'nhl'];
  
  for (const sport of sports) {
    // Get all games for the sport
    const { data: games, count: totalGames } = await supabase
      .from('games')
      .select('id', { count: 'exact' })
      .eq('sport_id', sport)
      .gte('start_time', '2024-01-01')
      .lt('start_time', '2025-01-01')
      .not('home_score', 'is', null);
    
    if (\!games || \!totalGames) {
      console.log(`${sport.toUpperCase()}: No games found`);
      continue;
    }
    
    // Count games with stats (more accurate method)
    let gamesWithStats = 0;
    
    for (const game of games) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .limit(1);
      
      if (count && count > 0) {
        gamesWithStats++;
      }
    }
    
    const coverage = ((gamesWithStats / totalGames) * 100).toFixed(1);
    const gamesNeededFor95 = Math.max(0, Math.ceil(totalGames * 0.95) - gamesWithStats);
    
    let status = '❌';
    let color: 'green'  < /dev/null |  'yellow' | 'cyan' | 'red' = 'red';
    
    if (parseFloat(coverage) >= 95) {
      status = '✅ GOLD STANDARD';
      color = 'green';
    } else if (parseFloat(coverage) >= 90) {
      status = '🟡 PROFESSIONAL';
      color = 'yellow';
    } else if (parseFloat(coverage) >= 85) {
      status = '🔵 GOOD';
      color = 'cyan';
    }
    
    console.log(chalk[color](
      `${sport.toUpperCase()}: ${gamesWithStats}/${totalGames} (${coverage}%) ${status}`
    ));
    
    if (gamesNeededFor95 > 0) {
      console.log(chalk.gray(`  Need ${gamesNeededFor95} more games for 95%`));
    }
  }
  
  // Database totals
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.yellow(`\nTotal logs in database: ${totalLogs?.toLocaleString()}`));
}

accurateCoverageCheck();

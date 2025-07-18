#!/usr/bin/env tsx
/**
 * Check for COMPLETE 2021 NFL season (Sep 2021 - Feb 2022)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkFull2021Season() {
  console.log(chalk.blue('\n🏈 Checking COMPLETE 2021 NFL Season (Sep 2021 - Feb 2022)\n'));

  // NFL 2021 season runs from Sep 2021 to Feb 2022
  const { data: allGames, error } = await supabase
    .from('games')
    .select('id, start_time, home_team_id, away_team_id')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-09-01')
    .lt('start_time', '2022-03-01')
    .order('start_time');

  if (error || !allGames) {
    console.error('Error:', error);
    return;
  }

  console.log(chalk.green(`✅ Found ${allGames.length} total NFL games for 2021 season`));

  // Group by month
  const gamesByMonth: Record<string, number> = {};
  allGames.forEach(game => {
    const month = new Date(game.start_time).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    gamesByMonth[month] = (gamesByMonth[month] || 0) + 1;
  });

  console.log(chalk.cyan('\nGames by month:'));
  Object.entries(gamesByMonth).sort().forEach(([month, count]) => {
    console.log(`  ${month}: ${count} games`);
  });

  // Check stats for all these games
  console.log(chalk.yellow('\n🔍 Checking player stats...'));
  
  const gameIds = allGames.map(g => g.id);
  
  // Direct count query
  const { count: totalStats, error: countError } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .in('game_id', gameIds);

  console.log(chalk.green(`\n✅ Total player stats for 2021 season: ${totalStats || 0}`));
  
  if (totalStats) {
    console.log(`   Average stats per game: ${Math.round(totalStats / allGames.length)}`);
  }

  // Check January and February 2022 specifically
  const playoffGames = allGames.filter(g => {
    const date = new Date(g.start_time);
    return date.getFullYear() === 2022 && date.getMonth() <= 1; // Jan & Feb
  });

  console.log(chalk.cyan(`\n🏆 Playoff games (Jan-Feb 2022): ${playoffGames.length}`));

  if (playoffGames.length > 0) {
    const playoffIds = playoffGames.map(g => g.id);
    const { count: playoffStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('game_id', playoffIds);
    
    console.log(`   Playoff stats: ${playoffStats || 0}`);
  }

  // Expected vs Actual
  const expectedGames = 272; // Regular season (17 weeks × 16 games) + playoffs
  const expectedStats = expectedGames * 60; // ~60 stats per game
  
  console.log(chalk.blue('\n📊 Analysis:'));
  console.log(`  Expected games: ~${expectedGames}`);
  console.log(`  Actual games: ${allGames.length}`);
  console.log(`  Expected stats: ~${expectedStats.toLocaleString()}`);
  console.log(`  Actual stats: ${totalStats?.toLocaleString() || '0'}`);
  
  if (totalStats && totalStats < expectedStats * 0.8) {
    console.log(chalk.red(`\n⚠️  Missing significant data! Only ${Math.round((totalStats / expectedStats) * 100)}% of expected stats found.`));
    console.log(chalk.yellow('  Need to run historical collection to get complete data.'));
  } else if (totalStats) {
    console.log(chalk.green('\n✅ Data looks complete!'));
  }
}

checkFull2021Season().catch(console.error);
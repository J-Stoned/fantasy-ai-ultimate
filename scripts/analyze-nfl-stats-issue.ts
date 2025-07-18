#!/usr/bin/env tsx
/**
 * Analyze why NFL stats appear partial when they were fully collected
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeNFLStatsIssue() {
  console.log(chalk.blue('\n🔍 Deep Analysis of NFL Stats Issue\n'));

  // 1. Check games
  const { data: nfl2021Games, error: gamesError } = await supabase
    .from('games')
    .select('id, start_time, home_team_id, away_team_id')
    .eq('sport', 'NFL')
    .gte('start_time', '2021-01-01')
    .lt('start_time', '2022-01-01')
    .order('start_time');

  if (gamesError || !nfl2021Games) {
    console.error('Error fetching games:', gamesError);
    return;
  }

  console.log(chalk.green(`✅ Found ${nfl2021Games.length} NFL games from 2021`));
  
  // Group by month
  const gamesByMonth: Record<string, number> = {};
  nfl2021Games.forEach(game => {
    const month = new Date(game.start_time).toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
    gamesByMonth[month] = (gamesByMonth[month] || 0) + 1;
  });
  
  console.log(chalk.cyan('\nGames by month:'));
  Object.entries(gamesByMonth).forEach(([month, count]) => {
    console.log(`  ${month}: ${count} games`);
  });

  // 2. Check stats for these games
  console.log(chalk.yellow('\n🔍 Checking stats for 2021 NFL games...'));
  
  const gameIds = nfl2021Games.map(g => g.id);
  
  // Check in batches
  const batchSize = 50;
  let totalStats = 0;
  let gamesWithStats = 0;
  let gamesWithoutStats = 0;
  
  for (let i = 0; i < gameIds.length; i += batchSize) {
    const batch = gameIds.slice(i, i + batchSize);
    
    const { data: stats, error: statsError } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', batch);
    
    if (!statsError && stats) {
      totalStats += stats.length;
      
      // Count unique games with stats
      const uniqueGames = new Set(stats.map(s => s.game_id));
      gamesWithStats += uniqueGames.size;
      gamesWithoutStats += batch.length - uniqueGames.size;
    }
    
    process.stdout.write('.');
  }
  
  console.log(chalk.green(`\n\n✅ Found ${totalStats} total player stats for 2021 NFL games`));
  console.log(`  - ${gamesWithStats} games have stats`);
  console.log(`  - ${gamesWithoutStats} games missing stats`);
  console.log(`  - Average ${Math.round(totalStats / gamesWithStats)} stats per game`);

  // 3. Check sport field values
  console.log(chalk.yellow('\n🔍 Checking sport field values in stats...'));
  
  // Sample check on first 5 games
  const sampleGameIds = gameIds.slice(0, 5);
  
  for (const gameId of sampleGameIds) {
    const { data: gameStat, error } = await supabase
      .from('player_game_logs')
      .select('id, sport, player_id, passing_yards, rushing_yards, receiving_yards')
      .eq('game_id', gameId)
      .limit(3);
    
    if (gameStat && gameStat.length > 0) {
      console.log(chalk.cyan(`\nGame ${gameId}:`));
      gameStat.forEach(stat => {
        console.log(`  Stat ${stat.id}: sport="${stat.sport}" player=${stat.player_id}`);
      });
    }
  }

  // 4. Check why the initial query showed only 10,300 stats
  console.log(chalk.yellow('\n🔍 Analyzing sport field distribution...'));
  
  const { data: sportValues } = await supabase
    .rpc('get_sport_distribution_for_nfl_games', {
      game_ids: gameIds.slice(0, 100) // Check first 100 games
    }).single();

  if (sportValues) {
    console.log('\nSport field values in NFL game stats:', sportValues);
  } else {
    // Manual check
    const { data: nullSportStats, count: nullCount } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact', head: true })
      .in('game_id', gameIds)
      .is('sport', null);
    
    const { data: nflSportStats, count: nflCount } = await supabase
      .from('player_game_logs')
      .select('id', { count: 'exact', head: true })
      .in('game_id', gameIds)
      .eq('sport', 'NFL');
    
    console.log(`\nStats with sport=NULL: ${nullCount}`);
    console.log(`Stats with sport='NFL': ${nflCount}`);
  }

  // 5. Final summary
  console.log(chalk.blue('\n📊 SUMMARY:'));
  console.log(`- 2021 NFL games in DB: ${nfl2021Games.length}`);
  console.log(`- Total stats found: ${totalStats}`);
  console.log(`- The data IS there, but may have inconsistent sport field values`);
  console.log(`- This explains why queries show "partial" data`);
}

analyzeNFLStatsIssue().catch(console.error);
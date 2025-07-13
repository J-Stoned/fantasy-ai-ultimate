#!/usr/bin/env tsx
/**
 * 🔍 ANALYZE STATS COVERAGE ISSUE
 * Find out why coverage shows only 45 games when we inserted stats for 338 games
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function analyzeStatsCoverageIssue() {
  console.log(chalk.bold.blue('\n🔍 ANALYZING STATS COVERAGE ISSUE\n'));
  
  // 1. Count distinct game_ids in player_stats
  console.log(chalk.yellow('1️⃣ DISTINCT GAME IDs IN PLAYER_STATS:'));
  
  const { data: gameIdsData } = await supabase
    .from('player_stats')
    .select('game_id')
    .not('game_id', 'is', null);
  
  const uniqueGameIds = [...new Set(gameIdsData?.map(g => g.game_id) || [])];
  console.log(chalk.white(`   Unique games with stats: ${uniqueGameIds.length}`));
  console.log(chalk.white(`   Total stats records: ${gameIdsData?.length || 0}`));
  
  // 2. Check what sport these games belong to
  console.log(chalk.yellow('\n2️⃣ SPORTS BREAKDOWN OF GAMES WITH STATS:'));
  
  const sportBreakdown: { [key: string]: number } = {};
  
  if (uniqueGameIds.length > 0) {
    const { data: gamesWithStats } = await supabase
      .from('games')
      .select('id, sport, season, season_type')
      .in('id', uniqueGameIds);
    
    gamesWithStats?.forEach(game => {
      const sport = game.sport || 'null/unknown';
      sportBreakdown[sport] = (sportBreakdown[sport] || 0) + 1;
    });
    
    Object.entries(sportBreakdown).forEach(([sport, count]) => {
      console.log(chalk.white(`   ${sport}: ${count} games`));
    });
  }
  
  // 3. Check NFL games specifically
  console.log(chalk.yellow('\n3️⃣ NFL GAMES ANALYSIS:'));
  
  // Get all NFL game IDs
  const { data: nflGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'nfl')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  const nflGameIds = nflGames?.map(g => g.id) || [];
  console.log(chalk.white(`   Total completed NFL games: ${nflGameIds.length}`));
  
  // Check how many have stats
  if (nflGameIds.length > 0) {
    const { count: nflStatsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .in('game_id', nflGameIds);
    
    const nflGamesWithStats = uniqueGameIds.filter(id => nflGameIds.includes(id));
    console.log(chalk.white(`   NFL games with stats: ${nflGamesWithStats.length}`));
    console.log(chalk.white(`   NFL stats records: ${nflStatsCount || 0}`));
  }
  
  // 4. Check recent insertions timing
  console.log(chalk.yellow('\n4️⃣ RECENT STATS INSERTIONS:'));
  
  const { data: recentStats } = await supabase
    .from('player_stats')
    .select('game_id, created_at, stat_type')
    .order('created_at', { ascending: false })
    .limit(100);
  
  // Group by insertion time to see batches
  const insertionBatches: { [key: string]: number } = {};
  recentStats?.forEach(stat => {
    const timeKey = stat.created_at.substring(0, 19); // Group by second
    insertionBatches[timeKey] = (insertionBatches[timeKey] || 0) + 1;
  });
  
  const sortedBatches = Object.entries(insertionBatches)
    .sort(([a], [b]) => b.localeCompare(a))
    .slice(0, 5);
  
  console.log(chalk.white('   Recent insertion batches:'));
  sortedBatches.forEach(([time, count]) => {
    console.log(chalk.white(`   ${time}: ${count} stats`));
  });
  
  // 5. Check if game_logs table is being used instead
  console.log(chalk.yellow('\n5️⃣ PLAYER_GAME_LOGS TABLE CHECK:'));
  
  const { count: gameLogsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { data: gameLogGameIds } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .not('game_id', 'is', null);
  
  const uniqueGameLogGameIds = [...new Set(gameLogGameIds?.map(g => g.game_id) || [])];
  
  console.log(chalk.white(`   Total game logs: ${gameLogsCount || 0}`));
  console.log(chalk.white(`   Unique games in game logs: ${uniqueGameLogGameIds.length}`));
  
  // 6. Final summary
  console.log(chalk.bold.green('\n✅ SUMMARY:'));
  console.log(chalk.white(`   player_stats has data for ${uniqueGameIds.length} games`));
  console.log(chalk.white(`   player_game_logs has data for ${uniqueGameLogGameIds.length} games`));
  console.log(chalk.white(`   Total unique games with any stats: ${new Set([...uniqueGameIds, ...uniqueGameLogGameIds]).size}`));
  
  // 7. Diagnosis
  console.log(chalk.bold.red('\n⚠️  DIAGNOSIS:'));
  
  if (uniqueGameIds.length < 100) {
    console.log(chalk.white('   ❌ Very few games have stats in player_stats table'));
  }
  
  const nullSportGames = uniqueGameIds.filter(async (id) => {
    const { data } = await supabase.from('games').select('sport').eq('id', id).single();
    return !data?.sport;
  });
  
  if (sportBreakdown['null/unknown'] > 0) {
    console.log(chalk.white(`   ❌ ${sportBreakdown['null/unknown']} games with stats have NULL sport field`));
    console.log(chalk.white('      This is why NFL coverage shows 0%!'));
  }
  
  console.log(chalk.yellow('\n📝 RECOMMENDATIONS:'));
  console.log(chalk.white('   1. Fix the sport field for games that have stats'));
  console.log(chalk.white('   2. Ensure NFL games are properly tagged with sport="nfl"'));
  console.log(chalk.white('   3. Re-run stats collection for properly tagged NFL games'));
  console.log(chalk.white('   4. Consider using player_game_logs table for game-by-game stats\n'));
}

analyzeStatsCoverageIssue().catch(console.error);
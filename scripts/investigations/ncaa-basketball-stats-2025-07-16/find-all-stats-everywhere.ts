#!/usr/bin/env tsx
/**
 * 🔍 FIND ALL STATS EVERYWHERE IN THE DATABASE
 * Check EVERY table that might contain stats data
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findAllStatsEverywhere() {
  console.log(chalk.bold.red('🔍 SEARCHING ENTIRE DATABASE FOR ALL STATS...\n'));
  
  let grandTotal = 0;
  
  // 1. Check player_game_logs (obvious place)
  console.log(chalk.bold.yellow('1. PLAYER_GAME_LOGS TABLE:'));
  const { count: gameLogsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total records: ${gameLogsCount?.toLocaleString()}`);
  grandTotal += gameLogsCount || 0;
  
  // Break down by sport
  const { data: gameLogsSports } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .limit(10000);
  
  if (gameLogsSports) {
    // Get unique game IDs and check their sports
    const sampleGameIds = [...new Set(gameLogsSports.map(log => log.game_id))].slice(0, 100);
    const { data: games } = await supabase
      .from('games')
      .select('sport')
      .in('id', sampleGameIds);
    
    const sportCounts = games?.reduce((acc, game) => {
      acc[game.sport] = (acc[game.sport] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('   Sports breakdown (sample):', sportCounts);
  }
  
  // 2. Check player_stats table (might have aggregated stats)
  console.log(chalk.bold.yellow('\n2. PLAYER_STATS TABLE:'));
  const { count: playerStatsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total records: ${playerStatsCount?.toLocaleString()}`);
  grandTotal += playerStatsCount || 0;
  
  // Check what's in player_stats
  const { data: playerStatsSample } = await supabase
    .from('player_stats')
    .select('*')
    .limit(5);
  
  if (playerStatsSample && playerStatsSample.length > 0) {
    console.log('   Sample record:', {
      player_id: playerStatsSample[0].player_id,
      stats_keys: Object.keys(playerStatsSample[0].stats || {}),
      has_season: !!playerStatsSample[0].season,
      created_at: playerStatsSample[0].created_at
    });
  }
  
  // 3. Check player_season_stats table
  console.log(chalk.bold.yellow('\n3. PLAYER_SEASON_STATS TABLE:'));
  const { count: seasonStatsCount } = await supabase
    .from('player_season_stats')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total records: ${seasonStatsCount?.toLocaleString()}`);
  grandTotal += seasonStatsCount || 0;
  
  // 4. Check team_stats table
  console.log(chalk.bold.yellow('\n4. TEAM_STATS TABLE:'));
  const { count: teamStatsCount } = await supabase
    .from('team_stats')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total records: ${teamStatsCount?.toLocaleString()}`);
  grandTotal += teamStatsCount || 0;
  
  // 5. Check team_season_stats table
  console.log(chalk.bold.yellow('\n5. TEAM_SEASON_STATS TABLE:'));
  const { count: teamSeasonStatsCount } = await supabase
    .from('team_season_stats')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total records: ${teamSeasonStatsCount?.toLocaleString()}`);
  grandTotal += teamSeasonStatsCount || 0;
  
  // 6. Check games table for stats in metadata
  console.log(chalk.bold.yellow('\n6. GAMES TABLE (checking metadata):'));
  const { data: gamesWithStats } = await supabase
    .from('games')
    .select('metadata')
    .not('metadata', 'is', null)
    .limit(100);
  
  let gamesWithStatsData = 0;
  gamesWithStats?.forEach(game => {
    if (game.metadata?.stats || game.metadata?.player_stats || game.metadata?.team_stats) {
      gamesWithStatsData++;
    }
  });
  console.log(`   Games with stats in metadata (sample of 100): ${gamesWithStatsData}`);
  
  // 7. Check players table for stats in metadata
  console.log(chalk.bold.yellow('\n7. PLAYERS TABLE (checking metadata):'));
  const { data: playersWithStats } = await supabase
    .from('players')
    .select('metadata')
    .not('metadata', 'is', null)
    .limit(100);
  
  let playersWithStatsData = 0;
  playersWithStats?.forEach(player => {
    if (player.metadata?.stats || player.metadata?.career_stats || player.metadata?.season_stats) {
      playersWithStatsData++;
    }
  });
  console.log(`   Players with stats in metadata (sample of 100): ${playersWithStatsData}`);
  
  // 8. Check ml_predictions table (might contain stats features)
  console.log(chalk.bold.yellow('\n8. ML_PREDICTIONS TABLE:'));
  const { count: mlPredictionsCount } = await supabase
    .from('ml_predictions')
    .select('*', { count: 'exact', head: true });
  console.log(`   Total records: ${mlPredictionsCount?.toLocaleString()}`);
  
  // 9. Check for any other tables with 'stat' in the name
  console.log(chalk.bold.yellow('\n9. CHECKING FOR OTHER STAT-RELATED TABLES...'));
  
  // Check specific tables that might exist
  const otherTables = [
    'fantasy_points',
    'player_performance',
    'game_stats',
    'box_scores',
    'player_game_stats',
    'ncaa_stats',
    'college_stats'
  ];
  
  for (const table of otherTables) {
    try {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      if (count !== null) {
        console.log(`   ${table}: ${count.toLocaleString()} records`);
        grandTotal += count;
      }
    } catch (e) {
      // Table doesn't exist, skip
    }
  }
  
  // 10. Check news_articles for embedded stats
  console.log(chalk.bold.yellow('\n10. NEWS_ARTICLES TABLE (checking for embedded stats):'));
  const { data: newsWithStats } = await supabase
    .from('news_articles')
    .select('metadata')
    .not('metadata', 'is', null)
    .limit(100);
  
  let newsWithStatsData = 0;
  newsWithStats?.forEach(article => {
    if (article.metadata?.stats || article.metadata?.player_stats || article.metadata?.game_stats) {
      newsWithStatsData++;
    }
  });
  console.log(`   Articles with stats in metadata (sample of 100): ${newsWithStatsData}`);
  
  console.log(chalk.bold.green('\n=========================================='));
  console.log(chalk.bold.green(`GRAND TOTAL STATS RECORDS: ${grandTotal.toLocaleString()}`));
  console.log(chalk.bold.green('=========================================='));
  
  // Now let's specifically look for NCAA Basketball stats
  console.log(chalk.bold.cyan('\n🏀 SPECIFICALLY LOOKING FOR NCAA BASKETBALL STATS:'));
  
  // Get NCAA BB games
  const { data: ncaaBBGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NCAA_BB')
    .limit(10);
  
  if (ncaaBBGames && ncaaBBGames.length > 0) {
    console.log(`\nChecking sample NCAA BB game: ${ncaaBBGames[0].id}`);
    
    // Check player_game_logs
    const { count: ncaaBBStats } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', ncaaBBGames[0].id);
    
    console.log(`Stats in player_game_logs for this game: ${ncaaBBStats}`);
    
    // Check player_stats
    const { data: ncaaBBPlayerStats } = await supabase
      .from('player_stats')
      .select('*')
      .eq('game_id', ncaaBBGames[0].id)
      .limit(5);
    
    console.log(`Stats in player_stats for this game: ${ncaaBBPlayerStats?.length || 0}`);
  }
  
  // Check for stats with different external_id patterns
  console.log(chalk.bold.cyan('\n🔍 CHECKING DIFFERENT EXTERNAL_ID PATTERNS:'));
  
  const patterns = ['espn_ncaa', 'ncaa_', 'college_', 'cbb_', 'NCAA_BB'];
  
  for (const pattern of patterns) {
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .ilike('external_id', `%${pattern}%`);
    
    if (count && count > 0) {
      console.log(`   Pattern "${pattern}": ${count.toLocaleString()} records`);
    }
  }
}

findAllStatsEverywhere().catch(console.error);
#!/usr/bin/env tsx
/**
 * 📊 CHECK REAL STATS COVERAGE
 * Properly analyze stats coverage using the correct tables
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkRealStatsCoverage() {
  console.log(chalk.bold.blue('\n📊 REAL STATS COVERAGE ANALYSIS\n'));
  
  // 1. Check player_stats table (seasonal stats)
  console.log(chalk.yellow('📈 PLAYER_STATS TABLE (Seasonal Stats):'));
  
  const { count: totalSeasonalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.white(`   Total seasonal stat records: ${totalSeasonalStats?.toLocaleString() || 0}`));
  
  // Count distinct players with seasonal stats
  const { data: seasonalPlayerData } = await supabase
    .from('player_stats')
    .select('player_id')
    .not('player_id', 'is', null);
  
  const uniqueSeasonalPlayers = new Set(seasonalPlayerData?.map(p => p.player_id) || []);
  console.log(chalk.white(`   Unique players with seasonal stats: ${uniqueSeasonalPlayers.size.toLocaleString()}`));
  
  // 2. Check player_game_logs table (game-by-game stats)
  console.log(chalk.yellow('\n📅 PLAYER_GAME_LOGS TABLE (Game-by-Game Stats):'));
  
  const { count: totalGameLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.white(`   Total game log records: ${totalGameLogs?.toLocaleString() || 0}`));
  
  // Count distinct game_ids in player_game_logs
  const { data: gameLogData } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .not('game_id', 'is', null);
  
  const uniqueGameIds = new Set(gameLogData?.map(g => g.game_id) || []);
  console.log(chalk.white(`   Unique games with player stats: ${uniqueGameIds.size.toLocaleString()}`));
  
  // Count distinct players in game logs
  const { data: gameLogPlayerData } = await supabase
    .from('player_game_logs')
    .select('player_id')
    .not('player_id', 'is', null);
  
  const uniqueGameLogPlayers = new Set(gameLogPlayerData?.map(p => p.player_id) || []);
  console.log(chalk.white(`   Unique players with game logs: ${uniqueGameLogPlayers.size.toLocaleString()}`));
  
  // 3. Check game coverage
  console.log(chalk.yellow('\n🎮 GAME COVERAGE:'));
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  console.log(chalk.white(`   Total completed games: ${totalGames?.toLocaleString() || 0}`));
  
  const gameCoverage = totalGames ? (uniqueGameIds.size / totalGames * 100).toFixed(2) : 0;
  console.log(chalk.cyan(`   Game coverage: ${gameCoverage}% (${uniqueGameIds.size} of ${totalGames} games)`));
  
  // 4. Check NFL specifically
  console.log(chalk.yellow('\n🏈 NFL SPECIFIC ANALYSIS:'));
  
  // Count NFL games
  const { count: nflGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'nfl')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  console.log(chalk.white(`   Total NFL games: ${nflGames?.toLocaleString() || 0}`));
  
  // Get NFL game IDs
  const { data: nflGameData } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'nfl')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  const nflGameIds = nflGameData?.map(g => g.id) || [];
  
  // Count how many NFL games have stats
  const { data: nflGameLogsData } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .in('game_id', nflGameIds);
  
  const uniqueNFLGamesWithStats = new Set(nflGameLogsData?.map(g => g.game_id) || []);
  const nflCoverage = nflGames ? (uniqueNFLGamesWithStats.size / nflGames * 100).toFixed(2) : 0;
  
  console.log(chalk.white(`   NFL games with player stats: ${uniqueNFLGamesWithStats.size}`));
  console.log(chalk.cyan(`   NFL coverage: ${nflCoverage}%`));
  
  // 5. Check by sport
  console.log(chalk.yellow('\n🏆 COVERAGE BY SPORT:'));
  
  const sports = ['nfl', 'nba', 'mlb', 'nhl'];
  for (const sport of sports) {
    // Get games for this sport
    const { data: sportGames } = await supabase
      .from('games')
      .select('id')
      .eq('sport', sport)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
    
    const sportGameIds = sportGames?.map(g => g.id) || [];
    
    if (sportGameIds.length > 0) {
      // Count games with stats
      const { data: sportGameLogs } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .in('game_id', sportGameIds);
      
      const uniqueSportGamesWithStats = new Set(sportGameLogs?.map(g => g.game_id) || []);
      const sportCoverage = sportGameIds.length ? 
        (uniqueSportGamesWithStats.size / sportGameIds.length * 100).toFixed(1) : 0;
      
      console.log(chalk.white(`   ${sport.toUpperCase()}: ${uniqueSportGamesWithStats.size}/${sportGameIds.length} games (${sportCoverage}%)`));
    } else {
      console.log(chalk.gray(`   ${sport.toUpperCase()}: No completed games found`));
    }
  }
  
  // 6. Recent activity check
  console.log(chalk.yellow('\n⏰ RECENT ACTIVITY:'));
  
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { count: recentGameLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneDayAgo);
  
  const { count: veryRecentGameLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', oneHourAgo);
  
  console.log(chalk.white(`   Game logs added in last 24 hours: ${recentGameLogs?.toLocaleString() || 0}`));
  console.log(chalk.white(`   Game logs added in last hour: ${veryRecentGameLogs?.toLocaleString() || 0}`));
  
  // 7. Summary
  console.log(chalk.bold.green('\n✅ SUMMARY:'));
  console.log(chalk.white(`   Total game logs: ${totalGameLogs?.toLocaleString() || 0}`));
  console.log(chalk.white(`   Games covered: ${uniqueGameIds.size}/${totalGames} (${gameCoverage}%)`));
  console.log(chalk.white(`   Players with game logs: ${uniqueGameLogPlayers.size.toLocaleString()}`));
  console.log(chalk.white(`   Players with seasonal stats: ${uniqueSeasonalPlayers.size.toLocaleString()}\n`));
  
  if (Number(gameCoverage) < 1) {
    console.log(chalk.bold.red('⚠️  WARNING: Very low game coverage detected!'));
    console.log(chalk.white('   This explains why pattern accuracy is limited.'));
    console.log(chalk.white('   Need to populate player_game_logs table with game-by-game stats.\n'));
  }
}

checkRealStatsCoverage().catch(console.error);
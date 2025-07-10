#!/usr/bin/env tsx
/**
 * 📊 CHECK NFL GAME LOGS COVERAGE
 * Accurate analysis of NFL player_game_logs coverage
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNFLGameLogsCoverage() {
  console.log(chalk.bold.blue('\n🏈 NFL GAME LOGS COVERAGE ANALYSIS\n'));
  
  // Total records in player_game_logs
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.yellow('📈 PLAYER GAME LOGS TABLE:'));
  console.log(chalk.white(`   Total records: ${totalLogs?.toLocaleString() || 0}`));
  
  // NFL-specific game logs
  const { count: nflLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .eq('sport', 'nfl');
  
  console.log(chalk.white(`   NFL game logs: ${nflLogs?.toLocaleString() || 0}`));
  
  // Count unique NFL games with logs
  const { data: nflGameIds } = await supabase
    .from('player_game_logs')
    .select('game_id')
    .eq('sport', 'nfl')
    .not('game_id', 'is', null);
  
  const uniqueNFLGameIds = new Set(nflGameIds?.map(g => g.game_id) || []);
  console.log(chalk.white(`   Unique NFL games with logs: ${uniqueNFLGameIds.size.toLocaleString()}`));
  
  // Total NFL games in database
  const { count: totalNFLGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  console.log(chalk.white(`   Total completed NFL games: ${totalNFLGames?.toLocaleString() || 0}`));
  
  const nflGameCoverage = totalNFLGames ? (uniqueNFLGameIds.size / totalNFLGames * 100).toFixed(2) : 0;
  console.log(chalk.cyan(`   NFL game coverage: ${nflGameCoverage}%`));
  
  // Check unique NFL players with logs
  const { data: nflPlayerIds } = await supabase
    .from('player_game_logs')
    .select('player_id')
    .eq('sport', 'nfl')
    .not('player_id', 'is', null);
  
  const uniqueNFLPlayerIds = new Set(nflPlayerIds?.map(p => p.player_id) || []);
  console.log(chalk.white(`   Unique NFL players with logs: ${uniqueNFLPlayerIds.size.toLocaleString()}`));
  
  // Total NFL players
  const { count: totalNFLPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl');
  
  console.log(chalk.white(`   Total NFL players: ${totalNFLPlayers?.toLocaleString() || 0}`));
  
  const nflPlayerCoverage = totalNFLPlayers ? (uniqueNFLPlayerIds.size / totalNFLPlayers * 100).toFixed(2) : 0;
  console.log(chalk.cyan(`   NFL player coverage: ${nflPlayerCoverage}%`));
  
  // Sample recent NFL game logs
  console.log(chalk.yellow('\n📅 RECENT NFL GAME LOGS:'));
  const { data: recentLogs } = await supabase
    .from('player_game_logs')
    .select('*')
    .eq('sport', 'nfl')
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentLogs && recentLogs.length > 0) {
    for (const log of recentLogs) {
      // Get player name
      const { data: player } = await supabase
        .from('players')
        .select('firstname, lastname')
        .eq('id', log.player_id)
        .single();
      
      const playerName = player ? `${player.firstname} ${player.lastname}` : 'Unknown';
      console.log(chalk.white(`   ${playerName}: ${log.stats_summary || 'No summary'}`));
    }
  }
  
  // Check by season
  console.log(chalk.yellow('\n🗓️ NFL COVERAGE BY SEASON:'));
  const { data: seasonData } = await supabase
    .from('player_game_logs')
    .select('season')
    .eq('sport', 'nfl')
    .not('season', 'is', null);
  
  if (seasonData) {
    const seasonCount: { [key: string]: number } = {};
    seasonData.forEach(s => {
      if (s.season) {
        seasonCount[s.season] = (seasonCount[s.season] || 0) + 1;
      }
    });
    
    Object.entries(seasonCount)
      .sort(([a], [b]) => b.localeCompare(a))
      .forEach(([season, count]) => {
        console.log(chalk.white(`   ${season}: ${count.toLocaleString()} logs`));
      });
  }
  
  // Summary
  console.log(chalk.bold.green('\n✅ NFL GAME LOGS SUMMARY:'));
  console.log(chalk.white(`   Total NFL logs: ${nflLogs?.toLocaleString() || 0}`));
  console.log(chalk.white(`   Games covered: ${uniqueNFLGameIds.size} / ${totalNFLGames} (${nflGameCoverage}%)`));
  console.log(chalk.white(`   Players covered: ${uniqueNFLPlayerIds.size} / ${totalNFLPlayers} (${nflPlayerCoverage}%)`));
  
  // Check all sports coverage
  console.log(chalk.yellow('\n🏆 ALL SPORTS COVERAGE:'));
  const sports = ['nfl', 'nba', 'mlb', 'nhl'];
  
  for (const sport of sports) {
    const { count: sportLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .eq('sport', sport);
    
    console.log(chalk.white(`   ${sport.toUpperCase()}: ${sportLogs?.toLocaleString() || 0} logs`));
  }
  
  console.log(chalk.bold.blue('\n📊 ANALYSIS COMPLETE!\n'));
}

checkNFLGameLogsCoverage().catch(console.error);
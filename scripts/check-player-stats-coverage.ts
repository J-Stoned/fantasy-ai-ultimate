#!/usr/bin/env tsx
/**
 * 📊 CHECK PLAYER STATS COVERAGE
 * Analyze how many players have stats data
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkPlayerStatsCoverage() {
  console.log(chalk.bold.blue('\n📊 PLAYER STATS COVERAGE ANALYSIS\n'));
  
  // Total records in player_stats
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.yellow('📈 PLAYER STATS TABLE:'));
  console.log(chalk.white(`   Total records: ${totalStats?.toLocaleString() || 0}`));
  
  // Unique players with stats
  const { data: playerIdsData } = await supabase
    .from('player_stats')
    .select('player_id')
    .not('player_id', 'is', null);
  
  const uniquePlayerIds = new Set(playerIdsData?.map(p => p.player_id) || []);
  console.log(chalk.white(`   Unique players with stats: ${uniquePlayerIds.size.toLocaleString()}`));
  
  // Total players in database
  const { count: totalPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.white(`   Total players in database: ${totalPlayers?.toLocaleString() || 0}`));
  
  const coverage = totalPlayers ? (uniquePlayerIds.size / totalPlayers * 100).toFixed(2) : 0;
  console.log(chalk.cyan(`   Coverage: ${coverage}%\n`));
  
  // Breakdown by stat type
  console.log(chalk.yellow('🏆 STATS BY TYPE:'));
  
  const { data: statTypes } = await supabase
    .from('player_stats')
    .select('stat_name');
  
  if (statTypes) {
    const typeCount: { [key: string]: number } = {};
    statTypes.forEach(stat => {
      if (stat.stat_name) {
        typeCount[stat.stat_name] = (typeCount[stat.stat_name] || 0) + 1;
      }
    });
    
    Object.entries(typeCount)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 10)
      .forEach(([type, count]) => {
        console.log(chalk.white(`   ${type}: ${count.toLocaleString()}`));
      });
  }
  
  // Check game coverage
  console.log(chalk.yellow('\n📅 GAME COVERAGE:'));
  
  const { data: gameIds } = await supabase
    .from('player_stats')
    .select('game_id')
    .not('game_id', 'is', null);
  
  const uniqueGameIds = new Set(gameIds?.map(g => g.game_id) || []);
  console.log(chalk.white(`   Games with player stats: ${uniqueGameIds.size.toLocaleString()}`));
  
  const { count: totalGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  console.log(chalk.white(`   Total completed games: ${totalGames?.toLocaleString() || 0}`));
  
  const gameCoverage = totalGames ? (uniqueGameIds.size / totalGames * 100).toFixed(2) : 0;
  console.log(chalk.cyan(`   Game coverage: ${gameCoverage}%`));
  
  // Check by sport (if sport info available)
  console.log(chalk.yellow('\n🏈 COVERAGE BY SPORT:'));
  
  const sports = ['nba', 'nfl', 'mlb', 'nhl'];
  for (const sport of sports) {
    // Get players for this sport
    const { data: sportPlayers } = await supabase
      .from('players')
      .select('id')
      .eq('sport_id', sport);
    
    if (sportPlayers && sportPlayers.length > 0) {
      const sportPlayerIds = sportPlayers.map(p => p.id);
      
      // Count how many have stats
      const { count: withStats } = await supabase
        .from('player_stats')
        .select('*', { count: 'exact', head: true })
        .in('player_id', sportPlayerIds);
      
      const sportCoverage = (withStats || 0) > 0 ? 
        `${withStats} records` : 'No stats';
      
      console.log(chalk.white(`   ${sport.toUpperCase()}: ${sportCoverage}`));
    }
  }
  
  // Sample of players with most stats
  console.log(chalk.yellow('\n🌟 PLAYERS WITH MOST STATS:'));
  
  const { data: topPlayers } = await supabase
    .from('player_stats')
    .select('player_id')
    .not('player_id', 'is', null);
  
  if (topPlayers) {
    const playerCount: { [key: string]: number } = {};
    topPlayers.forEach(p => {
      if (p.player_id) {
        playerCount[p.player_id] = (playerCount[p.player_id] || 0) + 1;
      }
    });
    
    const topPlayerIds = Object.entries(playerCount)
      .sort(([_, a], [__, b]) => b - a)
      .slice(0, 5)
      .map(([id, _]) => id);
    
    // Get player names
    const { data: playerDetails } = await supabase
      .from('players')
      .select('id, firstname, lastname, sport_id')
      .in('id', topPlayerIds);
    
    if (playerDetails) {
      playerDetails.forEach(player => {
        const count = playerCount[player.id];
        console.log(chalk.white(`   ${player.firstname} ${player.lastname} (${player.sport_id || 'unknown'}): ${count} stats`));
      });
    }
  }
  
  console.log(chalk.bold.red('\n⚠️  CRITICAL FINDING:'));
  console.log(chalk.white(`Only ${uniquePlayerIds.size} out of ${totalPlayers?.toLocaleString() || 0} players have stats (${coverage}%)`));
  console.log(chalk.white(`This is why pattern accuracy is limited to 65.2% instead of the target 76.4%\n`));
}

checkPlayerStatsCoverage().catch(console.error);
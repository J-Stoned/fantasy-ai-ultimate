#!/usr/bin/env tsx
/**
 * 📊 CHECK TODAY'S NFL LOGS
 * Analyze what was inserted today
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTodaysNFLLogs() {
  console.log(chalk.bold.blue('\n🏈 TODAY\'S NFL LOGS ANALYSIS\n'));
  
  const today = new Date().toISOString().split('T')[0];
  
  // Get all of today's logs
  const { data: todaysLogs, count: totalToday } = await supabase
    .from('player_game_logs')
    .select('player_id, game_id, stats', { count: 'exact' })
    .gte('created_at', today)
    .limit(1000); // Get a sample
  
  console.log(chalk.yellow('📅 TODAY\'S INSERTIONS:'));
  console.log(chalk.white(`   Total logs inserted today: ${totalToday?.toLocaleString() || 0}`));
  
  if (todaysLogs && todaysLogs.length > 0) {
    // Get player IDs
    const playerIds = [...new Set(todaysLogs.map(log => log.player_id).filter(id => id))];
    
    // Check which sport these players belong to
    const { data: players } = await supabase
      .from('players')
      .select('id, sport_id')
      .in('id', playerIds);
    
    const sportCounts: { [key: string]: number } = {};
    
    if (players) {
      // Create a map for quick lookup
      const playerSportMap = new Map(players.map(p => [p.id, p.sport_id]));
      
      // Count logs by sport
      todaysLogs.forEach(log => {
        if (log.player_id) {
          const sport = playerSportMap.get(log.player_id) || 'unknown';
          sportCounts[sport] = (sportCounts[sport] || 0) + 1;
        }
      });
    }
    
    console.log(chalk.yellow('\n🏆 BREAKDOWN BY SPORT (from sample):'));
    Object.entries(sportCounts).forEach(([sport, count]) => {
      const percentage = ((count / todaysLogs.length) * 100).toFixed(1);
      console.log(chalk.white(`   ${sport?.toUpperCase() || 'UNKNOWN'}: ${count} logs (${percentage}%)`));
    });
    
    // Estimate total NFL logs
    const nflSampleCount = sportCounts['nfl'] || 0;
    const nflPercentage = nflSampleCount / todaysLogs.length;
    const estimatedNFLLogs = Math.round(nflPercentage * (totalToday || 0));
    
    console.log(chalk.yellow('\n📊 NFL ESTIMATION:'));
    console.log(chalk.white(`   Sample size: ${todaysLogs.length} logs`));
    console.log(chalk.white(`   NFL in sample: ${nflSampleCount} logs`));
    console.log(chalk.white(`   NFL percentage: ${(nflPercentage * 100).toFixed(1)}%`));
    console.log(chalk.cyan(`   Estimated NFL logs today: ${estimatedNFLLogs.toLocaleString()}`));
  }
  
  // Check specific NFL logs
  console.log(chalk.yellow('\n🏈 VERIFYING NFL LOGS:'));
  
  // Get all NFL player IDs
  const { data: nflPlayers } = await supabase
    .from('players')
    .select('id')
    .eq('sport_id', 'nfl')
    .limit(1000);
  
  if (nflPlayers) {
    const nflPlayerIds = nflPlayers.map(p => p.id);
    
    // Count today's logs for these NFL players
    const { count: confirmedNFLLogs } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('player_id', nflPlayerIds)
      .gte('created_at', today);
    
    console.log(chalk.white(`   Confirmed NFL logs (first 1000 players): ${confirmedNFLLogs?.toLocaleString() || 0}`));
    
    // Get some examples
    const { data: examples } = await supabase
      .from('player_game_logs')
      .select('*')
      .in('player_id', nflPlayerIds.slice(0, 100))
      .gte('created_at', today)
      .limit(5);
    
    if (examples && examples.length > 0) {
      console.log(chalk.yellow('\n📋 NFL LOG EXAMPLES:'));
      
      for (const log of examples) {
        const { data: player } = await supabase
          .from('players')
          .select('firstname, lastname')
          .eq('id', log.player_id)
          .single();
        
        const stats = log.stats ? Object.keys(log.stats).join(', ') : 'No stats';
        console.log(chalk.white(`   ${player?.firstname} ${player?.lastname}: ${stats}`));
      }
    }
  }
  
  // Calculate real coverage
  console.log(chalk.yellow('\n📈 REAL NFL COVERAGE:'));
  
  const { count: totalNFLGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  const { count: totalNFLPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl');
  
  console.log(chalk.white(`   Total NFL games: ${totalNFLGames?.toLocaleString() || 0}`));
  console.log(chalk.white(`   Total NFL players: ${totalNFLPlayers?.toLocaleString() || 0}`));
  console.log(chalk.white(`   Expected logs (avg 22 players/game): ${((totalNFLGames || 0) * 22).toLocaleString()}`));
  
  console.log(chalk.bold.green('\n✅ SUMMARY:'));
  if (sportCounts['nfl']) {
    console.log(chalk.white(`   NFL logs were successfully inserted today!`));
    console.log(chalk.white(`   The ${estimatedNFLLogs.toLocaleString()} NFL logs represent significant coverage`));
  } else {
    console.log(chalk.red(`   No NFL logs found in sample - checking further...`));
  }
  
  console.log(chalk.bold.blue('\n📊 ANALYSIS COMPLETE!\n'));
}

checkTodaysNFLLogs().catch(console.error);
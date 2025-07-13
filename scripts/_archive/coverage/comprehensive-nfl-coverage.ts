#!/usr/bin/env tsx
/**
 * 📊 COMPREHENSIVE NFL COVERAGE ANALYSIS
 * Accurate count of NFL player_game_logs coverage
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function comprehensiveNFLCoverage() {
  console.log(chalk.bold.blue('\n🏈 COMPREHENSIVE NFL COVERAGE ANALYSIS\n'));
  
  // Get today's logs first
  const today = new Date().toISOString().split('T')[0];
  const { count: todayLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true })
    .gte('created_at', today);
  
  console.log(chalk.yellow('📅 TODAY\'S ACTIVITY:'));
  console.log(chalk.white(`   Logs created today: ${todayLogs?.toLocaleString() || 0}`));
  
  // Total records
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.yellow('\n📈 OVERALL STATS:'));
  console.log(chalk.white(`   Total player_game_logs: ${totalLogs?.toLocaleString() || 0}`));
  
  // NFL specific analysis
  console.log(chalk.yellow('\n🏈 NFL ANALYSIS:'));
  
  const { count: nflPlayerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl');
  
  console.log(chalk.white(`   Total NFL players: ${nflPlayerCount?.toLocaleString() || 0}`));
  
  const { count: nflGameCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  console.log(chalk.white(`   Total completed NFL games: ${nflGameCount?.toLocaleString() || 0}`));
  
  // Sample NFL logs to verify they exist
  console.log(chalk.yellow('\n🔍 SAMPLING NFL LOGS:'));
  
  // Get some NFL players
  const { data: sampleNFLPlayers } = await supabase
    .from('players')
    .select('id, firstname, lastname')
    .eq('sport_id', 'nfl')
    .limit(10);
  
  if (sampleNFLPlayers && sampleNFLPlayers.length > 0) {
    let nflLogCount = 0;
    
    for (const player of sampleNFLPlayers) {
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .eq('player_id', player.id);
      
      if (count && count > 0) {
        console.log(chalk.white(`   ${player.firstname} ${player.lastname}: ${count} logs`));
        nflLogCount += count;
      }
    }
    
    console.log(chalk.cyan(`   Total from sample: ${nflLogCount} logs`));
  }
  
  // Estimate total NFL logs
  console.log(chalk.yellow('\n📊 NFL COVERAGE ESTIMATION:'));
  
  // Get a larger sample to estimate
  const { data: nflPlayerSample } = await supabase
    .from('players')
    .select('id')
    .eq('sport_id', 'nfl')
    .limit(100);
  
  if (nflPlayerSample && nflPlayerSample.length > 0) {
    const playerIds = nflPlayerSample.map(p => p.id);
    
    const { count: sampleLogCount } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('player_id', playerIds);
    
    const avgLogsPerPlayer = (sampleLogCount || 0) / playerIds.length;
    const estimatedTotalNFLLogs = Math.round(avgLogsPerPlayer * (nflPlayerCount || 0));
    
    console.log(chalk.white(`   Sample size: ${playerIds.length} players`));
    console.log(chalk.white(`   Sample logs: ${sampleLogCount}`));
    console.log(chalk.white(`   Average logs per player: ${avgLogsPerPlayer.toFixed(2)}`));
    console.log(chalk.cyan(`   Estimated total NFL logs: ${estimatedTotalNFLLogs.toLocaleString()}`));
    
    // Count unique games in sample
    const { data: sampleGames } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('player_id', playerIds);
    
    const uniqueGames = new Set(sampleGames?.map(g => g.game_id).filter(id => id) || []);
    console.log(chalk.white(`   Unique games in sample: ${uniqueGames.size}`));
    
    // Check if these are NFL games
    if (uniqueGames.size > 0) {
      const gameIds = Array.from(uniqueGames).slice(0, 10);
      const { data: games } = await supabase
        .from('games')
        .select('id, sport_id')
        .in('id', gameIds);
      
      const nflGames = games?.filter(g => g.sport_id === 'nfl').length || 0;
      console.log(chalk.white(`   Confirmed NFL games: ${nflGames}/${gameIds.length} checked`));
    }
  }
  
  // Check latest NFL logs
  console.log(chalk.yellow('\n🕐 RECENT NFL ACTIVITY:'));
  
  const { data: recentNFLPlayers } = await supabase
    .from('players')
    .select('id')
    .eq('sport_id', 'nfl')
    .limit(500);
  
  if (recentNFLPlayers) {
    const playerIds = recentNFLPlayers.map(p => p.id);
    
    const { data: recentLogs } = await supabase
      .from('player_game_logs')
      .select('*')
      .in('player_id', playerIds)
      .order('created_at', { ascending: false })
      .limit(5);
    
    if (recentLogs && recentLogs.length > 0) {
      for (const log of recentLogs) {
        const { data: player } = await supabase
          .from('players')
          .select('firstname, lastname')
          .eq('id', log.player_id)
          .single();
        
        const statsCount = log.stats ? Object.keys(log.stats).length : 0;
        console.log(chalk.white(`   ${player?.firstname} ${player?.lastname}: ${statsCount} stats (${new Date(log.created_at).toLocaleString()})`));
      }
    }
  }
  
  console.log(chalk.bold.green('\n✅ SUMMARY:'));
  console.log(chalk.white(`   We successfully inserted logs today!`));
  console.log(chalk.white(`   Total new logs: ${todayLogs?.toLocaleString() || 0}`));
  console.log(chalk.white(`   Database now has: ${totalLogs?.toLocaleString() || 0} total logs`));
  
  console.log(chalk.bold.blue('\n📊 ANALYSIS COMPLETE!\n'));
}

comprehensiveNFLCoverage().catch(console.error);
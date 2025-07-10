#!/usr/bin/env tsx
/**
 * 📊 REAL NFL COVERAGE CHECK
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

async function checkRealNFLCoverage() {
  console.log(chalk.bold.blue('\n🏈 REAL NFL GAME LOGS COVERAGE ANALYSIS\n'));
  
  // Total records in player_game_logs
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  console.log(chalk.yellow('📈 PLAYER GAME LOGS TABLE:'));
  console.log(chalk.white(`   Total records: ${totalLogs?.toLocaleString() || 0}`));
  
  // Get all NFL player IDs
  const { data: nflPlayers } = await supabase
    .from('players')
    .select('id')
    .eq('sport_id', 'nfl');
  
  const nflPlayerIds = nflPlayers?.map(p => p.id) || [];
  console.log(chalk.white(`   Total NFL players: ${nflPlayerIds.length.toLocaleString()}`));
  
  // Count NFL logs by checking player_ids
  // We'll do this in batches to avoid query size limits
  let totalNFLLogs = 0;
  const batchSize = 500;
  
  for (let i = 0; i < nflPlayerIds.length; i += batchSize) {
    const batch = nflPlayerIds.slice(i, i + batchSize);
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('player_id', batch);
    
    totalNFLLogs += count || 0;
    process.stdout.write(`\r   Counting NFL logs... ${i + batch.length}/${nflPlayerIds.length} players processed`);
  }
  
  console.log(`\r   NFL game logs found: ${totalNFLLogs.toLocaleString()}                              `);
  
  // Get unique NFL games with logs
  console.log(chalk.yellow('\n📅 NFL GAME COVERAGE:'));
  
  // Get all NFL game IDs
  const { data: nflGames } = await supabase
    .from('games')
    .select('id')
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  const nflGameIds = nflGames?.map(g => g.id) || [];
  console.log(chalk.white(`   Total completed NFL games: ${nflGameIds.length.toLocaleString()}`));
  
  // Count games with logs
  let gamesWithLogs = 0;
  const gameBatchSize = 100;
  
  for (let i = 0; i < nflGameIds.length; i += gameBatchSize) {
    const batch = nflGameIds.slice(i, i + gameBatchSize);
    const { data } = await supabase
      .from('player_game_logs')
      .select('game_id')
      .in('game_id', batch)
      .limit(1);
    
    if (data && data.length > 0) {
      // Count unique games in this batch
      const { data: uniqueGames } = await supabase
        .from('player_game_logs')
        .select('game_id')
        .in('game_id', batch);
      
      const uniqueGameSet = new Set(uniqueGames?.map(g => g.game_id) || []);
      gamesWithLogs += uniqueGameSet.size;
    }
    
    process.stdout.write(`\r   Checking games... ${i + batch.length}/${nflGameIds.length} processed`);
  }
  
  console.log(`\r   NFL games with logs: ${gamesWithLogs.toLocaleString()}                          `);
  
  const gameCoverage = nflGameIds.length > 0 ? (gamesWithLogs / nflGameIds.length * 100).toFixed(2) : 0;
  console.log(chalk.cyan(`   NFL game coverage: ${gameCoverage}%`));
  
  // Count unique NFL players with logs
  console.log(chalk.yellow('\n👥 NFL PLAYER COVERAGE:'));
  
  // Get unique player IDs from logs
  const uniquePlayerIds = new Set<string>();
  
  for (let i = 0; i < nflPlayerIds.length; i += batchSize) {
    const batch = nflPlayerIds.slice(i, i + batchSize);
    const { data } = await supabase
      .from('player_game_logs')
      .select('player_id')
      .in('player_id', batch);
    
    if (data) {
      data.forEach(log => {
        if (log.player_id) uniquePlayerIds.add(log.player_id);
      });
    }
    
    process.stdout.write(`\r   Finding unique players... ${i + batch.length}/${nflPlayerIds.length} processed`);
  }
  
  console.log(`\r   NFL players with logs: ${uniquePlayerIds.size.toLocaleString()}                          `);
  
  const playerCoverage = nflPlayerIds.length > 0 ? (uniquePlayerIds.size / nflPlayerIds.length * 100).toFixed(2) : 0;
  console.log(chalk.cyan(`   NFL player coverage: ${playerCoverage}%`));
  
  // Sample recent NFL logs
  console.log(chalk.yellow('\n📊 RECENT NFL LOGS:'));
  
  // Get a few NFL player IDs to sample
  const samplePlayerIds = nflPlayerIds.slice(0, 100);
  const { data: recentLogs } = await supabase
    .from('player_game_logs')
    .select('*')
    .in('player_id', samplePlayerIds)
    .order('created_at', { ascending: false })
    .limit(5);
  
  if (recentLogs && recentLogs.length > 0) {
    for (const log of recentLogs) {
      const { data: player } = await supabase
        .from('players')
        .select('firstname, lastname')
        .eq('id', log.player_id)
        .single();
      
      const playerName = player ? `${player.firstname} ${player.lastname}` : 'Unknown';
      const statsCount = log.stats ? Object.keys(log.stats).length : 0;
      console.log(chalk.white(`   ${playerName}: ${statsCount} stats, ${log.fantasy_points || 0} fantasy points`));
    }
  }
  
  // Summary
  console.log(chalk.bold.green('\n✅ NFL GAME LOGS SUMMARY:'));
  console.log(chalk.white(`   Total logs in database: ${totalLogs?.toLocaleString()}`));
  console.log(chalk.white(`   NFL logs: ${totalNFLLogs.toLocaleString()} (${((totalNFLLogs / (totalLogs || 1)) * 100).toFixed(1)}%)`));
  console.log(chalk.white(`   Games covered: ${gamesWithLogs} / ${nflGameIds.length} (${gameCoverage}%)`));
  console.log(chalk.white(`   Players covered: ${uniquePlayerIds.size} / ${nflPlayerIds.length} (${playerCoverage}%)`));
  
  if (totalNFLLogs > 17000) {
    console.log(chalk.bold.yellow('\n🎯 COVERAGE UPDATE:'));
    console.log(chalk.white(`   We just added ${totalNFLLogs.toLocaleString()} NFL game logs!`));
    console.log(chalk.white(`   This represents ${gameCoverage}% of all NFL games`));
    console.log(chalk.white(`   Pattern accuracy should improve significantly!`));
  }
  
  console.log(chalk.bold.blue('\n📊 ANALYSIS COMPLETE!\n'));
}

checkRealNFLCoverage().catch(console.error);
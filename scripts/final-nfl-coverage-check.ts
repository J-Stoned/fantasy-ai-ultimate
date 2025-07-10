#!/usr/bin/env tsx
/**
 * 📊 FINAL NFL COVERAGE CHECK
 * Accurate final analysis of NFL coverage
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function finalNFLCoverageCheck() {
  console.log(chalk.bold.blue('\n🏈 FINAL NFL COVERAGE ANALYSIS\n'));
  
  // Basic stats
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const { count: totalNFLPlayers } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl');
  
  const { count: totalNFLGames } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  console.log(chalk.yellow('📊 DATABASE TOTALS:'));
  console.log(chalk.white(`   Total player_game_logs: ${totalLogs?.toLocaleString() || 0}`));
  console.log(chalk.white(`   Total NFL players: ${totalNFLPlayers?.toLocaleString() || 0}`));
  console.log(chalk.white(`   Total completed NFL games: ${totalNFLGames?.toLocaleString() || 0}`));
  
  // Count NFL logs by sampling
  console.log(chalk.yellow('\n🔍 CALCULATING NFL LOGS:'));
  
  // Get all NFL players in batches and count their logs
  let totalNFLLogs = 0;
  let playersWithLogs = 0;
  const batchSize = 1000;
  
  const { data: allNFLPlayers } = await supabase
    .from('players')
    .select('id')
    .eq('sport_id', 'nfl')
    .limit(15000); // Get all NFL players
  
  if (allNFLPlayers) {
    console.log(chalk.white(`   Processing ${allNFLPlayers.length} NFL players...`));
    
    for (let i = 0; i < allNFLPlayers.length; i += batchSize) {
      const batch = allNFLPlayers.slice(i, i + batchSize);
      const playerIds = batch.map(p => p.id);
      
      const { count } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .in('player_id', playerIds);
      
      if (count) {
        totalNFLLogs += count;
        
        // Count how many players have logs
        const { data: playersInBatch } = await supabase
          .from('player_game_logs')
          .select('player_id')
          .in('player_id', playerIds);
        
        const uniquePlayers = new Set(playersInBatch?.map(p => p.player_id) || []);
        playersWithLogs += uniquePlayers.size;
      }
      
      process.stdout.write(`\r   Progress: ${Math.min(i + batchSize, allNFLPlayers.length)}/${allNFLPlayers.length} players processed`);
    }
    
    console.log(`\r   ✅ Processing complete!                                                    `);
  }
  
  // Calculate coverage percentages
  const playerCoverage = totalNFLPlayers ? (playersWithLogs / totalNFLPlayers * 100).toFixed(2) : 0;
  const avgLogsPerPlayer = playersWithLogs > 0 ? (totalNFLLogs / playersWithLogs).toFixed(1) : 0;
  
  console.log(chalk.yellow('\n📈 NFL COVERAGE RESULTS:'));
  console.log(chalk.white(`   Total NFL logs found: ${chalk.green(totalNFLLogs.toLocaleString())}`));
  console.log(chalk.white(`   NFL players with logs: ${playersWithLogs.toLocaleString()} / ${totalNFLPlayers?.toLocaleString() || 0}`));
  console.log(chalk.cyan(`   Player coverage: ${playerCoverage}%`));
  console.log(chalk.white(`   Average logs per player: ${avgLogsPerPlayer}`));
  
  // Estimate game coverage
  const avgPlayersPerGame = 44; // 22 per team * 2 teams
  const estimatedGamesWithLogs = Math.round(totalNFLLogs / avgPlayersPerGame);
  const gameCoverage = totalNFLGames ? (estimatedGamesWithLogs / totalNFLGames * 100).toFixed(2) : 0;
  
  console.log(chalk.yellow('\n🏟️ GAME COVERAGE ESTIMATION:'));
  console.log(chalk.white(`   Estimated games with logs: ${estimatedGamesWithLogs.toLocaleString()}`));
  console.log(chalk.cyan(`   Estimated game coverage: ${gameCoverage}%`));
  
  // Show the breakdown
  console.log(chalk.yellow('\n📊 SPORT BREAKDOWN:'));
  const nflPercentage = totalLogs ? (totalNFLLogs / totalLogs * 100).toFixed(1) : 0;
  console.log(chalk.white(`   NFL: ${totalNFLLogs.toLocaleString()} logs (${nflPercentage}%)`));
  console.log(chalk.white(`   Other sports: ${((totalLogs || 0) - totalNFLLogs).toLocaleString()} logs`));
  
  // Summary
  console.log(chalk.bold.green('\n✅ FINAL SUMMARY:'));
  console.log(chalk.white(`   ${chalk.green('SUCCESS!')} We have ${chalk.green(totalNFLLogs.toLocaleString())} NFL player game logs`));
  console.log(chalk.white(`   This covers ${chalk.green(playerCoverage + '%')} of NFL players`));
  console.log(chalk.white(`   Approximately ${chalk.green(gameCoverage + '%')} of NFL games have player stats`));
  
  if (totalNFLLogs > 60000) {
    console.log(chalk.bold.yellow('\n🎯 PATTERN ACCURACY IMPACT:'));
    console.log(chalk.white(`   With ${totalNFLLogs.toLocaleString()} NFL logs, pattern accuracy should improve!`));
    console.log(chalk.white(`   Previous coverage: 0.3% → Current: ${playerCoverage}%`));
    console.log(chalk.white(`   This is a ${chalk.green((parseFloat(playerCoverage) / 0.3).toFixed(0) + 'x')} improvement!`));
  }
  
  console.log(chalk.bold.blue('\n📊 ANALYSIS COMPLETE!\n'));
}

finalNFLCoverageCheck().catch(console.error);
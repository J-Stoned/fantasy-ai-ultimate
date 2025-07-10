#!/usr/bin/env tsx
/**
 * Accurate NFL player game logs count
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function accurateNFLCount() {
  console.log(chalk.bold.blue('\n🏈 ACCURATE NFL COUNT\n'));
  
  // First, let's check if the issue is with the player fetch
  const { count: nflPlayerCount } = await supabase
    .from('players')
    .select('*', { count: 'exact', head: true })
    .eq('sport_id', 'nfl');
  
  console.log(chalk.white(`Total NFL players: ${nflPlayerCount}`));
  
  // Get players without limit issue by using pagination
  let allNFLPlayerIds: string[] = [];
  let offset = 0;
  const pageSize = 1000;
  
  while (true) {
    const { data: batch } = await supabase
      .from('players')
      .select('id')
      .eq('sport_id', 'nfl')
      .range(offset, offset + pageSize - 1);
    
    if (!batch || batch.length === 0) break;
    
    allNFLPlayerIds = allNFLPlayerIds.concat(batch.map(p => p.id));
    offset += pageSize;
    
    console.log(`Fetched ${allNFLPlayerIds.length} NFL player IDs...`);
    
    if (batch.length < pageSize) break;
  }
  
  console.log(chalk.yellow(`\nTotal NFL player IDs fetched: ${allNFLPlayerIds.length}`));
  
  // Now count logs for all these players
  let totalNFLLogs = 0;
  const batchSize = 500;
  
  console.log(chalk.yellow('\nCounting NFL logs...'));
  
  for (let i = 0; i < allNFLPlayerIds.length; i += batchSize) {
    const batch = allNFLPlayerIds.slice(i, i + batchSize);
    
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('player_id', batch);
    
    totalNFLLogs += count || 0;
    
    process.stdout.write(`\rProgress: ${i + batch.length}/${allNFLPlayerIds.length} players checked, ${totalNFLLogs} logs found`);
  }
  
  console.log(chalk.green(`\n\n✅ FINAL NFL LOG COUNT: ${totalNFLLogs.toLocaleString()}`));
  
  // Calculate percentages
  const { count: totalLogs } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });
  
  const nflPercentage = totalLogs ? (totalNFLLogs / totalLogs * 100).toFixed(2) : 0;
  
  console.log(chalk.white(`\nNFL logs: ${totalNFLLogs.toLocaleString()} / ${totalLogs?.toLocaleString() || 0} total (${nflPercentage}%)`));
  
  // Check today's insertions
  const today = new Date().toISOString().split('T')[0];
  let todayNFLLogs = 0;
  
  for (let i = 0; i < allNFLPlayerIds.length; i += batchSize) {
    const batch = allNFLPlayerIds.slice(i, i + batchSize);
    
    const { count } = await supabase
      .from('player_game_logs')
      .select('*', { count: 'exact', head: true })
      .in('player_id', batch)
      .gte('created_at', today);
    
    todayNFLLogs += count || 0;
  }
  
  console.log(chalk.yellow(`\nNFL logs inserted today: ${todayNFLLogs.toLocaleString()}`));
  
  // Corrected player coverage
  const playerCoverage = nflPlayerCount ? (totalNFLLogs / nflPlayerCount * 100).toFixed(2) : 0;
  console.log(chalk.cyan(`\nActual NFL player coverage: NOT ${playerCoverage}% (that would assume 1 log per player)`));
  
  // Count unique players with logs
  const uniquePlayers = new Set<string>();
  
  for (let i = 0; i < allNFLPlayerIds.length; i += batchSize) {
    const batch = allNFLPlayerIds.slice(i, i + batchSize);
    
    const { data: logs } = await supabase
      .from('player_game_logs')
      .select('player_id')
      .in('player_id', batch);
    
    if (logs) {
      logs.forEach(log => {
        if (log.player_id) uniquePlayers.add(log.player_id);
      });
    }
  }
  
  const realPlayerCoverage = nflPlayerCount ? (uniquePlayers.size / nflPlayerCount * 100).toFixed(2) : 0;
  console.log(chalk.cyan(`Real NFL player coverage: ${uniquePlayers.size} / ${nflPlayerCount} players (${realPlayerCoverage}%)`));
  
  console.log(chalk.bold.blue('\n📊 COMPLETE!\n'));
}

accurateNFLCount().catch(console.error);
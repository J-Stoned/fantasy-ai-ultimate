#!/usr/bin/env tsx

import { enhancedDb } from '../lib/services/enhanced-database-service';
import chalk from 'chalk';

async function checkRealCoverage() {
  console.log(chalk.bold.red('🔥 REAL COVERAGE CHECK'));
  console.log(chalk.gray('='.repeat(60)));

  // Count ALL player game logs
  const { count: totalLogs } = await enhancedDb.getClient()
    .from('player_game_logs')
    .select('*', { count: 'exact', head: true });

  console.log(chalk.green(`Total player game logs: ${totalLogs?.toLocaleString()}`));

  // Get ALL unique games with stats in chunks
  const uniqueGames = new Set<number>();
  const chunkSize = 50000;
  
  for (let offset = 0; offset < (totalLogs || 0); offset += chunkSize) {
    const { data: chunk } = await enhancedDb.getClient()
      .from('player_game_logs')
      .select('game_id')
      .range(offset, Math.min(offset + chunkSize - 1, (totalLogs || 0) - 1));
    
    chunk?.forEach(row => uniqueGames.add(row.game_id));
    console.log(chalk.gray(`Processed ${offset + chunk?.length} / ${totalLogs} logs...`));
  }

  console.log(chalk.green(`\n✅ UNIQUE GAMES WITH STATS: ${uniqueGames.size.toLocaleString()}`));

  // Get total games
  const { count: totalGames } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null);

  const { count: espnGames } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .like('external_id', 'espn_%')
    .not('home_score', 'is', null);

  const coverage = ((uniqueGames.size / (totalGames || 1)) * 100).toFixed(1);
  const espnCoverage = ((uniqueGames.size / (espnGames || 1)) * 100).toFixed(1);

  console.log(chalk.yellow('\n📊 COVERAGE STATS:'));
  console.log(`Total games: ${totalGames?.toLocaleString()}`);
  console.log(`ESPN games: ${espnGames?.toLocaleString()}`);
  console.log(`Coverage (all games): ${coverage}%`);
  console.log(`Coverage (ESPN games): ${espnCoverage}%`);

  if (uniqueGames.size > 100) {
    console.log(chalk.bold.green('\n🎉 MASSIVE PROGRESS ACHIEVED!'));
    console.log(chalk.yellow(`We now have stats for ${uniqueGames.size.toLocaleString()} games!`));
  }

  // Show some recent game IDs
  const recentGames = Array.from(uniqueGames).slice(-10);
  console.log(chalk.cyan('\nSample game IDs with stats:'));
  recentGames.forEach(id => console.log(`  - Game ${id}`));
}

checkRealCoverage().catch(console.error);
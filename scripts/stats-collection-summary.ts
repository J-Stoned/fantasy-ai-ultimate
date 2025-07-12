#!/usr/bin/env tsx

import { enhancedDb } from '../lib/services/enhanced-database-service';
import chalk from 'chalk';

async function getFullSummary() {
  console.log(chalk.bold.red('🔥 PLAYER STATS COLLECTION SUMMARY'));
  console.log(chalk.gray('='.repeat(60)));

  // Get unique games with stats (more efficient approach)
  const { data: uniqueGamesData } = await enhancedDb.getClient()
    .from('player_game_logs')
    .select('game_id')
    .not('stats', 'is', null);
    
  // Get a sample of logs for detailed analysis
  const { data: sampleLogs } = await enhancedDb.getClient()
    .from('player_game_logs')
    .select('game_id, player_id, stats, fantasy_points')
    .not('stats', 'is', null)
    .limit(10000);

  // Process unique games
  const allUniqueGames = new Set(uniqueGamesData?.map(g => g.game_id) || []);
  
  // Process sample to find games with real stats
  const gamesWithStats = new Map<number, number>(); // game_id -> player count
  let totalWithRealStats = 0;

  sampleLogs?.forEach(log => {
    if (log.stats && typeof log.stats === 'object' && Object.keys(log.stats).length > 0) {
      gamesWithStats.set(log.game_id, (gamesWithStats.get(log.game_id) || 0) + 1);
      totalWithRealStats++;
    }
  });

  console.log(chalk.green(`✅ Total unique games with any stats: ${allUniqueGames.size.toLocaleString()}`));
  console.log(chalk.green(`✅ Sample games with real stats: ${gamesWithStats.size} (from ${sampleLogs?.length} logs)`));
  console.log(chalk.green(`✅ Average players per game: ${gamesWithStats.size > 0 ? (totalWithRealStats / gamesWithStats.size).toFixed(1) : 'N/A'}`));

  // Show breakdown by recent games
  const recentGames = Array.from(gamesWithStats.entries())
    .sort((a, b) => b[0] - a[0])
    .slice(0, 10);

  console.log(chalk.cyan('\n📊 Recent games with stats:'));
  for (const [gameId, playerCount] of recentGames) {
    const { data: game } = await enhancedDb.getClient()
      .from('games')
      .select('sport, start_time, external_id')
      .eq('id', gameId)
      .single();

    if (game) {
      console.log(`  - Game ${gameId}: ${game.sport} - ${playerCount} players (${new Date(game.start_time).toLocaleDateString()})`);
    }
  }

  // Calculate coverage
  const { count: totalGames } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .lt('start_time', new Date().toISOString());

  const { count: espnGames } = await enhancedDb.getClient()
    .from('games')
    .select('*', { count: 'exact', head: true })
    .like('external_id', 'espn_%')
    .not('home_score', 'is', null)
    .lt('start_time', new Date().toISOString());

  const coverage = (gamesWithStats.size / (totalGames || 1) * 100).toFixed(1);
  const espnCoverage = (gamesWithStats.size / (espnGames || 1) * 100).toFixed(1);

  console.log(chalk.yellow('\n📈 Coverage Progress:'));
  console.log(`Total coverage: ${coverage}% (${gamesWithStats.size} of ${totalGames} games)`);
  console.log(`ESPN games coverage: ${espnCoverage}% (${gamesWithStats.size} of ${espnGames} games)`);

  if (gamesWithStats.size > 35) {
    console.log(chalk.bold.green('\n🎉 SIGNIFICANT PROGRESS MADE!'));
    console.log(chalk.yellow(`Increased from 35 games to ${gamesWithStats.size} games with stats!`));
  }

  // Next steps
  const remaining = (espnGames || 0) - gamesWithStats.size;
  console.log(chalk.cyan('\n🎯 Next Steps:'));
  console.log(`Games remaining: ${remaining.toLocaleString()}`);
  console.log(`Run the aggressive collector to continue: npx tsx scripts/turbo-collect-all-player-stats-aggressive.ts`);
}

getFullSummary().catch(console.error);
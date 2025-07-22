#!/usr/bin/env tsx
/**
 * 🏆 MASTER STATS COLLECTOR - RUN ALL SPORTS
 * 
 * Collects stats for all 110,434 games across all sports
 * Total expected: 2-3 MILLION player stats!
 */

import chalk from 'chalk';
import { NFLStatsCollector } from './collectors/nfl-stats-collector';
import { NBAStatsCollector } from './collectors/nba-stats-collector';
import { MLBStatsCollector } from './collectors/mlb-stats-collector';
import { NHLStatsCollector } from './collectors/nhl-stats-collector';
import pgPool from './pg-config';

async function collectAllStats() {
  const startTime = Date.now();
  
  console.log(chalk.red.bold('\n🔥🔥🔥 MASTER STATS COLLECTOR - ALL SPORTS 🔥🔥🔥\n'));
  console.log(chalk.yellow('📊 Target: 110,434 games → 2-3 MILLION player stats'));
  console.log(chalk.yellow('⚡ Using sport-specific optimized collectors'));
  console.log(chalk.yellow('⏱️  Expected time: 10-15 minutes total\n'));
  
  try {
    // Show current stats
    await showCurrentStats();
    
    // Collect each sport in order of importance for fantasy
    console.log(chalk.cyan.bold('\n🏈 Starting NFL collection...'));
    const nflCollector = new NFLStatsCollector();
    await nflCollector.collect();
    
    console.log(chalk.cyan.bold('\n🏀 Starting NBA collection...'));
    const nbaCollector = new NBAStatsCollector();
    await nbaCollector.collect();
    
    console.log(chalk.cyan.bold('\n⚾ Starting MLB collection...'));
    const mlbCollector = new MLBStatsCollector();
    await mlbCollector.collect();
    
    console.log(chalk.cyan.bold('\n🏒 Starting NHL collection...'));
    const nhlCollector = new NHLStatsCollector();
    await nhlCollector.collect();
    
    // Show final summary
    await showFinalSummary(startTime);
    
  } catch (error) {
    console.error(chalk.red('\n❌ Master collection failed:'), error);
  } finally {
    await pgPool.end();
  }
}

async function showCurrentStats() {
  const result = await pgPool.query(`
    SELECT 
      sport,
      COUNT(DISTINCT game_id) as games_with_stats,
      COUNT(*) as total_player_stats
    FROM player_game_stats
    GROUP BY sport
    ORDER BY total_player_stats DESC
  `);
  
  if (result.rows.length > 0) {
    console.log(chalk.cyan('📊 Current stats in database:'));
    console.log(chalk.cyan('Sport       | Games | Player Stats'));
    console.log(chalk.cyan('------------|-------|-------------'));
    
    let totalStats = 0;
    result.rows.forEach(row => {
      totalStats += parseInt(row.total_player_stats);
      console.log(
        `${row.sport.padEnd(11)} | ${row.games_with_stats.toString().padStart(5)} | ${parseInt(row.total_player_stats).toLocaleString().padStart(12)}`
      );
    });
    
    console.log(chalk.yellow(`\nTotal existing stats: ${totalStats.toLocaleString()}`));
  } else {
    console.log(chalk.yellow('No existing stats found. Starting fresh collection!'));
  }
}

async function showFinalSummary(startTime: number) {
  console.log(chalk.green.bold('\n\n🏆 FINAL COLLECTION SUMMARY:\n'));
  
  const summary = await pgPool.query(`
    SELECT 
      sport,
      COUNT(DISTINCT game_id) as games_with_stats,
      COUNT(*) as total_player_stats,
      COUNT(DISTINCT player_id) as unique_players
    FROM player_game_stats
    GROUP BY sport
    ORDER BY total_player_stats DESC
  `);
  
  console.log(chalk.cyan('Sport       | Games  | Player Stats | Unique Players'));
  console.log(chalk.cyan('------------|--------|--------------|---------------'));
  
  let totalGames = 0;
  let totalPlayerStats = 0;
  let totalUniquePlayers = 0;
  
  summary.rows.forEach(row => {
    totalGames += parseInt(row.games_with_stats);
    totalPlayerStats += parseInt(row.total_player_stats);
    totalUniquePlayers += parseInt(row.unique_players);
    
    console.log(
      `${row.sport.padEnd(11)} | ${row.games_with_stats.toString().padStart(6)} | ${parseInt(row.total_player_stats).toLocaleString().padStart(12)} | ${parseInt(row.unique_players).toLocaleString().padStart(14)}`
    );
  });
  
  console.log(chalk.yellow.bold(
    `\nTOTALS      | ${totalGames.toString().padStart(6)} | ${totalPlayerStats.toLocaleString().padStart(12)} | ${totalUniquePlayers.toLocaleString().padStart(14)}`
  ));
  
  const totalTime = (Date.now() - startTime) / 1000 / 60;
  console.log(chalk.green.bold(`\n✅ COLLECTION COMPLETE!`));
  console.log(chalk.yellow(`⏱️  Total time: ${totalTime.toFixed(1)} minutes`));
  console.log(chalk.yellow(`📊 Total stats collected: ${totalPlayerStats.toLocaleString()}`));
  console.log(chalk.yellow(`⚡ Average speed: ${(totalGames / (totalTime * 60)).toFixed(1)} games/second\n`));
  
  // Sample some stats
  const sample = await pgPool.query(`
    SELECT 
      p.name,
      pgs.sport,
      pgs.stats
    FROM player_game_stats pgs
    JOIN players_master p ON pgs.player_id = p.id
    WHERE pgs.stats IS NOT NULL
    ORDER BY RANDOM()
    LIMIT 5
  `);
  
  console.log(chalk.cyan('\n📋 Sample collected stats:'));
  sample.rows.forEach(row => {
    const statCount = Object.keys(row.stats).length;
    console.log(chalk.green(`${row.name} (${row.sport}): ${statCount} stats collected`));
  });
}

// Run the master collector
if (require.main === module) {
  collectAllStats().catch(console.error);
}
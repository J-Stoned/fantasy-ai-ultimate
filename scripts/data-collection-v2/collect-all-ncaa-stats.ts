#!/usr/bin/env tsx
/**
 * 🎓 MASTER NCAA STATS COLLECTOR - ALL SPORTS 🎓
 * 
 * Runs all NCAA sport collectors in sequence:
 * - NCAA Basketball: 2,931 games
 * - NCAA Football: 2,129 games  
 * - NCAA Baseball: 6,344 games
 * - NCAA Hockey: 2,321 games
 * Total: 13,725 games → ~200,000+ player stats
 */

import pgPool from './pg-config';
import chalk from 'chalk';
import { NCAABStatsCollector } from './collectors/ncaab-stats-collector';
import { NCAAFStatsCollector } from './collectors/ncaaf-stats-collector';
import { NCAABaseballStatsCollector } from './collectors/ncaa-baseball-stats-collector';
import { NCAAHockeyStatsCollector } from './collectors/ncaa-hockey-stats-collector';

async function collectAllNCAAStats() {
  const startTime = Date.now();
  
  console.log(chalk.yellow.bold('\n🎓🎓🎓 MASTER NCAA STATS COLLECTOR - ALL SPORTS 🎓🎓🎓\n'));
  console.log(chalk.cyan('📊 Target: 13,725 games → ~200,000 player stats'));
  console.log(chalk.cyan('⚡ Using sport-specific optimized collectors'));
  console.log(chalk.cyan('⏱️  Expected time: 5-10 minutes total\n'));
  
  try {
    // Check current stats
    const currentStats = await pgPool.query(`
      SELECT 
        sport,
        COUNT(*) as games,
        COUNT(*) as player_stats
      FROM player_game_stats
      WHERE sport LIKE 'NCAA%'
      GROUP BY sport
      ORDER BY sport
    `);
    
    console.log(chalk.yellow('📊 Current stats in database:'));
    if (currentStats.rows.length === 0) {
      console.log(chalk.gray('No NCAA stats collected yet\n'));
    } else {
      console.log(chalk.cyan('Sport       | Games | Player Stats'));
      console.log(chalk.cyan('------------|-------|-------------'));
      currentStats.rows.forEach(row => {
        console.log(`${row.sport.padEnd(11)} | ${row.games.toString().padStart(5)} | ${row.player_stats.toString().padStart(12)}`);
      });
      console.log();
    }
    
    // Run collectors in sequence
    
    // 1. NCAA Basketball
    console.log(chalk.blue.bold('🏀 Starting NCAA Basketball collection...'));
    const ncaabCollector = new NCAABStatsCollector();
    await ncaabCollector.collect();
    
    // 2. NCAA Football
    console.log(chalk.green.bold('🏈 Starting NCAA Football collection...'));
    const ncaafCollector = new NCAAFStatsCollector();
    await ncaafCollector.collect();
    
    // 3. NCAA Baseball
    console.log(chalk.red.bold('⚾ Starting NCAA Baseball collection...'));
    const ncaaBaseballCollector = new NCAABaseballStatsCollector();
    await ncaaBaseballCollector.collect();
    
    // 4. NCAA Hockey
    console.log(chalk.cyan.bold('🏒 Starting NCAA Hockey collection...'));
    const ncaaHockeyCollector = new NCAAHockeyStatsCollector();
    await ncaaHockeyCollector.collect();
    
    // Final summary
    const finalStats = await pgPool.query(`
      SELECT 
        sport,
        COUNT(DISTINCT game_id) as games_with_stats,
        COUNT(*) as total_stats,
        COUNT(DISTINCT player_id) as unique_players
      FROM player_game_stats
      WHERE sport LIKE 'NCAA%'
      GROUP BY sport
      ORDER BY total_stats DESC
    `);
    
    console.log(chalk.green.bold('\n✅ ALL NCAA STATS COLLECTION COMPLETE!\n'));
    console.log(chalk.yellow('📊 Final NCAA Stats Summary:'));
    console.log(chalk.cyan('Sport          | Games | Stats   | Players'));
    console.log(chalk.cyan('---------------|-------|---------|--------'));
    
    let totalGames = 0;
    let totalStats = 0;
    let totalPlayers = 0;
    
    finalStats.rows.forEach(row => {
      console.log(
        `${row.sport.padEnd(14)} | ${row.games_with_stats.toString().padStart(5)} | ${parseInt(row.total_stats).toLocaleString().padStart(7)} | ${row.unique_players.toString().padStart(7)}`
      );
      totalGames += parseInt(row.games_with_stats);
      totalStats += parseInt(row.total_stats);
      totalPlayers += parseInt(row.unique_players);
    });
    
    console.log(chalk.cyan('---------------|-------|---------|--------'));
    console.log(chalk.green(
      `${'TOTAL'.padEnd(14)} | ${totalGames.toString().padStart(5)} | ${totalStats.toLocaleString().padStart(7)} | ${totalPlayers.toString().padStart(7)}`
    ));
    
    const totalTime = (Date.now() - startTime) / 1000;
    console.log(chalk.yellow(`\n⏱️  Total time: ${totalTime.toFixed(1)}s`));
    console.log(chalk.yellow(`⚡ Average speed: ${(totalStats / totalTime).toFixed(0)} stats/sec\n`));
    
  } catch (error) {
    console.error(chalk.red('\n❌ NCAA stats collection failed:'), error);
  } finally {
    await pgPool.end();
  }
}

// Run if called directly
if (require.main === module) {
  collectAllNCAAStats().catch(console.error);
}
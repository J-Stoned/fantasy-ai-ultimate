#!/usr/bin/env tsx
/**
 * 🚀 RUN COMPLETE MiLB STATS COLLECTION
 * 
 * Orchestrates the collection of stats for 81,587 MiLB games
 * Uses multiple strategies:
 * 1. MLB Stats API (primary)
 * 2. Web scraping fallback (if needed)
 * 3. Smart retry logic
 */

import chalk from 'chalk';
import { MiLBStatsUltraCollector } from './collectors/milb-stats-ultra-collector';
import { MiLBWebScraper } from './milb-scraper-mcp';
import { pgPool } from '../fantasy-ml/config/database';

async function runMiLBCollection() {
  console.log(chalk.red.bold('\n' + '='.repeat(60)));
  console.log(chalk.red.bold('⚾ COMPLETE MiLB STATS COLLECTION'));
  console.log(chalk.red.bold('='.repeat(60) + '\n'));
  
  const startTime = Date.now();
  
  try {
    // Check current status
    console.log(chalk.cyan('📊 Checking current MiLB stats coverage...\n'));
    
    const coverage = await pgPool.query(`
      SELECT 
        g.sport,
        COUNT(DISTINCT g.id) as total_games,
        COUNT(DISTINCT pgs.game_id) as games_with_stats,
        COUNT(pgs.id) as total_stats
      FROM games_master g
      LEFT JOIN player_game_stats pgs ON g.id = pgs.game_id
      WHERE g.sport LIKE 'MILB%'
      GROUP BY g.sport
      ORDER BY g.sport
    `);
    
    console.log(chalk.yellow('Current MiLB Coverage:'));
    let totalGames = 0;
    let totalWithStats = 0;
    
    coverage.rows.forEach(row => {
      const games = parseInt(row.total_games);
      const withStats = parseInt(row.games_with_stats);
      const stats = parseInt(row.total_stats);
      const percent = games > 0 ? (withStats / games * 100).toFixed(1) : '0.0';
      
      totalGames += games;
      totalWithStats += withStats;
      
      console.log(`  ${row.sport}: ${withStats.toLocaleString()}/${games.toLocaleString()} games (${percent}%) - ${stats.toLocaleString()} stats`);
    });
    
    const missingGames = totalGames - totalWithStats;
    console.log(chalk.cyan(`\n  TOTAL: ${totalWithStats.toLocaleString()}/${totalGames.toLocaleString()} games`));
    console.log(chalk.red(`  MISSING: ${missingGames.toLocaleString()} games need stats\n`));
    
    if (missingGames === 0) {
      console.log(chalk.green.bold('✅ All MiLB games already have stats!'));
      await pgPool.end();
      return;
    }
    
    // Step 1: Run ultra collector
    console.log(chalk.yellow.bold('📡 STEP 1: MLB STATS API COLLECTION...\n'));
    const apiCollector = new MiLBStatsUltraCollector();
    await apiCollector.collect();
    
    // Check results
    const afterApi = await pgPool.query(`
      SELECT COUNT(DISTINCT g.id) as games_without_stats
      FROM games_master g
      WHERE g.sport LIKE 'MILB%'
      AND NOT EXISTS (
        SELECT 1 FROM player_game_stats pgs 
        WHERE pgs.game_id = g.id
      )
    `);
    
    const remainingGames = parseInt(afterApi.rows[0].games_without_stats);
    
    if (remainingGames > 0) {
      console.log(chalk.yellow.bold(`\n🌐 STEP 2: WEB SCRAPING FOR ${remainingGames.toLocaleString()} REMAINING GAMES...\n`));
      console.log(chalk.gray('Note: Web scraping requires MCP Playwright server to be running'));
      console.log(chalk.gray('Run: npx @modelcontextprotocol/server-playwright'));
      
      const scraper = new MiLBWebScraper();
      await scraper.scrapeFailedGames();
    }
    
    // Final summary
    const finalCoverage = await pgPool.query(`
      SELECT 
        COUNT(DISTINCT g.id) as total_games,
        COUNT(DISTINCT pgs.game_id) as games_with_stats,
        COUNT(pgs.id) as total_stats
      FROM games_master g
      LEFT JOIN player_game_stats pgs ON g.id = pgs.game_id
      WHERE g.sport LIKE 'MILB%'
    `);
    
    const final = finalCoverage.rows[0];
    const finalPercent = (parseInt(final.games_with_stats) / parseInt(final.total_games) * 100).toFixed(1);
    
    const totalTime = (Date.now() - startTime) / 1000 / 60;
    console.log(chalk.green.bold('\n' + '='.repeat(60)));
    console.log(chalk.green.bold('✅ MiLB COLLECTION COMPLETE!'));
    console.log(chalk.green.bold('='.repeat(60)));
    console.log(chalk.yellow(`\n⏱️  Total time: ${totalTime.toFixed(1)} minutes`));
    console.log(chalk.yellow(`📊 Coverage: ${final.games_with_stats}/${final.total_games} games (${finalPercent}%)`));
    console.log(chalk.yellow(`📈 Total stats: ${parseInt(final.total_stats).toLocaleString()}`));
    
    // Next steps
    console.log(chalk.cyan.bold('\n🚀 NEXT STEPS:'));
    console.log(chalk.cyan('1. Phase 4: Collect betting lines and props'));
    console.log(chalk.cyan('2. Phase 5: Calculate fantasy points for all platforms'));
    console.log(chalk.cyan('3. Phase 6: Build ML models with complete dataset\n'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ MiLB COLLECTION FAILED:'), error);
  } finally {
    await pgPool.end();
  }
}

// Run the collection
if (require.main === module) {
  runMiLBCollection().catch(console.error);
}
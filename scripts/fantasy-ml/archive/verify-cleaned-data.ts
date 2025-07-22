#!/usr/bin/env tsx
/**
 * 🔍 VERIFY CLEANED DATA QUALITY
 * 
 * Quick check to see if our data is actually clean and ready for training
 */

import chalk from 'chalk';
import { pgPool } from './config/database';

async function verifyCleanedData() {
  console.log(chalk.blue.bold('🔍 VERIFYING CLEANED DATA QUALITY...\n'));
  
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  
  for (const sport of sports) {
    console.log(chalk.yellow(`\n=== ${sport} DATA CHECK ===`));
    
    // Check position distribution
    const positionQuery = `
      SELECT position, COUNT(*) as count
      FROM players
      WHERE sport = $1
      GROUP BY position
      ORDER BY count DESC
      LIMIT 10
    `;
    
    const positions = await pgPool.query(positionQuery, [sport]);
    console.log(chalk.cyan('Top positions:'));
    positions.rows.forEach(row => {
      console.log(`  ${row.position}: ${row.count}`);
    });
    
    // Check game logs with stats
    const statsQuery = `
      SELECT 
        COUNT(*) as total_logs,
        COUNT(DISTINCT pgl.player_id) as unique_players,
        AVG(pgl.fantasy_points) as avg_fantasy_points,
        MIN(pgl.fantasy_points) as min_fantasy,
        MAX(pgl.fantasy_points) as max_fantasy
      FROM player_game_logs pgl
      JOIN players p ON p.id = pgl.player_id
      WHERE p.sport = $1
      AND pgl.stats IS NOT NULL
      AND pgl.fantasy_points IS NOT NULL
    `;
    
    const stats = await pgPool.query(statsQuery, [sport]);
    const s = stats.rows[0];
    console.log(chalk.cyan('\nGame log stats:'));
    console.log(`  Total logs: ${s.total_logs}`);
    console.log(`  Unique players: ${s.unique_players}`);
    console.log(`  Avg fantasy points: ${parseFloat(s.avg_fantasy_points).toFixed(2)}`);
    console.log(`  Min fantasy: ${s.min_fantasy}`);
    console.log(`  Max fantasy: ${s.max_fantasy}`);
    
    // Sample some actual stats
    const sampleQuery = `
      SELECT 
        p.name,
        p.position,
        pgl.fantasy_points,
        pgl.stats
      FROM player_game_logs pgl
      JOIN players p ON p.id = pgl.player_id
      WHERE p.sport = $1
      AND pgl.stats IS NOT NULL
      AND pgl.fantasy_points IS NOT NULL
      ORDER BY RANDOM()
      LIMIT 3
    `;
    
    const samples = await pgPool.query(sampleQuery, [sport]);
    console.log(chalk.cyan('\nSample players:'));
    samples.rows.forEach(player => {
      const statKeys = Object.keys(JSON.parse(player.stats)).slice(0, 5);
      console.log(`  ${player.name} (${player.position}): ${player.fantasy_points} pts`);
      console.log(`    Stats: ${statKeys.join(', ')}...`);
    });
    
    // Check for data issues
    const issueQuery = `
      SELECT 
        COUNT(*) FILTER (WHERE pgl.fantasy_points < 0) as negative_fantasy,
        COUNT(*) FILTER (WHERE pgl.fantasy_points > 100) as extreme_fantasy,
        COUNT(*) FILTER (WHERE pgl.fantasy_points = 0) as zero_fantasy
      FROM player_game_logs pgl
      JOIN players p ON p.id = pgl.player_id
      WHERE p.sport = $1
    `;
    
    const issues = await pgPool.query(issueQuery, [sport]);
    const i = issues.rows[0];
    if (i.negative_fantasy > 0 || i.extreme_fantasy > 100) {
      console.log(chalk.red('\n⚠️ Data issues found:'));
      console.log(chalk.red(`  Negative fantasy points: ${i.negative_fantasy}`));
      console.log(chalk.red(`  Extreme fantasy (>100): ${i.extreme_fantasy}`));
      console.log(chalk.red(`  Zero fantasy points: ${i.zero_fantasy}`));
    }
  }
  
  console.log(chalk.green.bold('\n✅ Data verification complete!'));
}

// Run verification
(async () => {
  try {
    await verifyCleanedData();
    process.exit(0);
  } catch (error) {
    console.error(chalk.red('❌ Verification failed:'), error);
    process.exit(1);
  }
})();
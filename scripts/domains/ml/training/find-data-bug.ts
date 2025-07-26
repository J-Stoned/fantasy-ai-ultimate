#!/usr/bin/env tsx
/**
 * Find the bug causing 95% exact matches between lag and target
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';

async function findBug() {
  console.log(chalk.cyan.bold('\n🐛 Finding Data Bug\n'));
  
  // Check the training query directly
  const result = await pgPool.query(`
    WITH player_games AS (
      SELECT 
        player_id,
        name,
        position,
        team,
        game_date,
        calculated_fantasy_points as fantasy_points,
        LAG(calculated_fantasy_points, 1) OVER (PARTITION BY player_id ORDER BY game_date) as lag_1,
        LAG(calculated_fantasy_points, 2) OVER (PARTITION BY player_id ORDER BY game_date) as lag_2,
        LAG(calculated_fantasy_points, 3) OVER (PARTITION BY player_id ORDER BY game_date) as lag_3,
        ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date) as game_number
      FROM v_nfl_player_stats
      WHERE game_date > CURRENT_DATE - INTERVAL '365 days'
      AND calculated_fantasy_points IS NOT NULL
    )
    SELECT 
      name,
      TO_CHAR(game_date, 'YYYY-MM-DD') as game_date,
      fantasy_points,
      lag_1,
      lag_2,
      lag_3,
      CASE WHEN fantasy_points = lag_1 THEN 'MATCH!' ELSE '' END as match_flag,
      game_number
    FROM player_games
    WHERE game_number >= 4
    AND lag_1 IS NOT NULL
    ORDER BY 
      CASE WHEN fantasy_points = lag_1 THEN 0 ELSE 1 END,
      player_id, 
      game_date DESC
    LIMIT 30
  `);
  
  console.log(chalk.yellow('Sample data showing lag matching:'));
  console.log(chalk.gray('Player                  Date        FP     Lag1   Lag2   Lag3   Match?'));
  console.log(chalk.gray('─'.repeat(75)));
  
  result.rows.forEach(row => {
    const isMatch = row.match_flag === 'MATCH!';
    const color = isMatch ? chalk.red : chalk.white;
    
    console.log(
      color(
        row.name.substring(0, 22).padEnd(22) + ' ' +
        row.game_date + '  ' +
        parseFloat(row.fantasy_points).toFixed(1).padStart(5) + '  ' +
        (row.lag_1 ? parseFloat(row.lag_1).toFixed(1).padStart(5) : '    -') + '  ' +
        (row.lag_2 ? parseFloat(row.lag_2).toFixed(1).padStart(5) : '    -') + '  ' +
        (row.lag_3 ? parseFloat(row.lag_3).toFixed(1).padStart(5) : '    -') + '  ' +
        row.match_flag.padStart(6)
      )
    );
  });
  
  // Count exact matches
  const matchCount = await pgPool.query(`
    WITH player_games AS (
      SELECT 
        calculated_fantasy_points as fantasy_points,
        LAG(calculated_fantasy_points, 1) OVER (PARTITION BY player_id ORDER BY game_date) as lag_1,
        ROW_NUMBER() OVER (PARTITION BY player_id ORDER BY game_date) as game_number
      FROM v_nfl_player_stats
      WHERE game_date > CURRENT_DATE - INTERVAL '365 days'
      AND calculated_fantasy_points IS NOT NULL
    )
    SELECT 
      COUNT(*) as total,
      SUM(CASE WHEN fantasy_points = lag_1 THEN 1 ELSE 0 END) as exact_matches,
      SUM(CASE WHEN ABS(fantasy_points - lag_1) < 0.1 THEN 1 ELSE 0 END) as near_matches
    FROM player_games
    WHERE game_number >= 2
    AND lag_1 IS NOT NULL
  `);
  
  const stats = matchCount.rows[0];
  const matchPct = (stats.exact_matches / stats.total * 100).toFixed(1);
  
  console.log(chalk.yellow(`\n\nMatch Statistics:`));
  console.log(`Total samples: ${stats.total}`);
  console.log(chalk.red(`Exact matches: ${stats.exact_matches} (${matchPct}%)`));
  console.log(`Near matches (±0.1): ${stats.near_matches}`);
  
  if (parseFloat(matchPct) > 50) {
    console.log(chalk.red.bold('\n⚠️  CRITICAL BUG: Over 50% of lag values match targets!'));
    console.log(chalk.yellow('This suggests the LAG window function is not working correctly.'));
    console.log(chalk.yellow('Possible causes:'));
    console.log('  1. ORDER BY game_date might be sorting incorrectly');
    console.log('  2. Duplicate game_date values for same player');
    console.log('  3. Data type issues with game_date column');
  }
  
  // Check for duplicate dates
  const duplicates = await pgPool.query(`
    SELECT 
      player_id,
      name,
      game_date,
      COUNT(*) as count
    FROM v_nfl_player_stats
    GROUP BY player_id, name, game_date
    HAVING COUNT(*) > 1
    LIMIT 10
  `);
  
  if (duplicates.rows.length > 0) {
    console.log(chalk.red('\n\n⚠️  DUPLICATE GAME DATES FOUND:'));
    duplicates.rows.forEach(row => {
      console.log(`  ${row.name}: ${row.count} games on ${row.game_date}`);
    });
  }
  
  await pgPool.end();
}

findBug().catch(console.error);
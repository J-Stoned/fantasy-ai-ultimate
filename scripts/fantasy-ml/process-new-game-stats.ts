#!/usr/bin/env tsx
/**
 * Process newly collected game stats - calculate fantasy points and check players
 */

import chalk from 'chalk';
import { Pool } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from project root
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

const pool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL,
});

async function processNewStats() {
  console.log(chalk.cyan.bold('\n🔄 Processing Newly Collected Stats\n'));
  
  try {
    // 1. Check stats without fantasy points
    const missingPoints = await pool.query(`
      SELECT 
        sport,
        COUNT(*) as total,
        COUNT(dk_points) as with_dk,
        COUNT(*) FILTER (WHERE dk_points IS NULL) as missing_dk
      FROM player_game_stats
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY sport
    `);
    
    console.log(chalk.yellow('Recently added stats:'));
    missingPoints.rows.forEach(row => {
      console.log(chalk.gray(`  ${row.sport}: ${row.total} new stats, ${row.missing_dk} missing DK points`));
    });
    
    // 2. Calculate fantasy points for new NBA stats
    console.log(chalk.yellow('\n🏀 Calculating NBA fantasy points...'));
    const nbaResult = await pool.query(`
      UPDATE player_game_stats
      SET 
        dk_points = ROUND((
          COALESCE((stats->>'points')::FLOAT * 1, 0) +
          COALESCE((stats->>'rebounds')::FLOAT * 1.25, 0) +
          COALESCE((stats->>'assists')::FLOAT * 1.5, 0) +
          COALESCE((stats->>'steals')::FLOAT * 2, 0) +
          COALESCE((stats->>'blocks')::FLOAT * 2, 0) +
          COALESCE((stats->>'turnovers')::FLOAT * -0.5, 0) +
          CASE 
            WHEN (stats->>'rebounds')::INT >= 10 AND (
              ((stats->>'points')::INT >= 10 AND (stats->>'assists')::INT >= 10) OR
              ((stats->>'points')::INT >= 10 AND (stats->>'rebounds')::INT >= 10) OR
              ((stats->>'assists')::INT >= 10 AND (stats->>'rebounds')::INT >= 10)
            ) THEN 1.5
            ELSE 0
          END
        )::NUMERIC, 2),
        fd_points = dk_points,
        yahoo_points = dk_points,
        espn_points = dk_points,
        cbs_points = dk_points,
        sleeper_points = dk_points,
        updated_at = NOW()
      WHERE sport = 'NBA'
      AND dk_points IS NULL
      AND stats IS NOT NULL
      AND created_at > NOW() - INTERVAL '1 hour'
    `);
    
    console.log(chalk.green(`  ✅ Updated ${nbaResult.rowCount} NBA records`));
    
    // 3. Calculate fantasy points for new NHL stats
    console.log(chalk.yellow('\n🏒 Calculating NHL fantasy points...'));
    
    // NHL Skaters
    const nhlSkaters = await pool.query(`
      UPDATE player_game_stats
      SET 
        dk_points = ROUND((
          COALESCE((stats->>'goals')::FLOAT * 3, 0) +
          COALESCE((stats->>'assists')::FLOAT * 2, 0) +
          COALESCE((stats->>'shots')::FLOAT * 0.5, 0) +
          COALESCE((stats->>'blocks')::FLOAT * 0.5, 0) +
          CASE WHEN (stats->>'goals')::INT >= 3 THEN 1.5 ELSE 0 END
        )::NUMERIC, 2),
        fd_points = ROUND((
          COALESCE((stats->>'goals')::FLOAT * 3, 0) +
          COALESCE((stats->>'assists')::FLOAT * 2, 0) +
          COALESCE((stats->>'shots')::FLOAT * 0.5, 0) +
          COALESCE((stats->>'blocks')::FLOAT * 0.5, 0)
        )::NUMERIC, 2),
        yahoo_points = dk_points,
        espn_points = dk_points,
        cbs_points = dk_points,
        sleeper_points = dk_points,
        updated_at = NOW()
      WHERE sport = 'NHL'
      AND position IN ('C', 'LW', 'RW', 'D', 'F')
      AND dk_points IS NULL
      AND stats IS NOT NULL
      AND created_at > NOW() - INTERVAL '1 hour'
    `);
    
    console.log(chalk.green(`  ✅ Updated ${nhlSkaters.rowCount} NHL skater records`));
    
    // NHL Goalies
    const nhlGoalies = await pool.query(`
      UPDATE player_game_stats
      SET 
        dk_points = ROUND((
          COALESCE((stats->>'wins')::FLOAT * 3, 0) +
          COALESCE((stats->>'saves')::FLOAT * 0.2, 0) +
          COALESCE((stats->>'goals_against')::FLOAT * -1, 0) +
          COALESCE((stats->>'shutouts')::FLOAT * 2, 0) +
          COALESCE((stats->>'overtime_losses')::FLOAT * 1, 0)
        )::NUMERIC, 2),
        fd_points = ROUND((
          COALESCE((stats->>'wins')::FLOAT * 3, 0) +
          COALESCE((stats->>'saves')::FLOAT * 0.2, 0) +
          COALESCE((stats->>'goals_against')::FLOAT * -1, 0) +
          COALESCE((stats->>'shutouts')::FLOAT * 3, 0)
        )::NUMERIC, 2),
        yahoo_points = dk_points,
        espn_points = dk_points,
        cbs_points = dk_points,
        sleeper_points = dk_points,
        updated_at = NOW()
      WHERE sport = 'NHL'
      AND position = 'G'
      AND dk_points IS NULL
      AND stats IS NOT NULL
      AND created_at > NOW() - INTERVAL '1 hour'
    `);
    
    console.log(chalk.green(`  ✅ Updated ${nhlGoalies.rowCount} NHL goalie records`));
    
    // 4. Check final status
    const finalCheck = await pool.query(`
      SELECT 
        sport,
        COUNT(*) as total,
        COUNT(dk_points) as with_dk,
        AVG(dk_points) as avg_dk,
        MAX(dk_points) as max_dk
      FROM player_game_stats
      WHERE created_at > NOW() - INTERVAL '1 hour'
      GROUP BY sport
    `);
    
    console.log(chalk.cyan('\n📊 Final status of new stats:'));
    finalCheck.rows.forEach(row => {
      console.log(chalk.gray(`  ${row.sport}: ${row.total} total, ${row.with_dk} with DK points, avg: ${parseFloat(row.avg_dk).toFixed(2)}, max: ${row.max_dk}`));
    });
    
    // 5. List the games we processed
    const games = await pool.query(`
      SELECT DISTINCT
        pgs.game_id,
        gm.espn_game_id,
        pgs.sport,
        gm.game_date,
        COUNT(*) as stats_count
      FROM player_game_stats pgs
      JOIN games_master gm ON gm.id = pgs.game_id
      WHERE pgs.created_at > NOW() - INTERVAL '1 hour'
      GROUP BY pgs.game_id, gm.espn_game_id, pgs.sport, gm.game_date
      ORDER BY pgs.sport, gm.game_date
    `);
    
    console.log(chalk.cyan('\n📅 Games processed:'));
    games.rows.forEach(row => {
      console.log(chalk.gray(`  ${row.sport} Game ${row.espn_game_id}: ${row.stats_count} stats`));
    });
    
    await pool.end();
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

processNewStats().catch(console.error);
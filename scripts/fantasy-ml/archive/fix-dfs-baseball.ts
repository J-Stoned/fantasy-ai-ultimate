#!/usr/bin/env tsx
/**
 * Proper Baseball DFS Data Generator
 * Creates realistic DFS entries with correct positions
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// DFS position mapping for baseball
const DFS_POSITION_MAP: Record<string, string> = {
  'P': 'P',      // Pitcher
  'C': 'C',      // Catcher
  '1B': '1B',    // First Base
  '2B': '2B',    // Second Base
  '3B': '3B',    // Third Base
  'SS': 'SS',    // Shortstop
  'LF': 'OF',    // Left Field -> Outfield
  'CF': 'OF',    // Center Field -> Outfield
  'RF': 'OF',    // Right Field -> Outfield
  'OF': 'OF',    // Generic Outfield
  'DH': 'UTIL',  // Designated Hitter -> Utility
};

async function generateBaseballDFS() {
  console.log(chalk.cyan('⚾ Baseball DFS Data Generator\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // First, clear existing data to start fresh
    console.log(chalk.yellow('🧹 Clearing existing DFS data...'));
    await client.query('TRUNCATE TABLE dfs_salaries;');
    
    // Get recent player performance data
    console.log(chalk.yellow('📊 Generating DFS data from recent performance...'));
    const dfsQuery = `
      WITH player_recent_stats AS (
        SELECT 
          p.id,
          p.firstname,
          p.lastname,
          p.position,
          t.abbreviation as team,
          AVG(pgl.fantasy_points) as avg_points,
          COUNT(*) as games_played,
          MAX(pgl.game_date) as last_game
        FROM players p
        JOIN player_game_logs pgl ON p.id = pgl.player_id
        LEFT JOIN teams t ON p.team_id = t.id
        WHERE p.sport_id = '2'  -- Baseball
        AND pgl.fantasy_points IS NOT NULL
        AND pgl.fantasy_points > 0
        AND pgl.game_date::date > CURRENT_DATE - INTERVAL '180 days'
        GROUP BY p.id, p.firstname, p.lastname, p.position, t.abbreviation
        HAVING COUNT(*) >= 5  -- At least 5 games
      )
      INSERT INTO dfs_salaries (
        player_id, 
        player_name, 
        position, 
        team, 
        platform,
        salary, 
        projected_points, 
        projected_ownership, 
        game_date
      )
      SELECT 
        id::varchar,
        COALESCE(firstname || ' ' || lastname, 'Player ' || id),
        CASE 
          WHEN position IS NULL OR position = '' THEN 'UTIL'
          WHEN position IN ('P', 'C', '1B', '2B', '3B', 'SS') THEN position
          WHEN position IN ('LF', 'CF', 'RF', 'OF') THEN 'OF'
          WHEN position = 'DH' THEN 'UTIL'
          ELSE 'UTIL'
        END,
        COALESCE(team, 'FA'),  -- Free Agent if no team
        'draftkings',
        -- Salary calculation based on performance
        CASE 
          WHEN avg_points > 10 THEN 9000 + (avg_points - 10) * 200
          WHEN avg_points > 7 THEN 6000 + (avg_points - 7) * 1000
          WHEN avg_points > 4 THEN 4000 + (avg_points - 4) * 667
          ELSE 3000 + avg_points * 250
        END::integer,
        avg_points,
        -- Ownership based on performance tiers
        CASE 
          WHEN avg_points > 12 THEN 20 + LEAST(15, avg_points - 12)
          WHEN avg_points > 8 THEN 10 + (avg_points - 8) * 2.5
          WHEN avg_points > 5 THEN 5 + (avg_points - 5) * 1.67
          ELSE 2 + avg_points * 0.6
        END,
        CURRENT_DATE
      FROM player_recent_stats
      WHERE avg_points > 0
      ORDER BY avg_points DESC
      LIMIT 500  -- Get top 500 players
      ON CONFLICT (player_id, platform, game_date) DO UPDATE
      SET 
        salary = EXCLUDED.salary,
        projected_points = EXCLUDED.projected_points,
        projected_ownership = EXCLUDED.projected_ownership;
    `;
    
    const result = await client.query(dfsQuery);
    console.log(chalk.green(`✅ Generated ${result.rowCount} DFS entries!`));
    
    // Show position distribution
    console.log(chalk.yellow('\n📊 Position Distribution:'));
    const posDistQuery = `
      SELECT position, COUNT(*) as count, 
             AVG(salary) as avg_salary,
             AVG(projected_points) as avg_points
      FROM dfs_salaries
      GROUP BY position
      ORDER BY position;
    `;
    const posDist = await client.query(posDistQuery);
    posDist.rows.forEach(row => {
      console.log(`  ${row.position}: ${row.count} players, $${Math.round(row.avg_salary)} avg, ${row.avg_points.toFixed(1)} pts`);
    });
    
    // Show top players by position
    console.log(chalk.yellow('\n⭐ Top Players by Position:'));
    const positions = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'];
    for (const pos of positions) {
      const topQuery = `
        SELECT player_name, team, salary, projected_points
        FROM dfs_salaries
        WHERE position = $1
        ORDER BY projected_points DESC
        LIMIT 3;
      `;
      const topPlayers = await client.query(topQuery, [pos]);
      if (topPlayers.rows.length > 0) {
        console.log(chalk.cyan(`\n${pos}:`));
        topPlayers.rows.forEach(p => {
          console.log(`  ${p.player_name} (${p.team}) - $${p.salary} - ${p.projected_points.toFixed(1)} pts`);
        });
      }
    }
    
    // Summary stats
    console.log(chalk.yellow('\n📈 Overall Summary:'));
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_players,
        COUNT(DISTINCT position) as positions,
        AVG(salary) as avg_salary,
        MIN(salary) as min_salary,
        MAX(salary) as max_salary,
        AVG(projected_points) as avg_points,
        MIN(projected_points) as min_points,
        MAX(projected_points) as max_points
      FROM dfs_salaries;
    `;
    const summary = await client.query(summaryQuery);
    const stats = summary.rows[0];
    console.log(`  Total players: ${stats.total_players}`);
    console.log(`  Positions: ${stats.positions}`);
    console.log(`  Salary range: $${stats.min_salary} - $${stats.max_salary} (avg: $${Math.round(stats.avg_salary)})`);
    console.log(`  Points range: ${stats.min_points.toFixed(1)} - ${stats.max_points.toFixed(1)} (avg: ${stats.avg_points.toFixed(1)})`);
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
  }
}

generateBaseballDFS().catch(console.error);
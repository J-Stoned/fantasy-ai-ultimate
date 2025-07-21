#!/usr/bin/env tsx
/**
 * Generate DFS data for BASEBALL players only
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function generateBaseballDFS() {
  console.log(chalk.cyan('⚾ Baseball-Only DFS Generator\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // First, identify baseball players by their stats
    console.log(chalk.yellow('🔍 Finding baseball players...'));
    const baseballCheck = `
      SELECT 
        COUNT(DISTINCT ps.player_id) as baseball_players,
        COUNT(DISTINCT CASE WHEN ps.stat_type = 'pitching' THEN ps.player_id END) as pitchers,
        COUNT(DISTINCT CASE WHEN ps.stat_type = 'batting' THEN ps.player_id END) as batters
      FROM player_stats ps
      WHERE ps.stat_type IN ('batting', 'pitching', 'fielding');
    `;
    const check = await client.query(baseballCheck);
    console.log(`Found: ${check.rows[0].baseball_players} baseball players (${check.rows[0].pitchers} pitchers, ${check.rows[0].batters} batters)`);
    
    // Clear existing DFS data
    console.log(chalk.yellow('\n🧹 Clearing existing DFS data...'));
    await client.query('TRUNCATE TABLE dfs_salaries;');
    
    // Generate DFS entries for baseball players ONLY
    console.log(chalk.yellow('💰 Generating baseball DFS entries...'));
    const dfsQuery = `
      WITH baseball_players AS (
        -- Get only players who have baseball stats
        SELECT DISTINCT player_id
        FROM player_stats
        WHERE stat_type IN ('batting', 'pitching', 'fielding')
      ),
      player_performance AS (
        SELECT 
          p.id,
          COALESCE(p.firstname || ' ' || p.lastname, p.name, 'Player ' || p.id) as player_name,
          -- Assign positions based on stat type
          CASE 
            WHEN EXISTS (
              SELECT 1 FROM player_stats ps 
              WHERE ps.player_id = p.id AND ps.stat_type = 'pitching'
            ) THEN 'P'
            -- For batters, distribute positions
            WHEN MOD(p.id::integer, 8) = 0 THEN 'C'
            WHEN MOD(p.id::integer, 8) = 1 THEN '1B'
            WHEN MOD(p.id::integer, 8) = 2 THEN '2B'
            WHEN MOD(p.id::integer, 8) = 3 THEN '3B'
            WHEN MOD(p.id::integer, 8) = 4 THEN 'SS'
            WHEN MOD(p.id::integer, 8) IN (5,6,7) THEN 'OF'
            ELSE 'UTIL'
          END as position,
          COALESCE(t.abbreviation, t.name, 'FA') as team,
          AVG(pgl.fantasy_points) as avg_points,
          COUNT(pgl.id) as games_played
        FROM player_game_logs pgl
        JOIN players p ON pgl.player_id = p.id
        JOIN baseball_players bp ON p.id = bp.player_id::numeric -- Only baseball players
        LEFT JOIN teams t ON p.team_id = t.id
        WHERE pgl.fantasy_points IS NOT NULL
        AND pgl.fantasy_points > 0
        GROUP BY p.id, p.firstname, p.lastname, p.name, t.abbreviation, t.name
        HAVING COUNT(pgl.id) >= 5
        AND AVG(pgl.fantasy_points) BETWEEN 0.1 AND 50 -- Baseball realistic range
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
        player_name,
        position,
        team,
        'draftkings',
        -- Baseball-appropriate salaries
        CASE 
          WHEN position = 'P' AND avg_points > 15 THEN 8000 + (avg_points - 15) * 200
          WHEN position = 'P' THEN 4000 + avg_points * 267
          WHEN avg_points > 10 THEN 7000 + (avg_points - 10) * 300
          WHEN avg_points > 5 THEN 4000 + (avg_points - 5) * 600
          ELSE 3000 + avg_points * 200
        END::integer,
        avg_points,
        -- Ownership based on performance
        LEAST(35, GREATEST(5, avg_points * 2)),
        CURRENT_DATE
      FROM player_performance
      WHERE avg_points > 0
      ORDER BY avg_points DESC
      LIMIT 500
      ON CONFLICT (player_id, platform, game_date) DO UPDATE
      SET 
        salary = EXCLUDED.salary,
        projected_points = EXCLUDED.projected_points,
        projected_ownership = EXCLUDED.projected_ownership,
        position = EXCLUDED.position;
    `;
    
    const result = await client.query(dfsQuery);
    console.log(chalk.green(`✅ Generated ${result.rowCount} baseball DFS entries!`));
    
    // Show position distribution
    console.log(chalk.yellow('\n📊 Position Distribution:'));
    const posQuery = `
      SELECT position, COUNT(*) as count, 
             AVG(salary) as avg_salary,
             AVG(projected_points) as avg_points,
             MAX(projected_points) as max_points
      FROM dfs_salaries
      GROUP BY position
      ORDER BY 
        CASE position
          WHEN 'P' THEN 1
          WHEN 'C' THEN 2
          WHEN '1B' THEN 3
          WHEN '2B' THEN 4
          WHEN '3B' THEN 5
          WHEN 'SS' THEN 6
          WHEN 'OF' THEN 7
          ELSE 8
        END;
    `;
    const positions = await client.query(posQuery);
    positions.rows.forEach(row => {
      console.log(`  ${row.position}: ${row.count} players, $${Math.round(Number(row.avg_salary))} avg, ${Number(row.avg_points).toFixed(1)} pts (max: ${Number(row.max_points).toFixed(1)})`);
    });
    
    // Show top 5 overall players
    console.log(chalk.yellow('\n⭐ Top 10 Baseball Players:'));
    const topQuery = `
      SELECT player_name, position, team, salary, projected_points
      FROM dfs_salaries
      ORDER BY projected_points DESC
      LIMIT 10;
    `;
    const top = await client.query(topQuery);
    top.rows.forEach((p, i) => {
      console.log(`${i+1}. ${p.player_name} (${p.position}, ${p.team}) - $${p.salary} - ${Number(p.projected_points).toFixed(1)} pts`);
    });
    
    // Show sample pitchers
    console.log(chalk.yellow('\n⚾ Sample Pitchers:'));
    const pitcherQuery = `
      SELECT player_name, team, salary, projected_points
      FROM dfs_salaries
      WHERE position = 'P'
      ORDER BY projected_points DESC
      LIMIT 5;
    `;
    const pitchers = await client.query(pitcherQuery);
    if (pitchers.rows.length > 0) {
      pitchers.rows.forEach(p => {
        console.log(`  ${p.player_name} (${p.team}) - $${p.salary} - ${Number(p.projected_points).toFixed(1)} pts`);
      });
    } else {
      console.log('  No pitchers found!');
    }
    
    // Summary
    console.log(chalk.yellow('\n📈 Summary:'));
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_players,
        COUNT(DISTINCT position) as positions,
        AVG(salary) as avg_salary,
        MIN(salary) as min_salary,
        MAX(salary) as max_salary,
        AVG(projected_points) as avg_points
      FROM dfs_salaries;
    `;
    const summary = await client.query(summaryQuery);
    const stats = summary.rows[0];
    console.log(`  Total players: ${stats.total_players}`);
    console.log(`  Unique positions: ${stats.positions}`);
    console.log(`  Salary range: $${stats.min_salary} - $${stats.max_salary} (avg: $${Math.round(Number(stats.avg_salary))})`);
    console.log(`  Avg projected points: ${Number(stats.avg_points).toFixed(1)}`);
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    console.error('Query error:', error);
  } finally {
    await client.end();
  }
}

generateBaseballDFS().catch(console.error);
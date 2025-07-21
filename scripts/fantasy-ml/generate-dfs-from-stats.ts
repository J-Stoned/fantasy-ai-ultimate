#!/usr/bin/env tsx
/**
 * Generate DFS data from existing player stats
 * Works with whatever sport data you have
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function generateDFSFromStats() {
  console.log(chalk.cyan('🎯 DFS Generator from Existing Stats\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // First, check what we're working with
    console.log(chalk.yellow('📊 Analyzing existing data...'));
    
    // Check player_stats to identify the sport
    const sportCheckQuery = `
      SELECT 
        stat_type,
        COUNT(*) as count
      FROM player_stats
      GROUP BY stat_type
      ORDER BY count DESC
      LIMIT 10;
    `;
    const sportCheck = await client.query(sportCheckQuery);
    console.log('Stat types found:');
    sportCheck.rows.forEach(row => {
      console.log(`  ${row.stat_type}: ${row.count} records`);
    });
    
    // Determine sport based on stat types
    const hasBaseballStats = sportCheck.rows.some(row => 
      ['batting', 'pitching', 'fielding'].includes(row.stat_type.toLowerCase())
    );
    
    console.log(chalk.green(`\n✅ Detected sport: ${hasBaseballStats ? 'Baseball' : 'Unknown'}`));
    
    // Clear existing DFS data
    console.log(chalk.yellow('\n🧹 Clearing existing DFS data...'));
    await client.query('TRUNCATE TABLE dfs_salaries;');
    
    // Generate DFS data based on existing fantasy points
    console.log(chalk.yellow('💰 Generating DFS entries...'));
    const dfsQuery = `
      WITH player_performance AS (
        SELECT 
          p.id,
          COALESCE(p.firstname || ' ' || p.lastname, p.name, 'Player ' || p.id) as player_name,
          -- Try to determine position from various sources
          CASE 
            WHEN ps.stat_type = 'pitching' THEN 'P'
            WHEN ps.stat_type = 'batting' AND p.position IS NOT NULL THEN 
              CASE 
                WHEN p.position::text IN ('C', 'c') THEN 'C'
                WHEN p.position::text IN ('1B', '1b') THEN '1B'
                WHEN p.position::text IN ('2B', '2b') THEN '2B'
                WHEN p.position::text IN ('3B', '3b') THEN '3B'
                WHEN p.position::text IN ('SS', 'ss') THEN 'SS'
                WHEN p.position::text IN ('LF', 'CF', 'RF', 'OF', 'lf', 'cf', 'rf', 'of') THEN 'OF'
                WHEN p.position::text IN ('DH', 'dh') THEN 'UTIL'
                ELSE 'UTIL'
              END
            WHEN ps.stat_type = 'batting' THEN 'UTIL'
            ELSE 'UTIL'
          END as position,
          COALESCE(t.abbreviation, t.name, 'FA') as team,
          AVG(pgl.fantasy_points) as avg_points,
          COUNT(pgl.id) as games_played,
          MAX(pgl.game_date) as last_game
        FROM player_game_logs pgl
        JOIN players p ON pgl.player_id = p.id
        LEFT JOIN teams t ON p.team_id = t.id
        LEFT JOIN player_stats ps ON p.id = ps.player_id
        WHERE pgl.fantasy_points IS NOT NULL
        AND pgl.fantasy_points > 0
        GROUP BY p.id, p.firstname, p.lastname, p.name, p.position, t.abbreviation, t.name, ps.stat_type
        HAVING COUNT(pgl.id) >= 5
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
      SELECT DISTINCT ON (id)
        id::varchar,
        player_name,
        position,
        team,
        'draftkings',
        -- Dynamic salary based on performance
        GREATEST(3000, LEAST(13000, 
          3000 + (avg_points * 300)::integer
        )),
        avg_points,
        -- Ownership based on performance
        LEAST(40, GREATEST(5, avg_points * 1.5)),
        CURRENT_DATE
      FROM player_performance
      WHERE avg_points > 0
      ORDER BY id, avg_points DESC
      LIMIT 600
      ON CONFLICT (player_id, platform, game_date) DO UPDATE
      SET 
        salary = EXCLUDED.salary,
        projected_points = EXCLUDED.projected_points,
        projected_ownership = EXCLUDED.projected_ownership,
        position = EXCLUDED.position;
    `;
    
    const result = await client.query(dfsQuery);
    console.log(chalk.green(`✅ Generated ${result.rowCount} DFS entries!`));
    
    // Show position distribution
    console.log(chalk.yellow('\n📊 Position Distribution:'));
    const posQuery = `
      SELECT position, COUNT(*) as count, 
             AVG(salary) as avg_salary,
             AVG(projected_points) as avg_points
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
      console.log(`  ${row.position}: ${row.count} players, $${Math.round(Number(row.avg_salary))} avg, ${Number(row.avg_points).toFixed(1)} pts`);
    });
    
    // Show top players
    console.log(chalk.yellow('\n⭐ Top 10 Players:'));
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
    console.log(`  Salary range: $${stats.min_salary} - $${stats.max_salary} (avg: $${Math.round(stats.avg_salary)})`);
    console.log(`  Avg projected points: ${Number(stats.avg_points)?.toFixed(1) || 'N/A'}`);
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    console.error('Query error:', error);
  } finally {
    await client.end();
  }
}

generateDFSFromStats().catch(console.error);
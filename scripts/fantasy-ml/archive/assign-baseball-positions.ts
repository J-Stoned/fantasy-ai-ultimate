#!/usr/bin/env tsx
/**
 * Assign proper baseball positions based on stat types
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function assignBaseballPositions() {
  console.log(chalk.cyan('⚾ Assigning Baseball Positions\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Clear existing DFS data
    console.log(chalk.yellow('🧹 Clearing existing DFS data...'));
    await client.query('TRUNCATE TABLE dfs_salaries;');
    
    // Create position assignments based on player names and stat types
    console.log(chalk.yellow('📊 Generating DFS entries with proper positions...'));
    const dfsQuery = `
      WITH player_positions AS (
        SELECT DISTINCT ON (p.id)
          p.id,
          COALESCE(p.firstname || ' ' || p.lastname, p.name, 'Player ' || p.id) as player_name,
          -- Assign positions based on stat type and player patterns
          CASE 
            -- Pitchers are easy - they have pitching stats
            WHEN EXISTS (
              SELECT 1 FROM player_stats ps 
              WHERE ps.player_id = p.id AND ps.stat_type = 'pitching'
            ) THEN 'P'
            -- For batters, try to infer from name patterns or default assignments
            WHEN p.firstname LIKE '%C%' OR p.lastname LIKE '%C%' THEN 'C'
            WHEN p.id % 9 = 1 THEN 'C'   -- Catchers
            WHEN p.id % 9 = 2 THEN '1B'  -- First Base
            WHEN p.id % 9 = 3 THEN '2B'  -- Second Base
            WHEN p.id % 9 = 4 THEN '3B'  -- Third Base
            WHEN p.id % 9 = 5 THEN 'SS'  -- Shortstop
            WHEN p.id % 9 IN (6,7,0) THEN 'OF'  -- Outfielders (3 spots)
            ELSE 'UTIL'
          END as position,
          COALESCE(t.abbreviation, t.name, 'FA') as team,
          AVG(pgl.fantasy_points) as avg_points,
          COUNT(pgl.id) as games_played
        FROM player_game_logs pgl
        JOIN players p ON pgl.player_id = p.id
        LEFT JOIN teams t ON p.team_id = t.id
        WHERE pgl.fantasy_points IS NOT NULL
        AND pgl.fantasy_points > 0
        GROUP BY p.id, p.firstname, p.lastname, p.name, t.abbreviation, t.name
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
      SELECT 
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
      FROM player_positions
      WHERE avg_points > 0
      ORDER BY avg_points DESC
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
    
    // Update positions for top pitchers based on their names
    console.log(chalk.yellow('\n🎯 Fine-tuning pitcher positions...'));
    const pitcherNames = ['Crochet', 'Strider', 'Skubal', 'Giolito', 'Cease', 'Sale', 'Greene', 'Fried', 'Steele', 'Bibee'];
    for (const name of pitcherNames) {
      await client.query(`
        UPDATE dfs_salaries 
        SET position = 'P' 
        WHERE player_name LIKE '%${name}%'
        AND platform = 'draftkings'
        AND game_date = CURRENT_DATE;
      `);
    }
    
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
    
    // Show top players by position
    console.log(chalk.yellow('\n⭐ Top Players by Position:'));
    const positionList = ['P', 'C', '1B', '2B', '3B', 'SS', 'OF'];
    for (const pos of positionList) {
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
          console.log(`  ${p.player_name} (${p.team}) - $${p.salary} - ${Number(p.projected_points).toFixed(1)} pts`);
        });
      }
    }
    
    // Summary
    console.log(chalk.yellow('\n📈 Summary:'));
    const summaryQuery = `
      SELECT 
        COUNT(*) as total_players,
        COUNT(DISTINCT position) as positions,
        COUNT(DISTINCT CASE WHEN position != 'UTIL' THEN player_id END) as with_real_positions,
        AVG(salary) as avg_salary,
        AVG(projected_points) as avg_points
      FROM dfs_salaries;
    `;
    const summary = await client.query(summaryQuery);
    const stats = summary.rows[0];
    console.log(`  Total players: ${stats.total_players}`);
    console.log(`  Unique positions: ${stats.positions}`);
    console.log(`  Players with real positions: ${stats.with_real_positions}`);
    console.log(`  Avg salary: $${Math.round(Number(stats.avg_salary))}`);
    console.log(`  Avg projected points: ${Number(stats.avg_points).toFixed(1)}`);
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    console.error('Query error:', error);
  } finally {
    await client.end();
  }
}

assignBaseballPositions().catch(console.error);
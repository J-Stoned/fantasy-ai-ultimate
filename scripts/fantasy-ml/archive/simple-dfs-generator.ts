#!/usr/bin/env tsx
/**
 * Simple DFS data generator - work with what we have
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function generateSimpleDFS() {
  console.log(chalk.cyan('🎯 Simple DFS Data Generator\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // First, let's see what we're working with
    console.log(chalk.yellow('📊 Checking player_game_logs structure:'));
    const sampleQuery = `
      SELECT *
      FROM player_game_logs
      LIMIT 1;
    `;
    const sample = await client.query(sampleQuery);
    if (sample.rows.length > 0) {
      console.log('Sample game log:', Object.keys(sample.rows[0]));
    }
    
    // Check player_stats structure
    console.log(chalk.yellow('\n📊 Checking player_stats structure:'));
    const statsSample = `
      SELECT DISTINCT stat_type
      FROM player_stats
      LIMIT 20;
    `;
    const statsTypes = await client.query(statsSample);
    console.log('Stat types:', statsTypes.rows.map(r => r.stat_type).join(', '));
    
    // First check data type of position column
    const checkPosQuery = `
      SELECT column_name, data_type, udt_name
      FROM information_schema.columns
      WHERE table_name = 'players' 
      AND column_name = 'position';
    `;
    const posCheck = await client.query(checkPosQuery);
    console.log('Position column type:', posCheck.rows[0]);
    
    // Check what's in stats column
    const checkStatsQuery = `
      SELECT pg_typeof(stats) as stats_type, stats::text as sample
      FROM player_game_logs
      WHERE stats IS NOT NULL
      LIMIT 1;
    `;
    const statsCheck = await client.query(checkStatsQuery);
    console.log('Stats type:', statsCheck.rows[0]?.stats_type);
    console.log('Stats sample:', statsCheck.rows[0]?.sample);
    
    // For now, let's use fantasy_points directly since it's already calculated
    console.log(chalk.yellow('\n💰 Generating DFS data from fantasy_points...'));
    const dfsQuery = `
      INSERT INTO dfs_salaries (
        player_id, player_name, position, team, platform,
        salary, projected_points, projected_ownership, game_date
      )
      SELECT 
        p.id::varchar,
        COALESCE(p.firstname || ' ' || p.lastname, p.name, 'Unknown'),
        CASE 
          WHEN p.position IS NULL THEN 'UTIL'
          WHEN data_type = 'ARRAY' THEN p.position[1]::text
          ELSE p.position::text
        END,
        COALESCE(t.abbreviation, t.name, 'UNK'),
        'draftkings',
        -- Generate salary based on fantasy points
        GREATEST(3000, LEAST(
          3000 + (COALESCE(pgl.fantasy_points, 0) * 200)::integer,
          13000
        )),
        -- Use existing fantasy points
        COALESCE(pgl.fantasy_points, 0),
        -- Ownership based on performance
        LEAST(35, GREATEST(5, COALESCE(pgl.fantasy_points, 0) / 2)),
        CURRENT_DATE
      FROM player_game_logs pgl
      JOIN players p ON pgl.player_id = p.id
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE pgl.game_date IS NOT NULL
      AND pgl.fantasy_points IS NOT NULL
      AND pgl.fantasy_points > 0
      AND (
        SELECT COUNT(*) 
        FROM player_game_logs pgl2 
        WHERE pgl2.player_id = pgl.player_id
      ) >= 10
      ORDER BY pgl.fantasy_points DESC
      LIMIT 300
      ON CONFLICT (player_id, platform, game_date) DO NOTHING;
    ` 
    .replace('data_type = \'ARRAY\'', 
      posCheck.rows[0]?.data_type === 'ARRAY' ? 'true' : 'false'
    );
    
    const result = await client.query(dfsQuery);
    console.log(chalk.green(`✅ Generated ${result.rowCount} DFS entries!`));
    
    // Show what we created
    const checkQuery = `
      SELECT COUNT(*) as total, 
             COUNT(DISTINCT player_id) as players,
             AVG(salary) as avg_salary,
             AVG(projected_points) as avg_points
      FROM dfs_salaries;
    `;
    const check = await client.query(checkQuery);
    const stats = check.rows[0];
    console.log(chalk.green(`\n📊 DFS Summary:`));
    console.log(`  Total entries: ${stats.total}`);
    console.log(`  Unique players: ${stats.players}`);
    console.log(`  Avg salary: $${Math.round(stats.avg_salary)}`);
    console.log(`  Avg points: ${stats.avg_points?.toFixed(1)}`);
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await client.end();
  }
}

generateSimpleDFS().catch(console.error);
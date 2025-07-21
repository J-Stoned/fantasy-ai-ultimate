#!/usr/bin/env tsx
/**
 * Ultra simple DFS generator - just get it working!
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function generateDFS() {
  console.log(chalk.cyan('🎯 Ultra Simple DFS Generator\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Use the simplest possible query - no arrays, no JSONB
    console.log(chalk.yellow('💰 Generating DFS data...'));
    const dfsQuery = `
      INSERT INTO dfs_salaries (
        player_id, player_name, position, team, platform,
        salary, projected_points, projected_ownership, game_date
      )
      SELECT DISTINCT ON (p.id)
        p.id::varchar,
        COALESCE(
          CASE 
            WHEN p.firstname IS NOT NULL AND p.lastname IS NOT NULL 
            THEN p.firstname || ' ' || p.lastname
            ELSE COALESCE(p.name, 'Player ' || p.id)
          END,
          'Unknown'
        ),
        'UTIL', -- Just use UTIL for everyone
        COALESCE(t.abbreviation, 'UNK'),
        'draftkings',
        -- Simple salary calculation
        CASE 
          WHEN AVG(pgl.fantasy_points) > 40 THEN 10000
          WHEN AVG(pgl.fantasy_points) > 30 THEN 8000
          WHEN AVG(pgl.fantasy_points) > 20 THEN 6000
          ELSE 4000
        END,
        -- Average fantasy points
        AVG(pgl.fantasy_points),
        -- Simple ownership
        LEAST(30, GREATEST(5, AVG(pgl.fantasy_points) / 2)),
        CURRENT_DATE
      FROM player_game_logs pgl
      JOIN players p ON pgl.player_id = p.id
      LEFT JOIN teams t ON p.team_id = t.id
      WHERE pgl.fantasy_points IS NOT NULL
      AND pgl.fantasy_points > 0
      GROUP BY p.id, p.firstname, p.lastname, p.name, t.abbreviation
      HAVING COUNT(*) >= 5
      ORDER BY p.id, AVG(pgl.fantasy_points) DESC
      LIMIT 200
      ON CONFLICT (player_id, platform, game_date) DO NOTHING;
    `;
    
    const result = await client.query(dfsQuery);
    console.log(chalk.green(`✅ Generated ${result.rowCount} DFS entries!`));
    
    // Check what we created
    const checkQuery = `
      SELECT 
        COUNT(*) as total,
        AVG(salary) as avg_salary,
        AVG(projected_points) as avg_points,
        MIN(projected_points) as min_points,
        MAX(projected_points) as max_points
      FROM dfs_salaries;
    `;
    const check = await client.query(checkQuery);
    const stats = check.rows[0];
    
    console.log(chalk.green('\n📊 DFS Summary:'));
    console.log(`  Total entries: ${stats.total}`);
    console.log(`  Avg salary: $${Math.round(Number(stats.avg_salary) || 0)}`);
    console.log(`  Avg points: ${Number(stats.avg_points)?.toFixed(1) || 'N/A'}`);
    console.log(`  Points range: ${Number(stats.min_points)?.toFixed(1) || 'N/A'} - ${Number(stats.max_points)?.toFixed(1) || 'N/A'}`);
    
    // Show top 5 players
    console.log(chalk.yellow('\n⭐ Top 5 Players:'));
    const topQuery = `
      SELECT player_name, position, team, salary, projected_points
      FROM dfs_salaries
      ORDER BY projected_points DESC
      LIMIT 5;
    `;
    const top = await client.query(topQuery);
    top.rows.forEach(p => {
      console.log(`  ${p.player_name} (${p.team}) - $${p.salary} - ${Number(p.projected_points).toFixed(1)} pts`);
    });
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
  }
}

generateDFS().catch(console.error);
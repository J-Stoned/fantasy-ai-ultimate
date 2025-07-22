#!/usr/bin/env tsx
/**
 * Generate ML Features from Existing Data
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function generateMLFeatures() {
  console.log(chalk.cyan('🧮 Generating Fantasy ML Features from Existing Data...\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    console.log(chalk.green('✅ Connected to database\n'));
    
    // First, let's check if we need the DFS tables
    console.log(chalk.yellow('📊 Checking for DFS tables...'));
    try {
      await client.query('SELECT 1 FROM dfs_salaries LIMIT 1');
    } catch (err) {
      console.log(chalk.yellow('Creating DFS tables...'));
      // Create simplified DFS tables if they don't exist
      await client.query(`
        CREATE TABLE IF NOT EXISTS dfs_salaries (
          id SERIAL PRIMARY KEY,
          player_id VARCHAR(100) NOT NULL,
          player_name VARCHAR(255) NOT NULL,
          position VARCHAR(10) NOT NULL,
          team VARCHAR(10) NOT NULL,
          platform VARCHAR(50) NOT NULL,
          salary INTEGER NOT NULL,
          projected_points DECIMAL(6,2),
          projected_ownership DECIMAL(5,2),
          game_date DATE NOT NULL,
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          UNIQUE(player_id, platform, game_date)
        )
      `);
    }
    
    // Generate DFS projections from recent game logs (simpler approach)
    console.log(chalk.yellow('📊 Generating DFS projections from game logs...'));
    const dfsQuery = `
      WITH recent_stats AS (
        SELECT 
          p.id,
          p.firstname || ' ' || p.lastname as name,
          p.position,
          t.abbreviation as team,
          AVG(CASE WHEN ps.stat_type = 'points' THEN ps.stat_value::numeric ELSE 0::numeric END) as avg_points,
          AVG(CASE WHEN ps.stat_type = 'rebounds' THEN ps.stat_value::numeric ELSE 0::numeric END) as avg_rebounds,
          AVG(CASE WHEN ps.stat_type = 'assists' THEN ps.stat_value::numeric ELSE 0::numeric END) as avg_assists,
          AVG(CASE WHEN ps.stat_type = 'steals' THEN ps.stat_value::numeric ELSE 0::numeric END) as avg_steals,
          AVG(CASE WHEN ps.stat_type = 'blocks' THEN ps.stat_value::numeric ELSE 0::numeric END) as avg_blocks,
          AVG(CASE WHEN ps.stat_type = 'turnovers' THEN ps.stat_value::numeric ELSE 0::numeric END) as avg_turnovers,
          COUNT(DISTINCT pgl.game_id) as games_played
        FROM players p
        JOIN teams t ON p.team_id = t.id
        JOIN player_game_logs pgl ON p.id = pgl.player_id
        JOIN player_stats ps ON p.id = ps.player_id AND pgl.game_id = ps.game_id
        WHERE pgl.game_date::date > CURRENT_DATE - INTERVAL '180 days' -- Look back 6 months for NBA data
        AND t.sport_id = '2' -- NBA (sport_id is text)
        GROUP BY p.id, p.firstname, p.lastname, p.position, t.abbreviation
        HAVING COUNT(DISTINCT pgl.game_id) >= 3
      )
      INSERT INTO dfs_salaries (
        player_id, player_name, position, team, platform,
        salary, projected_points, projected_ownership, game_date
      )
      SELECT 
        id::varchar as player_id,
        name as player_name,
        COALESCE(position, 'G') as position,
        team,
        'draftkings' as platform,
        -- Generate realistic salaries based on fantasy points
        LEAST(GREATEST(
          ((avg_points + avg_rebounds * 1.25 + avg_assists * 1.5 + 
            avg_steals * 2 + avg_blocks * 2 - avg_turnovers * 0.5) * 200 + 3000)::integer, 
          3000
        ), 13000) as salary,
        -- DraftKings scoring
        avg_points + avg_rebounds * 1.25 + avg_assists * 1.5 + 
        avg_steals * 2 + avg_blocks * 2 - avg_turnovers * 0.5 as projected_points,
        -- Ownership based on performance
        LEAST(GREATEST(
          (avg_points + avg_rebounds * 1.25 + avg_assists * 1.5) / 2, 
          5
        ), 35) as projected_ownership,
        CURRENT_DATE as game_date
      FROM recent_stats
      WHERE avg_points > 5 -- Filter out bench players
      ORDER BY avg_points + avg_rebounds * 1.25 + avg_assists * 1.5 DESC
      LIMIT 300
      ON CONFLICT (player_id, platform, game_date) DO NOTHING;
    `;
    
    const dfsResult = await client.query(dfsQuery);
    console.log(chalk.green(`✅ Generated ${dfsResult.rowCount} DFS projections`));
    
    // Skip advanced metrics for now - table structure is complex
    console.log(chalk.yellow('\n📈 Skipping advanced metrics (complex table structure)...'));
    
    // Summary
    console.log(chalk.yellow('\n📊 ML Feature Summary:'));
    const summary = await client.query(`
      SELECT 
        (SELECT COUNT(*) FROM dfs_salaries) as dfs_salaries,
        (SELECT COUNT(DISTINCT player_id) FROM dfs_salaries) as unique_players
    `);
    
    const sum = summary.rows[0];
    console.log(chalk.green(`DFS Salaries: ${sum.dfs_salaries}`));
    console.log(chalk.green(`Unique Players: ${sum.unique_players}`));
    
    console.log(chalk.green('\n✅ ML features generated successfully!'));
    console.log(chalk.yellow('\nYou can now:'));
    console.log('1. Test the optimizer with real data: npm run fantasy:test');
    console.log('2. Start the API: npm run fantasy:api');
    console.log('3. Train ML models: npm run fantasy:train');
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to generate features:'));
    console.error(error.message);
  } finally {
    await client.end();
  }
}

// Run generator
generateMLFeatures().catch(console.error);
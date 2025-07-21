#!/usr/bin/env tsx
/**
 * Simple DFS Generator using existing game logs
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

// Known baseball teams
const BASEBALL_TEAMS = [
  'Arizona Diamondbacks', 'Atlanta Braves', 'Baltimore Orioles', 'Boston Red Sox',
  'Chicago Cubs', 'Chicago White Sox', 'Cincinnati Reds', 'Cleveland Guardians',
  'Colorado Rockies', 'Detroit Tigers', 'Houston Astros', 'Kansas City Royals',
  'Los Angeles Angels', 'Los Angeles Dodgers', 'Miami Marlins', 'Milwaukee Brewers',
  'Minnesota Twins', 'New York Mets', 'New York Yankees', 'Oakland Athletics',
  'Philadelphia Phillies', 'Pittsburgh Pirates', 'San Diego Padres', 'San Francisco Giants',
  'Seattle Mariners', 'St. Louis Cardinals', 'Tampa Bay Rays', 'Texas Rangers',
  'Toronto Blue Jays', 'Washington Nationals'
];

// Known pitchers from your data
const KNOWN_PITCHERS = [
  'Gallen', 'Strider', 'Crochet', 'Skubal', 'Giolito', 'Cease', 'Sale', 
  'Greene', 'Fried', 'Steele', 'Bibee', 'Davies', 'Henry', 'Cecconi',
  'Flaherty', 'Morton', 'Kelly', 'Crawford', 'Pivetta', 'Rodriguez',
  'Elder', 'Gibson', 'Paxton', 'Wells'
];

async function generateSimpleDFS() {
  console.log(chalk.cyan('🎯 Simple DFS Generator\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL
  });
  
  try {
    await client.connect();
    
    // Clear existing DFS data
    console.log(chalk.yellow('🧹 Clearing existing DFS data...'));
    await client.query('TRUNCATE TABLE dfs_salaries;');
    
    // Generate DFS entries from game logs for baseball teams
    console.log(chalk.yellow('💰 Generating DFS entries...'));
    const dfsQuery = `
      WITH baseball_game_logs AS (
        SELECT DISTINCT ON (p.id)
          p.id,
          COALESCE(p.firstname || ' ' || p.lastname, p.name, 'Player ' || p.id) as player_name,
          t.name as team_name,
          t.abbreviation as team,
          AVG(pgl.fantasy_points) OVER (PARTITION BY p.id) as avg_points,
          COUNT(*) OVER (PARTITION BY p.id) as games_played
        FROM player_game_logs pgl
        JOIN players p ON pgl.player_id = p.id
        LEFT JOIN teams t ON p.team_id = t.id
        WHERE pgl.fantasy_points > 0
        AND t.name IN (${BASEBALL_TEAMS.map(t => `'${t}'`).join(',')})
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
        -- Assign positions based on name patterns and distribution
        CASE 
          -- Check if name contains pitcher keywords
          WHEN player_name ~* '(${KNOWN_PITCHERS.join('|')})' THEN 'P'
          -- Distribute other positions
          WHEN MOD(id::integer, 8) = 0 THEN 'C'
          WHEN MOD(id::integer, 8) = 1 THEN '1B'
          WHEN MOD(id::integer, 8) = 2 THEN '2B'
          WHEN MOD(id::integer, 8) = 3 THEN '3B'
          WHEN MOD(id::integer, 8) = 4 THEN 'SS'
          WHEN MOD(id::integer, 8) IN (5,6,7) THEN 'OF'
          ELSE 'UTIL'
        END as position,
        COALESCE(team, 'FA'),
        'draftkings',
        -- Baseball-appropriate salaries
        CASE 
          WHEN avg_points > 20 THEN 8000 + (avg_points - 20) * 150
          WHEN avg_points > 15 THEN 6000 + (avg_points - 15) * 400
          WHEN avg_points > 10 THEN 4500 + (avg_points - 10) * 300
          WHEN avg_points > 5 THEN 3500 + (avg_points - 5) * 200
          ELSE 3000 + avg_points * 100
        END::integer,
        avg_points,
        -- Ownership based on performance
        LEAST(35, GREATEST(5, avg_points * 1.5)),
        CURRENT_DATE
      FROM baseball_game_logs
      WHERE avg_points > 0
      AND avg_points < 50  -- Baseball realistic range
      AND games_played >= 5
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
    console.log(chalk.green(`✅ Generated ${result.rowCount} DFS entries!`));
    
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
    
    // Show top 10 players
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
    
    // Show sample by position
    console.log(chalk.yellow('\n⚾ Sample Players by Position:'));
    const samplePositions = ['P', 'C', '1B', 'SS', 'OF'];
    for (const pos of samplePositions) {
      const sampleQuery = `
        SELECT player_name, team, salary, projected_points
        FROM dfs_salaries
        WHERE position = $1
        ORDER BY projected_points DESC
        LIMIT 2;
      `;
      const samples = await client.query(sampleQuery, [pos]);
      if (samples.rows.length > 0) {
        console.log(chalk.cyan(`\n${pos}:`));
        samples.rows.forEach(p => {
          console.log(`  ${p.player_name} (${p.team}) - $${p.salary} - ${Number(p.projected_points).toFixed(1)} pts`);
        });
      }
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
    console.error('Full error:', error);
  } finally {
    await client.end();
  }
}

generateSimpleDFS().catch(console.error);
#!/usr/bin/env tsx
/**
 * Debug view joins
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

async function debugJoins() {
  console.log(chalk.cyan.bold('\n🔍 Debugging View Joins\n'));
  
  try {
    // Check games_master structure
    console.log(chalk.yellow('1. Games Master columns:'));
    const gmCols = await pool.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'games_master'
      ORDER BY ordinal_position
      LIMIT 15
    `);
    gmCols.rows.forEach(col => {
      console.log(chalk.gray(`  - ${col.column_name}: ${col.data_type}`));
    });
    
    // Check if game_ids match between tables
    console.log(chalk.yellow('\n2. Checking game_id matching:'));
    const gameMatch = await pool.query(`
      SELECT 
        COUNT(DISTINCT pgs.game_id) as pgs_games,
        COUNT(DISTINCT gm.id) as gm_games,
        COUNT(DISTINCT pgs.game_id) FILTER (WHERE EXISTS (
          SELECT 1 FROM games_master gm WHERE gm.id = pgs.game_id
        )) as matching_games
      FROM player_game_stats pgs
      CROSS JOIN games_master gm
      WHERE pgs.sport = 'NFL'
      LIMIT 1
    `);
    
    const match = gameMatch.rows[0];
    console.log(chalk.green(`  player_game_stats games: ${match.pgs_games}`));
    console.log(chalk.green(`  games_master games: ${match.gm_games}`));
    console.log(chalk.green(`  Matching games: ${match.matching_games}`));
    
    // Try a simple NFL query without all the joins
    console.log(chalk.yellow('\n3. Testing simple NFL query:'));
    const simpleNFL = await pool.query(`
      SELECT 
        pgs.player_id,
        p.name,
        pgs.position,
        pgs.dk_points,
        pgs.sport,
        pgs.game_id
      FROM player_game_stats pgs
      JOIN players p ON p.id = pgs.player_id
      WHERE pgs.sport = 'NFL'
      AND pgs.stats IS NOT NULL
      LIMIT 5
    `);
    
    console.log(chalk.green(`  Found ${simpleNFL.rows.length} NFL records`));
    if (simpleNFL.rows.length > 0) {
      console.log(chalk.gray(`  Sample: ${simpleNFL.rows[0].name} - ${simpleNFL.rows[0].position} - DK: ${simpleNFL.rows[0].dk_points}`));
    }
    
    // Check if the issue is the games_master join
    console.log(chalk.yellow('\n4. Testing with games_master join:'));
    const withGM = await pool.query(`
      SELECT COUNT(*) as count
      FROM player_game_stats pgs
      JOIN players p ON p.id = pgs.player_id
      JOIN games_master gm ON gm.id = pgs.game_id
      WHERE pgs.sport = 'NFL'
      AND pgs.stats IS NOT NULL
    `);
    
    console.log(chalk.green(`  With games_master join: ${withGM.rows[0].count} records`));
    
    await pool.end();
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

debugJoins().catch(console.error);
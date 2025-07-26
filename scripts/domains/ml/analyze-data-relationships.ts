#!/usr/bin/env tsx
/**
 * Analyze actual data relationships
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

async function analyzeRelationships() {
  console.log(chalk.cyan.bold('\n🔍 Analyzing Data Relationships\n'));
  
  try {
    // 1. Check sample game IDs from both tables
    console.log(chalk.yellow('1. Sample game IDs comparison:'));
    
    const pgsGames = await pool.query(`
      SELECT DISTINCT game_id, sport 
      FROM player_game_stats 
      WHERE sport IN ('NFL', 'NBA', 'MLB', 'NHL')
      ORDER BY sport, game_id 
      LIMIT 10
    `);
    
    console.log(chalk.cyan('Player game stats game_ids:'));
    pgsGames.rows.forEach(row => {
      console.log(chalk.gray(`  ${row.sport}: ${row.game_id}`));
    });
    
    const gmGames = await pool.query(`
      SELECT id, sport, our_game_id, espn_game_id 
      FROM games_master 
      WHERE sport IN ('NFL', 'NBA', 'MLB', 'NHL')
      ORDER BY sport, id 
      LIMIT 10
    `);
    
    console.log(chalk.cyan('\nGames master IDs:'));
    gmGames.rows.forEach(row => {
      console.log(chalk.gray(`  ${row.sport}: id=${row.id}, our_game_id=${row.our_game_id}, espn_id=${row.espn_game_id}`));
    });
    
    // 2. Check if we can join on game_id = id
    console.log(chalk.yellow('\n2. Testing direct join (pgs.game_id = gm.id):'));
    const directJoin = await pool.query(`
      SELECT 
        pgs.sport,
        COUNT(DISTINCT pgs.game_id) as pgs_games,
        COUNT(DISTINCT gm.id) as matching_games
      FROM player_game_stats pgs
      INNER JOIN games_master gm ON pgs.game_id = gm.id
      WHERE pgs.sport IN ('NFL', 'NBA', 'MLB', 'NHL')
      GROUP BY pgs.sport
    `);
    
    directJoin.rows.forEach(row => {
      console.log(chalk.green(`  ${row.sport}: ${row.matching_games}/${row.pgs_games} games match`));
    });
    
    // 3. Check data completeness without games_master join
    console.log(chalk.yellow('\n3. Data availability without games_master:'));
    const dataCheck = await pool.query(`
      SELECT 
        sport,
        COUNT(*) as total_records,
        COUNT(DISTINCT player_id) as players,
        COUNT(stats) as with_stats,
        COUNT(dk_points) FILTER (WHERE dk_points > 0) as with_dk_points,
        AVG(dk_points) FILTER (WHERE dk_points > 0) as avg_dk_points
      FROM player_game_stats
      WHERE sport IN ('NFL', 'NBA', 'MLB', 'NHL')
      GROUP BY sport
      ORDER BY sport
    `);
    
    dataCheck.rows.forEach(row => {
      console.log(chalk.cyan(`\n${row.sport}:`));
      console.log(chalk.gray(`  Total records: ${row.total_records}`));
      console.log(chalk.gray(`  Players: ${row.players}`));
      console.log(chalk.gray(`  With stats: ${row.with_stats}`));
      console.log(chalk.gray(`  With DK points > 0: ${row.with_dk_points}`));
      console.log(chalk.gray(`  Avg DK points: ${parseFloat(row.avg_dk_points || 0).toFixed(2)}`));
    });
    
    await pool.end();
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

analyzeRelationships().catch(console.error);
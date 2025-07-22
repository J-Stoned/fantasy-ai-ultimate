#!/usr/bin/env tsx
/**
 * Debug NHL stats structure
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

async function debugNHL() {
  console.log(chalk.cyan.bold('\n🏒 Debugging NHL Stats\n'));
  
  try {
    // Check sample NHL records
    const sample = await pool.query(`
      SELECT 
        p.name,
        pgs.position,
        pgs.stats,
        pgs.dk_points,
        pgs.fd_points
      FROM player_game_stats pgs
      JOIN players p ON p.id = pgs.player_id
      WHERE pgs.sport = 'NHL'
      AND pgs.stats IS NOT NULL
      LIMIT 10
    `);
    
    console.log(chalk.yellow('Sample NHL Records:'));
    sample.rows.forEach((row, i) => {
      console.log(chalk.cyan(`\nRecord ${i+1}: ${row.name} (${row.position})`));
      console.log(chalk.gray(`  DK Points: ${row.dk_points}`));
      console.log(chalk.gray(`  FD Points: ${row.fd_points}`));
      console.log(chalk.gray(`  Stats: ${JSON.stringify(row.stats)}`));
    });
    
    // Check stat keys by position
    console.log(chalk.yellow('\n\nNHL Stat Keys by Position:'));
    const statKeys = await pool.query(`
      SELECT DISTINCT
        position,
        jsonb_object_keys(stats) as stat_key
      FROM player_game_stats
      WHERE sport = 'NHL'
      AND stats IS NOT NULL
      ORDER BY position, stat_key
    `);
    
    let currentPos = '';
    statKeys.rows.forEach(row => {
      if (row.position !== currentPos) {
        currentPos = row.position;
        console.log(chalk.cyan(`\n${row.position}:`));
      }
      console.log(chalk.gray(`  - ${row.stat_key}`));
    });
    
    await pool.end();
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  }
}

debugNHL().catch(console.error);
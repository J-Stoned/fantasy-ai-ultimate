#!/usr/bin/env tsx
/**
 * Create missing DFS tables
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: join(__dirname, '..', '..', '.env.local') });

const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL_LOCAL ? false : { rejectUnauthorized: false }
});

async function createMissingTables() {
  console.log(chalk.bold.cyan('🚀 CREATING MISSING DFS TABLES...'));
  
  try {
    // Read and execute the SQL file
    const sqlPath = join(__dirname, 'sql', 'create-missing-dfs-tables.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    await pgPool.query(sql);
    console.log(chalk.green('✅ Missing tables created successfully!'));
    
    // Verify tables were created
    const tables = await pgPool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
      AND tablename IN ('player_salaries', 'game_logs', 'dfs_ownership_projections', 'fantasy_points', 'player_stats', 'team_defense', 'games')
      ORDER BY tablename
    `);
    
    console.log(chalk.cyan('\n📊 Newly created tables:'));
    tables.rows.forEach(row => {
      console.log(chalk.green(`  ✓ ${row.tablename}`));
    });
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pgPool.end();
  }
}

createMissingTables().catch(console.error);
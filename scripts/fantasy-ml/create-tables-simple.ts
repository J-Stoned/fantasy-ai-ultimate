#!/usr/bin/env tsx
/**
 * Create DFS tables (simple version)
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

async function createTables() {
  console.log(chalk.bold.cyan('🚀 CREATING DFS TABLES...'));
  
  try {
    const sqlPath = join(__dirname, 'sql', 'create-dfs-tables-simple.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    await pgPool.query(sql);
    console.log(chalk.green('✅ Tables created successfully!'));
    
    // Now run the optimization script
    console.log(chalk.cyan('\n🚀 Running optimizations...'));
    const optimizePath = join(__dirname, 'sql', 'optimize-dfs-database.sql');
    const optimizeSql = readFileSync(optimizePath, 'utf8');
    
    // Split and execute statements
    const statements = optimizeSql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    let successCount = 0;
    for (const statement of statements) {
      try {
        await pgPool.query(statement + ';');
        successCount++;
      } catch (error: any) {
        if (!error.message.includes('already exists')) {
          console.error(chalk.yellow('⚠️  Skipped:', error.message.split('\n')[0]));
        }
      }
    }
    
    console.log(chalk.green(`✅ Optimizations applied: ${successCount}/${statements.length}`));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await pgPool.end();
  }
}

createTables().catch(console.error);
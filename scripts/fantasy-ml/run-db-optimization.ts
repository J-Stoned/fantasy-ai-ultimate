#!/usr/bin/env tsx
/**
 * 🚀 Execute DFS Database Optimizations
 */

import { Pool } from 'pg';
import { readFileSync } from 'fs';
import { join } from 'path';
import chalk from 'chalk';
import dotenv from 'dotenv';

// Load environment variables from the project root
dotenv.config({ path: join(__dirname, '..', '..', '.env.local') });

// Create a new pool with proper configuration
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL_LOCAL ? false : { rejectUnauthorized: false }
});

async function runOptimization() {
  console.log(chalk.bold.cyan('🚀 RUNNING DFS DATABASE OPTIMIZATIONS...'));
  
  try {
    // Test connection first
    console.log(chalk.yellow('Testing database connection...'));
    const testResult = await pgPool.query('SELECT NOW()');
    console.log(chalk.green('✅ Database connected:', testResult.rows[0].now));
    
    // Read the SQL file
    const sqlPath = join(__dirname, 'sql', 'optimize-dfs-database.sql');
    const sql = readFileSync(sqlPath, 'utf8');
    
    // Split by statements (crude but works for our needs)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));
    
    console.log(chalk.yellow(`Found ${statements.length} SQL statements to execute\n`));
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      // Skip pure comment blocks
      if (statement.includes('--')) {
        const lines = statement.split('\n');
        const nonCommentLines = lines.filter(l => !l.trim().startsWith('--'));
        if (nonCommentLines.join('').trim().length === 0) continue;
      }
      
      try {
        console.log(chalk.gray(`Executing statement ${i + 1}/${statements.length}...`));
        await pgPool.query(statement);
        successCount++;
      } catch (error: any) {
        // Some errors are expected (e.g., "already exists")
        if (error.message.includes('already exists')) {
          console.log(chalk.yellow(`⚠️  Skipped (already exists): ${error.message}`));
          successCount++;
        } else {
          console.error(chalk.red(`❌ Error in statement ${i + 1}:`), error.message);
          errorCount++;
        }
      }
    }
    
    console.log(chalk.green(`\n✅ Optimization complete!`));
    console.log(chalk.green(`   Successful: ${successCount}`));
    if (errorCount > 0) {
      console.log(chalk.red(`   Failed: ${errorCount}`));
    }
    
    // Test one of the optimizations
    console.log(chalk.cyan('\n🧪 Testing optimization...'));
    const result = await pgPool.query(`
      SELECT COUNT(*) FROM pg_indexes 
      WHERE tablename IN ('player_projections', 'player_salaries', 'game_logs')
    `);
    console.log(chalk.green(`✅ Found ${result.rows[0].count} indexes on key tables`));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to run optimizations:'), error);
  } finally {
    await pgPool.end();
  }
}

runOptimization().catch(console.error);
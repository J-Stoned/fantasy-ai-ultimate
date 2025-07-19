#!/usr/bin/env tsx
/**
 * Run NCAA batch SQL fix
 */

import { Client } from 'pg';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function runBatchFix() {
  const client = new Client({
    connectionString: process.env.DIRECT_URL || process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log(chalk.bold.cyan('🔨 RUNNING BATCH NCAA BASEBALL FIX\n'));

    // Read SQL file
    const fs = await import('fs');
    const sql = fs.readFileSync('./scripts/cleanup-5-ncaa-batch-sql.sql', 'utf-8');

    // Execute the SQL
    const statements = sql.split(';').filter(s => s.trim().length > 0);
    
    for (const statement of statements) {
      if (statement.trim().startsWith('--') || statement.trim().length === 0) continue;
      
      try {
        const result = await client.query(statement + ';');
        
        if (result.rows && result.rows.length > 0) {
          console.table(result.rows);
        } else if (result.command) {
          console.log(`${result.command}: ${result.rowCount} rows affected`);
        }
      } catch (err: any) {
        console.error(chalk.red(`Error: ${err.message}`));
        if (err.detail) console.error(`Detail: ${err.detail}`);
      }
    }

    console.log(chalk.green('\n✅ Batch fix complete!'));

  } catch (error: any) {
    console.error(chalk.red('❌ Connection error:'), error.message);
  } finally {
    await client.end();
  }
}

runBatchFix();
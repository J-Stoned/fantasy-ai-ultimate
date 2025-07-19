#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const pgClient = new Client({
  host: 'localhost',
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres'
});

const TABLES = [
  { name: 'sports', size: 'small' },
  { name: 'teams', size: 'medium' },
  { name: 'players', size: 'large' },
  { name: 'games', size: 'large' },
  { name: 'betting_lines', size: 'large' },
  { name: 'weather_data', size: 'medium' },
  { name: 'player_injuries', size: 'medium' },
  { name: 'player_game_logs', size: 'huge' },
  { name: 'player_stats', size: 'huge' }
];

async function copyTable(tableName: string, size: string) {
  console.log(chalk.yellow(`\nCopying ${tableName}...`));
  
  try {
    // Get total count
    const { count } = await supabase.from(tableName).select('*', { count: 'exact', head: true });
    console.log(chalk.gray(`Total rows: ${count?.toLocaleString() || 'unknown'}`));
    
    // Create table if needed
    await pgClient.query(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id SERIAL PRIMARY KEY,
        data JSONB
      )
    `).catch(() => {});
    
    // Clear existing data
    await pgClient.query(`TRUNCATE TABLE ${tableName} CASCADE`).catch(() => {});
    
    // Copy in batches
    const batchSize = size === 'huge' ? 500 : 1000;
    let offset = 0;
    let totalCopied = 0;
    
    while (true) {
      const { data, error } = await supabase
        .from(tableName)
        .select('*')
        .range(offset, offset + batchSize - 1);
      
      if (error || !data || data.length === 0) break;
      
      // First batch: create proper table structure
      if (offset === 0 && data.length > 0) {
        const columns = Object.keys(data[0]);
        const columnDefs = columns.map(col => {
          const val = data[0][col];
          let type = 'TEXT';
          if (typeof val === 'number') type = 'NUMERIC';
          else if (typeof val === 'boolean') type = 'BOOLEAN';
          else if (val instanceof Date) type = 'TIMESTAMPTZ';
          return `${col} ${type}`;
        }).join(', ');
        
        await pgClient.query(`DROP TABLE IF EXISTS ${tableName}`);
        await pgClient.query(`CREATE TABLE ${tableName} (${columnDefs})`);
      }
      
      // Insert batch
      for (const row of data) {
        const columns = Object.keys(row);
        const values = columns.map((_, i) => `$${i + 1}`);
        const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')})`;
        await pgClient.query(query, columns.map(col => row[col]));
      }
      
      totalCopied += data.length;
      offset += batchSize;
      
      // Progress
      process.stdout.write(chalk.green(`\rCopied: ${totalCopied.toLocaleString()} rows`));
      
      if (data.length < batchSize) break;
    }
    
    console.log(chalk.green(`\n✅ Copied ${totalCopied.toLocaleString()} rows`));
    return totalCopied;
    
  } catch (error) {
    console.error(chalk.red(`Error copying ${tableName}:`), error.message);
    return 0;
  }
}

async function main() {
  console.log(chalk.bold.cyan('🚀 Copying Supabase Data to Local PostgreSQL'));
  console.log(chalk.gray('='.repeat(50)));
  
  try {
    await pgClient.connect();
    console.log(chalk.green('✅ Connected to local PostgreSQL!'));
    
    let totalRows = 0;
    for (const table of TABLES) {
      const copied = await copyTable(table.name, table.size);
      totalRows += copied;
    }
    
    console.log(chalk.gray('\n' + '='.repeat(50)));
    console.log(chalk.bold.green('✅ DATA COPY COMPLETE!'));
    console.log(chalk.yellow(`Total rows copied: ${totalRows.toLocaleString()}`));
    console.log(chalk.cyan('\n🎉 Your local database is ready for blazing fast queries!'));
    
  } catch (error) {
    console.error(chalk.red('Connection error:'), error.message);
    console.log(chalk.yellow('\nMake sure PostgreSQL is running on port 5432'));
  } finally {
    await pgClient.end();
  }
}

main();
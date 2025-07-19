#!/usr/bin/env tsx
/**
 * Copy data from Supabase using REST API (no direct connection needed!)
 */

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

// Supabase client using your existing credentials
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Local PostgreSQL
const LOCAL_DB = {
  host: 'localhost',
  port: 5434,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: process.argv[2] || 'postgres'
};

// Tables to copy (in order)
const TABLES = [
  { name: 'sports', estimatedRows: 10 },
  { name: 'teams', estimatedRows: 3000 },
  { name: 'players', estimatedRows: 90000 },
  { name: 'games', estimatedRows: 50000 },
  { name: 'betting_lines', estimatedRows: 40000 },
  { name: 'weather_data', estimatedRows: 10000 },
  { name: 'player_injuries', estimatedRows: 3500 },
  { name: 'player_game_logs', estimatedRows: 700000 },
  { name: 'player_stats', estimatedRows: 400000 }
];

async function createTableFromData(client: Client, tableName: string, sampleData: any) {
  if (!sampleData || sampleData.length === 0) return;
  
  const columns = Object.keys(sampleData[0]);
  
  let createQuery = `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;
  createQuery += columns.map(col => {
    const value = sampleData[0][col];
    let type = 'TEXT';
    
    if (typeof value === 'number') {
      type = Number.isInteger(value) ? 'INTEGER' : 'NUMERIC';
    } else if (typeof value === 'boolean') {
      type = 'BOOLEAN';
    } else if (value instanceof Date || (typeof value === 'string' && value.match(/^\d{4}-\d{2}-\d{2}/))) {
      type = 'TIMESTAMPTZ';
    }
    
    return `  ${col} ${type}`;
  }).join(',\n');
  
  createQuery += '\n);';
  
  try {
    await client.query(createQuery);
  } catch (error) {
    // Table might already exist with proper schema
  }
}

async function copyTableViaAPI(client: Client, tableName: string, estimatedRows: number) {
  console.log(chalk.yellow(`\n📦 Copying ${tableName} (~${estimatedRows.toLocaleString()} rows)...`));
  
  try {
    // Clear existing data
    await client.query(`TRUNCATE TABLE ${tableName} CASCADE`).catch(() => {});
    
    let allData: any[] = [];
    let from = 0;
    const limit = 1000;
    let hasMore = true;
    
    while (hasMore) {
      // Fetch batch from Supabase
      const { data, error, count } = await supabase
        .from(tableName)
        .select('*', { count: 'exact' })
        .range(from, from + limit - 1);
      
      if (error) {
        console.error(chalk.red(`Error fetching ${tableName}:`), error.message);
        return 0;
      }
      
      if (!data || data.length === 0) {
        hasMore = false;
        break;
      }
      
      // First batch: create table structure
      if (from === 0) {
        await createTableFromData(client, tableName, data);
        if (count) {
          console.log(chalk.gray(`Total rows: ${count.toLocaleString()}`));
        }
      }
      
      // Insert batch into local DB
      const columns = Object.keys(data[0]);
      
      for (const row of data) {
        const values = columns.map((col, i) => `$${i + 1}`);
        const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')})`;
        const params = columns.map(col => row[col]);
        
        await client.query(query, params);
      }
      
      allData = allData.concat(data);
      from += limit;
      hasMore = data.length === limit;
      
      // Progress
      process.stdout.write(chalk.gray(`\r  Copied: ${allData.length.toLocaleString()} rows`));
    }
    
    console.log(chalk.green(`\n✅ Successfully copied ${allData.length.toLocaleString()} rows`));
    return allData.length;
    
  } catch (error) {
    console.error(chalk.red(`\nError copying ${tableName}:`), error.message);
    return 0;
  }
}

async function main() {
  console.log(chalk.bold.cyan('🚀 Supabase → Local PostgreSQL Copy (via API)'));
  console.log(chalk.gray('='.repeat(60)));
  console.log(chalk.yellow('This method works without direct database connection!'));
  console.log(chalk.gray('='.repeat(60)));
  
  if (!process.argv[2]) {
    console.log(chalk.red('Please provide your local PostgreSQL password'));
    return;
  }
  
  LOCAL_DB.password = process.argv[2];
  
  const client = new Client(LOCAL_DB);
  
  try {
    console.log(chalk.yellow('\nConnecting to local PostgreSQL...'));
    await client.connect();
    console.log(chalk.green('✅ Connected!'));
    
    const startTime = Date.now();
    let totalCopied = 0;
    
    // Copy each table
    for (const table of TABLES) {
      const count = await copyTableViaAPI(client, table.name, table.estimatedRows);
      totalCopied += count;
    }
    
    // Update statistics
    console.log(chalk.yellow('\n📊 Updating database statistics...'));
    for (const table of TABLES) {
      try {
        await client.query(`ANALYZE ${table.name}`);
      } catch (e) {
        // Ignore
      }
    }
    
    const duration = ((Date.now() - startTime) / 1000 / 60).toFixed(1);
    
    console.log(chalk.gray('\n' + '='.repeat(60)));
    console.log(chalk.bold.green('✅ DATA COPY COMPLETE!'));
    console.log(chalk.yellow(`📊 Total rows copied: ${totalCopied.toLocaleString()}`));
    console.log(chalk.yellow(`⏱️  Time taken: ${duration} minutes`));
    console.log(chalk.bold.cyan('\n🎉 Your local database is ready!'));
    console.log(chalk.green('\n🚀 Test the speed:'));
    console.log(chalk.white('   npx tsx scripts/local-db-setup/test-local-5434.ts'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Error:'), error.message);
  } finally {
    await client.end();
  }
}

main().catch(console.error);
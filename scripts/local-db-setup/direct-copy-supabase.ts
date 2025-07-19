#!/usr/bin/env tsx
/**
 * Direct copy from Supabase to local PostgreSQL
 * No CSV exports needed!
 */

import { Client } from 'pg';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

// Get Supabase connection from your existing .env.local
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Extract database URL from Supabase
// Go to Supabase Dashboard > Settings > Database > Connection String
const SUPABASE_DB_URL = process.env.SUPABASE_DIRECT_URL || 'postgresql://postgres:[YOUR-PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres';

// Local PostgreSQL
const LOCAL_DB = {
  host: 'localhost',
  port: 5434,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: process.argv[2] || 'postgres'
};

const TABLES = [
  'sports',
  'teams', 
  'players',
  'games',
  'betting_lines',
  'weather_data',
  'player_injuries',
  'player_game_logs',
  'player_stats'
];

async function copyTable(sourceClient: Client, destClient: Client, tableName: string) {
  console.log(chalk.yellow(`\nCopying ${tableName}...`));
  
  try {
    // Get count
    const countResult = await sourceClient.query(`SELECT COUNT(*) FROM ${tableName}`);
    const totalRows = parseInt(countResult.rows[0].count);
    console.log(chalk.gray(`Total rows: ${totalRows.toLocaleString()}`));
    
    if (totalRows === 0) {
      console.log(chalk.yellow('No data to copy'));
      return 0;
    }
    
    // Get table structure
    const columnsResult = await sourceClient.query(`
      SELECT column_name, data_type, character_maximum_length, is_nullable
      FROM information_schema.columns
      WHERE table_name = $1 AND table_schema = 'public'
      ORDER BY ordinal_position
    `, [tableName]);
    
    const columns = columnsResult.rows.map(col => col.column_name);
    
    // Create table in destination
    const createTableQuery = `
      CREATE TABLE IF NOT EXISTS ${tableName} (
        ${columnsResult.rows.map(col => {
          let def = `${col.column_name} ${col.data_type}`;
          if (col.character_maximum_length) {
            def += `(${col.character_maximum_length})`;
          }
          if (col.is_nullable === 'NO') {
            def += ' NOT NULL';
          }
          return def;
        }).join(',\n        ')}
      )
    `;
    
    await destClient.query(createTableQuery);
    
    // Clear existing data
    await destClient.query(`TRUNCATE TABLE ${tableName} CASCADE`);
    
    // Copy data in chunks
    const chunkSize = 10000;
    let offset = 0;
    let copied = 0;
    
    while (offset < totalRows) {
      // Fetch chunk from source
      const result = await sourceClient.query(`
        SELECT * FROM ${tableName}
        ORDER BY ${columns[0]}
        LIMIT ${chunkSize} OFFSET ${offset}
      `);
      
      if (result.rows.length === 0) break;
      
      // Insert into destination
      for (const row of result.rows) {
        const values = columns.map((col, i) => `$${i + 1}`);
        const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES (${values.join(', ')})`;
        const params = columns.map(col => row[col]);
        
        await destClient.query(query, params);
      }
      
      copied += result.rows.length;
      offset += chunkSize;
      
      // Progress
      const progress = Math.round((copied / totalRows) * 100);
      process.stdout.write(`\r${chalk.green(`Progress: ${progress}% (${copied.toLocaleString()} rows)`)}`);
    }
    
    console.log(chalk.green(`\n✅ Copied ${copied.toLocaleString()} rows`));
    return copied;
    
  } catch (error) {
    console.error(chalk.red(`Error copying ${tableName}:`), error.message);
    return 0;
  }
}

async function main() {
  console.log(chalk.bold.cyan('🚀 Direct Database Copy: Supabase → Local'));
  console.log(chalk.gray('='.repeat(50)));
  
  if (!SUPABASE_DB_URL || SUPABASE_DB_URL.includes('[YOUR-PASSWORD]')) {
    console.log(chalk.red('❌ Supabase connection string not found!'));
    console.log(chalk.yellow('\nTo get your connection string:'));
    console.log('1. Go to Supabase Dashboard');
    console.log('2. Settings → Database');
    console.log('3. Copy the "Connection string" (URI)');
    console.log('4. Add to .env.local as SUPABASE_DIRECT_URL');
    return;
  }
  
  const sourceClient = new Client(SUPABASE_DB_URL);
  const destClient = new Client(LOCAL_DB);
  
  try {
    // Connect to both databases
    console.log(chalk.yellow('Connecting to Supabase...'));
    await sourceClient.connect();
    console.log(chalk.green('✅ Connected to Supabase'));
    
    console.log(chalk.yellow('Connecting to local PostgreSQL...'));
    await destClient.connect();
    console.log(chalk.green('✅ Connected to local'));
    
    // Copy each table
    let totalCopied = 0;
    
    for (const table of TABLES) {
      const count = await copyTable(sourceClient, destClient, table);
      totalCopied += count;
    }
    
    // Update statistics
    console.log(chalk.yellow('\nUpdating statistics...'));
    for (const table of TABLES) {
      await destClient.query(`ANALYZE ${table}`);
    }
    
    console.log(chalk.gray('\n' + '='.repeat(50)));
    console.log(chalk.bold.green('✅ Database Copy Complete!'));
    console.log(chalk.yellow(`Total rows copied: ${totalCopied.toLocaleString()}`));
    console.log(chalk.bold.cyan('\n🎉 Your local database is ready for 10-50x faster queries!'));
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
  } finally {
    await sourceClient.end();
    await destClient.end();
  }
}

// Show usage if no password provided
if (!process.argv[2]) {
  console.log(chalk.yellow('Usage: npx tsx direct-copy-supabase.ts [postgres-password]'));
  console.log(chalk.yellow('Example: npx tsx direct-copy-supabase.ts mypassword'));
}

main().catch(console.error);
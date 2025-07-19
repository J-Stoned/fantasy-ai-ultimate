#!/usr/bin/env tsx
/**
 * Import CSV files from Supabase into local PostgreSQL
 * This handles the CSV exports from Supabase Table Editor
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import * as csv from 'csv-parse';
import chalk from 'chalk';
import { createReadStream } from 'fs';

// Update this path to where you saved the CSV files
const CSV_FOLDER = 'C:\\Users\\st0ne\\Downloads\\fantasy-ai-data';

// Update with your PostgreSQL password
const DB_CONFIG = {
  host: 'localhost',
  port: 5434,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres' // Change this to your password
};

// Tables in dependency order
const TABLES_ORDER = [
  'sports',
  'teams',
  'players',
  'games',
  'player_game_logs',
  'player_stats',
  'betting_lines',
  'weather_data',
  'player_injuries'
];

async function createTablesIfNeeded(client: Client) {
  console.log(chalk.yellow('Creating tables if they don\'t exist...'));
  
  // Basic table schemas - adjust based on your actual schema
  const schemas = {
    sports: `
      CREATE TABLE IF NOT EXISTS sports (
        id VARCHAR PRIMARY KEY,
        name VARCHAR NOT NULL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    teams: `
      CREATE TABLE IF NOT EXISTS teams (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL,
        sport_id VARCHAR,
        abbreviation VARCHAR,
        external_id VARCHAR UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    players: `
      CREATE TABLE IF NOT EXISTS players (
        id SERIAL PRIMARY KEY,
        name VARCHAR NOT NULL,
        team_id INTEGER,
        sport_id VARCHAR,
        position VARCHAR,
        external_id VARCHAR UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    games: `
      CREATE TABLE IF NOT EXISTS games (
        id SERIAL PRIMARY KEY,
        sport_id VARCHAR,
        home_team_id INTEGER,
        away_team_id INTEGER,
        start_time TIMESTAMPTZ,
        status VARCHAR,
        home_score INTEGER,
        away_score INTEGER,
        season INTEGER,
        week INTEGER,
        external_id VARCHAR UNIQUE,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    player_game_logs: `
      CREATE TABLE IF NOT EXISTS player_game_logs (
        id SERIAL PRIMARY KEY,
        player_id INTEGER,
        game_id INTEGER,
        team_id INTEGER,
        minutes_played DECIMAL,
        points INTEGER,
        rebounds INTEGER,
        assists INTEGER,
        fantasy_points DECIMAL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    player_stats: `
      CREATE TABLE IF NOT EXISTS player_stats (
        id SERIAL PRIMARY KEY,
        player_id INTEGER,
        game_id INTEGER,
        stat_type VARCHAR,
        stat_value DECIMAL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    betting_lines: `
      CREATE TABLE IF NOT EXISTS betting_lines (
        id SERIAL PRIMARY KEY,
        game_id INTEGER,
        home_spread DECIMAL,
        away_spread DECIMAL,
        home_moneyline INTEGER,
        away_moneyline INTEGER,
        total DECIMAL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    weather_data: `
      CREATE TABLE IF NOT EXISTS weather_data (
        id SERIAL PRIMARY KEY,
        game_id INTEGER,
        temperature DECIMAL,
        wind_speed DECIMAL,
        precipitation DECIMAL,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`,
    player_injuries: `
      CREATE TABLE IF NOT EXISTS player_injuries (
        id SERIAL PRIMARY KEY,
        player_id INTEGER,
        injury_date DATE,
        injury_type VARCHAR,
        status VARCHAR,
        created_at TIMESTAMPTZ DEFAULT NOW()
      )`
  };

  for (const [table, schema] of Object.entries(schemas)) {
    try {
      await client.query(schema);
      console.log(chalk.green(`✓ Table ${table} ready`));
    } catch (error) {
      console.log(chalk.yellow(`Table ${table} might already exist`));
    }
  }
}

async function importCSV(client: Client, tableName: string, csvPath: string) {
  return new Promise<number>((resolve, reject) => {
    console.log(chalk.yellow(`\nImporting ${tableName}...`));
    
    const rows: any[] = [];
    let headers: string[] = [];
    
    createReadStream(csvPath)
      .pipe(csv.parse({ 
        columns: true,
        skip_empty_lines: true,
        cast: true,
        cast_date: true
      }))
      .on('data', (row) => {
        if (headers.length === 0) {
          headers = Object.keys(row);
        }
        rows.push(row);
        
        // Show progress every 10k rows
        if (rows.length % 10000 === 0) {
          process.stdout.write(chalk.gray(`.`));
        }
      })
      .on('end', async () => {
        console.log(chalk.gray(` ${rows.length} rows`));
        
        if (rows.length === 0) {
          console.log(chalk.yellow(`No data in ${tableName}`));
          resolve(0);
          return;
        }
        
        try {
          // Clear existing data
          await client.query(`TRUNCATE TABLE ${tableName} CASCADE`);
          
          // Insert in batches
          const batchSize = 1000;
          let inserted = 0;
          
          for (let i = 0; i < rows.length; i += batchSize) {
            const batch = rows.slice(i, i + batchSize);
            
            // Build insert query
            const columns = Object.keys(batch[0]).filter(col => col !== 'id' || tableName === 'sports');
            const values = batch.map((row, idx) => {
              const vals = columns.map((col, colIdx) => `$${idx * columns.length + colIdx + 1}`);
              return `(${vals.join(', ')})`;
            }).join(', ');
            
            const query = `INSERT INTO ${tableName} (${columns.join(', ')}) VALUES ${values}`;
            const params = batch.flatMap(row => columns.map(col => row[col]));
            
            await client.query(query, params);
            inserted += batch.length;
            
            process.stdout.write(chalk.green(`✓`));
          }
          
          console.log(chalk.green(` ✅ Imported ${inserted} rows`));
          resolve(inserted);
        } catch (error) {
          console.error(chalk.red(`Error importing ${tableName}:`), error);
          reject(error);
        }
      })
      .on('error', reject);
  });
}

async function main() {
  console.log(chalk.bold.cyan('🚀 CSV Import to PostgreSQL'));
  console.log(chalk.gray('='.repeat(50)));
  
  // Check if CSV folder exists
  if (!fs.existsSync(CSV_FOLDER)) {
    console.error(chalk.red(`CSV folder not found: ${CSV_FOLDER}`));
    console.log(chalk.yellow('Please update CSV_FOLDER in this script to point to your CSV files'));
    return;
  }
  
  // List CSV files found
  const csvFiles = fs.readdirSync(CSV_FOLDER).filter(f => f.endsWith('.csv'));
  console.log(chalk.green(`Found ${csvFiles.length} CSV files:`));
  csvFiles.forEach(f => console.log(`  - ${f}`));
  
  const client = new Client(DB_CONFIG);
  
  try {
    console.log(chalk.yellow('\nConnecting to PostgreSQL...'));
    await client.connect();
    console.log(chalk.green('✅ Connected!'));
    
    // Create tables if needed
    await createTablesIfNeeded(client);
    
    // Import each CSV in order
    let totalImported = 0;
    
    for (const table of TABLES_ORDER) {
      const csvFile = csvFiles.find(f => f.toLowerCase().includes(table));
      if (csvFile) {
        const csvPath = path.join(CSV_FOLDER, csvFile);
        const count = await importCSV(client, table, csvPath);
        totalImported += count;
      } else {
        console.log(chalk.yellow(`⚠️  No CSV file found for ${table}`));
      }
    }
    
    console.log(chalk.gray('\n' + '='.repeat(50)));
    console.log(chalk.bold.green('✅ Import Complete!'));
    console.log(chalk.yellow(`Total rows imported: ${totalImported.toLocaleString()}`));
    
    // Run ANALYZE to update statistics
    console.log(chalk.yellow('\nUpdating database statistics...'));
    for (const table of TABLES_ORDER) {
      await client.query(`ANALYZE ${table}`);
    }
    console.log(chalk.green('✅ Statistics updated!'));
    
    console.log(chalk.bold.cyan('\n🎉 Your local database is ready!'));
    console.log('Run the performance test to see the speed improvement!');
    
  } catch (error) {
    console.error(chalk.red('Error:'), error);
    console.log(chalk.yellow('\nTroubleshooting:'));
    console.log('1. Check your PostgreSQL password in DB_CONFIG');
    console.log('2. Make sure PostgreSQL is running on port 5434');
    console.log('3. Verify CSV files are in the correct folder');
  } finally {
    await client.end();
  }
}

// Get password from command line if provided
if (process.argv[2]) {
  DB_CONFIG.password = process.argv[2];
}

main().catch(console.error);
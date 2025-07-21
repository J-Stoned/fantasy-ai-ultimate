#!/usr/bin/env tsx
/**
 * Setup Fantasy ML Database Tables
 */

import chalk from 'chalk';
import { Client } from 'pg';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

// Load environment variables
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function setupDatabase() {
  console.log(chalk.cyan('🏗️  Setting up Fantasy ML Database...\n'));
  
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    host: process.env.DATABASE_HOST || 'localhost',
    port: parseInt(process.env.DATABASE_PORT || '5432'),
    database: process.env.DATABASE_NAME || 'fantasy_ai_local',
    user: process.env.DATABASE_USER || 'postgres',
    password: process.env.DATABASE_PASSWORD || 'postgres'
  });
  
  try {
    await client.connect();
    console.log(chalk.green('✅ Connected to database\n'));
    
    // Read and execute the SQL file
    const sqlPath = path.resolve(process.cwd(), 'scripts/sql/create-fantasy-ml-tables.sql');
    console.log(chalk.yellow(`Reading SQL from: ${sqlPath}`));
    
    if (!fs.existsSync(sqlPath)) {
      throw new Error(`SQL file not found at: ${sqlPath}`);
    }
    
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split by semicolon and execute each statement
    const statements = sql
      .split(';')
      .filter(stmt => stmt.trim().length > 0)
      .map(stmt => stmt.trim() + ';');
    
    console.log(chalk.yellow(`\nExecuting ${statements.length} SQL statements...`));
    
    let created = 0;
    let skipped = 0;
    
    for (const statement of statements) {
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.length < 10) continue;
      
      try {
        await client.query(statement);
        created++;
        
        // Extract table name from CREATE TABLE statement
        const tableMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
        if (tableMatch) {
          console.log(chalk.green(`✅ Created table: ${tableMatch[1]}`));
        }
      } catch (err) {
        if (err.message.includes('already exists')) {
          skipped++;
          const tableMatch = statement.match(/CREATE TABLE (?:IF NOT EXISTS )?(\w+)/i);
          if (tableMatch) {
            console.log(chalk.yellow(`⏭️  Table already exists: ${tableMatch[1]}`));
          }
        } else {
          console.error(chalk.red(`❌ Error: ${err.message}`));
        }
      }
    }
    
    console.log(chalk.green(`\n✅ Setup complete! Created ${created} tables, skipped ${skipped} existing tables.`));
    
    // List all fantasy-related tables
    console.log(chalk.yellow('\n📊 Fantasy ML Tables:'));
    const tablesQuery = `
      SELECT table_name, 
             (SELECT COUNT(*) FROM information_schema.columns WHERE table_name = t.table_name) as columns
      FROM information_schema.tables t
      WHERE table_schema = 'public' 
      AND (table_name LIKE '%fantasy%' OR table_name LIKE '%dfs%' OR table_name LIKE '%ml%' 
           OR table_name LIKE '%player%' OR table_name LIKE '%projection%')
      ORDER BY table_name;
    `;
    
    const result = await client.query(tablesQuery);
    result.rows.forEach(row => {
      console.log(`  - ${row.table_name} (${row.columns} columns)`);
    });
    
    console.log(chalk.green('\n✅ Database is ready for Fantasy ML!'));
    console.log(chalk.yellow('\nNext steps:'));
    console.log('1. Load sample data: npm run fantasy:load-sample');
    console.log('2. Train models: npm run fantasy:train');
    console.log('3. Start API: npm run fantasy:api');
    
  } catch (error) {
    console.error(chalk.red('❌ Setup failed:'));
    console.error(error.message);
  } finally {
    await client.end();
  }
}

// Run setup
setupDatabase().catch(console.error);
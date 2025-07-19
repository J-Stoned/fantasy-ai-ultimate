#!/usr/bin/env tsx
/**
 * Quick test to verify PostgreSQL is working on port 5434
 */

import { Client } from 'pg';
import chalk from 'chalk';

async function testConnection() {
  console.log(chalk.bold.cyan('🔍 Testing PostgreSQL Connection on Port 5434'));
  console.log(chalk.gray('='.repeat(50)));
  
  const client = new Client({
    host: 'localhost',
    port: 5434,
    database: 'fantasy_ai_local',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    console.log('Connecting to PostgreSQL...');
    await client.connect();
    console.log(chalk.green('✅ Connected successfully!'));
    
    // Test query
    const result = await client.query('SELECT version()');
    console.log(chalk.green('\n✅ PostgreSQL is working!'));
    console.log('Version:', result.rows[0].version);
    
    // Check tables
    const tables = await client.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    console.log(`\nTables in database: ${tables.rowCount}`);
    
    if (tables.rowCount === 0) {
      console.log(chalk.yellow('\n⚠️  No tables found. You need to import your schema.'));
      console.log('\nNext steps:');
      console.log('1. Export data from Supabase Dashboard');
      console.log('2. Import the schema and data');
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Connection failed:'), error.message);
    console.log('\nTroubleshooting:');
    console.log('1. Is PostgreSQL running on port 5434?');
    console.log('2. Is the password correct?');
    console.log('3. Does fantasy_ai_local database exist?');
  } finally {
    await client.end();
  }
}

testConnection().catch(console.error);
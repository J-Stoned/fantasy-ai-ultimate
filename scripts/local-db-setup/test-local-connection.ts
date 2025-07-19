#!/usr/bin/env tsx
import { Client } from 'pg';
import chalk from 'chalk';

async function test() {
  const client = new Client({
    host: 'localhost',
    port: 5432,
    database: 'fantasy_ai_local',
    user: 'postgres',
    password: 'postgres'
  });
  
  try {
    await client.connect();
    console.log(chalk.green('✅ Connected to PostgreSQL!'));
    
    const result = await client.query('SELECT version()');
    console.log(chalk.gray('Version:', result.rows[0].version));
    
    const tables = await client.query(`
      SELECT tablename, 
             (SELECT COUNT(*) FROM pg_class WHERE relname = tablename) as row_estimate
      FROM pg_tables 
      WHERE schemaname = 'public'
    `);
    
    console.log(chalk.yellow('\nTables in database:'));
    tables.rows.forEach(t => {
      console.log(`  - ${t.tablename}`);
    });
    
    console.log(chalk.green('\n✅ PostgreSQL is ready!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    await client.end();
  }
}

test();
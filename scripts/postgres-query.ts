#!/usr/bin/env tsx
/**
 * Postgres MCP Workaround
 * Direct database access since MCP isn't loading
 */

import { Client } from 'pg';
import chalk from 'chalk';

const POSTGRES_URL = 'postgresql://postgres:process.env.DB_PASSWORD || ''@db.pvekvqiqrrpugfmpgaup.supabase.co:5432/postgres';

async function query(sql: string) {
  const client = new Client(POSTGRES_URL);
  
  try {
    await client.connect();
    const result = await client.query(sql);
    console.log(chalk.green('Query successful!'));
    console.table(result.rows);
    return result.rows;
  } catch (error) {
    console.error(chalk.red('Query failed:'), error);
  } finally {
    await client.end();
  }
}

// Handle command line args
const sql = process.argv[2];
if (sql) {
  query(sql);
} else {
  console.log(chalk.yellow('Usage: npx tsx scripts/postgres-query.ts "SELECT * FROM auth.users LIMIT 5"'));
}

export { query };
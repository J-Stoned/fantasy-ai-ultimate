#!/usr/bin/env tsx
/**
 * Test both Supabase API and local PostgreSQL connections
 */

import { createClient } from '@supabase/supabase-js';
import { Client } from 'pg';
import chalk from 'chalk';
import { config } from 'dotenv';

config({ path: '.env.local' });

async function testSupabase() {
  console.log(chalk.yellow('\n1. Testing Supabase API connection...'));
  
  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
    
    const { count, error } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(chalk.red('❌ Supabase error:'), error);
      return false;
    }
    
    console.log(chalk.green('✅ Supabase connected!'));
    console.log(chalk.gray(`   Games table has ${count} rows`));
    return true;
  } catch (error) {
    console.error(chalk.red('❌ Failed:'), error.message);
    return false;
  }
}

async function testLocal(password: string) {
  console.log(chalk.yellow('\n2. Testing local PostgreSQL connection...'));
  
  const client = new Client({
    host: 'localhost',
    port: 5434,
    database: 'fantasy_ai_local',
    user: 'postgres',
    password: password
  });
  
  try {
    await client.connect();
    console.log(chalk.green('✅ Local PostgreSQL connected!'));
    
    const result = await client.query('SELECT version()');
    console.log(chalk.gray(`   Version: ${result.rows[0].version.split(',')[0]}`));
    
    const tables = await client.query(`
      SELECT COUNT(*) as count FROM pg_tables WHERE schemaname = 'public'
    `);
    console.log(chalk.gray(`   Tables in database: ${tables.rows[0].count}`));
    
    await client.end();
    return true;
  } catch (error) {
    console.error(chalk.red('❌ Failed:'), error.message);
    await client.end().catch(() => {});
    return false;
  }
}

async function main() {
  console.log(chalk.bold.cyan('🔍 Testing Database Connections'));
  console.log(chalk.gray('='.repeat(50)));
  
  const password = process.argv[2];
  if (!password) {
    console.log(chalk.red('Please provide your PostgreSQL password:'));
    console.log(chalk.yellow('Usage: npx tsx test-connections.ts [password]'));
    return;
  }
  
  const supabaseOk = await testSupabase();
  const localOk = await testLocal(password);
  
  console.log(chalk.gray('\n' + '='.repeat(50)));
  
  if (supabaseOk && localOk) {
    console.log(chalk.bold.green('✅ Both connections working!'));
    console.log(chalk.cyan('\nReady to copy data!'));
  } else {
    console.log(chalk.bold.red('❌ Connection issues detected'));
    if (!supabaseOk) {
      console.log(chalk.yellow('\nCheck your .env.local has correct Supabase keys'));
    }
    if (!localOk) {
      console.log(chalk.yellow('\nCheck your PostgreSQL password is correct'));
    }
  }
}

main().catch(console.error);
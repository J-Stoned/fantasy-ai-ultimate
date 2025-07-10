#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

console.log(chalk.cyan.bold('🔍 DATABASE DEBUG'));
console.log(chalk.cyan('==================\n'));

// Show connection info
console.log('📡 Connection Details:');
console.log(`URL: ${process.env.NEXT_PUBLIC_SUPABASE_URL}`);
console.log(`Key: ${process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.slice(0, 20)}...`);
console.log(`Service Key: ${process.env.SUPABASE_SERVICE_ROLE_KEY ? 'SET' : 'NOT SET'}\n`);

// Test with anon key
const supabaseAnon = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

// Test basic query
console.log(chalk.yellow('Testing basic query...\n'));

async function testTable(tableName: string) {
  console.log(`📊 Testing ${tableName}:`);
  
  try {
    // First try to select
    const { data, error, count } = await supabaseAnon
      .from(tableName)
      .select('*', { count: 'exact' })
      .limit(1);
    
    if (error) {
      console.log(chalk.red(`   ❌ SELECT Error: ${error.message}`));
      console.log(chalk.gray(`      Code: ${error.code}, Details: ${JSON.stringify(error.details)}`));
    } else {
      console.log(chalk.green(`   ✅ SELECT Success! Count: ${count || 0}`));
      if (data && data.length > 0) {
        console.log(chalk.gray(`      Sample: ${JSON.stringify(data[0]).slice(0, 100)}...`));
      }
    }
    
    // Try to check RLS
    const { data: rlsCheck, error: rlsError } = await supabaseAnon
      .rpc('check_rls_enabled', { table_name: tableName })
      .single();
    
    if (!rlsError && rlsCheck) {
      console.log(chalk.yellow(`   🔒 RLS Status: ${rlsCheck.enabled ? 'ENABLED' : 'DISABLED'}`));
    }
    
  } catch (e: any) {
    console.log(chalk.red(`   💥 Exception: ${e.message}`));
  }
  
  console.log('');
}

// Test key tables
const keyTables = ['players', 'teams', 'games', 'news_articles'];

async function runTests() {
  for (const table of keyTables) {
    await testTable(table);
  }
  
  // Test if we can see schema
  console.log(chalk.yellow('\n📋 Checking available functions:'));
  try {
    const { data: functions, error } = await supabaseAnon
      .rpc('get_public_functions')
      .limit(10);
      
    if (!error && functions) {
      console.log(chalk.green('Available RPC functions:'));
      functions.forEach((f: any) => console.log(`   - ${f.function_name}`));
    } else {
      console.log(chalk.gray('Could not list functions (this is normal)'));
    }
  } catch (e) {
    console.log(chalk.gray('Function listing not available'));
  }
}

// Create helper RPC
console.log(chalk.cyan('\n📝 Helpful SQL to run in Supabase:\n'));
console.log(chalk.gray(`
-- Check RLS status for all tables
SELECT schemaname, tablename, 
       CASE WHEN rlsenabled THEN 'ENABLED' ELSE 'DISABLED' END as rls_status
FROM pg_tables t
JOIN pg_class c ON c.relname = t.tablename
WHERE schemaname = 'public'
ORDER BY tablename;

-- See actual row counts
SELECT schemaname, tablename, n_live_tup as row_count
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY n_live_tup DESC;

-- Create RLS check function
CREATE OR REPLACE FUNCTION check_rls_enabled(table_name text)
RETURNS json AS $$
DECLARE
  result json;
BEGIN
  SELECT json_build_object('enabled', rlsenabled)
  INTO result
  FROM pg_class
  WHERE relname = table_name;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`));

runTests().catch(console.error);
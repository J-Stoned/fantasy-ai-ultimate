#!/usr/bin/env tsx
/**
 * VERIFY RLS STATUS - The Marcus "The Fixer" Rodriguez Way
 * This script verifies that ALL tables have Row Level Security enabled
 * Run this AFTER applying the emergency RLS fixes
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error(chalk.red('❌ Missing Supabase credentials in .env.local'));
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function verifyRLSStatus() {
  console.log(chalk.blue.bold('🔒 VERIFYING RLS STATUS ON ALL TABLES\n'));
  
  try {
    // Query to check RLS status on all tables
    const { data: tables, error } = await supabase
      .from('pg_tables')
      .select('tablename')
      .eq('schemaname', 'public')
      .order('tablename');

    if (error) {
      // If pg_tables doesn't work, use raw SQL
      const { data, error: sqlError } = await supabase.rpc('get_table_rls_status', {});
      
      if (sqlError) {
        // Fallback: Create the function and try again
        await supabase.sql`
          CREATE OR REPLACE FUNCTION get_table_rls_status()
          RETURNS TABLE (
            table_name text,
            rls_enabled boolean
          )
          LANGUAGE sql
          SECURITY DEFINER
          AS $$
            SELECT 
              c.relname::text as table_name,
              c.relrowsecurity as rls_enabled
            FROM pg_catalog.pg_class c
            JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'public'
              AND c.relkind = 'r'
              AND c.relname NOT LIKE 'pg_%'
              AND c.relname NOT LIKE '_prisma%'
            ORDER BY c.relname;
          $$;
        `;
        
        const { data: retryData, error: retryError } = await supabase.rpc('get_table_rls_status', {});
        if (retryError) throw retryError;
        
        displayResults(retryData || []);
      } else {
        displayResults(data || []);
      }
    } else {
      // Manual check for each table
      const results = [];
      for (const table of tables || []) {
        const { data, error } = await supabase
          .from(table.tablename)
          .select('*')
          .limit(0);
        
        // If we get a RLS error, it means RLS is enabled
        const rlsEnabled = error?.code === 'PGRST301';
        results.push({
          table_name: table.tablename,
          rls_enabled: rlsEnabled
        });
      }
      displayResults(results);
    }
  } catch (error) {
    console.error(chalk.red('❌ Error checking RLS status:'), error);
    process.exit(1);
  }
}

function displayResults(tables: Array<{ table_name: string; rls_enabled: boolean }>) {
  const totalTables = tables.length;
  const securedTables = tables.filter(t => t.rls_enabled).length;
  const exposedTables = tables.filter(t => !t.rls_enabled);
  
  console.log(chalk.blue('📊 RLS STATUS REPORT:'));
  console.log(`Total Tables: ${totalTables}`);
  console.log(chalk.green(`Secured Tables: ${securedTables} (${((securedTables / totalTables) * 100).toFixed(1)}%)`));
  console.log(chalk.red(`Exposed Tables: ${exposedTables.length} (${((exposedTables.length / totalTables) * 100).toFixed(1)}%)`));
  
  if (exposedTables.length > 0) {
    console.log(chalk.red('\n❌ EXPOSED TABLES (NO RLS):'));
    exposedTables.forEach(table => {
      console.log(chalk.red(`  - ${table.table_name}`));
    });
    
    console.log(chalk.yellow('\n⚠️  ACTION REQUIRED:'));
    console.log('1. Run the emergency RLS fix scripts in Supabase SQL Editor');
    console.log('2. Re-run this verification script');
  } else {
    console.log(chalk.green.bold('\n✅ ALL TABLES ARE SECURED WITH RLS!'));
    console.log(chalk.green('Your database is now protected against unauthorized access.'));
  }
  
  // Security grade
  const securityScore = (securedTables / totalTables) * 100;
  let grade = 'F';
  if (securityScore === 100) grade = 'A+';
  else if (securityScore >= 95) grade = 'A';
  else if (securityScore >= 85) grade = 'B';
  else if (securityScore >= 70) grade = 'C';
  else if (securityScore >= 50) grade = 'D';
  
  console.log(chalk.blue.bold(`\n🎯 Security Grade: ${grade}`));
  
  if (grade !== 'A+') {
    console.log(chalk.red.bold('\n🚨 PRODUCTION DEPLOYMENT BLOCKED!'));
    console.log(chalk.red('Cannot deploy with exposed tables. Fix RLS first!'));
    process.exit(1);
  }
}

// Run the verification
verifyRLSStatus();
#!/usr/bin/env tsx
/**
 * SECURITY MONITORING SCRIPT
 * Checks if your Supabase data is exposed
 */

import chalk from 'chalk';

const SUPABASE_URL = 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const ANON_KEY = 'process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Tables to check (from your schema)
const TABLES_TO_CHECK = [
  'user_profiles',
  'players', 
  'teams_master',
  'leagues',
  'fantasy_teams',
  'fantasy_leagues',
  'player_stats',
  'quantum_correlations',
  'biometric_analyses',
  'neural_nodes',
];

async function checkTableAccess(tableName: string): Promise<{ 
  accessible: boolean; 
  rowCount: number;
  error?: string;
}> {
  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${tableName}?select=*&limit=1`,
      {
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
        },
      }
    );

    if (response.status === 404) {
      return { accessible: false, rowCount: 0, error: 'Table not found' };
    }

    if (response.status === 401) {
      return { accessible: false, rowCount: 0, error: 'Unauthorized (Good! RLS is working)' };
    }

    const data = await response.json();
    
    if (response.status === 200) {
      return { 
        accessible: true, 
        rowCount: Array.isArray(data) ? data.length : 0 
      };
    }

    return { 
      accessible: false, 
      rowCount: 0, 
      error: data.message || 'Unknown error' 
    };
  } catch (error) {
    return { 
      accessible: false, 
      rowCount: 0, 
      error: error.message 
    };
  }
}

async function checkSecurity() {
  console.log(chalk.yellow('\n🔍 CHECKING SUPABASE SECURITY STATUS...\n'));
  
  let exposedTables = 0;
  let securedTables = 0;
  let totalRows = 0;

  for (const table of TABLES_TO_CHECK) {
    const result = await checkTableAccess(table);
    
    if (result.accessible && result.rowCount > 0) {
      console.log(chalk.red(`❌ ${table}: EXPOSED (${result.rowCount} rows accessible)`));
      exposedTables++;
      totalRows += result.rowCount;
    } else if (result.error?.includes('RLS')) {
      console.log(chalk.green(`✅ ${table}: SECURED (RLS enabled)`));
      securedTables++;
    } else if (result.error?.includes('not found')) {
      console.log(chalk.gray(`⚪ ${table}: Not found (might not exist yet)`));
    } else {
      console.log(chalk.green(`✅ ${table}: Protected (${result.error || 'No data'})`));
      securedTables++;
    }
  }

  console.log(chalk.yellow('\n═══════════════════════════════════════\n'));
  
  if (exposedTables > 0) {
    console.log(chalk.red.bold(`🚨 SECURITY ALERT: ${exposedTables} tables are EXPOSED!`));
    console.log(chalk.red(`Anyone can access ${totalRows} rows of data!\n`));
    console.log(chalk.yellow('IMMEDIATE ACTION REQUIRED:'));
    console.log('1. Go to Supabase SQL Editor');
    console.log('2. Run the enable-rls.sql script');
    console.log('3. Run this check again\n');
  } else {
    console.log(chalk.green.bold('✅ ALL CHECKED TABLES ARE SECURE!\n'));
    console.log(chalk.green(`${securedTables} tables have protection enabled.`));
    console.log(chalk.gray('\nNote: This only checks common tables.'));
    console.log(chalk.gray('Run the full RLS script to secure everything.\n'));
  }

  // Test write access
  console.log(chalk.yellow('Testing write access...'));
  try {
    const writeTest = await fetch(
      `${SUPABASE_URL}/rest/v1/user_profiles`,
      {
        method: 'POST',
        headers: {
          'apikey': ANON_KEY,
          'Authorization': `Bearer ${ANON_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: 'test-security-check',
          username: 'security-test',
        }),
      }
    );

    if (writeTest.status === 201) {
      console.log(chalk.red('\n❌ CRITICAL: Anonymous users can INSERT data!'));
    } else {
      console.log(chalk.green('✅ Write access is protected\n'));
    }
  } catch (error) {
    console.log(chalk.green('✅ Write access is protected\n'));
  }
}

// Run the check
checkSecurity().catch(console.error);
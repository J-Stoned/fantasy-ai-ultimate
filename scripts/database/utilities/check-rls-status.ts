#!/usr/bin/env tsx
/**
 * QUICK RLS STATUS CHECKER
 * 
 * Rapidly checks the RLS status of all tables and provides a summary
 */

import chalk from 'chalk';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 
  'process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!ANON_KEY && !SERVICE_ROLE_KEY) {
  console.error(chalk.red('ERROR: Either NEXT_PUBLIC_SUPABASE_ANON_KEY or SUPABASE_SERVICE_ROLE_KEY is required'));
  process.exit(1);
}

// Tables to check
const TABLES = [
  // User data
  'user_profiles',
  'platform_connections',
  'fantasy_leagues',
  'fantasy_teams',
  'import_history',
  
  // Public sports data
  'sports',
  'leagues',
  'teams_master',
  'players',
  'player_stats',
  'player_game_logs',
  'player_injuries',
  'player_trends',
  'matchup_history',
  
  // Financial (sensitive)
  'player_contracts',
  'nil_deals',
  
  // Content
  'news_articles',
  'social_mentions',
  'weather_conditions',
  
  // Educational
  'schools',
  'conferences',
  'recruiting_profiles',
  'combine_results',
  
  // Equipment
  'equipment_brands',
  'equipment_models',
  'player_equipment',
  
  // Platform mapping
  'player_platform_mapping',
  'sync_logs',
  
  // Revolutionary features (may not exist)
  'quantum_correlations',
  'neural_nodes',
  'biometric_analyses',
  'ar_sessions',
  'voice_interactions',
  'ai_coach_sessions',
  'agent_interactions',
  'memory_contexts',
];

interface TableStatus {
  name: string;
  exists: boolean;
  accessible: boolean;
  rlsEnabled: boolean;
  error?: string;
}

async function checkTable(tableName: string): Promise<TableStatus> {
  try {
    // Try with anon key first
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/${tableName}?select=*&limit=1`,
      {
        headers: {
          'apikey': ANON_KEY || SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${ANON_KEY || SERVICE_ROLE_KEY}`,
        },
      }
    );

    if (response.status === 404) {
      return {
        name: tableName,
        exists: false,
        accessible: false,
        rlsEnabled: false,
      };
    }

    if (response.status === 401 || response.status === 403) {
      // This is good - means RLS is working
      return {
        name: tableName,
        exists: true,
        accessible: false,
        rlsEnabled: true,
      };
    }

    if (response.status === 200) {
      const data = await response.json();
      
      // If we can access with anon key, check if it's empty or has data
      return {
        name: tableName,
        exists: true,
        accessible: true,
        rlsEnabled: false,
        error: Array.isArray(data) && data.length > 0 ? `${data.length} rows exposed!` : 'Table accessible',
      };
    }

    return {
      name: tableName,
      exists: true,
      accessible: false,
      rlsEnabled: true,
      error: `Status: ${response.status}`,
    };
  } catch (error) {
    return {
      name: tableName,
      exists: false,
      accessible: false,
      rlsEnabled: false,
      error: error.message,
    };
  }
}

async function runQuickCheck() {
  console.log(chalk.blue.bold('\n🔍 QUICK RLS STATUS CHECK\n'));
  console.log(chalk.gray(`Checking ${TABLES.length} tables...\n`));

  const results: TableStatus[] = [];
  const startTime = Date.now();

  // Check all tables in parallel for speed
  const promises = TABLES.map(table => checkTable(table));
  const statuses = await Promise.all(promises);
  results.push(...statuses);

  // Categorize results
  const existing = results.filter(r => r.exists);
  const secured = existing.filter(r => r.rlsEnabled);
  const exposed = existing.filter(r => !r.rlsEnabled && r.accessible);
  const missing = results.filter(r => !r.exists);

  // Display results
  console.log(chalk.green.bold('✅ SECURED TABLES') + chalk.gray(` (${secured.length})`));
  if (secured.length > 0) {
    secured.forEach(t => console.log(chalk.green(`   ✓ ${t.name}`)));
  } else {
    console.log(chalk.gray('   None'));
  }

  console.log(chalk.red.bold('\n❌ EXPOSED TABLES') + chalk.gray(` (${exposed.length})`));
  if (exposed.length > 0) {
    exposed.forEach(t => console.log(chalk.red(`   ✗ ${t.name} ${t.error ? `- ${t.error}` : ''}`)));
  } else {
    console.log(chalk.gray('   None'));
  }

  console.log(chalk.gray.bold('\n⚪ MISSING TABLES') + chalk.gray(` (${missing.length})`));
  if (missing.length > 0) {
    missing.forEach(t => console.log(chalk.gray(`   - ${t.name}`)));
  } else {
    console.log(chalk.gray('   None'));
  }

  // Summary
  const elapsedTime = ((Date.now() - startTime) / 1000).toFixed(2);
  
  console.log(chalk.blue.bold('\n📊 SUMMARY\n'));
  console.log(`Total tables checked: ${TABLES.length}`);
  console.log(`Existing tables: ${existing.length}`);
  console.log(`Secured tables: ${secured.length}`);
  console.log(`Exposed tables: ${exposed.length}`);
  console.log(`Check completed in: ${elapsedTime}s`);

  // Security score
  const securityScore = existing.length > 0 
    ? Math.round((secured.length / existing.length) * 100)
    : 0;

  console.log(chalk.blue.bold(`\n🛡️  SECURITY SCORE: ${securityScore}%`));

  if (securityScore === 100) {
    console.log(chalk.green.bold('\n✅ ALL TABLES ARE SECURED!'));
  } else if (exposed.length > 0) {
    console.log(chalk.red.bold(`\n🚨 CRITICAL: ${exposed.length} tables are exposed!`));
    console.log(chalk.yellow('\nACTION REQUIRED:'));
    console.log('1. Run: npm run scripts:enable-rls');
    console.log('2. Or execute enable-comprehensive-rls.sql in Supabase SQL Editor');
  }

  // Quick fix command
  if (exposed.length > 0) {
    console.log(chalk.yellow('\n🔧 QUICK FIX COMMAND:\n'));
    console.log(chalk.gray('Copy and paste this into your Supabase SQL Editor:\n'));
    
    exposed.forEach(table => {
      console.log(`ALTER TABLE public.${table.name} ENABLE ROW LEVEL SECURITY;`);
    });
  }

  process.exit(exposed.length > 0 ? 1 : 0);
}

// Run the check
runQuickCheck().catch(console.error);
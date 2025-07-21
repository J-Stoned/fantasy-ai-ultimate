#!/usr/bin/env tsx
/**
 * 🔍 Verify Fantasy ML Tables
 * Checks that all our fantasy tables were created successfully
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyTables() {
  console.log(chalk.bold.cyan('🔍 VERIFYING FANTASY ML TABLES...\n'));
  
  const tablesToCheck = [
    // Existing fantasy tables
    'dfs_salaries',
    'dfs_ownership_projections',
    'prop_bets',
    'fantasy_projections',
    'fantasy_rankings',
    'trending_players',
    'fantasy_leagues',
    'fantasy_teams',
    'fantasy_betting_insights',
    'pattern_performance',
    
    // New ML tables we just created
    'player_projections',
    'dfs_lineups',
    'fantasy_schedule_strength',
    'player_value_metrics',
    'stack_correlations'
  ];
  
  let existingCount = 0;
  let missingCount = 0;
  
  for (const table of tablesToCheck) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      if (error.message.includes('does not exist')) {
        console.log(chalk.red(`❌ ${table} - MISSING`));
        missingCount++;
      } else {
        console.log(chalk.yellow(`⚠️  ${table} - Error: ${error.message}`));
      }
    } else {
      console.log(chalk.green(`✅ ${table} - EXISTS (${count || 0} rows)`));
      existingCount++;
    }
  }
  
  console.log(chalk.bold.yellow(`\n📊 SUMMARY:`));
  console.log(chalk.green(`   ✅ Existing tables: ${existingCount}`));
  console.log(chalk.red(`   ❌ Missing tables: ${missingCount}`));
  
  if (existingCount >= 15) {
    console.log(chalk.bold.green('\n🚀 FANTASY ML DATABASE READY!'));
    console.log(chalk.cyan('You now have a complete fantasy sports ML infrastructure:'));
    console.log(chalk.cyan('  • DFS salary & ownership tracking'));
    console.log(chalk.cyan('  • Player projections with ML support'));
    console.log(chalk.cyan('  • Value metrics & leverage calculations'));
    console.log(chalk.cyan('  • Stack correlations for lineup building'));
    console.log(chalk.cyan('  • Schedule strength analysis'));
  }
}

verifyTables().catch(console.error);
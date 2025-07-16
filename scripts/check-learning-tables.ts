#!/usr/bin/env tsx
/**
 * Check if learning tables exist in database
 */

import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkTables() {
  console.log(chalk.cyan.bold('\n🔍 Checking Learning System Tables\n'));
  
  const tables = [
    'pattern_performance',
    'learning_reports',
    'pattern_multipliers',
    'historical_training_runs',
    'temporal_pattern_performance',
    'model_snapshots',
    'optimized_models',
    'fantasy_betting_insights'
  ];
  
  let allExist = true;
  
  for (const table of tables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        console.log(chalk.red(`❌ ${table} - NOT FOUND`));
        allExist = false;
      } else {
        console.log(chalk.green(`✅ ${table} - EXISTS`));
      }
    } catch (e) {
      console.log(chalk.red(`❌ ${table} - ERROR`));
      allExist = false;
    }
  }
  
  if (!allExist) {
    console.log(chalk.yellow('\n⚠️  Some tables are missing!'));
    console.log(chalk.white('\nPlease run these migrations in Supabase:'));
    console.log(chalk.gray('1. supabase/migrations/20250715_learning_tables.sql'));
    console.log(chalk.gray('2. supabase/migrations/20250715_fantasy_betting_integration.sql'));
    console.log(chalk.gray('3. supabase/migrations/20250715_historical_training_tables.sql'));
  } else {
    console.log(chalk.green('\n✅ All learning tables exist!'));
    console.log(chalk.white('\nYou can now run:'));
    console.log(chalk.cyan('npx tsx scripts/continuous-pattern-learning.ts'));
    console.log(chalk.cyan('npx tsx scripts/historical-season-replay.ts'));
  }
}

checkTables().catch(console.error);
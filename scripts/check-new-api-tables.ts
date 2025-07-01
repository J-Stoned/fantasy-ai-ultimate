#!/usr/bin/env tsx
/**
 * Check if new API tables exist in Supabase
 * Run the migration if tables are missing
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const NEW_TABLES = [
  'fantasy_rankings',
  'trending_players',
  'player_projections',
  'dfs_salaries',
  'api_usage',
  'breaking_news',
  'video_content'
];

async function checkTable(tableName: string): Promise<boolean> {
  try {
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error && error.message.includes('does not exist')) {
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

async function checkAllTables() {
  console.log(chalk.blue.bold('\n🔍 Checking New API Tables\n'));
  
  const results: Record<string, boolean> = {};
  let allExist = true;
  
  for (const table of NEW_TABLES) {
    const exists = await checkTable(table);
    results[table] = exists;
    
    if (exists) {
      console.log(chalk.green(`✅ ${table}`));
    } else {
      console.log(chalk.red(`❌ ${table} - NOT FOUND`));
      allExist = false;
    }
  }
  
  console.log('\n' + chalk.yellow('─'.repeat(40)) + '\n');
  
  if (allExist) {
    console.log(chalk.green.bold('✅ All tables exist! You\'re ready to collect data.\n'));
    
    // Check some table contents
    console.log(chalk.cyan('📊 Table Statistics:\n'));
    
    for (const table of NEW_TABLES) {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      console.log(`${table}: ${count || 0} records`);
    }
  } else {
    console.log(chalk.red.bold('❌ Some tables are missing!\n'));
    console.log(chalk.yellow('📋 To create the missing tables:\n'));
    console.log('1. Go to your Supabase dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and run the migration script:\n');
    
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20250101_add_new_api_tables.sql');
    console.log(chalk.cyan(`   ${migrationPath}\n`));
    
    // Show migration preview
    if (fs.existsSync(migrationPath)) {
      const migration = fs.readFileSync(migrationPath, 'utf8');
      const preview = migration.split('\n').slice(0, 20).join('\n');
      console.log(chalk.gray('Migration preview:'));
      console.log(chalk.gray('─'.repeat(40)));
      console.log(chalk.gray(preview + '\n...'));
      console.log(chalk.gray('─'.repeat(40)));
    }
    
    console.log(chalk.yellow('\n💡 Quick Steps:'));
    console.log('1. Copy the migration file content');
    console.log('2. Open https://app.supabase.com/project/' + process.env.NEXT_PUBLIC_SUPABASE_URL?.split('.')[0].replace('https://', ''));
    console.log('3. Go to SQL Editor → New Query');
    console.log('4. Paste and run the migration');
    console.log('5. Run this script again to verify');
  }
  
  // Check if collectors will work
  console.log(chalk.cyan('\n🔌 API Configuration Status:\n'));
  
  const apis = {
    'NFL Official': 'No key needed ✅',
    'ESPN Fantasy': 'No key needed ✅',
    'Twitter/X': process.env.TWITTER_BEARER_TOKEN && process.env.TWITTER_BEARER_TOKEN !== 'your-twitter-bearer-token' ? '✅ Configured' : '❌ Not configured',
    'SportsData.io': process.env.SPORTSDATA_IO_KEY && process.env.SPORTSDATA_IO_KEY !== 'your-sportsdata-key' ? '✅ Configured' : '❌ Not configured',
    'OpenWeather': process.env.OPENWEATHER_API_KEY ? '✅ Configured' : '❌ Not configured',
    'The Odds API': process.env.THE_ODDS_API_KEY ? '✅ Configured' : '❌ Not configured',
  };
  
  Object.entries(apis).forEach(([api, status]) => {
    console.log(`${api}: ${status}`);
  });
  
  if (allExist) {
    console.log(chalk.green.bold('\n🚀 Ready to start collecting data!'));
    console.log(chalk.cyan('\nRun: npx tsx scripts/mega-data-collector.ts'));
  }
}

// Run the check
checkAllTables().catch(console.error);
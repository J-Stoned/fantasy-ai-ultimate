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
// Fix for __dirname in ES modules - using URL constructor instead of fileURLToPath
const __filename = new URL(import.meta.url).pathname;
const __dirname = path.dirname(__filename);

dotenv.config({ path: '.env.local' });

// Validate required environment variables
function validateEnvironment(): boolean {
  const required = ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];
  const missing = required.filter(key => !process.env[key]);
  
  if (missing.length > 0) {
    console.log(chalk.red.bold('❌ Missing required environment variables:'));
    missing.forEach(key => console.log(chalk.red(`   - ${key}`)));
    console.log(chalk.yellow('\n💡 Make sure your .env.local file contains these variables'));
    return false;
  }
  
  return true;
}

// Validate and create Supabase client
function createSupabaseClient() {
  if (!validateEnvironment()) {
    process.exit(1);
  }
  
  try {
    return createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  } catch (error) {
    console.log(chalk.red.bold('❌ Failed to create Supabase client:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    process.exit(1);
  }
}

const supabase = createSupabaseClient();

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
    
    if (error) {
      if (error.message.includes('does not exist') || error.message.includes('relation') && error.message.includes('does not exist')) {
        return false;
      }
      console.log(chalk.yellow(`⚠️  Warning checking ${tableName}: ${error.message}`));
      return false;
    }
    
    return true;
  } catch (error) {
    console.log(chalk.yellow(`⚠️  Error checking ${tableName}: ${error instanceof Error ? error.message : String(error)}`));
    return false;
  }
}

function getSupabaseDashboardUrl(): string {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!url) return 'https://app.supabase.com';
    
    // Extract project ID from URL (e.g., https://abc123.supabase.co -> abc123)
    const match = url.match(/https:\/\/([^.]+)\.supabase\.co/);
    if (match && match[1]) {
      return `https://app.supabase.com/project/${match[1]}`;
    }
    
    return 'https://app.supabase.com';
  } catch (error) {
    return 'https://app.supabase.com';
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
      try {
        const { count } = await supabase
          .from(table)
          .select('*', { count: 'exact', head: true });
        
        console.log(`${table}: ${count || 0} records`);
      } catch (error) {
        console.log(`${table}: Error retrieving count`);
      }
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
      try {
        const migration = fs.readFileSync(migrationPath, 'utf8');
        const preview = migration.split('\n').slice(0, 20).join('\n');
        console.log(chalk.gray('Migration preview:'));
        console.log(chalk.gray('─'.repeat(40)));
        console.log(chalk.gray(preview + '\n...'));
        console.log(chalk.gray('─'.repeat(40)));
      } catch (error) {
        console.log(chalk.yellow('⚠️  Could not read migration file for preview'));
      }
    } else {
      console.log(chalk.red('❌ Migration file not found!'));
      console.log(chalk.yellow('Please create the migration file first or check the path.'));
    }
    
    console.log(chalk.yellow('\n💡 Quick Steps:'));
    console.log('1. Copy the migration file content');
    console.log(`2. Open ${getSupabaseDashboardUrl()}`);
    console.log('3. Go to SQL Editor → New Query');
    console.log('4. Paste and run the migration');
    console.log('5. Run this script again to verify');
  }
  
  // Check if collectors will work
  console.log(chalk.cyan('\n🔌 API Configuration Status:\n'));
  
  const apis = {
    'NFL Official': 'No key needed ✅',
    'ESPN Fantasy': 'No key needed ✅',
    'Twitter/X': (process.env.TWITTER_BEARER_TOKEN && 
                  process.env.TWITTER_BEARER_TOKEN !== 'your-twitter-bearer-token' && 
                  process.env.TWITTER_BEARER_TOKEN.length > 10) ? '✅ Configured' : '❌ Not configured',
    'SportsData.io': (process.env.SPORTSDATA_IO_KEY && 
                      process.env.SPORTSDATA_IO_KEY !== 'your-sportsdata-key' && 
                      process.env.SPORTSDATA_IO_KEY.length > 10) ? '✅ Configured' : '❌ Not configured',
    'OpenWeather': (process.env.OPENWEATHER_API_KEY && 
                    process.env.OPENWEATHER_API_KEY.length > 10) ? '✅ Configured' : '❌ Not configured',
    'The Odds API': (process.env.THE_ODDS_API_KEY && 
                     process.env.THE_ODDS_API_KEY.length > 10) ? '✅ Configured' : '❌ Not configured',
  };
  
  Object.entries(apis).forEach(([api, status]) => {
    console.log(`${api}: ${status}`);
  });
  
  if (allExist) {
    console.log(chalk.green.bold('\n🚀 Ready to start collecting data!'));
    console.log(chalk.cyan('\nRun: npx tsx scripts/mega-data-collector.ts'));
  } else {
    console.log(chalk.yellow.bold('\n⏳ Complete table setup first, then run data collection.'));
  }
}

// Run the check with proper error handling
async function main() {
  try {
    await checkAllTables();
  } catch (error) {
    console.log(chalk.red.bold('\n❌ Script failed:'));
    console.log(chalk.red(error instanceof Error ? error.message : String(error)));
    
    if (error instanceof Error && error.message.includes('auth')) {
      console.log(chalk.yellow('\n💡 This might be an authentication issue. Check your Supabase credentials.'));
    }
    
    process.exit(1);
  }
}

main();
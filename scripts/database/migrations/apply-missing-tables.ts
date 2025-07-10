#!/usr/bin/env tsx
/**
 * APPLY MISSING DATABASE TABLES
 * 
 * Creates all missing tables needed for the app to function
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function applyMigration() {
  console.log(chalk.blue.bold('\n📊 Creating Missing Database Tables...'));
  
  try {
    // Read migration file
    const migrationPath = path.join(process.cwd(), 'migrations', '20250102_create_missing_core_tables.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');
    
    console.log(chalk.yellow('🔧 Applying migration...'));
    
    // Execute migration
    const { error } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    });
    
    if (error) {
      // If RPC doesn't exist, try direct execution
      console.log(chalk.yellow('⚠️  Direct SQL execution not available via RPC'));
      console.log(chalk.blue('\n📋 Please run this SQL in your Supabase SQL editor:'));
      console.log(chalk.gray('----------------------------------------'));
      console.log(migrationSQL);
      console.log(chalk.gray('----------------------------------------'));
      
      return;
    }
    
    console.log(chalk.green('✅ Migration applied successfully!'));
    
    // Verify tables were created
    const tables = ['lineups', 'lineup_players', 'roster_players', 'matchups', 'user_actions'];
    
    console.log(chalk.blue('\n🔍 Verifying tables...'));
    
    for (const table of tables) {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(chalk.red(`❌ ${table}: Failed to query`));
      } else {
        console.log(chalk.green(`✅ ${table}: Created successfully`));
      }
    }
    
  } catch (error) {
    console.error(chalk.red('❌ Migration failed:'), error);
  }
}

// Alternative: Direct table creation via Supabase client
async function createTablesDirectly() {
  console.log(chalk.yellow('\n🔨 Creating tables via Supabase client...'));
  
  // Since we can't execute raw SQL via the client, we'll check if tables exist
  const tables = [
    { name: 'lineups', check: async () => await supabase.from('lineups').select('id').limit(1) },
    { name: 'lineup_players', check: async () => await supabase.from('lineup_players').select('id').limit(1) },
    { name: 'roster_players', check: async () => await supabase.from('roster_players').select('id').limit(1) },
    { name: 'matchups', check: async () => await supabase.from('matchups').select('id').limit(1) },
    { name: 'user_actions', check: async () => await supabase.from('user_actions').select('id').limit(1) }
  ];
  
  let missingTables = [];
  
  for (const table of tables) {
    const { error } = await table.check();
    if (error && error.code === 'PGRST200') {
      missingTables.push(table.name);
      console.log(chalk.red(`❌ ${table.name}: Missing`));
    } else {
      console.log(chalk.green(`✅ ${table.name}: Exists`));
    }
  }
  
  if (missingTables.length > 0) {
    console.log(chalk.yellow(`\n⚠️  Missing tables: ${missingTables.join(', ')}`));
    console.log(chalk.blue('Please run the migration SQL in your Supabase dashboard.'));
  } else {
    console.log(chalk.green('\n✅ All required tables exist!'));
  }
}

async function main() {
  console.log(chalk.red.bold(`
╔═══════════════════════════════════════════════╗
║        🗄️  DATABASE TABLE CREATION 🗄️         ║
╚═══════════════════════════════════════════════╝
  `));
  
  // First try migration
  await applyMigration();
  
  // Then check tables
  await createTablesDirectly();
  
  console.log(chalk.blue('\n📝 Next steps:'));
  console.log('1. If tables are missing, copy the SQL from above');
  console.log('2. Go to your Supabase dashboard > SQL Editor');
  console.log('3. Paste and run the SQL');
  console.log('4. Run this script again to verify');
}

main().catch(console.error);
#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function checkAllTables() {
  console.log(chalk.cyan.bold('🔍 COMPREHENSIVE DATABASE ANALYSIS'));
  console.log(chalk.cyan('==================================\n'));

  try {
    // Get all tables from information schema
    const { data: tables, error: tablesError } = await supabase
      .rpc('get_all_tables_info');

    if (tablesError) {
      // Fallback to manual check if RPC doesn't exist
      console.log(chalk.yellow('Using fallback table detection...\n'));
      await checkTablesManually();
      return;
    }

    // Show all tables with counts
    if (tables) {
      let totalTables = 0;
      let emptyTables = 0;
      let totalRecords = 0;

      console.log(chalk.green('📊 All Tables in Database:\n'));
      
      for (const table of tables) {
        totalTables++;
        if (table.row_count === 0) {
          emptyTables++;
          console.log(chalk.gray(`   ${table.table_name}: EMPTY`));
        } else {
          totalRecords += table.row_count;
          console.log(`   ${chalk.white(table.table_name)}: ${chalk.green.bold(table.row_count.toLocaleString())} records`);
        }
      }

      console.log(chalk.cyan('\n' + '─'.repeat(40)));
      console.log(chalk.white(`Total Tables: ${totalTables}`));
      console.log(chalk.red(`Empty Tables: ${emptyTables}`));
      console.log(chalk.green.bold(`Total Records: ${totalRecords.toLocaleString()}`));
    }
  } catch (error) {
    console.error('Error:', error);
    await checkTablesManually();
  }
}

async function checkTablesManually() {
  // All possible tables based on schema
  const allTables = [
    // Core tables
    'players', 'teams', 'teams_master', 'games', 'games_today',
    'player_stats', 'player_projections', 'player_injuries',
    
    // News and sentiment
    'news_articles', 'news', 'sentiment', 'reddit_sentiment',
    
    // League and fantasy
    'leagues', 'league_teams', 'league_rosters', 'matchups',
    'trades', 'waivers', 'fantasy_scores',
    
    // Betting and analysis
    'odds', 'betting_insights', 'weather_conditions',
    'dfs_lineups', 'dfs_contests',
    
    // User data
    'users', 'user_preferences', 'user_leagues',
    
    // System tables
    'cron_jobs', 'webhooks', 'api_logs',
    
    // ML and predictions
    'ml_predictions', 'ml_models', 'training_data',
    
    // Voice and AR
    'voice_sessions', 'ar_sessions',
    
    // Real-time
    'live_scores', 'live_updates', 'game_logs'
  ];

  console.log(chalk.green('📊 Checking All Tables:\n'));
  
  let totalRecords = 0;
  let tablesWithData = [];
  let emptyTables = [];
  let nonExistentTables = [];

  for (const table of allTables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        if (error.code === '42P01') {
          nonExistentTables.push(table);
        } else {
          console.log(chalk.red(`   ${table}: ERROR - ${error.message}`));
        }
      } else if (count === 0) {
        emptyTables.push(table);
        console.log(chalk.gray(`   ${table}: EMPTY`));
      } else {
        tablesWithData.push({ name: table, count });
        totalRecords += count;
        console.log(`   ${chalk.white(table)}: ${chalk.green.bold(count.toLocaleString())} records`);
      }
    } catch (e) {
      console.log(chalk.red(`   ${table}: FAILED`));
    }
  }

  console.log(chalk.cyan('\n' + '─'.repeat(40)));
  console.log(chalk.white(`Tables checked: ${allTables.length}`));
  console.log(chalk.green(`Tables with data: ${tablesWithData.length}`));
  console.log(chalk.yellow(`Empty tables: ${emptyTables.length}`));
  console.log(chalk.red(`Non-existent tables: ${nonExistentTables.length}`));
  console.log(chalk.green.bold(`\nTotal Records: ${totalRecords.toLocaleString()}`));

  // Show empty tables that should have data
  const criticalEmptyTables = emptyTables.filter(t => 
    ['teams_master', 'games_today', 'player_stats', 'reddit_sentiment', 'odds', 'weather_conditions'].includes(t)
  );
  
  if (criticalEmptyTables.length > 0) {
    console.log(chalk.red('\n⚠️  Critical Empty Tables:'));
    criticalEmptyTables.forEach(t => console.log(chalk.red(`   - ${t}`)));
  }

  // Check RLS status
  console.log(chalk.cyan('\n🔒 Checking RLS Status:\n'));
  await checkRLSStatus(tablesWithData.map(t => t.name).concat(emptyTables).slice(0, 10));
}

async function checkRLSStatus(tables: string[]) {
  for (const table of tables) {
    try {
      // Try to insert a test record
      const testData = { 
        id: 'test-' + Date.now(), 
        name: 'TEST',
        created_at: new Date().toISOString()
      };
      
      const { error } = await supabase
        .from(table)
        .insert([testData]);
      
      if (error) {
        if (error.message.includes('row-level security')) {
          console.log(chalk.red(`   ${table}: RLS BLOCKING INSERTS`));
        } else {
          console.log(chalk.yellow(`   ${table}: ${error.message.slice(0, 50)}...`));
        }
      } else {
        console.log(chalk.green(`   ${table}: ✅ Inserts allowed`));
        // Clean up test record
        await supabase.from(table).delete().eq('id', testData.id);
      }
    } catch (e) {
      // Table doesn't accept this format, skip
    }
  }
}

// Add RPC function creator
async function createRPCFunction() {
  console.log(chalk.yellow('\n📝 Creating RPC function for better table info...\n'));
  
  const sql = `
CREATE OR REPLACE FUNCTION get_all_tables_info()
RETURNS TABLE(
  table_name text,
  row_count bigint,
  rls_enabled boolean
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    t.tablename::text,
    COALESCE(c.n_live_tup, 0)::bigint,
    COALESCE(r.rlsenabled, false)::boolean
  FROM pg_tables t
  LEFT JOIN pg_stat_user_tables c ON t.tablename = c.relname
  LEFT JOIN pg_class r ON t.tablename = r.relname
  WHERE t.schemaname = 'public'
  ORDER BY t.tablename;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
`;

  console.log('Run this SQL in Supabase SQL Editor to enable comprehensive table info:');
  console.log(chalk.gray(sql));
}

// Main execution
checkAllTables()
  .then(() => {
    console.log(chalk.cyan('\n✨ Analysis complete!\n'));
    createRPCFunction();
  })
  .catch(console.error);
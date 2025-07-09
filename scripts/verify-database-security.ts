#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';

console.log('🔍 Verifying Database Security Status\n');

// Get Supabase credentials
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pvekvqiqrrpugfmpgaup.supabase.co';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTEwNDUwNTIsImV4cCI6MjA2NjYyMTA1Mn0.NhVUmDfHDzfch4cldZDOnd8DveAJbBYqv7zKJ6tNqi4';

// Create Supabase client
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// List of tables that should have RLS enabled
const TABLES_REQUIRING_RLS = [
  'collection_state', 'correlation_insights', 'ml_predictions', 'trending_players',
  'injuries', 'player_stats', 'player_injuries', 'games', 'teams',
  'player_game_logs', 'player_season_stats', 'social_sentiment', 'fantasy_rankings',
  'players', 'player_projections', 'dfs_salaries', 'breaking_news', 'video_content',
  'betting_odds', 'users', 'user_teams', 'user_roster', 'user_transactions',
  'user_leagues', 'league_members', 'weather_data', 'news_articles'
];

// List of views that should NOT have SECURITY DEFINER
const VIEWS_TO_CHECK = [
  'v_player_stats_simple', 'v_player_all_stats', 'vw_social_sentiment_summary',
  'vw_top_trending_players', 'vw_current_week_projections', 'vw_breaking_injuries'
];

async function checkTableAccess() {
  console.log('📊 Testing Table Access...\n');
  
  const results = {
    accessible: [],
    blocked: [],
    errors: []
  };
  
  // Test a few key tables
  const testTables = ['players', 'games', 'teams', 'player_stats'];
  
  for (const table of testTables) {
    try {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
      
      if (error) {
        if (error.message.includes('row-level security')) {
          results.blocked.push(table);
        } else {
          results.errors.push({ table, error: error.message });
        }
      } else {
        results.accessible.push(table);
      }
    } catch (err: any) {
      results.errors.push({ table, error: err.message });
    }
  }
  
  console.log(`✅ Accessible tables: ${results.accessible.join(', ') || 'None'}`);
  console.log(`🔒 RLS-protected tables: ${results.blocked.join(', ') || 'None'}`);
  if (results.errors.length > 0) {
    console.log(`❌ Errors: ${results.errors.map(e => `${e.table}: ${e.error}`).join(', ')}`);
  }
  console.log('');
  
  return results;
}

async function testViewAccess() {
  console.log('👁️  Testing View Access...\n');
  
  // Test one of the views
  try {
    const { data, error } = await supabase
      .from('vw_top_trending_players')
      .select('*')
      .limit(1);
    
    if (error) {
      console.log('❌ View access error:', error.message);
    } else {
      console.log('✅ Views are accessible');
    }
  } catch (err: any) {
    console.log('❌ View test failed:', err.message);
  }
  console.log('');
}

async function main() {
  console.log('🔐 Database Security Verification\n');
  console.log('Project:', SUPABASE_URL);
  console.log('');
  
  // Test table access
  await checkTableAccess();
  
  // Test view access
  await testViewAccess();
  
  console.log('📋 Summary:\n');
  console.log('If you see "RLS-protected tables", it means Row Level Security is blocking access.');
  console.log('This is expected for user-specific tables when not authenticated.');
  console.log('Public data tables (players, games, etc.) should be accessible.\n');
  
  console.log('🔧 To apply security fixes:');
  console.log('1. Go to Supabase SQL Editor: https://supabase.com/dashboard/project/pvekvqiqrrpugfmpgaup/sql/new');
  console.log('2. Run the migration files in order:');
  console.log('   - 20250109_enable_rls_security.sql');
  console.log('   - 20250109_fix_security_definer_views.sql');
  console.log('3. Run this script again to verify');
}

// Run the script
main().catch(console.error);
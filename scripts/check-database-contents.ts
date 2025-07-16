import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkDatabaseContents() {
  console.log('🔍 Database Contents Report\n');
  console.log('=' + '='.repeat(79));
  
  // List of all tables from the schema
  const tables = [
    'aau_teams', 'api_usage', 'betting_lines', 'betting_odds', 'breaking_news',
    'collection_state', 'combine_results', 'conferences', 'correlation_insights',
    'data_quality_metrics', 'development_programs', 'dfs_ownership_projections',
    'dfs_salaries', 'equipment_brands', 'equipment_models', 'equipment_safety_tests',
    'fantasy_betting_insights', 'fantasy_leagues', 'fantasy_projections', 'fantasy_rankings',
    'fantasy_teams', 'game_external_ids', 'game_highlights', 'game_officials', 'games',
    'high_school_leagues', 'historical_training_runs', 'import_history', 'injuries',
    'injury_equipment_correlation', 'international_competitions', 'international_rosters',
    'league_members', 'leagues', 'learning_reports', 'marketing_campaigns', 'matchup_history',
    'medical_providers', 'ml_predictions', 'mlb_players', 'mlb_stats', 'model_snapshots',
    'news_articles', 'nil_deals', 'officials', 'optimized_models', 'pattern_multipliers',
    'pattern_performance', 'platform_connections', 'player_aau_history', 'player_advanced_metrics',
    'player_contracts', 'player_development_history', 'player_equipment', 'player_game_logs',
    'player_injuries', 'player_media', 'player_medical_history', 'player_platform_mapping',
    'player_projections', 'player_season_stats', 'player_stats', 'player_synergies',
    'player_training', 'player_trends', 'players', 'prop_bets', 'recruiting_profiles',
    'schools', 'scouting_reports', 'social_media_accounts', 'social_media_posts',
    'social_mentions', 'social_sentiment', 'sponsorship_deals', 'sports', 'stat_definitions',
    'sync_logs', 'team_chemistry_metrics', 'teams', 'teams_master', 'temporal_pattern_performance',
    'training_facilities', 'trending_players', 'user_leagues', 'user_profiles', 'user_roster',
    'user_teams', 'user_transactions', 'users', 'venues', 'video_content', 'weather_conditions',
    'weather_data'
  ];

  let totalRecords = 0;
  const tableCounts: { [key: string]: number } = {};

  // Check each table
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        console.log(`❌ ${table.padEnd(30)} - Error: ${error.message}`);
      } else {
        tableCounts[table] = count || 0;
        totalRecords += count || 0;
      }
    } catch (e) {
      console.log(`❌ ${table.padEnd(30)} - Error: ${e}`);
    }
  }

  // Sort tables by record count (descending)
  const sortedTables = Object.entries(tableCounts)
    .sort(([, a], [, b]) => b - a);

  // Display tables with records
  console.log('\n📊 Tables with Data:\n');
  console.log(`${'Table Name'.padEnd(30)} | ${'Record Count'.padStart(12)}`);
  console.log('-'.repeat(45));
  
  for (const [table, count] of sortedTables) {
    if (count > 0) {
      console.log(`${table.padEnd(30)} | ${count.toString().padStart(12)}`);
    }
  }

  // Display empty tables
  console.log('\n📭 Empty Tables:\n');
  const emptyTables = sortedTables.filter(([, count]) => count === 0);
  console.log(emptyTables.map(([table]) => table).join(', '));

  // Summary statistics
  console.log('\n📈 Summary Statistics:\n');
  console.log(`Total Tables: ${tables.length}`);
  console.log(`Tables with Data: ${sortedTables.filter(([, count]) => count > 0).length}`);
  console.log(`Empty Tables: ${emptyTables.length}`);
  console.log(`Total Records: ${totalRecords.toLocaleString()}`);

  // Top 10 largest tables
  console.log('\n🏆 Top 10 Largest Tables:\n');
  console.log(`${'Rank'.padEnd(5)} | ${'Table Name'.padEnd(30)} | ${'Record Count'.padStart(12)}`);
  console.log('-'.repeat(50));
  
  sortedTables.slice(0, 10).forEach(([table, count], index) => {
    console.log(`${(index + 1).toString().padEnd(5)} | ${table.padEnd(30)} | ${count.toString().padStart(12)}`);
  });

  // Check for pattern-related data
  console.log('\n🎯 Pattern Detection Data:\n');
  const patternTables = ['pattern_performance', 'pattern_multipliers', 'temporal_pattern_performance', 'fantasy_betting_insights'];
  for (const table of patternTables) {
    const count = tableCounts[table] || 0;
    console.log(`${table.padEnd(40)} | ${count.toString().padStart(12)}`);
  }

  // Check for ML/AI data
  console.log('\n🤖 ML/AI Data:\n');
  const mlTables = ['ml_predictions', 'correlation_insights', 'player_synergies', 'team_chemistry_metrics'];
  for (const table of mlTables) {
    const count = tableCounts[table] || 0;
    console.log(`${table.padEnd(40)} | ${count.toString().padStart(12)}`);
  }

  // Check for sports data
  console.log('\n⚡ Core Sports Data:\n');
  const sportsTables = ['players', 'teams', 'games', 'player_stats', 'player_game_logs', 'player_injuries', 'weather_data'];
  for (const table of sportsTables) {
    const count = tableCounts[table] || 0;
    console.log(`${table.padEnd(40)} | ${count.toString().padStart(12)}`);
  }

  // Check games with scores
  const { count: gamesWithScores } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  console.log(`\nGames with scores: ${gamesWithScores?.toLocaleString() || 0}`);

  // Check recent data
  console.log('\n📅 Recent Activity (Last 7 Days):\n');
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
  
  const recentTables = ['player_stats', 'games', 'ml_predictions', 'weather_data', 'player_injuries'];
  for (const table of recentTables) {
    const { count } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .gte('created_at', sevenDaysAgo.toISOString());
    
    if (count && count > 0) {
      console.log(`${table.padEnd(30)} | ${count.toString().padStart(12)} new records`);
    }
  }

  console.log('\n' + '='.repeat(80));
  console.log('Report generated at:', new Date().toLocaleString());
}

checkDatabaseContents().catch(console.error);
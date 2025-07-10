#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);

async function checkEmptyTables() {
  console.log('\n🔍 CHECKING ALL TABLES FOR EMPTY DATA...\n');
  
  // List of all tables from schema
  const tables = [
    // From Prisma schema
    'user_profiles',
    'sports',
    'leagues',
    'teams_master',
    'schools',
    'players',
    'player_stats',
    'player_game_logs',
    'player_injuries',
    'equipment_brands',
    'equipment_models',
    'player_equipment',
    'player_contracts',
    'nil_deals',
    'platform_connections',
    'fantasy_leagues',
    'fantasy_teams',
    'player_platform_mapping',
    'player_trends',
    'matchup_history',
    'recruiting_profiles',
    'combine_results',
    'games',
    'venues',
    'officials',
    'betting_lines',
    'prop_bets',
    'news_articles',
    'social_mentions',
    'weather_conditions',
    'training_facilities',
    'player_training',
    'scouting_reports',
    'high_school_leagues',
    'aau_teams',
    'player_advanced_metrics',
    'fantasy_projections',
    'dfs_ownership_projections',
    'social_media_accounts',
    'import_history',
    'sync_logs',
    // Revolutionary features
    'quantum_correlations',
    'chaos_game_predictions',
    'biometric_analyses',
    'sleep_analyses',
    'neural_nodes',
    'neural_connections',
    'swarm_predictions',
    'emergent_insights',
    'conversation_sessions',
    'conversation_turns',
    'user_voice_preferences',
    'conversation_memories',
    'data_fusion_results',
    'butterfly_effects',
    'black_swan_alerts',
    'narrative_intelligence',
    'worker_jobs',
    'worker_metrics',
    'ultimate_query_results',
    // From SQL migrations
    'social_sentiment',
    'fantasy_rankings',
    'trending_players',
    'player_projections',
    'dfs_salaries',
    'api_usage',
    'breaking_news',
    'video_content',
    'weather_data',
    'betting_odds'
  ];
  
  const emptyTables: string[] = [];
  const populatedTables: { table: string; count: number }[] = [];
  const nonExistentTables: string[] = [];
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (error) {
        if (error.message.includes('does not exist')) {
          nonExistentTables.push(table);
        } else {
          console.error(`Error checking ${table}:`, error.message);
        }
      } else if (count === 0) {
        emptyTables.push(table);
      } else {
        populatedTables.push({ table, count });
      }
    } catch (err) {
      console.error(`Error with table ${table}:`, err);
    }
  }
  
  console.log('\n📊 EMPTY TABLES:');
  console.log('================');
  emptyTables.forEach(table => console.log(`  - ${table}`));
  
  console.log(`\nTotal empty tables: ${emptyTables.length}`);
  console.log(`Total populated tables: ${populatedTables.length}`);
  console.log(`Total non-existent tables: ${nonExistentTables.length}`);
  
  if (nonExistentTables.length > 0) {
    console.log('\n❌ NON-EXISTENT TABLES (defined in schema but not in database):');
    nonExistentTables.forEach(table => console.log(`  - ${table}`));
  }
  
  console.log('\n✅ POPULATED TABLES:');
  populatedTables.sort((a, b) => b.count - a.count).forEach(({ table, count }) => {
    console.log(`  - ${table}: ${count.toLocaleString()} records`);
  });
}

checkEmptyTables();
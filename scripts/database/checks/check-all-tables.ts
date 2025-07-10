#!/usr/bin/env tsx
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

async function checkAllTables() {
  console.log('🔍 Checking all tables in database...\n');
  
  const tables = [
    'players', 'teams', 'teams_master', 'games', 'games_today',
    'news_articles', 'news', 'sentiment', 'reddit_sentiment',
    'player_stats', 'player_projections', 'odds', 'weather_conditions'
  ];
  
  let totalRecords = 0;
  
  for (const table of tables) {
    try {
      const { count, error } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (!error && count !== null && count > 0) {
        console.log(`✅ ${table}: ${count.toLocaleString()}`);
        totalRecords += count;
      }
    } catch (e) {
      // Table doesn't exist or error
    }
  }
  
  console.log('\n' + '─'.repeat(40));
  console.log(`📊 TOTAL RECORDS: ${totalRecords.toLocaleString()}`);
  
  // Check if collectors are inserting
  const recentCheck = await supabase
    .from('players')
    .select('created_at')
    .order('created_at', { ascending: false })
    .limit(1);
    
  if (recentCheck.data && recentCheck.data[0]) {
    console.log(`\n⏰ Most recent player: ${recentCheck.data[0].created_at}`);
  }
}

checkAllTables().catch(console.error);
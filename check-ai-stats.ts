#!/usr/bin/env tsx

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkAIStats() {
  console.log('🔍 CHECKING AI-ENHANCED DATABASE STATS...\n');
  
  // Check AI-collected stats
  const { data: aiStats } = await supabase
    .from('player_game_logs')
    .select('id, sport, metadata')
    .not('metadata->ai_analysis_id', 'is', null);
  
  console.log(`🤖 AI-COLLECTED STATS: ${aiStats?.length || 0}`);
  
  // Check total stats  
  const { count: totalStats } = await supabase
    .from('player_game_logs') 
    .select('id', { count: 'exact', head: true });
    
  console.log(`📊 TOTAL PLAYER STATS: ${totalStats || 0}`);
  
  // Check recent stats by creation time
  const { data: recentStats } = await supabase
    .from('player_game_logs')
    .select('id, sport, created_at, metadata')
    .order('created_at', { ascending: false })
    .limit(10);
    
  console.log(`\n🕒 RECENT STATS (last 10):`);
  recentStats?.forEach((stat, i) => {
    const aiAnalyzed = stat.metadata?.ai_analysis_id ? '🤖' : '📊';
    console.log(`  ${i+1}. ${aiAnalyzed} ${stat.sport} - ${stat.created_at?.substring(0, 19)}`);
  });
  
  // Check by sport
  const { data: sportStats } = await supabase.rpc('get_stats_by_sport');
  
  if (sportStats) {
    console.log(`\n📈 STATS BY SPORT:`);
    sportStats.forEach((sport: any) => {
      console.log(`  ${sport.sport}: ${sport.count} stats`);
    });
  }
  
  console.log('\n✅ Database check complete!');
}

checkAIStats().catch(console.error);
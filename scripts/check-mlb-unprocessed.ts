#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

async function checkUnprocessed() {
  // Get all MLB games
  const { data: allGames, count } = await supabase
    .from('games')
    .select('id, external_id', { count: 'exact' })
    .eq('sport', 'MLB')
    .eq('status', 'final');
    
  console.log(`Total MLB games: ${count}`);
  
  // Get games with stats
  const { data: withStats } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(50000);
    
  const processedIds = new Set(withStats?.map(s => s.game_id) || []);
  console.log(`Games with stats: ${processedIds.size}`);
  
  // Find unprocessed
  const unprocessed = allGames?.filter(g => !processedIds.has(g.id)) || [];
  console.log(`Unprocessed games: ${unprocessed.length}`);
  
  // Coverage
  const coverage = count ? (processedIds.size / count * 100).toFixed(1) : 0;
  console.log(`Coverage: ${coverage}%`);
  
  if (unprocessed.length > 0) {
    console.log('\nSample unprocessed games:');
    unprocessed.slice(0, 10).forEach(g => {
      console.log(`- Game ${g.id} (MLB: ${g.external_id})`);
    });
    
    console.log('\n✅ We have', unprocessed.length, 'games to process for REAL data!');
  } else {
    console.log('\n🎉 All MLB games have been processed!');
  }
}

checkUnprocessed().catch(console.error);
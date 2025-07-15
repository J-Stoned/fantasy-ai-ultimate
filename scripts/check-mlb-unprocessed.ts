#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA0NTA1MiwiZXhwIjoyMDY2NjIxMDUyfQ.EzHZ-WJkjbCXEAVP750VEp38ge35nsjVQ_ajzXadbPE'
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
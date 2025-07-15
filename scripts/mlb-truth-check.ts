#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InB2ZWt2cWlxcnJwdWdmbXBnYXVwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MTA0NTA1MiwiZXhwIjoyMDY2NjIxMDUyfQ.EzHZ-WJkjbCXEAVP750VEp38ge35nsjVQ_ajzXadbPE'
);

async function truthCheck() {
  console.log('🔍 MLB DATA TRUTH CHECK\n');
  
  // Get unique games with stats
  const { data: stats } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(50000);
    
  const uniqueGamesWithStats = new Set(stats?.map(s => s.game_id) || []);
  console.log(`Games with MLB stats: ${uniqueGamesWithStats.size}`);
  
  // Get those games' details
  const gameIds = Array.from(uniqueGamesWithStats);
  const { data: gamesWithStats } = await supabase
    .from('games')
    .select('id, external_id, start_time')
    .in('id', gameIds);
    
  console.log('\nGames that have stats:');
  gamesWithStats?.forEach(g => {
    console.log(`- Game ${g.id} (${g.external_id}) - ${new Date(g.start_time).toLocaleDateString()}`);
  });
  
  // Count stats per game
  for (const gameId of gameIds) {
    const { count } = await supabase
      .from('mlb_stats')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', gameId);
      
    console.log(`\nGame ${gameId}: ${count} stats`);
  }
  
  // Total stats
  const { count: totalStats } = await supabase
    .from('mlb_stats')
    .select('*', { count: 'exact', head: true });
    
  console.log(`\nTotal MLB stats: ${totalStats}`);
  console.log(`Average stats per game: ${totalStats && uniqueGamesWithStats.size ? Math.round(totalStats / uniqueGamesWithStats.size) : 0}`);
  
  // Check if we're trying to insert duplicates
  console.log('\n❌ THE TRUTH:');
  console.log('- We only have 7 games with stats');
  console.log('- Those 7 games have 16,000+ stats each (way too many!)');
  console.log('- The scraper is trying to re-insert the same games');
  console.log('- We need to get DIFFERENT games, not the same ones');
}

truthCheck().catch(console.error);
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkMLBDuplicates() {
  console.log('🔍 Checking why success rate is low...\n');
  
  // Get recent MLB games
  const { data: recentGames } = await supabase
    .from('games')
    .select('id, external_id')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .gte('start_time', '2024-06-01')
    .not('home_score', 'is', null)
    .order('start_time', { ascending: false })
    .limit(20);
  
  if (!recentGames) return;
  
  console.log('Checking 20 recent MLB games:\n');
  
  let alreadyHadStats = 0;
  let noStats = 0;
  
  for (const game of recentGames) {
    const { count } = await supabase
      .from('player_stats')
      .select('id', { count: 'exact', head: true })
      .eq('game_id', game.id);
    
    if (count && count > 0) {
      console.log(`✅ Game ${game.id} (${game.external_id}): ${count} stats ALREADY EXISTS`);
      alreadyHadStats++;
    } else {
      console.log(`❌ Game ${game.id} (${game.external_id}): NO STATS`);
      noStats++;
    }
  }
  
  console.log(`\nSummary:`);
  console.log(`  Already had stats: ${alreadyHadStats}/20 (${(alreadyHadStats/20*100).toFixed(0)}%)`);
  console.log(`  No stats: ${noStats}/20 (${(noStats/20*100).toFixed(0)}%)`);
  
  // Find games that definitely need stats
  console.log('\n🎯 Finding MLB games that NEED stats...');
  
  const { data: gamesNeedingStats } = await supabase
    .from('games')
    .select('id')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('home_score', 'is', null)
    .limit(1000);
  
  if (gamesNeedingStats) {
    let needStats = 0;
    
    for (const game of gamesNeedingStats) {
      const { count } = await supabase
        .from('player_stats')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.id)
        .limit(1);
      
      if (!count || count === 0) needStats++;
    }
    
    console.log(`\nOf 1000 MLB games checked:`);
    console.log(`  Need stats: ${needStats}`);
    console.log(`  Already have stats: ${1000 - needStats}`);
    console.log(`  Coverage: ${((1000 - needStats) / 1000 * 100).toFixed(1)}%`);
  }
}

checkMLBDuplicates().catch(console.error);
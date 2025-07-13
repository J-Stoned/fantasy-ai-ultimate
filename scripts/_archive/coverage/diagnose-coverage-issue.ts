import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnoseCoverageIssue() {
  console.log('🔍 DIAGNOSING COVERAGE CALCULATION ISSUE\n');
  
  // 1. Check total MLB games
  const { count: totalMLBGames } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('home_score', 'is', null);
  
  console.log(`Total MLB games with scores: ${totalMLBGames}`);
  
  // 2. Get ALL MLB game IDs
  const allGameIds: number[] = [];
  let offset = 0;
  const chunkSize = 1000;
  
  while (true) {
    const { data: games } = await supabase
      .from('games')
      .select('id')
      .or('sport.eq.MLB,sport_id.eq.mlb')
      .not('home_score', 'is', null)
      .range(offset, offset + chunkSize - 1);
    
    if (!games || games.length === 0) break;
    allGameIds.push(...games.map(g => g.id));
    offset += chunkSize;
  }
  
  console.log(`Retrieved ${allGameIds.length} game IDs`);
  
  // 3. Check how many have stats in batches
  let gamesWithStats = 0;
  const batchSize = 100;
  
  for (let i = 0; i < allGameIds.length; i += batchSize) {
    const batch = allGameIds.slice(i, i + batchSize);
    
    const { data: stats } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', batch);
    
    const uniqueGames = new Set(stats?.map(s => s.game_id) || []);
    gamesWithStats += uniqueGames.size;
    
    if ((i + batchSize) % 1000 === 0) {
      console.log(`Checked ${i + batchSize}/${allGameIds.length} games...`);
    }
  }
  
  const actualCoverage = (gamesWithStats / allGameIds.length * 100).toFixed(1);
  
  console.log('\n📊 ACTUAL MLB COVERAGE:');
  console.log(`   Games with stats: ${gamesWithStats}/${allGameIds.length}`);
  console.log(`   Coverage: ${actualCoverage}%`);
  console.log(`   Games still needed for 95%: ${Math.max(0, Math.ceil(allGameIds.length * 0.95) - gamesWithStats)}`);
  
  // 4. Sample some games to see what's happening
  console.log('\n🔍 SAMPLE GAME ANALYSIS:');
  const { data: sampleGames } = await supabase
    .from('games')
    .select('id, external_id')
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('home_score', 'is', null)
    .limit(10);
  
  if (sampleGames) {
    for (const game of sampleGames) {
      const { count } = await supabase
        .from('player_stats')
        .select('id', { count: 'exact', head: true })
        .eq('game_id', game.id);
      
      console.log(`   Game ${game.id} (${game.external_id}): ${count || 0} stats`);
    }
  }
  
  // 5. Check for any data issues
  console.log('\n🔍 CHECKING FOR DATA ISSUES:');
  
  // Games with invalid external_ids
  const { count: invalidExtIds } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .or('sport.eq.MLB,sport_id.eq.mlb')
    .not('home_score', 'is', null)
    .or('external_id.is.null,external_id.eq.');
  
  console.log(`   Games with invalid external_id: ${invalidExtIds}`);
  
  // Check total stats
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });
  
  console.log(`   Total stats in database: ${totalStats?.toLocaleString()}`);
}

diagnoseCoverageIssue().catch(console.error);
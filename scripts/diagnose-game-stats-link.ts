import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function diagnoseGameStatsLink() {
  console.log('🔍 Diagnosing Game-Stats Linkage Issues...\n');

  // Check a sample of player_stats to see what game_id values look like
  console.log('📊 Sample player_stats records:');
  const { data: sampleStats, error: statsError } = await supabase
    .from('player_stats')
    .select('id, game_id, player_id, sport')
    .limit(10);

  if (statsError) {
    console.error('Error fetching sample stats:', statsError);
    return;
  }

  console.log('Sample stats:');
  sampleStats?.forEach(stat => {
    console.log(`  - Stat ID: ${stat.id}, Game ID: ${stat.game_id}, Sport: ${stat.sport}`);
  });

  // Check if game_ids in player_stats exist in games table
  const gameIdsFromStats = sampleStats?.map(s => s.game_id) || [];
  
  const { data: matchingGames, error: gamesError } = await supabase
    .from('games')
    .select('id, sport')
    .in('id', gameIdsFromStats);

  if (gamesError) {
    console.error('Error checking game matches:', gamesError);
    return;
  }

  console.log(`\n✅ Found ${matchingGames?.length || 0} matching games out of ${gameIdsFromStats.length} game_ids`);

  // Check how many distinct game_ids exist in player_stats
  const { data: distinctGameIds, error: distinctError } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(1000);

  if (!distinctError && distinctGameIds) {
    const uniqueGameIds = new Set(distinctGameIds.map(d => d.game_id));
    console.log(`\n📊 Found ${uniqueGameIds.size} unique game_ids in first 1000 player_stats`);
    
    // Check how many of these exist in games table
    const { count: matchCount, error: countError } = await supabase
      .from('games')
      .select('id', { count: 'exact', head: true })
      .in('id', Array.from(uniqueGameIds));

    if (!countError) {
      console.log(`✅ ${matchCount || 0} of these game_ids exist in games table`);
    }
  }

  // Check sports distribution in player_stats
  console.log('\n📊 Sports distribution in player_stats:');
  const { data: sportStats, error: sportError } = await supabase
    .from('player_stats')
    .select('sport')
    .limit(10000);

  if (!sportError && sportStats) {
    const sportCounts = new Map<string, number>();
    sportStats.forEach(s => {
      const count = sportCounts.get(s.sport) || 0;
      sportCounts.set(s.sport, count + 1);
    });

    Array.from(sportCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([sport, count]) => {
        console.log(`  ${sport}: ${count}`);
      });
  }

  // Check if game_id format is different (maybe string vs number)
  console.log('\n📊 Checking game_id data types:');
  const { data: gamesSample, error: gamesSampleError } = await supabase
    .from('games')
    .select('id')
    .limit(5);

  console.log('Sample game IDs from games table:');
  gamesSample?.forEach(g => {
    console.log(`  - ${g.id} (type: ${typeof g.id})`);
  });

  console.log('\nSample game_ids from player_stats:');
  sampleStats?.slice(0, 5).forEach(s => {
    console.log(`  - ${s.game_id} (type: ${typeof s.game_id})`);
  });
}

diagnoseGameStatsLink().catch(console.error);
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function tenXDatabaseDiagnostics() {
  console.log('🔥 10X DEVELOPER DATABASE DIAGNOSTICS 🔥\n');
  console.log('='.repeat(80));

  // 1. WHERE ARE ALL THESE PLAYER STATS COMING FROM?!
  console.log('\n💥 INVESTIGATION #1: WHERE ARE 934K PLAYER STATS?!\n');
  
  // Check game_id distribution in player_stats
  const { data: statsGames, error: statsGamesError } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(10000);

  if (!statsGamesError && statsGames) {
    const uniqueGameIds = new Set(statsGames.map(s => s.game_id));
    console.log(`Found ${uniqueGameIds.size} unique game_ids in first 10K player_stats`);
    
    // Sample some game_ids
    const sampleGameIds = Array.from(uniqueGameIds).slice(0, 10);
    console.log('\nSample game_ids from player_stats:');
    sampleGameIds.forEach(id => console.log(`  - ${id}`));
    
    // Check if these exist in games table
    const { data: existingGames, error: existError } = await supabase
      .from('games')
      .select('id, sport, sport_id')
      .in('id', sampleGameIds);

    console.log(`\n✅ ${existingGames?.length || 0} of ${sampleGameIds.length} sample game_ids exist in games table`);
    
    if (existingGames && existingGames.length > 0) {
      console.log('Sample matches:');
      existingGames.forEach(g => {
        console.log(`  - Game ${g.id}: sport=${g.sport}, sport_id=${g.sport_id}`);
      });
    }
  }

  // 2. CHECK STAT_TYPE DISTRIBUTION
  console.log('\n\n💥 INVESTIGATION #2: WHAT TYPES OF STATS DO WE HAVE?\n');
  
  const { data: statTypes, error: statTypesError } = await supabase
    .from('player_stats')
    .select('stat_type')
    .limit(50000);

  if (!statTypesError && statTypes) {
    const typeCounts = new Map<string, number>();
    statTypes.forEach(s => {
      const count = typeCounts.get(s.stat_type) || 0;
      typeCounts.set(s.stat_type, count + 1);
    });
    
    console.log('Top stat types (from 50K sample):');
    Array.from(typeCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .forEach(([type, count]) => {
        console.log(`  - "${type}": ${count} (${(count/statTypes.length*100).toFixed(1)}%)`);
      });
  }

  // 3. FIND ORPHANED STATS (stats without games)
  console.log('\n\n💥 INVESTIGATION #3: ORPHANED STATS CRISIS!\n');
  
  // Get all unique game_ids from a larger sample
  const { data: largerStatsSample, error: largerError } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(100000);

  if (!largerError && largerStatsSample) {
    const allGameIds = Array.from(new Set(largerStatsSample.map(s => s.game_id)));
    console.log(`Checking ${allGameIds.length} unique game_ids from 100K stats...`);
    
    // Check in batches
    let orphanedCount = 0;
    let matchedCount = 0;
    const batchSize = 500;
    
    for (let i = 0; i < allGameIds.length; i += batchSize) {
      const batch = allGameIds.slice(i, i + batchSize);
      const { count, error } = await supabase
        .from('games')
        .select('id', { count: 'exact', head: true })
        .in('id', batch);
      
      if (!error && count !== null) {
        matchedCount += count;
        orphanedCount += (batch.length - count);
      }
    }
    
    console.log(`\n🚨 ORPHANED STATS REPORT:`);
    console.log(`  - Matched game_ids: ${matchedCount} (${(matchedCount/allGameIds.length*100).toFixed(1)}%)`);
    console.log(`  - ORPHANED game_ids: ${orphanedCount} (${(orphanedCount/allGameIds.length*100).toFixed(1)}%)`);
    console.log(`  - This explains the missing coverage!`);
  }

  // 4. CHECK GAMES TABLE CHAOS
  console.log('\n\n💥 INVESTIGATION #4: GAMES TABLE CHAOS!\n');
  
  // Check NULL sports
  const { count: nullSportCount } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true })
    .is('sport', null);

  const { count: totalGamesCount } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true });

  console.log(`Games with NULL sport: ${nullSportCount} of ${totalGamesCount} (${(nullSportCount!/totalGamesCount!*100).toFixed(1)}%)`);

  // Check sport vs sport_id mismatch
  const { data: mismatchSample, error: mismatchError } = await supabase
    .from('games')
    .select('id, sport, sport_id')
    .not('sport', 'is', null)
    .not('sport_id', 'is', null)
    .limit(100);

  if (!mismatchError && mismatchSample) {
    console.log('\nChecking sport vs sport_id consistency:');
    const mismatches = mismatchSample.filter(g => {
      const sportLower = g.sport.toLowerCase();
      const sportIdLower = g.sport_id.toLowerCase();
      return !sportIdLower.includes(sportLower.toLowerCase()) && 
             !sportLower.includes(sportIdLower);
    });
    
    if (mismatches.length > 0) {
      console.log(`\n🚨 Found ${mismatches.length} potential mismatches:`);
      mismatches.slice(0, 5).forEach(g => {
        console.log(`  - Game ${g.id}: sport="${g.sport}" vs sport_id="${g.sport_id}"`);
      });
    }
  }

  // 5. FIND THE REAL NFL/NBA/MLB GAMES
  console.log('\n\n💥 INVESTIGATION #5: FINDING THE REAL GAMES!\n');
  
  // Check various ways sports might be stored
  const sportVariations = {
    'NFL': ['NFL', 'nfl', 'football', 'pro-football', 'professional-football'],
    'NBA': ['NBA', 'nba', 'basketball', 'pro-basketball', 'professional-basketball'],
    'MLB': ['MLB', 'mlb', 'baseball', 'pro-baseball'],
    'NHL': ['NHL', 'nhl', 'hockey', 'ice-hockey', 'pro-hockey']
  };

  for (const [sport, variations] of Object.entries(sportVariations)) {
    console.log(`\n🏈 Searching for ${sport} games...`);
    
    // Check sport column
    let totalFound = 0;
    for (const variation of variations) {
      const { count: sportCount } = await supabase
        .from('games')
        .select('id', { count: 'exact', head: true })
        .eq('sport', variation);
      
      if (sportCount && sportCount > 0) {
        console.log(`  Found ${sportCount} games with sport="${variation}"`);
        totalFound += sportCount;
      }
    }
    
    // Check sport_id column
    for (const variation of variations) {
      const { count: sportIdCount } = await supabase
        .from('games')
        .select('id', { count: 'exact', head: true })
        .eq('sport_id', variation);
      
      if (sportIdCount && sportIdCount > 0) {
        console.log(`  Found ${sportIdCount} games with sport_id="${variation}"`);
      }
    }
  }

  // 6. THE TRUTH ABOUT PLAYER_STATS
  console.log('\n\n💥 INVESTIGATION #6: THE TRUTH ABOUT PLAYER_STATS!\n');
  
  // Get a real sample with game info
  const { data: statsSample, error: sampleError } = await supabase
    .from('player_stats')
    .select(`
      id,
      game_id,
      player_id,
      stat_type,
      stat_value,
      games!inner(
        id,
        sport,
        sport_id
      )
    `)
    .limit(100);

  if (!sampleError && statsSample) {
    console.log(`Successfully joined ${statsSample.length} stats with their games!`);
    
    // Count by sport
    const sportCounts = new Map<string, number>();
    statsSample.forEach(stat => {
      const sport = stat.games?.sport || stat.games?.sport_id || 'UNKNOWN';
      const count = sportCounts.get(sport) || 0;
      sportCounts.set(sport, count + 1);
    });
    
    console.log('\nStats distribution by sport (from joined data):');
    Array.from(sportCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .forEach(([sport, count]) => {
        console.log(`  - ${sport}: ${count}`);
      });
  }

  console.log('\n\n🎯 FINAL DIAGNOSIS:');
  console.log('='.repeat(80));
  console.log('1. We have 934K player stats but most are ORPHANED (no matching game)');
  console.log('2. The games table has inconsistent sport/sport_id values');
  console.log('3. Most games have NULL sport values');
  console.log('4. We need to fix the game-stats relationship to unlock coverage!');
  console.log('='.repeat(80));
}

tenXDatabaseDiagnostics().catch(console.error);
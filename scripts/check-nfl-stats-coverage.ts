import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNFLStatsCoverage() {
  console.log('🏈 Checking NFL Player Stats Coverage...\n');

  try {
    // 1. First get all NFL games
    const { data: nflGames, error: nflGamesError } = await supabase
      .from('games')
      .select('id, sport_id')
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null);

    if (nflGamesError) {
      console.error('Error fetching NFL games:', nflGamesError);
      return;
    }

    const nflGameIds = nflGames?.map(g => g.id) || [];
    console.log(`🏈 Found ${nflGameIds.length} completed NFL games`);

    // 2. Count distinct NFL game_ids in player_stats table
    const { data: statsGames, error: statsError } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', nflGameIds)
      .order('game_id');

    if (statsError) {
      console.error('Error fetching player_stats:', statsError);
      return;
    }

    const uniqueGameIds = new Set(statsGames?.map(s => s.game_id) || []);
    const gamesWithStats = uniqueGameIds.size;
    const totalStatsRecords = statsGames?.length || 0;

    console.log(`\n📊 Player Stats Table (NFL):`);
    console.log(`   - Total NFL stats records: ${totalStatsRecords.toLocaleString()}`);
    console.log(`   - Unique games with stats: ${gamesWithStats.toLocaleString()}`);

    // 2. Count total NFL games in games table
    const totalGamesCount = nflGameIds.length;


    console.log(`\n🏟️  Games Table (NFL):`);
    console.log(`   - Total NFL games: ${totalGamesCount?.toLocaleString() || 0}`);

    // 3. Calculate coverage percentage
    if (totalGamesCount && totalGamesCount > 0) {
      const coverage = (gamesWithStats / totalGamesCount) * 100;
      console.log(`\n📈 Coverage Analysis:`);
      console.log(`   - Coverage: ${coverage.toFixed(2)}% (${gamesWithStats}/${totalGamesCount})`);
      console.log(`   - Missing coverage: ${(totalGamesCount - gamesWithStats).toLocaleString()} games`);
    }

    // 4. Check if V3 collector data exists (138,905 expected records)
    console.log(`\n🔍 V3 Collector Verification:`);
    console.log(`   - Expected records from V3 collector: 138,905`);
    console.log(`   - Actual NFL stats records: ${totalStatsRecords.toLocaleString()}`);
    
    if (totalStatsRecords >= 138905) {
      console.log(`   ✅ V3 collector data appears to be loaded!`);
    } else {
      console.log(`   ❌ V3 collector data may not be fully loaded`);
      console.log(`   - Missing records: ${(138905 - totalStatsRecords).toLocaleString()}`);
    }

    // 5. Sample some stats to see the data
    const { data: sampleStats, error: sampleError } = await supabase
      .from('player_stats')
      .select('*')
      .in('game_id', nflGameIds.slice(0, 100)) // Sample from first 100 NFL games
      .limit(5);

    if (sampleStats && sampleStats.length > 0) {
      console.log(`\n📋 Sample NFL Stats:`);
      sampleStats.forEach((stat, idx) => {
        console.log(`   ${idx + 1}. Game: ${stat.game_id}, Player: ${stat.player_id}, Team: ${stat.team_id}`);
      });
    }

    // 6. Check date range of stats
    const { data: dateRange, error: dateError } = await supabase
      .from('player_stats')
      .select('created_at, game_id')
      .in('game_id', nflGameIds)
      .order('created_at', { ascending: true })
      .limit(1);

    const { data: latestDate, error: latestError } = await supabase
      .from('player_stats')
      .select('created_at, game_id')
      .in('game_id', nflGameIds)
      .order('created_at', { ascending: false })
      .limit(1);

    if (dateRange && latestDate) {
      console.log(`\n📅 Data Date Range:`);
      console.log(`   - Earliest: ${new Date(dateRange[0].created_at).toLocaleDateString()}`);
      console.log(`   - Latest: ${new Date(latestDate[0].created_at).toLocaleDateString()}`);
    }

  } catch (error) {
    console.error('Error checking NFL stats coverage:', error);
  }

  process.exit(0);
}

checkNFLStatsCoverage();
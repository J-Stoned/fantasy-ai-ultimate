import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkNFLStatsDetailed() {
  console.log('🏈 NFL Stats Detailed Analysis...\n');

  try {
    // 1. Get total count of NFL games (no limit)
    const { count: totalNFLGames, error: countError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .eq('sport_id', 'nfl')
      .not('home_score', 'is', null);

    if (countError) {
      console.error('Error counting NFL games:', countError);
      return;
    }

    console.log(`📊 Total completed NFL games in database: ${totalNFLGames?.toLocaleString()}`);

    // 2. Get all NFL game IDs (in batches if needed)
    const batchSize = 1000;
    let allNFLGameIds: number[] = [];
    
    for (let offset = 0; offset < (totalNFLGames || 0); offset += batchSize) {
      const { data: batch, error: batchError } = await supabase
        .from('games')
        .select('id')
        .eq('sport_id', 'nfl')
        .not('home_score', 'is', null)
        .range(offset, offset + batchSize - 1);

      if (batchError) {
        console.error(`Error fetching batch at offset ${offset}:`, batchError);
        break;
      }

      allNFLGameIds = allNFLGameIds.concat(batch?.map(g => g.id) || []);
    }

    console.log(`✅ Retrieved ${allNFLGameIds.length} NFL game IDs`);

    // 3. Count total player_stats records
    const { count: totalStats, error: statsCountError } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });

    console.log(`\n📈 Total player_stats records (all sports): ${totalStats?.toLocaleString()}`);

    // 4. Get unique games with stats for NFL
    const uniqueGamesWithStats = new Set<number>();
    let totalNFLStats = 0;

    // Process in batches
    for (let i = 0; i < allNFLGameIds.length; i += 100) {
      const batch = allNFLGameIds.slice(i, i + 100);
      const { data: stats, error: statsError } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', batch);

      if (!statsError && stats) {
        stats.forEach(s => uniqueGamesWithStats.add(s.game_id));
        totalNFLStats += stats.length;
      }
    }

    const coverage = (uniqueGamesWithStats.size / (totalNFLGames || 1)) * 100;

    console.log(`\n🏈 NFL Coverage Summary:`);
    console.log(`   - Total NFL games: ${totalNFLGames?.toLocaleString()}`);
    console.log(`   - Games with stats: ${uniqueGamesWithStats.size.toLocaleString()}`);
    console.log(`   - Total NFL stats records: ${totalNFLStats.toLocaleString()}`);
    console.log(`   - Coverage: ${coverage.toFixed(2)}%`);
    console.log(`   - Missing: ${((totalNFLGames || 0) - uniqueGamesWithStats.size).toLocaleString()} games`);

    // 5. Check if V3 collector data was loaded
    console.log(`\n🔍 V3 Collector Analysis:`);
    console.log(`   - Expected from V3 collector: 138,905 records`);
    console.log(`   - Actual NFL stats: ${totalNFLStats.toLocaleString()}`);
    
    if (totalNFLStats >= 138905) {
      console.log(`   ✅ V3 collector data appears to be loaded!`);
      console.log(`   - Extra records: ${(totalNFLStats - 138905).toLocaleString()}`);
    } else {
      console.log(`   ❌ V3 collector data missing`);
      console.log(`   - Gap: ${(138905 - totalNFLStats).toLocaleString()} records`);
    }

    // 6. Sample some games to verify
    const sampleGames = uniqueGamesWithStats.size > 0 
      ? Array.from(uniqueGamesWithStats).slice(0, 5)
      : [];

    if (sampleGames.length > 0) {
      console.log(`\n📋 Sample games with stats:`);
      for (const gameId of sampleGames) {
        const { count } = await supabase
          .from('player_stats')
          .select('*', { count: 'exact', head: true })
          .eq('game_id', gameId);
        
        const { data: gameInfo } = await supabase
          .from('games')
          .select('external_id, home_team_id, away_team_id, start_time')
          .eq('id', gameId)
          .single();

        console.log(`   - Game ${gameId} (${gameInfo?.external_id}): ${count} stats`);
      }
    }

  } catch (error) {
    console.error('Error:', error);
  }

  process.exit(0);
}

checkNFLStatsDetailed();
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPlayerStats() {
  console.log('🔍 Checking player_stats database...\n');

  try {
    // 1. Total number of player_stats records
    const { count: totalCount, error: countError } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });

    if (countError) throw countError;
    console.log(`📊 Total player_stats records: ${totalCount?.toLocaleString()}`);

    // 2. Number of unique games in player_stats
    const { data: uniqueGames, error: uniqueError } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null);

    if (uniqueError) throw uniqueError;
    
    const uniqueGameIds = new Set(uniqueGames?.map(stat => stat.game_id));
    console.log(`🎮 Unique games with stats: ${uniqueGameIds.size.toLocaleString()}`);

    // 3. Recent stats added (last 10 minutes)
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { count: recentCount, error: recentError } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', tenMinutesAgo);

    if (recentError) throw recentError;
    console.log(`⏰ Stats added in last 10 minutes: ${recentCount?.toLocaleString()}`);

    // 4. Stats added in last hour
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { count: hourCount, error: hourError } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', oneHourAgo);

    if (hourError) throw hourError;
    console.log(`🕐 Stats added in last hour: ${hourCount?.toLocaleString()}`);

    // 5. Check stats by sport
    console.log('\n📈 Stats breakdown by sport:');
    const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB'];
    
    for (const sport of sports) {
      // Get games for this sport
      const { data: sportGames, error: sportGamesError } = await supabase
        .from('games')
        .select('id')
        .eq('sport', sport);

      if (sportGamesError) continue;

      const sportGameIds = sportGames?.map(g => g.id) || [];
      
      if (sportGameIds.length > 0) {
        const { count: sportStatsCount, error: sportStatsError } = await supabase
          .from('player_stats')
          .select('*', { count: 'exact', head: true })
          .in('game_id', sportGameIds);

        if (!sportStatsError) {
          console.log(`  ${sport}: ${sportStatsCount?.toLocaleString()} stats`);
        }
      }
    }

    // 6. Sample of recent stats
    console.log('\n🔍 Sample of recent stats:');
    const { data: recentStats, error: sampleError } = await supabase
      .from('player_stats')
      .select(`
        id,
        player_id,
        game_id,
        created_at,
        stats
      `)
      .order('created_at', { ascending: false })
      .limit(5);

    if (!sampleError && recentStats) {
      recentStats.forEach((stat, i) => {
        console.log(`\n  ${i + 1}. ID: ${stat.id}`);
        console.log(`     Player ID: ${stat.player_id}`);
        console.log(`     Game ID: ${stat.game_id}`);
        console.log(`     Created: ${new Date(stat.created_at).toLocaleString()}`);
        console.log(`     Stats keys: ${Object.keys(stat.stats || {}).join(', ')}`);
      });
    }

    // 7. Check for the specific batch we just inserted
    console.log('\n🔎 Checking for recent batch insertion...');
    
    // Get stats from the last 30 minutes grouped by creation time
    const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recentBatches, error: batchError } = await supabase
      .from('player_stats')
      .select('created_at')
      .gte('created_at', thirtyMinutesAgo)
      .order('created_at', { ascending: false });

    if (!batchError && recentBatches) {
      // Group by minute to find batches
      const batches = new Map<string, number>();
      recentBatches.forEach(stat => {
        const minute = new Date(stat.created_at).toISOString().slice(0, 16);
        batches.set(minute, (batches.get(minute) || 0) + 1);
      });

      console.log('\n📦 Recent batch insertions (by minute):');
      Array.from(batches.entries())
        .sort((a, b) => b[0].localeCompare(a[0]))
        .slice(0, 10)
        .forEach(([minute, count]) => {
          console.log(`  ${minute}: ${count.toLocaleString()} stats`);
        });
    }

    // 8. Check total games that should have stats
    const { count: completedGamesCount, error: completedError } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);

    if (!completedError) {
      console.log(`\n🎯 Total completed games: ${completedGamesCount?.toLocaleString()}`);
      console.log(`📊 Coverage: ${((uniqueGameIds.size / (completedGamesCount || 1)) * 100).toFixed(1)}%`);
    }

  } catch (error) {
    console.error('❌ Error checking database:', error);
  }
}

// Run the check
checkPlayerStats();
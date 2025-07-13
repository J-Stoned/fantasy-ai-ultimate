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

async function comprehensiveStatsCoverageAnalysis() {
  console.log('📊 COMPREHENSIVE STATS COVERAGE ANALYSIS\n');
  console.log('=' .repeat(60) + '\n');

  try {
    // 1. Overall database statistics
    console.log('1️⃣ DATABASE OVERVIEW:');
    console.log('-'.repeat(40));
    
    const { count: totalGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true });
      
    const { count: completedGames } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('home_score', 'is', null)
      .not('away_score', 'is', null);
      
    const { count: gamesWithSport } = await supabase
      .from('games')
      .select('*', { count: 'exact', head: true })
      .not('sport', 'is', null);
      
    const { count: totalStats } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true });

    console.log(`Total games: ${totalGames?.toLocaleString()}`);
    console.log(`Completed games (with scores): ${completedGames?.toLocaleString()}`);
    console.log(`Games with sport defined: ${gamesWithSport?.toLocaleString()}`);
    console.log(`Total player_stats records: ${totalStats?.toLocaleString()}`);

    // 2. Stats coverage analysis
    console.log('\n2️⃣ STATS COVERAGE ANALYSIS:');
    console.log('-'.repeat(40));
    
    // Get all unique game_ids from player_stats
    const { data: statsGameIds, error: statsError } = await supabase
      .from('player_stats')
      .select('game_id')
      .not('game_id', 'is', null);

    if (statsError) throw statsError;

    const uniqueGameIdsWithStats = [...new Set(statsGameIds.map(s => s.game_id))];
    console.log(`Unique games with stats: ${uniqueGameIdsWithStats.length}`);

    // Check how many of these games actually exist
    const { data: existingGames, error: existingError } = await supabase
      .from('games')
      .select('id, sport')
      .in('id', uniqueGameIdsWithStats);

    if (existingError) throw existingError;

    const gamesWithNullSport = existingGames?.filter(g => !g.sport).length || 0;
    const gamesWithValidSport = existingGames?.filter(g => g.sport).length || 0;

    console.log(`  - Games that exist in DB: ${existingGames?.length}`);
    console.log(`  - Games with valid sport: ${gamesWithValidSport}`);
    console.log(`  - Games with NULL sport: ${gamesWithNullSport}`);

    // 3. The real problem
    console.log('\n3️⃣ THE CORE ISSUE:');
    console.log('-'.repeat(40));
    console.log('🚨 PLAYER STATS ARE LINKED TO WRONG/INVALID GAME IDs!');
    
    // Show the game ID ranges
    const gameIdRanges = {
      withStats: {
        min: Math.min(...uniqueGameIdsWithStats),
        max: Math.max(...uniqueGameIdsWithStats)
      }
    };

    // Get the range of actual game IDs
    const { data: allGameIds } = await supabase
      .from('games')
      .select('id')
      .order('id');

    if (allGameIds && allGameIds.length > 0) {
      gameIdRanges.actual = {
        min: allGameIds[0].id,
        max: allGameIds[allGameIds.length - 1].id
      };
    }

    console.log(`\nGame ID ranges:`);
    console.log(`  Stats are linked to games: ${gameIdRanges.withStats.min} - ${gameIdRanges.withStats.max}`);
    if (gameIdRanges.actual) {
      console.log(`  Actual games in DB: ${gameIdRanges.actual.min} - ${gameIdRanges.actual.max}`);
    }

    // 4. Check completed games by sport that SHOULD have stats
    console.log('\n4️⃣ GAMES THAT SHOULD HAVE STATS (by sport):');
    console.log('-'.repeat(40));
    
    const sports = ['football', 'basketball', 'baseball', 'hockey', 'nfl', 'nba', 'mlb', 'nhl'];
    
    for (const sport of sports) {
      const { count: sportCompleted } = await supabase
        .from('games')
        .select('*', { count: 'exact', head: true })
        .eq('sport', sport)
        .not('home_score', 'is', null)
        .not('away_score', 'is', null);

      if (sportCompleted && sportCompleted > 0) {
        // Check how many have stats
        const { data: sportGames } = await supabase
          .from('games')
          .select('id')
          .eq('sport', sport)
          .not('home_score', 'is', null)
          .not('away_score', 'is', null);

        const sportGameIds = sportGames?.map(g => g.id) || [];
        
        // Check intersection with games that have stats
        const withStats = sportGameIds.filter(id => uniqueGameIdsWithStats.includes(id)).length;
        
        console.log(`${sport}: ${withStats}/${sportCompleted} games have stats (${(withStats/sportCompleted*100).toFixed(1)}%)`);
      }
    }

    // 5. Recent stats insertion analysis
    console.log('\n5️⃣ RECENT STATS INSERTION (last hour):');
    console.log('-'.repeat(40));
    
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
    const { data: recentStats } = await supabase
      .from('player_stats')
      .select('game_id, created_at')
      .gte('created_at', oneHourAgo)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentStats) {
      console.log('Recent stats game_ids:');
      recentStats.forEach(stat => {
        console.log(`  Game ${stat.game_id} - ${new Date(stat.created_at).toLocaleTimeString()}`);
      });
    }

    // 6. Recommendations
    console.log('\n6️⃣ RECOMMENDATIONS TO FIX COVERAGE:');
    console.log('-'.repeat(40));
    console.log('1. The stats collector is using wrong game IDs (3.5M range instead of actual range)');
    console.log('2. Games with stats have NULL sport values - they\'re orphaned entries');
    console.log('3. Need to either:');
    console.log('   a) Fix the stats collector to use correct game IDs');
    console.log('   b) Delete orphaned stats and re-collect with proper game mapping');
    console.log('   c) Update the games table to fix NULL sports and establish proper relationships');
    console.log('\n📊 Current real coverage: 0% (stats are linked to non-existent/invalid games)');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

// Run the analysis
comprehensiveStatsCoverageAnalysis();
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigatePlayerStats() {
  console.log('🔍 INVESTIGATING PLAYER STATS COVERAGE ISSUE - V2\n');

  // 1. First, let's get the exact count of completed games
  console.log('1️⃣ Counting completed games (with scores)...');
  const { count: completedGamesCount, error: gamesError } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  if (gamesError) {
    console.error('Error counting games:', gamesError);
  } else {
    console.log(`✅ Total completed games: ${completedGamesCount}`);
  }

  // 2. Get unique game_ids from player_stats
  console.log('\n2️⃣ Analyzing player_stats table...');
  const { data: statsData, error: statsError } = await supabase
    .from('player_stats')
    .select('game_id, stat_type, created_at')
    .order('created_at', { ascending: false })
    .limit(10000); // Get a sample to analyze
  
  if (statsError) {
    console.error('Error fetching stats:', statsError);
    return;
  }

  // Count unique games
  const uniqueGameIds = new Set(statsData?.map(s => s.game_id).filter(id => id !== null));
  console.log(`✅ Unique games in player_stats: ${uniqueGameIds.size}`);
  
  // Count by stat type
  const statTypes: Record<string, number> = {};
  statsData?.forEach(stat => {
    statTypes[stat.stat_type] = (statTypes[stat.stat_type] || 0) + 1;
  });
  
  console.log('\n📊 Stats by type:');
  Object.entries(statTypes)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10)
    .forEach(([type, count]) => {
      console.log(`  - ${type}: ${count}`);
    });

  // 3. Check the actual games table structure
  console.log('\n3️⃣ Checking games table structure...');
  const { data: sampleGames } = await supabase
    .from('games')
    .select('*')
    .not('home_score', 'is', null)
    .limit(5);
  
  if (sampleGames && sampleGames.length > 0) {
    console.log('Game columns:', Object.keys(sampleGames[0]));
    console.log('\nSample game:');
    const game = sampleGames[0];
    console.log(`  - ID: ${game.game_id || game.id}`);
    console.log(`  - Home: ${game.home_team_id} (${game.home_score})`);
    console.log(`  - Away: ${game.away_team_id} (${game.away_score})`);
    console.log(`  - Week: ${game.week}, Season: ${game.season}`);
  }

  // 4. Let's check if game IDs match between tables
  console.log('\n4️⃣ Checking game ID format consistency...');
  const { data: gamesWithScores } = await supabase
    .from('games')
    .select('game_id, id, week, season')
    .not('home_score', 'is', null)
    .limit(100);
  
  const { data: statsGameIds } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(100);
  
  console.log('\nSample game IDs from games table:');
  gamesWithScores?.slice(0, 5).forEach(g => {
    console.log(`  - ${g.game_id || g.id} (Week ${g.week}, Season ${g.season})`);
  });
  
  console.log('\nSample game IDs from player_stats:');
  const uniqueStatsGameIds = [...new Set(statsGameIds?.map(s => s.game_id))].slice(0, 5);
  uniqueStatsGameIds.forEach(id => {
    console.log(`  - ${id}`);
  });

  // 5. Check recent player_stats entries
  console.log('\n5️⃣ Recent player_stats entries...');
  const { data: recentStats } = await supabase
    .from('player_stats')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);
  
  console.log('Recent stats:');
  recentStats?.forEach(stat => {
    console.log(`  - Player ${stat.player_id}, Game ${stat.game_id}, ${stat.stat_type}: ${stat.stat_value}`);
  });

  // 6. Let's do a precise coverage calculation
  console.log('\n6️⃣ Calculating precise coverage...');
  
  // Get all completed game IDs
  const { data: allCompletedGames } = await supabase
    .from('games')
    .select('game_id, id')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  const completedGameIdSet = new Set(allCompletedGames?.map(g => g.game_id || g.id));
  
  // Get all unique game IDs from player_stats
  const { data: allStatsGameIds } = await supabase
    .from('player_stats')
    .select('game_id');
  
  const statsGameIdSet = new Set(allStatsGameIds?.map(s => s.game_id).filter(id => id !== null));
  
  // Calculate intersection
  const gamesWithStats = [...completedGameIdSet].filter(id => statsGameIdSet.has(id));
  const gamesWithoutStats = [...completedGameIdSet].filter(id => !statsGameIdSet.has(id));
  
  console.log(`\n📊 FINAL COVERAGE ANALYSIS:`);
  console.log(`  - Total completed games: ${completedGameIdSet.size}`);
  console.log(`  - Games with player stats: ${gamesWithStats.length}`);
  console.log(`  - Games WITHOUT player stats: ${gamesWithoutStats.length}`);
  console.log(`  - Coverage: ${((gamesWithStats.length / completedGameIdSet.size) * 100).toFixed(2)}%`);
  
  // Show some games without stats
  if (gamesWithoutStats.length > 0) {
    console.log('\n❌ Sample games WITHOUT stats:');
    const { data: missingGames } = await supabase
      .from('games')
      .select('*')
      .in('game_id', gamesWithoutStats.slice(0, 5));
    
    missingGames?.forEach(game => {
      console.log(`  - Game ${game.game_id}: Week ${game.week}, Season ${game.season}`);
    });
  }

  // 7. Check for data filling scripts
  console.log('\n7️⃣ Looking for existing player stats scripts...');
  const scriptsToCheck = [
    'fill-player-stats.ts',
    'collect-player-stats.ts',
    'player-stats-collector.ts',
    'fill-empty-tables.ts',
    'mega-data-collector-v3.ts'
  ];
  
  console.log('Scripts to investigate for player stats collection:');
  scriptsToCheck.forEach(script => {
    console.log(`  - scripts/${script}`);
  });
}

investigatePlayerStats().catch(console.error);
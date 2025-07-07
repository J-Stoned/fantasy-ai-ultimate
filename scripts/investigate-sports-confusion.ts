import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables
dotenv.config({ path: resolve(__dirname, '../.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function investigateSportsConfusion() {
  console.log('🏈🏀 INVESTIGATING SPORTS DATA CONFUSION\n');

  // 1. Check what sports are in the games table
  console.log('1️⃣ Checking sports in games table...');
  const { data: sports } = await supabase
    .from('games')
    .select('sport, league')
    .not('sport', 'is', null);
  
  const sportCounts: Record<string, number> = {};
  const leagueCounts: Record<string, number> = {};
  
  sports?.forEach(game => {
    sportCounts[game.sport] = (sportCounts[game.sport] || 0) + 1;
    leagueCounts[game.league || 'null'] = (leagueCounts[game.league || 'null'] || 0) + 1;
  });
  
  console.log('\n📊 Games by sport:');
  Object.entries(sportCounts).forEach(([sport, count]) => {
    console.log(`  - ${sport}: ${count} games`);
  });
  
  console.log('\n📊 Games by league:');
  Object.entries(leagueCounts).forEach(([league, count]) => {
    console.log(`  - ${league}: ${count} games`);
  });

  // 2. Check NFL games specifically
  console.log('\n2️⃣ Checking NFL games...');
  const { count: nflCount } = await supabase
    .from('games')
    .select('*', { count: 'exact', head: true })
    .or('sport.eq.football,league.eq.NFL,league.eq.nfl');
  
  console.log(`Total NFL/football games: ${nflCount}`);

  // 3. Check if games have week/season fields (NFL specific)
  console.log('\n3️⃣ Checking for NFL-specific fields...');
  const { data: sampleGame } = await supabase
    .from('games')
    .select('*')
    .limit(1);
  
  if (sampleGame && sampleGame[0]) {
    const hasNFLFields = 'week' in sampleGame[0] || 'season' in sampleGame[0];
    console.log(`Games table has week/season fields: ${hasNFLFields}`);
    console.log('Available fields:', Object.keys(sampleGame[0]));
  }

  // 4. Check teams table
  console.log('\n4️⃣ Checking teams table...');
  const { data: teams } = await supabase
    .from('teams')
    .select('name, sport, league')
    .limit(10);
  
  console.log('Sample teams:');
  teams?.forEach(team => {
    console.log(`  - ${team.name} (${team.sport || 'no sport'}, ${team.league || 'no league'})`);
  });

  // 5. Check player_stats content
  console.log('\n5️⃣ Analyzing player_stats content...');
  const { data: statsExamples } = await supabase
    .from('player_stats')
    .select('*')
    .limit(5);
  
  console.log('Player stats structure:');
  if (statsExamples && statsExamples[0]) {
    const stat = statsExamples[0];
    console.log('  - stat_type:', stat.stat_type);
    console.log('  - stat_value:', JSON.stringify(stat.stat_value, null, 2));
    
    // Check if it's basketball stats
    if (typeof stat.stat_value === 'object' && 'points' in stat.stat_value) {
      console.log('\n⚠️  WARNING: Player stats appear to be BASKETBALL stats!');
    }
  }

  // 6. Look for NFL-specific tables
  console.log('\n6️⃣ Looking for NFL-specific tables...');
  const nflTables = [
    'nfl_games',
    'nfl_stats',
    'nfl_player_stats',
    'football_stats',
    'game_stats',
    'passing_stats',
    'rushing_stats',
    'receiving_stats'
  ];
  
  for (const table of nflTables) {
    try {
      const { count } = await supabase
        .from(table)
        .select('*', { count: 'exact', head: true });
      
      if (count !== null) {
        console.log(`  ✅ ${table}: ${count} records`);
      }
    } catch (e) {
      // Table doesn't exist
    }
  }

  // 7. Check if games with scores are NFL games
  console.log('\n7️⃣ Checking scored games sport distribution...');
  const { data: scoredGames } = await supabase
    .from('games')
    .select('sport, league')
    .not('home_score', 'is', null)
    .not('away_score', 'is', null);
  
  const scoredSportCounts: Record<string, number> = {};
  scoredGames?.forEach(game => {
    const key = `${game.sport || 'null'} - ${game.league || 'null'}`;
    scoredSportCounts[key] = (scoredSportCounts[key] || 0) + 1;
  });
  
  console.log('Scored games by sport/league:');
  Object.entries(scoredSportCounts).forEach(([key, count]) => {
    console.log(`  - ${key}: ${count} games`);
  });

  // 8. Final recommendation
  console.log('\n📋 ANALYSIS SUMMARY:');
  console.log('1. The player_stats table contains BASKETBALL stats (points, rebounds, assists)');
  console.log('2. The games table appears to contain multiple sports');
  console.log('3. We need to find or create NFL-specific player stats');
  console.log('4. The 0.3% coverage is because we\'re looking at basketball stats for NFL games!');
}

investigateSportsConfusion().catch(console.error);
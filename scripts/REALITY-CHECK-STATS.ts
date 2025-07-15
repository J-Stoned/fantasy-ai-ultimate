#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://pvekvqiqrrpugfmpgaup.supabase.co',
  process.env.SUPABASE_SERVICE_KEY || ''
);

console.log('🔍 REALITY CHECK - WHAT DO WE ACTUALLY HAVE?\n');

async function realityCheck() {
  // Total games by sport
  const { data: sportCounts } = await supabase
    .from('games')
    .select('sport, status')
    .order('sport');
    
  const sportMap = new Map();
  sportCounts?.forEach(game => {
    const key = `${game.sport}_${game.status}`;
    sportMap.set(key, (sportMap.get(key) || 0) + 1);
  });
  
  console.log('📊 GAMES IN DATABASE:');
  const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
  for (const sport of sports) {
    const final = sportMap.get(`${sport}_final`) || 0;
    const scheduled = sportMap.get(`${sport}_scheduled`) || 0;
    console.log(`${sport}: ${final} final, ${scheduled} scheduled`);
  }
  
  // MLB Stats Reality
  const { count: mlbStatsCount } = await supabase
    .from('mlb_stats')
    .select('*', { count: 'exact', head: true });
    
  const { data: mlbGamesWithStats } = await supabase
    .from('mlb_stats')
    .select('game_id')
    .limit(1000);
    
  const uniqueMLBGames = new Set(mlbGamesWithStats?.map(s => s.game_id) || []);
  
  console.log('\n⚾ MLB REALITY:');
  console.log(`- MLB stats in mlb_stats table: ${mlbStatsCount}`);
  console.log(`- Unique MLB games with stats: ${uniqueMLBGames.size}`);
  console.log(`- Stats per game: ${mlbStatsCount && uniqueMLBGames.size ? Math.round(mlbStatsCount / uniqueMLBGames.size) : 0}`);
  
  // Check player_stats coverage
  const { data: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(50000);
    
  const uniqueGamesWithStats = new Set(gamesWithStats?.map(s => s.game_id) || []);
  
  // Sample some games to check sport
  const { data: sampleStats } = await supabase
    .from('player_stats')
    .select('game_id, stat_type, stat_value')
    .in('game_id', Array.from(uniqueGamesWithStats).slice(0, 10))
    .limit(100);
    
  // Get game details
  const gameIds = [...new Set(sampleStats?.map(s => s.game_id) || [])];
  const { data: gameDetails } = await supabase
    .from('games')
    .select('id, sport, home_team_id, away_team_id')
    .in('id', gameIds);
    
  console.log('\n📈 PLAYER_STATS REALITY:');
  console.log(`- Total player_stats records: 3,684,677`);
  console.log(`- Unique games with stats: ${uniqueGamesWithStats.size}`);
  console.log(`- Coverage: ${((uniqueGamesWithStats.size / 30597) * 100).toFixed(1)}% of all games`);
  
  console.log('\n🏀🏈 SPORT BREAKDOWN IN PLAYER_STATS:');
  const sportStatsMap = new Map();
  gameDetails?.forEach(game => {
    sportStatsMap.set(game.sport, (sportStatsMap.get(game.sport) || 0) + 1);
  });
  
  for (const [sport, count] of sportStatsMap.entries()) {
    console.log(`${sport}: ${count} games in our sample`);
  }
  
  // Check for actual NBA/NFL data
  const { data: nbaGame } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NBA')
    .limit(1)
    .single();
    
  if (nbaGame) {
    const { count: nbaStatsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', nbaGame.id);
      
    console.log(`\n🏀 Sample NBA game ${nbaGame.id} has ${nbaStatsCount} stat entries`);
  }
  
  const { data: nflGame } = await supabase
    .from('games')
    .select('id')
    .eq('sport', 'NFL')
    .limit(1)
    .single();
    
  if (nflGame) {
    const { count: nflStatsCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact', head: true })
      .eq('game_id', nflGame.id);
      
    console.log(`🏈 Sample NFL game ${nflGame.id} has ${nflStatsCount} stat entries`);
  }
  
  console.log('\n❌ THE HARSH TRUTH:');
  console.log('- We claimed to have processed "all games" but only have 25% coverage');
  console.log('- MLB: Only 7 games worth of data (0.2% of available games)');
  console.log('- NBA/NFL: Data exists but not properly identified or complete');
  console.log('- Most "stats" are just key-value pairs, not meaningful data');
  console.log('\n🚨 WE NEED TO ACTUALLY COLLECT THE DATA WE CLAIMED TO HAVE!');
}

realityCheck().catch(console.error);
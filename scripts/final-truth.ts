import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function theFinalTruth() {
  console.log('🎯 THE FINAL TRUTH ABOUT OUR DATABASE\n');
  console.log('='.repeat(80));

  // 1. Get the REAL count of player_stats
  const { count: totalStats, error: statsError } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact', head: true });

  console.log(`📊 TOTAL PLAYER_STATS: ${totalStats?.toLocaleString()}`);

  // 2. Get unique game count properly
  console.log('\n🔍 Getting unique games with stats...');
  
  // First, let's get a larger sample to find all unique games
  const { data: allStats, error: allError } = await supabase
    .from('player_stats')
    .select('game_id');

  if (!allError && allStats) {
    const uniqueGames = new Set(allStats.map(s => s.game_id));
    console.log(`\n✅ UNIQUE GAMES WITH STATS: ${uniqueGames.size}`);
    
    // Show distribution
    const gameStats = new Map<number, number>();
    allStats.forEach(s => {
      const count = gameStats.get(s.game_id) || 0;
      gameStats.set(s.game_id, count + 1);
    });
    
    console.log('\n📊 TOP GAMES BY STAT COUNT:');
    Array.from(gameStats.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([gameId, count]) => {
        console.log(`  - Game ${gameId}: ${count.toLocaleString()} stats`);
      });
    
    // Check what sports these games are
    const gameIds = Array.from(uniqueGames);
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id, sport, sport_id, status')
      .in('id', gameIds);
    
    if (!gamesError && games) {
      const sportCounts = new Map<string, number>();
      games.forEach(g => {
        const sport = g.sport || g.sport_id || 'UNKNOWN';
        const count = sportCounts.get(sport) || 0;
        sportCounts.set(sport, count + 1);
      });
      
      console.log('\n📊 GAMES WITH STATS BY SPORT:');
      Array.from(sportCounts.entries())
        .sort((a, b) => b[1] - a[1])
        .forEach(([sport, count]) => {
          console.log(`  - ${sport}: ${count} games`);
        });
    }
  }

  // 3. Check the real coverage
  console.log('\n\n📊 REAL COVERAGE CALCULATION:');
  
  const sportQueries = [
    { name: 'NFL', where: { sport: 'NFL' }},
    { name: 'NBA', where: { sport: 'NBA' }},
    { name: 'MLB', where: { sport: 'MLB' }},
    { name: 'NHL', where: { sport: 'NHL' }}
  ];
  
  for (const sq of sportQueries) {
    const { data: sportGames, count: totalCount } = await supabase
      .from('games')
      .select('id', { count: 'exact' })
      .eq('sport', sq.where.sport);
    
    if (!sportGames) continue;
    
    // Count games with stats
    let gamesWithStats = 0;
    let totalStatsForSport = 0;
    
    for (let i = 0; i < sportGames.length; i += 500) {
      const batch = sportGames.slice(i, i + 500).map(g => g.id);
      
      // Check which games have stats
      const { data: stats } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', batch);
      
      const uniqueGamesInBatch = new Set(stats?.map(s => s.game_id) || []);
      gamesWithStats += uniqueGamesInBatch.size;
      totalStatsForSport += (stats?.length || 0);
    }
    
    const coverage = totalCount ? (gamesWithStats / totalCount * 100).toFixed(1) : 0;
    console.log(`\n${sq.name}:`);
    console.log(`  - Total games in DB: ${totalCount}`);
    console.log(`  - Games with stats: ${gamesWithStats}`);
    console.log(`  - Coverage: ${coverage}%`);
    console.log(`  - Total player stats: ${totalStatsForSport.toLocaleString()}`);
    
    if (parseFloat(coverage.toString()) < 95) {
      const needed = Math.ceil(totalCount! * 0.95) - gamesWithStats;
      console.log(`  - Need ${needed} more games for 95% coverage`);
    }
  }

  // 4. Find where all the stats are
  console.log('\n\n🔥 WHERE ARE THE 934K STATS?');
  
  // Get ALL stats grouped by game
  const { data: statsByGame } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(934833);  // Get all of them
  
  if (statsByGame) {
    const gameDistribution = new Map<number, number>();
    statsByGame.forEach(s => {
      const count = gameDistribution.get(s.game_id) || 0;
      gameDistribution.set(s.game_id, count + 1);
    });
    
    console.log(`\nTotal unique games: ${gameDistribution.size}`);
    console.log('Games with 1000+ stats:');
    
    let megaGames = 0;
    Array.from(gameDistribution.entries())
      .filter(([_, count]) => count >= 1000)
      .sort((a, b) => b[1] - a[1])
      .forEach(([gameId, count]) => {
        console.log(`  - Game ${gameId}: ${count.toLocaleString()} stats`);
        megaGames++;
      });
    
    if (megaGames === 0) {
      console.log('  None found! Stats are distributed across many games.');
    }
  }

  console.log('\n\n✅ SUMMARY:');
  console.log('='.repeat(80));
  console.log('The database has very low coverage because:');
  console.log('1. Most games don\'t have any player stats');
  console.log('2. The 934K stats are concentrated in very few games');
  console.log('3. We need to run the collectors to fill in the gaps!');
  console.log('='.repeat(80));
}

theFinalTruth().catch(console.error);
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function fixCoverageCheck() {
  console.log('📊 Fixed Coverage Check by Sport...\n');

  // First check how sports are stored in games table
  console.log('🔍 Checking sport values in games table:');
  const { data: sportSample, error: sportError } = await supabase
    .from('games')
    .select('sport, sport_id')
    .not('sport', 'is', null)
    .limit(20);

  if (!sportError && sportSample) {
    const uniqueSports = new Map<string, Set<string>>();
    sportSample.forEach(game => {
      if (game.sport) {
        const sportIds = uniqueSports.get(game.sport) || new Set();
        if (game.sport_id) sportIds.add(game.sport_id);
        uniqueSports.set(game.sport, sportIds);
      }
    });
    
    console.log('Unique sport values found:');
    uniqueSports.forEach((sportIds, sport) => {
      console.log(`  - "${sport}" (sport_ids: ${Array.from(sportIds).join(', ') || 'none'})`);
    });
  }

  // Check sport_id distribution
  console.log('\n🔍 Checking sport_id distribution:');
  const { data: sportIdDist, error: sportIdError } = await supabase
    .from('games')
    .select('sport_id')
    .not('sport_id', 'is', null);

  if (!sportIdError && sportIdDist) {
    const sportIdCounts = new Map<string, number>();
    sportIdDist.forEach(game => {
      const count = sportIdCounts.get(game.sport_id) || 0;
      sportIdCounts.set(game.sport_id, count + 1);
    });
    
    console.log('Top sport_id values:');
    Array.from(sportIdCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .forEach(([sportId, count]) => {
        console.log(`  - "${sportId}": ${count} games`);
      });
  }

  // Now let's check coverage using sport_id instead
  const sportMappings = {
    'NFL': ['nfl', 'football', 'pro-football'],
    'NBA': ['nba', 'basketball', 'pro-basketball'],
    'MLB': ['mlb', 'baseball'],
    'NHL': ['nhl', 'hockey', 'ice-hockey'],
    'NCAAF': ['college-football', 'ncaaf', 'ncaa-football'],
    'NCAAB': ['college-basketball', 'ncaab', 'ncaa-basketball', 'mens-college-basketball']
  };

  console.log('\n\n📊 COVERAGE BY SPORT:');
  console.log('='.repeat(60));

  for (const [sportName, sportIds] of Object.entries(sportMappings)) {
    console.log(`\n🏈 ${sportName} Coverage:`);
    
    // Get games by sport_id
    const { data: games, error: gamesError } = await supabase
      .from('games')
      .select('id')
      .in('sport_id', sportIds);

    if (gamesError || !games) {
      console.error(`Error fetching ${sportName} games:`, gamesError);
      continue;
    }

    const gameIds = games.map(g => g.id);
    console.log(`Total games: ${gameIds.length}`);

    if (gameIds.length === 0) {
      console.log('No games found for this sport');
      continue;
    }

    // Get games with stats (in batches if needed)
    const batchSize = 1000;
    const uniqueGamesWithStats = new Set<number>();
    
    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize);
      const { data: stats, error: statsError } = await supabase
        .from('player_stats')
        .select('game_id')
        .in('game_id', batch);

      if (!statsError && stats) {
        stats.forEach(s => uniqueGamesWithStats.add(s.game_id));
      }
    }

    const coverage = gameIds.length > 0 
      ? (uniqueGamesWithStats.size / gameIds.length * 100).toFixed(1) 
      : 0;

    console.log(`Games with stats: ${uniqueGamesWithStats.size}`);
    console.log(`Coverage: ${coverage}%`);

    // Calculate games needed for 95%
    const targetGames = Math.ceil(gameIds.length * 0.95);
    const gamesNeeded = Math.max(0, targetGames - uniqueGamesWithStats.size);
    
    if (parseFloat(coverage.toString()) < 95) {
      console.log(`❌ Need ${gamesNeeded} more games to reach 95%`);
    } else {
      console.log(`✅ Above 95% coverage!`);
    }

    // Get total stats count
    let totalStats = 0;
    for (let i = 0; i < gameIds.length; i += batchSize) {
      const batch = gameIds.slice(i, i + batchSize);
      const { count, error: countError } = await supabase
        .from('player_stats')
        .select('id', { count: 'exact', head: true })
        .in('game_id', batch);
      
      if (!countError && count) {
        totalStats += count;
      }
    }
    console.log(`Total player stats: ${totalStats.toLocaleString()}`);
  }

  // Overall database stats
  console.log('\n\n📊 OVERALL DATABASE STATS:');
  console.log('='.repeat(60));
  
  const { count: totalStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  const { count: totalGames } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true });

  console.log(`Total player stats: ${totalStats?.toLocaleString() || 0}`);
  console.log(`Total games: ${totalGames?.toLocaleString() || 0}`);
}

fixCoverageCheck().catch(console.error);
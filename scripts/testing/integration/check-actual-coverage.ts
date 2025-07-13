import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

dotenv.config({ path: resolve(__dirname, '../.env') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkActualCoverage() {
  console.log('📊 Checking Actual Stats Coverage by Sport...\n');

  const validSports = ['NFL', 'NBA', 'MLB', 'NHL', 'NCAAF', 'NCAAB'];
  
  for (const sport of validSports) {
    console.log(`\n🏈 ${sport} Coverage:`);
    console.log('='.repeat(50));
    
    // Get total games for sport
    const { data: totalGames, error: totalError } = await supabase
      .from('games')
      .select('id, home_team_id, away_team_id')
      .eq('sport', sport);

    if (totalError || !totalGames) {
      console.error(`Error fetching ${sport} games:`, totalError);
      continue;
    }

    console.log(`Total games: ${totalGames.length}`);

    // Get games with stats
    const gameIds = totalGames.map(g => g.id);
    
    const { data: gamesWithStats, error: statsError } = await supabase
      .from('player_stats')
      .select('game_id')
      .in('game_id', gameIds);

    if (statsError) {
      console.error(`Error fetching stats for ${sport}:`, statsError);
      continue;
    }

    // Count unique games with stats
    const uniqueGamesWithStats = new Set(gamesWithStats?.map(s => s.game_id) || []);
    const coverage = totalGames.length > 0 
      ? (uniqueGamesWithStats.size / totalGames.length * 100).toFixed(1) 
      : 0;

    console.log(`Games with stats: ${uniqueGamesWithStats.size}`);
    console.log(`Coverage: ${coverage}%`);
    
    // Calculate how many more games needed for 95%
    const targetGames = Math.ceil(totalGames.length * 0.95);
    const gamesNeeded = Math.max(0, targetGames - uniqueGamesWithStats.size);
    
    if (parseFloat(coverage.toString()) < 95) {
      console.log(`\n❌ Below 95% - Need ${gamesNeeded} more games to reach 95%`);
    } else {
      console.log(`\n✅ Above 95% coverage!`);
    }

    // Get total player stats count
    const { count: statsCount, error: countError } = await supabase
      .from('player_stats')
      .select('id', { count: 'exact', head: true })
      .in('game_id', gameIds);

    if (!countError) {
      console.log(`Total player stats: ${statsCount || 0}`);
    }

    // Sample games without stats (for debugging)
    const gamesWithoutStats = totalGames.filter(g => !uniqueGamesWithStats.has(g.id));
    if (gamesWithoutStats.length > 0 && gamesWithoutStats.length <= 10) {
      console.log(`\nSample games without stats:`);
      gamesWithoutStats.slice(0, 5).forEach(game => {
        console.log(`  - Game ID: ${game.id}`);
      });
    }
  }

  // Overall stats
  console.log('\n\n📊 OVERALL DATABASE STATS:');
  console.log('='.repeat(50));
  
  const { count: totalPlayerStats } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  const { count: totalGamesCount } = await supabase
    .from('games')
    .select('id', { count: 'exact', head: true });

  const { count: totalPlayers } = await supabase
    .from('players')
    .select('id', { count: 'exact', head: true });

  const { count: totalTeams } = await supabase
    .from('teams')
    .select('id', { count: 'exact', head: true });

  console.log(`Total player stats: ${totalPlayerStats?.toLocaleString() || 0}`);
  console.log(`Total games: ${totalGamesCount?.toLocaleString() || 0}`);
  console.log(`Total players: ${totalPlayers?.toLocaleString() || 0}`);
  console.log(`Total teams: ${totalTeams?.toLocaleString() || 0}`);
}

checkActualCoverage().catch(console.error);
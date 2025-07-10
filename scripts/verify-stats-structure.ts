import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function verifyStatsStructure() {
  console.log('📊 Verifying stats table structure and data...\n');

  // 1. Get sample from player_stats
  const { data: playerStats, error: psError } = await supabase
    .from('player_stats')
    .select('*')
    .limit(10);

  if (psError) {
    console.error('Error fetching player_stats:', psError);
  } else {
    console.log('player_stats table structure:');
    if (playerStats && playerStats.length > 0) {
      console.log('Columns:', Object.keys(playerStats[0]).join(', '));
      console.log('\nSample record:');
      console.log(JSON.stringify(playerStats[0], null, 2));
    }
  }

  // 2. Check player_game_logs structure
  const { data: gameLogs, error: glError } = await supabase
    .from('player_game_logs')
    .select('*')
    .limit(10);

  if (glError) {
    console.error('\nError fetching player_game_logs:', glError);
  } else {
    console.log('\n\nplayer_game_logs table structure:');
    if (gameLogs && gameLogs.length > 0) {
      console.log('Columns:', Object.keys(gameLogs[0]).join(', '));
      console.log('\nSample record:');
      console.log(JSON.stringify(gameLogs[0], null, 2));
    } else {
      console.log('No records found in player_game_logs');
    }
  }

  // 3. Check how many stats we have for NFL games
  // First get some NFL game IDs
  const { data: nflGames } = await supabase
    .from('games')
    .select('id, sport, home_team, away_team, game_date')
    .eq('sport', 'NFL')
    .not('home_score', 'is', null)
    .limit(10);

  if (nflGames && nflGames.length > 0) {
    console.log(`\n\nFound ${nflGames.length} NFL games with scores`);
    
    // Check if these games have stats
    const gameIds = nflGames.map(g => g.id);
    const { data: statsForGames, count } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact' })
      .in('game_id', gameIds);

    console.log(`Stats found for these games: ${count || 0}`);
    
    if (statsForGames && statsForGames.length > 0) {
      console.log('\nSample stats for NFL games:');
      const statsByType: Record<string, number> = {};
      statsForGames.forEach(stat => {
        statsByType[stat.stat_type] = (statsByType[stat.stat_type] || 0) + 1;
      });
      console.log('Stats by type:', statsByType);
    }
  } else {
    console.log('\n\nNo NFL games found with scores!');
  }

  // 4. Count total stats by checking game sports
  console.log('\n\nChecking stats coverage by sport...');
  
  // Get a sample of games with stats
  const { data: gamesWithStats } = await supabase
    .from('player_stats')
    .select('game_id')
    .limit(1000);

  if (gamesWithStats && gamesWithStats.length > 0) {
    const uniqueGameIds = [...new Set(gamesWithStats.map(s => s.game_id))];
    
    // Get sport info for these games
    const { data: games } = await supabase
      .from('games')
      .select('id, sport')
      .in('id', uniqueGameIds.slice(0, 100)); // Check first 100

    if (games) {
      const sportCounts: Record<string, number> = {};
      games.forEach(game => {
        sportCounts[game.sport] = (sportCounts[game.sport] || 0) + 1;
      });
      console.log('Games with stats by sport:', sportCounts);
    }
  }

  // 5. Get recent game_date from player_stats
  const { data: recentStats } = await supabase
    .from('player_stats')
    .select('game_date')
    .not('game_date', 'is', null)
    .order('created_at', { ascending: false })
    .limit(10);

  if (recentStats && recentStats.length > 0) {
    console.log('\n\nRecent game dates in player_stats:');
    recentStats.forEach(stat => {
      console.log(`  - ${stat.game_date}`);
    });
  }
}

verifyStatsStructure().catch(console.error);
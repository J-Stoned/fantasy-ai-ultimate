import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.SUPABASE_SERVICE_ROLE_KEY || ''
);

async function debugMLBStats() {
  console.log('🔍 Debugging MLB Stats Collection Issue...\n');

  // 1. Check total MLB games
  const { data: mlbGames, error: gamesError } = await supabase
    .from('games')
    .select('id, external_id, home_team_score, away_team_score, status')
    .eq('sport', 'MLB')
    .limit(5);

  console.log('Sample MLB Games:');
  console.log(mlbGames);
  console.log('');

  // 2. Check MLB stats
  const { data: mlbStats, error: statsError } = await supabase
    .from('player_stats')
    .select('id, game_id, player_id')
    .eq('sport', 'MLB')
    .limit(5);

  console.log('Sample MLB Stats:');
  console.log(mlbStats);
  console.log('');

  // 3. Check if game_ids in stats match games table
  if (mlbStats && mlbStats.length > 0) {
    const gameId = mlbStats[0].game_id;
    const { data: matchingGame } = await supabase
      .from('games')
      .select('id, external_id, sport')
      .eq('id', gameId)
      .single();

    console.log('Checking if stats game_id matches a game:');
    console.log('Stats game_id:', gameId);
    console.log('Matching game:', matchingGame);
    console.log('');
  }

  // 4. Check games with stats using JOIN
  const { data: gamesWithStats, error: joinError } = await supabase
    .from('games')
    .select(`
      id,
      external_id,
      sport,
      player_stats\!inner(id)
    `)
    .eq('sport', 'MLB')
    .limit(5);

  console.log('MLB Games with stats (using JOIN):');
  console.log('Games found:', gamesWithStats?.length || 0);
  if (gamesWithStats && gamesWithStats.length > 0) {
    console.log('Sample:', gamesWithStats[0]);
  }
  console.log('');

  // 5. Direct SQL query to check coverage
  const { data: directCount } = await supabase
    .rpc('execute_sql', { 
      query: `
        SELECT 
          COUNT(DISTINCT g.id) as games_with_stats,
          COUNT(DISTINCT ps.id) as total_stats
        FROM games g
        INNER JOIN player_stats ps ON ps.game_id = g.id
        WHERE g.sport = 'MLB' AND ps.sport = 'MLB'
      `
    });
  
  console.log('Direct SQL count:', directCount);
}

debugMLBStats().catch(console.error);

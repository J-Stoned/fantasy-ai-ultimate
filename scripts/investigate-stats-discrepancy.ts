import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(process.cwd(), '.env.local') });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing required environment variables');
  console.log('NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? 'Set' : 'Missing');
  console.log('SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? 'Set' : 'Missing');
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function investigateDiscrepancy() {
  console.log('🔍 Investigating NFL stats discrepancy...\n');

  // 1. Check total player_stats records
  const { data: totalStats, error: totalError } = await supabase
    .from('player_stats')
    .select('id', { count: 'exact', head: true });

  console.log(`Total player_stats records: ${totalStats ? totalError?.count || 0 : 0}`);

  // 2. Check NFL player_stats records
  const { data: nflStats, count: nflStatsCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact' })
    .eq('sport', 'NFL')
    .limit(5);

  console.log(`\nNFL player_stats records: ${nflStatsCount || 0}`);
  if (nflStats && nflStats.length > 0) {
    console.log('Sample NFL stats:');
    nflStats.forEach(stat => {
      console.log(`- Player ${stat.player_id}, Game ${stat.game_id}, Date: ${stat.game_date}`);
    });
  }

  // 3. Check player_game_logs
  const { data: totalLogs, error: logsError } = await supabase
    .from('player_game_logs')
    .select('id', { count: 'exact', head: true });

  console.log(`\nTotal player_game_logs records: ${totalLogs ? logsError?.count || 0 : 0}`);

  // 4. Check NFL player_game_logs
  const { data: nflLogs, count: nflLogsCount } = await supabase
    .from('player_game_logs')
    .select('*', { count: 'exact' })
    .eq('sport', 'NFL')
    .limit(5);

  console.log(`NFL player_game_logs records: ${nflLogsCount || 0}`);
  if (nflLogs && nflLogs.length > 0) {
    console.log('Sample NFL game logs:');
    nflLogs.forEach(log => {
      console.log(`- Player ${log.player_id}, Game ${log.game_id}, Date: ${log.game_date}`);
    });
  }

  // 5. Check recent insertions (last hour)
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  
  const { data: recentStats, count: recentCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact' })
    .gte('created_at', oneHourAgo)
    .limit(10);

  console.log(`\nRecent player_stats insertions (last hour): ${recentCount || 0}`);
  if (recentStats && recentStats.length > 0) {
    console.log('Recent insertions:');
    recentStats.forEach(stat => {
      console.log(`- ${stat.sport} Player ${stat.player_id}, Game ${stat.game_id}, Created: ${stat.created_at}`);
    });
  }

  // 6. Check if NFL games exist
  const { data: nflGames, count: nflGamesCount } = await supabase
    .from('games')
    .select('*', { count: 'exact' })
    .eq('sport', 'NFL')
    .eq('season', 2023)
    .not('home_score', 'is', null)
    .limit(5);

  console.log(`\nNFL games (2023 season with scores): ${nflGamesCount || 0}`);
  if (nflGames && nflGames.length > 0) {
    console.log('Sample NFL games:');
    nflGames.forEach(game => {
      console.log(`- Game ${game.id}: ${game.home_team} vs ${game.away_team}, ${game.game_date}`);
    });
  }

  // 7. Check for any stats linked to these NFL games
  if (nflGames && nflGames.length > 0) {
    const gameIds = nflGames.map(g => g.id);
    const { data: linkedStats, count: linkedCount } = await supabase
      .from('player_stats')
      .select('*', { count: 'exact' })
      .in('game_id', gameIds);

    console.log(`\nStats linked to sample NFL games: ${linkedCount || 0}`);
    if (linkedStats && linkedStats.length > 0) {
      console.log('Found linked stats!');
    }
  }

  // 8. Check distinct sports in player_stats
  const { data: sports } = await supabase
    .from('player_stats')
    .select('sport')
    .limit(1000);

  if (sports) {
    const uniqueSports = [...new Set(sports.map(s => s.sport))];
    console.log(`\nDistinct sports in player_stats: ${uniqueSports.join(', ')}`);
  }

  // 9. Check for case sensitivity issues
  const { data: upperNFL, count: upperCount } = await supabase
    .from('player_stats')
    .select('*', { count: 'exact' })
    .ilike('sport', 'nfl')
    .limit(5);

  console.log(`\nCase-insensitive NFL search results: ${upperCount || 0}`);

  // 10. Raw SQL query to double-check
  const { data: rawCheck } = await supabase.rpc('execute_sql', {
    query: `
      SELECT sport, COUNT(*) as count 
      FROM player_stats 
      GROUP BY sport 
      ORDER BY count DESC
    `
  });

  if (rawCheck) {
    console.log('\nStats count by sport (raw SQL):');
    console.log(rawCheck);
  }
}

investigateDiscrepancy().catch(console.error);
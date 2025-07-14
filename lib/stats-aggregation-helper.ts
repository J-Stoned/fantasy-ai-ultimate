// Stats Aggregation Helper Functions
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function getAggregatedPlayerGameStats(playerId: number, gameId: number) {
  const { data: stats, error } = await supabase
    .from('player_stats')
    .select('*')
    .eq('player_id', playerId)
    .eq('game_id', gameId);
  
  if (error || !stats) return null;
  
  const aggregated = {
    points: 0,
    rebounds: 0,
    assists: 0,
    steals: 0,
    blocks: 0,
    turnovers: 0,
    field_goals_made: 0,
    field_goals_attempted: 0,
    three_pointers_made: 0,
    three_pointers_attempted: 0,
    free_throws_made: 0,
    free_throws_attempted: 0,
    minutes_played: 0,
    fantasy_points: 0
  };
  
  const statMapping: Record<string, keyof typeof aggregated> = {
    'points': 'points',
    'pts': 'points',
    'rebounds': 'rebounds',
    'reb': 'rebounds',
    'assists': 'assists',
    'ast': 'assists',
    'steals': 'steals',
    'stl': 'steals',
    'blocks': 'blocks',
    'blk': 'blocks',
    'turnovers': 'turnovers',
    'to': 'turnovers',
    'field_goals_made': 'field_goals_made',
    'fgm': 'field_goals_made',
    'field_goals_attempted': 'field_goals_attempted',
    'fga': 'field_goals_attempted',
    'three_pointers_made': 'three_pointers_made',
    '3pm': 'three_pointers_made',
    'three_pointers_attempted': 'three_pointers_attempted',
    '3pa': 'three_pointers_attempted',
    'free_throws_made': 'free_throws_made',
    'ftm': 'free_throws_made',
    'free_throws_attempted': 'free_throws_attempted',
    'fta': 'free_throws_attempted',
    'minutes': 'minutes_played',
    'min': 'minutes_played'
  };
  
  stats.forEach(stat => {
    const key = statMapping[stat.stat_type?.toLowerCase()];
    if (key) {
      aggregated[key] = parseFloat(stat.stat_value) || 0;
    }
    if (stat.fantasy_points) {
      aggregated.fantasy_points = Math.max(aggregated.fantasy_points, stat.fantasy_points);
    }
  });
  
  // Calculate fantasy points if missing
  if (aggregated.fantasy_points === 0) {
    aggregated.fantasy_points = 
      aggregated.points +
      (aggregated.rebounds * 1.2) +
      (aggregated.assists * 1.5) +
      (aggregated.steals * 3) +
      (aggregated.blocks * 3) -
      (aggregated.turnovers * 1);
  }
  
  return aggregated;
}

export async function getPlayerStatsForGames(playerId: number, gameIds: number[]) {
  const promises = gameIds.map(gameId => getAggregatedPlayerGameStats(playerId, gameId));
  return Promise.all(promises);
}

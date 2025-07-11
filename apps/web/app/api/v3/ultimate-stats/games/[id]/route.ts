import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
import { ultimateStatsService } from '../../../../../../../../../lib/services/ultimate-stats-service';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * GET /api/v3/ultimate-stats/games/[id]
 * 
 * Get comprehensive ultimate stats for all players in a specific game
 * 
 * Query Parameters:
 * - team: Filter by specific team ("home" or "away")
 * - position: Filter by player position
 * - min_minutes: Minimum minutes played filter
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id;
    const { searchParams } = new URL(request.url);
    
    const team = searchParams.get('team');
    const position = searchParams.get('position');
    const minMinutes = searchParams.get('min_minutes');
    
    // Check if we have cached metrics for this game
    const cachedMetrics = await ultimateStatsService.getCachedGameMetrics(gameId);
    
    // Get game info
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    if (gameError || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }
    
    // Build query for game logs
    let query = supabase
      .from('player_game_logs')
      .select(`
        *,
        players!inner(
          id,
          name,
          position,
          team,
          sport,
          jersey_number
        )
      `)
      .eq('game_id', gameId)
      .not('stats', 'eq', '{}');
    
    // Apply filters
    if (team === 'home') {
      query = query.eq('players.team', game.home_team);
    } else if (team === 'away') {
      query = query.eq('players.team', game.away_team);
    }
    
    if (position) {
      query = query.eq('players.position', position);
    }
    
    if (minMinutes) {
      query = query.gte('minutes_played', parseFloat(minMinutes));
    }
    
    const { data: gameLogs, error: logsError } = await query;
    
    if (logsError) {
      throw new Error(`Failed to fetch game logs: ${logsError.message}`);
    }
    
    // Merge cached metrics if available
    if (cachedMetrics && gameLogs) {
      gameLogs.forEach(log => {
        if (cachedMetrics[log.player_id]) {
          log.computed_metrics = {
            ...log.computed_metrics,
            ...cachedMetrics[log.player_id],
            _from_cache: true
          };
        }
      });
    }
    
    // Group by team
    const homeTeamLogs = gameLogs?.filter(log => log.players.team === game.home_team) || [];
    const awayTeamLogs = gameLogs?.filter(log => log.players.team === game.away_team) || [];
    
    // Calculate team aggregates
    const homeTeamStats = calculateTeamStats(homeTeamLogs);
    const awayTeamStats = calculateTeamStats(awayTeamLogs);
    
    // Identify key performers
    const keyPerformers = identifyKeyPerformers(gameLogs || []);
    
    // Calculate game flow metrics
    const gameFlow = calculateGameFlow(gameLogs || [], game);
    
    const response = {
      game: {
        id: game.id,
        sport: game.sport,
        home_team: game.home_team,
        away_team: game.away_team,
        home_score: game.home_score,
        away_score: game.away_score,
        status: game.status,
        start_time: game.start_time
      },
      team_stats: {
        [game.home_team]: homeTeamStats,
        [game.away_team]: awayTeamStats
      },
      player_stats: {
        home_team: homeTeamLogs.map(formatPlayerStats),
        away_team: awayTeamLogs.map(formatPlayerStats)
      },
      key_performers: keyPerformers,
      game_flow: gameFlow,
      meta: {
        total_players: gameLogs?.length || 0,
        filters_applied: { team, position, minMinutes },
        cached_metrics_used: !!cachedMetrics,
        last_updated: new Date().toISOString()
      }
    };
    
    // Cache response for live games (shorter TTL)
    const cacheTTL = game.status === 'in_progress' ? 30 : 300;
    const cacheKey = `game:${gameId}:ultimate_stats`;
    await redis.set(cacheKey, response, { ex: cacheTTL });
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Game Ultimate Stats Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch game ultimate stats', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v3/ultimate-stats/games/[id]/refresh
 * 
 * Force refresh ultimate stats for a specific game
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const gameId = params.id;
    
    // Get game info to determine sport
    const { data: game, error } = await supabase
      .from('games')
      .select('sport')
      .eq('id', gameId)
      .single();
    
    if (error || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }
    
    // Trigger stats processing for this game's sport
    const result = await ultimateStatsService.processLatestStats(game.sport);
    
    return NextResponse.json({
      message: 'Game stats refresh initiated',
      game_id: gameId,
      sport: game.sport,
      result
    });
    
  } catch (error) {
    console.error('Game Refresh Error:', error);
    return NextResponse.json(
      { error: 'Failed to refresh game stats', details: error.message },
      { status: 500 }
    );
  }
}

// Calculate team statistics
function calculateTeamStats(teamLogs: any[]) {
  if (teamLogs.length === 0) return null;
  
  const stats: any = {
    players_count: teamLogs.length,
    total_minutes: 0,
    totals: {},
    averages: {},
    efficiency: {}
  };
  
  // Sum up team totals
  teamLogs.forEach(log => {
    stats.total_minutes += parseFloat(log.minutes_played) || 0;
    
    // Aggregate basic stats
    if (log.stats) {
      Object.entries(log.stats).forEach(([key, value]) => {
        if (typeof value === 'number') {
          stats.totals[key] = (stats.totals[key] || 0) + value;
        }
      });
    }
  });
  
  // Calculate team efficiency metrics based on sport
  const sport = teamLogs[0]?.players?.sport;
  
  if (sport === 'NBA') {
    // Calculate team shooting percentages
    if (stats.totals.fieldGoalsAttempted > 0) {
      stats.efficiency.team_fg_pct = stats.totals.fieldGoalsMade / stats.totals.fieldGoalsAttempted;
    }
    if (stats.totals.threePointersAttempted > 0) {
      stats.efficiency.team_three_pct = stats.totals.threePointersMade / stats.totals.threePointersAttempted;
    }
    if (stats.totals.freeThrowsAttempted > 0) {
      stats.efficiency.team_ft_pct = stats.totals.freeThrowsMade / stats.totals.freeThrowsAttempted;
    }
    
    // Pace and efficiency
    const possessions = stats.totals.fieldGoalsAttempted + 0.44 * stats.totals.freeThrowsAttempted + stats.totals.turnovers;
    stats.efficiency.offensive_rating = (stats.totals.points / possessions) * 100;
  }
  
  // Round all numbers
  Object.keys(stats.totals).forEach(key => {
    stats.totals[key] = Math.round(stats.totals[key] * 10) / 10;
  });
  
  Object.keys(stats.efficiency).forEach(key => {
    stats.efficiency[key] = Math.round(stats.efficiency[key] * 1000) / 1000;
  });
  
  return stats;
}

// Format player stats for response
function formatPlayerStats(log: any) {
  return {
    player: {
      id: log.player_id,
      name: log.players.name,
      position: log.players.position,
      jersey_number: log.players.jersey_number
    },
    minutes_played: log.minutes_played,
    basic_stats: log.stats,
    advanced_metrics: log.computed_metrics,
    fantasy_points: log.computed_metrics?.fantasy_points_estimate || 0
  };
}

// Identify key performers in the game
function identifyKeyPerformers(gameLogs: any[]) {
  if (gameLogs.length === 0) return null;
  
  const performers: any = {
    fantasy_leaders: [],
    statistical_leaders: {},
    efficiency_leaders: []
  };
  
  // Fantasy points leaders
  const byFantasyPoints = [...gameLogs]
    .filter(log => log.computed_metrics?.fantasy_points_estimate)
    .sort((a, b) => b.computed_metrics.fantasy_points_estimate - a.computed_metrics.fantasy_points_estimate)
    .slice(0, 5);
  
  performers.fantasy_leaders = byFantasyPoints.map(log => ({
    player_id: log.player_id,
    player_name: log.players.name,
    team: log.players.team,
    fantasy_points: log.computed_metrics.fantasy_points_estimate
  }));
  
  // Statistical category leaders
  const statCategories = ['points', 'assists', 'rebounds', 'steals', 'blocks'];
  statCategories.forEach(stat => {
    const leader = gameLogs
      .filter(log => log.stats?.[stat])
      .sort((a, b) => (b.stats[stat] || 0) - (a.stats[stat] || 0))[0];
    
    if (leader && leader.stats[stat] > 0) {
      performers.statistical_leaders[stat] = {
        player_id: leader.player_id,
        player_name: leader.players.name,
        value: leader.stats[stat]
      };
    }
  });
  
  // Efficiency leaders (min 15 minutes)
  const qualifiedPlayers = gameLogs.filter(log => 
    parseFloat(log.minutes_played) >= 15 && log.computed_metrics?.game_score
  );
  
  const byGameScore = [...qualifiedPlayers]
    .sort((a, b) => b.computed_metrics.game_score - a.computed_metrics.game_score)
    .slice(0, 3);
  
  performers.efficiency_leaders = byGameScore.map(log => ({
    player_id: log.player_id,
    player_name: log.players.name,
    team: log.players.team,
    game_score: log.computed_metrics.game_score,
    true_shooting_pct: log.computed_metrics.true_shooting_pct
  }));
  
  return performers;
}

// Calculate game flow metrics
function calculateGameFlow(gameLogs: any[], game: any) {
  // This would ideally use play-by-play data
  // For now, return basic game summary
  return {
    final_score: {
      [game.home_team]: game.home_score,
      [game.away_team]: game.away_score
    },
    winner: game.home_score > game.away_score ? game.home_team : game.away_team,
    margin: Math.abs(game.home_score - game.away_score),
    total_points: game.home_score + game.away_score,
    pace_indicator: gameLogs.reduce((sum, log) => sum + (log.stats?.fieldGoalsAttempted || 0), 0)
  };
}
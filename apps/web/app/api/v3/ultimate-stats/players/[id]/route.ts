import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

/**
 * GET /api/v3/ultimate-stats/players/[id]
 * 
 * Get comprehensive ultimate stats for a specific player
 * 
 * Query Parameters:
 * - season: Filter by season (e.g., "2024")
 * - last_n_games: Get stats for last N games
 * - vs_team: Filter games against specific team
 * - home_away: Filter by "home" or "away" games
 * - date_from: Start date filter
 * - date_to: End date filter
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const playerId = params.id;
    const { searchParams } = new URL(request.url);
    
    const season = searchParams.get('season');
    const lastNGames = searchParams.get('last_n_games');
    const vsTeam = searchParams.get('vs_team');
    const homeAway = searchParams.get('home_away');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    
    // Cache key
    const cacheKey = `player:${playerId}:ultimate_stats:${JSON.stringify({
      season, lastNGames, vsTeam, homeAway, dateFrom, dateTo
    })}`;
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json(cached);
    }
    
    // Get player info
    const { data: player, error: playerError } = await supabase
      .from('players')
      .select('*')
      .eq('id', playerId)
      .single();
    
    if (playerError || !player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }
    
    // Build game logs query
    let query = supabase
      .from('player_game_logs')
      .select(`
        *,
        games!inner(
          id,
          sport,
          home_team,
          away_team,
          home_score,
          away_score,
          start_time,
          status
        )
      `)
      .eq('player_id', playerId)
      .not('computed_metrics', 'eq', '{}')
      .order('games.start_time', { ascending: false });
    
    // Apply filters
    if (vsTeam) {
      query = query.or(`games.home_team.eq.${vsTeam},games.away_team.eq.${vsTeam}`);
    }
    
    if (homeAway === 'home') {
      query = query.eq('games.home_team', player.team);
    } else if (homeAway === 'away') {
      query = query.eq('games.away_team', player.team);
    }
    
    if (dateFrom) {
      query = query.gte('games.start_time', dateFrom);
    }
    
    if (dateTo) {
      query = query.lte('games.start_time', dateTo);
    }
    
    if (lastNGames) {
      query = query.limit(parseInt(lastNGames));
    } else if (season) {
      // Season filter logic (assuming season starts in October)
      const seasonStart = `${season}-10-01`;
      const seasonEnd = `${parseInt(season) + 1}-07-01`;
      query = query.gte('games.start_time', seasonStart)
                   .lte('games.start_time', seasonEnd);
    }
    
    const { data: gameLogs, error: logsError } = await query;
    
    if (logsError) {
      throw new Error(`Failed to fetch game logs: ${logsError.message}`);
    }
    
    // Calculate aggregated stats
    const aggregatedStats = calculatePlayerAggregates(gameLogs || []);
    
    // Calculate trends
    const trends = calculateTrends(gameLogs || []);
    
    // Get recent form (last 5 games)
    const recentForm = (gameLogs || []).slice(0, 5).map(log => ({
      game_id: log.game_id,
      date: log.games.start_time,
      opponent: log.games.home_team === player.team ? log.games.away_team : log.games.home_team,
      metrics: {
        points: log.stats?.points || 0,
        fantasy_points: log.computed_metrics?.fantasy_points_estimate || 0,
        true_shooting_pct: log.computed_metrics?.true_shooting_pct || 0,
        usage_rate: log.computed_metrics?.usage_rate || 0
      }
    }));
    
    const response = {
      player,
      stats: {
        games_played: gameLogs?.length || 0,
        averages: aggregatedStats.averages,
        totals: aggregatedStats.totals,
        per_game: aggregatedStats.perGame,
        advanced: aggregatedStats.advanced
      },
      trends,
      recent_form: recentForm,
      splits: calculateSplits(gameLogs || [], player),
      meta: {
        filters_applied: { season, lastNGames, vsTeam, homeAway, dateFrom, dateTo },
        last_updated: new Date().toISOString()
      }
    };
    
    // Cache response
    await redis.set(cacheKey, response, { ex: 300 }); // 5 min cache
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('Player Ultimate Stats Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch player ultimate stats', details: error.message },
      { status: 500 }
    );
  }
}

// Calculate aggregated player statistics
function calculatePlayerAggregates(gameLogs: any[]) {
  if (gameLogs.length === 0) {
    return { averages: {}, totals: {}, perGame: {}, advanced: {} };
  }
  
  const totals: any = {};
  const counts: any = {};
  
  // Sum up all numeric metrics
  gameLogs.forEach(log => {
    // Basic stats
    if (log.stats) {
      Object.entries(log.stats).forEach(([key, value]) => {
        if (typeof value === 'number') {
          totals[key] = (totals[key] || 0) + value;
          counts[key] = (counts[key] || 0) + 1;
        }
      });
    }
    
    // Computed metrics (for averaging, not totaling)
    if (log.computed_metrics) {
      Object.entries(log.computed_metrics).forEach(([key, value]) => {
        if (typeof value === 'number' && !key.startsWith('_')) {
          if (!totals[`avg_${key}`]) totals[`avg_${key}`] = 0;
          if (!counts[`avg_${key}`]) counts[`avg_${key}`] = 0;
          totals[`avg_${key}`] += value;
          counts[`avg_${key}`] += 1;
        }
      });
    }
  });
  
  // Calculate averages
  const averages: any = {};
  Object.keys(totals).forEach(key => {
    if (key.startsWith('avg_')) {
      const metricName = key.replace('avg_', '');
      averages[metricName] = Math.round((totals[key] / counts[key]) * 1000) / 1000;
    } else {
      averages[key] = Math.round((totals[key] / counts[key]) * 10) / 10;
    }
  });
  
  // Per game stats
  const perGame: any = {};
  const gamesPlayed = gameLogs.length;
  Object.keys(totals).forEach(key => {
    if (!key.startsWith('avg_')) {
      perGame[key] = Math.round((totals[key] / gamesPlayed) * 10) / 10;
    }
  });
  
  return {
    averages,
    totals: Object.fromEntries(
      Object.entries(totals).filter(([key]) => !key.startsWith('avg_'))
    ),
    perGame,
    advanced: {
      consistency_score: calculateConsistency(gameLogs),
      clutch_rating: calculateClutchRating(gameLogs)
    }
  };
}

// Calculate performance trends
function calculateTrends(gameLogs: any[]) {
  if (gameLogs.length < 2) return null;
  
  // Get recent games (newest first)
  const recentGames = gameLogs.slice(0, 10);
  const olderGames = gameLogs.slice(10, 20);
  
  if (olderGames.length === 0) return null;
  
  // Calculate key metric trends
  const trends: any = {};
  const metricsToTrend = ['points', 'fantasy_points_estimate', 'true_shooting_pct', 'usage_rate'];
  
  metricsToTrend.forEach(metric => {
    const recentAvg = calculateAverage(recentGames, metric);
    const olderAvg = calculateAverage(olderGames, metric);
    
    if (recentAvg !== null && olderAvg !== null && olderAvg !== 0) {
      const change = ((recentAvg - olderAvg) / olderAvg) * 100;
      trends[metric] = {
        recent: recentAvg,
        previous: olderAvg,
        change_pct: Math.round(change * 10) / 10,
        trending: change > 5 ? 'up' : change < -5 ? 'down' : 'stable'
      };
    }
  });
  
  return trends;
}

// Calculate average for a specific metric
function calculateAverage(logs: any[], metric: string): number | null {
  const values = logs
    .map(log => {
      if (metric.includes('.')) {
        const [obj, field] = metric.split('.');
        return log[obj]?.[field];
      }
      return log.stats?.[metric] || log.computed_metrics?.[metric];
    })
    .filter(val => typeof val === 'number');
  
  if (values.length === 0) return null;
  return values.reduce((sum, val) => sum + val, 0) / values.length;
}

// Calculate performance consistency
function calculateConsistency(gameLogs: any[]): number {
  if (gameLogs.length < 3) return 0;
  
  const fantasyPoints = gameLogs
    .map(log => log.computed_metrics?.fantasy_points_estimate || 0)
    .filter(val => val > 0);
  
  if (fantasyPoints.length < 3) return 0;
  
  const mean = fantasyPoints.reduce((sum, val) => sum + val, 0) / fantasyPoints.length;
  const variance = fantasyPoints.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / fantasyPoints.length;
  const stdDev = Math.sqrt(variance);
  
  // Consistency score: lower coefficient of variation = more consistent
  const coefficientOfVariation = stdDev / mean;
  const consistencyScore = Math.max(0, 100 - (coefficientOfVariation * 100));
  
  return Math.round(consistencyScore);
}

// Calculate clutch performance rating
function calculateClutchRating(gameLogs: any[]): number {
  // Simplified clutch rating based on performance in close games
  const closeGames = gameLogs.filter(log => {
    const scoreDiff = Math.abs((log.games.home_score || 0) - (log.games.away_score || 0));
    return scoreDiff <= 10; // Games decided by 10 points or less
  });
  
  if (closeGames.length < 3) return 50; // Default rating
  
  const avgFantasyInCloseGames = calculateAverage(closeGames, 'fantasy_points_estimate') || 0;
  const overallAvgFantasy = calculateAverage(gameLogs, 'fantasy_points_estimate') || 0;
  
  if (overallAvgFantasy === 0) return 50;
  
  const clutchMultiplier = avgFantasyInCloseGames / overallAvgFantasy;
  const clutchRating = 50 + ((clutchMultiplier - 1) * 50);
  
  return Math.max(0, Math.min(100, Math.round(clutchRating)));
}

// Calculate performance splits
function calculateSplits(gameLogs: any[], player: any) {
  const splits: any = {
    home_away: {},
    by_opponent: {},
    by_day_of_week: {}
  };
  
  // Home vs Away
  const homeGames = gameLogs.filter(log => log.games.home_team === player.team);
  const awayGames = gameLogs.filter(log => log.games.away_team === player.team);
  
  splits.home_away = {
    home: {
      games: homeGames.length,
      avg_fantasy_points: calculateAverage(homeGames, 'fantasy_points_estimate')
    },
    away: {
      games: awayGames.length,
      avg_fantasy_points: calculateAverage(awayGames, 'fantasy_points_estimate')
    }
  };
  
  // By opponent (top 5)
  const opponentGroups: any = {};
  gameLogs.forEach(log => {
    const opponent = log.games.home_team === player.team ? log.games.away_team : log.games.home_team;
    if (!opponentGroups[opponent]) opponentGroups[opponent] = [];
    opponentGroups[opponent].push(log);
  });
  
  Object.entries(opponentGroups)
    .sort(([, a]: any, [, b]: any) => b.length - a.length)
    .slice(0, 5)
    .forEach(([opponent, logs]: [string, any]) => {
      splits.by_opponent[opponent] = {
        games: logs.length,
        avg_fantasy_points: calculateAverage(logs, 'fantasy_points_estimate')
      };
    });
  
  return splits;
}
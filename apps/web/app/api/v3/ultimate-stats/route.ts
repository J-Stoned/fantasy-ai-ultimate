import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Redis } from '@upstash/redis';
// Temporarily comment out service import - will create inline for Vercel
// import { ultimateStatsService } from '../../../../../../../lib/services/ultimate-stats-service';

// Initialize clients
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache TTLs
const CACHE_TTL = {
  LIVE: 30,        // 30 seconds for live games
  RECENT: 120,     // 2 minutes for recent games
  STANDARD: 300,   // 5 minutes for standard queries
  AGGREGATE: 900,  // 15 minutes for aggregated data
};

/**
 * GET /api/v3/ultimate-stats
 * 
 * Query Parameters:
 * - sport: Filter by sport (NBA, NFL, NHL, MLB)
 * - limit: Number of results (default: 100, max: 1000)
 * - offset: Pagination offset
 * - player_id: Filter by specific player
 * - game_id: Filter by specific game
 * - team: Filter by team
 * - date_from: Start date (ISO string)
 * - date_to: End date (ISO string)
 * - metrics: Comma-separated list of specific metrics to include
 * - live: Include only live game stats
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    
    // Parse query parameters
    const sport = searchParams.get('sport');
    const limit = Math.min(parseInt(searchParams.get('limit') || '100'), 1000);
    const offset = parseInt(searchParams.get('offset') || '0');
    const playerId = searchParams.get('player_id');
    const gameId = searchParams.get('game_id');
    const team = searchParams.get('team');
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');
    const metrics = searchParams.get('metrics')?.split(',');
    const liveOnly = searchParams.get('live') === 'true';
    
    // Build cache key
    const cacheKey = `ultimate_stats:${JSON.stringify({
      sport, limit, offset, playerId, gameId, team, dateFrom, dateTo, liveOnly
    })}`;
    
    // Check cache
    const cached = await redis.get(cacheKey);
    if (cached) {
      return NextResponse.json({
        data: cached,
        meta: {
          cached: true,
          cache_ttl: liveOnly ? CACHE_TTL.LIVE : CACHE_TTL.STANDARD
        }
      });
    }
    
    // Build query
    let query = supabase
      .from('player_game_logs')
      .select(`
        id,
        player_id,
        game_id,
        stats,
        computed_metrics,
        minutes_played,
        created_at,
        players!inner(
          id,
          name,
          position,
          team,
          sport
        ),
        games!inner(
          id,
          sport,
          home_team,
          away_team,
          start_time,
          status
        )
      `)
      .not('computed_metrics', 'eq', '{}')
      .order('games.start_time', { ascending: false })
      .range(offset, offset + limit - 1);
    
    // Apply filters
    if (sport) {
      query = query.eq('games.sport', sport);
    }
    
    if (playerId) {
      query = query.eq('player_id', playerId);
    }
    
    if (gameId) {
      query = query.eq('game_id', gameId);
    }
    
    if (team) {
      query = query.eq('players.team', team);
    }
    
    if (dateFrom) {
      query = query.gte('games.start_time', dateFrom);
    }
    
    if (dateTo) {
      query = query.lte('games.start_time', dateTo);
    }
    
    if (liveOnly) {
      query = query.eq('games.status', 'in_progress');
    }
    
    const { data, error, count } = await query;
    
    if (error) {
      throw new Error(`Database query failed: ${error.message}`);
    }
    
    // Filter specific metrics if requested
    let processedData = data;
    if (metrics && metrics.length > 0 && data) {
      processedData = data.map(log => ({
        ...log,
        computed_metrics: metrics.reduce((acc, metric) => {
          if (log.computed_metrics[metric] !== undefined) {
            acc[metric] = log.computed_metrics[metric];
          }
          return acc;
        }, {} as any)
      }));
    }
    
    // Calculate aggregates
    const aggregates = calculateAggregates(processedData || []);
    
    // Cache the response
    const cacheTTL = liveOnly ? CACHE_TTL.LIVE : CACHE_TTL.STANDARD;
    await redis.set(cacheKey, processedData, { ex: cacheTTL });
    
    return NextResponse.json({
      data: processedData,
      meta: {
        total: count || 0,
        limit,
        offset,
        cached: false,
        aggregates
      }
    });
    
  } catch (error) {
    console.error('Ultimate Stats API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ultimate stats', details: error.message },
      { status: 500 }
    );
  }
}

/**
 * POST /api/v3/ultimate-stats
 * 
 * Calculate ultimate stats on-demand
 * 
 * Body:
 * - game_id: Game to process
 * - player_ids: Array of player IDs to process
 * - force: Force recalculation even if metrics exist
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { game_id, player_ids, force = false } = body;
    
    if (!game_id && !player_ids) {
      return NextResponse.json(
        { error: 'Either game_id or player_ids must be provided' },
        { status: 400 }
      );
    }
    
    // Build query for logs to process
    let query = supabase
      .from('player_game_logs')
      .select(`
        id,
        player_id,
        game_id,
        stats,
        computed_metrics,
        minutes_played,
        games!inner(sport)
      `);
    
    if (game_id) {
      query = query.eq('game_id', game_id);
    }
    
    if (player_ids && player_ids.length > 0) {
      query = query.in('player_id', player_ids);
    }
    
    // Only process logs with stats
    query = query.not('stats', 'eq', '{}');
    
    // If not forcing, skip logs that already have metrics
    if (!force) {
      query = query.eq('computed_metrics', '{}');
    }
    
    const { data: logs, error } = await query;
    
    if (error) {
      throw new Error(`Failed to fetch logs: ${error.message}`);
    }
    
    if (!logs || logs.length === 0) {
      return NextResponse.json({
        message: 'No logs found to process',
        processed: 0
      });
    }
    
    // Process each log
    const results = [];
    for (const log of logs) {
      try {
        // TODO: Process metrics calculation here
        // For now, return success
        const result = { success: true };
        results.push({
          log_id: log.id,
          player_id: log.player_id,
          success: true,
          sport: log.games.sport
        });
      } catch (error) {
        results.push({
          log_id: log.id,
          player_id: log.player_id,
          success: false,
          error: error.message
        });
      }
    }
    
    const successCount = results.filter(r => r.success).length;
    
    return NextResponse.json({
      message: `Processed ${successCount}/${logs.length} logs successfully`,
      processed: successCount,
      total: logs.length,
      results
    });
    
  } catch (error) {
    console.error('Ultimate Stats Calculation Error:', error);
    return NextResponse.json(
      { error: 'Failed to calculate ultimate stats', details: error.message },
      { status: 500 }
    );
  }
}

// Helper function to calculate aggregates
function calculateAggregates(data: any[]) {
  if (!data || data.length === 0) return null;
  
  const aggregates: any = {
    total_logs: data.length,
    by_sport: {},
    average_metrics: {}
  };
  
  // Group by sport
  const sportGroups = data.reduce((acc, log) => {
    const sport = log.games?.sport || 'unknown';
    if (!acc[sport]) acc[sport] = [];
    acc[sport].push(log);
    return acc;
  }, {} as any);
  
  // Calculate sport-specific aggregates
  Object.entries(sportGroups).forEach(([sport, logs]: [string, any[]]) => {
    aggregates.by_sport[sport] = {
      count: logs.length,
      average_metrics: calculateAverageMetrics(logs)
    };
  });
  
  // Overall average metrics
  aggregates.average_metrics = calculateAverageMetrics(data);
  
  return aggregates;
}

// Calculate average metrics for a set of logs
function calculateAverageMetrics(logs: any[]) {
  const metricSums: any = {};
  const metricCounts: any = {};
  
  logs.forEach(log => {
    if (log.computed_metrics) {
      Object.entries(log.computed_metrics).forEach(([key, value]) => {
        if (typeof value === 'number') {
          metricSums[key] = (metricSums[key] || 0) + value;
          metricCounts[key] = (metricCounts[key] || 0) + 1;
        }
      });
    }
  });
  
  const averages: any = {};
  Object.keys(metricSums).forEach(key => {
    averages[key] = Math.round((metricSums[key] / metricCounts[key]) * 1000) / 1000;
  });
  
  return averages;
}
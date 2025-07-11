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
 * GET /api/v3/ultimate-stats/health
 * 
 * Health check endpoint for Ultimate Stats API
 */
export async function GET(request: NextRequest) {
  try {
    const checks = {
      api: 'healthy',
      database: 'unknown',
      redis: 'unknown',
      metrics_coverage: 'unknown'
    };
    
    // Check database connection
    try {
      const { count, error } = await supabase
        .from('player_game_logs')
        .select('*', { count: 'exact', head: true })
        .not('computed_metrics', 'eq', '{}');
      
      if (!error && count !== null) {
        checks.database = 'healthy';
        checks.metrics_coverage = `${count} logs with metrics`;
      } else {
        checks.database = 'unhealthy';
      }
    } catch (e) {
      checks.database = 'error';
    }
    
    // Check Redis connection
    try {
      await redis.ping();
      checks.redis = 'healthy';
    } catch (e) {
      checks.redis = 'error';
    }
    
    // Overall health
    const isHealthy = Object.values(checks).every(status => 
      status === 'healthy' || status.includes('logs with metrics')
    );
    
    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'degraded',
      timestamp: new Date().toISOString(),
      checks,
      endpoints: [
        'GET /api/v3/ultimate-stats',
        'POST /api/v3/ultimate-stats',
        'GET /api/v3/ultimate-stats/players/[id]',
        'GET /api/v3/ultimate-stats/games/[id]',
        'POST /api/v3/ultimate-stats/games/[id]/refresh'
      ]
    });
    
  } catch (error) {
    return NextResponse.json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message
    }, { status: 500 });
  }
}
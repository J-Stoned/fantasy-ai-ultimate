import { NextRequest, NextResponse } from 'next/server';
import { requireAdminAuth } from '@/lib/middleware/admin-auth';
import { queryMonitor } from '@/lib/services/query-monitor';
import { optimizedDB } from '@/lib/services/optimized-database';
import { logger } from '../../../../lib/logging/logger';

// GET /api/admin/query-monitor - Get query performance stats
export async function GET(request: NextRequest) {
  try {
    // Admin authentication
    const authResult = await requireAdminAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'stats':
        return NextResponse.json({
          success: true,
          data: queryMonitor.getStats()
        });

      case 'slow':
        const limit = parseInt(searchParams.get('limit') || '10');
        return NextResponse.json({
          success: true,
          data: queryMonitor.getSlowQueries(limit)
        });

      case 'frequent':
        const freqLimit = parseInt(searchParams.get('limit') || '10');
        return NextResponse.json({
          success: true,
          data: queryMonitor.getFrequentQueries(freqLimit)
        });

      case 'n1':
        return NextResponse.json({
          success: true,
          data: queryMonitor.detectN1Patterns()
        });

      case 'recommendations':
        return NextResponse.json({
          success: true,
          data: queryMonitor.getOptimizationRecommendations()
        });

      case 'health':
        const health = await optimizedDB.healthCheck();
        return NextResponse.json({
          success: true,
          data: health
        });

      case 'export':
        return NextResponse.json({
          success: true,
          data: queryMonitor.exportMetrics()
        });

      default:
        // Return comprehensive dashboard data
        const [stats, slowQueries, frequent, n1Patterns, recommendations, healthStatus] = await Promise.all([
          queryMonitor.getStats(),
          queryMonitor.getSlowQueries(5),
          queryMonitor.getFrequentQueries(5),
          queryMonitor.detectN1Patterns(),
          queryMonitor.getOptimizationRecommendations(),
          optimizedDB.healthCheck()
        ]);

        return NextResponse.json({
          success: true,
          data: {
            stats,
            slowQueries,
            frequentQueries: frequent,
            n1Patterns,
            recommendations,
            health: healthStatus
          }
        });
    }
  } catch (error) {
    logger.error('Query monitor error:', { error: error });
    return NextResponse.json(
      { success: false, error: 'Failed to fetch query metrics' },
      { status: 500 }
    );
  }
}

// POST /api/admin/query-monitor - Control monitoring
export async function POST(request: NextRequest) {
  try {
    // Admin authentication
    const authResult = await requireAdminAuth(request);
    if ('error' in authResult) {
      return authResult.error;
    }

    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'reset':
        queryMonitor.reset();
        return NextResponse.json({
          success: true,
          message: 'Query monitor stats reset'
        });

      case 'enable':
        queryMonitor.setMonitoring(true);
        return NextResponse.json({
          success: true,
          message: 'Query monitoring enabled'
        });

      case 'disable':
        queryMonitor.setMonitoring(false);
        return NextResponse.json({
          success: true,
          message: 'Query monitoring disabled'
        });

      case 'optimize-indexes':
        await optimizedDB.createOptimizedIndexes();
        return NextResponse.json({
          success: true,
          message: 'Database indexes optimized'
        });

      default:
        return NextResponse.json(
          { success: false, error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    logger.error('Query monitor control error:', { error: error });
    return NextResponse.json(
      { success: false, error: 'Failed to control query monitor' },
      { status: 500 }
    );
  }
}
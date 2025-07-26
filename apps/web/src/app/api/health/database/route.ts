/**
 * 🏥 Database Health Check API
 * GET /api/health/database
 */

import { NextResponse } from 'next/server';
import { db, dbConnectionManager } from '@/lib/database/connection-manager';
import { logger } from '@/lib/logging/logger';

export async function GET() {
  try {
    // Get pool statistics
    const stats = await db.getStats();
    
    // Perform health check
    const isHealthy = await db.healthCheck();
    
    // Calculate metrics
    const activeConnections = stats.status === 'active' 
      ? stats.totalCount - stats.idleCount 
      : 0;
    
    const utilizationPercent = stats.status === 'active' && stats.maxConnections > 0
      ? (activeConnections / stats.maxConnections) * 100
      : 0;
    
    // Determine health status
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    const issues: string[] = [];
    
    if (!isHealthy) {
      status = 'unhealthy';
      issues.push('Database connection failed');
    } else if (stats.status !== 'active') {
      status = 'unhealthy';
      issues.push('Connection pool not initialized');
    } else {
      if (utilizationPercent > 80) {
        status = 'degraded';
        issues.push(`High connection utilization: ${utilizationPercent.toFixed(1)}%`);
      }
      
      if (stats.waitingCount > 5) {
        status = 'degraded';
        issues.push(`${stats.waitingCount} connections waiting in queue`);
      }
      
      if (activeConnections === stats.maxConnections) {
        status = 'degraded';
        issues.push('Connection pool at maximum capacity');
      }
    }
    
    const response = {
      status,
      timestamp: new Date().toISOString(),
      database: {
        connected: isHealthy,
        pool: {
          status: stats.status,
          total: stats.totalCount,
          active: activeConnections,
          idle: stats.idleCount,
          waiting: stats.waitingCount,
          max: stats.maxConnections,
          utilization: parseFloat(utilizationPercent.toFixed(2)),
        },
      },
      issues,
      recommendations: getRecommendations(stats, utilizationPercent),
    };
    
    // Log health check
    if (status !== 'healthy') {
      logger.warn('Database health check failed', response);
    }
    
    return NextResponse.json(response, {
      status: status === 'healthy' ? 200 : status === 'degraded' ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
      },
    });
    
  } catch (error) {
    logger.error('Database health check error', { error });
    
    return NextResponse.json(
      {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        database: {
          connected: false,
          pool: { status: 'error' },
        },
        issues: ['Health check failed with error'],
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { 
        status: 503,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    );
  }
}

/**
 * Get recommendations based on pool stats
 */
function getRecommendations(
  stats: any, 
  utilizationPercent: number
): string[] {
  const recommendations: string[] = [];
  
  if (utilizationPercent > 80) {
    recommendations.push('Consider increasing DATABASE_POOL_MAX');
    recommendations.push('Check for connection leaks in application code');
  }
  
  if (stats.waitingCount > 0) {
    recommendations.push('Optimize slow queries to release connections faster');
    recommendations.push('Consider implementing query result caching');
  }
  
  if (stats.status === 'active' && stats.idleCount > stats.maxConnections * 0.8) {
    recommendations.push('Consider reducing DATABASE_POOL_MAX to save resources');
  }
  
  return recommendations;
}
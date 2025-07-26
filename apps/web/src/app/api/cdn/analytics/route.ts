/**
 * 🔥 CDN Analytics API Route - Elite Performance Monitoring
 * 
 * API endpoint for Cloudflare CDN analytics with:
 * - Real-time performance metrics
 * - Cache hit rate analysis
 * - Bandwidth savings
 * - Geographic distribution
 */

import { NextRequest, NextResponse } from 'next/server';
import { cloudflareCDNService } from '@/lib/services/cdn/cloudflare-service';
import { createClient } from '@supabase/supabase-js';
import { logger } from '@/lib/logging/logger';
import { ga4Service } from '@/lib/analytics/ga4-service';

export async function GET(request: NextRequest) {
  try {
    // Get auth token
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Missing authorization header' },
        { status: 401 }
      );
    }

    const token = authHeader.replace('Bearer ', '');

    // Verify user
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false
        }
      }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const timeRange = searchParams.get('timeRange') as 'hour' | 'day' | 'week' || 'hour';
    const includeHistory = searchParams.get('includeHistory') === 'true';

    // Get current metrics
    const metrics = await cloudflareCDNService.getPerformanceAnalytics(timeRange);

    // Get historical data if requested
    let history = null;
    if (includeHistory) {
      const { data: historicalData } = await supabase
        .from('cdn_analytics')
        .select('*')
        .order('timestamp', { ascending: false })
        .limit(100);
      
      history = historicalData || [];
    }

    // Calculate additional insights
    const insights = {
      costSavings: calculateCostSavings(metrics.bandwidthSaved),
      performanceGain: calculatePerformanceGain(metrics.cacheHitRate),
      globalReach: metrics.edgeLocations.length,
      healthStatus: getHealthStatus(metrics),
      recommendations: generateRecommendations(metrics)
    };

    // Track analytics access
    ga4Service.trackEvent('cdn_analytics_accessed', {
      user_id: user.id,
      time_range: timeRange,
      cache_hit_rate: metrics.cacheHitRate
    });

    return NextResponse.json({
      success: true,
      data: {
        current: metrics,
        insights,
        history,
        summary: {
          totalRequests: metrics.requestsServed,
          cacheHitRate: `${metrics.cacheHitRate.toFixed(2)}%`,
          bandwidthSaved: formatBytes(metrics.bandwidthSaved),
          avgResponseTime: `${metrics.averageResponseTime.toFixed(0)}ms`,
          topLocation: metrics.edgeLocations[0]?.location || 'N/A'
        }
      },
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('CDN analytics error:', error);
    
    return NextResponse.json(
      { error: 'Failed to fetch CDN analytics' },
      { status: 500 }
    );
  }
}

/**
 * Calculate cost savings from bandwidth
 */
function calculateCostSavings(bandwidthSaved: number): {
  amount: number;
  currency: string;
  period: string;
} {
  // Estimate $0.08 per GB for bandwidth costs
  const costPerGB = 0.08;
  const savedGB = bandwidthSaved / (1024 * 1024 * 1024);
  const savedAmount = savedGB * costPerGB;

  return {
    amount: Math.round(savedAmount * 100) / 100,
    currency: 'USD',
    period: 'selected period'
  };
}

/**
 * Calculate performance gain
 */
function calculatePerformanceGain(cacheHitRate: number): {
  percentage: number;
  impact: 'low' | 'medium' | 'high' | 'excellent';
  description: string;
} {
  let impact: 'low' | 'medium' | 'high' | 'excellent';
  let description: string;

  if (cacheHitRate >= 90) {
    impact = 'excellent';
    description = 'Outstanding cache performance';
  } else if (cacheHitRate >= 75) {
    impact = 'high';
    description = 'Good cache performance';
  } else if (cacheHitRate >= 50) {
    impact = 'medium';
    description = 'Moderate cache performance';
  } else {
    impact = 'low';
    description = 'Cache performance needs improvement';
  }

  return {
    percentage: cacheHitRate,
    impact,
    description
  };
}

/**
 * Get health status
 */
function getHealthStatus(metrics: any): {
  status: 'healthy' | 'warning' | 'critical';
  issues: string[];
} {
  const issues: string[] = [];
  let status: 'healthy' | 'warning' | 'critical' = 'healthy';

  // Check cache hit rate
  if (metrics.cacheHitRate < 50) {
    issues.push('Low cache hit rate');
    status = 'warning';
  }

  // Check response time
  if (metrics.averageResponseTime > 1000) {
    issues.push('High average response time');
    status = status === 'warning' ? 'critical' : 'warning';
  }

  // Check errors
  const totalErrors = metrics.errors.reduce((sum: number, e: any) => sum + e.count, 0);
  const errorRate = (totalErrors / metrics.requestsServed) * 100;
  if (errorRate > 5) {
    issues.push('High error rate');
    status = 'critical';
  }

  return { status, issues };
}

/**
 * Generate recommendations
 */
function generateRecommendations(metrics: any): string[] {
  const recommendations: string[] = [];

  // Cache hit rate recommendations
  if (metrics.cacheHitRate < 75) {
    recommendations.push('Consider increasing cache TTL for static assets');
    recommendations.push('Review cache headers on frequently accessed resources');
  }

  // Performance recommendations
  if (metrics.averageResponseTime > 500) {
    recommendations.push('Enable Cloudflare Argo for improved routing');
    recommendations.push('Consider using Cloudflare Workers for edge computing');
  }

  // Error recommendations
  const has5xxErrors = metrics.errors.some((e: any) => e.statusCode >= 500);
  if (has5xxErrors) {
    recommendations.push('Investigate origin server errors (5xx)');
    recommendations.push('Consider implementing better error handling');
  }

  // Bandwidth recommendations
  const topPaths = metrics.topPaths.slice(0, 3);
  const hasLargePaths = topPaths.some((p: any) => p.bandwidth > 1024 * 1024 * 100); // 100MB
  if (hasLargePaths) {
    recommendations.push('Consider optimizing large assets');
    recommendations.push('Enable Cloudflare Polish for automatic image optimization');
  }

  // Geographic recommendations
  if (metrics.edgeLocations.length < 5) {
    recommendations.push('Traffic is concentrated in few regions - consider global CDN features');
  }

  return recommendations.slice(0, 5); // Return top 5 recommendations
}

/**
 * Format bytes to human readable
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}
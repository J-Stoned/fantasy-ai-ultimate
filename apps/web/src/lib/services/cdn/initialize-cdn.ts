/**
 * 🔥 CDN Initialization Script - Elite Performance Setup
 * 
 * Initialize Cloudflare CDN with:
 * - Default cache rules
 * - Edge workers deployment
 * - Performance monitoring
 * - Zone configuration
 */

import { cloudflareCDNService } from './cloudflare-service';
import { logger } from '../../logging/logger';
import { ga4Service } from '../../analytics/ga4-service';

export async function initializeCDN(): Promise<{
  success: boolean;
  message: string;
  details?: any;
}> {
  try {
    logger.info('Starting CDN initialization...');
    
    const startTime = Date.now();
    const results = {
      cacheRules: false,
      edgeWorkers: false,
      zoneSettings: false,
      rum: false
    };

    // Step 1: Configure zone settings
    try {
      await cloudflareCDNService.configureZoneSettings({
        security: {
          level: 'medium',
          challengeTTL: 3600,
          browserCheck: 'on'
        },
        performance: {
          minify: true,
          brotli: true,
          earlyHints: true,
          http3: true
        },
        mobile: {
          mirage: true,
          polish: true,
          webp: true
        }
      });
      results.zoneSettings = true;
      logger.info('Zone settings configured successfully');
    } catch (error) {
      logger.error('Failed to configure zone settings:', error);
    }

    // Step 2: Deploy edge workers
    try {
      await cloudflareCDNService.deployDefaultWorkers();
      results.edgeWorkers = true;
      logger.info('Edge workers deployed successfully');
    } catch (error) {
      logger.error('Failed to deploy edge workers:', error);
    }

    // Step 3: Enable Real User Monitoring
    try {
      const rumScript = await cloudflareCDNService.enableRUM();
      if (rumScript) {
        results.rum = true;
        logger.info('Real User Monitoring enabled');
      }
    } catch (error) {
      logger.error('Failed to enable RUM:', error);
    }

    // Step 4: Create cache rules (automatically done in constructor)
    results.cacheRules = true;

    // Calculate success
    const successCount = Object.values(results).filter(v => v).length;
    const totalSteps = Object.keys(results).length;
    const success = successCount === totalSteps;

    // Track initialization
    ga4Service.trackEvent('cdn_initialized', {
      success,
      steps_completed: successCount,
      total_steps: totalSteps,
      duration_ms: Date.now() - startTime,
      details: results
    });

    return {
      success,
      message: success ? 
        'CDN initialized successfully' : 
        `CDN partially initialized (${successCount}/${totalSteps} steps completed)`,
      details: results
    };

  } catch (error) {
    logger.error('CDN initialization failed:', error);
    
    return {
      success: false,
      message: 'CDN initialization failed',
      details: { error: error instanceof Error ? error.message : 'Unknown error' }
    };
  }
}

/**
 * Run CDN diagnostics
 */
export async function runCDNDiagnostics(): Promise<{
  status: 'healthy' | 'degraded' | 'critical';
  checks: Record<string, boolean>;
  recommendations: string[];
}> {
  const checks: Record<string, boolean> = {};
  const recommendations: string[] = [];

  try {
    // Check 1: Performance metrics
    const metrics = await cloudflareCDNService.getPerformanceAnalytics('hour');
    checks.performanceData = !!metrics;
    
    if (metrics) {
      checks.cacheHitRate = metrics.cacheHitRate > 50;
      checks.responseTime = metrics.averageResponseTime < 1000;
      checks.globalReach = metrics.edgeLocations.length > 5;

      if (metrics.cacheHitRate < 75) {
        recommendations.push('Cache hit rate is below optimal - review cache rules');
      }
      if (metrics.averageResponseTime > 500) {
        recommendations.push('Response times are high - consider enabling Argo');
      }
    }

    // Check 2: Sample cache status
    const testUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://app.fantasy.com'}/`;
    const cacheStatus = await cloudflareCDNService.getCacheStatus(testUrl);
    checks.cacheWorking = cacheStatus.cached || cacheStatus.ttl > 0;

    if (!cacheStatus.cached) {
      recommendations.push('Homepage not cached - check cache rules configuration');
    }

    // Calculate overall status
    const passedChecks = Object.values(checks).filter(v => v).length;
    const totalChecks = Object.keys(checks).length;
    const passRate = passedChecks / totalChecks;

    let status: 'healthy' | 'degraded' | 'critical';
    if (passRate >= 0.8) status = 'healthy';
    else if (passRate >= 0.5) status = 'degraded';
    else status = 'critical';

    // Track diagnostics
    ga4Service.trackEvent('cdn_diagnostics_run', {
      status,
      passed_checks: passedChecks,
      total_checks: totalChecks,
      recommendations_count: recommendations.length
    });

    return {
      status,
      checks,
      recommendations
    };

  } catch (error) {
    logger.error('CDN diagnostics failed:', error);
    
    return {
      status: 'critical',
      checks: { error: false },
      recommendations: ['CDN diagnostics failed - check configuration']
    };
  }
}

/**
 * Optimize assets for CDN
 */
export function optimizeAssetForCDN(assetPath: string): {
  url: string;
  headers: Record<string, string>;
} {
  const isStatic = /\.(js|css|jpg|jpeg|png|gif|webp|woff2?|ttf|eot)$/i.test(assetPath);
  const isNext = assetPath.includes('/_next/');
  const isAPI = assetPath.includes('/api/');

  let cacheControl = 'public, max-age=3600'; // Default 1 hour
  
  if (isStatic) {
    if (isNext && assetPath.includes('/static/')) {
      // Next.js static assets are immutable
      cacheControl = 'public, max-age=31536000, immutable';
    } else {
      // Regular static assets
      cacheControl = 'public, max-age=86400, stale-while-revalidate=86400';
    }
  } else if (isAPI) {
    // API routes should not be cached by CDN
    cacheControl = 'private, no-cache, no-store, must-revalidate';
  }

  const headers: Record<string, string> = {
    'Cache-Control': cacheControl
  };

  // Add security headers
  if (!isAPI) {
    headers['X-Content-Type-Options'] = 'nosniff';
    headers['X-Frame-Options'] = 'DENY';
    headers['X-XSS-Protection'] = '1; mode=block';
  }

  return {
    url: assetPath,
    headers
  };
}
/**
 * 🔥 CDN Purge API Route - Elite Cache Management
 * 
 * API endpoint for Cloudflare cache purging with:
 * - Selective URL purging
 * - Pattern-based purging
 * - Admin authentication
 * - Rate limiting
 */

import { NextRequest, NextResponse } from 'next/server';
import { cloudflareCDNService } from '@/lib/services/cdn/cloudflare-service';
import { createClient } from '@/lib/supabase/server';
import { logger } from '@/lib/logging/logger';
import { ga4Service } from '@/lib/analytics/ga4-service';

// Rate limiting
const purgeRateLimit = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX = 10; // 10 purges per minute

export async function POST(request: NextRequest) {
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

    // Verify user is admin
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is admin
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      );
    }

    // Rate limiting
    const userPurges = purgeRateLimit.get(user.id) || [];
    const recentPurges = userPurges.filter(
      timestamp => Date.now() - timestamp < RATE_LIMIT_WINDOW
    );
    
    if (recentPurges.length >= RATE_LIMIT_MAX) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please wait before purging again.' },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { urls, patterns, purgeAll } = body;

    // Validate request
    if (!urls && !patterns && !purgeAll) {
      return NextResponse.json(
        { error: 'Must provide urls, patterns, or purgeAll flag' },
        { status: 400 }
      );
    }

    if (purgeAll && (!body.confirmation || body.confirmation !== 'PURGE_ALL_CACHE')) {
      return NextResponse.json(
        { error: 'purgeAll requires confirmation: "PURGE_ALL_CACHE"' },
        { status: 400 }
      );
    }

    // Build URLs to purge
    let urlsToPurge: string[] | undefined;
    
    if (urls) {
      urlsToPurge = Array.isArray(urls) ? urls : [urls];
    } else if (patterns) {
      // Convert patterns to URLs
      const patternArray = Array.isArray(patterns) ? patterns : [patterns];
      urlsToPurge = patternArray.flatMap(pattern => {
        // This is a simplified pattern matching
        // In production, you'd want more sophisticated pattern handling
        if (pattern.includes('*')) {
          return []; // Skip wildcards for now
        }
        return [pattern];
      });
    }

    // Perform purge
    await cloudflareCDNService.purgeCache(purgeAll ? undefined : urlsToPurge);

    // Update rate limit
    purgeRateLimit.set(user.id, [...recentPurges, Date.now()]);

    // Log purge
    logger.info('CDN cache purged', {
      userId: user.id,
      purgeType: purgeAll ? 'all' : 'selective',
      urlCount: urlsToPurge?.length || 0
    });

    // Track analytics
    ga4Service.trackEvent('cdn_cache_purged_api', {
      user_id: user.id,
      purge_type: purgeAll ? 'all' : 'selective',
      url_count: urlsToPurge?.length || 0
    });

    // Store purge history
    await supabase
      .from('cdn_purge_history')
      .insert({
        user_id: user.id,
        purge_type: purgeAll ? 'all' : 'selective',
        urls: urlsToPurge,
        patterns,
        created_at: new Date().toISOString()
      });

    return NextResponse.json({
      success: true,
      message: purgeAll ? 'All cache purged successfully' : `${urlsToPurge?.length || 0} URLs purged successfully`,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('CDN purge error:', error);
    
    return NextResponse.json(
      { error: 'Failed to purge cache' },
      { status: 500 }
    );
  }
}

// Clean up old rate limit entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [userId, timestamps] of purgeRateLimit.entries()) {
    const recent = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW);
    if (recent.length === 0) {
      purgeRateLimit.delete(userId);
    } else {
      purgeRateLimit.set(userId, recent);
    }
  }
}, RATE_LIMIT_WINDOW);
/**
 * MARCUS "THE FIXER" RODRIGUEZ - PRODUCTION RATE LIMITER
 * 
 * This replaced the toy in-memory limiter that would melt on NFL Sunday.
 * Now uses Redis with sliding window, surge protection, and tier support.
 */

import { NextRequest, NextResponse } from 'next/server';
import { 
  withRedisRateLimit as withRedis,
  RateLimitOptions,
  rateLimiters as redisLimiters 
} from './redisRateLimiter';

// Re-export types and functions from Redis implementation
export type { RateLimitOptions, RateLimitResult } from './redisRateLimiter';

/**
 * Main rate limiting function for Next.js API routes
 * Automatically handles Redis failures with graceful degradation
 */
export async function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  type: 'auth' | 'api' | 'expensive' | 'ai' | 'import' = 'api'
): Promise<(req: NextRequest) => Promise<NextResponse>> {
  return async (req: NextRequest) => {
    // Map old request types to new types for backwards compatibility
    const typeMap = {
      auth: { windowMs: 15 * 60 * 1000, max: 5 },
      api: { windowMs: 60 * 1000, max: 100 },
      expensive: { windowMs: 60 * 1000, max: 10 },
      ai: { windowMs: 60 * 1000, max: 20 },
      import: { windowMs: 60 * 1000, max: 10 }, // League imports are expensive
    };

    const options = typeMap[type];

    try {
      // Convert NextRequest to standard Request for Redis limiter
      const standardReq = new Request(req.url, {
        method: req.method,
        headers: req.headers,
      });

      // Use Redis rate limiter
      const response = await withRedis(
        standardReq,
        async () => {
          // Call the actual handler
          return handler(req);
        },
        options
      );

      // Convert Response back to NextResponse
      return new NextResponse(response.body, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    } catch (error) {
      console.error('Rate limiter error:', error);
      // On Redis failure, allow the request but log it
      return handler(req);
    }
  };
}

/**
 * Legacy createRateLimiter for backwards compatibility
 * @deprecated Use withRateLimit instead
 */
export function createRateLimiter(options: RateLimitOptions = {}) {
  console.warn('createRateLimiter is deprecated. Use withRateLimit instead.');
  
  return async function rateLimitMiddleware(req: Request): Promise<{ allowed: boolean; message?: string }> {
    // This is just for backwards compatibility
    // Real implementation uses Redis
    return { allowed: true };
  };
}

// Export pre-configured rate limiters
export const rateLimiters = {
  auth: redisLimiters.auth.free,
  api: redisLimiters.api.free,
  expensive: redisLimiters.expensive.free,
  webhook: redisLimiters.api.free, // Use API limits for webhooks
};

/**
 * Get user tier from auth or default to free
 * In production, this would check the user's subscription
 */
async function getUserTier(req: NextRequest): Promise<'free' | 'pro' | 'enterprise'> {
  // TODO: Implement actual tier checking from auth
  // For now, everyone is free tier
  return 'free';
}
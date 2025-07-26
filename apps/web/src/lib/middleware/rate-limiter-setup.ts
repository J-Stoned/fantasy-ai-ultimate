/**
 * 🚀 Rate Limiter Setup and Integration
 * Instructions and utilities for integrating rate limiting
 */

import { Express, Router } from 'express';
import {
  globalRateLimiter,
  endpointRateLimiter,
  apiKeyRateLimiter,
  burstLimiter,
  rateLimitInfo,
  rateLimitHeaders,
} from './rate-limiter';

/**
 * Apply rate limiting to Express app
 */
export function setupRateLimiting(app: Express) {
  // Add rate limit headers to all responses
  app.use(rateLimitHeaders);
  
  // Apply burst protection to all routes
  app.use('/api/', burstLimiter);
  
  // Apply global rate limiting by user tier
  app.use('/api/', globalRateLimiter);
  
  // Apply API key rate limiting for API routes
  app.use('/api/v1/', apiKeyRateLimiter);
  
  // Rate limit info endpoint
  app.get('/api/rate-limits', rateLimitInfo);
  
  // Apply endpoint-specific limits
  applyEndpointLimits(app);
}

/**
 * Apply endpoint-specific rate limits
 */
function applyEndpointLimits(app: Express) {
  // Authentication endpoints
  app.use('/api/auth/login', endpointRateLimiter('/api/auth/login'));
  app.use('/api/auth/register', endpointRateLimiter('/api/auth/register'));
  
  // Prediction endpoints
  app.use('/api/predictions', endpointRateLimiter('/api/predictions'));
  
  // Data export endpoints
  app.use('/api/data/export', endpointRateLimiter('/api/data/export'));
  
  // ML training endpoints
  app.use('/api/ml/train', endpointRateLimiter('/api/ml/train'));
}

/**
 * Create rate-limited router
 */
export function createRateLimitedRouter(
  basePath: string,
  limits?: {
    windowMs?: number;
    max?: number;
    message?: string;
  }
): Router {
  const router = Router();
  
  // Apply custom rate limit if provided
  if (limits) {
    const { createRateLimiter } = require('./rate-limiter');
    const limiter = createRateLimiter(
      {
        windowMs: limits.windowMs || 15 * 60 * 1000,
        max: limits.max || 100,
        message: limits.message,
      },
      `router:${basePath.replace(/\//g, '_')}`
    );
    router.use(limiter);
  }
  
  return router;
}

/**
 * Example Next.js API route with rate limiting
 */
export const nextJsRateLimitExample = `
// pages/api/example.ts or app/api/example/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { createRateLimiter } from '@/lib/middleware/rate-limiter';

const limiter = createRateLimiter({
  windowMs: 15 * 60 * 1000,
  max: 100,
}, 'api_example');

export async function GET(req: NextRequest) {
  // Check rate limit
  const rateLimitResult = await checkRateLimit(req);
  if (!rateLimitResult.success) {
    return NextResponse.json(
      { error: 'Rate limit exceeded' },
      { 
        status: 429,
        headers: {
          'Retry-After': rateLimitResult.retryAfter,
        },
      }
    );
  }
  
  // Your API logic here
  return NextResponse.json({ data: 'success' });
}
`;

/**
 * Rate limit check for Next.js
 */
export async function checkRateLimit(req: NextRequest): Promise<{
  success: boolean;
  limit?: number;
  remaining?: number;
  reset?: number;
  retryAfter?: string;
}> {
  // This is a simplified example
  // In production, integrate with Redis and proper rate limiting logic
  const identifier = req.ip || 'anonymous';
  
  // Mock implementation - replace with actual Redis logic
  return {
    success: true,
    limit: 100,
    remaining: 99,
    reset: Date.now() + 15 * 60 * 1000,
  };
}

/**
 * Rate limit decorator for class methods
 */
export function RateLimit(
  windowMs: number = 15 * 60 * 1000,
  max: number = 100
) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor
  ) {
    const originalMethod = descriptor.value;
    
    descriptor.value = async function (...args: any[]) {
      const [req] = args;
      
      // Check rate limit before executing method
      const key = req.user?.id || req.ip || 'unknown';
      // Add rate limit check logic here
      
      return originalMethod.apply(this, args);
    };
    
    return descriptor;
  };
}

/**
 * Integration examples for different frameworks
 */
export const INTEGRATION_EXAMPLES = {
  express: `
    const app = express();
    setupRateLimiting(app);
  `,
  
  nextjs: `
    // middleware.ts
    import { NextResponse } from 'next/server';
    import type { NextRequest } from 'next/server';
    
    export function middleware(request: NextRequest) {
      // Add rate limiting logic
      return NextResponse.next();
    }
    
    export const config = {
      matcher: '/api/:path*',
    };
  `,
  
  trpc: `
    // In your tRPC context
    const enforceRateLimit = async (ctx: Context) => {
      const result = await checkRateLimit(ctx.req);
      if (!result.success) {
        throw new TRPCError({
          code: 'TOO_MANY_REQUESTS',
          message: 'Rate limit exceeded',
        });
      }
    };
  `,
};

/**
 * Testing utilities
 */
export const testRateLimiter = {
  /**
   * Simulate multiple requests
   */
  async simulateRequests(
    endpoint: string,
    count: number,
    options?: {
      delay?: number;
      headers?: Record<string, string>;
    }
  ): Promise<Array<{ status: number; headers: any }>> {
    const results = [];
    
    for (let i = 0; i < count; i++) {
      if (options?.delay && i > 0) {
        await new Promise(resolve => setTimeout(resolve, options.delay));
      }
      
      const response = await fetch(endpoint, {
        headers: options?.headers,
      });
      
      results.push({
        status: response.status,
        headers: Object.fromEntries(response.headers.entries()),
      });
    }
    
    return results;
  },
  
  /**
   * Check rate limit headers
   */
  parseRateLimitHeaders(headers: any) {
    return {
      limit: parseInt(headers['x-ratelimit-limit'] || '0'),
      remaining: parseInt(headers['x-ratelimit-remaining'] || '0'),
      reset: parseInt(headers['x-ratelimit-reset'] || '0'),
      retryAfter: headers['retry-after'],
    };
  },
};
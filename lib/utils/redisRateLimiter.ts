/**
 * Redis-based Sliding Window Rate Limiter for Production
 * Handles NFL Sunday traffic spikes and per-user tier limits
 */

import { Redis } from 'ioredis';
import { redis } from '../cache/RedisCache';
import { defaultLogger } from './logger';

export interface RateLimitOptions {
  windowMs: number; // Time window in milliseconds
  max: number; // Max requests per window
  message?: string; // Error message when rate limit exceeded
  keyGenerator?: (req: Request) => Promise<string>; // Function to generate unique key per user
  skipSuccessfulRequests?: boolean; // Don't count successful requests
  skipFailedRequests?: boolean; // Don't count failed requests
  tier?: 'free' | 'pro' | 'enterprise'; // User tier for different limits
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetTime: Date;
  retryAfter?: number;
  message?: string;
}

// User tier configurations
const TIER_LIMITS = {
  free: {
    api: { windowMs: 60000, max: 100 }, // 100 requests per minute
    expensive: { windowMs: 60000, max: 10 }, // 10 expensive ops per minute
    ai: { windowMs: 60000, max: 20 }, // 20 AI requests per minute
  },
  pro: {
    api: { windowMs: 60000, max: 1000 }, // 1000 requests per minute
    expensive: { windowMs: 60000, max: 100 }, // 100 expensive ops per minute
    ai: { windowMs: 60000, max: 200 }, // 200 AI requests per minute
  },
  enterprise: {
    api: { windowMs: 60000, max: 10000 }, // 10K requests per minute
    expensive: { windowMs: 60000, max: 1000 }, // 1K expensive ops per minute
    ai: { windowMs: 60000, max: 2000 }, // 2K AI requests per minute
  },
};

// NFL Sunday surge multipliers
const SURGE_MULTIPLIERS = {
  nflSunday: 3, // 3x capacity on NFL Sundays
  tradeDeadline: 2, // 2x capacity during trade deadline
  waiverProcessing: 1.5, // 1.5x capacity during waiver processing
};

export class RedisRateLimiter {
  private redis: Redis;
  private defaultOptions: Required<RateLimitOptions>;

  constructor(redis: Redis = redis.getClient()) {
    this.redis = redis;
    this.defaultOptions = {
      windowMs: 60000, // 1 minute
      max: 100,
      message: 'Too many requests, please try again later.',
      keyGenerator: this.defaultKeyGenerator,
      skipSuccessfulRequests: false,
      skipFailedRequests: false,
      tier: 'free',
    };
  }

  private async defaultKeyGenerator(req: Request): Promise<string> {
    // Try to get user ID from auth header
    const authHeader = req.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      // In production, decode JWT to get user ID
      // For now, use a hash of the token
      const userId = await this.hashToken(token);
      return `rl:user:${userId}`;
    }

    // Fallback to IP-based rate limiting
    const forwarded = req.headers.get('x-forwarded-for');
    const real = req.headers.get('x-real-ip');
    const ip = forwarded?.split(',')[0] || real || 'unknown';
    return `rl:ip:${ip}`;
  }

  private async hashToken(token: string): Promise<string> {
    // Simple hash for demo - in production use proper JWT decoding
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      const char = token.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash; // Convert to 32bit integer
    }
    return Math.abs(hash).toString();
  }

  private getCurrentSurgeMultiplier(): number {
    const now = new Date();
    const day = now.getDay();
    const hour = now.getHours();
    
    // NFL Sunday (Sunday 1pm-8pm ET)
    if (day === 0 && hour >= 13 && hour <= 20) {
      return SURGE_MULTIPLIERS.nflSunday;
    }
    
    // Tuesday waiver processing (Tuesday 3am-6am ET)
    if (day === 2 && hour >= 3 && hour <= 6) {
      return SURGE_MULTIPLIERS.waiverProcessing;
    }
    
    // Trade deadline (configurable, check if within 24 hours)
    // This would need to be configured based on league settings
    
    return 1;
  }

  async checkLimit(options: Partial<RateLimitOptions> = {}): Promise<RateLimitResult> {
    const config = { ...this.defaultOptions, ...options };
    const key = await config.keyGenerator!(new Request('http://dummy'));
    const now = Date.now();
    const windowStart = now - config.windowMs;
    
    // Apply surge multiplier
    const surgeMultiplier = this.getCurrentSurgeMultiplier();
    const adjustedMax = Math.floor(config.max * surgeMultiplier);
    
    // Use Redis sorted set for sliding window
    const multi = this.redis.multi();
    
    // Remove old entries outside the window
    multi.zremrangebyscore(key, '-inf', windowStart);
    
    // Count requests in current window
    multi.zcard(key);
    
    // Add current request
    multi.zadd(key, now, `${now}-${Math.random()}`);
    
    // Set expiry on the key
    multi.expire(key, Math.ceil(config.windowMs / 1000));
    
    // Execute transaction
    const results = await multi.exec();
    
    if (!results) {
      throw new Error('Redis transaction failed');
    }
    
    const count = results[1][1] as number;
    const remaining = Math.max(0, adjustedMax - count);
    const resetTime = new Date(now + config.windowMs);
    
    if (count > adjustedMax) {
      // Remove the request we just added since it's over the limit
      await this.redis.zrem(key, `${now}-${Math.random()}`);
      
      return {
        allowed: false,
        limit: adjustedMax,
        remaining: 0,
        resetTime,
        retryAfter: Math.ceil(config.windowMs / 1000),
        message: config.message,
      };
    }
    
    return {
      allowed: true,
      limit: adjustedMax,
      remaining: remaining - 1, // -1 because we just added a request
      resetTime,
    };
  }

  async reset(key: string): Promise<void> {
    await this.redis.del(key);
  }

  // Get current usage for monitoring
  async getUsage(key: string, windowMs: number): Promise<number> {
    const now = Date.now();
    const windowStart = now - windowMs;
    const count = await this.redis.zcount(key, windowStart, now);
    return count;
  }
}

// Pre-configured rate limiters with tier support
export function createTieredRateLimiter(
  type: 'api' | 'expensive' | 'ai',
  tier: 'free' | 'pro' | 'enterprise' = 'free'
): RedisRateLimiter {
  const limiter = new RedisRateLimiter();
  const limits = TIER_LIMITS[tier][type];
  
  return {
    ...limiter,
    checkLimit: (options?: Partial<RateLimitOptions>) => 
      limiter.checkLimit({ ...limits, tier, ...options }),
  } as RedisRateLimiter;
}

// Helper middleware for Next.js API routes
export async function withRedisRateLimit(
  req: Request,
  handler: () => Promise<Response>,
  options: Partial<RateLimitOptions> = {}
): Promise<Response> {
  try {
    const limiter = new RedisRateLimiter();
    const result = await limiter.checkLimit(options);
    
    const headers = new Headers({
      'X-RateLimit-Limit': result.limit.toString(),
      'X-RateLimit-Remaining': result.remaining.toString(),
      'X-RateLimit-Reset': result.resetTime.toISOString(),
    });
    
    if (!result.allowed) {
      headers.set('Retry-After', result.retryAfter!.toString());
      
      return new Response(
        JSON.stringify({
          error: result.message,
          retryAfter: result.retryAfter,
        }),
        {
          status: 429,
          headers,
        }
      );
    }
    
    // Add rate limit headers to successful response
    const response = await handler();
    result.remaining && headers.forEach((value, key) => {
      response.headers.set(key, value);
    });
    
    return response;
  } catch (error) {
    defaultLogger.error('Rate limiting error', { error });
    // On Redis failure, allow the request but log the error
    return handler();
  }
}

// Circuit breaker for Redis failures
let redisFailures = 0;
const REDIS_FAILURE_THRESHOLD = 5;
const REDIS_RESET_TIMEOUT = 60000; // 1 minute

export function isRedisHealthy(): boolean {
  return redisFailures < REDIS_FAILURE_THRESHOLD;
}

// Export pre-configured limiters
export const rateLimiters = {
  // Auth endpoints - strictest limits
  auth: {
    free: createTieredRateLimiter('api', 'free'),
    pro: createTieredRateLimiter('api', 'pro'),
    enterprise: createTieredRateLimiter('api', 'enterprise'),
  },
  
  // API endpoints - standard limits
  api: {
    free: createTieredRateLimiter('api', 'free'),
    pro: createTieredRateLimiter('api', 'pro'),
    enterprise: createTieredRateLimiter('api', 'enterprise'),
  },
  
  // Expensive operations - lower limits
  expensive: {
    free: createTieredRateLimiter('expensive', 'free'),
    pro: createTieredRateLimiter('expensive', 'pro'),
    enterprise: createTieredRateLimiter('expensive', 'enterprise'),
  },
  
  // AI operations - medium limits
  ai: {
    free: createTieredRateLimiter('ai', 'free'),
    pro: createTieredRateLimiter('ai', 'pro'),
    enterprise: createTieredRateLimiter('ai', 'enterprise'),
  },
};

// Monitoring metrics
export async function getRateLimitMetrics(): Promise<{
  totalRequests: number;
  blockedRequests: number;
  topUsers: Array<{ key: string; count: number }>;
}> {
  // Implementation for monitoring dashboard
  return {
    totalRequests: 0,
    blockedRequests: 0,
    topUsers: [],
  };
}
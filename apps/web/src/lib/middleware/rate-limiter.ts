/**
 * 🛡️ API Rate Limiting Middleware
 * Enterprise-grade rate limiting with Redis support
 */

import rateLimit, { Options, RateLimitRequestHandler } from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { Request, Response } from 'express';
import { container } from '../di/container';
import { SERVICE_TOKENS } from '../di/interfaces';
import { captureError, ErrorSeverity } from '../errors/sentry-handler';

interface RateLimitConfig {
  windowMs: number;
  max: number;
  message?: string;
  standardHeaders?: boolean;
  legacyHeaders?: boolean;
  skipSuccessfulRequests?: boolean;
  skipFailedRequests?: boolean;
  keyGenerator?: (req: Request) => string;
}

interface RateLimitTier {
  free: RateLimitConfig;
  pro: RateLimitConfig;
  enterprise: RateLimitConfig;
  api: RateLimitConfig;
}

/**
 * Rate limit configurations by tier
 */
const RATE_LIMIT_TIERS: RateLimitTier = {
  free: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests. Please upgrade your plan for higher limits.',
  },
  pro: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 1000, // 1000 requests per window
    message: 'Rate limit exceeded. Please try again later.',
  },
  enterprise: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10000, // 10000 requests per window
    message: 'Rate limit exceeded. Contact support for custom limits.',
  },
  api: {
    windowMs: 1 * 60 * 1000, // 1 minute
    max: 60, // 60 requests per minute
    message: 'API rate limit exceeded. Please reduce request frequency.',
  },
};

/**
 * Endpoint-specific rate limits
 */
const ENDPOINT_LIMITS: Record<string, RateLimitConfig> = {
  '/api/auth/login': {
    windowMs: 15 * 60 * 1000,
    max: 5, // 5 login attempts per 15 minutes
    message: 'Too many login attempts. Please try again later.',
    skipSuccessfulRequests: true,
  },
  '/api/auth/register': {
    windowMs: 60 * 60 * 1000,
    max: 3, // 3 registration attempts per hour
    message: 'Too many registration attempts. Please try again later.',
  },
  '/api/predictions': {
    windowMs: 1 * 60 * 1000,
    max: 30, // 30 predictions per minute
    message: 'Prediction rate limit exceeded. Please slow down.',
  },
  '/api/data/export': {
    windowMs: 60 * 60 * 1000,
    max: 10, // 10 exports per hour
    message: 'Export rate limit exceeded. Please try again later.',
  },
  '/api/ml/train': {
    windowMs: 24 * 60 * 60 * 1000,
    max: 5, // 5 training jobs per day
    message: 'ML training rate limit exceeded. Please try again tomorrow.',
  },
};

/**
 * Get user tier from request
 */
function getUserTier(req: Request): keyof RateLimitTier {
  const user = (req as any).user;
  if (!user) return 'free';
  
  // Check user subscription tier
  const tier = user.subscriptionTier || 'free';
  return tier as keyof RateLimitTier;
}

/**
 * Generate rate limit key
 */
function generateKey(req: Request): string {
  const user = (req as any).user;
  
  // Use user ID if authenticated
  if (user?.id) {
    return `user:${user.id}`;
  }
  
  // Use API key if present
  const apiKey = req.headers['x-api-key'] as string;
  if (apiKey) {
    return `api:${apiKey}`;
  }
  
  // Fall back to IP address
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  return `ip:${ip}`;
}

/**
 * Create rate limiter with Redis store
 */
export function createRateLimiter(
  config: RateLimitConfig,
  storeName: string
): RateLimitRequestHandler {
  const logger = container.resolve(SERVICE_TOKENS.Logger);
  const redisUrl = process.env.REDIS_URL;
  
  const options: Partial<Options> = {
    windowMs: config.windowMs,
    max: config.max,
    message: config.message || 'Too many requests, please try again later.',
    standardHeaders: config.standardHeaders !== false,
    legacyHeaders: config.legacyHeaders !== false,
    skipSuccessfulRequests: config.skipSuccessfulRequests || false,
    skipFailedRequests: config.skipFailedRequests || false,
    keyGenerator: config.keyGenerator || generateKey,
    handler: (req: Request, res: Response) => {
      const key = generateKey(req);
      logger.warn('Rate limit exceeded', {
        key,
        endpoint: req.path,
        method: req.method,
        userAgent: req.headers['user-agent'],
      });
      
      // Track in Sentry
      captureError(new Error('Rate limit exceeded'), {
        level: ErrorSeverity.Warning,
        user: (req as any).user,
        extra: {
          endpoint: req.path,
          key,
        },
      });
      
      res.status(429).json({
        error: 'rate_limit_exceeded',
        message: config.message,
        retryAfter: res.getHeader('Retry-After'),
      });
    },
  };
  
  // Use Redis store in production
  if (redisUrl && process.env.NODE_ENV === 'production') {
    try {
      options.store = new RedisStore({
        // @ts-expect-error - Redis client types
        client: require('redis').createClient({ url: redisUrl }),
        prefix: `rl:${storeName}:`,
      });
    } catch (error) {
      logger.error('Failed to create Redis rate limit store', error);
      captureError(error as Error, {
        level: ErrorSeverity.Error,
        extra: { storeName },
      });
    }
  }
  
  return rateLimit(options as Options);
}

/**
 * Global rate limiter by user tier
 */
export const globalRateLimiter = (req: Request, res: Response, next: Function) => {
  const tier = getUserTier(req);
  const config = RATE_LIMIT_TIERS[tier];
  const limiter = createRateLimiter(config, `global:${tier}`);
  limiter(req, res, next);
};

/**
 * Endpoint-specific rate limiter
 */
export const endpointRateLimiter = (endpoint: string) => {
  const config = ENDPOINT_LIMITS[endpoint];
  if (!config) {
    return (_req: Request, _res: Response, next: Function) => next();
  }
  
  return createRateLimiter(config, `endpoint:${endpoint.replace(/\//g, '_')}`);
};

/**
 * API key rate limiter
 */
export const apiKeyRateLimiter = createRateLimiter(
  RATE_LIMIT_TIERS.api,
  'api_key'
);

/**
 * Burst protection limiter
 */
export const burstLimiter = createRateLimiter({
  windowMs: 1000, // 1 second
  max: 10, // 10 requests per second max
  message: 'Request rate too high. Please slow down.',
  skipSuccessfulRequests: false,
  skipFailedRequests: false,
}, 'burst');

/**
 * Rate limit info endpoint
 */
export function rateLimitInfo(req: Request, res: Response) {
  const tier = getUserTier(req);
  const config = RATE_LIMIT_TIERS[tier];
  
  res.json({
    tier,
    limits: {
      requests: config.max,
      window: config.windowMs / 1000 / 60, // Convert to minutes
      windowUnit: 'minutes',
    },
    endpoints: Object.entries(ENDPOINT_LIMITS).map(([endpoint, limit]) => ({
      endpoint,
      requests: limit.max,
      window: limit.windowMs / 1000 / 60,
      windowUnit: 'minutes',
    })),
    headers: {
      limit: 'X-RateLimit-Limit',
      remaining: 'X-RateLimit-Remaining',
      reset: 'X-RateLimit-Reset',
      retryAfter: 'Retry-After',
    },
  });
}

/**
 * Reset rate limit for a specific key
 */
export async function resetRateLimit(key: string): Promise<boolean> {
  const logger = container.resolve(SERVICE_TOKENS.Logger);
  const redisUrl = process.env.REDIS_URL;
  
  if (!redisUrl || process.env.NODE_ENV !== 'production') {
    logger.warn('Cannot reset rate limit without Redis');
    return false;
  }
  
  try {
    const redis = require('redis').createClient({ url: redisUrl });
    await redis.connect();
    
    // Delete all rate limit keys for this user/IP
    const keys = await redis.keys(`rl:*:${key}`);
    if (keys.length > 0) {
      await redis.del(...keys);
    }
    
    await redis.disconnect();
    logger.info('Rate limit reset', { key });
    return true;
  } catch (error) {
    logger.error('Failed to reset rate limit', error);
    captureError(error as Error, {
      level: ErrorSeverity.Error,
      extra: { key },
    });
    return false;
  }
}

/**
 * Middleware to add rate limit headers
 */
export function rateLimitHeaders(req: Request, res: Response, next: Function) {
  // Add rate limit info to response headers
  const originalSend = res.send;
  res.send = function(data: any) {
    // Add custom headers if rate limit info is available
    const limit = res.getHeader('X-RateLimit-Limit');
    if (limit) {
      res.setHeader('X-Rate-Limit-Tier', getUserTier(req));
    }
    return originalSend.call(this, data);
  };
  next();
}

export default {
  globalRateLimiter,
  endpointRateLimiter,
  apiKeyRateLimiter,
  burstLimiter,
  rateLimitInfo,
  resetRateLimit,
  rateLimitHeaders,
  createRateLimiter,
};
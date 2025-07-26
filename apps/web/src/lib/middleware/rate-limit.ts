/**
 * 🛡️ RATE LIMITING MIDDLEWARE 🛡️
 * Enterprise-grade API protection with DDoS defense
 */

import { NextRequest, NextResponse } from 'next/server';
import { rateLimiter, RateLimitConfig, determineTier } from '@/lib/services/rate-limiter';
import { getAuth } from '@/lib/auth';
import { logger } from '../logging/logger';

// Endpoint category mapping
const ENDPOINT_CATEGORIES: Record<string, keyof typeof RateLimitConfig> = {
  // Admin routes
  '/api/admin': 'admin',
  '/api/ml-training': 'admin',
  '/api/system': 'admin',
  
  // Financial/trading routes
  '/api/bankroll': 'financial',
  '/api/trades': 'financial',
  '/api/ownership': 'financial',
  
  // ML prediction routes
  '/api/predictions': 'ml',
  '/api/ml': 'ml',
  '/api/projections': 'ml',
  
  // Contest routes
  '/api/contests': 'contest',
  '/api/lineups': 'contest',
  '/api/draft': 'contest',
  
  // Auth routes
  '/api/auth': 'auth',
  '/api/login': 'auth',
  '/api/register': 'auth',
  
  // Public routes (default)
  '/api': 'public'
};

// Headers to include in rate limit response
const RATE_LIMIT_HEADERS = {
  'X-RateLimit-Limit': 'limit',
  'X-RateLimit-Remaining': 'remaining',
  'X-RateLimit-Reset': 'reset',
  'Retry-After': 'retryAfter'
} as const;

// Error response templates
const ERROR_RESPONSES = {
  rateLimitExceeded: {
    error: 'TOO_MANY_REQUESTS',
    message: 'Rate limit exceeded. Please try again later.',
    statusCode: 429
  },
  blocked: {
    error: 'FORBIDDEN',
    message: 'Access denied due to suspicious activity.',
    statusCode: 403
  },
  ddosDetected: {
    error: 'BAD_REQUEST',
    message: 'Request blocked due to security concerns.',
    statusCode: 400
  }
} as const;

/**
 * Extract client identifier from request
 */
function extractIdentifier(req: NextRequest): {
  ip: string;
  userId?: string;
  apiKey?: string;
  fingerprint?: string;
} {
  // Get IP address (handle proxies)
  const forwarded = req.headers.get('x-forwarded-for');
  const ip = forwarded?.split(',')[0].trim() || 
             req.headers.get('x-real-ip') ||
             req.ip ||
             '127.0.0.1';
  
  // Get user ID from auth token
  const authHeader = req.headers.get('authorization');
  let userId: string | undefined;
  
  if (authHeader?.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      // Use proper JWT verification
      const { extractUserIdFromJWT } = await import('@/lib/auth/jwt-verify');
      userId = await extractUserIdFromJWT(token);
    } catch (error) {
      // Invalid token, ignore
    }
  }
  
  // Get API key
  const apiKey = req.headers.get('x-api-key') || undefined;
  
  // Generate fingerprint from stable request characteristics
  const fingerprint = generateFingerprint(req);
  
  return { ip, userId, apiKey, fingerprint };
}

/**
 * Generate a fingerprint for anonymous users
 */
function generateFingerprint(req: NextRequest): string {
  const components = [
    req.headers.get('user-agent') || '',
    req.headers.get('accept-language') || '',
    req.headers.get('accept-encoding') || '',
    // Add more stable characteristics as needed
  ];
  
  // Simple hash for demo - use proper hashing in production
  return components.join('|').substring(0, 32);
}

/**
 * Determine endpoint category from path
 */
function getEndpointCategory(path: string): keyof typeof RateLimitConfig {
  // Find the most specific matching category
  const sortedPaths = Object.keys(ENDPOINT_CATEGORIES).sort(
    (a, b) => b.length - a.length
  );
  
  for (const prefix of sortedPaths) {
    if (path.startsWith(prefix)) {
      return ENDPOINT_CATEGORIES[prefix];
    }
  }
  
  return 'public';
}

/**
 * Main rate limiting middleware
 */
export async function rateLimitMiddleware(
  req: NextRequest,
  options?: {
    category?: keyof typeof RateLimitConfig;
    skipAuth?: boolean;
    customLimits?: Record<string, number>;
  }
): Promise<NextResponse | null> {
  try {
    // Extract identifiers
    const identifier = extractIdentifier(req);
    
    // Check DDoS patterns first
    const ddosCheck = await rateLimiter.checkDDoSPatterns({
      body: await req.json().catch(() => ({})),
      headers: Object.fromEntries(req.headers.entries()),
      ip: identifier.ip,
      path: req.nextUrl.pathname
    });
    
    if (ddosCheck.blocked) {
      logger.warn('DDoS pattern detected: ${identifier.ip} - ${ddosCheck.reason}');
      return NextResponse.json(
        {
          ...ERROR_RESPONSES.ddosDetected,
          reason: ddosCheck.reason
        },
        { status: 400 }
      );
    }
    
    // Determine endpoint category
    const category = options?.category || getEndpointCategory(req.nextUrl.pathname);
    
    // Get user context for tier determination
    let userContext: any = {};
    if (!options?.skipAuth && (identifier.userId || identifier.apiKey)) {
      try {
        // Get user details for tier determination
        // This would typically query your database
        userContext = await getUserContext(identifier.userId, identifier.apiKey);
      } catch (error) {
        logger.error('Failed to get user context:', { error: error });
      }
    }
    
    // Determine rate limit tier
    const tier = determineTier(userContext);
    
    // Check rate limit
    const result = await rateLimiter.checkLimit(category, tier, identifier);
    
    // Create response headers
    const headers = new Headers();
    headers.set(RATE_LIMIT_HEADERS['X-RateLimit-Limit'], result.limit.toString());
    headers.set(RATE_LIMIT_HEADERS['X-RateLimit-Remaining'], result.remaining.toString());
    headers.set(RATE_LIMIT_HEADERS['X-RateLimit-Reset'], result.reset.toString());
    
    if (!result.allowed) {
      // Rate limit exceeded
      if (result.retryAfter) {
        headers.set(RATE_LIMIT_HEADERS['Retry-After'], result.retryAfter.toString());
      }
      
      return NextResponse.json(
        ERROR_RESPONSES.rateLimitExceeded,
        { status: 429, headers }
      );
    }
    
    // Add rate limit headers to successful responses
    // This will be handled by modifying the response after the handler
    (req as any).rateLimitHeaders = headers;
    
    // Request allowed
    return null;
    
  } catch (error) {
    logger.error('Rate limiting error:', { error: error });
    // Fail open - allow request if rate limiting fails
    return null;
  }
}

/**
 * Create rate limit middleware with custom options
 */
export function createRateLimitMiddleware(
  category: keyof typeof RateLimitConfig,
  options?: {
    skipAuth?: boolean;
    customLimits?: Record<string, number>;
  }
) {
  return (req: NextRequest) => rateLimitMiddleware(req, { category, ...options });
}

/**
 * Apply rate limit headers to response
 */
export function applyRateLimitHeaders(
  res: NextResponse,
  req: NextRequest
): NextResponse {
  const headers = (req as any).rateLimitHeaders;
  if (headers) {
    headers.forEach((value: string, key: string) => {
      res.headers.set(key, value);
    });
  }
  return res;
}

/**
 * Get user context for tier determination (placeholder)
 */
async function getUserContext(
  userId?: string,
  apiKey?: string
): Promise<any> {
  // This would typically query your database
  // Placeholder implementation
  if (userId === 'admin-user-id') {
    return { user: { id: userId, role: 'admin' } };
  }
  
  if (apiKey?.startsWith('premium-')) {
    return { apiKey: { tier: 'premium' } };
  }
  
  if (userId) {
    return { user: { id: userId } };
  }
  
  if (apiKey) {
    return { apiKey: { tier: 'authenticated' } };
  }
  
  return {};
}

// Export convenience middlewares for common categories
export const adminRateLimit = createRateLimitMiddleware('admin');
export const financialRateLimit = createRateLimitMiddleware('financial');
export const mlRateLimit = createRateLimitMiddleware('ml');
export const contestRateLimit = createRateLimitMiddleware('contest');
export const authRateLimit = createRateLimitMiddleware('auth');
export const publicRateLimit = createRateLimitMiddleware('public');
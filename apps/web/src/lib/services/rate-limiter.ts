/**
 * 🛡️ ENTERPRISE RATE LIMITING SERVICE 🛡️
 * Advanced DDoS protection and API rate limiting
 * Features: Multi-tier limits, sliding windows, distributed tracking
 */

import { redisCluster } from './redis-cluster';
import { createHash } from 'crypto';

// Rate limit tiers with different quotas
export enum RateLimitTier {
  PUBLIC = 'public',
  AUTHENTICATED = 'authenticated',
  PREMIUM = 'premium',
  ADMIN = 'admin',
  UNLIMITED = 'unlimited'
}

// Rate limit configurations per endpoint category
export const RateLimitConfig = {
  // Admin endpoints - most restrictive
  admin: {
    [RateLimitTier.ADMIN]: { requests: 10, window: 60 }, // 10 req/min
    [RateLimitTier.UNLIMITED]: { requests: -1, window: 60 }
  },
  
  // Financial/trading endpoints
  financial: {
    [RateLimitTier.PUBLIC]: { requests: 10, window: 60 }, // 10 req/min
    [RateLimitTier.AUTHENTICATED]: { requests: 30, window: 60 }, // 30 req/min
    [RateLimitTier.PREMIUM]: { requests: 100, window: 60 }, // 100 req/min
    [RateLimitTier.UNLIMITED]: { requests: -1, window: 60 }
  },
  
  // ML prediction endpoints
  ml: {
    [RateLimitTier.PUBLIC]: { requests: 20, window: 3600 }, // 20 req/hour
    [RateLimitTier.AUTHENTICATED]: { requests: 100, window: 3600 }, // 100 req/hour
    [RateLimitTier.PREMIUM]: { requests: 500, window: 3600 }, // 500 req/hour
    [RateLimitTier.UNLIMITED]: { requests: -1, window: 3600 }
  },
  
  // Contest submission endpoints
  contest: {
    [RateLimitTier.PUBLIC]: { requests: 0, window: 60 }, // Not allowed
    [RateLimitTier.AUTHENTICATED]: { requests: 50, window: 60 }, // 50 req/min
    [RateLimitTier.PREMIUM]: { requests: 200, window: 60 }, // 200 req/min
    [RateLimitTier.UNLIMITED]: { requests: -1, window: 60 }
  },
  
  // Public API endpoints
  public: {
    [RateLimitTier.PUBLIC]: { requests: 60, window: 60 }, // 60 req/min
    [RateLimitTier.AUTHENTICATED]: { requests: 120, window: 60 }, // 120 req/min
    [RateLimitTier.PREMIUM]: { requests: 300, window: 60 }, // 300 req/min
    [RateLimitTier.UNLIMITED]: { requests: -1, window: 60 }
  },
  
  // Authentication endpoints
  auth: {
    [RateLimitTier.PUBLIC]: { requests: 5, window: 900 }, // 5 attempts/15 min
    [RateLimitTier.AUTHENTICATED]: { requests: 10, window: 900 }, // 10 attempts/15 min
    [RateLimitTier.UNLIMITED]: { requests: -1, window: 900 }
  }
} as const;

// DDoS protection thresholds
export const DDoSProtection = {
  // Request size limits (in bytes)
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  maxJsonSize: 1 * 1024 * 1024, // 1MB
  
  // Connection limits
  maxConnectionsPerIP: 100,
  connectionTimeout: 30000, // 30 seconds
  
  // Pattern detection - temporarily simplified
  suspiciousPatterns: [
    /../, // Basic pattern
  ],
  
  // Automatic blocking
  blockDuration: 3600, // 1 hour
  blockThreshold: 10, // violations before blocking
} as const;

interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number;
  retryAfter?: number;
}

interface RateLimitIdentifier {
  ip?: string;
  userId?: string;
  apiKey?: string;
  fingerprint?: string;
}

export class RateLimiter {
  private readonly prefix = 'ratelimit:';
  private readonly blocklistPrefix = 'blocklist:';
  private readonly violationPrefix = 'violation:';
  
  /**
   * Check if a request is allowed based on rate limits
   */
  async checkLimit(
    endpoint: keyof typeof RateLimitConfig,
    tier: RateLimitTier,
    identifier: RateLimitIdentifier
  ): Promise<RateLimitResult> {
    // Check if IP is blocked
    if (identifier.ip && await this.isBlocked(identifier.ip)) {
      return {
        allowed: false,
        limit: 0,
        remaining: 0,
        reset: Date.now() + DDoSProtection.blockDuration * 1000,
        retryAfter: DDoSProtection.blockDuration
      };
    }
    
    const config = RateLimitConfig[endpoint]?.[tier];
    if (!config) {
      throw new Error(`Invalid rate limit configuration: ${endpoint}/${tier}`);
    }
    
    // Unlimited tier bypasses rate limiting
    if (config.requests === -1) {
      return {
        allowed: true,
        limit: -1,
        remaining: -1,
        reset: 0
      };
    }
    
    // Generate unique key for this rate limit
    const key = this.generateKey(endpoint, tier, identifier);
    const now = Date.now();
    const windowStart = now - (config.window * 1000);
    
    // Sliding window implementation using Redis sorted sets
    const pipe = await redisCluster.pipeline([
      ['zremrangebyscore', key, '-inf', windowStart],
      ['zadd', key, now, `${now}-${Math.random()}`],
      ['zcard', key],
      ['expire', key, config.window + 1]
    ]);
    
    const [, , count] = pipe;
    const currentCount = count as number;
    
    if (currentCount > config.requests) {
      // Rate limit exceeded
      await this.recordViolation(identifier);
      
      // Get oldest request in window to calculate retry time
      const oldestRequest = await redisCluster.get<number>(
        `${key}:oldest`
      ) || windowStart;
      
      const retryAfter = Math.ceil(
        (oldestRequest + config.window * 1000 - now) / 1000
      );
      
      return {
        allowed: false,
        limit: config.requests,
        remaining: 0,
        reset: oldestRequest + config.window * 1000,
        retryAfter: Math.max(1, retryAfter)
      };
    }
    
    // Request allowed
    return {
      allowed: true,
      limit: config.requests,
      remaining: Math.max(0, config.requests - currentCount),
      reset: now + config.window * 1000
    };
  }
  
  /**
   * Check request for DDoS patterns
   */
  async checkDDoSPatterns(
    request: {
      body?: any;
      headers: Record<string, string>;
      ip: string;
      path: string;
    }
  ): Promise<{ blocked: boolean; reason?: string }> {
    // Check request size
    const contentLength = parseInt(request.headers['content-length'] || '0');
    if (contentLength > DDoSProtection.maxRequestSize) {
      await this.recordViolation({ ip: request.ip });
      return { blocked: true, reason: 'Request too large' };
    }
    
    // Check for suspicious patterns in path
    for (const pattern of DDoSProtection.suspiciousPatterns) {
      if (pattern.test(request.path)) {
        await this.recordViolation({ ip: request.ip });
        return { blocked: true, reason: 'Suspicious pattern detected' };
      }
    }
    
    // Check JSON payload size if applicable
    if (request.body && request.headers['content-type']?.includes('json')) {
      const jsonSize = JSON.stringify(request.body).length;
      if (jsonSize > DDoSProtection.maxJsonSize) {
        await this.recordViolation({ ip: request.ip });
        return { blocked: true, reason: 'JSON payload too large' };
      }
    }
    
    // Check connection count
    const connectionCount = await this.getConnectionCount(request.ip);
    if (connectionCount > DDoSProtection.maxConnectionsPerIP) {
      await this.recordViolation({ ip: request.ip });
      return { blocked: true, reason: 'Too many connections' };
    }
    
    return { blocked: false };
  }
  
  /**
   * Block an IP address
   */
  async blockIP(ip: string, duration?: number): Promise<void> {
    const blockDuration = duration || DDoSProtection.blockDuration;
    const key = `${this.blocklistPrefix}${ip}`;
    
    await redisCluster.set(key, {
      blockedAt: Date.now(),
      reason: 'Manual block or threshold exceeded',
      duration: blockDuration
    }, blockDuration);
    
    // Publish block event for monitoring
    await redisCluster.publish('security:ip-blocked', {
      ip,
      blockedAt: new Date().toISOString(),
      duration: blockDuration
    });
  }
  
  /**
   * Unblock an IP address
   */
  async unblockIP(ip: string): Promise<boolean> {
    const key = `${this.blocklistPrefix}${ip}`;
    const result = await redisCluster.cluster?.del(key);
    
    if (result) {
      await redisCluster.publish('security:ip-unblocked', {
        ip,
        unblockedAt: new Date().toISOString()
      });
    }
    
    return !!result;
  }
  
  /**
   * Check if an IP is blocked
   */
  private async isBlocked(ip: string): Promise<boolean> {
    const key = `${this.blocklistPrefix}${ip}`;
    const blockInfo = await redisCluster.get(key);
    return !!blockInfo;
  }
  
  /**
   * Record a rate limit violation
   */
  private async recordViolation(identifier: RateLimitIdentifier): Promise<void> {
    const key = this.getViolationKey(identifier);
    const violations = await redisCluster.cluster?.incr(key) || 0;
    
    // Set expiry on first violation
    if (violations === 1) {
      await redisCluster.cluster?.expire(key, 3600); // 1 hour
    }
    
    // Auto-block if threshold exceeded
    if (violations >= DDoSProtection.blockThreshold && identifier.ip) {
      await this.blockIP(identifier.ip);
    }
  }
  
  /**
   * Get current connection count for an IP
   */
  private async getConnectionCount(ip: string): Promise<number> {
    const key = `connections:${ip}`;
    const count = await redisCluster.get<number>(key) || 0;
    return count;
  }
  
  /**
   * Generate unique rate limit key
   */
  private generateKey(
    endpoint: string,
    tier: RateLimitTier,
    identifier: RateLimitIdentifier
  ): string {
    const parts = [this.prefix, endpoint, tier];
    
    // Prioritize identifiers: apiKey > userId > ip > fingerprint
    if (identifier.apiKey) {
      parts.push('api', identifier.apiKey);
    } else if (identifier.userId) {
      parts.push('user', identifier.userId);
    } else if (identifier.ip) {
      parts.push('ip', identifier.ip);
    } else if (identifier.fingerprint) {
      parts.push('fp', identifier.fingerprint);
    } else {
      parts.push('anonymous');
    }
    
    return parts.join(':');
  }
  
  /**
   * Get violation tracking key
   */
  private getViolationKey(identifier: RateLimitIdentifier): string {
    if (identifier.ip) {
      return `${this.violationPrefix}ip:${identifier.ip}`;
    } else if (identifier.userId) {
      return `${this.violationPrefix}user:${identifier.userId}`;
    } else {
      // Hash all available identifiers for anonymous tracking
      const hash = createHash('sha256')
        .update(JSON.stringify(identifier))
        .digest('hex')
        .substring(0, 16);
      return `${this.violationPrefix}anon:${hash}`;
    }
  }
  
  /**
   * Get rate limit analytics
   */
  async getAnalytics(timeWindow: number = 3600): Promise<{
    totalRequests: number;
    blockedRequests: number;
    uniqueIPs: number;
    topViolators: Array<{ identifier: string; violations: number }>;
  }> {
    // Implementation would scan Redis keys and aggregate data
    // Placeholder for now
    return {
      totalRequests: 0,
      blockedRequests: 0,
      uniqueIPs: 0,
      topViolators: []
    };
  }
  
  /**
   * Reset rate limits for a specific identifier
   */
  async resetLimits(identifier: RateLimitIdentifier): Promise<void> {
    // Scan for all rate limit keys matching this identifier
    const pattern = `${this.prefix}*:${
      identifier.userId ? `user:${identifier.userId}` :
      identifier.ip ? `ip:${identifier.ip}` :
      identifier.apiKey ? `api:${identifier.apiKey}` :
      '*'
    }`;
    
    await redisCluster.invalidate(pattern);
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();

// Helper function to determine tier based on request context
export function determineTier(context: {
  user?: { id: string; role?: string; subscription?: string };
  apiKey?: { tier?: string };
}): RateLimitTier {
  if (context.user?.role === 'admin') {
    return RateLimitTier.ADMIN;
  }
  
  if (context.apiKey?.tier === 'unlimited' || context.user?.subscription === 'enterprise') {
    return RateLimitTier.UNLIMITED;
  }
  
  if (context.user?.subscription === 'premium' || context.apiKey?.tier === 'premium') {
    return RateLimitTier.PREMIUM;
  }
  
  if (context.user || context.apiKey) {
    return RateLimitTier.AUTHENTICATED;
  }
  
  return RateLimitTier.PUBLIC;
}
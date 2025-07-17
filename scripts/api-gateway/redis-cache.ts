/**
 * 🚀 Redis Cache Layer for Pattern API Gateway
 * Sub-millisecond caching for pattern detection results
 */

import Redis from 'ioredis';

// Initialize Redis client
const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379'),
  password: process.env.REDIS_PASSWORD,
  retryStrategy: (times) => {
    const delay = Math.min(times * 50, 2000);
    return delay;
  }
});

// Cache configuration
const CACHE_TTL = {
  PATTERNS: 300,        // 5 minutes for pattern lists
  ANALYSIS: 60,         // 1 minute for game analysis
  OPPORTUNITIES: 30,    // 30 seconds for live opportunities
  PERFORMANCE: 3600,    // 1 hour for performance stats
};

export class PatternCache {
  /**
   * Get cached data
   */
  static async get(key: string): Promise<any | null> {
    try {
      const data = await redis.get(key);
      if (data) {
        console.log(`✅ Cache hit: ${key}`);
        return JSON.parse(data);
      }
      console.log(`❌ Cache miss: ${key}`);
      return null;
    } catch (error) {
      console.error('Redis get error:', error);
      return null;
    }
  }

  /**
   * Set cache data with TTL
   */
  static async set(key: string, data: any, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(data);
      if (ttl) {
        await redis.setex(key, ttl, serialized);
      } else {
        await redis.set(key, serialized);
      }
      console.log(`💾 Cached: ${key} (TTL: ${ttl}s)`);
    } catch (error) {
      console.error('Redis set error:', error);
    }
  }

  /**
   * Cache pattern list responses
   */
  static async cachePatterns(patterns: any): Promise<void> {
    await this.set('patterns:all', patterns, CACHE_TTL.PATTERNS);
  }

  /**
   * Cache game analysis
   */
  static async cacheAnalysis(gameId: string, analysis: any): Promise<void> {
    await this.set(`analysis:${gameId}`, analysis, CACHE_TTL.ANALYSIS);
  }

  /**
   * Cache opportunities by sport
   */
  static async cacheOpportunities(sport: string, minConfidence: number, opportunities: any): Promise<void> {
    const key = `opportunities:${sport}:${minConfidence}`;
    await this.set(key, opportunities, CACHE_TTL.OPPORTUNITIES);
  }

  /**
   * Cache performance stats
   */
  static async cachePerformance(pattern: string, performance: any): Promise<void> {
    const key = `performance:${pattern || 'all'}`;
    await this.set(key, performance, CACHE_TTL.PERFORMANCE);
  }

  /**
   * Invalidate cache by pattern
   */
  static async invalidate(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(`*${pattern}*`);
      if (keys.length > 0) {
        await redis.del(...keys);
        console.log(`🗑️  Invalidated ${keys.length} cache entries`);
      }
    } catch (error) {
      console.error('Cache invalidation error:', error);
    }
  }

  /**
   * Get cache stats
   */
  static async getStats(): Promise<any> {
    try {
      const info = await redis.info('stats');
      const dbSize = await redis.dbsize();
      
      return {
        connected: true,
        dbSize,
        stats: info,
        ttls: CACHE_TTL
      };
    } catch (error) {
      return {
        connected: false,
        error: error.message
      };
    }
  }

  /**
   * Clear all cache
   */
  static async flush(): Promise<void> {
    try {
      await redis.flushdb();
      console.log('🧹 Cache cleared');
    } catch (error) {
      console.error('Cache flush error:', error);
    }
  }
}

// Cache middleware for Express
export function cacheMiddleware(cacheKey: (req: any) => string, ttl: number) {
  return async (req: any, res: any, next: any) => {
    const key = cacheKey(req);
    const cached = await PatternCache.get(key);
    
    if (cached) {
      return res.json(cached);
    }
    
    // Store original json function
    const originalJson = res.json.bind(res);
    
    // Override json to cache the response
    res.json = (data: any) => {
      PatternCache.set(key, data, ttl);
      return originalJson(data);
    };
    
    next();
  };
}

// Export redis client for direct access if needed
export { redis };

// Connection handling
redis.on('connect', () => {
  console.log('🔴 Redis connected successfully');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});

export default PatternCache;
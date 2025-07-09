import { createHighPerformanceRedis, RedisHighPerformance } from '../cache/RedisHighPerformance';

/**
 * Cache Service Layer
 * Provides a simplified interface for caching operations
 * Built on top of RedisHighPerformance for extreme throughput
 */

interface CacheOptions {
  ttl?: number;        // Time to live in seconds
  compress?: boolean;  // Compress large values
  tags?: string[];     // Tags for bulk invalidation
}

interface CachedValue<T> {
  data: T;
  cachedAt: number;
  ttl: number;
  hits: number;
}

class CacheService {
  private redis: RedisHighPerformance;
  private defaultTTL = 300; // 5 minutes
  private namespace = 'fantasy-ai';
  
  // Cache statistics
  private stats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0
  };

  constructor() {
    this.redis = createHighPerformanceRedis();
    this.startStatsReporting();
  }

  /**
   * Generate cache key with namespace
   */
  private key(key: string): string {
    return `${this.namespace}:${key}`;
  }

  /**
   * Get value from cache
   */
  async get<T>(key: string): Promise<T | null> {
    try {
      const fullKey = this.key(key);
      const cached = await this.redis.getGPUCache<CachedValue<T>>(fullKey);
      
      if (cached) {
        this.stats.hits++;
        await this.redis.incrementGPUCacheHit(fullKey);
        return cached.data;
      }
      
      this.stats.misses++;
      return null;
    } catch (error) {
      this.stats.errors++;
      console.error('[Cache] Get error:', error);
      return null;
    }
  }

  /**
   * Set value in cache
   */
  async set<T>(key: string, value: T, options: CacheOptions = {}): Promise<void> {
    try {
      const fullKey = this.key(key);
      const ttl = options.ttl || this.defaultTTL;
      
      const cachedValue: CachedValue<T> = {
        data: value,
        cachedAt: Date.now(),
        ttl,
        hits: 0
      };
      
      await this.redis.setGPUCache(fullKey, cachedValue, ttl);
      
      // Store tags for invalidation
      if (options.tags && options.tags.length > 0) {
        await this.tagKeys(fullKey, options.tags);
      }
      
      this.stats.sets++;
    } catch (error) {
      this.stats.errors++;
      console.error('[Cache] Set error:', error);
    }
  }

  /**
   * Delete value from cache
   */
  async del(key: string): Promise<void> {
    try {
      const fullKey = this.key(key);
      await this.redis.del(fullKey);
      this.stats.deletes++;
    } catch (error) {
      this.stats.errors++;
      console.error('[Cache] Delete error:', error);
    }
  }

  /**
   * Delete multiple keys
   */
  async delMany(keys: string[]): Promise<void> {
    const fullKeys = keys.map(k => this.key(k));
    await this.redis.del(...fullKeys);
    this.stats.deletes += keys.length;
  }

  /**
   * Clear all cache (use with caution!)
   */
  async clear(): Promise<void> {
    const pattern = `${this.namespace}:*`;
    const keys = await this.redis.keys(pattern);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
      this.stats.deletes += keys.length;
    }
  }

  /**
   * Get or set pattern - fetch from cache or compute and store
   */
  async getOrSet<T>(
    key: string,
    factory: () => Promise<T>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(key);
    if (cached !== null) {
      return cached;
    }
    
    // Compute value
    const value = await factory();
    
    // Store in cache
    await this.set(key, value, options);
    
    return value;
  }

  /**
   * Batch get multiple values
   */
  async mget<T>(keys: string[]): Promise<Map<string, T>> {
    const fullKeys = keys.map(k => this.key(k));
    const values = await this.redis.batchGet<CachedValue<T>>(fullKeys);
    
    const result = new Map<string, T>();
    keys.forEach((key, index) => {
      const cached = values.get(fullKeys[index]);
      if (cached) {
        this.stats.hits++;
        result.set(key, cached.data);
      } else {
        this.stats.misses++;
      }
    });
    
    return result;
  }

  /**
   * Batch set multiple values
   */
  async mset<T>(items: Array<{ key: string; value: T; ttl?: number }>): Promise<void> {
    const batchItems = items.map(item => ({
      key: this.key(item.key),
      value: {
        data: item.value,
        cachedAt: Date.now(),
        ttl: item.ttl || this.defaultTTL,
        hits: 0
      } as CachedValue<T>,
      ttl: item.ttl || this.defaultTTL
    }));
    
    await this.redis.batchSet(batchItems);
    this.stats.sets += items.length;
  }

  /**
   * Tag-based invalidation
   */
  private async tagKeys(key: string, tags: string[]): Promise<void> {
    for (const tag of tags) {
      const tagKey = `${this.namespace}:tags:${tag}`;
      await this.redis.sadd(tagKey, key);
      await this.redis.expire(tagKey, 86400); // 24 hour expiry for tag sets
    }
  }

  async invalidateTag(tag: string): Promise<void> {
    const tagKey = `${this.namespace}:tags:${tag}`;
    const keys = await this.redis.smembers(tagKey);
    
    if (keys.length > 0) {
      await this.redis.del(...keys);
      await this.redis.del(tagKey);
      this.stats.deletes += keys.length;
    }
  }

  /**
   * Cache patterns for specific use cases
   */
  
  // Player data caching
  async cachePlayer(playerId: string, data: any, ttl: number = 300): Promise<void> {
    await this.set(`player:${playerId}`, data, { 
      ttl, 
      tags: ['players', `team:${data.team_id}`] 
    });
  }

  async getCachedPlayer(playerId: string): Promise<any> {
    return this.get(`player:${playerId}`);
  }

  // Game data caching
  async cacheGame(gameId: string, data: any, ttl: number = 600): Promise<void> {
    await this.set(`game:${gameId}`, data, { 
      ttl, 
      tags: ['games', `date:${data.game_date}`] 
    });
  }

  async getCachedGame(gameId: string): Promise<any> {
    return this.get(`game:${gameId}`);
  }

  // Lineup optimization caching
  async cacheLineupOptimization(constraints: any, lineups: any[], ttl: number = 1800): Promise<void> {
    const key = `lineup:${this.hashObject(constraints)}`;
    await this.set(key, lineups, { ttl, tags: ['lineups'] });
  }

  async getCachedLineupOptimization(constraints: any): Promise<any[]> {
    const key = `lineup:${this.hashObject(constraints)}`;
    return await this.get(key) || [];
  }

  // ML predictions caching
  async cachePrediction(
    modelName: string, 
    inputHash: string, 
    prediction: any, 
    ttl: number = 3600
  ): Promise<void> {
    const key = `prediction:${modelName}:${inputHash}`;
    await this.set(key, prediction, { ttl, tags: ['predictions', modelName] });
  }

  async getCachedPrediction(modelName: string, inputHash: string): Promise<any> {
    const key = `prediction:${modelName}:${inputHash}`;
    return this.get(key);
  }

  /**
   * Leaderboard operations
   */
  async updateLeaderboard(name: string, scores: Array<{ member: string; score: number }>): Promise<void> {
    await this.redis.updateLeaderboard(`${this.namespace}:lb:${name}`, scores);
  }

  async getLeaderboard(name: string, limit: number = 100): Promise<Array<{ member: string; score: number }>> {
    return this.redis.getLeaderboard(`${this.namespace}:lb:${name}`, 0, limit - 1);
  }

  /**
   * Rate limiting
   */
  async checkRateLimit(
    identifier: string, 
    limit: number, 
    windowSeconds: number
  ): Promise<{ allowed: boolean; remaining: number }> {
    const key = `${this.namespace}:rate:${identifier}`;
    const current = await this.redis.incr(key);
    
    if (current === 1) {
      await this.redis.expire(key, windowSeconds);
    }
    
    return {
      allowed: current <= limit,
      remaining: Math.max(0, limit - current)
    };
  }

  /**
   * Cache warming
   */
  async warmCache(items: Array<{ key: string; factory: () => Promise<any>; ttl?: number }>): Promise<void> {
    console.log(`[Cache] Warming ${items.length} items...`);
    
    const promises = items.map(async item => {
      try {
        const value = await item.factory();
        await this.set(item.key, value, { ttl: item.ttl });
      } catch (error) {
        console.error(`[Cache] Failed to warm ${item.key}:`, error);
      }
    });
    
    await Promise.all(promises);
    console.log('[Cache] Warming complete');
  }

  /**
   * Monitoring and stats
   */
  getStats() {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      hitRate: hitRate.toFixed(2) + '%',
      total
    };
  }

  private startStatsReporting(): void {
    // Report stats every minute
    setInterval(() => {
      const stats = this.getStats();
      console.log('[Cache Stats]', {
        hitRate: stats.hitRate,
        hits: stats.hits,
        misses: stats.misses,
        sets: stats.sets,
        deletes: stats.deletes,
        errors: stats.errors
      });
      
      // Reset counters
      this.stats = {
        hits: 0,
        misses: 0,
        sets: 0,
        deletes: 0,
        errors: 0
      };
    }, 60000);
  }

  /**
   * Utility methods
   */
  private hashObject(obj: any): string {
    return Buffer.from(JSON.stringify(obj)).toString('base64');
  }

  async healthCheck(): Promise<boolean> {
    return this.redis.healthCheck();
  }

  async disconnect(): Promise<void> {
    await this.redis.disconnect();
  }
}

// Export singleton instance
export const cache = new CacheService();

// Export types
export type { CacheService, CacheOptions, CachedValue };
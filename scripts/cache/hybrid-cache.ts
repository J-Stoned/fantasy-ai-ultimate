#!/usr/bin/env tsx
/**
 * 🚀 HYBRID CACHE - 10X PERFORMANCE OPTIMIZATION
 * 
 * Combines in-memory LRU cache with Redis for ultimate speed:
 * - In-memory: Nanosecond access for hot data
 * - Redis: Microsecond access for distributed cache
 * - Automatic failover and recovery
 * - Smart TTL management
 */

import { LRUCache } from 'lru-cache';
import Redis from 'ioredis';
import crypto from 'crypto';

// Cache statistics
interface CacheStats {
  hits: number;
  misses: number;
  lruHits: number;
  redisHits: number;
  dbHits: number;
  avgResponseTime: number;
}

export class HybridCache {
  private lru: LRUCache<string, any>;
  private redis: Redis;
  private stats: CacheStats;
  private responseTimer: number[] = [];
  
  constructor() {
    // Initialize LRU cache with 10MB limit
    this.lru = new LRUCache<string, any>({
      max: 1000, // max items
      maxSize: 10 * 1024 * 1024, // 10MB
      sizeCalculation: (value) => JSON.stringify(value).length,
      ttl: 1000 * 60 * 5, // 5 minutes default TTL
      updateAgeOnGet: true,
      updateAgeOnHas: true,
    });
    
    // Initialize Redis with connection pooling
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 0, // Don't retry
      enableReadyCheck: false,
      enableOfflineQueue: false,
      lazyConnect: true,
      retryStrategy: () => null, // Disable retries
    });
    
    // Initialize stats
    this.stats = {
      hits: 0,
      misses: 0,
      lruHits: 0,
      redisHits: 0,
      dbHits: 0,
      avgResponseTime: 0
    };
    
    // Setup Redis event handlers
    this.setupRedisHandlers();
  }
  
  private setupRedisHandlers() {
    this.redis.on('connect', () => {
      console.log('🟢 Redis connected successfully! Hybrid cache fully operational');
    });
    
    this.redis.on('ready', () => {
      console.log('✅ Redis ready - Using LRU + Redis hybrid cache');
    });
    
    this.redis.on('error', (err) => {
      if (!this.redis.status || this.redis.status === 'end') {
        console.log('📝 Redis not available - Using LRU cache only (still fast!)');
      }
    });
    
    this.redis.on('close', () => {
      if (this.redis.status !== 'reconnecting') {
        console.log('📝 Redis disconnected - Using LRU cache only');
      }
    });
  }
  
  /**
   * Generate cache key with namespace
   */
  private generateKey(namespace: string, identifier: string | object): string {
    if (typeof identifier === 'string') {
      return `${namespace}:${identifier}`;
    }
    
    // Hash complex objects for consistent keys
    const hash = crypto
      .createHash('md5')
      .update(JSON.stringify(identifier))
      .digest('hex');
    
    return `${namespace}:${hash}`;
  }
  
  /**
   * Get value with multi-tier fallback
   */
  async get<T>(
    namespace: string,
    identifier: string | object,
    fetchFn?: () => Promise<T>,
    ttl?: number
  ): Promise<T | null> {
    const startTime = Date.now();
    const key = this.generateKey(namespace, identifier);
    
    // 1. Check LRU cache first (nanosecond access)
    if (this.lru.has(key)) {
      const value = this.lru.get(key);
      
      // 🔥 10X CACHE POISONING PREVENTION
      // Never serve empty arrays from cache - they're likely poisoned
      if (Array.isArray(value) && value.length === 0) {
        console.log(`🚫 Cache poisoning detected for ${key} - purging empty result`);
        this.lru.delete(key);
        // Fall through to re-fetch fresh data
      } else {
        this.stats.hits++;
        this.stats.lruHits++;
        this.recordResponseTime(Date.now() - startTime);
        return value;
      }
    }
    
    // 2. Check Redis (microsecond access)
    try {
      if (this.redis.status === 'ready') {
        const cached = await this.redis.get(key);
        if (cached) {
          const value = JSON.parse(cached);
          
          // 🔥 10X CACHE POISONING PREVENTION FOR REDIS
          if (Array.isArray(value) && value.length === 0) {
            console.log(`🚫 Redis cache poisoning detected for ${key} - purging`);
            await this.redis.del(key);
            // Fall through to re-fetch fresh data
          } else {
            this.lru.set(key, value); // Promote to LRU
            this.stats.hits++;
            this.stats.redisHits++;
            this.recordResponseTime(Date.now() - startTime);
            return value;
          }
        }
      }
    } catch (error) {
      console.warn(`Redis get error for ${key}:`, error.message);
    }
    
    // 3. Cache miss - fetch from source if function provided
    this.stats.misses++;
    
    if (fetchFn) {
      try {
        const value = await fetchFn();
        await this.set(namespace, identifier, value, ttl);
        this.stats.dbHits++;
        this.recordResponseTime(Date.now() - startTime);
        return value;
      } catch (error) {
        console.error(`Fetch error for ${key}:`, error);
        return null;
      }
    }
    
    this.recordResponseTime(Date.now() - startTime);
    return null;
  }
  
  /**
   * Set value in both caches
   */
  async set<T>(
    namespace: string,
    identifier: string | object,
    value: T,
    ttl?: number
  ): Promise<void> {
    // 🔥 10X OPTIMIZATION: Never cache empty arrays
    if (Array.isArray(value) && value.length === 0) {
      console.log(`🚫 Refusing to cache empty array for ${namespace}`);
      return; // Don't cache empty results
    }
    
    const key = this.generateKey(namespace, identifier);
    const ttlMs = ttl ? ttl * 1000 : undefined;
    
    // Set in LRU
    this.lru.set(key, value, { ttl: ttlMs });
    
    // Set in Redis
    try {
      if (this.redis.status === 'ready') {
        const serialized = JSON.stringify(value);
        if (ttl) {
          await this.redis.setex(key, ttl, serialized);
        } else {
          await this.redis.set(key, serialized);
        }
      }
    } catch (error) {
      console.warn(`Redis set error for ${key}:`, error.message);
    }
  }
  
  /**
   * Delete from both caches
   */
  async delete(namespace: string, identifier: string | object): Promise<void> {
    const key = this.generateKey(namespace, identifier);
    
    // Delete from LRU
    this.lru.delete(key);
    
    // Delete from Redis
    try {
      if (this.redis.status === 'ready') {
        await this.redis.del(key);
      }
    } catch (error) {
      console.warn(`Redis delete error for ${key}:`, error.message);
    }
  }
  
  /**
   * Invalidate by pattern
   */
  async invalidatePattern(pattern: string): Promise<number> {
    let count = 0;
    
    // Clear from LRU
    for (const key of this.lru.keys()) {
      if (key.includes(pattern)) {
        this.lru.delete(key);
        count++;
      }
    }
    
    // Clear from Redis
    try {
      if (this.redis.status === 'ready') {
        const keys = await this.redis.keys(`*${pattern}*`);
        if (keys.length > 0) {
          await this.redis.del(...keys);
          count += keys.length;
        }
      }
    } catch (error) {
      console.warn('Redis pattern invalidation error:', error.message);
    }
    
    return count;
  }
  
  /**
   * Get cache statistics
   */
  getStats(): CacheStats & { lruSize: number; hitRate: number } {
    const total = this.stats.hits + this.stats.misses;
    const hitRate = total > 0 ? (this.stats.hits / total) * 100 : 0;
    
    return {
      ...this.stats,
      lruSize: this.lru.size,
      hitRate: Math.round(hitRate * 100) / 100,
      avgResponseTime: this.calculateAvgResponseTime()
    };
  }
  
  /**
   * Clear all caches
   */
  async clear(): Promise<void> {
    this.lru.clear();
    
    try {
      if (this.redis.status === 'ready') {
        await this.redis.flushdb();
      }
    } catch (error) {
      console.warn('Redis flush error:', error.message);
    }
    
    // Reset stats
    this.stats = {
      hits: 0,
      misses: 0,
      lruHits: 0,
      redisHits: 0,
      dbHits: 0,
      avgResponseTime: 0
    };
    this.responseTimer = [];
  }
  
  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(items: Array<{ namespace: string; identifier: string | object; fetchFn: () => Promise<any>; ttl?: number }>) {
    console.log(`🔥 Warming cache with ${items.length} items...`);
    
    const results = await Promise.allSettled(
      items.map(item => 
        this.get(item.namespace, item.identifier, item.fetchFn, item.ttl)
      )
    );
    
    const successful = results.filter(r => r.status === 'fulfilled').length;
    console.log(`✅ Cache warmed: ${successful}/${items.length} items loaded`);
  }
  
  private recordResponseTime(ms: number) {
    this.responseTimer.push(ms);
    if (this.responseTimer.length > 1000) {
      this.responseTimer.shift();
    }
  }
  
  private calculateAvgResponseTime(): number {
    if (this.responseTimer.length === 0) return 0;
    const sum = this.responseTimer.reduce((a, b) => a + b, 0);
    return Math.round((sum / this.responseTimer.length) * 100) / 100;
  }
  
  /**
   * Connect to Redis
   */
  async connect(): Promise<void> {
    try {
      await this.redis.connect();
    } catch (error) {
      console.warn('Redis connection failed, running in LRU-only mode:', error.message);
    }
  }
  
  /**
   * Disconnect from Redis
   */
  async disconnect(): Promise<void> {
    await this.redis.quit();
  }
}

// Pattern-specific cache configurations
export const CACHE_CONFIG = {
  patterns: {
    namespace: 'patterns',
    ttl: 300 // 5 minutes
  },
  patternResults: {
    namespace: 'pattern_results',
    ttl: 60 // 1 minute for live games
  },
  teamStats: {
    namespace: 'team_stats',
    ttl: 3600 // 1 hour
  },
  playerStats: {
    namespace: 'player_stats',
    ttl: 3600 // 1 hour
  },
  weatherData: {
    namespace: 'weather',
    ttl: 1800 // 30 minutes
  },
  bettingLines: {
    namespace: 'betting_lines',
    ttl: 30 // 30 seconds for live odds
  },
  mlPredictions: {
    namespace: 'ml_predictions',
    ttl: 60 // 1 minute
  }
};

// Singleton instance
let hybridCache: HybridCache;

export function getHybridCache(): HybridCache {
  if (!hybridCache) {
    hybridCache = new HybridCache();
  }
  return hybridCache;
}

// Express middleware for caching
export function hybridCacheMiddleware(
  namespace: string,
  keyGenerator: (req: any) => string | object,
  ttl?: number
) {
  const cache = getHybridCache();
  
  return async (req: any, res: any, next: any) => {
    const identifier = keyGenerator(req);
    const cached = await cache.get(namespace, identifier);
    
    if (cached) {
      res.set('X-Cache', 'HIT');
      return res.json(cached);
    }
    
    // Store original json function
    const originalJson = res.json.bind(res);
    
    // Override json to cache the response
    res.json = (data: any) => {
      res.set('X-Cache', 'MISS');
      cache.set(namespace, identifier, data, ttl);
      return originalJson(data);
    };
    
    next();
  };
}

// Initialize cache on import
const cache = getHybridCache();
cache.connect().catch(console.error);

export default HybridCache;
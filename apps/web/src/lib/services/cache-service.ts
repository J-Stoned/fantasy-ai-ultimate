/**
 * 🚀 Redis Cache Service
 * High-performance caching layer for Fantasy ML predictions and lineups
 */

import Redis from 'ioredis';
import { createHash } from 'crypto';

export interface CacheConfig {
  redis_url?: string;
  ttl: {
    predictions: number;      // 5 minutes default
    lineups: number;         // 30 minutes default
    weather: number;         // 15 minutes default
    injuries: number;        // 5 minutes default
    vegas: number;           // 10 minutes default
    models: number;          // 1 hour default
  };
  prefix: string;
  enable_compression: boolean;
}

export class CacheService {
  private redis: Redis | null = null;
  private config: CacheConfig;
  private compressionThreshold = 1024; // Compress data > 1KB
  private initialized = false;

  constructor(config?: Partial<CacheConfig>) {
    this.config = {
      redis_url: process.env.REDIS_URL || 'redis://localhost:6379',
      ttl: {
        predictions: 300,      // 5 minutes
        lineups: 1800,        // 30 minutes
        weather: 900,         // 15 minutes
        injuries: 300,        // 5 minutes
        vegas: 600,           // 10 minutes
        models: 3600          // 1 hour
      },
      prefix: 'fantasy_ml:',
      enable_compression: true,
      ...config
    };
  }

  /**
   * Initialize Redis connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      this.redis = new Redis(this.config.redis_url!, {
        retryStrategy: (times) => {
          const delay = Math.min(times * 50, 2000);
          return delay;
        },
        maxRetriesPerRequest: 3,
        enableReadyCheck: true,
        lazyConnect: false,
        connectTimeout: 10000,
        keepAlive: 30000
      });

      // Test connection
      await this.redis.ping();
      
      // Set up error handling
      this.redis.on('error', (err) => {
        console.error('Redis error:', err);
      });

      this.redis.on('reconnecting', () => {
        console.log('Redis reconnecting...');
      });

      this.initialized = true;
      console.log('✅ Redis cache service initialized');
    } catch (error) {
      console.warn('⚠️ Redis connection failed, running without cache:', error);
      this.redis = null;
    }
  }

  /**
   * Generate cache key
   */
  private generateKey(namespace: string, identifier: string | object): string {
    const id = typeof identifier === 'string' 
      ? identifier 
      : createHash('md5').update(JSON.stringify(identifier)).digest('hex');
    
    return `${this.config.prefix}${namespace}:${id}`;
  }

  /**
   * Compress data if needed
   */
  private compress(data: string): string {
    if (!this.config.enable_compression || data.length < this.compressionThreshold) {
      return data;
    }
    
    // In production, use proper compression like zlib
    // For now, just return the data
    return data;
  }

  /**
   * Decompress data if needed
   */
  private decompress(data: string): string {
    // In production, detect and decompress if needed
    return data;
  }

  /**
   * Get from cache
   */
  async get<T>(namespace: string, identifier: string | object): Promise<T | null> {
    if (!this.redis) return null;
    
    try {
      const key = this.generateKey(namespace, identifier);
      const cached = await this.redis.get(key);
      
      if (!cached) return null;
      
      const decompressed = this.decompress(cached);
      return JSON.parse(decompressed);
    } catch (error) {
      console.error('Cache get error:', error);
      return null;
    }
  }

  /**
   * Set in cache
   */
  async set<T>(
    namespace: string, 
    identifier: string | object, 
    data: T, 
    customTtl?: number
  ): Promise<void> {
    if (!this.redis) return;
    
    try {
      const key = this.generateKey(namespace, identifier);
      const serialized = JSON.stringify(data);
      const compressed = this.compress(serialized);
      
      // Get TTL based on namespace
      const ttl = customTtl || this.config.ttl[namespace as keyof typeof this.config.ttl] || 300;
      
      await this.redis.setex(key, ttl, compressed);
    } catch (error) {
      console.error('Cache set error:', error);
    }
  }

  /**
   * Delete from cache
   */
  async delete(namespace: string, identifier: string | object): Promise<void> {
    if (!this.redis) return;
    
    try {
      const key = this.generateKey(namespace, identifier);
      await this.redis.del(key);
    } catch (error) {
      console.error('Cache delete error:', error);
    }
  }

  /**
   * Clear namespace
   */
  async clearNamespace(namespace: string): Promise<void> {
    if (!this.redis) return;
    
    try {
      const pattern = `${this.config.prefix}${namespace}:*`;
      const keys = await this.redis.keys(pattern);
      
      if (keys.length > 0) {
        await this.redis.del(...keys);
      }
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }

  /**
   * Get or set pattern (cache-aside)
   */
  async getOrSet<T>(
    namespace: string,
    identifier: string | object,
    factory: () => Promise<T>,
    customTtl?: number
  ): Promise<T> {
    // Try to get from cache first
    const cached = await this.get<T>(namespace, identifier);
    if (cached !== null) {
      return cached;
    }
    
    // Generate fresh data
    const data = await factory();
    
    // Store in cache
    await this.set(namespace, identifier, data, customTtl);
    
    return data;
  }

  /**
   * Batch get
   */
  async batchGet<T>(
    namespace: string,
    identifiers: (string | object)[]
  ): Promise<Map<string, T | null>> {
    const results = new Map<string, T | null>();
    
    if (!this.redis || identifiers.length === 0) {
      identifiers.forEach(id => {
        const key = typeof id === 'string' ? id : JSON.stringify(id);
        results.set(key, null);
      });
      return results;
    }
    
    try {
      // Generate keys
      const keys = identifiers.map(id => this.generateKey(namespace, id));
      
      // Batch get
      const values = await this.redis.mget(...keys);
      
      // Process results
      identifiers.forEach((id, index) => {
        const key = typeof id === 'string' ? id : JSON.stringify(id);
        const value = values[index];
        
        if (value) {
          try {
            const decompressed = this.decompress(value);
            results.set(key, JSON.parse(decompressed));
          } catch {
            results.set(key, null);
          }
        } else {
          results.set(key, null);
        }
      });
      
      return results;
    } catch (error) {
      console.error('Batch get error:', error);
      identifiers.forEach(id => {
        const key = typeof id === 'string' ? id : JSON.stringify(id);
        results.set(key, null);
      });
      return results;
    }
  }

  /**
   * Cache warming for predictions
   */
  async warmPredictionCache(
    sport: string,
    gameDate: Date,
    playerIds?: string[]
  ): Promise<void> {
    if (!this.redis) return;
    
    console.log(`🔥 Warming ${sport} prediction cache for ${gameDate.toDateString()}`);
    
    // This would be called by a background job to pre-populate cache
    // Implementation depends on prediction service integration
  }

  /**
   * Get cache statistics
   */
  async getStats(): Promise<{
    connected: boolean;
    memory_usage: string;
    keys_count: number;
    hit_rate: number;
  }> {
    if (!this.redis) {
      return {
        connected: false,
        memory_usage: '0',
        keys_count: 0,
        hit_rate: 0
      };
    }
    
    try {
      const info = await this.redis.info('memory');
      const memoryMatch = info.match(/used_memory_human:(.+)/);
      const memory = memoryMatch ? memoryMatch[1].trim() : 'unknown';
      
      const keys = await this.redis.dbsize();
      
      // In production, track hits/misses for hit rate
      // For now, return mock data
      return {
        connected: true,
        memory_usage: memory,
        keys_count: keys,
        hit_rate: 0.85 // 85% hit rate
      };
    } catch (error) {
      console.error('Stats error:', error);
      return {
        connected: false,
        memory_usage: '0',
        keys_count: 0,
        hit_rate: 0
      };
    }
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    if (!this.redis) return false;
    
    try {
      const pong = await this.redis.ping();
      return pong === 'PONG';
    } catch {
      return false;
    }
  }

  /**
   * Dispose connection
   */
  async dispose(): Promise<void> {
    if (this.redis) {
      await this.redis.quit();
      this.redis = null;
      this.initialized = false;
      console.log('🧹 Redis cache service disposed');
    }
  }
}

// Export singleton instance
export const cacheService = new CacheService();
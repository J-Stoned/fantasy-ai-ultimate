/**
 * Cache service implementation with Redis
 */

import Redis from 'ioredis';
import { Injectable, Inject } from '../container';
import { ICache, ILogger, SERVICE_TOKENS } from '../interfaces';

@Injectable({ singleton: true })
export class CacheService implements ICache {
  private redis: Redis;
  private defaultTTL = 3600; // 1 hour

  constructor(
    @Inject(SERVICE_TOKENS.Logger) private logger: ILogger
  ) {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    });

    this.redis.on('connect', () => {
      this.logger.info('Redis connected');
    });

    this.redis.on('error', (err) => {
      this.logger.error('Redis error', err);
    });
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      const value = await this.redis.get(key);
      if (!value) return null;
      
      return JSON.parse(value);
    } catch (error) {
      this.logger.error('Cache get error', error, { key });
      return null;
    }
  }

  async set<T>(key: string, value: T, ttl?: number): Promise<void> {
    try {
      const serialized = JSON.stringify(value);
      const expiry = ttl || this.defaultTTL;
      
      await this.redis.setex(key, expiry, serialized);
      this.logger.debug('Cache set', { key, ttl: expiry });
    } catch (error) {
      this.logger.error('Cache set error', error, { key });
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await this.redis.del(key);
      this.logger.debug('Cache delete', { key });
    } catch (error) {
      this.logger.error('Cache delete error', error, { key });
    }
  }

  async clear(): Promise<void> {
    try {
      await this.redis.flushall();
      this.logger.info('Cache cleared');
    } catch (error) {
      this.logger.error('Cache clear error', error);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      const exists = await this.redis.exists(key);
      return exists === 1;
    } catch (error) {
      this.logger.error('Cache has error', error, { key });
      return false;
    }
  }

  async cleanup(): Promise<void> {
    await this.redis.quit();
    this.logger.info('Redis connection closed');
  }
}

/**
 * In-memory cache service for development/testing
 */
@Injectable({ singleton: true })
export class InMemoryCacheService implements ICache {
  private cache = new Map<string, { value: any; expires: number }>();

  constructor(
    @Inject(SERVICE_TOKENS.Logger) private logger: ILogger
  ) {
    // Clean up expired entries every minute
    setInterval(() => this.cleanExpired(), 60000);
  }

  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  async set<T>(key: string, value: T, ttl = 3600): Promise<void> {
    const expires = Date.now() + (ttl * 1000);
    this.cache.set(key, { value, expires });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }

  async clear(): Promise<void> {
    this.cache.clear();
  }

  async has(key: string): Promise<boolean> {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  private cleanExpired(): void {
    const now = Date.now();
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
      }
    }
  }
}
/**
 * 💾 Cache Service
 * High-performance caching with Redis-ready interface and query optimization
 */

import { queryMonitor } from './query-monitor';
import { logger } from '../logging/logger';

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
  compress?: boolean; // Compress large values
}

interface CacheEntry {
  value: any;
  expiresAt: number;
  tags: string[];
  hits: number;
  lastAccessed: number;
  size: number;
}

interface CacheStats {
  totalEntries: number;
  validEntries: number;
  expiredEntries: number;
  tags: number;
  totalSize: number;
  hitRate: number;
  avgHitsPerEntry: number;
}

class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();
  private hits = 0;
  private misses = 0;
  private maxCacheSize = 100 * 1024 * 1024; // 100MB default

  /**
   * Get cached value with metrics tracking
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      queryMonitor.logCacheAccess(false);
      return null;
    }
    
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      this.misses++;
      queryMonitor.logCacheAccess(false);
      return null;
    }
    
    // Update hit stats
    this.hits++;
    entry.hits++;
    entry.lastAccessed = Date.now();
    queryMonitor.logCacheAccess(true);
    
    return entry.value as T;
  }

  /**
   * Set cached value with size tracking
   */
  async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttl || 3600; // Default 1 hour
    const tags = options.tags || [];
    const size = this.estimateSize(value);
    
    // Check cache size limit
    if (this.getCurrentCacheSize() + size > this.maxCacheSize) {
      await this.evictLRU();
    }
    
    const entry: CacheEntry = {
      value,
      expiresAt: Date.now() + (ttl * 1000),
      tags,
      hits: 0,
      lastAccessed: Date.now(),
      size
    };
    
    this.cache.set(key, entry);
    
    // Update tag index
    tags.forEach(tag => {
      if (!this.tagIndex.has(tag)) {
        this.tagIndex.set(tag, new Set());
      }
      this.tagIndex.get(tag)!.add(key);
    });
  }

  /**
   * Delete cached value
   */
  async delete(key: string): Promise<void> {
    const entry = this.cache.get(key);
    if (!entry) return;
    
    // Remove from tag index
    entry.tags.forEach(tag => {
      const keys = this.tagIndex.get(tag);
      if (keys) {
        keys.delete(key);
        if (keys.size === 0) {
          this.tagIndex.delete(tag);
        }
      }
    });
    
    this.cache.delete(key);
  }

  /**
   * Clear cache by tag
   */
  async clearByTag(tag: string): Promise<void> {
    const keys = this.tagIndex.get(tag);
    if (!keys) return;
    
    keys.forEach(key => this.delete(key));
  }

  /**
   * Clear all cache
   */
  async clear(): Promise<void> {
    this.cache.clear();
    this.tagIndex.clear();
  }

  /**
   * Get enhanced cache statistics
   */
  getStats(): CacheStats {
    let validCount = 0;
    let expiredCount = 0;
    let totalSize = 0;
    let totalHits = 0;
    const now = Date.now();
    
    this.cache.forEach(entry => {
      if (now > entry.expiresAt) {
        expiredCount++;
      } else {
        validCount++;
      }
      totalSize += entry.size;
      totalHits += entry.hits;
    });
    
    const totalRequests = this.hits + this.misses;
    const hitRate = totalRequests > 0 ? (this.hits / totalRequests) * 100 : 0;
    const avgHitsPerEntry = this.cache.size > 0 ? totalHits / this.cache.size : 0;
    
    return {
      totalEntries: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount,
      tags: this.tagIndex.size,
      totalSize,
      hitRate,
      avgHitsPerEntry
    };
  }

  /**
   * Estimate size of cached value
   */
  private estimateSize(value: any): number {
    if (typeof value === 'string') {
      return value.length * 2; // 2 bytes per char
    }
    if (typeof value === 'object') {
      return JSON.stringify(value).length * 2;
    }
    return 8; // Default for numbers, booleans
  }

  /**
   * Get current cache size in bytes
   */
  private getCurrentCacheSize(): number {
    let totalSize = 0;
    this.cache.forEach(entry => {
      totalSize += entry.size;
    });
    return totalSize;
  }

  /**
   * Evict least recently used entries
   */
  private async evictLRU(): Promise<void> {
    const entries = Array.from(this.cache.entries())
      .sort((a, b) => a[1].lastAccessed - b[1].lastAccessed);
    
    const targetSize = this.maxCacheSize * 0.8; // Free up to 80% capacity
    let currentSize = this.getCurrentCacheSize();
    
    for (const [key, entry] of entries) {
      if (currentSize <= targetSize) break;
      
      currentSize -= entry.size;
      await this.delete(key);
    }
    
    logger.info('🧹 Evicted entries to free cache space');
  }

  /**
   * Cache lineup optimization results
   */
  async cacheLineupOptimization(
    request: any,
    lineups: any[],
    ttl: number = 1800
  ): Promise<void> {
    const key = `lineup:${JSON.stringify(request)}`;
    await this.set(key, lineups, { ttl, tags: ['lineup', request.sport] });
  }

  /**
   * Get cached lineup optimization
   */
  async getCachedLineupOptimization(request: any): Promise<any[] | null> {
    const key = `lineup:${JSON.stringify(request)}`;
    return this.get<any[]>(key);
  }

  /**
   * Cache player predictions
   */
  async cachePlayerPredictions(
    sport: string,
    date: string,
    predictions: any[],
    ttl: number = 300
  ): Promise<void> {
    const key = `predictions:${sport}:${date}`;
    await this.set(key, predictions, { ttl, tags: ['predictions', sport] });
  }

  /**
   * Get cached player predictions
   */
  async getCachedPlayerPredictions(
    sport: string,
    date: string
  ): Promise<any[] | null> {
    const key = `predictions:${sport}:${date}`;
    return this.get<any[]>(key);
  }

  /**
   * Clean expired entries periodically
   */
  startCleanupInterval(intervalMs: number = 60000): void {
    setInterval(() => {
      const now = Date.now();
      const keysToDelete: string[] = [];
      
      this.cache.forEach((entry, key) => {
        if (now > entry.expiresAt) {
          keysToDelete.push(key);
        }
      });
      
      keysToDelete.forEach(key => this.delete(key));
      
      if (keysToDelete.length > 0) {
        logger.info('🧹 Cleaned ${keysToDelete.length} expired cache entries');
      }
    }, intervalMs);
  }
}

// Export singleton instance
export const cache = new CacheService();

// Start cleanup interval
cache.startCleanupInterval();
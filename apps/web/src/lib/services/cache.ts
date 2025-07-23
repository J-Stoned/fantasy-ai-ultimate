/**
 * 💾 Cache Service
 * In-memory caching with Redis-ready interface
 */

export interface CacheOptions {
  ttl?: number; // Time to live in seconds
  tags?: string[]; // Cache tags for invalidation
}

interface CacheEntry {
  value: any;
  expiresAt: number;
  tags: string[];
}

class CacheService {
  private cache: Map<string, CacheEntry> = new Map();
  private tagIndex: Map<string, Set<string>> = new Map();

  /**
   * Get cached value
   */
  async get<T>(key: string): Promise<T | null> {
    const entry = this.cache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiresAt) {
      this.delete(key);
      return null;
    }
    
    return entry.value as T;
  }

  /**
   * Set cached value
   */
  async set(
    key: string,
    value: any,
    options: CacheOptions = {}
  ): Promise<void> {
    const ttl = options.ttl || 3600; // Default 1 hour
    const tags = options.tags || [];
    
    const entry: CacheEntry = {
      value,
      expiresAt: Date.now() + (ttl * 1000),
      tags
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
   * Get cache statistics
   */
  getStats() {
    let validCount = 0;
    let expiredCount = 0;
    const now = Date.now();
    
    this.cache.forEach(entry => {
      if (now > entry.expiresAt) {
        expiredCount++;
      } else {
        validCount++;
      }
    });
    
    return {
      totalEntries: this.cache.size,
      validEntries: validCount,
      expiredEntries: expiredCount,
      tags: this.tagIndex.size
    };
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
        console.log(`🧹 Cleaned ${keysToDelete.length} expired cache entries`);
      }
    }, intervalMs);
  }
}

// Export singleton instance
export const cache = new CacheService();

// Start cleanup interval
cache.startCleanupInterval();
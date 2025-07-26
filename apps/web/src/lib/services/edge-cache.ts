/**
 * 🔥 EDGE CACHE SERVICE - 2025 BEST PRACTICES
 * Ultra-fast caching optimized for Vercel Edge Runtime
 * Replaces heavy Redis operations with edge-compatible caching
 */

interface CacheEntry<T = any> {
  value: T;
  expires: number;
  hits: number;
}

interface CacheStats {
  size: number;
  hits: number;
  misses: number;
  hitRate: number;
  memory: number;
}

export class EdgeCacheService {
  private cache = new Map<string, CacheEntry>();
  private stats = { hits: 0, misses: 0 };
  private maxSize = 1000; // Max entries
  private maxMemory = 50 * 1024 * 1024; // 50MB limit

  constructor(options?: { maxSize?: number; maxMemory?: number }) {
    if (options?.maxSize) this.maxSize = options.maxSize;
    if (options?.maxMemory) this.maxMemory = options.maxMemory;
  }

  /**
   * Get value from cache
   */
  get<T = any>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }

    // Check expiration
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }

    entry.hits++;
    this.stats.hits++;
    return entry.value as T;
  }

  /**
   * Set value in cache with TTL
   */
  set<T = any>(key: string, value: T, ttlSeconds = 300): void {
    // Check memory limits
    if (this.cache.size >= this.maxSize) {
      this.evictOldest();
    }

    // Estimate memory usage (rough approximation)
    const estimatedSize = JSON.stringify(value).length * 2; // UTF-16 bytes
    if (this.getMemoryUsage() + estimatedSize > this.maxMemory) {
      this.evictLargest();
    }

    const expires = Date.now() + (ttlSeconds * 1000);
    this.cache.set(key, { value, expires, hits: 0 });
  }

  /**
   * Get or set pattern - fetch if not cached
   */
  async getOrSet<T = any>(
    key: string,
    fetcher: () => Promise<T>,
    ttlSeconds = 300
  ): Promise<T> {
    const cached = this.get<T>(key);
    if (cached !== null) {
      return cached;
    }

    const value = await fetcher();
    this.set(key, value, ttlSeconds);
    return value;
  }

  /**
   * Delete from cache
   */
  delete(key: string): boolean {
    return this.cache.delete(key);
  }

  /**
   * Clear all cache
   */
  clear(): void {
    this.cache.clear();
    this.stats = { hits: 0, misses: 0 };
  }

  /**
   * Clear by namespace pattern
   */
  clearNamespace(namespace: string): number {
    let cleared = 0;
    for (const key of this.cache.keys()) {
      if (key.startsWith(`${namespace}:`)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    return cleared;
  }

  /**
   * Get cache statistics
   */
  getStats(): CacheStats {
    const total = this.stats.hits + this.stats.misses;
    return {
      size: this.cache.size,
      hits: this.stats.hits,
      misses: this.stats.misses,
      hitRate: total > 0 ? this.stats.hits / total : 0,
      memory: this.getMemoryUsage(),
    };
  }

  /**
   * Health check
   */
  async ping(): Promise<boolean> {
    try {
      const testKey = '__health_check__';
      this.set(testKey, 'ok', 1);
      const value = this.get(testKey);
      this.delete(testKey);
      return value === 'ok';
    } catch {
      return false;
    }
  }

  /**
   * Get all keys with optional pattern
   */
  keys(pattern?: string): string[] {
    const allKeys = Array.from(this.cache.keys());
    if (!pattern) return allKeys;
    
    return allKeys.filter(key => key.includes(pattern));
  }

  /**
   * Check if key exists
   */
  has(key: string): boolean {
    const entry = this.cache.get(key);
    if (!entry) return false;
    
    // Check expiration
    if (Date.now() > entry.expires) {
      this.cache.delete(key);
      return false;
    }
    
    return true;
  }

  /**
   * Get TTL for key
   */
  ttl(key: string): number {
    const entry = this.cache.get(key);
    if (!entry) return -1;
    
    const remaining = entry.expires - Date.now();
    return remaining > 0 ? Math.ceil(remaining / 1000) : -1;
  }

  /**
   * Batch operations
   */
  mget<T = any>(keys: string[]): (T | null)[] {
    return keys.map(key => this.get<T>(key));
  }

  mset<T = any>(entries: [string, T, number?][]): void {
    for (const [key, value, ttl] of entries) {
      this.set(key, value, ttl);
    }
  }

  // Private methods

  private evictOldest(): void {
    let oldestKey: string | null = null;
    let oldestTime = Infinity;

    for (const [key, entry] of this.cache.entries()) {
      if (entry.expires < oldestTime) {
        oldestTime = entry.expires;
        oldestKey = key;
      }
    }

    if (oldestKey) {
      this.cache.delete(oldestKey);
    }
  }

  private evictLargest(): void {
    let largestKey: string | null = null;
    let largestSize = 0;

    for (const [key, entry] of this.cache.entries()) {
      const size = JSON.stringify(entry.value).length;
      if (size > largestSize) {
        largestSize = size;
        largestKey = key;
      }
    }

    if (largestKey) {
      this.cache.delete(largestKey);
    }
  }

  private getMemoryUsage(): number {
    let total = 0;
    for (const entry of this.cache.values()) {
      total += JSON.stringify(entry.value).length * 2; // UTF-16 bytes
    }
    return total;
  }

  /**
   * Clean expired entries
   */
  cleanup(): number {
    let cleaned = 0;
    const now = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expires) {
        this.cache.delete(key);
        cleaned++;
      }
    }

    return cleaned;
  }
}

// Global edge cache instance
export const edgeCache = new EdgeCacheService({
  maxSize: 1000,
  maxMemory: 50 * 1024 * 1024, // 50MB
});

// Utility functions for common patterns
export const withCache = async <T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds = 300
): Promise<T> => {
  return edgeCache.getOrSet(key, fetcher, ttlSeconds);
};

export const cacheKey = (...parts: (string | number)[]): string => {
  return parts.join(':');
};

// Export for API routes
export default edgeCache;
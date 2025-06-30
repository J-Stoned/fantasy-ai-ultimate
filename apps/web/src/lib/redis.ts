/**
 * Redis Client with Fallback
 * 
 * Falls back to in-memory cache if Redis is not available
 * This ensures the app works even without Redis
 */

type CacheEntry = {
  value: string;
  expiry: number;
};

class RedisClient {
  private memoryCache: Map<string, CacheEntry> = new Map();
  private connected = false;

  constructor() {
    // In production, you'd connect to Redis here
    // For now, we'll use in-memory cache
    console.log('Redis client initialized (using in-memory cache)');
  }

  async get(key: string): Promise<string | null> {
    const entry = this.memoryCache.get(key);
    
    if (!entry) return null;
    
    if (Date.now() > entry.expiry) {
      this.memoryCache.delete(key);
      return null;
    }
    
    return entry.value;
  }

  async set(key: string, value: string): Promise<void> {
    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + 3600000 // 1 hour default
    });
  }

  async setex(key: string, seconds: number, value: string): Promise<void> {
    this.memoryCache.set(key, {
      value,
      expiry: Date.now() + (seconds * 1000)
    });
  }

  async del(key: string): Promise<void> {
    this.memoryCache.delete(key);
  }

  async expire(key: string, seconds: number): Promise<void> {
    const entry = this.memoryCache.get(key);
    if (entry) {
      entry.expiry = Date.now() + (seconds * 1000);
    }
  }

  async ttl(key: string): Promise<number> {
    const entry = this.memoryCache.get(key);
    if (!entry) return -2;
    
    const ttl = Math.floor((entry.expiry - Date.now()) / 1000);
    return ttl > 0 ? ttl : -1;
  }

  async ping(): Promise<string> {
    return 'PONG';
  }

  async flushall(): Promise<void> {
    this.memoryCache.clear();
  }

  // Clean up expired entries periodically
  private cleanup() {
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (now > entry.expiry) {
        this.memoryCache.delete(key);
      }
    }
  }
}

// Singleton instance
export const redis = new RedisClient();

// Optional: Connect to real Redis if available
if (process.env.REDIS_URL && typeof window === 'undefined') {
  // Server-side only
  import('ioredis').then(({ default: Redis }) => {
    const client = new Redis(process.env.REDIS_URL);
    
    client.on('connect', () => {
      console.log('Connected to Redis');
      // Replace methods with real Redis client
      (redis as any).get = client.get.bind(client);
      (redis as any).set = client.set.bind(client);
      (redis as any).setex = client.setex.bind(client);
      (redis as any).del = client.del.bind(client);
      (redis as any).expire = client.expire.bind(client);
      (redis as any).ttl = client.ttl.bind(client);
      (redis as any).ping = client.ping.bind(client);
      (redis as any).flushall = client.flushall.bind(client);
    });
    
    client.on('error', (err) => {
      console.warn('Redis connection error, falling back to memory cache:', err.message);
    });
  }).catch(() => {
    console.log('Redis not available, using in-memory cache');
  });
}
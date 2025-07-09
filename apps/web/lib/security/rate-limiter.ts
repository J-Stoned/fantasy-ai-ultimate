import { NextRequest } from 'next/server';
import { createClient } from 'redis';

export interface RateLimitConfig {
  max: number;
  windowMs: number;
}

export class RateLimiter {
  private redis: ReturnType<typeof createClient> | null = null;
  private config: RateLimitConfig;
  private memoryStore: Map<string, { count: number; resetTime: number }> = new Map();
  
  constructor(config: RateLimitConfig) {
    this.config = config;
    this.initRedis();
  }
  
  private async initRedis() {
    try {
      if (process.env.REDIS_URL) {
        this.redis = createClient({ url: process.env.REDIS_URL });
        await this.redis.connect();
      }
    } catch (error) {
      console.warn('Redis connection failed, falling back to memory store:', error);
      this.redis = null;
    }
  }
  
  async check(req: NextRequest): Promise<boolean> {
    const identifier = this.getIdentifier(req);
    const now = Date.now();
    
    if (this.redis) {
      return this.checkRedis(identifier, now);
    } else {
      return this.checkMemory(identifier, now);
    }
  }
  
  private getIdentifier(req: NextRequest): string {
    // Use IP address or user ID as identifier
    const forwarded = req.headers.get('x-forwarded-for');
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown';
    return `rate-limit:${req.nextUrl.pathname}:${ip}`;
  }
  
  private async checkRedis(key: string, now: number): Promise<boolean> {
    try {
      const windowStart = now - this.config.windowMs;
      
      // Remove old entries
      await this.redis!.zRemRangeByScore(key, '-inf', windowStart.toString());
      
      // Count current entries
      const count = await this.redis!.zCard(key);
      
      if (count >= this.config.max) {
        return false;
      }
      
      // Add new entry
      await this.redis!.zAdd(key, { score: now, value: now.toString() });
      await this.redis!.expire(key, Math.ceil(this.config.windowMs / 1000));
      
      return true;
    } catch (error) {
      console.error('Redis rate limit error:', error);
      // Fail open on Redis errors
      return true;
    }
  }
  
  private checkMemory(key: string, now: number): boolean {
    const record = this.memoryStore.get(key);
    
    if (!record || now > record.resetTime) {
      this.memoryStore.set(key, {
        count: 1,
        resetTime: now + this.config.windowMs
      });
      return true;
    }
    
    if (record.count >= this.config.max) {
      return false;
    }
    
    record.count++;
    return true;
  }
  
  // Clean up old entries periodically
  startCleanup() {
    setInterval(() => {
      const now = Date.now();
      for (const [key, record] of this.memoryStore.entries()) {
        if (now > record.resetTime) {
          this.memoryStore.delete(key);
        }
      }
    }, 60000); // Clean every minute
  }
}
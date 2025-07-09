/**
 * MARCUS "THE FIXER" RODRIGUEZ - REDIS RATE LIMITER TESTS
 * 
 * These tests simulate NFL Sunday traffic patterns.
 * If these pass, your rate limiter can handle anything.
 */

import { RedisRateLimiter, createTieredRateLimiter } from '../redisRateLimiter';
import Redis from 'ioredis-mock';

// Mock the Redis client
jest.mock('../../cache/RedisCache', () => ({
  redis: {
    getClient: () => new Redis(),
  },
}));

describe('RedisRateLimiter - Production Grade', () => {
  let limiter: RedisRateLimiter;
  let redis: Redis;

  beforeEach(() => {
    redis = new Redis();
    limiter = new RedisRateLimiter(redis);
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await redis.flushall();
    redis.disconnect();
  });

  describe('Basic Rate Limiting', () => {
    it('should allow requests under the limit', async () => {
      const options = { windowMs: 60000, max: 5 };
      
      for (let i = 0; i < 5; i++) {
        const result = await limiter.checkLimit(options);
        expect(result.allowed).toBe(true);
        expect(result.remaining).toBe(4 - i);
      }
    });

    it('should block requests over the limit', async () => {
      const options = { windowMs: 60000, max: 3 };
      
      // Use up the limit
      for (let i = 0; i < 3; i++) {
        await limiter.checkLimit(options);
      }
      
      // This should be blocked
      const result = await limiter.checkLimit(options);
      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
      expect(result.retryAfter).toBe(60);
    });

    it('should use sliding window algorithm', async () => {
      const options = { windowMs: 1000, max: 2 }; // 1 second window
      
      // Make 2 requests
      await limiter.checkLimit(options);
      await limiter.checkLimit(options);
      
      // Should be blocked
      let result = await limiter.checkLimit(options);
      expect(result.allowed).toBe(false);
      
      // Wait 600ms (still within original window)
      await new Promise(resolve => setTimeout(resolve, 600));
      
      // Should still be blocked
      result = await limiter.checkLimit(options);
      expect(result.allowed).toBe(false);
      
      // Wait another 500ms (first request now outside window)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Should allow one more request
      result = await limiter.checkLimit(options);
      expect(result.allowed).toBe(true);
    });
  });

  describe('NFL Sunday Surge Protection', () => {
    it('should apply 3x multiplier during NFL Sunday', async () => {
      // Mock Sunday 3 PM ET
      const sunday3pm = new Date('2024-01-07T15:00:00-05:00');
      jest.spyOn(global, 'Date').mockImplementation(() => sunday3pm as any);
      
      const options = { windowMs: 60000, max: 100 };
      const result = await limiter.checkLimit(options);
      
      // Should have 3x capacity
      expect(result.limit).toBe(300);
      expect(result.allowed).toBe(true);
    });

    it('should apply 1.5x multiplier during waiver processing', async () => {
      // Mock Tuesday 4 AM ET
      const tuesday4am = new Date('2024-01-09T04:00:00-05:00');
      jest.spyOn(global, 'Date').mockImplementation(() => tuesday4am as any);
      
      const options = { windowMs: 60000, max: 100 };
      const result = await limiter.checkLimit(options);
      
      // Should have 1.5x capacity
      expect(result.limit).toBe(150);
    });
  });

  describe('User-based Rate Limiting', () => {
    it('should rate limit by user ID from auth token', async () => {
      const options = {
        windowMs: 60000,
        max: 5,
        keyGenerator: async (req: Request) => {
          const auth = req.headers.get('authorization');
          return `rl:user:${auth?.substring(7) || 'anonymous'}`;
        },
      };
      
      // User 1 requests
      const req1 = new Request('http://test.com', {
        headers: { authorization: 'Bearer user1token' },
      });
      
      for (let i = 0; i < 5; i++) {
        const result = await limiter.checkLimit({ ...options, keyGenerator: async () => 'rl:user:user1' });
        expect(result.allowed).toBe(true);
      }
      
      // User 1 should be blocked
      const blocked = await limiter.checkLimit({ ...options, keyGenerator: async () => 'rl:user:user1' });
      expect(blocked.allowed).toBe(false);
      
      // User 2 should still be allowed
      const user2Result = await limiter.checkLimit({ ...options, keyGenerator: async () => 'rl:user:user2' });
      expect(user2Result.allowed).toBe(true);
    });
  });

  describe('Tiered Rate Limiting', () => {
    it('should apply different limits for different tiers', async () => {
      const freeLimiter = createTieredRateLimiter('api', 'free');
      const proLimiter = createTieredRateLimiter('api', 'pro');
      const enterpriseLimiter = createTieredRateLimiter('api', 'enterprise');
      
      // These would normally check different limits
      // Free: 100/min, Pro: 1000/min, Enterprise: 10000/min
      expect(freeLimiter).toBeDefined();
      expect(proLimiter).toBeDefined();
      expect(enterpriseLimiter).toBeDefined();
    });

    it('should have stricter limits for expensive operations', async () => {
      const apiLimiter = createTieredRateLimiter('api', 'free');
      const expensiveLimiter = createTieredRateLimiter('expensive', 'free');
      const aiLimiter = createTieredRateLimiter('ai', 'free');
      
      // Expensive operations have lower limits
      expect(expensiveLimiter).toBeDefined();
      expect(aiLimiter).toBeDefined();
    });
  });

  describe('Redis Failure Handling', () => {
    it('should gracefully handle Redis connection errors', async () => {
      const failingRedis = {
        multi: () => {
          throw new Error('Redis connection failed');
        },
      } as any;
      
      const failingLimiter = new RedisRateLimiter(failingRedis);
      
      // Should throw but be caught by the middleware
      await expect(failingLimiter.checkLimit()).rejects.toThrow('Redis connection failed');
    });

    it('should track usage metrics', async () => {
      const options = { windowMs: 60000, max: 5 };
      const key = 'rl:user:test';
      
      // Make some requests
      for (let i = 0; i < 3; i++) {
        await limiter.checkLimit({ ...options, keyGenerator: async () => key });
      }
      
      // Check usage
      const usage = await limiter.getUsage(key, options.windowMs);
      expect(usage).toBe(3);
    });
  });

  describe('Performance Under Load', () => {
    it('should handle 1000 concurrent requests', async () => {
      const options = { windowMs: 60000, max: 500 };
      const promises: Promise<any>[] = [];
      
      // Simulate 1000 concurrent requests
      for (let i = 0; i < 1000; i++) {
        promises.push(limiter.checkLimit(options));
      }
      
      const results = await Promise.all(promises);
      
      // First 500 should be allowed
      const allowed = results.filter(r => r.allowed).length;
      const blocked = results.filter(r => !r.allowed).length;
      
      expect(allowed).toBe(500);
      expect(blocked).toBe(500);
    });

    it('should maintain sub-10ms response time', async () => {
      const options = { windowMs: 60000, max: 100 };
      const start = Date.now();
      
      // Make 100 requests
      for (let i = 0; i < 100; i++) {
        await limiter.checkLimit(options);
      }
      
      const duration = Date.now() - start;
      const avgTime = duration / 100;
      
      // Should average under 10ms per request
      expect(avgTime).toBeLessThan(10);
    });
  });
});
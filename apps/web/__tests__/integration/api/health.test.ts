/**
 * Integration tests for health check API endpoint
 * Critical for production monitoring and load balancer health checks
 */

import { NextRequest } from 'next/server';
import { GET } from '@/app/api/health/route';

// Mock database connection
jest.mock('@/lib/database/admin-database', () => ({
  executeQuery: jest.fn(),
}));

// Mock Redis connection
jest.mock('@/lib/redis', () => ({
  redis: {
    ping: jest.fn(),
  },
}));

describe('/api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('GET /api/health', () => {
    test('should return healthy status when all services are up', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      // Mock successful database connection
      executeQuery.mockResolvedValueOnce([{ now: new Date() }]);
      
      // Mock successful Redis connection
      redis.ping.mockResolvedValueOnce('PONG');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.status).toBe(200);
      
      const data = await response.json();
      expect(data).toEqual({
        status: 'healthy',
        timestamp: expect.any(String),
        uptime: expect.any(Number),
        services: {
          database: 'healthy',
          redis: 'healthy',
          memory: expect.objectContaining({
            used: expect.any(Number),
            total: expect.any(Number),
            percentage: expect.any(Number),
          }),
        },
        version: expect.any(String),
      });
    });

    test('should return degraded status when database is down', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      // Mock database connection failure
      executeQuery.mockRejectedValueOnce(new Error('Database connection failed'));
      
      // Mock successful Redis connection
      redis.ping.mockResolvedValueOnce('PONG');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.status).toBe(503);
      
      const data = await response.json();
      expect(data.status).toBe('degraded');
      expect(data.services.database).toBe('unhealthy');
    });

    test('should return degraded status when Redis is down', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      // Mock successful database connection
      executeQuery.mockResolvedValueOnce([{ now: new Date() }]);
      
      // Mock Redis connection failure
      redis.ping.mockRejectedValueOnce(new Error('Redis connection failed'));

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.status).toBe(503);
      
      const data = await response.json();
      expect(data.status).toBe('degraded');
      expect(data.services.redis).toBe('unhealthy');
    });

    test('should return unhealthy status when both services are down', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      // Mock both services failing
      executeQuery.mockRejectedValueOnce(new Error('Database connection failed'));
      redis.ping.mockRejectedValueOnce(new Error('Redis connection failed'));

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.status).toBe(503);
      
      const data = await response.json();
      expect(data.status).toBe('unhealthy');
      expect(data.services.database).toBe('unhealthy');
      expect(data.services.redis).toBe('unhealthy');
    });

    test('should include memory usage information', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      executeQuery.mockResolvedValueOnce([{ now: new Date() }]);
      redis.ping.mockResolvedValueOnce('PONG');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      const data = await response.json();
      
      expect(data.services.memory).toEqual({
        used: expect.any(Number),
        total: expect.any(Number),
        percentage: expect.any(Number),
      });

      // Memory percentage should be between 0 and 100
      expect(data.services.memory.percentage).toBeGreaterThanOrEqual(0);
      expect(data.services.memory.percentage).toBeLessThanOrEqual(100);
    });

    test('should include uptime information', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      executeQuery.mockResolvedValueOnce([{ now: new Date() }]);
      redis.ping.mockResolvedValueOnce('PONG');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      const data = await response.json();
      
      expect(data.uptime).toBeGreaterThan(0);
      expect(typeof data.uptime).toBe('number');
    });

    test('should include version information', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      executeQuery.mockResolvedValueOnce([{ now: new Date() }]);
      redis.ping.mockResolvedValueOnce('PONG');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      const data = await response.json();
      
      expect(data.version).toBeDefined();
      expect(typeof data.version).toBe('string');
    });

    test('should respond within acceptable time limit', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      executeQuery.mockResolvedValueOnce([{ now: new Date() }]);
      redis.ping.mockResolvedValueOnce('PONG');

      const startTime = Date.now();
      
      const request = new NextRequest('http://localhost:3000/api/health');
      await GET(request);

      const responseTime = Date.now() - startTime;
      
      // Health check should respond within 1 second
      expect(responseTime).toBeLessThan(1000);
    });

    test('should handle concurrent health check requests', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      executeQuery.mockResolvedValue([{ now: new Date() }]);
      redis.ping.mockResolvedValue('PONG');

      // Make 10 concurrent requests
      const requests = Array(10).fill(null).map(() => {
        const request = new NextRequest('http://localhost:3000/api/health');
        return GET(request);
      });

      const responses = await Promise.all(requests);

      // All requests should succeed
      responses.forEach(response => {
        expect(response.status).toBe(200);
      });

      // Database should be called for each request
      expect(executeQuery).toHaveBeenCalledTimes(10);
      expect(redis.ping).toHaveBeenCalledTimes(10);
    });

    test('should not leak sensitive information in error responses', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      // Mock database connection with sensitive error
      executeQuery.mockRejectedValueOnce(new Error('Connection failed: password=secret123'));
      redis.ping.mockResolvedValueOnce('PONG');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      const data = await response.json();
      const responseText = JSON.stringify(data);
      
      // Should not contain sensitive information
      expect(responseText).not.toContain('password');
      expect(responseText).not.toContain('secret123');
    });

    test('should handle timeout scenarios gracefully', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      // Mock slow database response
      executeQuery.mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve([{ now: new Date() }]), 2000))
      );
      redis.ping.mockResolvedValueOnce('PONG');

      const request = new NextRequest('http://localhost:3000/api/health');
      const startTime = Date.now();
      
      const response = await GET(request);
      const responseTime = Date.now() - startTime;
      const data = await response.json();

      // Should still respond (might be degraded due to slow DB)
      expect(response.status).toBeGreaterThanOrEqual(200);
      expect(response.status).toBeLessThan(600);
      expect(data.status).toBeDefined();
    });
  });

  describe('Error Handling', () => {
    test('should handle unexpected errors gracefully', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      // Mock unexpected error
      executeQuery.mockImplementation(() => {
        throw new TypeError('Unexpected error type');
      });
      redis.ping.mockResolvedValueOnce('PONG');

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      expect(response.status).toBe(503);
      
      const data = await response.json();
      expect(data.status).toBe('degraded');
    });

    test('should maintain proper response structure even on errors', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      executeQuery.mockRejectedValueOnce(new Error('Database error'));
      redis.ping.mockRejectedValueOnce(new Error('Redis error'));

      const request = new NextRequest('http://localhost:3000/api/health');
      const response = await GET(request);

      const data = await response.json();
      
      // Should still have proper structure
      expect(data).toHaveProperty('status');
      expect(data).toHaveProperty('timestamp');
      expect(data).toHaveProperty('uptime');
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('version');
    });
  });

  describe('Performance Tests', () => {
    test('should maintain performance under load', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      executeQuery.mockResolvedValue([{ now: new Date() }]);
      redis.ping.mockResolvedValue('PONG');

      const startTime = Date.now();
      
      // Make 50 sequential requests
      for (let i = 0; i < 50; i++) {
        const request = new NextRequest('http://localhost:3000/api/health');
        await GET(request);
      }

      const totalTime = Date.now() - startTime;
      const averageTime = totalTime / 50;

      // Average response time should be reasonable
      expect(averageTime).toBeLessThan(100); // 100ms average
    });

    test('should not consume excessive memory', async () => {
      const { executeQuery } = require('@/lib/database/admin-database');
      const { redis } = require('@/lib/redis');

      executeQuery.mockResolvedValue([{ now: new Date() }]);
      redis.ping.mockResolvedValue('PONG');

      const initialMemory = process.memoryUsage();

      // Make many requests
      for (let i = 0; i < 100; i++) {
        const request = new NextRequest('http://localhost:3000/api/health');
        await GET(request);
      }

      const finalMemory = process.memoryUsage();
      const memoryIncrease = finalMemory.heapUsed - initialMemory.heapUsed;

      // Memory increase should be reasonable (< 10MB)
      expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024);
    });
  });
});
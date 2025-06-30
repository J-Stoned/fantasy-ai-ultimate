import { GET, HEAD } from '../health/route'
import { NextRequest } from 'next/server'

// Mock Supabase
jest.mock('@/lib/supabase/server', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        limit: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({ 
            data: { id: 'test-player' }, 
            error: null 
          })),
        })),
      })),
    })),
  })),
}))

// Mock Redis
jest.mock('redis', () => ({
  createClient: jest.fn(() => ({
    connect: jest.fn(() => Promise.resolve()),
    ping: jest.fn(() => Promise.resolve('PONG')),
    disconnect: jest.fn(() => Promise.resolve()),
  })),
}))

describe('Health Check API', () => {
  const originalEnv = process.env
  
  beforeEach(() => {
    jest.clearAllMocks()
    // Reset environment
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('GET /api/health', () => {
    it('should return healthy status when all checks pass', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379'
      
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.checks.database.status).toBe('pass')
      expect(data.checks.redis.status).toBe('pass')
      expect(data.checks.memory.status).toBe('pass')
      expect(data.timestamp).toBeDefined()
      expect(data.uptime).toBeGreaterThan(0)
      expect(data.version).toBeDefined()
    })

    it('should return unhealthy when database check fails', async () => {
      // Mock database error
      const { createClient } = require('@/lib/supabase/server')
      createClient.mockReturnValueOnce({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ 
                data: null, 
                error: new Error('Database connection failed') 
              })),
            })),
          })),
        })),
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.checks.database.status).toBe('fail')
      expect(data.checks.database.error).toContain('Database connection failed')
    })

    it('should skip Redis check when not configured', async () => {
      delete process.env.REDIS_URL
      
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.checks.redis.status).toBe('pass')
      expect(data.checks.redis.responseTime).toBe(0)
    })

    it('should return unhealthy when Redis fails', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379'
      
      // Mock Redis error
      const redis = require('redis')
      redis.createClient.mockReturnValueOnce({
        connect: jest.fn(() => Promise.reject(new Error('Redis connection failed'))),
        disconnect: jest.fn(),
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
      expect(data.checks.redis.status).toBe('fail')
      expect(data.checks.redis.error).toContain('Redis connection failed')
    })

    it('should detect high memory usage', async () => {
      // Mock high memory usage
      const originalMemoryUsage = process.memoryUsage
      process.memoryUsage = jest.fn(() => ({
        heapUsed: 900 * 1024 * 1024, // 900MB
        heapTotal: 1000 * 1024 * 1024, // 1000MB
        rss: 1200 * 1024 * 1024,
        external: 50 * 1024 * 1024,
        arrayBuffers: 10 * 1024 * 1024,
      }))

      const response = await GET()
      const data = await response.json()

      expect(data.checks.memory.status).toBe('fail')
      expect(data.checks.memory.error).toContain('High memory usage')
      expect(data.checks.memory.error).toContain('90.0%')

      process.memoryUsage = originalMemoryUsage
    })

    it('should include proper cache headers', async () => {
      const response = await GET()
      
      expect(response.headers.get('Cache-Control')).toBe('no-cache, no-store, must-revalidate')
    })

    it('should handle database no rows as healthy', async () => {
      // Mock PGRST116 error (no rows returned)
      const { createClient } = require('@/lib/supabase/server')
      createClient.mockReturnValueOnce({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            limit: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({ 
                data: null, 
                error: { code: 'PGRST116', message: 'No rows found' } 
              })),
            })),
          })),
        })),
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.status).toBe('healthy')
      expect(data.checks.database.status).toBe('pass')
    })

    it('should measure response times', async () => {
      const response = await GET()
      const data = await response.json()

      expect(data.checks.database.responseTime).toBeGreaterThanOrEqual(0)
      expect(data.checks.redis.responseTime).toBeGreaterThanOrEqual(0)
    })
  })

  describe('HEAD /api/health', () => {
    it('should return 200 for liveness check', async () => {
      const response = await HEAD()
      
      expect(response.status).toBe(200)
      expect(response.body).toBeNull()
    })

    it('should be fast', async () => {
      const start = Date.now()
      await HEAD()
      const duration = Date.now() - start
      
      expect(duration).toBeLessThan(50) // Should be very fast
    })
  })

  describe('Concurrent health checks', () => {
    it('should handle multiple concurrent requests', async () => {
      const requests = Array(10).fill(null).map(() => GET())
      const responses = await Promise.all(requests)
      
      expect(responses).toHaveLength(10)
      expect(responses.every(r => r.status === 200 || r.status === 503)).toBe(true)
    })
  })

  describe('Error scenarios', () => {
    it('should handle unexpected errors gracefully', async () => {
      // Mock an unexpected error
      const { createClient } = require('@/lib/supabase/server')
      createClient.mockImplementationOnce(() => {
        throw new Error('Unexpected error')
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.status).toBe('unhealthy')
    })

    it('should clean up Redis connection on error', async () => {
      process.env.REDIS_URL = 'redis://localhost:6379'
      
      const mockDisconnect = jest.fn()
      const redis = require('redis')
      redis.createClient.mockReturnValueOnce({
        connect: jest.fn(() => Promise.resolve()),
        ping: jest.fn(() => Promise.reject(new Error('Ping failed'))),
        disconnect: mockDisconnect,
      })

      await GET()

      expect(mockDisconnect).toHaveBeenCalled()
    })
  })
})
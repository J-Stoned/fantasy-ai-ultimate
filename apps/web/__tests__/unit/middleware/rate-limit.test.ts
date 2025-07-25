import { rateLimitMiddleware } from '@/lib/middleware/rate-limit'
import { createMocks } from 'node-mocks-http'

// Mock Redis
const mockRedis = {
  get: jest.fn(),
  set: jest.fn(),
  incr: jest.fn(),
  expire: jest.fn(),
  del: jest.fn(),
}

jest.mock('@/lib/redis', () => ({
  redis: mockRedis
}))

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('should allow requests within rate limit', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'x-forwarded-for': '192.168.1.1'
      }
    })

    // Mock no existing rate limit data
    mockRedis.get.mockResolvedValue(null)
    mockRedis.incr.mockResolvedValue(1)

    const result = await rateLimitMiddleware(req, res, {
      windowMs: 60000,
      maxRequests: 10,
      keyGenerator: (req) => req.headers['x-forwarded-for'] as string
    })

    expect(result.allowed).toBe(true)
    expect(result.remaining).toBe(9)
    expect(mockRedis.incr).toHaveBeenCalled()
    expect(mockRedis.expire).toHaveBeenCalled()
  })

  it('should block requests exceeding rate limit', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: {
        'x-forwarded-for': '192.168.1.1'
      }
    })

    // Mock rate limit exceeded
    mockRedis.get.mockResolvedValue('11') // Over the limit
    mockRedis.incr.mockResolvedValue(12)

    const result = await rateLimitMiddleware(req, res, {
      windowMs: 60000,
      maxRequests: 10,
      keyGenerator: (req) => req.headers['x-forwarded-for'] as string
    })

    expect(result.allowed).toBe(false)
    expect(result.remaining).toBe(0)
    expect(result.resetTime).toBeDefined()
  })

  it('should use different limits for different endpoints', async () => {
    const { req: loginReq, res: loginRes } = createMocks({
      method: 'POST',
      url: '/api/auth/login',
      headers: { 'x-forwarded-for': '192.168.1.1' }
    })

    const { req: generalReq, res: generalRes } = createMocks({
      method: 'GET',
      url: '/api/players',
      headers: { 'x-forwarded-for': '192.168.1.1' }
    })

    mockRedis.get.mockResolvedValue(null)
    mockRedis.incr.mockResolvedValue(1)

    // Login endpoint should have stricter limits
    const loginResult = await rateLimitMiddleware(loginReq, loginRes, {
      windowMs: 900000, // 15 minutes
      maxRequests: 5, // Strict limit for auth
      keyGenerator: (req) => `login:${req.headers['x-forwarded-for']}`
    })

    // General endpoint should have more lenient limits
    const generalResult = await rateLimitMiddleware(generalReq, generalRes, {
      windowMs: 60000, // 1 minute
      maxRequests: 100, // More lenient
      keyGenerator: (req) => `general:${req.headers['x-forwarded-for']}`
    })

    expect(loginResult.allowed).toBe(true)
    expect(loginResult.remaining).toBe(4) // Stricter limit
    expect(generalResult.allowed).toBe(true)
    expect(generalResult.remaining).toBe(99) // More lenient
  })

  it('should handle Redis connection errors gracefully', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-forwarded-for': '192.168.1.1' }
    })

    // Mock Redis error
    mockRedis.get.mockRejectedValue(new Error('Redis connection failed'))

    const result = await rateLimitMiddleware(req, res, {
      windowMs: 60000,
      maxRequests: 10,
      keyGenerator: (req) => req.headers['x-forwarded-for'] as string
    })

    // Should allow request when Redis fails (fail open for availability)
    expect(result.allowed).toBe(true)
  })

  it('should generate appropriate keys for different scenarios', async () => {
    const scenarios = [
      {
        headers: { 'x-forwarded-for': '192.168.1.1' },
        expectedKey: '192.168.1.1'
      },
      {
        headers: { 'x-forwarded-for': '192.168.1.1, 10.0.0.1' },
        expectedKey: '192.168.1.1' // Should use first IP
      },
      {
        headers: { 'x-real-ip': '203.0.113.1' },
        connection: { remoteAddress: '192.168.1.1' },
        expectedKey: '203.0.113.1'
      }
    ]

    for (const scenario of scenarios) {
      const { req, res } = createMocks({
        method: 'POST',
        headers: scenario.headers,
        connection: scenario.connection
      })

      mockRedis.get.mockResolvedValue(null)
      mockRedis.incr.mockResolvedValue(1)

      await rateLimitMiddleware(req, res, {
        windowMs: 60000,
        maxRequests: 10,
        keyGenerator: (req) => {
          const forwarded = req.headers['x-forwarded-for'] as string
          const realIp = req.headers['x-real-ip'] as string
          const remoteIp = req.connection?.remoteAddress
          
          return forwarded?.split(',')[0].trim() || realIp || remoteIp || 'unknown'
        }
      })

      // Verify correct key was used
      const expectedKey = expect.stringContaining(scenario.expectedKey)
      expect(mockRedis.incr).toHaveBeenCalledWith(expectedKey)
    }
  })

  it('should respect different time windows', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-forwarded-for': '192.168.1.1' }
    })

    mockRedis.get.mockResolvedValue(null)
    mockRedis.incr.mockResolvedValue(1)

    // Test short window
    await rateLimitMiddleware(req, res, {
      windowMs: 60000, // 1 minute
      maxRequests: 10,
      keyGenerator: (req) => req.headers['x-forwarded-for'] as string
    })

    expect(mockRedis.expire).toHaveBeenCalledWith(
      expect.any(String),
      60 // 60 seconds
    )

    mockRedis.expire.mockClear()

    // Test long window
    await rateLimitMiddleware(req, res, {
      windowMs: 3600000, // 1 hour
      maxRequests: 1000,
      keyGenerator: (req) => req.headers['x-forwarded-for'] as string
    })

    expect(mockRedis.expire).toHaveBeenCalledWith(
      expect.any(String),
      3600 // 3600 seconds
    )
  })

  it('should provide accurate reset time information', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-forwarded-for': '192.168.1.1' }
    })

    // Mock existing counter near expiry
    const mockTtl = 30 // 30 seconds remaining
    mockRedis.get.mockResolvedValue('5')
    mockRedis.incr.mockResolvedValue(6)
    
    const currentTime = Date.now()
    const result = await rateLimitMiddleware(req, res, {
      windowMs: 60000,
      maxRequests: 10,
      keyGenerator: (req) => req.headers['x-forwarded-for'] as string
    })

    expect(result.resetTime).toBeGreaterThan(currentTime)
    expect(result.resetTime).toBeLessThanOrEqual(currentTime + 60000)
  })

  it('should handle burst protection', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 'x-forwarded-for': '192.168.1.1' }
    })

    // Simulate rapid requests
    const requests = Array.from({ length: 15 }, (_, i) => {
      mockRedis.get.mockResolvedValueOnce(i.toString())
      mockRedis.incr.mockResolvedValueOnce(i + 1)
      
      return rateLimitMiddleware(req, res, {
        windowMs: 60000,
        maxRequests: 10,
        keyGenerator: (req) => req.headers['x-forwarded-for'] as string
      })
    })

    const results = await Promise.all(requests)

    // First 10 should be allowed
    results.slice(0, 10).forEach(result => {
      expect(result.allowed).toBe(true)
    })

    // Remaining should be blocked
    results.slice(10).forEach(result => {
      expect(result.allowed).toBe(false)
    })
  })

  it('should handle whitelist/bypass scenarios', async () => {
    const { req, res } = createMocks({
      method: 'POST',
      headers: { 
        'x-forwarded-for': '127.0.0.1', // Localhost
        'user-agent': 'HealthChecker/1.0'
      }
    })

    const result = await rateLimitMiddleware(req, res, {
      windowMs: 60000,
      maxRequests: 10,
      keyGenerator: (req) => req.headers['x-forwarded-for'] as string,
      skip: (req) => {
        const ip = req.headers['x-forwarded-for'] as string
        const userAgent = req.headers['user-agent'] as string
        
        // Skip rate limiting for localhost and health checkers
        return ip === '127.0.0.1' || userAgent?.includes('HealthChecker')
      }
    })

    expect(result.allowed).toBe(true)
    expect(mockRedis.incr).not.toHaveBeenCalled() // Should not increment counter
  })
})
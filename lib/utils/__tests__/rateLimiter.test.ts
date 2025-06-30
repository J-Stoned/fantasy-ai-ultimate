import { createRateLimiter, rateLimiters, withRateLimit } from '../rateLimiter'

describe('RateLimiter', () => {
  let mockRequest: Request

  beforeEach(() => {
    // Clear rate limit store between tests
    jest.useFakeTimers()
    
    // Create mock request
    mockRequest = {
      headers: new Headers({
        'x-forwarded-for': '192.168.1.1',
      }),
    } as Request
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  describe('createRateLimiter', () => {
    it('should allow requests within rate limit', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
      })

      // Make 5 requests - all should pass
      for (let i = 0; i < 5; i++) {
        const result = await limiter(mockRequest)
        expect(result.allowed).toBe(true)
        expect(result.message).toBeUndefined()
      }
    })

    it('should block requests exceeding rate limit', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 3,
        message: 'Custom rate limit message',
      })

      // Make 3 allowed requests
      for (let i = 0; i < 3; i++) {
        const result = await limiter(mockRequest)
        expect(result.allowed).toBe(true)
      }

      // 4th request should be blocked
      const result = await limiter(mockRequest)
      expect(result.allowed).toBe(false)
      expect(result.message).toBe('Custom rate limit message')
    })

    it('should reset rate limit after window expires', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000, // 1 minute
        max: 2,
      })

      // Use up the limit
      await limiter(mockRequest)
      await limiter(mockRequest)
      
      // Should be blocked
      let result = await limiter(mockRequest)
      expect(result.allowed).toBe(false)

      // Advance time past the window
      jest.advanceTimersByTime(61000)

      // Should be allowed again
      result = await limiter(mockRequest)
      expect(result.allowed).toBe(true)
    })

    it('should track different IPs separately', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 1,
      })

      // First IP
      const request1 = {
        headers: new Headers({ 'x-forwarded-for': '192.168.1.1' }),
      } as Request
      
      // Second IP
      const request2 = {
        headers: new Headers({ 'x-forwarded-for': '192.168.1.2' }),
      } as Request

      // Both should be allowed their first request
      expect((await limiter(request1)).allowed).toBe(true)
      expect((await limiter(request2)).allowed).toBe(true)

      // Both should be blocked on second request
      expect((await limiter(request1)).allowed).toBe(false)
      expect((await limiter(request2)).allowed).toBe(false)
    })

    it('should handle missing IP headers gracefully', async () => {
      const limiter = createRateLimiter({ max: 1 })
      
      const requestNoHeaders = {
        headers: new Headers(),
      } as Request

      const result = await limiter(requestNoHeaders)
      expect(result.allowed).toBe(true)
      
      // Should still track even with 'unknown' key
      const result2 = await limiter(requestNoHeaders)
      expect(result2.allowed).toBe(false)
    })

    it('should use custom key generator', async () => {
      const customKeyGen = jest.fn((req: Request) => {
        const userId = req.headers.get('user-id')
        return userId || 'anonymous'
      })

      const limiter = createRateLimiter({
        max: 1,
        keyGenerator: customKeyGen,
      })

      const userRequest = {
        headers: new Headers({ 'user-id': 'user-123' }),
      } as Request

      await limiter(userRequest)
      
      expect(customKeyGen).toHaveBeenCalledWith(userRequest)
      expect(customKeyGen).toHaveReturnedWith('user-123')
    })

    it('should clean up expired entries', async () => {
      const limiter = createRateLimiter({
        windowMs: 1000, // 1 second
        max: 1,
      })

      // Create entries for different IPs
      for (let i = 0; i < 5; i++) {
        const req = {
          headers: new Headers({ 'x-forwarded-for': `192.168.1.${i}` }),
        } as Request
        await limiter(req)
      }

      // Advance time to expire entries
      jest.advanceTimersByTime(2000)

      // New request should trigger cleanup
      const newReq = {
        headers: new Headers({ 'x-forwarded-for': '10.0.0.1' }),
      } as Request
      
      const result = await limiter(newReq)
      expect(result.allowed).toBe(true)
      
      // Old entries should be cleaned up (implementation detail)
      // We can't directly test the store, but no memory leak should occur
    })
  })

  describe('Pre-configured rate limiters', () => {
    it('auth limiter should have strict limits', async () => {
      const authLimiter = rateLimiters.auth

      // Should allow 5 attempts
      for (let i = 0; i < 5; i++) {
        const result = await authLimiter(mockRequest)
        expect(result.allowed).toBe(true)
      }

      // 6th should fail
      const result = await authLimiter(mockRequest)
      expect(result.allowed).toBe(false)
      expect(result.message).toContain('authentication')
    })

    it('api limiter should have moderate limits', async () => {
      const apiLimiter = rateLimiters.api

      // Should allow many requests
      for (let i = 0; i < 50; i++) {
        const result = await apiLimiter(mockRequest)
        expect(result.allowed).toBe(true)
      }
    })

    it('expensive limiter should have strict limits', async () => {
      const expensiveLimiter = rateLimiters.expensive

      // Should allow only 10 requests per minute
      for (let i = 0; i < 10; i++) {
        const result = await expensiveLimiter(mockRequest)
        expect(result.allowed).toBe(true)
      }

      const result = await expensiveLimiter(mockRequest)
      expect(result.allowed).toBe(false)
    })

    it('webhook limiter should have specific limits', async () => {
      const webhookLimiter = rateLimiters.webhook

      // Should allow 20 requests per minute
      for (let i = 0; i < 20; i++) {
        const result = await webhookLimiter(mockRequest)
        expect(result.allowed).toBe(true)
      }

      const result = await webhookLimiter(mockRequest)
      expect(result.allowed).toBe(false)
    })
  })

  describe('withRateLimit helper', () => {
    it('should execute handler when rate limit allows', async () => {
      const mockHandler = jest.fn(async () => 
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )

      const response = await withRateLimit(mockRequest, mockHandler)

      expect(mockHandler).toHaveBeenCalled()
      expect(response.status).toBe(200)
      
      const data = await response.json()
      expect(data.success).toBe(true)
    })

    it('should return 429 when rate limit exceeded', async () => {
      const mockHandler = jest.fn(async () => 
        new Response(JSON.stringify({ success: true }), { status: 200 })
      )

      // Use a limiter with max 1
      const strictLimiter = createRateLimiter({ max: 1 })

      // First request succeeds
      await withRateLimit(mockRequest, mockHandler, strictLimiter)

      // Second request should be rate limited
      const response = await withRateLimit(mockRequest, mockHandler, strictLimiter)

      expect(mockHandler).toHaveBeenCalledTimes(1) // Not called for second request
      expect(response.status).toBe(429)
      expect(response.headers.get('Content-Type')).toBe('application/json')
      expect(response.headers.get('Retry-After')).toBe('60')

      const data = await response.json()
      expect(data.error).toContain('rate limit')
      expect(data.status).toBe(429)
    })

    it('should use custom rate limiter when provided', async () => {
      const customLimiter = createRateLimiter({
        max: 1,
        message: 'Custom limiter message',
      })

      const mockHandler = jest.fn(async () => 
        new Response('OK', { status: 200 })
      )

      // First request
      await withRateLimit(mockRequest, mockHandler, customLimiter)
      
      // Second request should use custom message
      const response = await withRateLimit(mockRequest, mockHandler, customLimiter)
      const data = await response.json()
      
      expect(data.error).toBe('Custom limiter message')
    })

    it('should handle handler errors properly', async () => {
      const errorHandler = jest.fn(async () => {
        throw new Error('Handler error')
      })

      // Rate limit should still work even if handler throws
      await expect(
        withRateLimit(mockRequest, errorHandler)
      ).rejects.toThrow('Handler error')

      // The rate limit counter should still increment
      const strictLimiter = createRateLimiter({ max: 1 })
      await expect(
        withRateLimit(mockRequest, errorHandler, strictLimiter)
      ).rejects.toThrow()

      // Next request should be rate limited
      const response = await withRateLimit(
        mockRequest, 
        async () => new Response('OK'),
        strictLimiter
      )
      expect(response.status).toBe(429)
    })
  })

  describe('Edge cases', () => {
    it('should handle concurrent requests correctly', async () => {
      const limiter = createRateLimiter({
        max: 5,
        windowMs: 1000,
      })

      // Fire 10 concurrent requests
      const requests = Array(10).fill(null).map(() => limiter(mockRequest))
      const results = await Promise.all(requests)

      const allowed = results.filter(r => r.allowed).length
      const blocked = results.filter(r => !r.allowed).length

      expect(allowed).toBe(5)
      expect(blocked).toBe(5)
    })

    it('should handle time edge cases', async () => {
      const limiter = createRateLimiter({
        max: 1,
        windowMs: 1000,
      })

      // First request at time 0
      await limiter(mockRequest)

      // Advance to just before window expires
      jest.advanceTimersByTime(999)
      
      // Should still be blocked
      let result = await limiter(mockRequest)
      expect(result.allowed).toBe(false)

      // Advance 1 more ms to expire window
      jest.advanceTimersByTime(1)
      
      // Should be allowed now
      result = await limiter(mockRequest)
      expect(result.allowed).toBe(true)
    })

    it('should handle malformed IP headers', async () => {
      const limiter = createRateLimiter({ max: 1 })

      const malformedRequests = [
        { headers: new Headers({ 'x-forwarded-for': 'not-an-ip' }) },
        { headers: new Headers({ 'x-forwarded-for': ',,,' }) },
        { headers: new Headers({ 'x-forwarded-for': ' ' }) },
        { headers: new Headers({ 'x-real-ip': '%%%' }) },
      ]

      // All should be tracked despite malformed IPs
      for (const req of malformedRequests) {
        const result = await limiter(req as Request)
        expect(result.allowed).toBe(true) // First request for each "IP"
      }
    })
  })
})
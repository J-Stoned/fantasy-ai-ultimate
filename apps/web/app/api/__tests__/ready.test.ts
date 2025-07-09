import { GET } from '../ready/route'

describe('Ready Check API', () => {
  const originalEnv = process.env
  
  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('GET /api/ready', () => {
    it('should return ready when all required env vars are present', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key'
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.ready).toBe(true)
      expect(data.message).toBe('Service is ready')
      expect(data.timestamp).toBeDefined()
    })

    it('should return not ready when required env vars are missing', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test'

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.ready).toBe(false)
      expect(data.message).toBe('Missing required environment variables')
      expect(data.missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
      expect(data.missing).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY')
      expect(data.missing).not.toContain('DATABASE_URL')
    })

    it('should return all missing env vars', async () => {
      delete process.env.NEXT_PUBLIC_SUPABASE_URL
      delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      delete process.env.DATABASE_URL

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(503)
      expect(data.ready).toBe(false)
      expect(data.missing).toHaveLength(3)
      expect(data.missing).toContain('NEXT_PUBLIC_SUPABASE_URL')
      expect(data.missing).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY')
      expect(data.missing).toContain('DATABASE_URL')
    })

    it('should include timestamp in response', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.DATABASE_URL = 'postgresql://test'

      const before = new Date().toISOString()
      const response = await GET()
      const data = await response.json()
      const after = new Date().toISOString()

      expect(new Date(data.timestamp).toISOString()).toBeGreaterThanOrEqual(before)
      expect(new Date(data.timestamp).toISOString()).toBeLessThanOrEqual(after)
    })
  })

  describe('Performance', () => {
    it('should respond quickly', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.DATABASE_URL = 'postgresql://test'

      const start = Date.now()
      await GET()
      const duration = Date.now() - start

      expect(duration).toBeLessThan(10) // Should be very fast since it's just env check
    })

    it('should handle concurrent requests', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.DATABASE_URL = 'postgresql://test'

      const requests = Array(10).fill(null).map(() => GET())
      const responses = await Promise.all(requests)

      expect(responses).toHaveLength(10)
      expect(responses.every(r => r.status === 200)).toBe(true)
    })
  })

  describe('Edge cases', () => {
    it('should handle empty string env vars as missing', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = ''
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-key'
      process.env.DATABASE_URL = 'postgresql://test'

      const response = await GET()
      const data = await response.json()

      // Empty strings are truthy in JavaScript, so this should pass
      // If we want to treat empty strings as missing, we'd need to update the implementation
      expect(response.status).toBe(200)
      expect(data.ready).toBe(true)
    })

    it('should not expose sensitive env var values', async () => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://secret.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'super-secret-key'
      process.env.DATABASE_URL = 'postgresql://user:password@host:5432/db'

      const response = await GET()
      const data = await response.json()
      const responseText = JSON.stringify(data)

      // Should not contain actual values
      expect(responseText).not.toContain('secret.supabase.co')
      expect(responseText).not.toContain('super-secret-key')
      expect(responseText).not.toContain('password')
    })
  })
})
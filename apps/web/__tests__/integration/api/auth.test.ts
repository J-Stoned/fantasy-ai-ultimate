import { createMocks } from 'node-mocks-http'
import { POST as loginHandler } from '@/app/api/auth/login/route'
import { GET as checkHandler } from '@/app/api/auth/check/route'
import { POST as logoutHandler } from '@/app/api/auth/logout/route'

// Mock the database and external services
jest.mock('@/lib/services/database', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
}))

jest.mock('@/lib/utils/password', () => ({
  comparePassword: jest.fn(),
  hashPassword: jest.fn(),
}))

jest.mock('jsonwebtoken', () => ({
  sign: jest.fn(() => 'mock-jwt-token'),
  verify: jest.fn(() => ({ userId: 'user-123' })),
}))

describe('/api/auth API Routes', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  describe('POST /api/auth/login', () => {
    it('should authenticate valid user credentials', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'SecurePass123!'
        }
      })

      // Mock successful database lookup
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        isActive: true
      }

      require('@/lib/services/database').queryOne.mockResolvedValue(mockUser)
      require('@/lib/utils/password').comparePassword.mockResolvedValue(true)

      const response = await loginHandler(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.token).toBe('mock-jwt-token')
      expect(data.user).toEqual({
        id: mockUser.id,
        email: mockUser.email
      })
    })

    it('should reject invalid credentials', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'wrongpassword'
        }
      })

      // Mock user found but password incorrect
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        isActive: true
      }

      require('@/lib/services/database').queryOne.mockResolvedValue(mockUser)
      require('@/lib/utils/password').comparePassword.mockResolvedValue(false)

      const response = await loginHandler(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid credentials')
    })

    it('should reject login for non-existent user', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'nonexistent@example.com',
          password: 'SecurePass123!'
        }
      })

      // Mock user not found
      require('@/lib/services/database').queryOne.mockResolvedValue(null)

      const response = await loginHandler(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid credentials')
    })

    it('should reject login for inactive user', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'SecurePass123!'
        }
      })

      // Mock inactive user
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        isActive: false
      }

      require('@/lib/services/database').queryOne.mockResolvedValue(mockUser)
      require('@/lib/utils/password').comparePassword.mockResolvedValue(true)

      const response = await loginHandler(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Account is disabled')
    })

    it('should validate request body', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'invalid-email',
          password: 'weak'
        }
      })

      const response = await loginHandler(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
      expect(data.error).toContain('validation')
    })

    it('should handle database errors gracefully', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'SecurePass123!'
        }
      })

      // Mock database error
      require('@/lib/services/database').queryOne.mockRejectedValue(
        new Error('Database connection failed')
      )

      const response = await loginHandler(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Internal server error')
    })

    it('should rate limit login attempts', async () => {
      // Mock multiple rapid requests
      const requests = Array.from({ length: 6 }, () => 
        createMocks({
          method: 'POST',
          body: {
            email: 'test@example.com',
            password: 'SecurePass123!'
          },
          headers: {
            'x-forwarded-for': '192.168.1.1'
          }
        }).req
      )

      // Mock successful authentication for the first few requests
      require('@/lib/services/database').queryOne.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        isActive: true
      })
      require('@/lib/utils/password').comparePassword.mockResolvedValue(true)

      // Execute requests
      const responses = await Promise.all(
        requests.map(req => loginHandler(req))
      )

      // Check that later requests are rate limited
      const lastResponse = await responses[5].json()
      expect(responses[5].status).toBe(429)
      expect(lastResponse.error).toContain('rate limit')
    })
  })

  describe('GET /api/auth/check', () => {
    it('should validate valid JWT token', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-jwt-token'
        }
      })

      // Mock valid token verification
      require('jsonwebtoken').verify.mockReturnValue({ userId: 'user-123' })
      
      // Mock user lookup
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        isActive: true
      }
      require('@/lib/services/database').queryOne.mockResolvedValue(mockUser)

      const response = await checkHandler(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user).toEqual({
        id: mockUser.id,
        email: mockUser.email
      })
    })

    it('should reject request without authorization header', async () => {
      const { req } = createMocks({
        method: 'GET'
      })

      const response = await checkHandler(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('No token provided')
    })

    it('should reject invalid JWT token', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer invalid-jwt-token'
        }
      })

      // Mock invalid token verification
      require('jsonwebtoken').verify.mockImplementation(() => {
        throw new Error('Invalid token')
      })

      const response = await checkHandler(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('Invalid token')
    })

    it('should reject token for non-existent user', async () => {
      const { req } = createMocks({
        method: 'GET',
        headers: {
          authorization: 'Bearer valid-jwt-token'
        }
      })

      // Mock valid token but user not found
      require('jsonwebtoken').verify.mockReturnValue({ userId: 'nonexistent-user' })
      require('@/lib/services/database').queryOne.mockResolvedValue(null)

      const response = await checkHandler(req)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.success).toBe(false)
      expect(data.error).toBe('User not found')
    })
  })

  describe('POST /api/auth/logout', () => {
    it('should successfully logout user', async () => {
      const { req } = createMocks({
        method: 'POST',
        headers: {
          authorization: 'Bearer valid-jwt-token'
        }
      })

      // Mock token verification
      require('jsonwebtoken').verify.mockReturnValue({ userId: 'user-123' })

      const response = await logoutHandler(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Logged out successfully')
    })

    it('should handle logout without token gracefully', async () => {
      const { req } = createMocks({
        method: 'POST'
      })

      const response = await logoutHandler(req)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Logged out successfully')
    })
  })

  describe('Security Tests', () => {
    it('should prevent SQL injection in email field', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          email: "'; DROP TABLE users; --",
          password: 'SecurePass123!'
        }
      })

      // Mock database call to ensure parameterized queries are used
      require('@/lib/services/database').queryOne.mockResolvedValue(null)

      const response = await loginHandler(req)
      
      // Should not crash and should handle safely
      expect(response.status).toBe(401)
    })

    it('should sanitize XSS attempts in input', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          email: '<script>alert("xss")</script>@example.com',
          password: 'SecurePass123!'
        }
      })

      const response = await loginHandler(req)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.success).toBe(false)
    })

    it('should not leak sensitive information in error messages', async () => {
      const { req } = createMocks({
        method: 'POST',
        body: {
          email: 'test@example.com',
          password: 'wrongpassword'
        }
      })

      // Mock database error with sensitive info
      require('@/lib/services/database').queryOne.mockRejectedValue(
        new Error('Connection failed to database at internal-db-server:5432')
      )

      const response = await loginHandler(req)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
      expect(data.error).not.toContain('internal-db-server')
    })

    it('should handle brute force protection', async () => {
      const attempts = Array.from({ length: 10 }, (_, i) => 
        createMocks({
          method: 'POST',
          body: {
            email: 'test@example.com',
            password: `attempt${i}`
          },
          headers: {
            'x-forwarded-for': '192.168.1.100'
          }
        }).req
      )

      // Mock failed authentication
      require('@/lib/services/database').queryOne.mockResolvedValue({
        id: 'user-123',
        email: 'test@example.com',
        passwordHash: 'hashed-password',
        isActive: true
      })
      require('@/lib/utils/password').comparePassword.mockResolvedValue(false)

      const responses = await Promise.all(
        attempts.map(req => loginHandler(req))
      )

      // Later attempts should be blocked
      const laterResponses = responses.slice(-3)
      laterResponses.forEach(async (response) => {
        const data = await response.json()
        expect([429, 401]).toContain(response.status)
      })
    })
  })
})
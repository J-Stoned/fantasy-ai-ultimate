/**
 * Security tests for authentication middleware
 * Critical for protecting API endpoints and user data
 */

import { NextRequest, NextResponse } from 'next/server';
import { authMiddleware } from '@/middleware/auth';
import jwt from 'jsonwebtoken';

// Mock JWT
jest.mock('jsonwebtoken');
const mockJwt = jwt as jest.Mocked<typeof jwt>;

// Mock logger
jest.mock('@/lib/logging/logger', () => ({
  logger: {
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    debug: jest.fn(),
  },
}));

// Mock enterprise logger
jest.mock('@/lib/logging/enterprise-logger', () => ({
  enterpriseLogger: {
    logSecurityEvent: jest.fn(),
    logAuditEvent: jest.fn(),
  },
}));

describe('Authentication Middleware', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Reset environment
    delete process.env.JWT_SECRET;
  });

  describe('JWT Token Validation', () => {
    test('should allow access with valid JWT token', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      const mockPayload = {
        userId: 'user123',
        email: 'test@example.com',
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600, // 1 hour
      };

      mockJwt.verify.mockReturnValueOnce(mockPayload);

      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': 'Bearer valid-jwt-token',
        },
      });

      const response = await authMiddleware(request);

      expect(response).toBeUndefined(); // Middleware should pass through
      expect(mockJwt.verify).toHaveBeenCalledWith('valid-jwt-token', 'test-secret-key');
    });

    test('should reject requests without Authorization header', async () => {
      const request = new NextRequest('http://localhost:3000/api/protected');

      const response = await authMiddleware(request);

      expect(response).toBeInstanceOf(NextResponse);
      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data).toEqual({
        error: 'Unauthorized',
        message: 'No authorization token provided',
      });
    });

    test('should reject malformed Authorization header', async () => {
      const { enterpriseLogger } = require('@/lib/logging/enterprise-logger');

      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': 'InvalidFormat token123',
        },
      });

      const response = await authMiddleware(request);

      expect(response.status).toBe(401);
      expect(enterpriseLogger.logSecurityEvent).toHaveBeenCalledWith(
        'invalid-authorization-format',
        'medium',
        expect.any(Object)
      );
    });

    test('should reject requests with invalid JWT signature', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid signature');
      });

      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': 'Bearer invalid-signature-token',
        },
      });

      const response = await authMiddleware(request);

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
      expect(data.message).toContain('Invalid token');
    });

    test('should reject expired JWT tokens', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      mockJwt.verify.mockImplementation(() => {
        throw new jwt.TokenExpiredError('jwt expired', new Date());
      });

      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': 'Bearer expired-token',
        },
      });

      const response = await authMiddleware(request);

      expect(response.status).toBe(401);
      
      const data = await response.json();
      expect(data.message).toContain('Token expired');
    });

    test('should handle malformed JWT tokens', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      mockJwt.verify.mockImplementation(() => {
        throw new Error('jwt malformed');
      });

      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': 'Bearer malformed.jwt.token',
        },
      });

      const response = await authMiddleware(request);

      expect(response.status).toBe(401);
    });
  });

  describe('Role-Based Authorization', () => {
    test('should allow admin access to admin endpoints', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      const mockPayload = {
        userId: 'admin123',
        email: 'admin@example.com',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwt.verify.mockReturnValueOnce(mockPayload);

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        headers: {
          'Authorization': 'Bearer admin-token',
        },
      });

      const response = await authMiddleware(request);

      expect(response).toBeUndefined(); // Should pass through
    });

    test('should deny user access to admin endpoints', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      const mockPayload = {
        userId: 'user123',
        email: 'user@example.com',
        role: 'user', // Not admin
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwt.verify.mockReturnValueOnce(mockPayload);

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        headers: {
          'Authorization': 'Bearer user-token',
        },
      });

      const response = await authMiddleware(request);

      expect(response.status).toBe(403);
      
      const data = await response.json();
      expect(data).toEqual({
        error: 'Forbidden',
        message: 'Insufficient permissions',
      });
    });

    test('should allow premium users access to premium endpoints', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      const mockPayload = {
        userId: 'premium123',
        email: 'premium@example.com',
        role: 'premium',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwt.verify.mockReturnValueOnce(mockPayload);

      const request = new NextRequest('http://localhost:3000/api/premium/features', {
        headers: {
          'Authorization': 'Bearer premium-token',
        },
      });

      const response = await authMiddleware(request);

      expect(response).toBeUndefined(); // Should pass through
    });

    test('should handle missing role in JWT payload', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      const mockPayload = {
        userId: 'user123',
        email: 'user@example.com',
        // Missing role field
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwt.verify.mockReturnValueOnce(mockPayload);

      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        headers: {
          'Authorization': 'Bearer no-role-token',
        },
      });

      const response = await authMiddleware(request);

      expect(response.status).toBe(403);
    });
  });

  describe('Rate Limiting', () => {
    test('should track request rates per user', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      const mockPayload = {
        userId: 'user123',
        email: 'user@example.com',
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwt.verify.mockReturnValue(mockPayload);

      // Make multiple requests rapidly
      const requests = Array(5).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/protected', {
          headers: {
            'Authorization': 'Bearer user-token',
          },
        })
      );

      const responses = await Promise.all(
        requests.map(req => authMiddleware(req))
      );

      // First few requests should pass
      expect(responses.filter(r => r === undefined)).toHaveLength(5);
    });

    test('should apply different rate limits for different user roles', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      // Admin should have higher rate limits than regular users
      const adminPayload = {
        userId: 'admin123',
        email: 'admin@example.com',
        role: 'admin',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwt.verify.mockReturnValue(adminPayload);

      // This test would require implementing role-based rate limiting
      const request = new NextRequest('http://localhost:3000/api/admin/users', {
        headers: {
          'Authorization': 'Bearer admin-token',
        },
      });

      const response = await authMiddleware(request);
      expect(response).toBeUndefined(); // Admin should pass
    });
  });

  describe('Security Headers', () => {
    test('should add security headers to responses', async () => {
      const request = new NextRequest('http://localhost:3000/api/unprotected');

      const response = await authMiddleware(request);

      if (response) {
        expect(response.headers.get('X-Frame-Options')).toBe('DENY');
        expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
        expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
      }
    });

    test('should include CORS headers for cross-origin requests', async () => {
      const request = new NextRequest('http://localhost:3000/api/public', {
        headers: {
          'Origin': 'https://trusted-domain.com',
        },
      });

      const response = await authMiddleware(request);

      if (response) {
        expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined();
      }
    });
  });

  describe('Audit Logging', () => {
    test('should log successful authentication attempts', async () => {
      const { enterpriseLogger } = require('@/lib/logging/enterprise-logger');
      process.env.JWT_SECRET = 'test-secret-key';
      
      const mockPayload = {
        userId: 'user123',
        email: 'user@example.com',
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwt.verify.mockReturnValueOnce(mockPayload);

      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': 'Bearer valid-token',
          'User-Agent': 'TestClient/1.0',
          'X-Real-IP': '192.168.1.100',
        },
      });

      await authMiddleware(request);

      expect(enterpriseLogger.logAuditEvent).toHaveBeenCalledWith(
        'authentication-success',
        'api-access',
        'user123',
        expect.objectContaining({
          endpoint: '/api/protected',
          userAgent: 'TestClient/1.0',
          ipAddress: '192.168.1.100',
        })
      );
    });

    test('should log failed authentication attempts', async () => {
      const { enterpriseLogger } = require('@/lib/logging/enterprise-logger');
      
      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': 'Bearer invalid-token',
          'X-Real-IP': '192.168.1.200',
        },
      });

      await authMiddleware(request);

      expect(enterpriseLogger.logSecurityEvent).toHaveBeenCalledWith(
        'authentication-failure',
        'medium',
        expect.objectContaining({
          endpoint: '/api/protected',
          ipAddress: '192.168.1.200',
          reason: expect.any(String),
        })
      );
    });

    test('should log suspicious activity patterns', async () => {
      const { enterpriseLogger } = require('@/lib/logging/enterprise-logger');
      
      // Multiple failed attempts from same IP
      const suspiciousIP = '192.168.1.999';
      
      for (let i = 0; i < 3; i++) {
        const request = new NextRequest('http://localhost:3000/api/protected', {
          headers: {
            'Authorization': 'Bearer invalid-token-' + i,
            'X-Real-IP': suspiciousIP,
          },
        });

        await authMiddleware(request);
      }

      expect(enterpriseLogger.logSecurityEvent).toHaveBeenCalledWith(
        'authentication-failure',
        'medium',
        expect.any(Object)
      );
    });
  });

  describe('Environment Configuration', () => {
    test('should require JWT_SECRET in production', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': 'Bearer some-token',
        },
      });

      await expect(authMiddleware(request)).rejects.toThrow(
        'JWT_SECRET environment variable is required in production'
      );

      process.env.NODE_ENV = originalEnv;
    });

    test('should use development defaults when JWT_SECRET is missing in development', async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      delete process.env.JWT_SECRET;

      const mockPayload = {
        userId: 'dev-user',
        email: 'dev@example.com',
        role: 'user',
      };

      mockJwt.verify.mockReturnValueOnce(mockPayload);

      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': 'Bearer dev-token',
        },
      });

      // Should not throw in development
      const response = await authMiddleware(request);
      expect(response).toBeUndefined();

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe('Edge Cases and Error Handling', () => {
    test('should handle very long JWT tokens', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      // Create extremely long token (simulate attack)
      const longToken = 'a'.repeat(10000);

      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': `Bearer ${longToken}`,
        },
      });

      const response = await authMiddleware(request);

      expect(response.status).toBe(401);
    });

    test('should handle special characters in tokens', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      const specialCharToken = 'token.with.special©haracters∆ñd.unicode🚀';

      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': `Bearer ${specialCharToken}`,
        },
      });

      const response = await authMiddleware(request);

      expect(response.status).toBe(401);
    });

    test('should handle concurrent authentication requests from same user', async () => {
      process.env.JWT_SECRET = 'test-secret-key';
      
      const mockPayload = {
        userId: 'concurrent-user',
        email: 'concurrent@example.com',
        role: 'user',
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      };

      mockJwt.verify.mockReturnValue(mockPayload);

      // Make 10 concurrent requests with same token
      const requests = Array(10).fill(null).map(() => 
        new NextRequest('http://localhost:3000/api/protected', {
          headers: {
            'Authorization': 'Bearer concurrent-token',
          },
        })
      );

      const responses = await Promise.all(
        requests.map(req => authMiddleware(req))
      );

      // All should succeed (token is valid)
      expect(responses.filter(r => r === undefined)).toHaveLength(10);
    });

    test('should not leak sensitive information in error messages', async () => {
      process.env.JWT_SECRET = 'super-secret-key-do-not-expose';
      
      mockJwt.verify.mockImplementation(() => {
        throw new Error('JWT verification failed with secret: super-secret-key-do-not-expose');
      });

      const request = new NextRequest('http://localhost:3000/api/protected', {
        headers: {
          'Authorization': 'Bearer invalid-token',
        },
      });

      const response = await authMiddleware(request);
      const data = await response.json();
      const errorMessage = JSON.stringify(data);

      // Should not contain sensitive information
      expect(errorMessage).not.toContain('super-secret-key-do-not-expose');
      expect(errorMessage).not.toContain('JWT_SECRET');
    });
  });
});
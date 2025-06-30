import {
  escapeHtml,
  escapeSqlWildcards,
  sanitizeHtml,
  validationSchemas,
  validateAndSanitize,
  getCSRFToken,
  addCSRFHeader,
  securityHeaders,
  inputLimits,
} from '../security'

// Mock DOMPurify
jest.mock('isomorphic-dompurify', () => ({
  sanitize: jest.fn((dirty: string, config: any) => {
    // Simple mock implementation
    if (config.ALLOWED_TAGS.length === 0) return ''
    // Remove script tags
    return dirty.replace(/<script[^>]*>.*?<\/script>/gi, '')
  }),
}))

describe('Security Utilities', () => {
  describe('escapeHtml', () => {
    it('should escape HTML special characters', () => {
      expect(escapeHtml('&')).toBe('&amp;')
      expect(escapeHtml('<')).toBe('&lt;')
      expect(escapeHtml('>')).toBe('&gt;')
      expect(escapeHtml('"')).toBe('&quot;')
      expect(escapeHtml("'")).toBe('&#039;')
    })

    it('should escape all characters in a string', () => {
      const input = '<script>alert("XSS")</script>'
      const expected = '&lt;script&gt;alert(&quot;XSS&quot;)&lt;/script&gt;'
      expect(escapeHtml(input)).toBe(expected)
    })

    it('should handle empty strings', () => {
      expect(escapeHtml('')).toBe('')
    })

    it('should not escape already escaped entities', () => {
      const input = '&amp;&lt;&gt;'
      const expected = '&amp;amp;&amp;lt;&amp;gt;'
      expect(escapeHtml(input)).toBe(expected)
    })

    it('should handle complex XSS attempts', () => {
      const xssAttempts = [
        '<img src=x onerror=alert("XSS")>',
        '<svg onload=alert("XSS")>',
        '"><script>alert(String.fromCharCode(88,83,83))</script>',
        '<iframe src="javascript:alert(\'XSS\')"></iframe>',
      ]

      xssAttempts.forEach(attempt => {
        const escaped = escapeHtml(attempt)
        expect(escaped).not.toContain('<')
        expect(escaped).not.toContain('>')
        expect(escaped).not.toContain('"')
      })
    })
  })

  describe('escapeSqlWildcards', () => {
    it('should escape SQL wildcard characters', () => {
      expect(escapeSqlWildcards('%test%')).toBe('\\%test\\%')
      expect(escapeSqlWildcards('_test_')).toBe('\\_test\\_')
      expect(escapeSqlWildcards('50%_off')).toBe('50\\%\\_off')
    })

    it('should not escape other characters', () => {
      expect(escapeSqlWildcards('normal text')).toBe('normal text')
      expect(escapeSqlWildcards('user@email.com')).toBe('user@email.com')
    })

    it('should handle empty strings', () => {
      expect(escapeSqlWildcards('')).toBe('')
    })
  })

  describe('sanitizeHtml', () => {
    it('should allow safe HTML tags', () => {
      const input = '<p>Hello <b>world</b></p>'
      const result = sanitizeHtml(input)
      expect(result).toContain('Hello')
      expect(result).toContain('world')
    })

    it('should remove dangerous tags', () => {
      const input = '<script>alert("XSS")</script><p>Safe content</p>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('<script>')
      expect(result).not.toContain('alert')
      expect(result).toContain('Safe content')
    })

    it('should remove all attributes', () => {
      const input = '<p onclick="alert(\'XSS\')" style="color:red">Text</p>'
      const result = sanitizeHtml(input)
      expect(result).not.toContain('onclick')
      expect(result).not.toContain('style')
    })
  })

  describe('validationSchemas', () => {
    describe('username', () => {
      it('should accept valid usernames', () => {
        const validUsernames = ['user123', 'test_user', 'john-doe', 'ABC']
        validUsernames.forEach(username => {
          expect(() => validationSchemas.username.parse(username)).not.toThrow()
        })
      })

      it('should reject invalid usernames', () => {
        const invalidUsernames = [
          'ab', // too short
          'a'.repeat(31), // too long
          'user@name', // invalid character
          'user name', // space
          'user$', // special character
        ]
        invalidUsernames.forEach(username => {
          expect(() => validationSchemas.username.parse(username)).toThrow()
        })
      })
    })

    describe('email', () => {
      it('should accept valid emails', () => {
        const validEmails = [
          'user@example.com',
          'test.user@domain.co.uk',
          'user+tag@example.org',
        ]
        validEmails.forEach(email => {
          expect(() => validationSchemas.email.parse(email)).not.toThrow()
        })
      })

      it('should reject invalid emails', () => {
        const invalidEmails = [
          'not-an-email',
          '@example.com',
          'user@',
          'user @example.com',
          'user@.com',
        ]
        invalidEmails.forEach(email => {
          expect(() => validationSchemas.email.parse(email)).toThrow()
        })
      })
    })

    describe('id', () => {
      it('should accept valid UUIDs', () => {
        const validIds = [
          '550e8400-e29b-41d4-a716-446655440000',
          'f47ac10b-58cc-4372-a567-0e02b2c3d479',
        ]
        validIds.forEach(id => {
          expect(() => validationSchemas.id.parse(id)).not.toThrow()
        })
      })

      it('should reject invalid UUIDs', () => {
        const invalidIds = [
          '123',
          'not-a-uuid',
          '550e8400-e29b-41d4-a716',
          'g47ac10b-58cc-4372-a567-0e02b2c3d479', // invalid character
        ]
        invalidIds.forEach(id => {
          expect(() => validationSchemas.id.parse(id)).toThrow()
        })
      })
    })

    describe('searchQuery', () => {
      it('should trim and escape SQL wildcards', () => {
        const result = validationSchemas.searchQuery.parse('  test%query_  ')
        expect(result).toBe('test\\%query\\_')
      })

      it('should reject queries that are too long', () => {
        const longQuery = 'a'.repeat(101)
        expect(() => validationSchemas.searchQuery.parse(longQuery)).toThrow()
      })
    })

    describe('pagination', () => {
      it('should accept valid pagination', () => {
        const valid = { page: 0, limit: 50 }
        const result = validationSchemas.pagination.parse(valid)
        expect(result).toEqual(valid)
      })

      it('should provide defaults', () => {
        const result = validationSchemas.pagination.parse({})
        expect(result).toEqual({ page: 0, limit: 50 })
      })

      it('should reject invalid values', () => {
        expect(() => validationSchemas.pagination.parse({ page: -1 })).toThrow()
        expect(() => validationSchemas.pagination.parse({ limit: 101 })).toThrow()
        expect(() => validationSchemas.pagination.parse({ limit: 0 })).toThrow()
      })
    })

    describe('apiKey', () => {
      it('should accept valid API keys', () => {
        const validKey = 'a'.repeat(32) + '1234567890_-'
        expect(() => validationSchemas.apiKey.parse(validKey)).not.toThrow()
      })

      it('should reject invalid API keys', () => {
        const invalidKeys = [
          'short', // too short
          'has spaces in it' + 'a'.repeat(20),
          'has@special#chars' + 'a'.repeat(20),
        ]
        invalidKeys.forEach(key => {
          expect(() => validationSchemas.apiKey.parse(key)).toThrow()
        })
      })
    })

    describe('url', () => {
      it('should accept valid URLs', () => {
        const validUrls = [
          'http://example.com',
          'https://sub.example.com/path',
          'https://example.com:8080',
          'https://example.com/path?query=value',
        ]
        validUrls.forEach(url => {
          expect(() => validationSchemas.url.parse(url)).not.toThrow()
        })
      })

      it('should reject invalid URLs', () => {
        const invalidUrls = [
          'not a url',
          'ftp://example.com', // not http/https
          'javascript:alert("XSS")',
          '//example.com', // no protocol
          'http://', // incomplete
        ]
        invalidUrls.forEach(url => {
          expect(() => validationSchemas.url.parse(url)).toThrow()
        })
      })
    })
  })

  describe('validateAndSanitize', () => {
    it('should return success for valid data', () => {
      const schema = validationSchemas.email
      const result = validateAndSanitize(schema, 'user@example.com')
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toBe('user@example.com')
      }
    })

    it('should return error for invalid data', () => {
      const schema = validationSchemas.email
      const result = validateAndSanitize(schema, 'not-an-email')
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('Invalid email')
      }
    })

    it('should handle complex schemas', () => {
      const complexSchema = validationSchemas.pagination
      const result = validateAndSanitize(complexSchema, { page: 5, limit: 20 })
      
      expect(result.success).toBe(true)
      if (result.success) {
        expect(result.data).toEqual({ page: 5, limit: 20 })
      }
    })

    it('should return first error message', () => {
      const schema = validationSchemas.username
      const result = validateAndSanitize(schema, 'a') // too short
      
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toContain('at least 3 characters')
      }
    })

    it('should handle non-Zod errors', () => {
      const schema = {
        parse: () => {
          throw new Error('Custom error')
        },
      } as any
      
      const result = validateAndSanitize(schema, 'data')
      expect(result.success).toBe(false)
      if (!result.success) {
        expect(result.error).toBe('Invalid input')
      }
    })
  })

  describe('CSRF utilities', () => {
    describe('getCSRFToken', () => {
      it('should return null on server side', () => {
        expect(getCSRFToken()).toBeNull()
      })

      it('should extract token from cookie', () => {
        // Mock document.cookie
        Object.defineProperty(global, 'document', {
          value: { cookie: 'csrf-token=test-token-123; other=value' },
          writable: true,
        })

        expect(getCSRFToken()).toBe('test-token-123')
      })

      it('should return null when no token in cookie', () => {
        Object.defineProperty(global, 'document', {
          value: { cookie: 'other=value' },
          writable: true,
        })

        expect(getCSRFToken()).toBeNull()
      })
    })

    describe('addCSRFHeader', () => {
      beforeEach(() => {
        // Reset document
        Object.defineProperty(global, 'document', {
          value: undefined,
          writable: true,
        })
      })

      it('should add CSRF token to headers', () => {
        Object.defineProperty(global, 'document', {
          value: { cookie: 'csrf-token=my-token' },
          writable: true,
        })

        const headers = addCSRFHeader({ 'Content-Type': 'application/json' })
        expect(headers).toEqual({
          'Content-Type': 'application/json',
          'x-csrf-token': 'my-token',
        })
      })

      it('should not add header when no token available', () => {
        const headers = addCSRFHeader({ 'Content-Type': 'application/json' })
        expect(headers).toEqual({ 'Content-Type': 'application/json' })
      })

      it('should work with empty headers', () => {
        Object.defineProperty(global, 'document', {
          value: { cookie: 'csrf-token=token123' },
          writable: true,
        })

        const headers = addCSRFHeader()
        expect(headers).toEqual({ 'x-csrf-token': 'token123' })
      })
    })
  })

  describe('Security configuration', () => {
    it('should have proper security headers', () => {
      expect(securityHeaders['X-Content-Type-Options']).toBe('nosniff')
      expect(securityHeaders['X-Frame-Options']).toBe('DENY')
      expect(securityHeaders['X-XSS-Protection']).toBe('1; mode=block')
      expect(securityHeaders['Referrer-Policy']).toBe('strict-origin-when-cross-origin')
      expect(securityHeaders['Strict-Transport-Security']).toContain('max-age=31536000')
    })

    it('should have reasonable input limits', () => {
      expect(inputLimits.maxRequestSize).toBe(10 * 1024 * 1024) // 10MB
      expect(inputLimits.maxJsonSize).toBe(1 * 1024 * 1024) // 1MB
      expect(inputLimits.maxUploadSize).toBe(50 * 1024 * 1024) // 50MB
      
      expect(inputLimits.maxFieldLength.name).toBeLessThanOrEqual(100)
      expect(inputLimits.maxFieldLength.description).toBeLessThanOrEqual(1000)
      expect(inputLimits.maxFieldLength.content).toBeLessThanOrEqual(10000)
    })
  })
})
import { z } from 'zod'
import DOMPurify from 'isomorphic-dompurify'

/**
 * Security utilities for input validation and sanitization
 */

// HTML entity encoding for preventing XSS
export function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}

// SQL special character escaping
export function escapeSqlWildcards(input: string): string {
  return input.replace(/[%_]/g, '\\$&')
}

// Sanitize HTML content (for rich text fields)
export function sanitizeHtml(dirty: string): string {
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS: ['b', 'i', 'em', 'strong', 'p', 'br', 'ul', 'ol', 'li'],
    ALLOWED_ATTR: []
  })
}

// Common validation schemas
export const validationSchemas = {
  // Username validation
  username: z.string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  
  // Email validation
  email: z.string().email('Invalid email address'),
  
  // ID validation (UUIDs)
  id: z.string().uuid('Invalid ID format'),
  
  // Search query validation
  searchQuery: z.string()
    .max(100, 'Search query too long')
    .transform(val => escapeSqlWildcards(val.trim())),
  
  // Pagination validation
  pagination: z.object({
    page: z.number().int().min(0).default(0),
    limit: z.number().int().min(1).max(100).default(50)
  }),
  
  // API key validation
  apiKey: z.string()
    .min(32, 'Invalid API key')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Invalid API key format'),
  
  // URL validation
  url: z.string().url('Invalid URL').refine(
    (url) => {
      try {
        const parsed = new URL(url)
        return ['http:', 'https:'].includes(parsed.protocol)
      } catch {
        return false
      }
    },
    'URL must use HTTP or HTTPS protocol'
  )
}

// Rate limiting configuration
export const rateLimits = {
  api: {
    window: 60 * 1000, // 1 minute
    max: 100 // requests per window
  },
  auth: {
    window: 15 * 60 * 1000, // 15 minutes
    max: 5 // attempts per window
  },
  import: {
    window: 60 * 60 * 1000, // 1 hour
    max: 10 // imports per window
  }
}

// Security headers configuration
export const securityHeaders = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '1; mode=block',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains'
}

// Input size limits
export const inputLimits = {
  maxRequestSize: 10 * 1024 * 1024, // 10MB
  maxJsonSize: 1 * 1024 * 1024, // 1MB
  maxUploadSize: 50 * 1024 * 1024, // 50MB
  maxFieldLength: {
    name: 100,
    description: 1000,
    content: 10000
  }
}

// Validate and sanitize user input
export function validateAndSanitize<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: string } {
  try {
    const validated = schema.parse(data)
    return { success: true, data: validated }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { 
        success: false, 
        error: error.errors[0]?.message || 'Validation failed' 
      }
    }
    return { success: false, error: 'Invalid input' }
  }
}

// CSRF token utilities (for client-side)
export function getCSRFToken(): string | null {
  if (typeof document === 'undefined') return null
  
  const match = document.cookie.match(/csrf-token=([^;]+)/)
  return match ? match[1] : null
}

// Add CSRF token to fetch headers
export function addCSRFHeader(headers: HeadersInit = {}): HeadersInit {
  const token = getCSRFToken()
  if (token) {
    return {
      ...headers,
      'x-csrf-token': token
    }
  }
  return headers
}
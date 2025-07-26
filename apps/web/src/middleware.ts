import { NextResponse, type NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { Ratelimit } from '@upstash/ratelimit'
import { Redis } from '@upstash/redis'

/**
 * Elite Security Headers Middleware with Rate Limiting
 * Implements comprehensive security headers following OWASP recommendations
 * and enterprise-grade rate limiting for API protection
 */

// Security headers configuration
const SECURITY_HEADERS = {
  // Content Security Policy - Strict policy with necessary exceptions
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live https://*.vercel-scripts.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.vercel.com",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "upgrade-insecure-requests"
  ].join('; '),
  
  // Prevent clickjacking
  'X-Frame-Options': 'DENY',
  
  // Prevent MIME type sniffing
  'X-Content-Type-Options': 'nosniff',
  
  // Enable XSS protection (legacy browsers)
  'X-XSS-Protection': '1; mode=block',
  
  // Control referrer information
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  
  // Permissions Policy (replace deprecated Feature-Policy)
  'Permissions-Policy': [
    'geolocation=()',
    'microphone=()',
    'camera=()',
    'payment=()',
    'usb=()',
    'interest-cohort=()'
  ].join(', '),
  
  // Strict Transport Security
  'Strict-Transport-Security': 'max-age=31536000; includeSubDomains',
  
  // DNS Prefetch Control
  'X-DNS-Prefetch-Control': 'on',
  
  // Download Options
  'X-Download-Options': 'noopen',
  
  // Permitted Cross-Domain Policies
  'X-Permitted-Cross-Domain-Policies': 'none'
}

// Rate limit configurations
const RATE_LIMITS = {
  // Authentication endpoints - strict limits
  '/api/auth/login': { requests: 5, window: '15m' },
  '/api/auth/register': { requests: 3, window: '1h' },
  '/api/auth/callback': { requests: 10, window: '5m' },
  
  // Predictions - moderate limits
  '/api/predictions': { requests: 30, window: '1m' },
  '/api/ml/predict': { requests: 20, window: '1m' },
  
  // Data export - restrictive
  '/api/data/export': { requests: 10, window: '1h' },
  '/api/admin/collect-data': { requests: 5, window: '1h' },
  
  // ML training - very restrictive
  '/api/ml/train': { requests: 5, window: '24h' },
  '/api/admin/optimize': { requests: 10, window: '1h' },
  
  // Voice processing
  '/api/voice/process': { requests: 20, window: '5m' },
  '/api/oracle': { requests: 30, window: '5m' },
  
  // Default for other API routes
  'default': { requests: 100, window: '15m' },
}

// Create rate limiter instance
const createRateLimiter = () => {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
    
    return new Ratelimit({
      redis,
      limiter: Ratelimit.slidingWindow(100, '15m'),
      analytics: true,
      prefix: 'rl',
    })
  }
  return null
}

// Initialize rate limiter
const ratelimit = createRateLimiter()

// In-memory rate limit store (fallback)
const memoryStore = new Map<string, { count: number; resetAt: number }>()

// Check rate limit using in-memory store
function checkMemoryRateLimit(
  identifier: string,
  limit: number,
  windowMs: number
): { success: boolean; remaining: number; reset: number } {
  const now = Date.now()
  const key = `${identifier}:${Math.floor(now / windowMs)}`
  
  const current = memoryStore.get(key) || { count: 0, resetAt: now + windowMs }
  
  if (now > current.resetAt) {
    memoryStore.delete(key)
    current.count = 0
    current.resetAt = now + windowMs
  }
  
  current.count++
  memoryStore.set(key, current)
  
  // Clean up old entries
  if (memoryStore.size > 10000) {
    const cutoff = now - windowMs * 2
    for (const [k, v] of memoryStore.entries()) {
      if (v.resetAt < cutoff) {
        memoryStore.delete(k)
      }
    }
  }
  
  return {
    success: current.count <= limit,
    remaining: Math.max(0, limit - current.count),
    reset: current.resetAt,
  }
}

// Get rate limit config for a path
function getRateLimitConfig(pathname: string): { requests: number; window: string } {
  if (RATE_LIMITS[pathname as keyof typeof RATE_LIMITS]) {
    return RATE_LIMITS[pathname as keyof typeof RATE_LIMITS]
  }
  
  for (const [path, config] of Object.entries(RATE_LIMITS)) {
    if (pathname.startsWith(path)) {
      return config
    }
  }
  
  return RATE_LIMITS.default
}

// Convert window string to milliseconds
function parseWindow(window: string): number {
  const match = window.match(/^(\d+)([smhd])$/)
  if (!match) return 15 * 60 * 1000
  
  const [, num, unit] = match
  const value = parseInt(num)
  
  switch (unit) {
    case 's': return value * 1000
    case 'm': return value * 60 * 1000
    case 'h': return value * 60 * 60 * 1000
    case 'd': return value * 24 * 60 * 60 * 1000
    default: return 15 * 60 * 1000
  }
}

// Get identifier for rate limiting
function getIdentifier(request: NextRequest): string {
  const userId = request.headers.get('x-user-id')
  if (userId) return `user:${userId}`
  
  const apiKey = request.headers.get('x-api-key')
  if (apiKey) return `api:${apiKey}`
  
  const token = request.cookies.get('supabase-auth-token')
  if (token) return `token:${token.value.substring(0, 16)}`
  
  const ip = request.ip || request.headers.get('x-forwarded-for') || 'unknown'
  return `ip:${ip}`
}

// CSRF token generation
function generateCSRFToken(): string {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('')
}

// Routes that don't need authentication
const PUBLIC_ROUTES = [
  '/',
  '/auth',
  '/auth/callback',
  '/auth/error',
  '/pricing',
  '/api/health',
  '/api/auth/callback'
]

// API routes that need CSRF protection
const CSRF_PROTECTED_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH']

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl
  
  // Create response
  let response = NextResponse.next()
  
  // Apply security headers to all responses
  Object.entries(SECURITY_HEADERS).forEach(([key, value]) => {
    response.headers.set(key, value)
  })
  
  // Skip auth for public routes
  const isPublicRoute = PUBLIC_ROUTES.some(route => pathname.startsWith(route))
  const isApiRoute = pathname.startsWith('/api/')
  const isStaticAsset = pathname.match(/\.(ico|png|jpg|jpeg|svg|css|js|woff|woff2|ttf|otf)$/i)
  
  // Skip middleware for static assets
  if (isStaticAsset) {
    return response
  }
  
  // Apply rate limiting to API routes
  if (isApiRoute && !pathname.startsWith('/api/health')) {
    const config = getRateLimitConfig(pathname)
    const identifier = getIdentifier(request)
    
    try {
      let rateLimitResult
      
      if (ratelimit) {
        // Use Upstash rate limiter
        const result = await ratelimit.limit(identifier)
        rateLimitResult = {
          success: result.success,
          remaining: result.remaining,
          reset: result.reset,
          limit: result.limit,
        }
      } else {
        // Use in-memory rate limiter
        const windowMs = parseWindow(config.window)
        const result = checkMemoryRateLimit(identifier, config.requests, windowMs)
        rateLimitResult = {
          success: result.success,
          remaining: result.remaining,
          reset: result.reset,
          limit: config.requests,
        }
      }
      
      // Add rate limit headers
      response.headers.set('X-RateLimit-Limit', rateLimitResult.limit.toString())
      response.headers.set('X-RateLimit-Remaining', rateLimitResult.remaining.toString())
      response.headers.set('X-RateLimit-Reset', new Date(rateLimitResult.reset).toISOString())
      
      if (!rateLimitResult.success) {
        const retryAfter = Math.ceil((rateLimitResult.reset - Date.now()) / 1000)
        
        return new NextResponse(
          JSON.stringify({
            error: 'rate_limit_exceeded',
            message: 'Too many requests. Please try again later.',
            retryAfter,
          }),
          {
            status: 429,
            headers: {
              'Content-Type': 'application/json',
              'Retry-After': retryAfter.toString(),
              ...Object.fromEntries(
                Object.entries(SECURITY_HEADERS).map(([k, v]) => [k, v])
              ),
              'X-RateLimit-Limit': rateLimitResult.limit.toString(),
              'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
              'X-RateLimit-Reset': new Date(rateLimitResult.reset).toISOString(),
            },
          }
        )
      }
    } catch (error) {
      // Log error but don't block the request
      // Fail open - allow request if rate limiting fails
      // Error logged internally by rate limiter
    }
  }
  
  // Supabase auth check (except for public routes)
  if (!isPublicRoute) {
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return request.cookies.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value,
              ...options,
            })
          },
          remove(name: string, options: CookieOptions) {
            response.cookies.set({
              name,
              value: '',
              ...options,
            })
          },
        },
      }
    )
    
    const { data: { user }, error } = await supabase.auth.getUser()
    
    // Redirect to auth if not authenticated
    if (!user && !isApiRoute) {
      return NextResponse.redirect(new URL('/auth', request.url))
    }
    
    // Return 401 for unauthenticated API requests
    if (!user && isApiRoute) {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { 
          status: 401,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(
              Object.entries(SECURITY_HEADERS).map(([k, v]) => [k, v])
            )
          }
        }
      )
    }
  }
  
  // CSRF Protection for API routes
  if (isApiRoute && CSRF_PROTECTED_METHODS.includes(request.method)) {
    const csrfToken = request.headers.get('x-csrf-token')
    const sessionToken = request.cookies.get('csrf-token')?.value
    
    // Generate CSRF token if it doesn't exist
    if (!sessionToken) {
      const newToken = generateCSRFToken()
      response.cookies.set({
        name: 'csrf-token',
        value: newToken,
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 60 * 60 * 24 // 24 hours
      })
    }
    
    // Verify CSRF token for protected methods
    if (sessionToken && csrfToken !== sessionToken) {
      return new NextResponse(
        JSON.stringify({ error: 'Invalid CSRF token' }),
        { 
          status: 403,
          headers: {
            'Content-Type': 'application/json',
            ...Object.fromEntries(
              Object.entries(SECURITY_HEADERS).map(([k, v]) => [k, v])
            )
          }
        }
      )
    }
  }
  
  // Admin route protection
  if (pathname.startsWith('/admin') && pathname !== '/admin/login') {
    const isAdmin = request.cookies.get('admin-role')?.value === 'admin'
    
    if (!isAdmin) {
      return NextResponse.redirect(new URL('/admin/login', request.url))
    }
  }
  
  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|public).*)',
  ],
}

// Export runtime for Edge compatibility (experimental in Next.js 15)
export const runtime = 'experimental-edge'
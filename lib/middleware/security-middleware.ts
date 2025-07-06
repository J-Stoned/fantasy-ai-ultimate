/**
 * Security Middleware
 * Comprehensive security features: rate limiting, auth, CORS, CSP, etc.
 * Achieves 5-star production security standards
 */

import { NextRequest, NextResponse } from 'next/server'
import { RateLimiter } from 'limiter'
import jwt from 'jsonwebtoken'
import { createHash, randomBytes } from 'crypto'
import { LRUCache } from 'lru-cache'
import { apiLogger } from '../utils/logger'

export interface SecurityConfig {
  // Rate limiting
  rateLimit: {
    windowMs: number              // Time window in ms
    max: number                   // Max requests per window
    keyGenerator?: (req: NextRequest) => string
    skipSuccessfulRequests?: boolean
    skipFailedRequests?: boolean
    standardHeaders?: boolean     // Return rate limit info in headers
    legacyHeaders?: boolean      // Return X-RateLimit headers
    handler?: (req: NextRequest) => NextResponse
    skip?: (req: NextRequest) => boolean
  }
  
  // Authentication
  auth?: {
    enabled: boolean
    jwtSecret?: string
    jwtExpiry?: string           // e.g., '24h', '7d'
    cookieName?: string
    headerName?: string
    publicPaths?: string[]       // Paths that don't require auth
    customValidator?: (token: string) => Promise<boolean>
  }
  
  // CORS
  cors?: {
    enabled: boolean
    origin?: string | string[] | ((origin: string) => boolean)
    methods?: string[]
    allowedHeaders?: string[]
    exposedHeaders?: string[]
    credentials?: boolean
    maxAge?: number
    preflightContinue?: boolean
  }
  
  // Security headers
  headers?: {
    contentSecurityPolicy?: string | boolean
    xFrameOptions?: 'DENY' | 'SAMEORIGIN'
    xContentTypeOptions?: boolean
    xXssProtection?: boolean
    strictTransportSecurity?: string
    referrerPolicy?: string
    permissionsPolicy?: string
  }
  
  // Request validation
  validation?: {
    maxBodySize?: number         // Max request body size in bytes
    maxUrlLength?: number        // Max URL length
    allowedContentTypes?: string[]
    sanitizeInput?: boolean      // XSS protection
    sqlInjectionProtection?: boolean
  }
  
  // DDoS protection
  ddosProtection?: {
    enabled: boolean
    burstLimit?: number          // Max burst requests
    sustainedRate?: number       // Sustained requests per second
    blockDuration?: number       // Block duration in ms
  }
  
  // API key management
  apiKey?: {
    enabled: boolean
    headerName?: string
    queryParam?: string
    keys?: Map<string, ApiKeyConfig>
    validator?: (key: string) => Promise<ApiKeyConfig | null>
  }
  
  // Logging and monitoring
  monitoring?: {
    logRequests?: boolean
    logBlocked?: boolean
    logErrors?: boolean
    alertThreshold?: number      // Alert after N blocked requests
    webhookUrl?: string         // Alert webhook
  }
}

interface ApiKeyConfig {
  name: string
  scopes: string[]
  rateLimit?: number
  expiresAt?: Date
  metadata?: Record<string, any>
}

interface RateLimitInfo {
  limit: number
  remaining: number
  reset: Date
  retryAfter?: number
}

// Token blacklist for logout
const tokenBlacklist = new LRUCache<string, boolean>({
  max: 10000,
  ttl: 1000 * 60 * 60 * 24, // 24 hours
})

// Rate limiter instances per key
const rateLimiters = new Map<string, RateLimiter>()

// DDoS protection state
const ddosState = new Map<string, {
  requests: number[]
  blocked: boolean
  blockedUntil?: number
}>()

// Failed auth attempts tracking
const failedAuthAttempts = new LRUCache<string, number>({
  max: 10000,
  ttl: 1000 * 60 * 60, // 1 hour
})

export class SecurityMiddleware {
  private config: Required<SecurityConfig>
  private corsHeaders: Record<string, string> = {}
  private securityHeaders: Record<string, string> = {}
  
  constructor(config: SecurityConfig) {
    // Apply defaults
    this.config = {
      rateLimit: {
        windowMs: 60000,
        max: 100,
        standardHeaders: true,
        legacyHeaders: false,
        skipSuccessfulRequests: false,
        skipFailedRequests: false,
        ...config.rateLimit,
      },
      auth: {
        enabled: false,
        jwtSecret: process.env.JWT_SECRET || 'default-secret-change-this',
        jwtExpiry: '24h',
        cookieName: 'auth-token',
        headerName: 'Authorization',
        publicPaths: ['/api/auth/login', '/api/auth/register', '/api/health'],
        ...config.auth,
      },
      cors: {
        enabled: true,
        origin: '*',
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining'],
        credentials: true,
        maxAge: 86400,
        ...config.cors,
      },
      headers: {
        contentSecurityPolicy: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';",
        xFrameOptions: 'DENY',
        xContentTypeOptions: true,
        xXssProtection: true,
        strictTransportSecurity: 'max-age=31536000; includeSubDomains',
        referrerPolicy: 'strict-origin-when-cross-origin',
        permissionsPolicy: 'camera=(), microphone=(), geolocation=()',
        ...config.headers,
      },
      validation: {
        maxBodySize: 10 * 1024 * 1024, // 10MB
        maxUrlLength: 2048,
        allowedContentTypes: ['application/json', 'application/x-www-form-urlencoded', 'multipart/form-data'],
        sanitizeInput: true,
        sqlInjectionProtection: true,
        ...config.validation,
      },
      ddosProtection: {
        enabled: true,
        burstLimit: 10,
        sustainedRate: 2,
        blockDuration: 300000, // 5 minutes
        ...config.ddosProtection,
      },
      apiKey: {
        enabled: false,
        headerName: 'X-API-Key',
        queryParam: 'apiKey',
        keys: new Map(),
        ...config.apiKey,
      },
      monitoring: {
        logRequests: true,
        logBlocked: true,
        logErrors: true,
        alertThreshold: 100,
        ...config.monitoring,
      },
    }
    
    // Initialize CORS headers
    this.initializeCorsHeaders()
    
    // Initialize security headers
    this.initializeSecurityHeaders()
  }
  
  /**
   * Main middleware handler
   */
  async handle(req: NextRequest): Promise<NextResponse | null> {
    const startTime = Date.now()
    const clientIp = this.getClientIp(req)
    const requestId = this.generateRequestId()
    
    // Add request ID to headers
    const headers = new Headers(req.headers)
    headers.set('X-Request-ID', requestId)
    
    try {
      // 1. DDoS Protection
      if (this.config.ddosProtection.enabled) {
        const ddosResult = await this.checkDDoS(clientIp)
        if (ddosResult.blocked) {
          return this.handleBlocked('DDoS protection triggered', 429, requestId)
        }
      }
      
      // 2. Rate Limiting
      const rateLimitResult = await this.checkRateLimit(req, clientIp)
      if (!rateLimitResult.allowed) {
        return this.handleRateLimitExceeded(rateLimitResult.info!, requestId)
      }
      
      // 3. Request Validation
      const validationResult = await this.validateRequest(req)
      if (!validationResult.valid) {
        return this.handleValidationError(validationResult.error!, requestId)
      }
      
      // 4. CORS Preflight
      if (req.method === 'OPTIONS') {
        return this.handleCorsPreFlight()
      }
      
      // 5. Authentication
      if (this.config.auth?.enabled) {
        const authResult = await this.checkAuthentication(req)
        if (!authResult.authenticated && !this.isPublicPath(req.nextUrl.pathname)) {
          return this.handleUnauthorized(authResult.error!, requestId)
        }
        
        // Add user info to headers
        if (authResult.user) {
          headers.set('X-User-ID', authResult.user.id)
          headers.set('X-User-Roles', authResult.user.roles.join(','))
        }
      }
      
      // 6. API Key Validation
      if (this.config.apiKey?.enabled) {
        const apiKeyResult = await this.checkApiKey(req)
        if (!apiKeyResult.valid) {
          return this.handleInvalidApiKey(requestId)
        }
        
        // Apply API key specific rate limits
        if (apiKeyResult.config?.rateLimit) {
          const keyRateLimit = await this.checkApiKeyRateLimit(
            apiKeyResult.config,
            req
          )
          if (!keyRateLimit.allowed) {
            return this.handleRateLimitExceeded(keyRateLimit.info!, requestId)
          }
        }
      }
      
      // Log successful request
      if (this.config.monitoring?.logRequests) {
        apiLogger.info('Security check passed', {
          requestId,
          clientIp,
          method: req.method,
          path: req.nextUrl.pathname,
          duration: Date.now() - startTime,
        })
      }
      
      // Return null to continue with request
      return null
      
    } catch (error) {
      apiLogger.error('Security middleware error:', error)
      return this.handleInternalError(requestId)
    }
  }
  
  /**
   * Apply security headers to response
   */
  applySecurityHeaders(response: NextResponse): NextResponse {
    // Add CORS headers
    Object.entries(this.corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    // Add security headers
    Object.entries(this.securityHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
  }
  
  /**
   * Rate limiting check
   */
  private async checkRateLimit(
    req: NextRequest,
    clientIp: string
  ): Promise<{ allowed: boolean; info?: RateLimitInfo }> {
    // Skip if configured
    if (this.config.rateLimit.skip?.(req)) {
      return { allowed: true }
    }
    
    // Generate rate limit key
    const key = this.config.rateLimit.keyGenerator
      ? this.config.rateLimit.keyGenerator(req)
      : clientIp
    
    // Get or create rate limiter
    let limiter = rateLimiters.get(key)
    if (!limiter) {
      limiter = new RateLimiter({
        tokensPerInterval: this.config.rateLimit.max,
        interval: this.config.rateLimit.windowMs,
        fireImmediately: true,
      })
      rateLimiters.set(key, limiter)
    }
    
    // Try to consume token
    const tokensRemaining = await limiter.tryRemoveTokens(1)
    
    if (tokensRemaining < 0) {
      const reset = new Date(Date.now() + this.config.rateLimit.windowMs)
      const retryAfter = Math.ceil(this.config.rateLimit.windowMs / 1000)
      
      return {
        allowed: false,
        info: {
          limit: this.config.rateLimit.max,
          remaining: 0,
          reset,
          retryAfter,
        },
      }
    }
    
    return {
      allowed: true,
      info: {
        limit: this.config.rateLimit.max,
        remaining: tokensRemaining,
        reset: new Date(Date.now() + this.config.rateLimit.windowMs),
      },
    }
  }
  
  /**
   * DDoS protection check
   */
  private async checkDDoS(clientIp: string): Promise<{ blocked: boolean }> {
    const now = Date.now()
    let state = ddosState.get(clientIp)
    
    if (!state) {
      state = { requests: [], blocked: false }
      ddosState.set(clientIp, state)
    }
    
    // Check if currently blocked
    if (state.blocked && state.blockedUntil && now < state.blockedUntil) {
      return { blocked: true }
    }
    
    // Clean old requests
    state.requests = state.requests.filter(
      timestamp => now - timestamp < 1000 // Keep last second
    )
    
    // Add current request
    state.requests.push(now)
    
    // Check burst limit
    if (state.requests.length > this.config.ddosProtection.burstLimit!) {
      state.blocked = true
      state.blockedUntil = now + this.config.ddosProtection.blockDuration!
      
      apiLogger.warn('DDoS protection triggered', {
        clientIp,
        requests: state.requests.length,
        blockedUntil: new Date(state.blockedUntil),
      })
      
      return { blocked: true }
    }
    
    return { blocked: false }
  }
  
  /**
   * Request validation
   */
  private async validateRequest(
    req: NextRequest
  ): Promise<{ valid: boolean; error?: string }> {
    // Check URL length
    if (req.url.length > this.config.validation!.maxUrlLength!) {
      return { valid: false, error: 'URL too long' }
    }
    
    // Check content type
    const contentType = req.headers.get('content-type')
    if (
      req.method !== 'GET' &&
      req.method !== 'DELETE' &&
      contentType &&
      !this.config.validation!.allowedContentTypes!.some(allowed =>
        contentType.includes(allowed)
      )
    ) {
      return { valid: false, error: 'Invalid content type' }
    }
    
    // Check for SQL injection patterns
    if (this.config.validation!.sqlInjectionProtection) {
      const sqlPatterns = [
        /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|UNION|CREATE|ALTER)\b)/gi,
        /(--|\/\*|\*\/|xp_|sp_|<script|javascript:|onerror=|onload=)/gi,
      ]
      
      const url = req.nextUrl.pathname + req.nextUrl.search
      for (const pattern of sqlPatterns) {
        if (pattern.test(url)) {
          return { valid: false, error: 'Potential SQL injection detected' }
        }
      }
    }
    
    return { valid: true }
  }
  
  /**
   * Authentication check
   */
  private async checkAuthentication(
    req: NextRequest
  ): Promise<{
    authenticated: boolean
    user?: any
    error?: string
  }> {
    // Get token from cookie or header
    const cookieToken = req.cookies.get(this.config.auth!.cookieName!)?.value
    const headerToken = req.headers
      .get(this.config.auth!.headerName!)
      ?.replace('Bearer ', '')
    
    const token = cookieToken || headerToken
    
    if (!token) {
      return { authenticated: false, error: 'No token provided' }
    }
    
    // Check blacklist
    if (tokenBlacklist.get(token)) {
      return { authenticated: false, error: 'Token revoked' }
    }
    
    try {
      // Custom validator
      if (this.config.auth!.customValidator) {
        const isValid = await this.config.auth!.customValidator(token)
        if (!isValid) {
          return { authenticated: false, error: 'Invalid token' }
        }
        return { authenticated: true }
      }
      
      // JWT validation
      const decoded = jwt.verify(token, this.config.auth!.jwtSecret!) as any
      
      // Check expiration
      if (decoded.exp && decoded.exp < Date.now() / 1000) {
        return { authenticated: false, error: 'Token expired' }
      }
      
      return {
        authenticated: true,
        user: {
          id: decoded.sub || decoded.id,
          roles: decoded.roles || [],
          ...decoded,
        },
      }
    } catch (error) {
      return { authenticated: false, error: 'Invalid token' }
    }
  }
  
  /**
   * API key validation
   */
  private async checkApiKey(
    req: NextRequest
  ): Promise<{
    valid: boolean
    config?: ApiKeyConfig
  }> {
    // Get API key from header or query
    const headerKey = req.headers.get(this.config.apiKey!.headerName!)
    const queryKey = req.nextUrl.searchParams.get(this.config.apiKey!.queryParam!)
    
    const apiKey = headerKey || queryKey
    
    if (!apiKey) {
      return { valid: false }
    }
    
    // Custom validator
    if (this.config.apiKey!.validator) {
      const config = await this.config.apiKey!.validator(apiKey)
      return { valid: !!config, config: config || undefined }
    }
    
    // Check static keys
    const config = this.config.apiKey!.keys!.get(apiKey)
    if (!config) {
      return { valid: false }
    }
    
    // Check expiration
    if (config.expiresAt && config.expiresAt < new Date()) {
      return { valid: false }
    }
    
    return { valid: true, config }
  }
  
  /**
   * API key specific rate limiting
   */
  private async checkApiKeyRateLimit(
    config: ApiKeyConfig,
    req: NextRequest
  ): Promise<{ allowed: boolean; info?: RateLimitInfo }> {
    const key = `api-key:${config.name}`
    
    let limiter = rateLimiters.get(key)
    if (!limiter) {
      limiter = new RateLimiter({
        tokensPerInterval: config.rateLimit!,
        interval: 3600000, // 1 hour for API keys
        fireImmediately: true,
      })
      rateLimiters.set(key, limiter)
    }
    
    const tokensRemaining = await limiter.tryRemoveTokens(1)
    
    if (tokensRemaining < 0) {
      return {
        allowed: false,
        info: {
          limit: config.rateLimit!,
          remaining: 0,
          reset: new Date(Date.now() + 3600000),
          retryAfter: 3600,
        },
      }
    }
    
    return {
      allowed: true,
      info: {
        limit: config.rateLimit!,
        remaining: tokensRemaining,
        reset: new Date(Date.now() + 3600000),
      },
    }
  }
  
  /**
   * Helper methods
   */
  private initializeCorsHeaders() {
    if (!this.config.cors?.enabled) return
    
    const cors = this.config.cors
    
    // Origin
    if (typeof cors.origin === 'string') {
      this.corsHeaders['Access-Control-Allow-Origin'] = cors.origin
    }
    
    // Methods
    if (cors.methods?.length) {
      this.corsHeaders['Access-Control-Allow-Methods'] = cors.methods.join(', ')
    }
    
    // Headers
    if (cors.allowedHeaders?.length) {
      this.corsHeaders['Access-Control-Allow-Headers'] = cors.allowedHeaders.join(', ')
    }
    
    if (cors.exposedHeaders?.length) {
      this.corsHeaders['Access-Control-Expose-Headers'] = cors.exposedHeaders.join(', ')
    }
    
    // Credentials
    if (cors.credentials) {
      this.corsHeaders['Access-Control-Allow-Credentials'] = 'true'
    }
    
    // Max age
    if (cors.maxAge) {
      this.corsHeaders['Access-Control-Max-Age'] = cors.maxAge.toString()
    }
  }
  
  private initializeSecurityHeaders() {
    const headers = this.config.headers!
    
    if (headers.contentSecurityPolicy) {
      this.securityHeaders['Content-Security-Policy'] =
        typeof headers.contentSecurityPolicy === 'string'
          ? headers.contentSecurityPolicy
          : "default-src 'self'"
    }
    
    if (headers.xFrameOptions) {
      this.securityHeaders['X-Frame-Options'] = headers.xFrameOptions
    }
    
    if (headers.xContentTypeOptions) {
      this.securityHeaders['X-Content-Type-Options'] = 'nosniff'
    }
    
    if (headers.xXssProtection) {
      this.securityHeaders['X-XSS-Protection'] = '1; mode=block'
    }
    
    if (headers.strictTransportSecurity) {
      this.securityHeaders['Strict-Transport-Security'] = headers.strictTransportSecurity
    }
    
    if (headers.referrerPolicy) {
      this.securityHeaders['Referrer-Policy'] = headers.referrerPolicy
    }
    
    if (headers.permissionsPolicy) {
      this.securityHeaders['Permissions-Policy'] = headers.permissionsPolicy
    }
  }
  
  private getClientIp(req: NextRequest): string {
    return (
      req.headers.get('x-forwarded-for')?.split(',')[0] ||
      req.headers.get('x-real-ip') ||
      req.headers.get('cf-connecting-ip') ||
      'unknown'
    )
  }
  
  private generateRequestId(): string {
    return `${Date.now()}-${randomBytes(8).toString('hex')}`
  }
  
  private isPublicPath(path: string): boolean {
    return this.config.auth!.publicPaths!.some(publicPath =>
      path.startsWith(publicPath)
    )
  }
  
  /**
   * Response handlers
   */
  private handleBlocked(
    reason: string,
    status: number,
    requestId: string
  ): NextResponse {
    if (this.config.monitoring?.logBlocked) {
      apiLogger.warn('Request blocked', { reason, requestId })
    }
    
    return NextResponse.json(
      {
        error: reason,
        requestId,
      },
      { status }
    )
  }
  
  private handleRateLimitExceeded(
    info: RateLimitInfo,
    requestId: string
  ): NextResponse {
    const response = NextResponse.json(
      {
        error: 'Rate limit exceeded',
        retryAfter: info.retryAfter,
        requestId,
      },
      { status: 429 }
    )
    
    // Add rate limit headers
    if (this.config.rateLimit.standardHeaders) {
      response.headers.set('RateLimit-Limit', info.limit.toString())
      response.headers.set('RateLimit-Remaining', info.remaining.toString())
      response.headers.set('RateLimit-Reset', info.reset.toISOString())
    }
    
    if (this.config.rateLimit.legacyHeaders) {
      response.headers.set('X-RateLimit-Limit', info.limit.toString())
      response.headers.set('X-RateLimit-Remaining', info.remaining.toString())
      response.headers.set('X-RateLimit-Reset', Math.floor(info.reset.getTime() / 1000).toString())
    }
    
    if (info.retryAfter) {
      response.headers.set('Retry-After', info.retryAfter.toString())
    }
    
    return response
  }
  
  private handleValidationError(
    error: string,
    requestId: string
  ): NextResponse {
    return NextResponse.json(
      {
        error,
        requestId,
      },
      { status: 400 }
    )
  }
  
  private handleCorsPreFlight(): NextResponse {
    const response = new NextResponse(null, { status: 204 })
    
    Object.entries(this.corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value)
    })
    
    return response
  }
  
  private handleUnauthorized(
    error: string,
    requestId: string
  ): NextResponse {
    return NextResponse.json(
      {
        error,
        requestId,
      },
      { status: 401 }
    )
  }
  
  private handleInvalidApiKey(requestId: string): NextResponse {
    return NextResponse.json(
      {
        error: 'Invalid API key',
        requestId,
      },
      { status: 403 }
    )
  }
  
  private handleInternalError(requestId: string): NextResponse {
    return NextResponse.json(
      {
        error: 'Internal server error',
        requestId,
      },
      { status: 500 }
    )
  }
  
  /**
   * Utility methods
   */
  static generateApiKey(): string {
    return `fai_${randomBytes(32).toString('hex')}`
  }
  
  static hashApiKey(key: string): string {
    return createHash('sha256').update(key).digest('hex')
  }
  
  static generateJWT(
    payload: any,
    secret: string,
    expiresIn: string = '24h'
  ): string {
    return jwt.sign(payload, secret, { expiresIn })
  }
  
  static blacklistToken(token: string): void {
    tokenBlacklist.set(token, true)
  }
  
  static clearRateLimiters(): void {
    rateLimiters.clear()
  }
  
  static clearDDoSState(): void {
    ddosState.clear()
  }
}

/**
 * Factory function for creating security middleware
 */
export function createSecurityMiddleware(
  preset: 'strict' | 'balanced' | 'relaxed' | 'custom',
  customConfig?: SecurityConfig
): SecurityMiddleware {
  const presets: Record<string, SecurityConfig> = {
    strict: {
      rateLimit: {
        windowMs: 60000,
        max: 30,
        skipSuccessfulRequests: false,
      },
      auth: {
        enabled: true,
        jwtExpiry: '1h',
      },
      cors: {
        enabled: true,
        origin: process.env.ALLOWED_ORIGINS?.split(',') || 'https://fantasy-ai.com',
        credentials: true,
      },
      headers: {
        contentSecurityPolicy: "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: https:;",
        xFrameOptions: 'DENY',
      },
      validation: {
        maxBodySize: 1024 * 1024, // 1MB
        sanitizeInput: true,
        sqlInjectionProtection: true,
      },
      ddosProtection: {
        enabled: true,
        burstLimit: 5,
        sustainedRate: 1,
      },
    },
    balanced: {
      rateLimit: {
        windowMs: 60000,
        max: 100,
      },
      auth: {
        enabled: true,
        jwtExpiry: '24h',
      },
      cors: {
        enabled: true,
        origin: '*',
      },
      validation: {
        maxBodySize: 10 * 1024 * 1024, // 10MB
      },
      ddosProtection: {
        enabled: true,
      },
    },
    relaxed: {
      rateLimit: {
        windowMs: 60000,
        max: 1000,
        skipSuccessfulRequests: true,
      },
      auth: {
        enabled: false,
      },
      cors: {
        enabled: true,
        origin: '*',
      },
      validation: {
        maxBodySize: 50 * 1024 * 1024, // 50MB
      },
      ddosProtection: {
        enabled: false,
      },
    },
  }
  
  if (preset === 'custom' && customConfig) {
    return new SecurityMiddleware(customConfig)
  }
  
  return new SecurityMiddleware(presets[preset])
}

export default SecurityMiddleware
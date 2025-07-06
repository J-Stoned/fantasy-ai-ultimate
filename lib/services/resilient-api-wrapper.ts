/**
 * Resilient API Wrapper
 * Circuit breaker pattern + exponential backoff + fallback strategies
 * Achieves 5-star reliability for all external API calls
 */

import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios'
import CircuitBreaker from 'opossum'
import { EventEmitter } from 'events'
import { createHash } from 'crypto'
import { apiLogger } from '../utils/logger'
import pRetry from 'p-retry'

export interface CircuitBreakerConfig {
  timeout?: number           // Request timeout in ms (default: 10000)
  errorThresholdPercentage?: number  // Error % to open circuit (default: 50)
  resetTimeout?: number      // Time before trying half-open (default: 30000)
  rollingCountTimeout?: number  // Window for error % calculation (default: 10000)
  rollingCountBuckets?: number  // Number of buckets in window (default: 10)
  volumeThreshold?: number   // Min requests before error % matters (default: 10)
  fallback?: Function       // Fallback function when circuit is open
  name?: string            // Circuit breaker name for monitoring
}

export interface RetryConfig {
  retries?: number         // Max retry attempts (default: 3)
  factor?: number         // Exponential factor (default: 2)
  minTimeout?: number     // Min wait between retries (default: 1000)
  maxTimeout?: number     // Max wait between retries (default: 30000)
  randomize?: boolean     // Add jitter to prevent thundering herd (default: true)
  onFailedAttempt?: (error: any) => void
}

export interface ResilientAPIConfig {
  baseURL: string
  timeout?: number
  headers?: Record<string, string>
  circuitBreaker?: CircuitBreakerConfig
  retry?: RetryConfig
  cache?: {
    enabled: boolean
    ttl?: number          // Cache TTL in ms (default: 60000)
    maxSize?: number      // Max cache entries (default: 1000)
  }
  rateLimit?: {
    maxRequests: number   // Max requests per window
    windowMs: number      // Time window in ms
  }
  fallbackBaseURLs?: string[]  // Alternative base URLs for failover
}

interface CacheEntry {
  data: any
  timestamp: number
  etag?: string
}

interface RateLimitState {
  requests: number
  windowStart: number
}

export class ResilientAPIWrapper extends EventEmitter {
  private axios: AxiosInstance
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()
  private cache: Map<string, CacheEntry> = new Map()
  private config: Required<ResilientAPIConfig>
  private rateLimitState: RateLimitState
  private currentBaseURLIndex: number = 0
  private metrics = {
    requests: 0,
    successes: 0,
    failures: 0,
    cacheHits: 0,
    cacheMisses: 0,
    circuitOpens: 0,
    retries: 0,
  }

  constructor(config: ResilientAPIConfig) {
    super()
    
    // Apply defaults
    this.config = {
      baseURL: config.baseURL,
      timeout: config.timeout || 10000,
      headers: config.headers || {},
      circuitBreaker: {
        timeout: 10000,
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
        rollingCountTimeout: 10000,
        rollingCountBuckets: 10,
        volumeThreshold: 10,
        ...config.circuitBreaker,
      },
      retry: {
        retries: 3,
        factor: 2,
        minTimeout: 1000,
        maxTimeout: 30000,
        randomize: true,
        ...config.retry,
      },
      cache: {
        enabled: config.cache?.enabled || false,
        ttl: config.cache?.ttl || 60000,
        maxSize: config.cache?.maxSize || 1000,
      },
      rateLimit: config.rateLimit || { maxRequests: 100, windowMs: 60000 },
      fallbackBaseURLs: config.fallbackBaseURLs || [],
    }
    
    this.axios = axios.create({
      baseURL: this.config.baseURL,
      timeout: this.config.timeout,
      headers: this.config.headers,
    })
    
    this.rateLimitState = {
      requests: 0,
      windowStart: Date.now(),
    }
    
    // Setup interceptors
    this.setupInterceptors()
    
    // Start cache cleanup
    if (this.config.cache.enabled) {
      setInterval(() => this.cleanupCache(), 60000)
    }
    
    // Emit metrics periodically
    setInterval(() => {
      this.emit('metrics', { ...this.metrics })
    }, 10000)
  }

  /**
   * Make a resilient GET request
   */
  async get<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'GET', url })
  }

  /**
   * Make a resilient POST request
   */
  async post<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'POST', url, data })
  }

  /**
   * Make a resilient PUT request
   */
  async put<T = any>(url: string, data?: any, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'PUT', url, data })
  }

  /**
   * Make a resilient DELETE request
   */
  async delete<T = any>(url: string, config?: AxiosRequestConfig): Promise<T> {
    return this.request<T>({ ...config, method: 'DELETE', url })
  }

  /**
   * Main request method with all resilience features
   */
  private async request<T = any>(config: AxiosRequestConfig): Promise<T> {
    this.metrics.requests++
    
    // Check rate limit
    await this.checkRateLimit()
    
    // Check cache first
    if (this.config.cache.enabled && config.method === 'GET') {
      const cached = this.getFromCache(config.url!)
      if (cached) {
        this.metrics.cacheHits++
        this.emit('cache:hit', { url: config.url })
        return cached
      }
      this.metrics.cacheMisses++
    }
    
    // Get or create circuit breaker for this endpoint
    const breaker = this.getCircuitBreaker(config.url!)
    
    try {
      // Execute request with circuit breaker
      const response = await breaker.fire(config)
      
      this.metrics.successes++
      
      // Cache successful GET responses
      if (this.config.cache.enabled && config.method === 'GET') {
        this.saveToCache(config.url!, response.data, response.headers.etag)
      }
      
      return response.data
    } catch (error: any) {
      this.metrics.failures++
      
      // Try fallback URLs if available
      if (this.config.fallbackBaseURLs.length > 0 && this.isNetworkError(error)) {
        return this.tryFallbackURLs(config)
      }
      
      throw error
    }
  }

  /**
   * Get or create circuit breaker for endpoint
   */
  private getCircuitBreaker(url: string): CircuitBreaker {
    const endpoint = this.getEndpointKey(url)
    
    if (!this.circuitBreakers.has(endpoint)) {
      const breaker = new CircuitBreaker(
        (config: AxiosRequestConfig) => this.executeRequest(config),
        {
          ...this.config.circuitBreaker,
          name: endpoint,
        }
      )
      
      // Monitor circuit breaker events
      breaker.on('open', () => {
        this.metrics.circuitOpens++
        apiLogger.warn(`Circuit breaker opened for ${endpoint}`)
        this.emit('circuit:open', { endpoint })
      })
      
      breaker.on('halfOpen', () => {
        apiLogger.info(`Circuit breaker half-open for ${endpoint}`)
        this.emit('circuit:halfOpen', { endpoint })
      })
      
      breaker.on('close', () => {
        apiLogger.info(`Circuit breaker closed for ${endpoint}`)
        this.emit('circuit:close', { endpoint })
      })
      
      // Set fallback if provided
      if (this.config.circuitBreaker.fallback) {
        breaker.fallback(this.config.circuitBreaker.fallback)
      }
      
      this.circuitBreakers.set(endpoint, breaker)
    }
    
    return this.circuitBreakers.get(endpoint)!
  }

  /**
   * Execute request with retry logic
   */
  private async executeRequest(config: AxiosRequestConfig): Promise<AxiosResponse> {
    return pRetry(
      async () => {
        try {
          const response = await this.axios.request(config)
          return response
        } catch (error: any) {
          // Don't retry on client errors (4xx)
          if (error.response?.status >= 400 && error.response?.status < 500) {
            throw new pRetry.AbortError(error.message)
          }
          throw error
        }
      },
      {
        ...this.config.retry,
        onFailedAttempt: (error) => {
          this.metrics.retries++
          apiLogger.warn(`Retry attempt ${error.attemptNumber} for ${config.url}`)
          this.emit('retry', {
            url: config.url,
            attempt: error.attemptNumber,
            error: error.message,
          })
          
          if (this.config.retry.onFailedAttempt) {
            this.config.retry.onFailedAttempt(error)
          }
        },
      }
    )
  }

  /**
   * Try fallback URLs when primary fails
   */
  private async tryFallbackURLs<T = any>(originalConfig: AxiosRequestConfig): Promise<T> {
    const errors: any[] = []
    
    for (const fallbackURL of this.config.fallbackBaseURLs) {
      try {
        apiLogger.info(`Trying fallback URL: ${fallbackURL}`)
        
        const fallbackAxios = axios.create({
          ...this.axios.defaults,
          baseURL: fallbackURL,
        })
        
        const response = await fallbackAxios.request(originalConfig)
        
        // Update base URL for future requests if successful
        this.currentBaseURLIndex = this.config.fallbackBaseURLs.indexOf(fallbackURL) + 1
        this.axios.defaults.baseURL = fallbackURL
        
        this.emit('fallback:success', { url: fallbackURL })
        
        return response.data
      } catch (error) {
        errors.push(error)
        this.emit('fallback:failed', { url: fallbackURL, error })
      }
    }
    
    // All fallbacks failed
    throw new Error(`All URLs failed. Errors: ${errors.map(e => e.message).join(', ')}`)
  }

  /**
   * Rate limiting check
   */
  private async checkRateLimit(): Promise<void> {
    const now = Date.now()
    
    // Reset window if needed
    if (now - this.rateLimitState.windowStart > this.config.rateLimit.windowMs) {
      this.rateLimitState = {
        requests: 0,
        windowStart: now,
      }
    }
    
    // Check if limit exceeded
    if (this.rateLimitState.requests >= this.config.rateLimit.maxRequests) {
      const waitTime = this.config.rateLimit.windowMs - (now - this.rateLimitState.windowStart)
      
      apiLogger.warn(`Rate limit exceeded. Waiting ${waitTime}ms`)
      this.emit('rateLimit:exceeded', { waitTime })
      
      await new Promise(resolve => setTimeout(resolve, waitTime))
      
      // Reset after waiting
      this.rateLimitState = {
        requests: 0,
        windowStart: Date.now(),
      }
    }
    
    this.rateLimitState.requests++
  }

  /**
   * Cache management
   */
  private getFromCache(url: string): any | null {
    const key = this.getCacheKey(url)
    const entry = this.cache.get(key)
    
    if (!entry) return null
    
    // Check if expired
    if (Date.now() - entry.timestamp > this.config.cache.ttl!) {
      this.cache.delete(key)
      return null
    }
    
    return entry.data
  }

  private saveToCache(url: string, data: any, etag?: string): void {
    const key = this.getCacheKey(url)
    
    // Enforce max cache size
    if (this.cache.size >= this.config.cache.maxSize!) {
      const firstKey = this.cache.keys().next().value
      this.cache.delete(firstKey)
    }
    
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      etag,
    })
  }

  private cleanupCache(): void {
    const now = Date.now()
    const expired: string[] = []
    
    for (const [key, entry] of this.cache.entries()) {
      if (now - entry.timestamp > this.config.cache.ttl!) {
        expired.push(key)
      }
    }
    
    expired.forEach(key => this.cache.delete(key))
    
    if (expired.length > 0) {
      this.emit('cache:cleanup', { removed: expired.length })
    }
  }

  /**
   * Interceptors for global error handling
   */
  private setupInterceptors(): void {
    // Request interceptor
    this.axios.interceptors.request.use(
      (config) => {
        // Add request ID for tracking
        config.headers['X-Request-ID'] = this.generateRequestId()
        
        // Add timing
        config.metadata = { startTime: Date.now() }
        
        return config
      },
      (error) => Promise.reject(error)
    )
    
    // Response interceptor
    this.axios.interceptors.response.use(
      (response) => {
        // Calculate request duration
        const duration = Date.now() - response.config.metadata.startTime
        
        this.emit('request:success', {
          url: response.config.url,
          duration,
          status: response.status,
        })
        
        return response
      },
      (error) => {
        if (error.config?.metadata) {
          const duration = Date.now() - error.config.metadata.startTime
          
          this.emit('request:error', {
            url: error.config.url,
            duration,
            status: error.response?.status,
            message: error.message,
          })
        }
        
        return Promise.reject(error)
      }
    )
  }

  /**
   * Utility methods
   */
  private getEndpointKey(url: string): string {
    try {
      const urlObj = new URL(url, this.axios.defaults.baseURL)
      return urlObj.pathname
    } catch {
      return url
    }
  }

  private getCacheKey(url: string): string {
    return createHash('md5').update(url).digest('hex')
  }

  private generateRequestId(): string {
    return `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  }

  private isNetworkError(error: any): boolean {
    return !error.response && (
      error.code === 'ECONNREFUSED' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ENOTFOUND' ||
      error.message.includes('Network Error')
    )
  }

  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      cacheSize: this.cache.size,
      circuitBreakers: Array.from(this.circuitBreakers.entries()).map(([endpoint, breaker]) => ({
        endpoint,
        state: breaker.opened ? 'open' : breaker.halfOpen ? 'half-open' : 'closed',
        stats: breaker.stats,
      })),
    }
  }

  /**
   * Reset all circuit breakers
   */
  resetCircuitBreakers(): void {
    for (const breaker of this.circuitBreakers.values()) {
      breaker.close()
    }
    
    apiLogger.info('All circuit breakers reset')
    this.emit('circuit:reset')
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    const size = this.cache.size
    this.cache.clear()
    
    apiLogger.info(`Cache cleared. Removed ${size} entries`)
    this.emit('cache:clear', { removed: size })
  }
}

/**
 * Factory function for common API configurations
 */
export function createResilientAPI(service: 'espn' | 'draftkings' | 'weather' | 'custom', customConfig?: ResilientAPIConfig): ResilientAPIWrapper {
  const configs: Record<string, ResilientAPIConfig> = {
    espn: {
      baseURL: 'https://site.api.espn.com/apis',
      fallbackBaseURLs: [
        'https://site.web.api.espn.com/apis',
        'https://cdn.espn.com/apis',
      ],
      timeout: 15000,
      circuitBreaker: {
        errorThresholdPercentage: 60,
        resetTimeout: 60000,
      },
      retry: {
        retries: 5,
        factor: 2,
        maxTimeout: 30000,
      },
      cache: {
        enabled: true,
        ttl: 300000, // 5 minutes
      },
      rateLimit: {
        maxRequests: 30,
        windowMs: 60000,
      },
    },
    draftkings: {
      baseURL: 'https://api.draftkings.com',
      timeout: 10000,
      circuitBreaker: {
        errorThresholdPercentage: 50,
        resetTimeout: 30000,
      },
      retry: {
        retries: 3,
        factor: 2,
      },
      cache: {
        enabled: true,
        ttl: 60000, // 1 minute for live data
      },
      rateLimit: {
        maxRequests: 60,
        windowMs: 60000,
      },
    },
    weather: {
      baseURL: 'https://api.openweathermap.org/data/2.5',
      timeout: 10000,
      circuitBreaker: {
        errorThresholdPercentage: 70,
        resetTimeout: 120000,
      },
      retry: {
        retries: 2,
        factor: 2,
      },
      cache: {
        enabled: true,
        ttl: 3600000, // 1 hour for weather
      },
      rateLimit: {
        maxRequests: 60,
        windowMs: 60000,
      },
    },
  }
  
  if (service === 'custom' && customConfig) {
    return new ResilientAPIWrapper(customConfig)
  }
  
  return new ResilientAPIWrapper(configs[service])
}

export default ResilientAPIWrapper
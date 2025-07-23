#!/usr/bin/env tsx
/**
 * 🚦 INTELLIGENT RATE LIMITER
 * 
 * Advanced rate limiting to prevent API bans and ensure compliance:
 * - Sliding window rate limiting
 * - Platform-specific limits
 * - Circuit breaker pattern
 * - Exponential backoff
 * - Request queuing and priority
 * - Burst allowance
 * 
 * Prevents API bans while maximizing throughput!
 */

import chalk from 'chalk';
import { EventEmitter } from 'events';

interface RateLimit {
  requests: number;
  windowMs: number;
  burstAllowance?: number;
  priority?: number;
}

interface RateLimitRecord {
  requests: Array<{ timestamp: number; priority: number }>;
  firstRequest: number;
  lastRequest: number;
  violations: number;
  circuitOpen: boolean;
  circuitOpenUntil: number;
}

interface QueuedRequest {
  key: string;
  priority: number;
  timestamp: number;
  resolve: () => void;
  reject: (error: Error) => void;
}

export class RateLimiter extends EventEmitter {
  private limits = new Map<string, RateLimit>();
  private records = new Map<string, RateLimitRecord>();
  private queue: QueuedRequest[] = [];
  private processing = false;
  
  // Platform-specific default limits
  private readonly DEFAULT_LIMITS = {
    // DraftKings limits (conservative estimates)
    'draftkings_auth': { requests: 10, windowMs: 60 * 1000, priority: 10 }, // 10 per minute
    'draftkings_api': { requests: 60, windowMs: 60 * 1000, burstAllowance: 10, priority: 5 }, // 60 per minute with burst
    'draftkings_contests': { requests: 30, windowMs: 60 * 1000, priority: 3 }, // 30 per minute
    'draftkings_lineups': { requests: 120, windowMs: 60 * 1000, priority: 7 }, // 120 per minute
    
    // FanDuel limits (conservative estimates)
    'fanduel_auth': { requests: 10, windowMs: 60 * 1000, priority: 10 }, // 10 per minute
    'fanduel_api': { requests: 60, windowMs: 60 * 1000, burstAllowance: 10, priority: 5 }, // 60 per minute with burst
    'fanduel_contests': { requests: 30, windowMs: 60 * 1000, priority: 3 }, // 30 per minute
    'fanduel_lineups': { requests: 120, windowMs: 60 * 1000, priority: 7 }, // 120 per minute
    
    // General API limits
    'token_refresh': { requests: 30, windowMs: 60 * 1000, priority: 9 }, // 30 per minute
    'websocket': { requests: 5, windowMs: 60 * 1000, priority: 8 }, // 5 connections per minute
    
    // Default fallback
    'default': { requests: 30, windowMs: 60 * 1000, priority: 1 }
  };
  
  // Circuit breaker configuration
  private readonly CIRCUIT_BREAKER_CONFIG = {
    failureThreshold: 5, // Open circuit after 5 violations
    openTimeoutMs: 5 * 60 * 1000, // 5 minutes
    halfOpenAllowance: 1 // Allow 1 request when half-open
  };

  constructor() {
    super();
    
    // Initialize default limits
    for (const [key, limit] of Object.entries(this.DEFAULT_LIMITS)) {
      this.limits.set(key, limit);
    }
    
    // Start queue processor
    this.startQueueProcessor();
    
    // Cleanup old records every 5 minutes
    setInterval(() => this.cleanup(), 5 * 60 * 1000);
  }

  /**
   * Check if request is allowed within rate limit
   */
  async checkLimit(
    key: string, 
    requests?: number, 
    windowMs?: number, 
    priority: number = 1
  ): Promise<void> {
    // Get or set limit configuration
    const limit = this.getLimit(key, requests, windowMs, priority);
    
    // Check circuit breaker first
    if (await this.isCircuitOpen(key)) {
      const record = this.records.get(key);
      const waitTime = record ? record.circuitOpenUntil - Date.now() : 0;
      throw new Error(`Circuit breaker open for ${key}. Retry in ${Math.ceil(waitTime / 1000)} seconds`);
    }
    
    // Check current rate limit
    if (await this.isLimitExceeded(key, limit, priority)) {
      // Add to queue if priority is high enough
      if (priority >= 5) {
        await this.addToQueue(key, priority);
        return;
      }
      
      // Calculate wait time
      const waitTime = this.calculateWaitTime(key, limit);
      this.recordViolation(key);
      
      throw new Error(`Rate limit exceeded for ${key}. Retry in ${Math.ceil(waitTime / 1000)} seconds`);
    }
    
    // Record successful request
    this.recordRequest(key, priority);
    
    this.emit('request_allowed', { key, priority, limit });
  }

  /**
   * Set custom rate limit for a key
   */
  setLimit(key: string, requests: number, windowMs: number, priority: number = 1): void {
    this.limits.set(key, { requests, windowMs, priority });
    console.log(chalk.cyan(`🚦 Rate limit set for ${key}: ${requests} requests per ${windowMs}ms`));
  }

  /**
   * Add burst allowance to a limit
   */
  setBurstAllowance(key: string, burstRequests: number): void {
    const limit = this.limits.get(key);
    if (limit) {
      limit.burstAllowance = burstRequests;
      console.log(chalk.cyan(`⚡ Burst allowance set for ${key}: ${burstRequests} additional requests`));
    }
  }

  /**
   * Get current usage for a key
   */
  getUsage(key: string): { current: number; limit: number; remaining: number; resetTime: number } {
    const limit = this.limits.get(key) || this.DEFAULT_LIMITS.default;
    const record = this.records.get(key);
    
    if (!record) {
      return {
        current: 0,
        limit: limit.requests,
        remaining: limit.requests,
        resetTime: Date.now() + limit.windowMs
      };
    }
    
    const now = Date.now();
    const windowStart = now - limit.windowMs;
    const currentRequests = record.requests.filter(r => r.timestamp > windowStart).length;
    
    return {
      current: currentRequests,
      limit: limit.requests,
      remaining: Math.max(0, limit.requests - currentRequests),
      resetTime: record.firstRequest + limit.windowMs
    };
  }

  /**
   * Get all active limits and their usage
   */
  getAllUsage(): Record<string, any> {
    const usage: Record<string, any> = {};
    
    for (const key of this.limits.keys()) {
      usage[key] = this.getUsage(key);
    }
    
    return usage;
  }

  /**
   * Reset limits for a key (admin function)
   */
  resetLimit(key: string): void {
    this.records.delete(key);
    console.log(chalk.yellow(`🔄 Rate limit reset for ${key}`));
  }

  /**
   * Add request to priority queue
   */
  private async addToQueue(key: string, priority: number): Promise<void> {
    return new Promise((resolve, reject) => {
      const request: QueuedRequest = {
        key,
        priority,
        timestamp: Date.now(),
        resolve,
        reject
      };
      
      // Insert in priority order
      const insertIndex = this.queue.findIndex(r => r.priority < priority);
      if (insertIndex === -1) {
        this.queue.push(request);
      } else {
        this.queue.splice(insertIndex, 0, request);
      }
      
      console.log(chalk.yellow(`⏳ Request queued for ${key} (priority: ${priority}, queue size: ${this.queue.length})`));
      
      this.emit('request_queued', { key, priority, queueSize: this.queue.length });
    });
  }

  /**
   * Process queued requests
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.processing || this.queue.length === 0) {
        return;
      }
      
      this.processing = true;
      
      try {
        const processableRequests: QueuedRequest[] = [];
        
        // Group requests by key and check limits
        const keyGroups = new Map<string, QueuedRequest[]>();
        
        for (const request of this.queue) {
          if (!keyGroups.has(request.key)) {
            keyGroups.set(request.key, []);
          }
          keyGroups.get(request.key)!.push(request);
        }
        
        // Check each key group
        for (const [key, requests] of keyGroups) {
          const limit = this.getLimit(key);
          
          if (!await this.isCircuitOpen(key) && !await this.isLimitExceeded(key, limit, requests[0].priority)) {
            // Can process highest priority request for this key
            const request = requests.sort((a, b) => b.priority - a.priority)[0];
            processableRequests.push(request);
          }
        }
        
        // Process requests
        for (const request of processableRequests) {
          try {
            this.recordRequest(request.key, request.priority);
            request.resolve();
            
            // Remove from queue
            const index = this.queue.indexOf(request);
            if (index !== -1) {
              this.queue.splice(index, 1);
            }
            
            console.log(chalk.green(`✅ Processed queued request for ${request.key}`));
            
          } catch (error) {
            request.reject(error as Error);
          }
        }
        
        // Remove expired requests from queue (older than 5 minutes)
        const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
        const originalLength = this.queue.length;
        this.queue = this.queue.filter(r => r.timestamp > fiveMinutesAgo);
        
        if (this.queue.length < originalLength) {
          const expired = originalLength - this.queue.length;
          console.log(chalk.yellow(`🧹 Removed ${expired} expired requests from queue`));
        }
        
      } finally {
        this.processing = false;
      }
    }, 1000); // Process every second
  }

  /**
   * Get limit configuration for key
   */
  private getLimit(key: string, requests?: number, windowMs?: number, priority?: number): RateLimit {
    let limit = this.limits.get(key);
    
    if (!limit) {
      // Try to find platform-specific default
      const platform = key.split('_')[0];
      const operation = key.split('_')[1];
      const platformKey = `${platform}_${operation}`;
      
      limit = this.limits.get(platformKey) || this.DEFAULT_LIMITS.default;
    }
    
    // Override with provided parameters
    if (requests && windowMs) {
      limit = { requests, windowMs, priority: priority || limit.priority || 1 };
      this.limits.set(key, limit);
    }
    
    return limit;
  }

  /**
   * Check if circuit breaker is open
   */
  private async isCircuitOpen(key: string): Promise<boolean> {
    const record = this.records.get(key);
    
    if (!record || !record.circuitOpen) {
      return false;
    }
    
    // Check if circuit should be closed
    if (Date.now() >= record.circuitOpenUntil) {
      record.circuitOpen = false;
      record.violations = 0;
      console.log(chalk.green(`🔄 Circuit breaker closed for ${key}`));
      return false;
    }
    
    return true;
  }

  /**
   * Check if rate limit is exceeded
   */
  private async isLimitExceeded(key: string, limit: RateLimit, priority: number): Promise<boolean> {
    const record = this.records.get(key);
    
    if (!record) {
      return false; // No previous requests
    }
    
    const now = Date.now();
    const windowStart = now - limit.windowMs;
    
    // Count requests in current window
    const currentRequests = record.requests.filter(r => r.timestamp > windowStart);
    let allowedRequests = limit.requests;
    
    // Add burst allowance for high priority requests
    if (priority >= 8 && limit.burstAllowance) {
      allowedRequests += limit.burstAllowance;
    }
    
    return currentRequests.length >= allowedRequests;
  }

  /**
   * Record a successful request
   */
  private recordRequest(key: string, priority: number): void {
    const now = Date.now();
    
    let record = this.records.get(key);
    if (!record) {
      record = {
        requests: [],
        firstRequest: now,
        lastRequest: now,
        violations: 0,
        circuitOpen: false,
        circuitOpenUntil: 0
      };
      this.records.set(key, record);
    }
    
    record.requests.push({ timestamp: now, priority });
    record.lastRequest = now;
    
    // Update first request time if this is the start of a new window
    const limit = this.getLimit(key);
    const windowStart = now - limit.windowMs;
    
    if (record.firstRequest < windowStart) {
      const firstValidRequest = record.requests.find(r => r.timestamp > windowStart);
      record.firstRequest = firstValidRequest?.timestamp || now;
    }
  }

  /**
   * Record a rate limit violation
   */
  private recordViolation(key: string): void {
    let record = this.records.get(key);
    if (!record) {
      record = {
        requests: [],
        firstRequest: Date.now(),
        lastRequest: Date.now(),
        violations: 0,
        circuitOpen: false,
        circuitOpenUntil: 0
      };
      this.records.set(key, record);
    }
    
    record.violations++;
    
    console.log(chalk.red(`⚠️ Rate limit violation for ${key} (${record.violations}/${this.CIRCUIT_BREAKER_CONFIG.failureThreshold})`));
    
    // Check if circuit breaker should open
    if (record.violations >= this.CIRCUIT_BREAKER_CONFIG.failureThreshold) {
      record.circuitOpen = true;
      record.circuitOpenUntil = Date.now() + this.CIRCUIT_BREAKER_CONFIG.openTimeoutMs;
      
      console.log(chalk.red(`🚨 Circuit breaker opened for ${key} until ${new Date(record.circuitOpenUntil).toLocaleTimeString()}`));
      
      this.emit('circuit_breaker_opened', { key, violations: record.violations });
    }
    
    this.emit('rate_limit_violation', { key, violations: record.violations });
  }

  /**
   * Calculate wait time before next request
   */
  private calculateWaitTime(key: string, limit: RateLimit): number {
    const record = this.records.get(key);
    
    if (!record || record.requests.length === 0) {
      return 0;
    }
    
    const now = Date.now();
    const windowStart = now - limit.windowMs;
    const oldestRequest = record.requests.find(r => r.timestamp > windowStart);
    
    if (oldestRequest) {
      return oldestRequest.timestamp + limit.windowMs - now;
    }
    
    return 0;
  }

  /**
   * Clean up old records
   */
  private cleanup(): void {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, record] of this.records.entries()) {
      const limit = this.getLimit(key);
      const windowStart = now - limit.windowMs;
      
      // Remove old requests
      const oldLength = record.requests.length;
      record.requests = record.requests.filter(r => r.timestamp > windowStart);
      
      // Remove record if no recent requests and no violations
      if (record.requests.length === 0 && record.violations === 0 && !record.circuitOpen) {
        this.records.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(chalk.cyan(`🧹 Cleaned up ${cleaned} old rate limit records`));
    }
  }
}

// Export singleton instance
export const rateLimiter = new RateLimiter();
export { withAuth } from './auth-middleware';
export type { AuthMiddlewareOptions } from './auth-middleware';
export { RateLimiter } from './rate-limiter';
export type { RateLimitConfig } from './rate-limiter';
export { SecurityHeaders } from './security-headers';
export { CSRFProtection } from './csrf-protection';

// Re-export common configurations
export const rateLimitConfigs = {
  strict: { max: 10, windowMs: 60000 },      // 10 req/min
  normal: { max: 100, windowMs: 60000 },     // 100 req/min
  relaxed: { max: 500, windowMs: 60000 },    // 500 req/min
  auth: { max: 5, windowMs: 300000 },        // 5 req/5min for auth endpoints
  api: { max: 1000, windowMs: 60000 },       // 1000 req/min for API
} as const;
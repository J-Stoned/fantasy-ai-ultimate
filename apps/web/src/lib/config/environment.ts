/**
 * 🔧 Centralized Environment Configuration
 * Type-safe environment variable management with validation
 */

import { z } from 'zod';

// Environment variable schema
const envSchema = z.object({
  // Node environment
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  
  // Database
  DATABASE_URL: z.string().url().optional(),
  DATABASE_POOL_MIN: z.string().transform(Number).default('10'),
  DATABASE_POOL_MAX: z.string().transform(Number).default('100'),
  
  // Supabase
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  
  // Redis/Upstash
  REDIS_URL: z.string().optional(),
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),
  
  // API URLs
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:3000/api'),
  NEXT_PUBLIC_WS_URL: z.string().url().default('ws://localhost:3001'),
  LOG_AGGREGATION_ENDPOINT: z.string().url().default('http://localhost:3001/logs'),
  
  // Security
  NEXTAUTH_SECRET: z.string().min(32),
  CSRF_SECRET: z.string().min(32),
  JWT_SECRET: z.string().min(32).optional(),
  LOG_SERVICE_TOKEN: z.string().default('dev-token'),
  
  // Sentry
  SENTRY_DSN: z.string().optional(),
  SENTRY_ENVIRONMENT: z.string().default('development'),
  SENTRY_TRACES_SAMPLE_RATE: z.string().transform(Number).default('0.1'),
  
  // APM Configuration
  APM_ENABLED: z.string().transform(v => v === 'true').default('true'),
  APM_FLUSH_INTERVAL: z.string().transform(Number).default('30000'),
  APM_MAX_METRICS: z.string().transform(Number).default('10000'),
  APM_DEBUG: z.string().transform(v => v === 'true').default('false'),
  
  // Rate Limiting
  RATE_LIMIT_WINDOW: z.string().transform(Number).default('900000'), // 15 minutes
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  
  // Feature Flags
  FEATURE_FLAG_NEW_UI: z.string().transform(v => v === 'true').default('true'),
  FEATURE_FLAG_ML_PREDICTIONS: z.string().transform(v => v === 'true').default('true'),
  
  // Admin
  ADMIN_USER_IDS: z.string().transform(v => v.split(',')).default(''),
});

// Parse and validate environment variables
const parseEnv = () => {
  try {
    return envSchema.parse(process.env);
  } catch (error) {
    if (error instanceof z.ZodError) {
      const missingVars = error.errors.map(e => e.path.join('.')).join(', ');
      throw new Error(`Missing or invalid environment variables: ${missingVars}`);
    }
    throw error;
  }
};

// Export validated environment configuration
export const env = parseEnv();

// Type-safe environment access
export type Env = z.infer<typeof envSchema>;

// Environment checks
export const isDevelopment = env.NODE_ENV === 'development';
export const isProduction = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

// Feature flags
export const featureFlags = {
  newUI: env.FEATURE_FLAG_NEW_UI,
  mlPredictions: env.FEATURE_FLAG_ML_PREDICTIONS,
} as const;

// Rate limit configuration
export const rateLimitConfig = {
  window: env.RATE_LIMIT_WINDOW,
  maxRequests: env.RATE_LIMIT_MAX_REQUESTS,
} as const;

// Admin configuration
export const adminConfig = {
  userIds: new Set(env.ADMIN_USER_IDS.filter(Boolean)),
  isAdmin: (userId: string) => adminConfig.userIds.has(userId),
} as const;
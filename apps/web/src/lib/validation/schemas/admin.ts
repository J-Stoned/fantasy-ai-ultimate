import { z } from 'zod';
import { safeStringSchema, sportSchema, platformSchema, ipAddressSchema } from './common';

// Admin-specific validation schemas

// Data collection request
export const dataCollectionSchema = z.object({
  sport: sportSchema,
  dataType: z.enum(['players', 'games', 'stats', 'injuries', 'odds', 'ownership']),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  source: z.enum(['official', 'scraper', 'api']).optional(),
  forceRefresh: z.boolean().default(false),
  limit: z.number().int().min(1).max(10000).optional(),
});

// ML model training request
export const mlTrainingRequestSchema = z.object({
  sport: sportSchema,
  modelType: z.enum(['prediction', 'optimization', 'ownership', 'stacking']),
  trainingConfig: z.object({
    epochs: z.number().int().min(1).max(1000).default(100),
    batchSize: z.number().int().min(1).max(1024).default(32),
    learningRate: z.number().positive().max(1).default(0.001),
    validationSplit: z.number().min(0.1).max(0.5).default(0.2),
    earlyStopping: z.boolean().default(true),
    patience: z.number().int().min(1).max(50).default(10),
  }).optional(),
  features: z.array(z.string().max(50)).min(1).max(100).optional(),
  hyperparameters: z.record(z.string(), z.union([z.string(), z.number(), z.boolean()])).optional(),
});

// Admin stats query
export const adminStatsQuerySchema = z.object({
  metric: z.enum([
    'active_users',
    'revenue',
    'contests_entered',
    'ml_accuracy',
    'api_usage',
    'error_rate',
    'system_health'
  ]),
  period: z.enum(['hour', 'day', 'week', 'month', 'year']),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  groupBy: z.enum(['sport', 'platform', 'user_tier']).optional(),
});

// System optimization request
export const systemOptimizationSchema = z.object({
  target: z.enum(['performance', 'cost', 'accuracy', 'balanced']),
  components: z.array(z.enum([
    'database',
    'cache',
    'ml_models',
    'api_endpoints',
    'background_jobs'
  ])).min(1),
  constraints: z.object({
    maxDowntime: z.number().int().min(0).max(3600).optional(), // seconds
    maxCost: z.number().positive().optional(),
    minAccuracy: z.number().min(0).max(1).optional(),
  }).optional(),
  dryRun: z.boolean().default(true),
});

// Prediction request (admin)
export const adminPredictionRequestSchema = z.object({
  sport: sportSchema,
  players: z.array(z.object({
    playerId: z.string().max(100),
    gameId: z.string().max(100).optional(),
    customFeatures: z.record(z.string(), z.number()).optional(),
  })).min(1).max(1000),
  modelVersion: z.string().max(50).optional(),
  includeConfidence: z.boolean().default(true),
  includeExplanation: z.boolean().default(false),
});

// Trading orchestration
export const tradingOrchestrationSchema = z.object({
  strategy: z.enum(['aggressive', 'balanced', 'conservative', 'custom']),
  sports: z.array(sportSchema).min(1),
  platforms: z.array(platformSchema).min(1),
  bankrollAllocation: z.object({
    total: z.number().positive().max(1000000),
    perSport: z.record(sportSchema, z.number().positive()).optional(),
    perPlatform: z.record(platformSchema, z.number().positive()).optional(),
  }),
  constraints: z.object({
    maxExposurePerPlayer: z.number().min(0).max(100).optional(),
    maxContestsPerDay: z.number().int().positive().max(1000).optional(),
    minROI: z.number().optional(),
    maxRisk: z.number().min(0).max(1).optional(),
  }).optional(),
  automationLevel: z.enum(['manual', 'semi_auto', 'full_auto']),
});

// Session management
export const sessionManagementSchema = z.object({
  action: z.enum(['list', 'revoke', 'revoke_all', 'cleanup']),
  sessionId: z.string().uuid().optional(),
  userId: z.string().uuid().optional(),
  olderThan: z.number().int().positive().optional(), // days
  excludeCurrent: z.boolean().default(true),
});

// Client info tracking
export const clientInfoSchema = z.object({
  userAgent: safeStringSchema(500),
  ip: ipAddressSchema,
  screenResolution: z.string().max(20).optional(),
  timezone: z.string().max(50).optional(),
  language: z.string().max(10).optional(),
  platform: z.string().max(50).optional(),
});

// Rate limit override
export const rateLimitOverrideSchema = z.object({
  identifier: z.union([ipAddressSchema, z.string().uuid()]), // IP or userId
  endpoint: z.string().max(255).optional(),
  limit: z.number().int().positive().max(10000),
  window: z.number().int().positive().max(86400), // seconds
  duration: z.number().int().positive().max(2592000), // seconds (max 30 days)
  reason: safeStringSchema(500),
});

// Audit log query
export const auditLogQuerySchema = z.object({
  userId: z.string().uuid().optional(),
  action: z.string().max(100).optional(),
  resource: z.string().max(100).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  severity: z.enum(['info', 'warning', 'error', 'critical']).optional(),
  limit: z.number().int().min(1).max(1000).default(100),
  offset: z.number().int().min(0).default(0),
});

export type DataCollectionInput = z.infer<typeof dataCollectionSchema>;
export type MLTrainingRequestInput = z.infer<typeof mlTrainingRequestSchema>;
export type TradingOrchestrationInput = z.infer<typeof tradingOrchestrationSchema>;
export type SessionManagementInput = z.infer<typeof sessionManagementSchema>;
export type AuditLogQueryInput = z.infer<typeof auditLogQuerySchema>;
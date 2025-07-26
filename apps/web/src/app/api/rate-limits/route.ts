import { NextRequest, NextResponse } from 'next/server';

/**
 * Rate Limit Information Endpoint
 * Provides current rate limit status and configuration
 */

export const runtime = 'edge'

const RATE_LIMIT_TIERS = {
  free: {
    requests: 100,
    window: 15, // minutes
    endpoints: {
      default: 100,
      predictions: 30,
      ml: 20,
    },
  },
  pro: {
    requests: 1000,
    window: 15,
    endpoints: {
      default: 1000,
      predictions: 100,
      ml: 50,
    },
  },
  enterprise: {
    requests: 10000,
    window: 15,
    endpoints: {
      default: 10000,
      predictions: 500,
      ml: 200,
    },
  },
};

const ENDPOINT_LIMITS = {
  '/api/auth/login': { requests: 5, window: '15m', description: 'Login attempts' },
  '/api/auth/register': { requests: 3, window: '1h', description: 'Registration' },
  '/api/predictions': { requests: 30, window: '1m', description: 'Predictions' },
  '/api/ml/predict': { requests: 20, window: '1m', description: 'ML predictions' },
  '/api/data/export': { requests: 10, window: '1h', description: 'Data export' },
  '/api/ml/train': { requests: 5, window: '24h', description: 'ML training' },
  '/api/voice/process': { requests: 20, window: '5m', description: 'Voice processing' },
  '/api/oracle': { requests: 30, window: '5m', description: 'Oracle queries' },
};

export async function GET(request: NextRequest) {
  // Get user tier from request (simplified - in production, get from auth)
  const userTier = request.headers.get('x-user-tier') || 'free';
  const tier = RATE_LIMIT_TIERS[userTier as keyof typeof RATE_LIMIT_TIERS] || RATE_LIMIT_TIERS.free;

  // Get current rate limit status from headers
  const currentLimit = request.headers.get('x-ratelimit-limit');
  const currentRemaining = request.headers.get('x-ratelimit-remaining');
  const currentReset = request.headers.get('x-ratelimit-reset');

  const response = {
    tier: userTier,
    limits: {
      global: {
        requests: tier.requests,
        window: `${tier.window}m`,
        description: 'Global API rate limit',
      },
      current: currentLimit ? {
        limit: parseInt(currentLimit),
        remaining: currentRemaining ? parseInt(currentRemaining) : null,
        reset: currentReset,
        percentUsed: currentLimit && currentRemaining 
          ? Math.round((1 - parseInt(currentRemaining) / parseInt(currentLimit)) * 100)
          : 0,
      } : null,
    },
    endpoints: Object.entries(ENDPOINT_LIMITS).map(([endpoint, config]) => ({
      endpoint,
      ...config,
    })),
    headers: {
      limit: 'X-RateLimit-Limit',
      remaining: 'X-RateLimit-Remaining', 
      reset: 'X-RateLimit-Reset',
      retryAfter: 'Retry-After',
    },
    upgradeOptions: userTier === 'free' ? {
      pro: {
        increase: '10x more requests',
        price: '$29/month',
        benefits: [
          '1,000 requests per 15 minutes',
          'Higher ML prediction limits',
          'Priority support',
        ],
      },
      enterprise: {
        increase: '100x more requests',
        price: 'Custom pricing',
        benefits: [
          '10,000 requests per 15 minutes',
          'Dedicated infrastructure',
          'Custom limits',
          'SLA guarantee',
        ],
      },
    } : null,
    documentation: '/docs/api/rate-limiting',
    support: 'support@fantasyai.com',
  };

  return NextResponse.json(response);
}
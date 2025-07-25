/**
 * 🤖 ML PREDICTIONS API WITH RATE LIMITING 🤖
 * Example of rate-limited ML prediction endpoint
 */

import { NextRequest, NextResponse } from 'next/server';
import { mlRateLimit } from '@/lib/middleware/rate-limit';
import { logger } from '../../../lib/logging/logger';

// Apply ML-specific rate limiting (100 req/hour for authenticated users)
export async function POST(request: NextRequest) {
  try {
    // Rate limiting is already applied in middleware.ts for /api/* routes
    // But you can also add endpoint-specific rate limiting here if needed
    
    // Parse request body
    const { sport, players, contestType } = await request.json();
    
    // Validate inputs
    if (!sport || !players || !Array.isArray(players)) {
      return NextResponse.json(
        { error: 'Invalid request: sport and players array required' },
        { status: 400 }
      );
    }
    
    // Simulate ML prediction (replace with actual ML service call)
    const predictions = players.map(player => ({
      playerId: player.id,
      playerName: player.name,
      projectedPoints: Math.random() * 30 + 10, // 10-40 points
      confidence: Math.random() * 0.3 + 0.7, // 70-100% confidence
      features: {
        recentForm: Math.random(),
        matchup: Math.random(),
        historical: Math.random()
      }
    }));
    
    // Log prediction request for analytics
    logger.info('ML Prediction requested: ${sport} - ${players.length} players');
    
    return NextResponse.json({
      success: true,
      sport,
      contestType,
      predictions,
      modelVersion: '2.0.1',
      timestamp: new Date().toISOString()
    });
    
  } catch (error) {
    logger.error('Prediction error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to generate predictions' },
      { status: 500 }
    );
  }
}

// Example GET endpoint to check rate limit status
export async function GET(request: NextRequest) {
  // Get rate limit headers from the request (set by middleware)
  const headers = request.headers;
  
  return NextResponse.json({
    message: 'ML Predictions API',
    rateLimit: {
      limit: headers.get('x-ratelimit-limit') || 'N/A',
      remaining: headers.get('x-ratelimit-remaining') || 'N/A',
      reset: headers.get('x-ratelimit-reset') || 'N/A'
    },
    endpoints: {
      POST: {
        description: 'Generate ML predictions for players',
        rateLimit: '100 requests/hour (authenticated), 20 requests/hour (public)',
        body: {
          sport: 'string (required)',
          players: 'array of player objects (required)',
          contestType: 'string (optional)'
        }
      }
    }
  });
}
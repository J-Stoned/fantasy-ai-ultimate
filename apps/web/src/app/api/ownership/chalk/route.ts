/**
 * 🔥 Chalk Analysis API - Enterprise Architecture
 * Elite implementation with proper separation of concerns
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/services/database';
import { MLServiceFactory } from '@/lib/services/ml/prediction-service-interface';
import { featureFlags } from '@/lib/services/feature-flags';
import { logger } from '@/lib/logging/logger';
import { z } from 'zod';

// Request validation schema
const chalkRequestSchema = z.object({
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL']),
  date: z.string().optional(),
  slateId: z.string().optional(),
});

// Response cache for performance
const CACHE_TTL = 300; // 5 minutes
const responseCache = new Map<string, { data: any; timestamp: number }>();

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // 1. Validate request
    const body = await request.json();
    const validation = chalkRequestSchema.safeParse(body);
    
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Invalid request', details: validation.error.issues },
        { status: 400 }
      );
    }

    const { sport, date, slateId } = validation.data;
    const cacheKey = `chalk:${sport}:${date || 'today'}:${slateId || 'main'}`;

    // 2. Check cache
    const cached = responseCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL * 1000) {
      logger.info('Returning cached chalk analysis', { cacheKey });
      return NextResponse.json(cached.data);
    }

    // 3. Check if ML features are enabled
    const mlEnabled = featureFlags.isEnabled('ML_PREDICTIONS');
    
    // 4. Fetch player data
    const playersQuery = `
      SELECT 
        p.player_id,
        p.name,
        p.team,
        p.position,
        p.salary,
        COALESCE(AVG(gl.fantasy_points), 0) as avg_points,
        COUNT(gl.game_id) as games_played,
        COALESCE(po.ownership_percentage, 0) as projected_ownership
      FROM players p
      LEFT JOIN game_logs gl ON p.player_id = gl.player_id
      LEFT JOIN projected_ownership po ON p.player_id = po.player_id
      WHERE p.sport = $1
        AND p.active = true
      GROUP BY p.player_id, p.name, p.team, p.position, p.salary, po.ownership_percentage
      HAVING COUNT(gl.game_id) > 0
      ORDER BY po.ownership_percentage DESC
      LIMIT 50
    `;

    const playersResult = await pool.query(playersQuery, [sport]);
    const players = playersResult.rows;

    // 5. Enhance with ML predictions if available
    let enhancedPlayers = players;
    
    if (mlEnabled) {
      try {
        const predictionService = MLServiceFactory.createPredictionService();
        const isAvailable = await predictionService.isAvailable();
        
        if (isAvailable) {
          const predictions = await predictionService.batchPredict(players);
          enhancedPlayers = players.map((player, index) => ({
            ...player,
            predicted_points: predictions[index]?.predictedPoints || player.avg_points,
            prediction_confidence: predictions[index]?.confidence || 0,
          }));
        }
      } catch (error) {
        logger.warn('ML predictions unavailable, using historical averages', { error });
      }
    }

    // 6. Calculate chalk metrics
    const chalkPlayers = enhancedPlayers
      .filter(p => p.projected_ownership > 20)
      .map(player => {
        const value = mlEnabled && player.predicted_points
          ? player.predicted_points / (player.salary / 1000)
          : player.avg_points / (player.salary / 1000);
          
        return {
          ...player,
          value_per_1k: value,
          chalk_score: player.projected_ownership * value,
          fade_recommendation: player.projected_ownership > 30 && value < 3,
        };
      })
      .sort((a, b) => b.chalk_score - a.chalk_score);

    // 7. Generate insights
    const insights = {
      total_chalk_plays: chalkPlayers.length,
      highest_owned: chalkPlayers[0],
      best_chalk_value: chalkPlayers.sort((a, b) => b.value_per_1k - a.value_per_1k)[0],
      fade_candidates: chalkPlayers.filter(p => p.fade_recommendation),
      ml_enabled: mlEnabled,
      processing_time_ms: Date.now() - startTime,
    };

    const response = {
      sport,
      date: date || new Date().toISOString().split('T')[0],
      slate_id: slateId || 'main',
      chalk_players: chalkPlayers.slice(0, 20),
      insights,
      generated_at: new Date().toISOString(),
    };

    // 8. Cache response
    responseCache.set(cacheKey, {
      data: response,
      timestamp: Date.now(),
    });

    // 9. Log metrics
    logger.info('Chalk analysis completed', {
      sport,
      players_analyzed: players.length,
      chalk_identified: chalkPlayers.length,
      ml_used: mlEnabled,
      processing_time: Date.now() - startTime,
    });

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Chalk analysis failed', { error });
    return NextResponse.json(
      { 
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? error.message : undefined,
      },
      { status: 500 }
    );
  }
}
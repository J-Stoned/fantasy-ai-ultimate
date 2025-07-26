/**
 * 🤖 ML Prediction API
 * POST /api/ml/predict
 * 
 * Handles ML predictions on the backend to avoid client-side TensorFlow
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logging/logger';
import { MLPredictionService } from '@/lib/services/ml/backend-prediction-service';

// Request validation schema
const PredictionRequestSchema = z.object({
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL']),
  playerId: z.string(),
  features: z.object({
    recentGames: z.array(z.object({
      fantasyPoints: z.number(),
      minutes: z.number().optional(),
      opponent: z.string(),
      isHome: z.boolean(),
      daysRest: z.number(),
    })).max(10),
    seasonAverage: z.number(),
    careerAverage: z.number(),
    vsTeamAverage: z.number().optional(),
    injuryStatus: z.enum(['healthy', 'questionable', 'doubtful']).optional(),
  }),
  modelType: z.enum(['standard', 'advanced', 'ensemble']).default('standard'),
});

// Initialize ML service (singleton)
let mlService: MLPredictionService | null = null;

async function getMLService(): Promise<MLPredictionService> {
  if (!mlService) {
    mlService = new MLPredictionService();
    await mlService.initialize();
  }
  return mlService;
}

export async function POST(request: NextRequest) {
  try {
    // Parse and validate request
    const body = await request.json();
    const validatedData = PredictionRequestSchema.parse(body);
    
    // Log prediction request
    logger.info('ML prediction request', {
      sport: validatedData.sport,
      playerId: validatedData.playerId,
      modelType: validatedData.modelType,
    });
    
    // Get ML service
    const service = await getMLService();
    
    // Make prediction
    const prediction = await service.predict({
      sport: validatedData.sport,
      playerId: validatedData.playerId,
      features: validatedData.features,
      modelType: validatedData.modelType,
    });
    
    // Return prediction result
    return NextResponse.json({
      success: true,
      prediction: {
        playerId: validatedData.playerId,
        sport: validatedData.sport,
        projectedPoints: prediction.projectedPoints,
        confidence: prediction.confidence,
        range: {
          low: prediction.range.low,
          high: prediction.range.high,
        },
        factors: prediction.factors,
        modelVersion: prediction.modelVersion,
        timestamp: new Date().toISOString(),
      },
    });
    
  } catch (error) {
    if (error instanceof z.ZodError) {
      logger.warn('Invalid prediction request', { errors: error.errors });
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request data',
          details: error.errors,
        },
        { status: 400 }
      );
    }
    
    logger.error('ML prediction error', { error });
    return NextResponse.json(
      {
        success: false,
        error: 'Prediction failed',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Health check endpoint
export async function GET() {
  try {
    const service = await getMLService();
    const health = await service.healthCheck();
    
    return NextResponse.json({
      status: health.isHealthy ? 'healthy' : 'unhealthy',
      models: health.models,
      tensorflow: health.tensorflowVersion,
      gpu: health.gpuAvailable,
      timestamp: new Date().toISOString(),
    });
    
  } catch (error) {
    logger.error('ML health check error', { error });
    return NextResponse.json(
      {
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 503 }
    );
  }
}
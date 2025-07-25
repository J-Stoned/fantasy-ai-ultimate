import { NextRequest, NextResponse } from 'next/server';
import { contestService } from '@/lib/services/contest-service';
import { validateQueryParams, moneySchema, z } from '@/lib/validation';
import { logger } from '../../../../lib/logging/logger';

// Define validation schema for optimal contest query
const optimalContestQuerySchema = z.object({
  budget: z.string()
    .transform(val => parseFloat(val))
    .pipe(moneySchema.min(1, 'Budget must be at least $1'))
    .default('100'),
  risk: z.enum(['low', 'medium', 'high']).default('medium'),
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL']).optional(),
  platform: z.enum(['draftkings', 'fanduel', 'yahoo']).optional(),
  maxContests: z.string()
    .transform(val => parseInt(val))
    .pipe(z.number().int().min(1).max(50))
    .optional(),
});

// GET /api/contests/optimal - Get optimal contests based on budget and risk tolerance
export const GET = validateQueryParams(optimalContestQuerySchema, async (request: NextRequest, params) => {
  try {
    // Params are already validated and typed
    const { budget, risk: riskTolerance, sport, platform, maxContests } = params;
    
    // Get optimal contests from service with additional filters
    const contests = await contestService.getOptimalContests(budget, riskTolerance, {
      sport,
      platform,
      limit: maxContests
    });
    
    return NextResponse.json({
      success: true,
      contests,
      parameters: {
        budget,
        riskTolerance,
        sport,
        platform,
        maxContests
      }
    });
    
  } catch (error) {
    logger.error('Error fetching optimal contests:', { error: error });
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to fetch optimal contests',
        message: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
});
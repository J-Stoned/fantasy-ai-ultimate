/**
 * 🎯 ORACLE SPECIALIST SUMMONING API
 * 
 * This endpoint handles summoning specific AI specialists
 * through the Oracle system for targeted expertise.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOracleService } from '@/lib/services/ai/oracle-service';
import { getMultiAgentSystem } from '@/lib/services/ai/multi-agent-system';
import { validateRequest } from '@/lib/utils/validation';
import { z } from 'zod';
import { logger } from '../../../../lib/logging/logger';

// Specialist summoning schema
const summonSchema = z.object({
  specialistId: z.enum([
    'data-scientist',
    'vegas-sharp',
    'contrarian',
    'optimizer',
    'floor-general',
    'narrative-master',
    'weather-hawk',
    'chaos-agent'
  ]),
  query: z.string().min(1).max(1000),
  sessionId: z.string(),
  context: z.object({
    sport: z.string().optional(),
    contestType: z.string().optional(),
    playerIds: z.array(z.string()).optional(),
    lineup: z.any().optional()
  }).optional()
});

export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequest(req, summonSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { specialistId, query, sessionId, context } = validation.data;
    
    logger.info('🎯 Summoning specialist: ${specialistId}');

    const oracleService = getOracleService();
    const multiAgentSystem = getMultiAgentSystem();

    // Get specialist info
    const specialist = multiAgentSystem.getAgent(specialistId);
    if (!specialist) {
      return NextResponse.json(
        { error: `Specialist ${specialistId} not found` },
        { status: 404 }
      );
    }

    // Process through Oracle with specialist summon
    const response = await oracleService.processQuery({
      text: `Summon ${specialist.name}. ${query}`,
      sessionId,
      context
    });

    // Add specialist info to response
    const enrichedResponse = {
      ...response,
      specialist: {
        id: specialist.id,
        name: specialist.name,
        emoji: specialist.emoji,
        personality: specialist.personality,
        strategy: specialist.strategy,
        specialties: getSpecialistSpecialties(specialistId)
      }
    };

    return NextResponse.json({
      success: true,
      response: enrichedResponse,
      metadata: {
        specialistSummoned: specialistId,
        sessionId: response.sessionId
      }
    });

  } catch (error) {
    logger.error('Specialist summon error:', { error: error });
    return NextResponse.json(
      { 
        error: 'Failed to summon specialist',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET - List available specialists
export async function GET(req: NextRequest) {
  try {
    const multiAgentSystem = getMultiAgentSystem();
    const agents = multiAgentSystem.getAllAgents();

    const specialists = agents
      .filter(agent => agent.id !== 'fantasy-oracle') // Exclude Oracle from specialists
      .map(agent => ({
        id: agent.id,
        name: agent.name,
        emoji: agent.emoji,
        personality: agent.personality,
        strategy: agent.strategy,
        specialties: getSpecialistSpecialties(agent.id),
        availability: 'available' // In real implementation, could check if busy
      }));

    return NextResponse.json({
      success: true,
      specialists,
      total: specialists.length
    });

  } catch (error) {
    logger.error('List specialists error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to list specialists' },
      { status: 500 }
    );
  }
}

/**
 * Get specialist specialties
 */
function getSpecialistSpecialties(specialistId: string): string[] {
  const specialties: { [key: string]: string[] } = {
    'data-scientist': [
      'Statistical Analysis',
      'Machine Learning Predictions',
      'Historical Trends',
      'Advanced Metrics',
      'Correlation Analysis'
    ],
    'vegas-sharp': [
      'Betting Lines Analysis',
      'Ownership Projections',
      'Game Theory',
      'Market Inefficiencies',
      'Sharp Money Tracking'
    ],
    'contrarian': [
      'Low Ownership Plays',
      'Tournament Strategy',
      'Leverage Spots',
      'Fade Candidates',
      'GPP Construction'
    ],
    'optimizer': [
      'Lineup Building',
      'Salary Cap Management',
      'Stacking Strategies',
      'Multi-Entry Optimization',
      'Exposure Settings'
    ],
    'floor-general': [
      'Safe Floor Plays',
      'Cash Game Strategy',
      'Consistency Metrics',
      'Injury Analysis',
      'Minute Projections'
    ],
    'narrative-master': [
      'Narrative Building',
      'Revenge Games',
      'Milestone Tracking',
      'Primetime Analysis',
      'Motivation Factors'
    ],
    'weather-hawk': [
      'Weather Impact',
      'Wind Analysis',
      'Temperature Effects',
      'Precipitation Concerns',
      'Dome vs Outdoor'
    ],
    'chaos-agent': [
      'Boom/Bust Plays',
      'Long Shot Analysis',
      'Volatility Hunting',
      'Tournament Pivots',
      'Contrarian Stacks'
    ]
  };

  return specialties[specialistId] || [];
}

/**
 * 🎯 SPECIALIST SUMMONING FEATURES:
 * 
 * - Summon specific AI specialists through Oracle
 * - Get specialist expertise and specialties
 * - Maintain session context during handoff
 * - List all available specialists
 * - Track specialist availability
 * 
 * Say "Summon [Specialist Name]" or use this API directly
 */
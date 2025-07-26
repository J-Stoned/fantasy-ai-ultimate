/**
 * 🎯 ORACLE SPECIALIST SUMMONING API
 * 
 * This endpoint handles summoning specific AI specialists
 * through the Oracle system for targeted expertise.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOracleService } from '@/lib/services/ai/oracle-service';
import { getMultiAgentSystem } from '@/lib/services/ai/multi-agent-system';
import { playerDataService } from '../../../../lib/database/player-data-service';
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
    
    logger.info(`🎯 Summoning specialist: ${specialistId} with real data context`);

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

    // Enhance context with real player data from our 1.57M game stats database
    let enhancedContext = { ...context };
    const sport = context?.sport || 'NFL';

    try {
      // Get specialist-specific data context
      if (specialistId === 'data-scientist') {
        // Data scientist needs comprehensive stats
        const { data: topPlayers } = await playerDataService.getTopPerformers({
          sport,
          limit: 10,
          min_games: 3
        });
        
        enhancedContext.playerStats = topPlayers?.map(p => ({
          name: p.name,
          position: p.position,
          avgPoints: p.season_stats?.avg_fantasy_points,
          consistency: p.season_stats?.consistency_score,
          gamesPlayed: p.season_stats?.games_played
        })) || [];

      } else if (specialistId === 'vegas-sharp' || specialistId === 'contrarian') {
        // Vegas/Contrarian need ownership and trend data
        const { data: trendingPlayers } = await playerDataService.getPlayers({
          sport,
          include_stats: true,
          include_recent_games: true,
          limit: 15
        });

        if (trendingPlayers) {
          const trending = trendingPlayers
            .filter(p => p.season_stats && p.recent_games && p.recent_games.length >= 3)
            .map(p => {
              const seasonAvg = p.season_stats!.avg_fantasy_points || 0;
              const recentAvg = p.recent_games!.slice(0, 3).reduce((sum, game) => sum + (game.fantasy_points || 0), 0) / 3;
              return {
                name: p.name,
                position: p.position,
                team: p.team_abbreviation || p.team,
                trend: recentAvg - seasonAvg,
                avgPoints: seasonAvg,
                overallRating: p.overall_rating
              };
            })
            .sort((a, b) => b.trend - a.trend);

          enhancedContext.trendingPlayers = trending.slice(0, 8);
          enhancedContext.fadeCandidates = trending.slice(-5); // Bottom trending
        }

      } else if (specialistId === 'floor-general') {
        // Floor general needs consistency data
        const { data: consistentPlayers } = await playerDataService.getPlayers({
          sport,
          include_stats: true,
          limit: 20
        });

        enhancedContext.consistentPlayers = consistentPlayers
          ?.filter(p => p.season_stats?.consistency_score && p.season_stats.consistency_score > 70)
          .map(p => ({
            name: p.name,
            position: p.position,
            avgPoints: p.season_stats?.avg_fantasy_points,
            consistency: p.season_stats?.consistency_score,
            floor: p.season_stats?.avg_fantasy_points ? p.season_stats.avg_fantasy_points * 0.8 : 0
          })) || [];

      } else {
        // Default context for other specialists
        const { data: topPlayers } = await playerDataService.getTopPerformers({
          sport,
          limit: 5,
          min_games: 3
        });

        enhancedContext.topPerformers = topPlayers?.map(p => ({
          name: p.name,
          position: p.position,
          team: p.team_abbreviation || p.team,
          avgPoints: p.season_stats?.avg_fantasy_points
        })) || [];
      }

      // Add database metadata
      enhancedContext.dataSource = '1.57M game stats dataset';
      enhancedContext.realData = true;

    } catch (error) {
      logger.warn(`Failed to enhance specialist ${specialistId} context:`, error);
    }

    // Process through Oracle with specialist summon and enhanced context
    const response = await oracleService.processQuery({
      text: `Summon ${specialist.name}. ${query}`,
      sessionId,
      context: enhancedContext
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
        sessionId: response.sessionId,
        dataSource: '1.57M game stats dataset',
        realData: true,
        contextEnhanced: !!(enhancedContext.playerStats || enhancedContext.trendingPlayers || enhancedContext.consistentPlayers || enhancedContext.topPerformers)
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
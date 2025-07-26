/**
 * 🔮 ORACLE QUERY API - MAIN FANTASY ORACLE INTERFACE
 * 
 * This endpoint processes queries to the Fantasy Oracle system,
 * handling voice/text input and returning AI-powered responses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOracleService, OracleQuery } from '@/lib/services/ai/oracle-service';
import { getElevenLabsService } from '@/lib/services/elevenlabs-service';
import { playerDataService } from '../../../../lib/database/player-data-service';
import { validateRequest } from '@/lib/utils/validation';
import { z } from 'zod';
import { logger } from '../../../../lib/logging/logger';

// Request validation schema
const querySchema = z.object({
  text: z.string().min(1).max(1000),
  context: z.object({
    sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'PGA', 'UFC']).optional(),
    contestType: z.enum(['GPP', 'CASH', 'H2H']).optional(),
    playerIds: z.array(z.string()).optional(),
    lineup: z.any().optional(),
    timeframe: z.string().optional(),
    budget: z.number().optional(),
    preferences: z.object({
      riskTolerance: z.enum(['conservative', 'balanced', 'aggressive']).optional(),
      favoriteTeams: z.array(z.string()).optional(),
      blacklist: z.array(z.string()).optional(),
      sportPreference: z.array(z.string()).optional(),
      contestPreference: z.string().optional()
    }).optional()
  }).optional(),
  sessionId: z.string().optional(),
  userId: z.string().optional(),
  voiceMetadata: z.object({
    confidence: z.number().min(0).max(1),
    emotion: z.string().optional(),
    speed: z.number().optional()
  }).optional(),
  generateAudio: z.boolean().optional()
});

export async function POST(req: NextRequest) {
  try {
    // Validate request
    const validation = await validateRequest(req, querySchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { text, context, sessionId, userId, voiceMetadata, generateAudio = false } = validation.data;

    // Get Oracle service
    const oracleService = getOracleService();

    logger.info('🔮 Processing Oracle query with real data context:', { data: { text, sessionId } });
    const startTime = Date.now();

    // Enhance context with real player data from our 1.57M game stats database
    let enhancedContext = { ...context };
    const sport = context?.sport || 'NFL';

    try {
      // Get contextual player data for better Oracle responses
      const { data: topPlayers } = await playerDataService.getTopPerformers({
        sport,
        limit: 5,
        min_games: 3
      });

      const { data: trendingPlayers } = await playerDataService.getPlayers({
        sport,
        include_stats: true,
        include_recent_games: true,
        limit: 10
      });

      // Add real data context for the Oracle
      if (topPlayers && topPlayers.length > 0) {
        enhancedContext.topPerformers = topPlayers.slice(0, 3).map(p => ({
          name: p.name,
          position: p.position,
          team: p.team_abbreviation || p.team,
          avgPoints: p.season_stats?.avg_fantasy_points
        }));
      }

      if (trendingPlayers && trendingPlayers.length > 0) {
        // Calculate trending players for Oracle context
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
              avgPoints: seasonAvg
            };
          })
          .sort((a, b) => b.trend - a.trend)
          .slice(0, 3);

        enhancedContext.trendingPlayers = trending;
      }

      // Add database metadata for Oracle awareness
      enhancedContext.dataSource = '1.57M game stats dataset';
      enhancedContext.realData = true;

    } catch (error) {
      logger.warn('Failed to enhance Oracle context with real data:', error);
    }

    // Process query with enhanced context
    const query: OracleQuery = {
      text,
      context: enhancedContext,
      sessionId,
      userId,
      voiceMetadata
    };

    // Get Oracle response
    const response = await oracleService.processQuery(query);

    // Generate audio if requested
    if (generateAudio && response.text) {
      try {
        const elevenLabsService = getElevenLabsService();
        
        // Select voice based on speaker
        const voiceId = response.speaker === 'oracle' 
          ? 'EXAVITQu4vr4xnMDMVNI' // Sarah - professional narrator
          : getAgentVoiceId(response.speaker);

        // Generate audio
        const audioBuffer = await elevenLabsService.synthesizeSpeech(response.text, {
          voiceId,
          stability: 0.75,
          similarityBoost: 0.75,
          style: 0.5,
          useSpeakerBoost: true
        });

        // Convert to base64
        response.audioUrl = `data:audio/mpeg;base64,${audioBuffer.toString('base64')}`;
      } catch (audioError) {
        logger.error('Audio generation error:', { error: audioError });
        // Continue without audio
      }
    }

    const processingTime = Date.now() - startTime;
    logger.info(`✅ Oracle response generated in ${processingTime}ms with real data context`);

    // Return response with metadata
    return NextResponse.json({
      success: true,
      response,
      metadata: {
        processingTime,
        sessionId: response.sessionId,
        speaker: response.speaker,
        confidence: response.confidence,
        dataSource: '1.57M game stats dataset',
        realData: true,
        contextEnhanced: !!(enhancedContext.topPerformers || enhancedContext.trendingPlayers)
      }
    });

  } catch (error) {
    logger.error('Oracle query error:', { error: error });
    return NextResponse.json(
      { 
        error: 'Failed to process Oracle query',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

// GET endpoint for query suggestions
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    const sport = searchParams.get('sport');

    // Get contextual suggestions
    const suggestions = getQuerySuggestions(sport, sessionId);

    return NextResponse.json({
      success: true,
      suggestions
    });

  } catch (error) {
    logger.error('Suggestions error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to get suggestions' },
      { status: 500 }
    );
  }
}

/**
 * Get agent voice ID mapping
 */
function getAgentVoiceId(agentId: string): string {
  const voiceMap: { [key: string]: string } = {
    'data-scientist': 'pNInz6obpgDQGcFmaJgB', // Adam
    'vegas-sharp': 'TxGEqnHWrfWFTfGW9XjX', // Josh
    'contrarian': 'jBpfuIE2acCO8z3wKbFd', // Elli
    'optimizer': 'yoZ06aMxZJJ28mfd3POQ', // Sam
    'floor-general': 'VR6AewLTigWG4xSOukaG', // Arnold
    'narrative-master': 'EXAVITQu4vr4xnMDMVNI', // Sarah
    'weather-hawk': 'onwK4e9ZLuTAKqWW03F9', // Daniel
    'chaos-agent': '2EiwWnXFnGHrJKaIPJOx', // Clyde
    'fantasy-oracle': 'EXAVITQu4vr4xnMDMVNI' // Sarah - professional
  };
  
  return voiceMap[agentId] || 'pNInz6obpgDQGcFmaJgB';
}

/**
 * Get contextual query suggestions
 */
function getQuerySuggestions(sport: string | null, sessionId: string | null): string[] {
  const baseSuggestions = [
    "Hey Fantasy",
    "Build me a GPP lineup",
    "Who should I start: Player A or Player B?",
    "Show me a chart of scoring trends",
    "What's your prophecy for tonight?",
    "I prefer conservative cash games",
    "Summon the Data Scientist"
  ];

  const sportSpecific: { [key: string]: string[] } = {
    NFL: [
      "Stack options for Patrick Mahomes",
      "Red zone targets analysis",
      "Weather impact for outdoor games"
    ],
    NBA: [
      "Back-to-back game concerns",
      "Pace matchup advantages",
      "Minutes rotation changes"
    ],
    MLB: [
      "Pitcher vs batter matchups",
      "Weather and wind factors",
      "Bullpen usage concerns"
    ],
    NHL: [
      "Power play opportunities",
      "Goalie matchup analysis",
      "Line combination changes"
    ]
  };

  if (sport && sportSpecific[sport]) {
    return [...baseSuggestions.slice(0, 4), ...sportSpecific[sport]];
  }

  return baseSuggestions;
}

/**
 * 🔮 ORACLE QUERY ENDPOINT FEATURES:
 * 
 * - Process text/voice queries to Fantasy Oracle
 * - Handle session management and context
 * - Generate audio responses with 11Labs
 * - Provide contextual query suggestions
 * - Support specialist handoffs
 * - Track user preferences
 * 
 * Wake word: "Hey Fantasy"
 * Default persona: Fantasy Oracle (concise, professional)
 */
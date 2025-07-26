/**
 * 🔮 ORACLE PROPHECY API - PREDICTIVE INSIGHTS
 * 
 * This endpoint handles Oracle prophecies - AI-generated
 * predictions about upcoming fantasy sports outcomes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOracleService } from '@/lib/services/ai/oracle-service';
import { playerDataService } from '../../../../lib/database/player-data-service';
import { pool } from '@/lib/services/database';
import { validateRequest } from '@/lib/utils/validation';
import { z } from 'zod';
import { logger } from '../../../../lib/logging/logger';

// Prophecy request schema
const prophecySchema = z.object({
  sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'PGA', 'UFC']),
  timeframe: z.enum(['tonight', 'this_week', 'season']),
  sessionId: z.string().optional(),
  type: z.enum(['general', 'player', 'contest', 'weather']).optional()
});

// Prophecy tracking schema
const trackProphecySchema = z.object({
  prophecyId: z.string(),
  fulfilled: z.boolean(),
  accuracy: z.number().min(0).max(1).optional(),
  notes: z.string().optional()
});

// POST - Generate new prophecy
export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequest(req, prophecySchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { sport, timeframe, sessionId, type = 'general' } = validation.data;
    const oracleService = getOracleService();

    logger.info('🔮 Generating prophecy with real data context', { timeframe, sport, type });

    // Get real player context from our 1.57M game stats database
    let playerContext = '';
    if (type === 'player' || type === 'general') {
      try {
        const { data: topPlayers } = await playerDataService.getTopPerformers({
          sport,
          limit: 10,
          min_games: 3
        });
        
        const { data: trendingPlayers } = await playerDataService.getPlayers({
          sport,
          include_stats: true,
          include_recent_games: true,
          limit: 15
        });

        if (topPlayers && topPlayers.length > 0) {
          const playerNames = topPlayers.slice(0, 5).map(p => p.name).join(', ');
          playerContext = `Top performers this season: ${playerNames}. `;
        }

        if (trendingPlayers && trendingPlayers.length > 0) {
          // Calculate trending players based on recent vs season performance
          const trending = trendingPlayers
            .filter(p => p.season_stats && p.recent_games && p.recent_games.length >= 3)
            .map(p => {
              const seasonAvg = p.season_stats!.avg_fantasy_points || 0;
              const recentAvg = p.recent_games!.slice(0, 3).reduce((sum, game) => sum + (game.fantasy_points || 0), 0) / 3;
              return {
                name: p.name,
                position: p.position,
                trend: recentAvg - seasonAvg
              };
            })
            .sort((a, b) => b.trend - a.trend)
            .slice(0, 3);

          if (trending.length > 0) {
            const trendingNames = trending.map(p => `${p.name} (${p.position})`).join(', ');
            playerContext += `Recent trending players: ${trendingNames}. `;
          }
        }
      } catch (error) {
        logger.warn('Failed to fetch player context for prophecy:', error);
      }
    }

    // Build enhanced prophecy query with real data context
    let query = `What's your prophecy for ${sport} ${timeframe}?`;
    let contextData = { sport, timeframe, playerContext };
    
    if (type === 'player') {
      query = `Based on current performance data: ${playerContext}Which ${sport} players will exceed expectations ${timeframe}? Consider recent trends and statistical analysis.`;
    } else if (type === 'contest') {
      query = `Given current player performance trends: ${playerContext}What contest strategy will win ${timeframe} in ${sport}? Factor in player consistency and upside.`;
    } else if (type === 'weather') {
      query = `How will weather impact ${sport} games ${timeframe}? Consider player performance in different conditions.`;
    } else if (type === 'general') {
      query = `Based on real performance data: ${playerContext}What's your prophecy for ${sport} ${timeframe}? Provide insights backed by current trends.`;
    }

    // Get prophecy from Oracle with enhanced context
    const response = await oracleService.processQuery({
      text: query,
      sessionId,
      context: contextData
    });

    // Store prophecy in database
    const prophecyId = `prophecy_${Date.now()}`;
    const insertQuery = `
      INSERT INTO oracle_prophecies (
        id, sport, timeframe, type, prediction, confidence, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *
    `;

    const result = await pool.query(insertQuery, [
      prophecyId,
      sport,
      timeframe,
      type,
      response.text,
      response.confidence,
      new Date()
    ]);

    const prophecy = result.rows[0];

    logger.info('🔮 Prophecy generated with real data', {
      prophecyId: prophecy.id,
      sport,
      type,
      timeframe,
      hasPlayerContext: !!playerContext,
      contextLength: playerContext.length,
      dataSource: '1.57M game stats dataset'
    });

    return NextResponse.json({
      success: true,
      prophecy: {
        id: prophecy.id,
        sport: prophecy.sport,
        timeframe: prophecy.timeframe,
        type: prophecy.type,
        prediction: prophecy.prediction,
        confidence: prophecy.confidence,
        createdAt: prophecy.created_at,
        sessionId: response.sessionId,
        playerContext: playerContext || null,
        dataSource: '1.57M game stats dataset',
        realData: true
      }
    });

  } catch (error) {
    logger.error('Prophecy generation error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to generate prophecy' },
      { status: 500 }
    );
  }
}

// GET - Retrieve prophecies
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sport = searchParams.get('sport');
    const timeframe = searchParams.get('timeframe');
    const limit = parseInt(searchParams.get('limit') || '10');
    const includeHistory = searchParams.get('includeHistory') === 'true';

    let query = `
      SELECT * FROM oracle_prophecies
      WHERE 1=1
    `;
    const params: any[] = [];
    let paramIndex = 1;

    if (sport) {
      query += ` AND sport = $${paramIndex++}`;
      params.push(sport);
    }

    if (timeframe) {
      query += ` AND timeframe = $${paramIndex++}`;
      params.push(timeframe);
    }

    if (!includeHistory) {
      query += ` AND fulfilled IS NULL`;
    }

    query += ` ORDER BY created_at DESC LIMIT $${paramIndex}`;
    params.push(limit);

    const result = await pool.query(query, params);

    // Calculate prophecy accuracy stats
    const accuracyStats = await getAccuracyStats(sport);

    return NextResponse.json({
      success: true,
      prophecies: result.rows.map(row => ({
        id: row.id,
        sport: row.sport,
        timeframe: row.timeframe,
        type: row.type,
        prediction: row.prediction,
        confidence: row.confidence,
        createdAt: row.created_at,
        fulfilled: row.fulfilled,
        accuracy: row.accuracy
      })),
      stats: accuracyStats,
      total: result.rows.length
    });

  } catch (error) {
    logger.error('Prophecy retrieval error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to retrieve prophecies' },
      { status: 500 }
    );
  }
}

// PATCH - Track prophecy outcome
export async function PATCH(req: NextRequest) {
  try {
    const validation = await validateRequest(req, trackProphecySchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { prophecyId, fulfilled, accuracy, notes } = validation.data;

    const updateQuery = `
      UPDATE oracle_prophecies
      SET fulfilled = $1, accuracy = $2, notes = $3, updated_at = $4
      WHERE id = $5
      RETURNING *
    `;

    const result = await pool.query(updateQuery, [
      fulfilled,
      accuracy,
      notes,
      new Date(),
      prophecyId
    ]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Prophecy not found' },
        { status: 404 }
      );
    }

    const prophecy = result.rows[0];

    return NextResponse.json({
      success: true,
      prophecy: {
        id: prophecy.id,
        fulfilled: prophecy.fulfilled,
        accuracy: prophecy.accuracy,
        notes: prophecy.notes,
        updatedAt: prophecy.updated_at
      }
    });

  } catch (error) {
    logger.error('Prophecy tracking error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to track prophecy' },
      { status: 500 }
    );
  }
}

/**
 * Calculate prophecy accuracy statistics
 */
async function getAccuracyStats(sport?: string): Promise<any> {
  try {
    let query = `
      SELECT 
        sport,
        COUNT(*) as total_prophecies,
        COUNT(CASE WHEN fulfilled = true THEN 1 END) as fulfilled_count,
        AVG(CASE WHEN accuracy IS NOT NULL THEN accuracy END) as avg_accuracy,
        COUNT(CASE WHEN accuracy > 0.7 THEN 1 END) as high_accuracy_count
      FROM oracle_prophecies
      WHERE accuracy IS NOT NULL
    `;

    if (sport) {
      query += ` AND sport = $1`;
    }

    query += ` GROUP BY sport`;

    const result = await pool.query(query, sport ? [sport] : []);

    const stats = result.rows.reduce((acc, row) => {
      acc[row.sport] = {
        totalProphecies: parseInt(row.total_prophecies),
        fulfilledCount: parseInt(row.fulfilled_count),
        avgAccuracy: parseFloat(row.avg_accuracy) || 0,
        highAccuracyCount: parseInt(row.high_accuracy_count),
        successRate: row.fulfilled_count / row.total_prophecies
      };
      return acc;
    }, {});

    return stats;
  } catch (error) {
    logger.error('Accuracy stats error:', { error: error });
    return {};
  }
}

/**
 * 🔮 ORACLE PROPHECY FEATURES:
 * 
 * - Generate AI prophecies for different timeframes
 * - Track prophecy fulfillment and accuracy
 * - Retrieve prophecy history and statistics
 * - Support different prophecy types
 * - Calculate Oracle accuracy metrics
 * 
 * The Oracle's wisdom improves over time!
 */
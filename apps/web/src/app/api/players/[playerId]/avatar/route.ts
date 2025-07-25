import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { logger } from '../../../../../lib/logging/logger';

// 🔥 ENTERPRISE DATABASE CONNECTION - 85K+ PLAYERS READY
const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME || 'fantasy_ai',
  user: process.env.DB_USER || 'fantasy_user',
  password: process.env.DB_PASSWORD || 'fantasy_password',
  max: 20,
});

export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const { playerId } = params;

    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      );
    }

    // 💀 QUERY OUR BEAST DATABASE WITH AVATAR TIERS
    const query = `
      SELECT 
        id,
        firstname,
        lastname,
        position,
        sport_id,
        team_abbreviation,
        jersey_number,
        overall_rating,
        avatar_tier,
        avatar_3d_url,
        avatar_2d_url,
        avatar_photo_url,
        avatar_metadata
      FROM players 
      WHERE id = $1
    `;

    const result = await pool.query(query, [playerId]);

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    const player = result.rows[0];

    // 🎯 RETURN PERFECTLY FORMATTED DATA FOR MOBILE APP
    const avatarData = {
      id: player.id,
      firstname: player.firstname || '',
      lastname: player.lastname || '',
      position: player.position || '',
      sport_id: player.sport_id || '',
      team_abbreviation: player.team_abbreviation || '',
      jersey_number: player.jersey_number || '',
      overall_rating: player.overall_rating || 60,
      avatar_tier: player.avatar_tier || 'bench',
      avatar_3d_url: player.avatar_3d_url,
      avatar_2d_url: player.avatar_2d_url,
      avatar_photo_url: player.avatar_photo_url,
      avatar_metadata: player.avatar_metadata || {},
    };

    // 🏆 LOG STAR PLAYER REQUESTS (FOR ANALYTICS)
    if (player.avatar_tier === 'star') {
      logger.info('⭐ Star player avatar requested: ${player.firstname} ${player.lastname} (${player.sport_id})');
    }

    return NextResponse.json(avatarData);

  } catch (error) {
    logger.error('Avatar API Error:', { error: error });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// 🔥 BATCH ENDPOINT FOR LOADING MULTIPLE PLAYERS (PERFORMANCE BEAST)
export async function POST(request: NextRequest) {
  try {
    const { playerIds } = await request.json();

    if (!Array.isArray(playerIds) || playerIds.length === 0) {
      return NextResponse.json(
        { error: 'Player IDs array is required' },
        { status: 400 }
      );
    }

    // 💪 LIMIT BATCH SIZE FOR PERFORMANCE
    if (playerIds.length > 50) {
      return NextResponse.json(
        { error: 'Maximum 50 players per batch request' },
        { status: 400 }
      );
    }

    // 🚀 BATCH QUERY WITH IN CLAUSE FOR MAXIMUM SPEED
    const placeholders = playerIds.map((_, index) => `$${index + 1}`).join(',');
    const query = `
      SELECT 
        id,
        firstname,
        lastname,
        position,
        sport_id,
        team_abbreviation,
        jersey_number,
        overall_rating,
        avatar_tier,
        avatar_3d_url,
        avatar_2d_url,
        avatar_photo_url,
        avatar_metadata
      FROM players 
      WHERE id IN (${placeholders})
      ORDER BY 
        CASE avatar_tier
          WHEN 'star' THEN 1
          WHEN 'starter' THEN 2
          WHEN 'bench' THEN 3
        END,
        overall_rating DESC
    `;

    const result = await pool.query(query, playerIds);

    // 🎯 FORMAT DATA FOR MOBILE CONSUMPTION
    const avatarData = result.rows.map(player => ({
      id: player.id,
      firstname: player.firstname || '',
      lastname: player.lastname || '',
      position: player.position || '',
      sport_id: player.sport_id || '',
      team_abbreviation: player.team_abbreviation || '',
      jersey_number: player.jersey_number || '',
      overall_rating: player.overall_rating || 60,
      avatar_tier: player.avatar_tier || 'bench',
      avatar_3d_url: player.avatar_3d_url,
      avatar_2d_url: player.avatar_2d_url,
      avatar_photo_url: player.avatar_photo_url,
      avatar_metadata: player.avatar_metadata || {},
    }));

    // 📊 ANALYTICS LOGGING
    const tierCounts = avatarData.reduce((acc, player) => {
      acc[player.avatar_tier] = (acc[player.avatar_tier] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    logger.info('🔥 Batch avatar request: ${avatarData.length} players (⭐${tierCounts.star || 0} 🏃${tierCounts.starter || 0} 🏃‍♂️${tierCounts.bench || 0})');

    return NextResponse.json({
      players: avatarData,
      count: avatarData.length,
      tier_breakdown: tierCounts
    });

  } catch (error) {
    logger.error('Batch Avatar API Error:', { error: error });
    
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '../../../../../../lib/prisma';
import { apiLogger } from '../../../../../../lib/utils/logger';
import { withAuth } from '../../../../../../lib/auth/authMiddleware';
import { withRedisRateLimit } from '../../../../../../lib/utils/redisRateLimiter';

export const GET = withAuth(async (request: NextRequest, user) => {
  return withRedisRateLimit(
    request,
    async () => {
      try {
    const { searchParams } = new URL(request.url);
    const playerId = searchParams.get('playerId');
    
    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      );
    }

    const player = await prisma.player.findUnique({
      where: { id: playerId },
      include: {
        team: true,
        stats: {
          orderBy: { created_at: 'desc' },
          take: 1,
        },
      },
    });

    if (!player) {
      return NextResponse.json(
        { error: 'Player not found' },
        { status: 404 }
      );
    }

    // Get live game data (mock for demo)
    const liveStats = {
      points: Math.random() * 20,
      projection: Math.random() * 25,
      trend: Math.random() > 0.5 ? 'up' : 'down' as const,
    };

    // Get current game stats
    const currentStats = player.stats[0];
    const gameStats: Record<string, number> = {};
    
    if (player.position === 'QB') {
      gameStats.passYards = currentStats?.passing_yards || 0;
      gameStats.passTDs = currentStats?.passing_touchdowns || 0;
      gameStats.completions = currentStats?.completions || 0;
    } else if (['RB', 'WR', 'TE'].includes(player.position)) {
      gameStats.recYards = currentStats?.receiving_yards || 0;
      gameStats.receptions = currentStats?.receptions || 0;
      gameStats.rushYards = currentStats?.rushing_yards || 0;
      gameStats.touchdowns = (currentStats?.rushing_touchdowns || 0) + 
                             (currentStats?.receiving_touchdowns || 0);
    }

    const arStats = {
      player: {
        id: player.id,
        name: player.name,
        position: player.position,
        team: player.team?.abbreviation || '',
        number: player.jersey_number || '',
      },
      liveStats,
      gameStats,
      fantasyImpact: {
        ownership: Math.random() * 100,
        startPercent: Math.random() * 100,
        projectedRank: Math.floor(Math.random() * 50) + 1,
      },
    };

    return NextResponse.json({
      success: true,
      stats: arStats
    });
      } catch (error) {
        apiLogger.error('Player stats error', error);
        return NextResponse.json(
          { error: 'Failed to get player stats' },
          { status: 500 }
        );
      }
    },
    { tier: user.tier } // Use user's tier for rate limiting
  );
});
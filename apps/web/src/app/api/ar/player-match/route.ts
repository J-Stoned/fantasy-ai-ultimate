import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../../../lib/auth/authMiddleware';
import { withRedisRateLimit } from '../../../../../../../lib/utils/redisRateLimiter';
import { prisma } from '../../../../../../lib/prisma';
import { apiLogger } from '../../../../../../lib/utils/logger';

export const POST = withAuth(async (request: NextRequest, user) {
  return withRedisRateLimit(
    request,
    async () => {
      try {
    const { jerseyNumber, teamColors } = await request.json();
    
    if (!jerseyNumber) {
      return NextResponse.json(
        { error: 'Jersey number is required' },
        { status: 400 }
      );
    }

    const player = await prisma.player.findFirst({
      where: {
        jersey_number: jerseyNumber,
      },
    });

    return NextResponse.json({
      success: true,
      player
    });
  } catch (error) {
    apiLogger.error('Player match error', error);
    return NextResponse.json(
      { error: 'Failed to match player' },
      { status: 500 }
    );
  }
    },
    { tier: user.tier }
  );
});
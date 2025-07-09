import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../lib/auth/authMiddleware';
import { withRedisRateLimit } from '../../../lib/utils/redisRateLimiter';
import { VoiceAssistant } from '../../lib/voice/VoiceAssistant';
import { apiLogger } from '../../lib/utils/logger';

const voiceAssistant = new VoiceAssistant();

export const POST = withAuth(async (request: NextRequest, user) {
  return withRedisRateLimit(
    request,
    async () => {
      try {
    const { command, userId, leagueId } = await request.json();
    
    if (!command || !userId || !leagueId) {
      return NextResponse.json(
        { error: 'command, userId, and leagueId are required' },
        { status: 400 }
      );
    }

    const result = await voiceAssistant.processLineupCommand(
      command,
      userId,
      leagueId
    );

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    apiLogger.error('Lineup command error', error);
    return NextResponse.json(
      { error: 'Failed to process lineup command' },
      { status: 500 }
    );
  }
    },
    { tier: user.tier }
  );
});
import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../../../lib/auth/authMiddleware';
import { withRedisRateLimit } from '../../../../../../../lib/utils/redisRateLimiter';
import { VoiceAssistant } from '../../../../../../lib/voice/VoiceAssistant';
import { apiLogger } from '../../../../../../lib/utils/logger';

const voiceAssistant = new VoiceAssistant();

export const GET = withAuth(async (request: NextRequest, user) {
  return withRedisRateLimit(
    request,
    async () => {
      try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    
    if (!userId) {
      return NextResponse.json(
        { error: 'userId is required' },
        { status: 400 }
      );
    }

    const briefing = await voiceAssistant.generateMorningBriefing(userId);

    return NextResponse.json({
      success: true,
      briefing
    });
  } catch (error) {
    apiLogger.error('Morning briefing error', error);
    return NextResponse.json(
      { error: 'Failed to generate morning briefing' },
      { status: 500 }
    );
  }
    },
    { tier: user.tier }
  );
});
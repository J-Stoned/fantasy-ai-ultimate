import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../../../lib/auth/authMiddleware';
import { withRedisRateLimit } from '../../../../../../../lib/utils/redisRateLimiter';
import { VoiceAssistant } from '../../../../../../lib/voice/VoiceAssistant';
import { apiLogger } from '../../../../../../lib/utils/logger';

const voiceAssistant = new VoiceAssistant();

export const POST = withAuth(async (request: NextRequest, user) {
  return withRedisRateLimit(
    request,
    async () => {
      try {
    const { transcript, audioBuffer, context } = await request.json();
    
    if (!transcript && !audioBuffer) {
      return NextResponse.json(
        { error: 'Either transcript or audioBuffer is required' },
        { status: 400 }
      );
    }

    const result = await voiceAssistant.processVoiceCommand(
      transcript || audioBuffer,
      context
    );

    return NextResponse.json({
      success: true,
      result
    });
  } catch (error) {
    apiLogger.error('Voice processing error', error);
    return NextResponse.json(
      { error: 'Failed to process voice command' },
      { status: 500 }
    );
  }
    },
    { tier: user.tier }
  );
});
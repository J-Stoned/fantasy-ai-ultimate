import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from '../../../../../../../lib/auth/authMiddleware';
import { withRedisRateLimit } from '../../../../../../../lib/utils/redisRateLimiter';
import { cronManager } from '../../../../../../lib/cron/CronManager';

export const GET = withAuth(async (request: NextRequest, user) => {
  return withRedisRateLimit(
    request,
    async () => {
      try {
        const jobs = cronManager.getAllJobStatuses();
        
        return NextResponse.json({
          jobs,
          serverTime: new Date().toISOString(),
        });
      } catch (error) {
        return NextResponse.json(
          { error: 'Failed to get cron status' },
          { status: 500 }
        );
      }
    },
    { tier: user.tier }
  );
});
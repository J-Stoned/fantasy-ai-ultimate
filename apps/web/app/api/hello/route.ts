import { NextRequest } from 'next/server';
import { withAuth } from '@/lib/security/auth-middleware';

export const GET = withAuth(
  async (req: NextRequest) => {
    return new Response('Hello, from API!', {
      status: 200,
      headers: { 'Content-Type': 'text/plain' }
    });
  },
  {
    requireAuth: false, // Public endpoint
    rateLimit: { max: 50, windowMs: 60000 } // 50 requests per minute
  }
);

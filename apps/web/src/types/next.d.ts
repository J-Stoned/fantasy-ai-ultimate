/**
 * TypeScript type declarations for Next.js extensions
 */

import { NextRequest } from 'next/server';

declare module 'next/server' {
  interface NextRequest {
    // Rate limit headers stored by middleware
    rateLimitHeaders?: Headers;
  }
}

// Export to make this a module
export {};
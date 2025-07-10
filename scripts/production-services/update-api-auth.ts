#!/usr/bin/env tsx
/**
 * Script to add authentication to all unprotected API routes
 */

import fs from 'fs/promises';
import path from 'path';

const UNPROTECTED_ROUTES = [
  'web/src/app/api/ar/player-match/route.ts',
  'web/src/app/api/voice/process/route.ts',
  'web/src/app/api/voice/lineup/route.ts',
  'web/src/app/api/voice/morning-briefing/route.ts',
  'web/src/app/api/mcp/servers/[serverId]/route.ts',
  'web/src/app/api/mcp/workflows/route.ts',
  'web/src/app/api/cron/status/route.ts',
  'web/src/app/api/import/sleeper/route.ts',
];

const AUTH_IMPORT = `import { withAuth } from '../../../../../../../lib/auth/authMiddleware';
import { withRedisRateLimit } from '../../../../../../../lib/utils/redisRateLimiter';`;

const DYNAMIC_AUTH_IMPORT = `import { withAuth } from '../../../../../../../../lib/auth/authMiddleware';
import { withRedisRateLimit } from '../../../../../../../../lib/utils/redisRateLimiter';`;

async function updateRoute(filePath: string) {
  try {
    const fullPath = path.join(process.cwd(), filePath);
    let content = await fs.readFile(fullPath, 'utf-8');
    
    // Skip if already has auth
    if (content.includes('withAuth')) {
      console.log(`✓ ${filePath} already has auth`);
      return;
    }
    
    // Determine import path depth
    const isDynamic = filePath.includes('[serverId]');
    const authImportToUse = isDynamic ? DYNAMIC_AUTH_IMPORT : AUTH_IMPORT;
    
    // Add imports after NextResponse import
    content = content.replace(
      /import { NextResponse } from 'next\/server';/,
      `import { NextRequest, NextResponse } from 'next/server';\n${authImportToUse}`
    );
    
    // Wrap GET handlers
    content = content.replace(
      /export async function GET\(request: Request\)/g,
      'export const GET = withAuth(async (request: NextRequest, user)'
    );
    
    // Wrap POST handlers
    content = content.replace(
      /export async function POST\(request: Request\)/g,
      'export const POST = withAuth(async (request: NextRequest, user)'
    );
    
    // Add rate limiting wrapper
    content = content.replace(
      /(\s+)(try {)/g,
      `$1return withRedisRateLimit(
    request,
    async () => {
      try {`
    );
    
    // Close rate limiting wrapper
    content = content.replace(
      /(\s+})\s*}$/,
      `$1
    },
    { tier: user.tier }
  );
});`
    );
    
    await fs.writeFile(fullPath, content);
    console.log(`✅ Updated ${filePath}`);
  } catch (error) {
    console.error(`❌ Failed to update ${filePath}:`, error);
  }
}

async function main() {
  console.log('Adding authentication to unprotected API routes...\n');
  
  for (const route of UNPROTECTED_ROUTES) {
    await updateRoute(route);
  }
  
  console.log('\n✅ Authentication added to all routes!');
  console.log('\nNext steps:');
  console.log('1. Review the changes to ensure imports are correct');
  console.log('2. Test each endpoint with authentication');
  console.log('3. Update API documentation');
}

main().catch(console.error);
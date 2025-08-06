import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { logger } from '../../../../../lib/logging/logger';

const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID || '';
const YAHOO_CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/yahoo`
  : 'http://localhost:3000/api/auth/callback/yahoo';

export async function GET(req: NextRequest) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.redirect('/auth/sign-in?error=unauthorized');
    }

    // Get return URL from query params
    const { searchParams } = new URL(req.url);
    const returnUrl = searchParams.get('returnUrl') || '/dashboard';

    // Create proper state object with user context
    const stateData = {
      userId: user.id,
      returnUrl,
      timestamp: Date.now()
    };
    
    // Encode state as base64 JSON (matching callback expectations)
    const state = Buffer.from(JSON.stringify(stateData)).toString('base64');
    
    // Build Yahoo OAuth URL
    const yahooAuthUrl = new URL('https://api.login.yahoo.com/oauth2/request_auth');
    yahooAuthUrl.searchParams.set('client_id', YAHOO_CLIENT_ID);
    yahooAuthUrl.searchParams.set('redirect_uri', REDIRECT_URI);
    yahooAuthUrl.searchParams.set('response_type', 'code');
    yahooAuthUrl.searchParams.set('scope', 'openid fspt-r'); // fspt-r for fantasy sports read access
    yahooAuthUrl.searchParams.set('state', state);
    
    logger.info('Yahoo OAuth initiated', { userId: user.id, returnUrl });
    
    return NextResponse.redirect(yahooAuthUrl.toString());
  } catch (error) {
    logger.error('Yahoo OAuth error:', { error: error });
    return NextResponse.redirect('/dashboard?error=yahoo_auth_failed');
  }
}

// Remove the POST method as it's not needed for OAuth flow
export async function POST(req: NextRequest) {
  return NextResponse.json(
    { error: 'POST method not supported for OAuth flow' },
    { status: 405 }
  );
}
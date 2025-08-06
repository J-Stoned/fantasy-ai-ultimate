import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { logger } from '../../../../../lib/logging/logger';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  
  // Handle OAuth errors from Yahoo
  if (error) {
    logger.error('Yahoo OAuth error from provider', { error });
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/import-league?error=yahoo_auth_denied&details=${encodeURIComponent(error)}`)
  }
  
  // Validate required parameters
  if (!code || !state) {
    logger.error('Yahoo OAuth callback missing parameters', { hasCode: !!code, hasState: !!state });
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/import-league?error=invalid_callback`)
  }

  try {
    // Decode and validate state
    let stateData;
    try {
      stateData = JSON.parse(Buffer.from(state, 'base64').toString());
    } catch (parseError) {
      logger.error('Failed to parse OAuth state', { state, error: parseError });
      throw new Error('Invalid state parameter');
    }
    
    const { userId, returnUrl, timestamp } = stateData;
    
    // Verify the request is recent (within 10 minutes)
    if (!timestamp || Date.now() - timestamp > 10 * 60 * 1000) {
      logger.warn('OAuth request expired', { timestamp, currentTime: Date.now() });
      throw new Error('Request expired')
    }

    // Initialize Supabase client and verify user
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || user.id !== userId) {
      logger.error('User mismatch in OAuth callback', { 
        expectedUserId: userId, 
        actualUserId: user?.id 
      });
      throw new Error('User mismatch')
    }

    // Exchange authorization code for tokens
    const clientId = process.env.YAHOO_CLIENT_ID
    const clientSecret = process.env.YAHOO_CLIENT_SECRET
    const redirectUri = process.env.YAHOO_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/yahoo`

    if (!clientId || !clientSecret) {
      logger.error('Yahoo OAuth credentials not configured');
      throw new Error('Yahoo OAuth credentials not configured')
    }

    logger.info('Exchanging Yahoo OAuth code for tokens', { userId: user.id });

    const tokenResponse = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Accept': 'application/json'
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      })
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('Yahoo token exchange failed', { 
        status: tokenResponse.status, 
        statusText: tokenResponse.statusText,
        error: errorText 
      });
      throw new Error('Failed to exchange OAuth code')
    }

    const tokens = await tokenResponse.json();
    logger.info('Successfully received Yahoo tokens', { userId: user.id, hasRefreshToken: !!tokens.refresh_token });

    // Store the connection in the database with proper error handling
    const expiresAt = tokens.expires_in 
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : new Date(Date.now() + 3600 * 1000).toISOString(); // Default 1 hour

    const { error: dbError } = await supabase.from('platform_connections').upsert({
      user_id: user.id,
      platform: 'yahoo',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expires_at: expiresAt, // Fixed: use token_expires_at instead of expires_at
      is_active: true,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });

    if (dbError) {
      logger.error('Failed to store Yahoo connection', { userId: user.id, error: dbError });
      throw new Error('Failed to store connection');
    }

    logger.info('Yahoo OAuth completed successfully', { userId: user.id, returnUrl });

    // Construct success redirect URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const redirectUrl = new URL(returnUrl.startsWith('/') ? `${baseUrl}${returnUrl}` : returnUrl);
    redirectUrl.searchParams.set('platform', 'yahoo');
    redirectUrl.searchParams.set('connected', 'true');
    redirectUrl.searchParams.set('timestamp', Date.now().toString());

    return NextResponse.redirect(redirectUrl.toString());
    
  } catch (error: any) {
    logger.error('Yahoo OAuth callback error:', { 
      error: error.message, 
      stack: error.stack,
      code,
      hasState: !!state 
    });
    
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const errorUrl = new URL('/import-league', baseUrl);
    errorUrl.searchParams.set('error', 'yahoo_connection_failed');
    errorUrl.searchParams.set('details', error.message);
    
    return NextResponse.redirect(errorUrl.toString());
  }
}
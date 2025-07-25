import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../../lib/logging/logger';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || '';
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/google`
  : 'http://localhost:3000/api/auth/callback/google';

export async function GET(req: NextRequest) {
  try {
    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    
    // Store state in cookie for validation
    const response = NextResponse.redirect(
      `https://accounts.google.com/o/oauth2/v2/auth?` +
      `client_id=${GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=openid email profile` +
      `&state=${state}`
    );
    
    response.cookies.set('google_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
    });
    
    return response;
  } catch (error) {
    logger.error('Google OAuth error:', { error: error });
    return NextResponse.redirect('/dashboard?error=google_auth_failed');
  }
}

export async function POST(req: NextRequest) {
  try {
    const { code } = await req.json();
    
    if (!code) {
      return NextResponse.json(
        { error: 'Authorization code required' },
        { status: 400 }
      );
    }
    
    // Exchange code for token
    const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: GOOGLE_CLIENT_ID,
        client_secret: GOOGLE_CLIENT_SECRET,
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      logger.error('Google token exchange failed:', { error: error });
      return NextResponse.json(
        { error: 'Failed to exchange token' },
        { status: 500 }
      );
    }
    
    const tokens = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: {
        'Authorization': `Bearer ${tokens.access_token}`,
      },
    });
    
    if (!userResponse.ok) {
      return NextResponse.json(
        { error: 'Failed to get user info' },
        { status: 500 }
      );
    }
    
    const userInfo = await userResponse.json();
    
    return NextResponse.json({
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token,
      expiresIn: tokens.expires_in,
      username: userInfo.name || userInfo.email,
      userId: userInfo.id,
      email: userInfo.email,
      picture: userInfo.picture,
    });
  } catch (error) {
    logger.error('Google token exchange error:', { error: error });
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
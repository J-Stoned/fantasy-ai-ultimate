import { NextRequest, NextResponse } from 'next/server';

const YAHOO_CLIENT_ID = process.env.YAHOO_CLIENT_ID || '';
const YAHOO_CLIENT_SECRET = process.env.YAHOO_CLIENT_SECRET || '';
const REDIRECT_URI = process.env.NEXT_PUBLIC_APP_URL 
  ? `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/callback/yahoo`
  : 'http://localhost:3000/api/auth/callback/yahoo';

export async function GET(req: NextRequest) {
  try {
    // Generate state for CSRF protection
    const state = Math.random().toString(36).substring(7);
    
    // Store state in cookie for validation
    const response = NextResponse.redirect(
      `https://api.login.yahoo.com/oauth2/request_auth?` +
      `client_id=${YAHOO_CLIENT_ID}` +
      `&redirect_uri=${encodeURIComponent(REDIRECT_URI)}` +
      `&response_type=code` +
      `&scope=openid fspt-r` + // fspt-r for fantasy sports read access
      `&state=${state}`
    );
    
    response.cookies.set('yahoo_oauth_state', state, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 10, // 10 minutes
    });
    
    return response;
  } catch (error) {
    console.error('Yahoo OAuth error:', error);
    return NextResponse.redirect('/dashboard?error=yahoo_auth_failed');
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
    const tokenResponse = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${YAHOO_CLIENT_ID}:${YAHOO_CLIENT_SECRET}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: REDIRECT_URI,
      }),
    });
    
    if (!tokenResponse.ok) {
      const error = await tokenResponse.text();
      console.error('Yahoo token exchange failed:', error);
      return NextResponse.json(
        { error: 'Failed to exchange token' },
        { status: 500 }
      );
    }
    
    const tokens = await tokenResponse.json();
    
    // Get user info
    const userResponse = await fetch('https://api.login.yahoo.com/openid/v1/userinfo', {
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
      username: userInfo.nickname || userInfo.email,
      userId: userInfo.sub,
    });
  } catch (error) {
    console.error('Yahoo token exchange error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
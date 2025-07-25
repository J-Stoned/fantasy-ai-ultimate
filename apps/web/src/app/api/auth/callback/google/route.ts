import { NextRequest, NextResponse } from 'next/server';
import { logger } from '../../../../../lib/logging/logger';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');
    
    // Check for OAuth errors
    if (error) {
      logger.error('Google OAuth error:', { error: error });
      return NextResponse.redirect('/dashboard?error=google_oauth_cancelled');
    }
    
    if (!code || !state) {
      return NextResponse.redirect('/dashboard?error=google_oauth_invalid');
    }
    
    // Validate state
    const storedState = req.cookies.get('google_oauth_state')?.value;
    if (state !== storedState) {
      return NextResponse.redirect('/dashboard?error=google_oauth_invalid_state');
    }
    
    // Redirect to dashboard with success
    const response = NextResponse.redirect(
      `/leagues?platform=google&code=${code}&token=${code}`
    );
    
    // Clear state cookie
    response.cookies.delete('google_oauth_state');
    
    return response;
  } catch (error) {
    logger.error('Google OAuth callback error:', { error: error });
    return NextResponse.redirect('/dashboard?error=google_oauth_failed');
  }
}
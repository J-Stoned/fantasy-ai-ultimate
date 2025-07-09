import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

// Initiate Yahoo OAuth flow
export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const clientId = process.env.YAHOO_CLIENT_ID
  const redirectUri = process.env.YAHOO_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/yahoo`
  
  if (!clientId) {
    return NextResponse.json({ error: 'Yahoo OAuth not configured' }, { status: 500 })
  }

  // Generate state parameter for security
  const state = Buffer.from(JSON.stringify({
    userId: user.id,
    timestamp: Date.now(),
    returnUrl: request.nextUrl.searchParams.get('returnUrl') || '/import-league'
  })).toString('base64')

  // Build Yahoo OAuth URL
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'fspt-w', // Fantasy Sports Read/Write
    state,
  })

  const authUrl = `https://api.login.yahoo.com/oauth2/request_auth?${params.toString()}`
  
  return NextResponse.redirect(authUrl)
}
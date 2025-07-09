import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  const error = searchParams.get('error')
  
  if (error) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/import-league?error=yahoo_auth_failed`)
  }
  
  if (!code || !state) {
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/import-league?error=invalid_callback`)
  }

  try {
    // Decode and validate state
    const stateData = JSON.parse(Buffer.from(state, 'base64').toString())
    const { userId, returnUrl } = stateData
    
    // Verify the request is recent (within 10 minutes)
    if (Date.now() - stateData.timestamp > 10 * 60 * 1000) {
      throw new Error('Request expired')
    }

    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user || user.id !== userId) {
      throw new Error('User mismatch')
    }

    // Exchange code for tokens
    const clientId = process.env.YAHOO_CLIENT_ID
    const clientSecret = process.env.YAHOO_CLIENT_SECRET
    const redirectUri = process.env.YAHOO_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/auth/callback/yahoo`

    if (!clientId || !clientSecret) {
      throw new Error('Yahoo OAuth credentials not configured')
    }

    const tokenResponse = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      })
    })

    if (!tokenResponse.ok) {
      throw new Error('Failed to exchange OAuth code')
    }

    const tokens = await tokenResponse.json()

    // Store the connection in the database
    await supabase.from('platform_connections').upsert({
      user_id: user.id,
      platform: 'yahoo',
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: new Date(Date.now() + tokens.expires_in * 1000).toISOString(),
      is_active: true,
      updated_at: new Date().toISOString()
    })

    // Redirect to import flow with success
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}${returnUrl}?platform=yahoo&connected=true`)
    
  } catch (error) {
    console.error('Yahoo OAuth callback error:', error)
    return NextResponse.redirect(`${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/import-league?error=yahoo_connection_failed`)
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const { userId, platform } = await request.json()
    
    if (!userId || !platform) {
      return NextResponse.json(
        { hasAuth: false, error: 'Missing required parameters' },
        { status: 400 }
      )
    }

    const supabase = createRouteHandlerClient({ cookies })
    
    // Check if user has valid auth for the platform
    const { data, error } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('user_id', userId)
      .eq('platform', platform)
      .single()

    if (error || !data) {
      return NextResponse.json({ hasAuth: false })
    }

    // Check if tokens are still valid
    if (platform === 'yahoo' && data.expires_at) {
      const expiresAt = new Date(data.expires_at)
      const now = new Date()
      
      if (expiresAt <= now) {
        // Token expired
        return NextResponse.json({ hasAuth: false, needsRefresh: true })
      }
    }

    // For platforms like ESPN that use cookies, check if we have them
    if (platform === 'espn') {
      const hasCredentials = data.credentials && 
                           data.credentials.espn_s2 && 
                           data.credentials.swid
      return NextResponse.json({ hasAuth: hasCredentials })
    }

    // For other platforms
    return NextResponse.json({ hasAuth: true })
    
  } catch (error: any) {
    console.error('Auth check error:', error)
    return NextResponse.json(
      { hasAuth: false, error: error.message },
      { status: 500 }
    )
  }
}
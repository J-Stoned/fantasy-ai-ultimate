import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Yahoo connection details
    const { data: connection, error } = await supabase
      .from('platform_connections')
      .select('platform, isActive, lastSyncAt, tokenExpiresAt, createdAt')
      .eq('userId', user.id)
      .eq('platform', 'yahoo')
      .single()

    if (error || !connection) {
      return NextResponse.json({ 
        connected: false,
        connection: null 
      })
    }

    // Check if token is expired
    const tokenExpired = connection.tokenExpiresAt && 
      new Date(connection.tokenExpiresAt) < new Date()

    return NextResponse.json({
      connected: true,
      connection: {
        ...connection,
        isActive: connection.isActive && !tokenExpired,
        tokenExpired
      }
    })

  } catch (error: any) {
    console.error('Check Yahoo connection error:', error)
    return NextResponse.json(
      { error: 'Failed to check connection', message: error.message },
      { status: 500 }
    )
  }
}
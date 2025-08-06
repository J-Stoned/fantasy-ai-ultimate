import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../../lib/supabase/server'
import { logger } from '../../../../lib/logging/logger';

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
      .select('platform, is_active, last_sync_at, token_expires_at, created_at') // Fixed: use token_expires_at
      .eq('user_id', user.id)
      .eq('platform', 'yahoo')
      .single()

    if (error || !connection) {
      return NextResponse.json({ 
        connected: false,
        connection: null 
      })
    }

    // Check if token is expired
    const tokenExpired = connection.token_expires_at && // Fixed: use token_expires_at
      new Date(connection.token_expires_at) < new Date()

    return NextResponse.json({
      connected: true,
      connection: {
        ...connection,
        is_active: connection.is_active && !tokenExpired,
        tokenExpired
      }
    })

  } catch (error: any) {
    logger.error('Check Yahoo connection error:', { error: error })
    return NextResponse.json(
      { error: 'Failed to check connection', message: error.message },
      { status: 500 }
    )
  }
}
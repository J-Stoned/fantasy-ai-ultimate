/**
 * Yahoo Fantasy Sports import endpoint
 * Allows users to import their Yahoo fantasy leagues
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { UniversalLeagueImporter } from '../../lib/services/league-import/universal-importer'
import { PlatformType } from '@prisma/client'
import { z } from 'zod'
import { withRateLimit } from '../../lib/utils/rateLimiter'
import { createApiLogger } from '../../lib/utils/logger'

// Input validation schema
const YahooImportSchema = z.object({
  code: z.string().optional(), // OAuth code
  accessToken: z.string().optional(), // Direct token if available
  refreshToken: z.string().optional(),
})

async function handleYahooImport(request: NextRequest) {
  const logger = createApiLogger('yahoo-import')
  
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate input
    let body
    try {
      body = await request.json()
    } catch {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
    }

    // Validate input
    const validationResult = YahooImportSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          details: validationResult.error.issues[0]?.message || 'Validation failed'
        }, 
        { status: 400 }
      )
    }

    const { code, accessToken, refreshToken } = validationResult.data

    // If we have an OAuth code, exchange it for tokens
    let tokens = { accessToken, refreshToken }
    if (code && !accessToken) {
      tokens = await exchangeYahooCode(code)
    }

    // If no tokens provided, check stored connection
    if (!tokens.accessToken) {
      const { data: connection } = await supabase
        .from('platform_connections')
        .select('access_token, refresh_token')
        .eq('user_id', user.id)
        .eq('platform', 'yahoo')
        .eq('is_active', true)
        .single()

      if (!connection || !connection.access_token) {
        return NextResponse.json({ 
          error: 'Yahoo authentication required. Please authorize through the import page.' 
        }, { status: 400 })
      }

      tokens.accessToken = connection.access_token
      tokens.refreshToken = connection.refresh_token
    }
    
    // Import leagues
    const importer = new UniversalLeagueImporter()
    const result = await importer.importLeague(
      user.id,
      PlatformType.yahoo,
      {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
      }
    )

    // Log successful import
    supabase.from('import_logs').insert({
      user_id: user.id,
      platform: PlatformType.yahoo,
      status: 'success',
      leagues_imported: result.leaguesImported,
      created_at: new Date().toISOString()
    }).then(() => {
      logger.info('Import logged successfully')
    }).catch(error => {
      logger.error('Failed to log import', error)
    })

    return NextResponse.json({
      success: true,
      leaguesImported: result.leaguesImported,
      message: `Successfully imported ${result.leaguesImported} Yahoo leagues`
    })
  } catch (error: any) {
    logger.error('Import error', error)
    
    if (error.message?.includes('rate limit')) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
    }
    
    if (error.message?.includes('unauthorized')) {
      return NextResponse.json({ error: 'Yahoo authorization failed. Please re-authenticate.' }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Import failed. Please try again.' }, 
      { status: 500 }
    )
  }
}

// Helper function to exchange OAuth code for tokens
async function exchangeYahooCode(code: string) {
  const clientId = process.env.YAHOO_CLIENT_ID
  const clientSecret = process.env.YAHOO_CLIENT_SECRET
  const redirectUri = process.env.YAHOO_REDIRECT_URI || 'http://localhost:3000/api/auth/callback/yahoo'

  if (!clientId || !clientSecret) {
    throw new Error('Yahoo OAuth credentials not configured')
  }

  const response = await fetch('https://api.login.yahoo.com/oauth2/get_token', {
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

  if (!response.ok) {
    throw new Error('Failed to exchange Yahoo OAuth code')
  }

  const data = await response.json()
  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
  }
}

// Export the POST handler with rate limiting
export const POST = withRateLimit(handleYahooImport, 'import')

// OAuth callback endpoint
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const code = searchParams.get('code')
  const state = searchParams.get('state')
  
  if (!code) {
    return NextResponse.json({ error: 'No authorization code provided' }, { status: 400 })
  }

  // In production, validate state parameter and redirect to app
  return NextResponse.json({
    message: 'Authorization successful. You can now import your Yahoo leagues.',
    code,
  })
}
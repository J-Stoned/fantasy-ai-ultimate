/**
 * ESPN Fantasy Sports import endpoint
 * Allows users to import their ESPN fantasy leagues
 */

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../../lib/supabase/server'
import { UniversalLeagueImporter } from '../../../../../../lib/services/league-import/universal-importer'
import { PlatformType } from '@prisma/client'
import { z } from 'zod'
import { withRateLimit } from '../../../../../../lib/utils/rateLimiter'
import { createApiLogger } from '../../../../../../lib/utils/logger'

// Input validation schema
const ESPNImportSchema = z.object({
  espnS2: z.string().min(1), // ESPN authentication cookie
  swid: z.string().min(1), // ESPN user ID cookie
  leagueId: z.string().optional(), // Specific league to import
})

async function handleESPNImport(request: NextRequest) {
  const logger = createApiLogger('espn-import')
  
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
    const validationResult = ESPNImportSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          details: validationResult.error.issues[0]?.message || 'Validation failed',
          help: 'Please provide your ESPN cookies: espn_s2 and SWID. You can find these in your browser developer tools while logged into ESPN.'
        }, 
        { status: 400 }
      )
    }

    const { espnS2, swid, leagueId } = validationResult.data
    
    // Test ESPN connection
    const testUrl = 'https://fantasy.espn.com/apis/v3/games/ffl/seasons/2024/segments/0/leagues'
    const testResponse = await fetch(testUrl, {
      headers: {
        'Cookie': `espn_s2=${espnS2}; SWID=${swid}`,
      }
    })

    if (testResponse.status === 401) {
      return NextResponse.json({ 
        error: 'ESPN authentication failed. Please check your cookies are valid and not expired.',
        help: 'To get fresh cookies: 1) Log into ESPN Fantasy, 2) Open Developer Tools (F12), 3) Go to Application/Storage > Cookies, 4) Copy espn_s2 and SWID values'
      }, { status: 401 })
    }
    
    // Import leagues
    const importer = new UniversalLeagueImporter()
    const result = await importer.importLeague(
      user.id,
      PlatformType.espn,
      {
        espnS2,
        swid,
        leagueId,
      }
    )

    // Log successful import
    supabase.from('import_logs').insert({
      user_id: user.id,
      platform: PlatformType.espn,
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
      message: `Successfully imported ${result.leaguesImported} ESPN leagues`
    })
  } catch (error: any) {
    logger.error('Import error', error)
    
    if (error.message?.includes('rate limit')) {
      return NextResponse.json({ error: 'ESPN rate limit exceeded. Please try again in a few minutes.' }, { status: 429 })
    }
    
    if (error.message?.includes('network')) {
      return NextResponse.json({ error: 'Failed to connect to ESPN. Please check your internet connection.' }, { status: 503 })
    }
    
    return NextResponse.json(
      { error: 'Import failed. Please try again.' }, 
      { status: 500 }
    )
  }
}

// Export the POST handler with rate limiting
export const POST = withRateLimit(handleESPNImport, 'import')

// Helper endpoint to validate ESPN cookies
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const espnS2 = searchParams.get('espn_s2')
  const swid = searchParams.get('swid')
  
  if (!espnS2 || !swid) {
    return NextResponse.json({ 
      valid: false,
      message: 'Missing ESPN authentication cookies',
      help: 'Please provide both espn_s2 and SWID cookies'
    })
  }

  try {
    // Test the cookies
    const response = await fetch('https://fantasy.espn.com/apis/v3/games/ffl/seasons/2024', {
      headers: {
        'Cookie': `espn_s2=${espnS2}; SWID=${swid}`,
      }
    })

    if (response.ok) {
      return NextResponse.json({ 
        valid: true,
        message: 'ESPN cookies are valid and working'
      })
    } else {
      return NextResponse.json({ 
        valid: false,
        message: 'ESPN cookies are invalid or expired',
        help: 'Please log into ESPN Fantasy and get fresh cookies'
      })
    }
  } catch (error) {
    return NextResponse.json({ 
      valid: false,
      message: 'Failed to validate ESPN cookies',
      error: error instanceof Error ? error.message : 'Unknown error'
    })
  }
}
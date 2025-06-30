import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../../lib/supabase/server'
import { UniversalLeagueImporter } from '../../../../../../lib/services/league-import/universal-importer'
import { PlatformType } from '@prisma/client'
import { z } from 'zod'
import { withRateLimit } from '../../../../../../lib/utils/rateLimiter'
import { validateAndSanitize, escapeHtml } from '../../../../../../lib/utils/security'
import { createApiLogger } from '../../../../../../lib/utils/logger'

// Input validation schema
const SleeperImportSchema = z.object({
  username: z.string().min(1).max(50).regex(/^[a-zA-Z0-9_]+$/, {
    message: 'Username must contain only letters, numbers, and underscores'
  })
})

async function handleSleeperImport(request: NextRequest) {
  const logger = createApiLogger('sleeper-import')
  
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
    const validationResult = SleeperImportSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          details: validationResult.error.issues[0]?.message || 'Validation failed'
        }, 
        { status: 400 }
      )
    }

    const { username } = validationResult.data
    
    // Get Sleeper user ID with timeout
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 10000) // 10 second timeout
    
    try {
      const sleeperResponse = await fetch(
        `https://api.sleeper.app/v1/user/${username}`,
        { signal: controller.signal }
      )
      clearTimeout(timeout)
      
      if (!sleeperResponse.ok) {
        if (sleeperResponse.status === 404) {
          return NextResponse.json({ error: 'Sleeper user not found' }, { status: 404 })
        }
        return NextResponse.json({ error: 'Failed to fetch Sleeper user' }, { status: 400 })
      }
      
      const sleeperUser = await sleeperResponse.json()
      
      if (!sleeperUser.user_id) {
        return NextResponse.json({ error: 'Invalid Sleeper user data' }, { status: 400 })
      }
      
      // Import leagues
      const importer = new UniversalLeagueImporter()
      const result = await importer.importLeague(
        user.id,
        PlatformType.sleeper,
        {
          platformUserId: sleeperUser.user_id,
          username: username,
        }
      )

      // Log successful import (non-blocking)
      supabase.from('import_logs').insert({
        user_id: user.id,
        platform: PlatformType.sleeper,
        username,
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
        message: `Successfully imported ${result.leaguesImported} leagues`
      })
    } catch (error: any) {
      clearTimeout(timeout)
      
      if (error.name === 'AbortError') {
        return NextResponse.json({ error: 'Request timeout' }, { status: 408 })
      }
      
      // Don't expose internal error details
      logger.error('Sleeper API error', error)
      return NextResponse.json({ error: 'Failed to connect to Sleeper' }, { status: 503 })
    }
  } catch (error: any) {
    // Log internal errors but don't expose details
    logger.error('Import error', error)
    
    // Check for known error types
    if (error.message?.includes('rate limit')) {
      return NextResponse.json({ error: 'Rate limit exceeded. Please try again later.' }, { status: 429 })
    }
    
    if (error.message?.includes('database')) {
      return NextResponse.json({ error: 'Database error. Please try again.' }, { status: 503 })
    }
    
    // Generic error response
    return NextResponse.json(
      { error: 'Import failed. Please try again.' }, 
      { status: 500 }
    )
  }
}

// Export the POST handler with rate limiting
export const POST = withRateLimit(handleSleeperImport, 'import')
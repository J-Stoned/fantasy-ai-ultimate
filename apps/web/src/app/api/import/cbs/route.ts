import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../../lib/supabase/server'
import { UniversalLeagueImporter } from '../../../../../../lib/services/league-import/universal-importer'
import { PlatformType } from '@prisma/client'
import { z } from 'zod'
import { createApiLogger } from '../../../../../../lib/utils/logger'

// Input validation schema
const CBSImportSchema = z.object({
  apiToken: z.string().min(1, 'CBS API token is required'),
})

export async function POST(request: NextRequest) {
  const logger = createApiLogger('cbs-import')
  
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
    const validationResult = CBSImportSchema.safeParse(body)
    if (!validationResult.success) {
      return NextResponse.json(
        { 
          error: 'Invalid input',
          details: validationResult.error.issues[0]?.message || 'Validation failed'
        }, 
        { status: 400 }
      )
    }

    const { apiToken } = validationResult.data

    // Store the connection
    await supabase.from('platform_connections').upsert({
      user_id: user.id,
      platform: 'cbs',
      api_token: apiToken,
      is_active: true,
      updated_at: new Date().toISOString()
    })
    
    // Import leagues
    const importer = new UniversalLeagueImporter()
    const result = await importer.importLeague(
      user.id,
      PlatformType.cbs,
      {
        apiToken,
      }
    )

    // Log successful import
    await supabase.from('import_logs').insert({
      user_id: user.id,
      platform: PlatformType.cbs,
      status: 'success',
      leagues_imported: result.leaguesImported,
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      leaguesImported: result.leaguesImported,
      message: `Successfully imported ${result.leaguesImported} CBS leagues`
    })
  } catch (error: any) {
    logger.error('Import error', error)
    
    if (error.message?.includes('API token')) {
      return NextResponse.json({ 
        error: 'Invalid CBS API token. Please check your token and try again.',
        helpUrl: 'https://www.cbssports.com/fantasy/account/api'
      }, { status: 401 })
    }
    
    return NextResponse.json(
      { error: 'Import failed. Please try again.' }, 
      { status: 500 }
    )
  }
}
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../lib/supabase/server'
import { YahooFantasyAPI } from '../../../lib/services/yahoo-fantasy-api'
import { z } from 'zod'

// Request validation schema
const UpdateLineupSchema = z.object({
  teamKey: z.string(),
  leagueId: z.string(),
  changes: z.array(z.object({
    playerId: z.string(),
    position: z.string()
  })),
  coverageType: z.enum(['week', 'date']),
  coverageValue: z.union([z.string(), z.number()])
})

export async function PUT(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Parse and validate request body
    const body = await request.json()
    const validatedData = UpdateLineupSchema.parse(body)

    // Get Yahoo connection details
    const { data: connection, error: connectionError } = await supabase
      .from('platform_connections')
      .select('accessToken, tokenExpiresAt, isActive')
      .eq('userId', user.id)
      .eq('platform', 'yahoo')
      .single()

    if (connectionError || !connection) {
      return NextResponse.json(
        { error: 'No Yahoo connection found. Please connect your Yahoo account first.' },
        { status: 404 }
      )
    }

    if (!connection.isActive) {
      return NextResponse.json(
        { error: 'Yahoo connection is inactive. Please reconnect your account.' },
        { status: 403 }
      )
    }

    // Check if token is expired
    if (connection.tokenExpiresAt && new Date(connection.tokenExpiresAt) < new Date()) {
      return NextResponse.json(
        { error: 'Yahoo token expired. Please reconnect your account.' },
        { status: 401 }
      )
    }

    // Initialize Yahoo API client
    const yahooAPI = new YahooFantasyAPI(connection.accessToken, user.id)

    // Get current roster to validate changes
    const currentRoster = await yahooAPI.getCurrentRoster(
      validatedData.teamKey,
      validatedData.coverageType === 'date' ? validatedData.coverageValue.toString() : undefined
    )

    if (!currentRoster.success) {
      return NextResponse.json(
        { error: 'Failed to fetch current roster', details: currentRoster.error },
        { status: 500 }
      )
    }

    // Validate lineup changes
    const validationErrors = validateLineupChanges(validatedData.changes, currentRoster.roster)
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Invalid lineup changes', validationErrors },
        { status: 400 }
      )
    }

    // Update lineup on Yahoo
    const result = await yahooAPI.updateLineup(
      validatedData.teamKey,
      validatedData.changes,
      validatedData.coverageType,
      validatedData.coverageValue
    )

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to update lineup', details: result.error },
        { status: 500 }
      )
    }

    // Log the lineup change
    await supabase.from('fantasy_lineup_changes').insert({
      user_id: user.id,
      platform: 'yahoo',
      league_id: validatedData.leagueId,
      team_key: validatedData.teamKey,
      changes: validatedData.changes,
      coverage_type: validatedData.coverageType,
      coverage_value: validatedData.coverageValue.toString(),
      status: 'completed',
      created_at: new Date().toISOString()
    })

    return NextResponse.json({
      success: true,
      message: 'Lineup updated successfully',
      data: result.data,
      changes: validatedData.changes.length
    })

  } catch (error: any) {
    console.error('Lineup update error:', error)
    
    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid request data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const teamKey = searchParams.get('teamKey')
    const date = searchParams.get('date')

    if (!teamKey) {
      return NextResponse.json(
        { error: 'Team key is required' },
        { status: 400 }
      )
    }

    // Get Yahoo connection
    const { data: connection } = await supabase
      .from('platform_connections')
      .select('accessToken')
      .eq('userId', user.id)
      .eq('platform', 'yahoo')
      .single()

    if (!connection) {
      return NextResponse.json(
        { error: 'No Yahoo connection found' },
        { status: 404 }
      )
    }

    // Get current roster
    const yahooAPI = new YahooFantasyAPI(connection.accessToken, user.id)
    const result = await yahooAPI.getCurrentRoster(teamKey, date)

    if (!result.success) {
      return NextResponse.json(
        { error: 'Failed to fetch roster', details: result.error },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      roster: result.roster
    })

  } catch (error: any) {
    console.error('Get roster error:', error)
    return NextResponse.json(
      { error: 'Internal server error', message: error.message },
      { status: 500 }
    )
  }
}

/**
 * Validate lineup changes
 */
function validateLineupChanges(changes: any[], currentRoster: any[]): string[] {
  const errors: string[] = []
  const playerKeys = new Set(currentRoster.map(p => p.player_key))
  
  // Check if all players exist in roster
  for (const change of changes) {
    if (!playerKeys.has(change.playerId)) {
      errors.push(`Player ${change.playerId} not found in roster`)
    }
  }

  // Check for duplicate position assignments
  const positionCounts = new Map<string, number>()
  for (const change of changes) {
    if (change.position !== 'BN') { // BN = Bench
      const count = positionCounts.get(change.position) || 0
      positionCounts.set(change.position, count + 1)
    }
  }

  // Add more position-specific validation here based on league rules
  // This would need to be fetched from league settings

  return errors
}
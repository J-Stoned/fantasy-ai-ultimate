import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '../../../../../../../lib/supabase/server'

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient()
    
    // Check authentication
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Get Yahoo connection
    const { data: connection } = await supabase
      .from('platform_connections')
      .select('*')
      .eq('userId', user.id)
      .eq('platform', 'yahoo')
      .single()

    if (!connection || !connection.isActive) {
      return NextResponse.json({ 
        error: 'No active Yahoo connection found',
        leagues: [] 
      }, { status: 404 })
    }

    // Get user's Yahoo leagues from database
    const { data: leagues, error } = await supabase
      .from('fantasy_leagues')
      .select(`
        *,
        fantasy_teams!fantasy_teams_leagueId_fkey (
          id,
          teamName,
          platformTeamId
        )
      `)
      .eq('userId', user.id)
      .eq('platform', 'yahoo')
      .eq('isActive', true)

    if (error) {
      throw error
    }

    // Format response
    const formattedLeagues = leagues?.map(league => ({
      id: league.id,
      platformLeagueId: league.platformLeagueId,
      name: league.name,
      season: league.season,
      teams: league.fantasy_teams || [],
      sport: extractSportFromSettings(league.leagueSettings),
      settings: league.leagueSettings
    })) || []

    return NextResponse.json({
      success: true,
      leagues: formattedLeagues,
      connection: {
        isActive: connection.isActive,
        lastSyncAt: connection.lastSyncAt
      }
    })

  } catch (error: any) {
    console.error('Get Yahoo leagues error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch leagues', message: error.message },
      { status: 500 }
    )
  }
}

function extractSportFromSettings(settings: any): string {
  if (!settings) return 'football'
  
  // Try to determine sport from game_code or other settings
  const gameCode = settings.game_code || settings.sport || ''
  
  const sportMap: Record<string, string> = {
    nfl: 'football',
    nba: 'basketball',
    mlb: 'baseball',
    nhl: 'hockey'
  }
  
  return sportMap[gameCode.toLowerCase()] || 'football'
}
import { NextRequest, NextResponse } from 'next/server'
import { spatialFantasyService } from '@/lib/spatial-analytics/spatial-fantasy-service'

export async function POST(request: NextRequest) {
  try {
    const { player_id, opponent_id, game_id, include_synergies } = await request.json()

    if (!player_id) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      )
    }

    const projection = await spatialFantasyService.getEnhancedPlayerProjection(
      player_id,
      {
        opponent_id,
        game_id,
        include_synergies: include_synergies ?? true
      }
    )

    return NextResponse.json({
      success: true,
      projection
    })
  } catch (error: any) {
    console.error('Spatial projection error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to generate spatial projection' 
      },
      { status: 500 }
    )
  }
}

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams
  const playerId = searchParams.get('player_id')

  if (!playerId) {
    return NextResponse.json(
      { error: 'Player ID is required' },
      { status: 400 }
    )
  }

  try {
    const projection = await spatialFantasyService.getEnhancedPlayerProjection(playerId)
    
    return NextResponse.json({
      success: true,
      projection
    })
  } catch (error: any) {
    console.error('Spatial projection error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to generate spatial projection' 
      },
      { status: 500 }
    )
  }
}
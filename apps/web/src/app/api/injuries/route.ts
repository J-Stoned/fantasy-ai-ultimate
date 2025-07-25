/**
 * 🏥 Injury Data API
 * Real-time injury status and updates for DFS optimization
 */

import { NextRequest, NextResponse } from 'next/server'
import { services } from '@/lib/services/init'
import { logger } from '../../../lib/logging/logger';

// GET endpoint - retrieve injury data
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')
    const sport = searchParams.get('sport')
    const team = searchParams.get('team')
    const playerId = searchParams.get('player_id')
    
    // Initialize services if needed
    await services.initialize()
    const { injuryService } = services.getServices()
    
    switch (action) {
      case 'player':
        // Get specific player injury status
        if (!playerId) {
          return NextResponse.json(
            { error: 'player_id required' },
            { status: 400 }
          )
        }
        
        const playerInjury = injuryService.getPlayerInjuryStatus(playerId)
        return NextResponse.json({
          player_id: playerId,
          injury: playerInjury,
          should_exclude: injuryService.shouldExcludePlayer(playerId)
        })
        
      case 'team':
        // Get injuries for a specific team
        if (!team) {
          return NextResponse.json(
            { error: 'team parameter required' },
            { status: 400 }
          )
        }
        
        const teamInjuries = injuryService.getInjuredPlayersByTeam(team)
        return NextResponse.json({
          team,
          injured_players: teamInjuries,
          total: teamInjuries.length
        })
        
      case 'risky':
        // Get players with GTD/Questionable status
        const riskyPlayers = injuryService.getRiskyPlayers()
        return NextResponse.json({
          risky_players: riskyPlayers,
          total: riskyPlayers.length,
          warning: 'These players have uncertain status for upcoming games'
        })
        
      case 'report':
        // Get comprehensive injury report
        const report = injuryService.getInjuryReport(sport)
        return NextResponse.json({
          sport: sport || 'all',
          ...report,
          generated_at: new Date()
        })
        
      default:
        // Return all active injuries
        const allInjuries = injuryService.getAllInjuredPlayers()
        return NextResponse.json({
          injuries: allInjuries,
          total: allInjuries.length,
          last_updated: new Date()
        })
    }
    
  } catch (error: any) {
    logger.error('Injury API error:', { error: error })
    return NextResponse.json(
      { error: 'Failed to retrieve injury data', details: error.message },
      { status: 500 }
    )
  }
}

// POST endpoint - update injury status (admin only)
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { player_id, status, injury_type, body_part, return_date, news } = body
    
    // Validate required fields
    if (!player_id || !status) {
      return NextResponse.json(
        { error: 'player_id and status are required' },
        { status: 400 }
      )
    }
    
    // Validate status
    const validStatuses = ['OUT', 'DOUBTFUL', 'QUESTIONABLE', 'PROBABLE', 'GTD', 'HEALTHY']
    if (!validStatuses.includes(status)) {
      return NextResponse.json(
        { error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` },
        { status: 400 }
      )
    }
    
    // Initialize services
    await services.initialize()
    const { injuryService } = services.getServices()
    
    // Update injury status
    await injuryService.updatePlayerInjuryStatus(
      player_id,
      status,
      {
        injury_type,
        body_part,
        return_date: return_date ? new Date(return_date) : undefined,
        news
      }
    )
    
    // Get updated status
    const updatedInjury = injuryService.getPlayerInjuryStatus(player_id)
    
    return NextResponse.json({
      success: true,
      player_id,
      updated_injury: updatedInjury,
      message: `Injury status updated to ${status}`
    })
    
  } catch (error: any) {
    logger.error('Injury update error:', { error: error })
    return NextResponse.json(
      { error: 'Failed to update injury status', details: error.message },
      { status: 500 }
    )
  }
}

// Real-time WebSocket endpoint for injury updates
export async function SOCKET(request: NextRequest) {
  // This would be handled by a WebSocket server
  // For now, return upgrade required
  return new NextResponse('WebSocket endpoint - use ws:// protocol', {
    status: 426,
    headers: {
      'Upgrade': 'websocket'
    }
  })
}
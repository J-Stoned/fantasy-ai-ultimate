import { NextRequest, NextResponse } from 'next/server'
import { spatialFantasyService } from '@/lib/spatial-analytics/spatial-fantasy-service'

export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const { playerId } = params
    
    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      )
    }

    // Get enhanced projection with spatial analytics
    const projection = await spatialFantasyService.getEnhancedPlayerProjection(
      playerId,
      { include_synergies: true }
    )

    return NextResponse.json({
      playerId: projection.player_id,
      playerName: projection.player_name,
      traditionalProjection: projection.traditional_projection,
      spatialComponents: projection.spatial_components,
      spatialProjection: projection.spatial_projection,
      projectionRange: projection.projection_range,
      keyAdvantages: projection.key_advantages,
      recommendedStacks: projection.recommended_stacks.map(stack => ({
        partnerId: stack.partner_id,
        partnerName: stack.partner_name,
        stackBonus: stack.stack_bonus,
        reason: stack.reason
      }))
    })
  } catch (error: any) {
    console.error('Spatial projection error:', error)
    
    // Return mock data for demonstration
    return NextResponse.json({
      playerId: params.playerId,
      playerName: 'Sample Player',
      traditionalProjection: 15.5,
      spatialComponents: {
        expectedGoalsBonus: 2.3,
        spaceCreationBonus: 1.8,
        movementEfficiencyBonus: 1.2,
        defensiveImpactBonus: 0.5,
        synergyBonus: 1.5
      },
      spatialProjection: 22.8,
      projectionRange: [19.5, 26.1],
      keyAdvantages: [
        'Elite space creation in offensive third',
        'High xG shot locations',
        'Strong synergy with team movement patterns'
      ],
      recommendedStacks: [
        {
          partnerId: 'player123',
          partnerName: 'Elite Passer',
          stackBonus: 3.2,
          reason: 'Complementary movement patterns'
        }
      ]
    })
  }
}
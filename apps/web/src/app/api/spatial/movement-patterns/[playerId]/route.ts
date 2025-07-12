import { NextRequest, NextResponse } from 'next/server'
import { movementAnalyzer } from '@/lib/spatial-analytics/movement-patterns'

export async function GET(
  request: NextRequest,
  { params }: { params: { playerId: string } }
) {
  try {
    const { playerId } = params
    const { searchParams } = new URL(request.url)
    const gameIds = searchParams.get('gameIds')?.split(',') || []
    const sport = searchParams.get('sport') || 'basketball'
    
    if (!playerId) {
      return NextResponse.json(
        { error: 'Player ID is required' },
        { status: 400 }
      )
    }

    // Get movement patterns if we have game data
    if (gameIds.length > 0) {
      try {
        const profile = await movementAnalyzer.analyzePlayerMovement(
          playerId,
          gameIds,
          sport as 'basketball' | 'soccer' | 'football'
        )

        return NextResponse.json(
          profile.movement_patterns.map(pattern => ({
            playerId,
            patternType: pattern.pattern_type,
            frequency: pattern.frequency,
            successRate: pattern.success_rate,
            avgSpaceCreated: pattern.avg_space_created,
            preferredZones: pattern.preferred_zones
          }))
        )
      } catch (error) {
        console.error('Movement analysis error:', error)
      }
    }

    // Return mock patterns for demonstration
    const mockPatterns = [
      {
        playerId,
        patternType: 'cut',
        frequency: 12,
        successRate: 0.75,
        avgSpaceCreated: 3.2,
        preferredZones: [
          { x: 70, y: 25, frequency: 0.4 },
          { x: 75, y: 30, frequency: 0.3 },
          { x: 65, y: 20, frequency: 0.3 }
        ]
      },
      {
        playerId,
        patternType: 'screen',
        frequency: 8,
        successRate: 0.68,
        avgSpaceCreated: 4.1,
        preferredZones: [
          { x: 50, y: 25, frequency: 0.6 },
          { x: 45, y: 20, frequency: 0.4 }
        ]
      },
      {
        playerId,
        patternType: 'pick_roll',
        frequency: 6,
        successRate: 0.72,
        avgSpaceCreated: 3.8,
        preferredZones: [
          { x: 50, y: 25, frequency: 0.7 },
          { x: 40, y: 20, frequency: 0.3 }
        ]
      }
    ]

    return NextResponse.json(mockPatterns)
  } catch (error: any) {
    console.error('Movement patterns error:', error)
    return NextResponse.json(
      { error: 'Failed to get movement patterns' },
      { status: 500 }
    )
  }
}
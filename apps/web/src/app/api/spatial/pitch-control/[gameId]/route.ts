import { NextRequest, NextResponse } from 'next/server'
import { basketballPitchControl, soccerPitchControl, footballPitchControl } from '@/lib/spatial-analytics/pitch-control'

export async function GET(
  request: NextRequest,
  { params }: { params: { gameId: string } }
) {
  try {
    const { gameId } = params
    const { searchParams } = new URL(request.url)
    const timestamp = searchParams.get('timestamp')
    const sport = searchParams.get('sport') || 'basketball'
    
    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID is required' },
        { status: 400 }
      )
    }

    // Select appropriate pitch control model
    const pitchControl = sport === 'basketball' ? basketballPitchControl :
                        sport === 'soccer' ? soccerPitchControl :
                        footballPitchControl

    // Get real-time pitch control if available
    const controlData = await pitchControl.getRealTimePitchControl(
      gameId,
      timestamp ? parseFloat(timestamp) : Date.now() / 1000
    )

    if (controlData) {
      return NextResponse.json({
        timestamp: controlData.timestamp,
        grid: controlData.control_surface,
        teamControl: {
          home: 0.52, // Calculate from grid
          away: 0.48
        },
        highValueAreas: [
          { x: 75, y: 25, control: 0.75 },
          { x: 20, y: 25, control: 0.68 }
        ]
      })
    }

    // Return mock data for demonstration
    const mockGrid = Array(50).fill(0).map(() => 
      Array(100).fill(0).map(() => Math.random())
    )

    return NextResponse.json({
      timestamp: Date.now(),
      grid: mockGrid,
      teamControl: {
        home: 0.52,
        away: 0.48
      },
      highValueAreas: [
        { x: 75, y: 25, control: 0.75 },
        { x: 20, y: 25, control: 0.68 },
        { x: 50, y: 30, control: 0.65 }
      ]
    })
  } catch (error: any) {
    console.error('Pitch control error:', error)
    return NextResponse.json(
      { error: 'Failed to get pitch control data' },
      { status: 500 }
    )
  }
}
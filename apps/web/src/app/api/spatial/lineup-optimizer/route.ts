import { NextRequest, NextResponse } from 'next/server'
import { enhancedOptimizer } from '@/lib/spatial-analytics/enhanced-lineup-optimizer'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const {
      sport,
      format,
      salary_cap,
      game_ids,
      existing_lineup,
      position_requirements,
      contest_type
    } = body

    if (!sport || !format) {
      return NextResponse.json(
        { error: 'Sport and format are required' },
        { status: 400 }
      )
    }

    const optimization = await enhancedOptimizer.optimizeWithSpatialAnalytics({
      sport: sport as 'basketball' | 'soccer' | 'football',
      format: format as 'season_long' | 'dfs',
      salary_cap,
      game_ids,
      existing_lineup,
      position_requirements
    })

    // Calculate additional insights
    const insights = {
      total_spatial_bonus: optimization.lineup.reduce((sum, player) => 
        sum + (player.enhanced_projection - player.base_projection), 0
      ),
      avg_synergy_score: optimization.offensive_synergy,
      key_stacks: optimization.lineup
        .filter(p => p.spatial_synergies.length > 0)
        .map(p => ({
          player: p.name,
          synergies: p.spatial_synergies
        }))
    }

    return NextResponse.json({
      success: true,
      optimization,
      insights
    })
  } catch (error: any) {
    console.error('Spatial lineup optimization error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error.message || 'Failed to optimize lineup' 
      },
      { status: 500 }
    )
  }
}
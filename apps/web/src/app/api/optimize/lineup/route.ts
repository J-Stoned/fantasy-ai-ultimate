/**
 * GPU-Accelerated DFS Lineup Optimization API
 * Uses RTX 4060 CUDA cores for real-time optimization
 */

import { NextRequest, NextResponse } from 'next/server'
import { database } from '@/lib/services/database'
import { cache } from '@/lib/services/cache'
import { services } from '@/lib/services/init'

interface OptimizationRequest {
  sport: string
  contest: {
    salary_cap: number
    roster_positions: string[]
  }
  players: string[]
  constraints?: {
    min_salary?: number
    max_exposure?: number
    lock_players?: string[]
    exclude_players?: string[]
    stack_rules?: any[]
  }
  num_lineups?: number
}

interface OptimizedLineup {
  players: Array<{
    id: string
    name: string
    position: string
    team: string
    salary: number
    projected_points: number
    ownership: number
  }>
  total_salary: number
  total_projected: number
  total_ownership: number
  optimization_score: number
}

export async function POST(request: NextRequest) {
  try {
    const body: OptimizationRequest = await request.json()
    const { sport, contest, players, constraints, num_lineups = 20 } = body

    // Validate request
    if (!sport || !contest || !players?.length) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Check cache first
    const cacheKey = `lineup:${JSON.stringify({ sport, contest, constraints })}`
    const cached = await cache.getCachedLineupOptimization({ sport, contest, constraints })
    
    if (cached && cached.length >= num_lineups) {
      return NextResponse.json({
        lineups: cached.slice(0, num_lineups),
        cached: true,
        processing_time: 0
      })
    }

    // Get GPU optimizer
    const { gpu } = services.getServices()
    
    if (!gpu) {
      return NextResponse.json(
        { error: 'GPU optimization not available' },
        { status: 503 }
      )
    }

    // Fetch player data with projections
    const playerData = await database.query<any>(
      `SELECT 
        p.id, p.name, p.position, p.team_id,
        ps.salary, ps.ownership_projection,
        fp.projected_points, fp.floor_points, fp.ceiling_points
       FROM players p
       JOIN player_salaries ps ON p.id = ps.player_id
       JOIN fantasy_projections fp ON p.id = fp.player_id
       WHERE p.id = ANY($1)
         AND ps.platform = $2
         AND fp.game_date = CURRENT_DATE`,
      [players, 'draftkings'], // Default to DK for now
      'read'
    )

    if (playerData.length === 0) {
      return NextResponse.json(
        { error: 'No valid players found' },
        { status: 404 }
      )
    }

    // Start optimization timer
    const startTime = performance.now()

    // Run GPU optimization
    const optimizedLineups = await gpu.optimizeLineups({
      players: playerData.map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        team: p.team_id,
        salary: p.salary,
        projectedPoints: p.projected_points,
        ownership: p.ownership_projection || 0.1,
        ceiling: p.ceiling_points,
        floor: p.floor_points
      })),
      salaryCap: contest.salary_cap,
      rosterPositions: contest.roster_positions,
      constraints: {
        minSalary: constraints?.min_salary || contest.salary_cap * 0.95,
        maxExposure: constraints?.max_exposure || 0.5,
        lockPlayers: constraints?.lock_players || [],
        excludePlayers: constraints?.exclude_players || [],
        stackRules: constraints?.stack_rules || []
      },
      numLineups: num_lineups
    })

    const processingTime = performance.now() - startTime

    // Format lineups for response
    const formattedLineups: OptimizedLineup[] = optimizedLineups.map(lineup => ({
      players: lineup.players.map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        team: p.team,
        salary: p.salary,
        projected_points: p.projectedPoints,
        ownership: p.ownership
      })),
      total_salary: lineup.totalSalary,
      total_projected: lineup.totalProjected,
      total_ownership: lineup.totalOwnership,
      optimization_score: lineup.score
    }))

    // Cache the results
    await cache.cacheLineupOptimization(
      { sport, contest, constraints },
      formattedLineups,
      1800 // 30 minutes
    )

    // Save to GPU cache in database
    await database.execute(
      `INSERT INTO gpu_optimization_cache 
       (cache_key, player_ids, constraints, optimized_lineups, processing_time_ms, 
        gpu_utilization, cuda_cores_used, memory_used_mb, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW() + INTERVAL '30 minutes')`,
      [
        cacheKey,
        players,
        constraints,
        JSON.stringify(formattedLineups),
        processingTime,
        await gpu.getGPUUtilization(),
        3072, // RTX 4060 CUDA cores
        await gpu.getMemoryUsage()
      ]
    )

    // Broadcast optimization complete via WebSocket
    if (global.wsManager) {
      await global.wsManager.broadcast('optimization:complete', {
        cacheKey,
        numLineups: formattedLineups.length,
        processingTime
      }, null, { priority: 'high' })
    }

    return NextResponse.json({
      lineups: formattedLineups,
      cached: false,
      processing_time: processingTime,
      gpu_info: {
        backend: 'tensorflow-gpu',
        cuda_cores: 3072,
        memory: '8GB',
        utilization: await gpu.getGPUUtilization()
      }
    })

  } catch (error: any) {
    console.error('Lineup optimization error:', error)
    return NextResponse.json(
      { error: 'Failed to optimize lineups', details: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to check optimization status
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const cacheKey = searchParams.get('cache_key')

    if (!cacheKey) {
      // Return GPU status
      const { gpu } = services.getServices()
      
      return NextResponse.json({
        gpu_available: gpu !== undefined,
        gpu_info: gpu ? {
          backend: 'tensorflow-gpu',
          cuda_cores: 3072,
          memory: '8GB',
          status: 'ready'
        } : null
      })
    }

    // Check if optimization exists
    const result = await database.queryOne<any>(
      `SELECT * FROM gpu_optimization_cache 
       WHERE cache_key = $1 AND expires_at > NOW()`,
      [cacheKey],
      'read'
    )

    if (!result) {
      return NextResponse.json(
        { error: 'Optimization not found or expired' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      found: true,
      lineups: result.optimized_lineups,
      processing_time: result.processing_time_ms,
      created_at: result.created_at,
      expires_at: result.expires_at,
      hit_count: result.hit_count
    })

  } catch (error: any) {
    console.error('Get optimization error:', error)
    return NextResponse.json(
      { error: 'Failed to retrieve optimization', details: error.message },
      { status: 500 }
    )
  }
}
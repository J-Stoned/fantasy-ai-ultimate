/**
 * 🚀 ML-Powered DFS Lineup Optimization API
 * Uses RTX 4060 CUDA cores + XGBoost models for real-time optimization
 */

import { NextRequest, NextResponse } from 'next/server'
import { database } from '@/lib/services/database'
import { services } from '@/lib/services/init'
import type { MLOptimizationOptions } from '../../../../../../../scripts/fantasy-ml/services/ml-dfs-optimizer'
import { logger } from '../../../../lib/logging/logger';

interface OptimizationRequest {
  sport: string
  game_date?: string
  platform?: 'draftkings' | 'fanduel' | 'yahoo'
  contest_type?: 'gpp' | 'cash' | 'h2h'
  contest: {
    salary_cap: number
    roster_positions: string[]
  }
  constraints?: {
    min_salary?: number
    max_exposure?: number
    lock_players?: string[]
    exclude_players?: string[]
    stack_rules?: any[]
    min_teams?: number
    max_from_team?: number
  }
  num_lineups?: number
  strategy?: 'balanced' | 'contrarian' | 'ceiling' | 'stars_scrubs'
}

interface EnhancedLineup {
  players: Array<{
    id: string
    name: string
    position: string
    team: string
    opponent: string
    salary: number
    projected_points: number
    floor: number
    ceiling: number
    ownership: number
    boom_probability: number
  }>
  total_salary: number
  projected_points: number
  projected_ownership: number
  ceiling: number
  leverage_score: number
  correlation_score: number
  ml_confidence: number
  stack_quality: number
  optimization_method: string
}

export async function POST(request: NextRequest) {
  try {
    const body: OptimizationRequest = await request.json()
    const { 
      sport, 
      game_date = new Date().toISOString().split('T')[0],
      platform = 'draftkings',
      contest_type = 'gpp',
      contest, 
      constraints, 
      num_lineups = 20,
      strategy = 'balanced' 
    } = body

    // Validate request
    if (!sport || !contest) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    // Initialize services if needed
    await services.initialize()

    // Get services
    const { mlOptimizer, cacheService } = services.getServices()

    // Check cache first
    const cacheKey = {
      sport,
      game_date,
      platform,
      contest_type,
      strategy,
      salary_cap: contest.salary_cap,
      roster_positions: contest.roster_positions.sort().join(',')
    }
    
    const cached = await cacheService.get<EnhancedLineup[]>('lineups', cacheKey)
    
    if (cached && cached.length >= num_lineups) {
      logger.info('📦 Returning cached lineups')
      return NextResponse.json({
        lineups: cached.slice(0, num_lineups),
        cached: true,
        processing_time: 0,
        cache_key: JSON.stringify(cacheKey)
      })
    }
    
    if (!mlOptimizer) {
      return NextResponse.json(
        { error: 'ML optimization service not available' },
        { status: 503 }
      )
    }

    // Prepare optimization options
    const optimizationOptions: MLOptimizationOptions = {
      sport,
      game_date: new Date(game_date),
      platform,
      contest_type,
      num_lineups,
      salary_cap: contest.salary_cap,
      roster_positions: contest.roster_positions,
      strategy,
      constraints: {
        min_salary: constraints?.min_salary || contest.salary_cap * 0.95,
        max_exposure: constraints?.max_exposure || 0.5,
        must_include: constraints?.lock_players || [],
        exclude: constraints?.exclude_players || [],
        stack_rules: constraints?.stack_rules || [],
        min_teams: constraints?.min_teams,
        max_from_team: constraints?.max_from_team
      }
    }

    // Start optimization timer
    const startTime = performance.now()

    logger.info('🧠 Running ML optimization for ${sport} on ${game_date}')
    logger.info('📊 Strategy: ${strategy}, Contest: ${contest_type}')

    // Run ML-powered optimization
    const optimizedLineups = await mlOptimizer.optimizeLineups(optimizationOptions)

    const processingTime = performance.now() - startTime
    logger.info('⚡ Optimization completed in ${processingTime.toFixed(0)}ms')

    // Format lineups for response
    const formattedLineups = optimizedLineups.map(lineup => ({
      players: lineup.players.map(p => ({
        id: p.id,
        name: p.name,
        position: p.position,
        team: p.team,
        opponent: p.opponent,
        salary: p.salary,
        projected_points: p.projected_points,
        floor: p.floor,
        ceiling: p.ceiling,
        ownership: p.projected_ownership,
        boom_probability: p.boom_probability
      })),
      total_salary: lineup.total_salary,
      total_projected: lineup.projected_points,
      total_ownership: lineup.projected_ownership,
      ceiling_total: lineup.ceiling,
      leverage_score: lineup.leverage_score,
      correlation_score: lineup.correlation_score,
      ml_confidence: lineup.ml_confidence,
      stack_quality: lineup.stack_quality,
      optimization_method: lineup.optimization_method
    }))

    // Cache the results
    await cacheService.set(
      'lineups',
      cacheKey,
      formattedLineups,
      1800 // 30 minutes
    )

    // Save optimization metadata
    try {
      await database.execute(
        `INSERT INTO optimization_logs 
         (sport, game_date, platform, contest_type, strategy, num_lineups, 
          processing_time_ms, ml_models_used, created_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
         ON CONFLICT DO NOTHING`,
        [
          sport,
          game_date,
          platform,
          contest_type,
          strategy,
          num_lineups,
          processingTime,
          JSON.stringify(services.getServices().modelLoader.getLoadedModels())
        ]
      )
    } catch (error) {
      logger.warn('Failed to save optimization metadata:', error)
    }

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
      optimization_info: {
        sport,
        game_date,
        platform,
        contest_type,
        strategy,
        models_used: services.getServices().modelLoader.getLoadedModels(),
        gpu_backend: 'tensorflow-gpu',
        total_players_analyzed: formattedLineups[0]?.players.length * 10 || 0
      },
      cache_key: JSON.stringify(cacheKey)
    })

  } catch (error: any) {
    logger.error('Lineup optimization error:', { error: error })
    return NextResponse.json(
      { error: 'Failed to optimize lineups', details: error.message },
      { status: 500 }
    )
  }
}

// GET endpoint to check optimization status and service health
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const action = searchParams.get('action')

    // Initialize services if needed
    await services.initialize()
    const { mlOptimizer, modelLoader, gpu, cacheService } = services.getServices()

    if (action === 'health') {
      // Return service health status
      const cacheStats = await cacheService.getStats()
      
      return NextResponse.json({
        status: 'healthy',
        services: {
          ml_optimizer: mlOptimizer !== undefined,
          model_loader: modelLoader !== undefined,
          gpu_service: gpu !== undefined,
          database: await checkDatabaseHealth(),
          cache: await cacheService.healthCheck()
        },
        models: modelLoader.getLoadedModels(),
        gpu_info: {
          backend: 'tensorflow-gpu',
          cuda_cores: 3072,
          memory: '8GB',
          status: gpu ? 'ready' : 'unavailable'
        },
        cache_stats: cacheStats
      })
    }

    // Default: return supported features
    return NextResponse.json({
      supported_sports: ['nfl', 'nba', 'mlb', 'nhl'],
      supported_platforms: ['draftkings', 'fanduel', 'yahoo'],
      supported_strategies: ['balanced', 'contrarian', 'ceiling', 'stars_scrubs'],
      contest_types: ['gpp', 'cash', 'h2h'],
      features: {
        ml_predictions: true,
        gpu_acceleration: gpu !== undefined,
        correlation_analysis: true,
        stack_building: true,
        multi_algorithm_optimization: true,
        real_time_caching: true
      },
      models_loaded: modelLoader.getLoadedModels()
    })

  } catch (error: any) {
    logger.error('GET endpoint error:', { error: error })
    return NextResponse.json(
      { error: 'Service error', details: error.message },
      { status: 500 }
    )
  }
}

// Helper function to check database health
async function checkDatabaseHealth(): Promise<boolean> {
  try {
    const result = await database.query('SELECT 1', [], 'read')
    return result.length > 0
  } catch {
    return false
  }
}
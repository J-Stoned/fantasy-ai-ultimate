/**
 * 🎯 Ownership API Endpoint
 * Returns ownership projections, leverage plays, and GPP insights
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import OwnershipEngineV2 from '@/lib/services/ownership-engine-v2';
import { VegasService } from '@/lib/services/vegas-service';
import { WeatherService } from '@/lib/services/weather-service';
import { InjuryService } from '@/lib/services/injury-service';
import { cacheService } from '@/lib/services/cache-service';
import { logger } from '../../../lib/logging/logger';

// Initialize database pool
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize services (singleton pattern)
let ownershipEngine: OwnershipEngineV2 | null = null;
let servicesInitialized = false;

async function initializeServices() {
  if (servicesInitialized) return;
  
  try {
    logger.info('🔍 [ELITE DEBUG] Starting service initialization...');
    
    // Initialize services one by one with precise error tracking
    logger.info('🔍 [ELITE DEBUG] Initializing VegasService...');
    const vegasService = new VegasService(pgPool);
    await vegasService.initialize();
    logger.info('✅ [ELITE DEBUG] VegasService initialized successfully');
    
    logger.info('🔍 [ELITE DEBUG] Initializing WeatherService...');
    const weatherService = new WeatherService(pgPool);
    await weatherService.initialize();
    logger.info('✅ [ELITE DEBUG] WeatherService initialized successfully');
    
    logger.info('🔍 [ELITE DEBUG] Initializing InjuryService...');
    const injuryService = new InjuryService(pgPool);
    await injuryService.initialize();
    logger.info('✅ [ELITE DEBUG] InjuryService initialized successfully');
    
    logger.info('🔍 [ELITE DEBUG] Creating OwnershipEngineV2...');
    ownershipEngine = new OwnershipEngineV2(
      pgPool,
      vegasService,
      injuryService,
      weatherService
    );
    logger.info('✅ [ELITE DEBUG] OwnershipEngineV2 created successfully');
    
    servicesInitialized = true;
    logger.info('🎉 [ELITE DEBUG] All services initialized successfully');
  } catch (error) {
    logger.error('❌ [ELITE DEBUG] Service initialization failed:', { 
      error: error.message,
      stack: error.stack,
      sqlState: error.code,
      sqlMessage: error.detail || error.hint
    });
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log('🔍 [ELITE DEBUG] Starting ownership projection engine...');
    
    // Initialize services
    await initializeServices();
    
    if (!ownershipEngine) {
      throw new Error('Ownership engine not initialized');
    }
    
    // Get query parameters
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') || 'nfl';
    const slate = searchParams.get('slate') || 'main';
    const gameDate = new Date(searchParams.get('gameDate') || new Date());
    const contestType = (searchParams.get('contestType') as 'GPP' | 'CASH') || 'GPP';
    const limit = parseInt(searchParams.get('limit') || '50');
    
    console.log(`🧠 [ELITE DEBUG] Getting ownership projections for ${sport} ${slate}...`);
    
    // Get projections
    const projections = await ownershipEngine.projectSlateOwnership(
      sport,
      slate,
      gameDate,
      contestType
    );
    
    console.log(`✅ [ELITE DEBUG] Generated ${projections.length} ownership projections`);
    
    // Get top leverage plays
    const leveragePlays = projections
      .filter(p => p.leverageScore > 1.5 && p.projectedOwnership < 0.20)
      .sort((a, b) => b.leverageScore - a.leverageScore)
      .slice(0, 10);
    
    // Get chalk plays
    const chalkPlays = projections
      .filter(p => p.projectedOwnership > 0.20)
      .sort((a, b) => b.projectedOwnership - a.projectedOwnership)
      .slice(0, 10);
    
    // Get contrarian plays
    const contrarianPlays = projections
      .filter(p => p.projectedOwnership < 0.10 && p.projectedPoints > 10)
      .sort((a, b) => b.contrarianScore - a.contrarianScore)
      .slice(0, 10);
    
    // Calculate slate statistics
    const slateStats = {
      totalPlayers: projections.length,
      avgOwnership: projections.reduce((sum, p) => sum + p.projectedOwnership, 0) / projections.length,
      maxOwnership: Math.max(...projections.map(p => p.projectedOwnership)),
      minOwnership: Math.min(...projections.map(p => p.projectedOwnership)),
      chalkCount: projections.filter(p => p.projectedOwnership > 0.20).length,
      leverageCount: projections.filter(p => p.leverageScore > 2.0).length,
    };
    
    // Limit full projections
    const limitedProjections = projections.slice(0, limit);
    
    return NextResponse.json({
      success: true,
      data: {
        projections: limitedProjections,
        leveragePlays,
        chalkPlays,
        contrarianPlays,
        slateStats,
        metadata: {
          sport,
          slate,
          gameDate: gameDate.toISOString(),
          contestType,
          totalPlayers: projections.length,
          limited: projections.length > limit
        }
      }
    });
    
  } catch (error) {
    logger.error('Ownership API error:', { error: error });
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get ownership projections' 
      },
      { status: 500 }
    );
  }
}

// Get ownership for specific players
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { playerIds, sport, gameDate, contestType = 'GPP' } = body;
    
    if (!playerIds || !Array.isArray(playerIds)) {
      return NextResponse.json(
        { success: false, error: 'playerIds array required' },
        { status: 400 }
      );
    }
    
    // Initialize services if needed
    await initializeServices();
    
    if (!ownershipEngine) {
      throw new Error('Ownership engine not initialized');
    }
    
    // Get projections for the slate
    const projections = await ownershipEngine.projectSlateOwnership(
      sport || 'nfl',
      'main',
      new Date(gameDate || new Date()),
      contestType
    );
    
    // Filter to requested players
    const playerProjections = projections.filter(p => 
      playerIds.includes(p.playerId)
    );
    
    // Calculate stack correlation if multiple players
    if (playerProjections.length > 1) {
      // Group by team
      const byTeam = new Map<string, typeof playerProjections>();
      playerProjections.forEach(p => {
        if (!byTeam.has(p.team)) {
          byTeam.set(p.team, []);
        }
        byTeam.get(p.team)!.push(p);
      });
      
      // Calculate combined ownership and leverage
      const stackStats = {
        combinedOwnership: playerProjections.reduce((sum, p) => sum + p.projectedOwnership, 0),
        combinedLeverage: playerProjections.reduce((sum, p) => sum + p.leverageScore, 0),
        uniqueTeams: byTeam.size,
        stackCorrelation: byTeam.size === 1 ? 'SAME_TEAM' : 
                         byTeam.size === 2 ? 'GAME_STACK' : 'MIXED',
        avgConfidence: playerProjections.reduce((sum, p) => sum + p.confidence, 0) / playerProjections.length
      };
      
      return NextResponse.json({
        success: true,
        data: {
          players: playerProjections,
          stackStats
        }
      });
    }
    
    return NextResponse.json({
      success: true,
      data: {
        players: playerProjections
      }
    });
    
  } catch (error) {
    logger.error('Ownership API error:', { error: error });
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to get player ownership' 
      },
      { status: 500 }
    );
  }
}

// Health check
export async function HEAD() {
  return new Response(null, { status: 200 });
}
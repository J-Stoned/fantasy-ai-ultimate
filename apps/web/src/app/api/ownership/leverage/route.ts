/**
 * 🎯 Leverage Plays API
 * Find the best low-owned, high-upside GPP plays
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import OwnershipEngineV2 from '@/lib/services/ownership-engine-v2';
import { VegasService } from '@/lib/services/vegas-service';
import { WeatherService } from '@/lib/services/weather-service';
import { InjuryService } from '@/lib/services/injury-service';
import { PredictionService } from '../../../../../../scripts/domains/ml/services/prediction-service';
import { ModelLoaderService } from '../../../../../../scripts/domains/ml/services/model-loader';
import { cacheService } from '@/lib/services/cache-service';
import { logger } from '../../../../lib/logging/logger';

// Initialize database pool
const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Services singleton
let predictionService: PredictionService | null = null;
let servicesInitialized = false;

async function initializeServices() {
  if (servicesInitialized) return;
  
  try {
    // Initialize cache
    await cacheService.initialize();
    
    // Initialize services
    const vegasService = new VegasService(pgPool);
    const weatherService = new WeatherService(pgPool);
    const injuryService = new InjuryService(pgPool);
    const modelLoader = new ModelLoaderService();
    
    await vegasService.initialize();
    await weatherService.initialize();
    await injuryService.initialize();
    await modelLoader.loadAllModels();
    
    // Create prediction service with ownership
    predictionService = new PredictionService(
      pgPool,
      modelLoader,
      injuryService,
      vegasService,
      weatherService
    );
    
    servicesInitialized = true;
  } catch (error) {
    logger.error('Failed to initialize services:', { error: error });
    throw error;
  }
}

export async function GET(request: NextRequest) {
  try {
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const sport = searchParams.get('sport') || 'nfl';
    const dateStr = searchParams.get('date') || new Date().toISOString().split('T')[0];
    const platform = (searchParams.get('platform') || 'draftkings') as 'draftkings' | 'fanduel';
    const minLeverage = parseFloat(searchParams.get('minLeverage') || '1.5');
    const maxOwnership = parseFloat(searchParams.get('maxOwnership') || '0.20');
    const minSalary = parseInt(searchParams.get('minSalary') || '0');
    const positions = searchParams.get('positions')?.split(',') || undefined;
    const limit = parseInt(searchParams.get('limit') || '20');
    
    // Initialize services
    await initializeServices();
    
    if (!predictionService) {
      throw new Error('Prediction service not initialized');
    }
    
    // Get predictions with ownership
    const predictions = await predictionService.generatePredictions({
      sport,
      game_date: new Date(dateStr),
      platform,
      min_salary: minSalary,
      positions
    });
    
    // Filter for leverage plays
    const leveragePlays = predictions
      .filter(p => 
        p.leverage_score >= minLeverage &&
        p.ownership_projection <= maxOwnership &&
        p.projected_points > 5 // Minimum viable points
      )
      .sort((a, b) => b.leverage_score - a.leverage_score)
      .slice(0, limit);
    
    // Group by position for easier lineup building
    const byPosition = leveragePlays.reduce((acc, player) => {
      if (!acc[player.position]) {
        acc[player.position] = [];
      }
      acc[player.position].push(player);
      return acc;
    }, {} as Record<string, typeof leveragePlays>);
    
    // Find correlated stacks
    const stacks = findCorrelatedStacks(leveragePlays);
    
    // Calculate optimal exposure levels
    const exposureRecommendations = leveragePlays.map(player => ({
      playerId: player.player_id,
      playerName: player.name,
      optimalExposure: calculateOptimalExposure(player),
      reasoning: getLeverageReasoning(player)
    }));
    
    return NextResponse.json({
      success: true,
      data: {
        leveragePlays,
        byPosition,
        stacks,
        exposureRecommendations,
        summary: {
          totalPlays: leveragePlays.length,
          avgLeverage: leveragePlays.reduce((sum, p) => sum + p.leverage_score, 0) / leveragePlays.length,
          avgOwnership: leveragePlays.reduce((sum, p) => sum + p.ownership_projection, 0) / leveragePlays.length,
          positions: Object.keys(byPosition),
          bestLeverage: leveragePlays[0] || null
        }
      }
    });
    
  } catch (error) {
    logger.error('Leverage API error:', { error: error });
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to find leverage plays' 
      },
      { status: 500 }
    );
  }
}

// Helper functions
function findCorrelatedStacks(players: any[]) {
  const stacks = [];
  const byTeam = new Map<string, any[]>();
  
  // Group by team
  players.forEach(p => {
    if (!byTeam.has(p.team)) {
      byTeam.set(p.team, []);
    }
    byTeam.get(p.team)!.push(p);
  });
  
  // Find QB stacks
  byTeam.forEach((teamPlayers, team) => {
    const qb = teamPlayers.find(p => p.position === 'QB');
    if (qb) {
      const receivers = teamPlayers.filter(p => 
        p.position === 'WR' || p.position === 'TE'
      );
      
      if (receivers.length > 0) {
        stacks.push({
          type: 'QB_STACK',
          team,
          qb,
          receivers,
          combinedLeverage: qb.leverage_score + receivers.reduce((sum, r) => sum + r.leverage_score, 0),
          combinedOwnership: qb.ownership_projection + receivers.reduce((sum, r) => sum + r.ownership_projection, 0)
        });
      }
    }
  });
  
  return stacks.sort((a, b) => b.combinedLeverage - a.combinedLeverage);
}

function calculateOptimalExposure(player: any): number {
  // Base exposure on leverage score
  let exposure = Math.min(0.4, player.leverage_score * 0.1);
  
  // Cap by projected ownership to maintain leverage
  exposure = Math.min(exposure, player.ownership_projection * 3);
  
  // Boost for extreme leverage
  if (player.leverage_score > 5) {
    exposure = Math.min(0.5, exposure * 1.5);
  }
  
  // Minimum threshold
  exposure = Math.max(0.05, exposure);
  
  return Math.round(exposure * 100); // Return as percentage
}

function getLeverageReasoning(player: any): string[] {
  const reasons = [];
  
  if (player.leverage_score > 5) {
    reasons.push(`Elite leverage: ${player.leverage_score.toFixed(1)}x`);
  } else if (player.leverage_score > 3) {
    reasons.push(`Strong leverage: ${player.leverage_score.toFixed(1)}x`);
  }
  
  if (player.ownership_projection < 0.05) {
    reasons.push(`Ultra low ownership: ${(player.ownership_projection * 100).toFixed(1)}%`);
  } else if (player.ownership_projection < 0.10) {
    reasons.push(`Very low ownership: ${(player.ownership_projection * 100).toFixed(1)}%`);
  }
  
  if (player.value_rating > 3.5) {
    reasons.push(`Elite value: ${player.value_rating.toFixed(1)}x`);
  }
  
  if (player.boom_probability > 30) {
    reasons.push(`High ceiling: ${player.boom_probability.toFixed(0)}% boom chance`);
  }
  
  if (player.narrative_factors && player.narrative_factors.length > 0) {
    reasons.push(`Narratives: ${player.narrative_factors.join(', ')}`);
  }
  
  return reasons;
}
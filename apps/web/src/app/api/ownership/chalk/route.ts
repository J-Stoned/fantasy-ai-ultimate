/**
 * 🔥 Chalk Analysis API
 * Identify popular plays to fade in GPPs
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { PredictionService } from '@/scripts/fantasy-ml/services/prediction-service';
import { ModelLoaderService } from '@/scripts/fantasy-ml/services/model-loader';
import { VegasService } from '@/scripts/fantasy-ml/services/vegas-service';
import { WeatherService } from '@/scripts/fantasy-ml/services/weather-service';
import { InjuryService } from '@/scripts/fantasy-ml/services/injury-service';
import { cacheService } from '@/scripts/fantasy-ml/services/cache-service';
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
    const minOwnership = parseFloat(searchParams.get('minOwnership') || '0.20');
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
      platform
    });
    
    // Find chalk plays
    const chalkPlays = predictions
      .filter(p => p.ownership_projection >= minOwnership)
      .sort((a, b) => b.ownership_projection - a.ownership_projection)
      .slice(0, limit);
    
    // Find better alternatives for each chalk play
    const fadeRecommendations = chalkPlays.map(chalk => {
      // Find players at same position with better leverage
      const alternatives = predictions
        .filter(p => 
          p.position === chalk.position &&
          p.player_id !== chalk.player_id &&
          p.leverage_score > chalk.leverage_score &&
          p.ownership_projection < chalk.ownership_projection * 0.5 &&
          p.salary <= chalk.salary * 1.2 // Similar price range
        )
        .sort((a, b) => b.leverage_score - a.leverage_score)
        .slice(0, 3);
      
      return {
        chalk,
        alternatives,
        fadeReason: getFadeReason(chalk),
        ownershipDifferential: alternatives[0] 
          ? chalk.ownership_projection - alternatives[0].ownership_projection
          : 0
      };
    });
    
    // Calculate chalk statistics
    const chalkStats = {
      totalChalk: chalkPlays.length,
      avgOwnership: chalkPlays.reduce((sum, p) => sum + p.ownership_projection, 0) / chalkPlays.length,
      totalOwnership: chalkPlays.reduce((sum, p) => sum + p.ownership_projection, 0),
      positions: [...new Set(chalkPlays.map(p => p.position))],
      avgValue: chalkPlays.reduce((sum, p) => sum + p.value_rating, 0) / chalkPlays.length,
      chalkByPosition: chalkPlays.reduce((acc, p) => {
        acc[p.position] = (acc[p.position] || 0) + 1;
        return acc;
      }, {} as Record<string, number>)
    };
    
    return NextResponse.json({
      success: true,
      data: {
        chalkPlays,
        fadeRecommendations,
        chalkStats,
        insights: generateChalkInsights(chalkPlays, predictions)
      }
    });
    
  } catch (error) {
    logger.error('Chalk API error:', { error: error });
    return NextResponse.json(
      { 
        success: false, 
        error: error instanceof Error ? error.message : 'Failed to analyze chalk' 
      },
      { status: 500 }
    );
  }
}

function getFadeReason(player: any): string[] {
  const reasons = [];
  
  // Low leverage
  if (player.leverage_score < 1.0) {
    reasons.push('Poor leverage (ownership > value)');
  }
  
  // Overpriced
  if (player.value_rating < 2.5) {
    reasons.push(`Low value: ${player.value_rating.toFixed(1)}x`);
  }
  
  // Too chalky
  if (player.ownership_projection > 0.35) {
    reasons.push(`Extreme ownership: ${(player.ownership_projection * 100).toFixed(0)}%`);
  }
  
  // High bust risk
  if (player.bust_probability > 40) {
    reasons.push(`High bust risk: ${player.bust_probability.toFixed(0)}%`);
  }
  
  // Injury concern
  if (player.injury_risk && player.injury_risk > 0.3) {
    reasons.push('Injury concern');
  }
  
  return reasons;
}

function generateChalkInsights(chalkPlays: any[], allPlayers: any[]): string[] {
  const insights = [];
  
  // Position concentration
  const qbChalk = chalkPlays.filter(p => p.position === 'QB').length;
  if (qbChalk > 2) {
    insights.push(`${qbChalk} QBs are chalk - consider contrarian QB options`);
  }
  
  // Salary concentration
  const expensiveChalk = chalkPlays.filter(p => p.salary > 8000).length;
  if (expensiveChalk > 3) {
    insights.push(`${expensiveChalk} expensive players are chalk - leaves value opportunities`);
  }
  
  // Team concentration
  const teamCounts = chalkPlays.reduce((acc, p) => {
    acc[p.team] = (acc[p.team] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  Object.entries(teamCounts).forEach(([team, count]) => {
    if (count >= 3) {
      insights.push(`${team} has ${count} chalk players - potential oversaturation`);
    }
  });
  
  // Value opportunities
  const lowOwnedValue = allPlayers.filter(p => 
    p.value_rating > 3.0 && p.ownership_projection < 0.10
  ).length;
  
  if (lowOwnedValue > 0) {
    insights.push(`${lowOwnedValue} value plays under 10% ownership available`);
  }
  
  return insights;
}
/**
 * 📱 ENHANCED MOBILE API - Predictions
 * 
 * Optimized for mobile app consumption
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { ensemblePredictor } from '@/lib/ml/ensemble-predictor';
import * as path from 'path';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Cache for predictions
const predictionCache = new Map<string, any>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const sport = searchParams.get('sport') || 'all';
    const timeframe = searchParams.get('timeframe') || 'today';
    const limit = parseInt(searchParams.get('limit') || '20');
    const confidence = parseFloat(searchParams.get('minConfidence') || '0');
    
    // Check cache
    const cacheKey = `${sport}-${timeframe}-${limit}-${confidence}`;
    const cached = predictionCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }
    
    // Calculate date range
    const now = new Date();
    let startDate = new Date(now);
    let endDate = new Date(now);
    
    switch (timeframe) {
      case 'today':
        endDate.setDate(endDate.getDate() + 1);
        break;
      case 'tomorrow':
        startDate.setDate(startDate.getDate() + 1);
        endDate.setDate(endDate.getDate() + 2);
        break;
      case 'week':
        endDate.setDate(endDate.getDate() + 7);
        break;
    }
    
    // Get predictions with game details
    let query = supabase
      .from('ml_predictions')
      .select(`
        *,
        games!inner(
          id,
          sport_id,
          start_time,
          status,
          venue,
          home_team:teams!games_home_team_id_fkey(
            id,
            name,
            abbreviation,
            logo_url
          ),
          away_team:teams!games_away_team_id_fkey(
            id,
            name,
            abbreviation,
            logo_url
          )
        )
      `)
      .eq('model_name', 'ensemble_v2')
      .gte('games.start_time', startDate.toISOString())
      .lte('games.start_time', endDate.toISOString())
      .gte('confidence', confidence)
      .order('confidence', { ascending: false })
      .limit(limit);
    
    if (sport !== 'all') {
      query = query.eq('games.sport_id', sport);
    }
    
    const { data: predictions, error } = await query;
    
    if (error) {
      throw error;
    }
    
    // Format for mobile
    const formatted = predictions?.map(pred => {
      const metadata = pred.metadata as any;
      const game = pred.games as any;
      
      return {
        id: pred.id,
        gameId: pred.game_id,
        sport: game.sport_id,
        startTime: game.start_time,
        venue: game.venue,
        homeTeam: {
          id: game.home_team.id,
          name: game.home_team.name,
          abbreviation: game.home_team.abbreviation,
          logoUrl: game.home_team.logo_url
        },
        awayTeam: {
          id: game.away_team.id,
          name: game.away_team.name,
          abbreviation: game.away_team.abbreviation,
          logoUrl: game.away_team.logo_url
        },
        prediction: {
          winner: metadata.predicted_winner || (metadata.home_win_probability > 0.5 ? 'home' : 'away'),
          homeWinProbability: metadata.home_win_probability || pred.prediction,
          confidence: pred.confidence,
          spread: metadata.predicted_spread || null,
          totalPoints: metadata.predicted_total || null
        },
        insights: {
          topFactors: metadata.top_factors || [],
          keyStats: metadata.key_stats || {},
          trend: metadata.trend || 'neutral'
        },
        lastUpdated: pred.created_at
      };
    }) || [];
    
    // Add summary statistics
    const summary = {
      total: formatted.length,
      highConfidence: formatted.filter(p => p.prediction.confidence > 0.75).length,
      byTeam: {} as Record<string, number>,
      bySport: {} as Record<string, number>
    };
    
    formatted.forEach(pred => {
      // Count by winning team
      const winner = pred.prediction.winner === 'home' ? pred.homeTeam.name : pred.awayTeam.name;
      summary.byTeam[winner] = (summary.byTeam[winner] || 0) + 1;
      
      // Count by sport
      summary.bySport[pred.sport] = (summary.bySport[pred.sport] || 0) + 1;
    });
    
    const response = {
      predictions: formatted,
      summary,
      metadata: {
        sport,
        timeframe,
        startDate: startDate.toISOString(),
        endDate: endDate.toISOString(),
        cached: false,
        generatedAt: new Date().toISOString()
      }
    };
    
    // Cache the response
    predictionCache.set(cacheKey, {
      data: response,
      timestamp: Date.now()
    });
    
    return NextResponse.json(response);
    
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { gameId } = body;
    
    if (!gameId) {
      return NextResponse.json(
        { error: 'Game ID required' },
        { status: 400 }
      );
    }
    
    // Get game details
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(*),
        away_team:teams!games_away_team_id_fkey(*)
      `)
      .eq('id', gameId)
      .single();
    
    if (gameError || !game) {
      return NextResponse.json(
        { error: 'Game not found' },
        { status: 404 }
      );
    }
    
    // Check if prediction already exists
    const { data: existing } = await supabase
      .from('ml_predictions')
      .select('*')
      .eq('game_id', gameId)
      .eq('model_name', 'ensemble_v2')
      .single();
    
    if (existing) {
      return NextResponse.json({
        prediction: formatPrediction(existing, game),
        cached: true
      });
    }
    
    // Load models if needed
    if (!ensemblePredictor.isLoaded) {
      await ensemblePredictor.loadModels(path.join(process.cwd(), 'models'));
    }
    
    // Extract features (simplified for demo)
    const features = await extractGameFeatures(game);
    
    // Make prediction
    const prediction = await ensemblePredictor.predict(features);
    
    // Store prediction
    const { data: stored, error: storeError } = await supabase
      .from('ml_predictions')
      .insert({
        game_id: gameId,
        model_name: 'ensemble_v2',
        prediction_type: 'game_outcome',
        prediction: prediction.homeWinProbability,
        confidence: prediction.confidence,
        metadata: {
          predicted_winner: prediction.homeWinProbability > 0.5 ? 'home' : 'away',
          home_win_probability: prediction.homeWinProbability,
          features: features,
          model_predictions: prediction.modelPredictions,
          top_factors: prediction.topFactors
        },
        created_at: new Date().toISOString()
      })
      .select()
      .single();
    
    if (storeError) {
      console.error('Failed to store prediction:', storeError);
    }
    
    return NextResponse.json({
      prediction: formatPrediction(stored || {
        game_id: gameId,
        prediction: prediction.homeWinProbability,
        confidence: prediction.confidence,
        metadata: {
          predicted_winner: prediction.homeWinProbability > 0.5 ? 'home' : 'away',
          home_win_probability: prediction.homeWinProbability,
          model_predictions: prediction.modelPredictions,
          top_factors: prediction.topFactors
        }
      }, game),
      cached: false
    });
    
  } catch (error) {
    console.error('Prediction error:', error);
    return NextResponse.json(
      { error: 'Failed to generate prediction' },
      { status: 500 }
    );
  }
}

function formatPrediction(pred: any, game: any) {
  const metadata = pred.metadata || {};
  
  return {
    id: pred.id,
    gameId: pred.game_id,
    sport: game.sport_id,
    startTime: game.start_time,
    venue: game.venue,
    homeTeam: {
      id: game.home_team.id,
      name: game.home_team.name,
      abbreviation: game.home_team.abbreviation,
      logoUrl: game.home_team.logo_url
    },
    awayTeam: {
      id: game.away_team.id,
      name: game.away_team.name,
      abbreviation: game.away_team.abbreviation,
      logoUrl: game.away_team.logo_url
    },
    prediction: {
      winner: metadata.predicted_winner || (metadata.home_win_probability > 0.5 ? 'home' : 'away'),
      homeWinProbability: metadata.home_win_probability || pred.prediction,
      confidence: pred.confidence,
      models: metadata.model_predictions || {}
    },
    insights: {
      topFactors: metadata.top_factors || [],
      analysis: generateAnalysis(metadata, game)
    },
    lastUpdated: pred.created_at || new Date().toISOString()
  };
}

function generateAnalysis(metadata: any, game: any): string {
  const confidence = metadata.confidence || 0.5;
  const winner = metadata.predicted_winner === 'home' ? game.home_team.name : game.away_team.name;
  
  if (confidence > 0.8) {
    return `Strong confidence in ${winner} victory. Key factors align favorably.`;
  } else if (confidence > 0.65) {
    return `${winner} has a solid advantage in this matchup.`;
  } else {
    return `Close game expected. Slight edge to ${winner}.`;
  }
}

async function extractGameFeatures(game: any): Promise<any> {
  // Simplified feature extraction for demo
  return {
    homeWinRate: 0.55,
    awayWinRate: 0.45,
    winRateDiff: 0.1,
    homeAvgPointsFor: 1.1,
    awayAvgPointsFor: 0.95,
    homeAvgPointsAgainst: 0.9,
    awayAvgPointsAgainst: 1.05,
    homeLast5Form: 0.6,
    awayLast5Form: 0.4,
    homeHomeWinRate: 0.65,
    awayAwayWinRate: 0.35,
    homeTopPlayerAvg: 0.7,
    awayTopPlayerAvg: 0.6,
    homeStarActive: true,
    awayStarActive: true,
    homeAvgFantasy: 1.2,
    awayAvgFantasy: 1.0,
    homeInjuryCount: 0.1,
    awayInjuryCount: 0.2,
    homeFormTrend: 0.1,
    awayFormTrend: -0.1,
    seasonProgress: 0.5,
    isWeekend: new Date(game.start_time).getDay() % 6 === 0,
    isHoliday: false,
    attendanceNormalized: 0.7,
    hasVenue: !!game.venue,
    h2hWinRate: 0.5,
    h2hPointDiff: 0,
    homeStreak: 0,
    awayStreak: 0
  };
}
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const gameId = searchParams.get('game_id');
    const sport = searchParams.get('sport');
    const date = searchParams.get('date');
    
    // Build query
    let query = supabase
      .from('ml_predictions')
      .select(`
        *,
        games!inner(
          id,
          home_team_id,
          away_team_id,
          start_time,
          sport_id,
          home_team:teams!games_home_team_id_fkey(name, logo_url),
          away_team:teams!games_away_team_id_fkey(name, logo_url)
        )
      `)
      .eq('model_name', 'ensemble_v2')
      .order('created_at', { ascending: false });
    
    // Add filters
    if (gameId) {
      query = query.eq('game_id', gameId);
    }
    
    if (sport) {
      query = query.eq('games.sport_id', sport);
    }
    
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      
      query = query
        .gte('games.start_time', startOfDay.toISOString())
        .lte('games.start_time', endOfDay.toISOString());
    }
    
    const { data, error } = await query.limit(50);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    // Format predictions for mobile app
    const predictions = data?.map(pred => ({
      id: pred.id,
      gameId: pred.game_id,
      prediction: {
        winner: pred.metadata?.predicted_winner || 'unknown',
        homeWinProbability: parseFloat(pred.prediction),
        awayWinProbability: 1 - parseFloat(pred.prediction),
        confidence: pred.confidence,
        models: pred.metadata?.model_predictions || {},
        topFactors: pred.metadata?.top_factors || []
      },
      game: {
        id: pred.games.id,
        startTime: pred.games.start_time,
        sport: pred.games.sport_id,
        homeTeam: {
          id: pred.games.home_team_id,
          name: pred.games.home_team?.name || 'Unknown',
          logo: pred.games.home_team?.logo_url
        },
        awayTeam: {
          id: pred.games.away_team_id,
          name: pred.games.away_team?.name || 'Unknown',
          logo: pred.games.away_team?.logo_url
        }
      },
      createdAt: pred.created_at
    })) || [];
    
    return NextResponse.json({
      predictions,
      count: predictions.length,
      modelInfo: {
        name: 'ensemble_v2',
        accuracy: 0.51, // From CLAUDE.md
        models: ['neural_network', 'random_forest']
      }
    });
    
  } catch (error) {
    console.error('Predictions API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch predictions' },
      { status: 500 }
    );
  }
}

// POST endpoint to track prediction outcomes
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { predictionId, actualOutcome, gameId } = body;
    
    if (!predictionId || !actualOutcome) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Get the original prediction
    const { data: prediction } = await supabase
      .from('ml_predictions')
      .select('*')
      .eq('id', predictionId)
      .single();
    
    if (!prediction) {
      return NextResponse.json(
        { error: 'Prediction not found' },
        { status: 404 }
      );
    }
    
    // Calculate if prediction was correct
    const predictedWinner = prediction.metadata?.predicted_winner;
    const isCorrect = predictedWinner === actualOutcome;
    
    // Store outcome for continuous learning
    const { error } = await supabase
      .from('ml_outcomes')
      .insert({
        prediction_id: predictionId,
        game_id: gameId || prediction.game_id,
        model_name: prediction.model_name,
        prediction_type: prediction.prediction_type,
        predicted_value: { winner: predictedWinner },
        actual_value: { winner: actualOutcome },
        accuracy_score: isCorrect ? 1 : 0,
        metadata: {
          confidence: prediction.confidence,
          models: prediction.metadata?.model_predictions
        }
      });
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    return NextResponse.json({
      success: true,
      correct: isCorrect,
      confidence: prediction.confidence
    });
    
  } catch (error) {
    console.error('Prediction outcome error:', error);
    return NextResponse.json(
      { error: 'Failed to record outcome' },
      { status: 500 }
    );
  }
}
/**
 * 📊 STATISTICS API
 * 
 * Model performance and prediction statistics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const period = searchParams.get('period') || 'week';
    const sport = searchParams.get('sport') || 'all';
    
    // Calculate date range
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'day':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'week':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
      case 'season':
        startDate.setMonth(startDate.getMonth() - 6);
        break;
    }
    
    // Get predictions with outcomes
    let query = supabase
      .from('ml_predictions')
      .select(`
        *,
        games!inner(
          id,
          sport_id,
          status,
          home_score,
          away_score,
          home_team:teams!games_home_team_id_fkey(name),
          away_team:teams!games_away_team_id_fkey(name)
        )
      `)
      .eq('model_name', 'ensemble_v2')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());
    
    if (sport !== 'all') {
      query = query.eq('games.sport_id', sport);
    }
    
    const { data: predictions, error } = await query;
    
    if (error) throw error;
    
    // Calculate statistics
    const stats = {
      overall: {
        total: 0,
        completed: 0,
        correct: 0,
        accuracy: 0,
        avgConfidence: 0,
        highConfidenceAccuracy: 0
      },
      byConfidence: {
        high: { total: 0, correct: 0, accuracy: 0 },
        medium: { total: 0, correct: 0, accuracy: 0 },
        low: { total: 0, correct: 0, accuracy: 0 }
      },
      bySport: {} as Record<string, any>,
      recentForm: [] as any[],
      topTeams: [] as any[],
      modelPerformance: {
        neuralNetwork: { accuracy: 0, predictions: 0 },
        randomForest: { accuracy: 0, predictions: 0 },
        ensemble: { accuracy: 0, predictions: 0 }
      }
    };
    
    let totalConfidence = 0;
    const teamStats = new Map<string, { predicted: number, correct: number }>();
    
    predictions?.forEach(pred => {
      const game = pred.games as any;
      const metadata = pred.metadata as any;
      
      stats.overall.total++;
      totalConfidence += pred.confidence;
      
      // Check if game is completed
      if (game.status === 'completed' && game.home_score !== null && game.away_score !== null) {
        stats.overall.completed++;
        
        const actualWinner = game.home_score > game.away_score ? 'home' : 'away';
        const predictedWinner = metadata.predicted_winner || 
          (metadata.home_win_probability > 0.5 ? 'home' : 'away');
        
        const correct = actualWinner === predictedWinner;
        if (correct) stats.overall.correct++;
        
        // By confidence level
        if (pred.confidence > 0.75) {
          stats.byConfidence.high.total++;
          if (correct) stats.byConfidence.high.correct++;
        } else if (pred.confidence > 0.6) {
          stats.byConfidence.medium.total++;
          if (correct) stats.byConfidence.medium.correct++;
        } else {
          stats.byConfidence.low.total++;
          if (correct) stats.byConfidence.low.correct++;
        }
        
        // By sport
        if (!stats.bySport[game.sport_id]) {
          stats.bySport[game.sport_id] = { total: 0, correct: 0, accuracy: 0 };
        }
        stats.bySport[game.sport_id].total++;
        if (correct) stats.bySport[game.sport_id].correct++;
        
        // Track team performance
        const winnerTeam = predictedWinner === 'home' ? game.home_team.name : game.away_team.name;
        if (!teamStats.has(winnerTeam)) {
          teamStats.set(winnerTeam, { predicted: 0, correct: 0 });
        }
        const teamStat = teamStats.get(winnerTeam)!;
        teamStat.predicted++;
        if (correct) teamStat.correct++;
      }
    });
    
    // Calculate accuracies
    if (stats.overall.completed > 0) {
      stats.overall.accuracy = stats.overall.correct / stats.overall.completed;
    }
    
    if (stats.overall.total > 0) {
      stats.overall.avgConfidence = totalConfidence / stats.overall.total;
    }
    
    // Confidence level accuracies
    Object.keys(stats.byConfidence).forEach(level => {
      const conf = stats.byConfidence[level as keyof typeof stats.byConfidence];
      if (conf.total > 0) {
        conf.accuracy = conf.correct / conf.total;
      }
    });
    
    // Sport accuracies
    Object.keys(stats.bySport).forEach(sport => {
      const sportStat = stats.bySport[sport];
      if (sportStat.total > 0) {
        sportStat.accuracy = sportStat.correct / sportStat.total;
      }
    });
    
    // Top performing teams
    stats.topTeams = Array.from(teamStats.entries())
      .map(([team, stat]) => ({
        team,
        predictions: stat.predicted,
        accuracy: stat.predicted > 0 ? stat.correct / stat.predicted : 0
      }))
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 10);
    
    // Recent form (last 20 predictions)
    const recentCompleted = predictions
      ?.filter(p => {
        const g = p.games as any;
        return g.status === 'completed' && g.home_score !== null;
      })
      .slice(0, 20);
    
    let recentCorrect = 0;
    stats.recentForm = recentCompleted?.map(pred => {
      const game = pred.games as any;
      const metadata = pred.metadata as any;
      const actualWinner = game.home_score > game.away_score ? 'home' : 'away';
      const predictedWinner = metadata.predicted_winner || 
        (metadata.home_win_probability > 0.5 ? 'home' : 'away');
      const correct = actualWinner === predictedWinner;
      if (correct) recentCorrect++;
      return correct ? 1 : 0;
    }) || [];
    
    // Add summary
    const summary = {
      period,
      sport,
      dateRange: {
        start: startDate.toISOString(),
        end: endDate.toISOString()
      },
      highlights: {
        bestAccuracy: Math.max(
          stats.byConfidence.high.accuracy,
          stats.byConfidence.medium.accuracy,
          stats.byConfidence.low.accuracy
        ),
        totalPredictions: stats.overall.total,
        completionRate: stats.overall.total > 0 ? stats.overall.completed / stats.overall.total : 0,
        recentFormAccuracy: stats.recentForm.length > 0 ? recentCorrect / stats.recentForm.length : 0
      }
    };
    
    return NextResponse.json({
      stats,
      summary,
      generatedAt: new Date().toISOString()
    });
    
  } catch (error) {
    console.error('Stats API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch statistics' },
      { status: 500 }
    );
  }
}
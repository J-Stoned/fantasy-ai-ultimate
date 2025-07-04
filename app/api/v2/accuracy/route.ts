import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest) {
  try {
    // Get completed games with predictions
    const { data: completedGames } = await supabase
      .from('games')
      .select(`
        id,
        home_score,
        away_score,
        home_team:teams!games_home_team_id_fkey(name),
        away_team:teams!games_away_team_id_fkey(name)
      `)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(500);

    if (!completedGames || completedGames.length === 0) {
      return NextResponse.json({
        overall: { total: 0, correct: 0, accuracy: 0 },
        byConfidence: {},
        recentTrend: [],
        message: 'No completed games found'
      });
    }

    // Get predictions for these games
    const gameIds = completedGames.map(g => g.id);
    const { data: predictions } = await supabase
      .from('ml_predictions')
      .select('*')
      .in('game_id', gameIds)
      .eq('model_name', 'turbo_v1');

    if (!predictions || predictions.length === 0) {
      return NextResponse.json({
        overall: { total: 0, correct: 0, accuracy: 0 },
        byConfidence: {},
        recentTrend: [],
        message: 'No predictions found for completed games'
      });
    }

    // Calculate accuracy
    let totalCorrect = 0;
    let totalPredictions = 0;
    const byConfidence: any = {
      high: { total: 0, correct: 0, accuracy: 0 },
      medium: { total: 0, correct: 0, accuracy: 0 },
      low: { total: 0, correct: 0, accuracy: 0 }
    };
    const recentResults: boolean[] = [];
    const teamStats = new Map<string, { total: number; correct: number }>();

    for (const game of completedGames) {
      const gamePreds = predictions.filter(p => p.game_id === game.id);
      if (gamePreds.length === 0) continue;

      const actualWinner = game.home_score > game.away_score ? 'home' : 'away';
      
      for (const pred of gamePreds) {
        totalPredictions++;
        
        // Determine predicted winner
        let predictedWinner = 'away'; // default
        if (pred.metadata?.predicted_winner) {
          predictedWinner = pred.metadata.predicted_winner;
        } else if (pred.prediction && parseFloat(pred.prediction) > 0.5) {
          predictedWinner = 'home';
        }

        const isCorrect = predictedWinner === actualWinner;
        if (isCorrect) totalCorrect++;
        
        recentResults.push(isCorrect);
        
        // Track by confidence
        const confidence = pred.confidence * 100;
        if (confidence > 70) {
          byConfidence.high.total++;
          if (isCorrect) byConfidence.high.correct++;
        } else if (confidence > 60) {
          byConfidence.medium.total++;
          if (isCorrect) byConfidence.medium.correct++;
        } else {
          byConfidence.low.total++;
          if (isCorrect) byConfidence.low.correct++;
        }

        // Track by team
        const homeTeam = game.home_team?.name || 'Unknown';
        const awayTeam = game.away_team?.name || 'Unknown';
        
        [homeTeam, awayTeam].forEach(team => {
          const stats = teamStats.get(team) || { total: 0, correct: 0 };
          stats.total++;
          if (isCorrect) stats.correct++;
          teamStats.set(team, stats);
        });
      }
    }

    // Calculate accuracies
    const overallAccuracy = totalPredictions > 0 ? (totalCorrect / totalPredictions) * 100 : 0;
    
    Object.keys(byConfidence).forEach(level => {
      const stats = byConfidence[level];
      stats.accuracy = stats.total > 0 ? (stats.correct / stats.total) * 100 : 0;
    });

    // Get top teams by accuracy
    const topTeams = Array.from(teamStats.entries())
      .filter(([_, stats]) => stats.total >= 5)
      .map(([team, stats]) => ({
        team,
        total: stats.total,
        correct: stats.correct,
        accuracy: (stats.correct / stats.total) * 100
      }))
      .sort((a, b) => b.accuracy - a.accuracy)
      .slice(0, 10);

    // Recent trend (last 50)
    const recentTrend = recentResults.slice(-50);
    const recentAccuracy = recentTrend.length > 0
      ? (recentTrend.filter(r => r).length / recentTrend.length) * 100
      : 0;

    return NextResponse.json({
      overall: {
        total: totalPredictions,
        correct: totalCorrect,
        accuracy: overallAccuracy
      },
      byConfidence,
      recentTrend: {
        results: recentTrend,
        accuracy: recentAccuracy,
        count: recentTrend.length
      },
      topTeams,
      lastUpdated: new Date().toISOString()
    });

  } catch (error) {
    console.error('Accuracy API error:', error);
    return NextResponse.json({
      error: 'Failed to calculate accuracy',
      overall: { total: 0, correct: 0, accuracy: 0 }
    }, { status: 500 });
  }
}
#!/usr/bin/env tsx
/**
 * 📊 ACCURACY TRACKING SERVICE
 * Tracks how accurate our predictions actually are!
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import chalk from 'chalk';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface AccuracyStats {
  totalPredictions: number;
  correctPredictions: number;
  accuracy: number;
  byConfidence: {
    high: { total: number; correct: number; accuracy: number };
    medium: { total: number; correct: number; accuracy: number };
    low: { total: number; correct: number; accuracy: number };
  };
  byTeam: Map<string, { total: number; correct: number; accuracy: number }>;
  recentTrend: number[]; // Last 100 predictions accuracy
}

class AccuracyTracker {
  private stats: AccuracyStats = {
    totalPredictions: 0,
    correctPredictions: 0,
    accuracy: 0,
    byConfidence: {
      high: { total: 0, correct: 0, accuracy: 0 },
      medium: { total: 0, correct: 0, accuracy: 0 },
      low: { total: 0, correct: 0, accuracy: 0 }
    },
    byTeam: new Map(),
    recentTrend: []
  };

  async initialize() {
    console.log(chalk.bold.cyan('\n📊 ACCURACY TRACKING SERVICE STARTED\n'));
    
    // Load historical accuracy
    await this.loadHistoricalAccuracy();
    
    // Start tracking
    this.startTracking();
  }

  async loadHistoricalAccuracy() {
    console.log(chalk.yellow('Loading historical accuracy data...'));
    
    // Get completed games with predictions
    const { data: completedGames } = await supabase
      .from('games')
      .select(`
        id,
        home_team_id,
        away_team_id,
        home_score,
        away_score,
        home_team:teams!games_home_team_id_fkey(name),
        away_team:teams!games_away_team_id_fkey(name)
      `)
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(1000);

    if (!completedGames || completedGames.length === 0) {
      console.log(chalk.gray('No completed games found'));
      return;
    }

    // Get predictions for these games
    const gameIds = completedGames.map(g => g.id);
    const { data: predictions } = await supabase
      .from('ml_predictions')
      .select('*')
      .in('game_id', gameIds);

    if (!predictions || predictions.length === 0) {
      console.log(chalk.gray('No predictions found for completed games'));
      return;
    }

    // Calculate accuracy
    let correct = 0;
    let total = 0;

    for (const game of completedGames) {
      const gamePredictions = predictions.filter(p => p.game_id === game.id);
      if (gamePredictions.length === 0) continue;

      const actualWinner = game.home_score > game.away_score ? 'home' : 'away';
      
      for (const pred of gamePredictions) {
        total++;
        
        // Parse prediction
        let predictedWinner = pred.prediction;
        if (pred.metadata?.predicted_winner) {
          predictedWinner = pred.metadata.predicted_winner;
        } else if (parseFloat(pred.prediction) > 0.5) {
          predictedWinner = 'home';
        } else {
          predictedWinner = 'away';
        }

        if (predictedWinner === actualWinner) {
          correct++;
        }

        // Update team stats
        const homeTeam = game.home_team?.name || 'Unknown';
        const awayTeam = game.away_team?.name || 'Unknown';
        
        this.updateTeamStats(homeTeam, predictedWinner === actualWinner);
        this.updateTeamStats(awayTeam, predictedWinner === actualWinner);

        // Update confidence stats
        const confidence = pred.confidence * 100;
        if (confidence > 70) {
          this.stats.byConfidence.high.total++;
          if (predictedWinner === actualWinner) {
            this.stats.byConfidence.high.correct++;
          }
        } else if (confidence > 60) {
          this.stats.byConfidence.medium.total++;
          if (predictedWinner === actualWinner) {
            this.stats.byConfidence.medium.correct++;
          }
        } else {
          this.stats.byConfidence.low.total++;
          if (predictedWinner === actualWinner) {
            this.stats.byConfidence.low.correct++;
          }
        }
      }
    }

    this.stats.totalPredictions = total;
    this.stats.correctPredictions = correct;
    this.stats.accuracy = total > 0 ? (correct / total) * 100 : 0;

    // Calculate confidence accuracies
    const conf = this.stats.byConfidence;
    conf.high.accuracy = conf.high.total > 0 ? (conf.high.correct / conf.high.total) * 100 : 0;
    conf.medium.accuracy = conf.medium.total > 0 ? (conf.medium.correct / conf.medium.total) * 100 : 0;
    conf.low.accuracy = conf.low.total > 0 ? (conf.low.correct / conf.low.total) * 100 : 0;

    this.displayStats();
  }

  updateTeamStats(teamName: string, correct: boolean) {
    const current = this.stats.byTeam.get(teamName) || { total: 0, correct: 0, accuracy: 0 };
    current.total++;
    if (correct) current.correct++;
    current.accuracy = (current.correct / current.total) * 100;
    this.stats.byTeam.set(teamName, current);
  }

  displayStats() {
    console.log(chalk.bold.green('\n📊 ACCURACY STATISTICS:'));
    console.log(chalk.gray('─'.repeat(50)));
    
    console.log(chalk.yellow('\n🎯 Overall Accuracy:'));
    console.log(`   Total Predictions: ${chalk.cyan(this.stats.totalPredictions)}`);
    console.log(`   Correct: ${chalk.green(this.stats.correctPredictions)}`);
    console.log(`   Accuracy: ${chalk.bold(this.stats.accuracy.toFixed(1) + '%')}`);
    
    console.log(chalk.yellow('\n📈 By Confidence Level:'));
    const conf = this.stats.byConfidence;
    console.log(`   High (>70%): ${chalk.green(conf.high.accuracy.toFixed(1) + '%')} (${conf.high.correct}/${conf.high.total})`);
    console.log(`   Medium (60-70%): ${chalk.yellow(conf.medium.accuracy.toFixed(1) + '%')} (${conf.medium.correct}/${conf.medium.total})`);
    console.log(`   Low (<60%): ${chalk.red(conf.low.accuracy.toFixed(1) + '%')} (${conf.low.correct}/${conf.low.total})`);
    
    console.log(chalk.yellow('\n🏀 Top 5 Teams (Best Prediction Accuracy):'));
    const sortedTeams = Array.from(this.stats.byTeam.entries())
      .filter(([_, stats]) => stats.total >= 5) // Min 5 predictions
      .sort((a, b) => b[1].accuracy - a[1].accuracy)
      .slice(0, 5);
    
    sortedTeams.forEach(([team, stats], i) => {
      console.log(`   ${i + 1}. ${team}: ${stats.accuracy.toFixed(1)}% (${stats.correct}/${stats.total})`);
    });
    
    console.log(chalk.gray('\n─'.repeat(50)));
  }

  async startTracking() {
    console.log(chalk.cyan('\n⏰ Starting real-time accuracy tracking...'));
    
    // Check for newly completed games every 5 minutes
    setInterval(async () => {
      await this.checkNewResults();
    }, 5 * 60 * 1000);
    
    // Initial check
    await this.checkNewResults();
  }

  async checkNewResults() {
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString();
    
    // Get recently completed games
    const { data: recentGames } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .gte('updated_at', fiveMinutesAgo);
    
    if (recentGames && recentGames.length > 0) {
      console.log(chalk.green(`\n✅ Found ${recentGames.length} newly completed games`));
      
      for (const game of recentGames) {
        await this.evaluatePrediction(game);
      }
      
      this.displayStats();
    }
  }

  async evaluatePrediction(game: any) {
    // Get predictions for this game
    const { data: predictions } = await supabase
      .from('ml_predictions')
      .select('*')
      .eq('game_id', game.id);
    
    if (!predictions || predictions.length === 0) return;
    
    const actualWinner = game.home_score > game.away_score ? 'home' : 'away';
    
    for (const pred of predictions) {
      const predictedWinner = pred.metadata?.predicted_winner || 
        (parseFloat(pred.prediction) > 0.5 ? 'home' : 'away');
      
      const correct = predictedWinner === actualWinner;
      
      // Update overall stats
      this.stats.totalPredictions++;
      if (correct) this.stats.correctPredictions++;
      this.stats.accuracy = (this.stats.correctPredictions / this.stats.totalPredictions) * 100;
      
      // Update recent trend
      this.stats.recentTrend.push(correct ? 1 : 0);
      if (this.stats.recentTrend.length > 100) {
        this.stats.recentTrend.shift();
      }
      
      console.log(chalk.gray(`   Game ${game.id}: ${correct ? '✅ Correct' : '❌ Wrong'} (predicted ${predictedWinner}, actual ${actualWinner})`));
    }
  }

  getStats() {
    return {
      ...this.stats,
      recentAccuracy: this.stats.recentTrend.length > 0
        ? (this.stats.recentTrend.reduce((a, b) => a + b, 0) / this.stats.recentTrend.length) * 100
        : 0
    };
  }
}

// Start the service
const tracker = new AccuracyTracker();
tracker.initialize().catch(console.error);

// Export for API use
export { tracker };
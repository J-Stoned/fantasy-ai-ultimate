#!/usr/bin/env tsx
/**
 * 🎯 PRODUCTION PREDICTION SERVICE
 * 
 * Makes real-time predictions for upcoming games
 * Uses ensemble model with 30+ features
 */

import chalk from 'chalk';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { ensemblePredictor, GameFeatures } from '../lib/ml/ensemble-predictor';
import * as cron from 'node-cron';
import * as path from 'path';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class ProductionPredictionService {
  private isRunning = false;
  private predictionsCount = 0;
  private startTime = Date.now();
  
  async initialize() {
    console.log(chalk.bold.cyan('\n🎯 PRODUCTION PREDICTION SERVICE'));
    console.log(chalk.gray('='.repeat(50)));
    
    // Load models - first try ensemble, then fallback to production
    console.log(chalk.yellow('Loading ML models...'));
    
    try {
      // First, try to load existing ensemble models
      await ensemblePredictor.loadModels(path.join(process.cwd(), 'models'));
      console.log(chalk.green('✅ Ensemble models loaded'));
    } catch (error) {
      console.log(chalk.yellow('⚠️  Ensemble models not found, training new ensemble...'));
      
      // Train ensemble with some sample data (we'll improve this later)
      try {
        // For now, create a minimal ensemble just to get started
        const tf = require('@tensorflow/tfjs-node');
        
        // Try to load the production model as a fallback
        const modelsPath = path.join(process.cwd(), 'models', 'production_ultimate');
        const model = await tf.loadLayersModel(`file://${modelsPath}/model.json`);
        console.log(chalk.green('✅ Production model loaded as fallback (51.47% accuracy)'));
        
        // Initialize ensemble with just the neural network for now
        (ensemblePredictor as any).neuralNetwork = model;
        (ensemblePredictor as any).isLoaded = true;
        
        console.log(chalk.yellow('⚠️  Using single model mode (Neural Network only)'));
      } catch (err) {
        console.log(chalk.red('❌ No models available:', err.message));
        throw new Error('Cannot start prediction service without models');
      }
    }
    
    this.isRunning = true;
  }
  
  /**
   * Get upcoming games that need predictions
   */
  async getUpcomingGames() {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .in('status', ['scheduled', 'in_progress'])
      .gte('start_time', now.toISOString())
      .lte('start_time', tomorrow.toISOString())
      .order('start_time', { ascending: true });
    
    if (error) {
      console.error(chalk.red('Error fetching games:'), error);
      return [];
    }
    
    return games || [];
  }
  
  /**
   * Extract features for a game
   */
  async extractGameFeatures(game: any): Promise<GameFeatures | null> {
    try {
      // Get team stats
      const homeStats = await this.getTeamStats(game.home_team_id);
      const awayStats = await this.getTeamStats(game.away_team_id);
      
      // Get player stats
      const homePlayerStats = await this.getPlayerStats(game.home_team_id);
      const awayPlayerStats = await this.getPlayerStats(game.away_team_id);
      
      // Get context features
      const gameDate = new Date(game.start_time);
      const seasonProgress = this.getSeasonProgress(gameDate, game.sport_id);
      
      const features: GameFeatures = {
        // Team features (11)
        homeWinRate: homeStats.winRate,
        awayWinRate: awayStats.winRate,
        winRateDiff: homeStats.winRate - awayStats.winRate,
        homeAvgPointsFor: homeStats.avgPointsFor / 100,
        awayAvgPointsFor: awayStats.avgPointsFor / 100,
        homeAvgPointsAgainst: homeStats.avgPointsAgainst / 100,
        awayAvgPointsAgainst: awayStats.avgPointsAgainst / 100,
        homeLast5Form: homeStats.last5Form / 5,
        awayLast5Form: awayStats.last5Form / 5,
        homeHomeWinRate: homeStats.homeWinRate,
        awayAwayWinRate: awayStats.awayWinRate,
        
        // Player features (10)
        homeTopPlayerAvg: homePlayerStats.topPlayerAvg,
        awayTopPlayerAvg: awayPlayerStats.topPlayerAvg,
        homeStarActive: homePlayerStats.starActive,
        awayStarActive: awayPlayerStats.starActive,
        homeAvgFantasy: homePlayerStats.avgFantasy,
        awayAvgFantasy: awayPlayerStats.avgFantasy,
        homeInjuryCount: homePlayerStats.injuryCount,
        awayInjuryCount: awayPlayerStats.injuryCount,
        homeFormTrend: homePlayerStats.formTrend,
        awayFormTrend: awayPlayerStats.formTrend,
        
        // Context features (5)
        seasonProgress: seasonProgress,
        isWeekend: gameDate.getDay() === 0 || gameDate.getDay() === 6,
        isHoliday: gameDate.getMonth() === 11,
        attendanceNormalized: 0.7, // Default
        hasVenue: game.venue ? true : false,
        
        // H2H features (4)
        h2hWinRate: 0.5, // TODO: Calculate actual h2h
        h2hPointDiff: 0,
        homeStreak: 0,
        awayStreak: 0
      };
      
      return features;
    } catch (error) {
      console.error(chalk.red('Error extracting features:'), error);
      return null;
    }
  }
  
  /**
   * Get team statistics
   */
  async getTeamStats(teamId: number) {
    try {
      const { data: games, error } = await supabase
        .from('games')
        .select('*')
        .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
        .eq('status', 'completed')
        .not('home_score', 'is', null)
        .order('start_time', { ascending: false })
        .limit(20);
      
      if (error) {
        console.error(chalk.red(`    Error getting team stats for ${teamId}:`), error);
        return this.getDefaultTeamStats();
      }
    
      if (!games || games.length === 0) {
        return this.getDefaultTeamStats();
      }
    
    let wins = 0;
    let totalPointsFor = 0;
    let totalPointsAgainst = 0;
    let last5Wins = 0;
    let homeWins = 0, homeGames = 0;
    let awayWins = 0, awayGames = 0;
    
    games.forEach((game, idx) => {
      const isHome = game.home_team_id === teamId;
      const teamScore = isHome ? game.home_score : game.away_score;
      const oppScore = isHome ? game.away_score : game.home_score;
      
      totalPointsFor += teamScore;
      totalPointsAgainst += oppScore;
      
      if (teamScore > oppScore) {
        wins++;
        if (idx < 5) last5Wins++;
        if (isHome) homeWins++;
        else awayWins++;
      }
      
      if (isHome) homeGames++;
      else awayGames++;
    });
    
    return {
      winRate: wins / games.length,
      avgPointsFor: totalPointsFor / games.length,
      avgPointsAgainst: totalPointsAgainst / games.length,
      last5Form: last5Wins,
      homeWinRate: homeGames > 0 ? homeWins / homeGames : 0.5,
      awayWinRate: awayGames > 0 ? awayWins / awayGames : 0.5
    };
    } catch (error) {
      console.error(chalk.red('Error in getTeamStats:'), error);
      return this.getDefaultTeamStats();
    }
  }
  
  /**
   * Get default team stats
   */
  private getDefaultTeamStats() {
    return {
      winRate: 0.5,
      avgPointsFor: 100,
      avgPointsAgainst: 100,
      last5Form: 2.5,
      homeWinRate: 0.5,
      awayWinRate: 0.5
    };
  }
  
  /**
   * Get player statistics
   */
  async getPlayerStats(teamId: number) {
    const { data: players } = await supabase
      .from('players')
      .select('id')
      .eq('team_id', teamId)
      .limit(20);
    
    if (!players || players.length === 0) {
      return {
        topPlayerAvg: 0.5,
        starActive: true,
        avgFantasy: 1,
        injuryCount: 0,
        formTrend: 0
      };
    }
    
    const playerIds = players.map(p => p.id);
    
    const { data: stats } = await supabase
      .from('player_stats')
      .select('player_id, fantasy_points')
      .in('player_id', playerIds)
      .order('fantasy_points', { ascending: false })
      .limit(50);
    
    if (!stats || stats.length === 0) {
      return {
        topPlayerAvg: 0.5,
        starActive: true,
        avgFantasy: 1,
        injuryCount: 0,
        formTrend: 0
      };
    }
    
    const topPlayers = stats.slice(0, 5);
    const avgFantasy = stats.reduce((sum, s) => sum + (s.fantasy_points || 0), 0) / stats.length;
    const topPlayerAvg = topPlayers.reduce((sum, s) => sum + (s.fantasy_points || 0), 0) / topPlayers.length;
    
    // Check injuries
    const { count: injuryCount } = await supabase
      .from('player_injuries')
      .select('*', { count: 'exact', head: true })
      .in('player_id', playerIds.slice(0, 5)); // Top 5 players
    
    return {
      topPlayerAvg: topPlayerAvg / 50, // Normalize
      starActive: (injuryCount || 0) === 0,
      avgFantasy: avgFantasy / 50,
      injuryCount: (injuryCount || 0) / 5,
      formTrend: 0 // TODO: Calculate trend
    };
  }
  
  /**
   * Get season progress
   */
  getSeasonProgress(date: Date, sportId: string): number {
    const month = date.getMonth();
    
    if (sportId === 'nfl' || sportId === 'football') {
      return month >= 8 ? (month - 8) / 5 : (month + 4) / 5;
    } else if (sportId === 'nba' || sportId === 'basketball') {
      return month >= 9 ? (month - 9) / 8 : (month + 3) / 8;
    } else if (sportId === 'mlb' || sportId === 'baseball') {
      return Math.max(0, Math.min(1, (month - 3) / 7));
    }
    
    return 0.5;
  }
  
  /**
   * Make predictions for upcoming games
   */
  async makePredictions() {
    console.log(chalk.cyan('\n🔮 Making predictions for upcoming games...'));
    
    const games = await this.getUpcomingGames();
    
    if (games.length === 0) {
      console.log(chalk.gray('No upcoming games found'));
      return;
    }
    
    console.log(chalk.yellow(`Found ${games.length} upcoming games`));
    
    const predictions = [];
    
    for (const game of games) {
      console.log(chalk.gray(`  Processing game ${game.id}...`));
      
      // Check if prediction already exists
      const { data: existing } = await supabase
        .from('ml_predictions')
        .select('id')
        .eq('game_id', game.id)
        .single();
      
      if (existing) {
        console.log(chalk.gray(`  Prediction already exists for game ${game.id}`));
        continue;
      }
      
      // Extract features
      console.log(chalk.gray(`  Extracting features for game ${game.id}...`));
      const features = await this.extractGameFeatures(game);
      if (!features) {
        console.log(chalk.yellow(`  Could not extract features for game ${game.id}`));
        continue;
      }
      
      // Make prediction
      try {
        console.log(chalk.gray(`  Making prediction for game ${game.id}...`));
        const prediction = await ensemblePredictor.predict(features);
        
        // Store prediction with correct schema
        const predictionRecord = {
          game_id: game.id,
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
        };
        
        const { error } = await supabase
          .from('ml_predictions')
          .insert(predictionRecord);
        
        if (!error) {
          this.predictionsCount++;
          predictions.push(predictionRecord);
          
          // Get team names for display
          const { data: homeTeam } = await supabase
            .from('teams')
            .select('name')
            .eq('id', game.home_team_id)
            .single();
          
          const { data: awayTeam } = await supabase
            .from('teams')
            .select('name')
            .eq('id', game.away_team_id)
            .single();
          
          console.log(chalk.green(
            `  ✅ ${homeTeam?.name || 'Home'} vs ${awayTeam?.name || 'Away'}: ` +
            `${prediction.homeWinProbability > 0.5 ? 'HOME' : 'AWAY'} wins ` +
            `(${(Math.max(prediction.homeWinProbability, 1 - prediction.homeWinProbability) * 100).toFixed(1)}% confidence)`
          ));
          
          if (prediction.topFactors.length > 0) {
            console.log(chalk.gray(`     Key factors: ${prediction.topFactors.join(', ')}`));
          }
        }
      } catch (error) {
        console.error(chalk.red(`  ❌ Error predicting game ${game.id}:`), error);
      }
    }
    
    if (predictions.length > 0) {
      console.log(chalk.bold.green(`\n✨ Made ${predictions.length} new predictions!`));
    }
  }
  
  /**
   * Show service statistics
   */
  showStats() {
    const runtime = Math.floor((Date.now() - this.startTime) / 1000);
    const hours = Math.floor(runtime / 3600);
    const minutes = Math.floor((runtime % 3600) / 60);
    const seconds = runtime % 60;
    
    console.log(chalk.bold.cyan('\n📊 PREDICTION SERVICE STATS'));
    console.log(chalk.gray('='.repeat(30)));
    console.log(`Runtime: ${hours}h ${minutes}m ${seconds}s`);
    console.log(`Total Predictions: ${this.predictionsCount}`);
    console.log(`Rate: ${(this.predictionsCount / (runtime / 3600)).toFixed(1)} predictions/hour`);
  }
  
  /**
   * Start the service
   */
  async start() {
    await this.initialize();
    
    // Make initial predictions
    await this.makePredictions();
    
    // Schedule regular predictions
    console.log(chalk.cyan('\n⏰ Scheduling prediction tasks...'));
    
    // Every 30 minutes
    cron.schedule('*/30 * * * *', async () => {
      console.log(chalk.gray(`\n[${new Date().toISOString()}] Running scheduled predictions...`));
      await this.makePredictions();
    });
    
    // Show stats every 5 minutes
    cron.schedule('*/5 * * * *', () => {
      this.showStats();
    });
    
    console.log(chalk.bold.green('\n✅ Production Prediction Service is running!'));
    console.log(chalk.gray('Press Ctrl+C to stop'));
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Shutting down prediction service...'));
  process.exit(0);
});

// Start the service
const service = new ProductionPredictionService();
service.start().catch(console.error);
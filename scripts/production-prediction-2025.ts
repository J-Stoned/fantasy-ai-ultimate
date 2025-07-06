#!/usr/bin/env tsx
/**
 * 🎯 2025 PRODUCTION PREDICTION SERVICE
 * Using our 61.1% accurate 2025 season model!
 */

import chalk from 'chalk';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { RandomForestClassifier } from 'ml-random-forest';
import * as fs from 'fs';
import * as path from 'path';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class ProductionPrediction2025 {
  private model: RandomForestClassifier | null = null;
  private modelMetadata: any = null;
  private teamStats = new Map();
  private predictionsCount = 0;
  private startTime = Date.now();
  
  async initialize() {
    console.log(chalk.bold.cyan('\n🎯 2025 PRODUCTION PREDICTION SERVICE'));
    console.log(chalk.yellow('Using 61.1% accurate multi-sport model'));
    console.log(chalk.gray('='.repeat(50)));
    
    // Load the 2025 model
    console.log(chalk.yellow('Loading 2025 season model...'));
    
    try {
      const modelPath = path.join(process.cwd(), 'models', '2025-season-model.json');
      const modelData = JSON.parse(fs.readFileSync(modelPath, 'utf8'));
      
      this.model = RandomForestClassifier.load(modelData.model);
      this.modelMetadata = modelData.metadata;
      
      console.log(chalk.green('✅ 2025 season model loaded'));
      console.log(chalk.gray(`   Accuracy: ${(this.modelMetadata.performance.overall.accuracy * 100).toFixed(1)}%`));
      console.log(chalk.gray(`   Sports: ${this.modelMetadata.sports.join(', ')}`));
      console.log(chalk.gray(`   Trained on: ${this.modelMetadata.totalGames} games`));
    } catch (error) {
      console.error(chalk.red('❌ Error loading model:'), error.message);
      throw error;
    }
    
    // Load historical team stats
    await this.loadTeamStats();
  }
  
  async loadTeamStats() {
    console.log(chalk.yellow('Loading team statistics...'));
    
    // Get recent games for stats calculation
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .in('sport_id', ['nba', 'nhl', 'mlb'])
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(1000);
    
    if (!games) return;
    
    // Process games by sport
    const gamesBySport = new Map();
    games.forEach(game => {
      if (!gamesBySport.has(game.sport_id)) {
        gamesBySport.set(game.sport_id, []);
      }
      gamesBySport.get(game.sport_id).push(game);
    });
    
    // Calculate team stats for each sport
    gamesBySport.forEach((sportGames, sport) => {
      const sportStats = new Map();
      
      // Process in chronological order
      sportGames.reverse().forEach(game => {
        [game.home_team_id, game.away_team_id].forEach(teamId => {
          if (!sportStats.has(teamId)) {
            sportStats.set(teamId, {
              games: 0, wins: 0, losses: 0,
              homeGames: 0, homeWins: 0,
              awayGames: 0, awayWins: 0,
              totalFor: 0, totalAgainst: 0,
              last5: [], last10: [],
              streak: 0, momentum: 0.5
            });
          }
        });
        
        const homeStats = sportStats.get(game.home_team_id);
        const awayStats = sportStats.get(game.away_team_id);
        const homeWon = game.home_score > game.away_score;
        
        // Update stats
        homeStats.games++;
        awayStats.games++;
        homeStats.homeGames++;
        awayStats.awayGames++;
        
        if (homeWon) {
          homeStats.wins++;
          homeStats.homeWins++;
          awayStats.losses++;
          homeStats.last5.push(1);
          homeStats.last10.push(1);
          awayStats.last5.push(0);
          awayStats.last10.push(0);
          homeStats.streak = Math.max(1, homeStats.streak + 1);
          awayStats.streak = Math.min(-1, awayStats.streak - 1);
        } else {
          awayStats.wins++;
          awayStats.awayWins++;
          homeStats.losses++;
          homeStats.last5.push(0);
          homeStats.last10.push(0);
          awayStats.last5.push(1);
          awayStats.last10.push(1);
          awayStats.streak = Math.max(1, awayStats.streak + 1);
          homeStats.streak = Math.min(-1, homeStats.streak - 1);
        }
        
        homeStats.totalFor += game.home_score;
        homeStats.totalAgainst += game.away_score;
        awayStats.totalFor += game.away_score;
        awayStats.totalAgainst += game.home_score;
        
        homeStats.momentum = homeStats.momentum * 0.7 + (homeWon ? 1 : 0) * 0.3;
        awayStats.momentum = awayStats.momentum * 0.7 + (homeWon ? 0 : 1) * 0.3;
        
        if (homeStats.last5.length > 5) homeStats.last5.shift();
        if (homeStats.last10.length > 10) homeStats.last10.shift();
        if (awayStats.last5.length > 5) awayStats.last5.shift();
        if (awayStats.last10.length > 10) awayStats.last10.shift();
      });
      
      this.teamStats.set(sport, sportStats);
    });
    
    console.log(chalk.green('✅ Team statistics loaded'));
  }
  
  buildFeatures(game: any, homeStats: any, awayStats: any): number[] {
    const sport = game.sport_id;
    const scoringNorm = sport === 'nba' ? 110 : sport === 'mlb' ? 5 : sport === 'nhl' ? 3 : 50;
    
    // Calculate features (same as training)
    const homeWR = homeStats.wins / Math.max(homeStats.games, 1);
    const awayWR = awayStats.wins / Math.max(awayStats.games, 1);
    
    const homeHomeWR = homeStats.homeGames > 0 ? homeStats.homeWins / homeStats.homeGames : 0.5;
    const awayAwayWR = awayStats.awayGames > 0 ? awayStats.awayWins / awayStats.awayGames : 0.5;
    
    const homeAvgFor = homeStats.totalFor / Math.max(homeStats.games, 1);
    const awayAvgFor = awayStats.totalFor / Math.max(awayStats.games, 1);
    const homeAvgAgainst = homeStats.totalAgainst / Math.max(homeStats.games, 1);
    const awayAvgAgainst = awayStats.totalAgainst / Math.max(awayStats.games, 1);
    
    const homeLast5 = homeStats.last5.slice(-5);
    const awayLast5 = awayStats.last5.slice(-5);
    const homeForm = homeLast5.length > 0 ? homeLast5.reduce((a, b) => a + b, 0) / homeLast5.length : 0.5;
    const awayForm = awayLast5.length > 0 ? awayLast5.reduce((a, b) => a + b, 0) / awayLast5.length : 0.5;
    
    return [
      // Win rate differentials
      homeWR - awayWR,
      homeHomeWR - awayAwayWR,
      
      // Scoring differentials (normalized)
      (homeAvgFor - awayAvgFor) / scoringNorm,
      (awayAvgAgainst - homeAvgAgainst) / scoringNorm,
      
      // Form and momentum
      homeForm - awayForm,
      homeStats.momentum - awayStats.momentum,
      (homeStats.streak - awayStats.streak) / 5,
      
      // Absolute values
      homeWR,
      awayWR,
      homeForm,
      awayForm,
      
      // Scoring patterns
      homeAvgFor / scoringNorm,
      awayAvgFor / scoringNorm,
      homeAvgAgainst / scoringNorm,
      awayAvgAgainst / scoringNorm,
      
      // Head-to-head potential
      homeAvgFor / Math.max(awayAvgAgainst, 1),
      awayAvgFor / Math.max(homeAvgAgainst, 1),
      
      // Sport indicators
      sport === 'nba' ? 1 : 0,
      sport === 'mlb' ? 1 : 0,
      sport === 'nhl' ? 1 : 0,
      
      // Context
      sport === 'nba' ? 0.6 : sport === 'nhl' ? 0.55 : 0.54, // home advantage
      0 // no noise in production
    ];
  }
  
  async getUpcomingGames() {
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 48 * 60 * 60 * 1000); // Next 48 hours
    
    const { data: games, error } = await supabase
      .from('games')
      .select(`
        *,
        home_team:teams!games_home_team_id_fkey(id, name, abbreviation),
        away_team:teams!games_away_team_id_fkey(id, name, abbreviation)
      `)
      .in('sport_id', ['nba', 'nhl', 'mlb']) // Only sports we support
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
  
  async makePredictions() {
    if (!this.model) {
      console.error(chalk.red('Model not loaded!'));
      return;
    }
    
    const games = await this.getUpcomingGames();
    
    if (games.length === 0) {
      console.log(chalk.gray('No upcoming games found'));
      return;
    }
    
    console.log(chalk.cyan(`\n📊 Making predictions for ${games.length} upcoming games...`));
    
    const predictions = [];
    
    for (const game of games) {
      const sportStats = this.teamStats.get(game.sport_id);
      if (!sportStats) {
        console.log(chalk.yellow(`No stats for sport ${game.sport_id}`));
        continue;
      }
      
      const homeStats = sportStats.get(game.home_team_id);
      const awayStats = sportStats.get(game.away_team_id);
      
      if (!homeStats || !awayStats || homeStats.games < 5 || awayStats.games < 5) {
        console.log(chalk.yellow(`Insufficient data for ${game.home_team?.name} vs ${game.away_team?.name}`));
        continue;
      }
      
      // Build features
      const features = this.buildFeatures(game, homeStats, awayStats);
      
      // Make prediction
      const prediction = this.model.predict([features])[0];
      const confidence = 0.611; // Our model accuracy
      
      // Predict scores based on averages
      const homeAvgFor = homeStats.totalFor / homeStats.games;
      const awayAvgFor = awayStats.totalFor / awayStats.games;
      const predictedHomeScore = Math.round(homeAvgFor * (prediction === 1 ? 1.05 : 0.95));
      const predictedAwayScore = Math.round(awayAvgFor * (prediction === 0 ? 1.05 : 0.95));
      
      const predictionData = {
        game_id: game.id,
        model_type: '2025-season',
        predicted_winner: prediction === 1 ? 'home' : 'away',
        home_win_probability: prediction === 1 ? confidence : 1 - confidence,
        predicted_home_score: predictedHomeScore,
        predicted_away_score: predictedAwayScore,
        confidence: confidence,
        features_used: {
          homeWinRate: homeStats.wins / homeStats.games,
          awayWinRate: awayStats.wins / awayStats.games,
          homeForm: homeStats.last5.filter(w => w === 1).length / Math.max(homeStats.last5.length, 1),
          awayForm: awayStats.last5.filter(w => w === 1).length / Math.max(awayStats.last5.length, 1),
          homeStreak: homeStats.streak,
          awayStreak: awayStats.streak
        },
        metadata: {
          sport: game.sport_id,
          modelVersion: '2025-season-v1',
          accuracy: 0.611
        }
      };
      
      predictions.push(predictionData);
      this.predictionsCount++;
      
      // Display prediction
      const winner = prediction === 1 ? game.home_team?.name : game.away_team?.name;
      const prob = (prediction === 1 ? confidence : 1 - confidence) * 100;
      
      console.log(chalk.green(`\n✅ ${game.home_team?.name} vs ${game.away_team?.name}`));
      console.log(chalk.white(`   Sport: ${game.sport_id.toUpperCase()}`));
      console.log(chalk.white(`   Winner: ${winner} (${prob.toFixed(1)}%)`));
      console.log(chalk.white(`   Score: ${predictedHomeScore} - ${predictedAwayScore}`));
      console.log(chalk.gray(`   Time: ${new Date(game.start_time).toLocaleString()}`));
    }
    
    // Save predictions to database
    if (predictions.length > 0) {
      const { error } = await supabase
        .from('ml_predictions')
        .insert(predictions);
      
      if (error) {
        console.error(chalk.red('Error saving predictions:'), error);
      } else {
        console.log(chalk.green(`\n✅ Saved ${predictions.length} predictions to database`));
      }
    }
  }
  
  async run() {
    await this.initialize();
    
    console.log(chalk.cyan('\n🚀 Starting prediction service...'));
    console.log(chalk.gray('Making predictions every 30 minutes'));
    
    // Make initial predictions
    await this.makePredictions();
    
    // Schedule regular predictions
    setInterval(async () => {
      console.log(chalk.gray(`\n[${new Date().toISOString()}] Running scheduled predictions...`));
      await this.makePredictions();
    }, 30 * 60 * 1000); // Every 30 minutes
    
    // Show stats every 5 minutes
    setInterval(() => {
      const runtime = Math.floor((Date.now() - this.startTime) / 1000 / 60);
      console.log(chalk.gray(`\n📊 Stats: ${this.predictionsCount} predictions made | Runtime: ${runtime} minutes`));
    }, 5 * 60 * 1000);
    
    // Keep service running
    console.log(chalk.green('\n✅ Service is running! Press Ctrl+C to stop.'));
  }
}

// Start the service
const service = new ProductionPrediction2025();
service.run().catch(console.error);
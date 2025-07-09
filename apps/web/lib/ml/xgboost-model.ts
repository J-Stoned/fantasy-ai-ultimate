/**
 * 🎯 XGBOOST MODEL IMPLEMENTATION
 * High-performance gradient boosting for sports predictions
 */

import mlXGBoost from 'ml-xgboost';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface XGBoostPrediction {
  homeWinProbability: number;
  awayWinProbability: number;
  drawProbability: number;
  winner: 'home' | 'away' | 'draw';
  confidence: number;
  featureImportance: Record<string, number>;
}

export class XGBoostPredictor {
  private model?: any;
  private featureNames: string[] = [
    'home_avg_score',
    'home_win_rate',
    'home_last_5_avg',
    'home_momentum',
    'home_streak',
    'home_rest_days',
    'away_avg_score',
    'away_win_rate', 
    'away_last_5_avg',
    'away_momentum',
    'away_streak',
    'away_rest_days',
    'head_to_head_home_wins',
    'head_to_head_avg_diff',
    'venue_home_advantage',
    'season_progress',
    'day_of_week',
    'time_of_day',
    'league_position_diff',
    'form_difference'
  ];

  async trainModel(trainingData: any[]) {
    console.log(chalk.bold.cyan('🎯 Training XGBoost Model...'));
    
    // Prepare features and labels
    const features: number[][] = [];
    const labels: number[] = [];
    
    for (const game of trainingData) {
      const extractedFeatures = await this.extractFeatures(game);
      features.push(extractedFeatures);
      
      // Multi-class: 0 = away win, 1 = draw, 2 = home win
      if (game.home_score > game.away_score) {
        labels.push(2);
      } else if (game.home_score === game.away_score) {
        labels.push(1);
      } else {
        labels.push(0);
      }
    }
    
    // Configure XGBoost parameters
    const config = {
      booster: 'gbtree',
      objective: 'multi:softprob',
      num_class: 3,
      max_depth: 6,
      eta: 0.3,
      gamma: 0,
      min_child_weight: 1,
      subsample: 0.8,
      colsample_bytree: 0.8,
      lambda: 1,
      alpha: 0,
      tree_method: 'auto',
      seed: 42,
      nthread: 4,
      silent: 1,
      iterations: 100
    };
    
    // Train model
    this.model = new XGBoost(config);
    
    console.log(chalk.yellow(`Training on ${features.length} samples...`));
    const startTime = Date.now();
    
    await this.model.train(features, labels);
    
    const trainingTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`✅ XGBoost trained in ${trainingTime}s`));
    
    // Calculate feature importance
    const importance = this.model.getFeatureImportance();
    console.log(chalk.yellow('\n📊 Feature Importance:'));
    
    const sortedImportance = Object.entries(importance)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 10);
    
    sortedImportance.forEach(([feature, score], index) => {
      const featureName = this.featureNames[parseInt(feature)] || feature;
      console.log(`  ${index + 1}. ${featureName}: ${((score as number) * 100).toFixed(1)}%`);
    });
    
    return this.model;
  }

  async predict(homeTeamId: string, awayTeamId: string, gameDate: Date): Promise<XGBoostPrediction> {
    if (!this.model) {
      throw new Error('Model not trained');
    }
    
    // Extract features for the game
    const features = await this.extractFeaturesForPrediction(homeTeamId, awayTeamId, gameDate);
    
    // Make prediction
    const probabilities = await this.model.predict([features]);
    const [awayProb, drawProb, homeProb] = probabilities[0];
    
    // Determine winner
    let winner: 'home' | 'away' | 'draw';
    let confidence: number;
    
    if (homeProb > awayProb && homeProb > drawProb) {
      winner = 'home';
      confidence = homeProb;
    } else if (awayProb > homeProb && awayProb > drawProb) {
      winner = 'away';
      confidence = awayProb;
    } else {
      winner = 'draw';
      confidence = drawProb;
    }
    
    // Get feature importance for this prediction
    const featureImportance: Record<string, number> = {};
    const importance = this.model.getFeatureImportance();
    
    Object.entries(importance).forEach(([idx, score]) => {
      const featureName = this.featureNames[parseInt(idx)];
      if (featureName) {
        featureImportance[featureName] = score as number;
      }
    });
    
    return {
      homeWinProbability: homeProb,
      awayWinProbability: awayProb,
      drawProbability: drawProb,
      winner,
      confidence,
      featureImportance
    };
  }

  private async extractFeatures(game: any): Promise<number[]> {
    const [homeStats, awayStats] = await Promise.all([
      this.getTeamStats(game.home_team_id, new Date(game.start_time)),
      this.getTeamStats(game.away_team_id, new Date(game.start_time))
    ]);
    
    const headToHead = await this.getHeadToHead(game.home_team_id, game.away_team_id, new Date(game.start_time));
    
    return [
      homeStats.avgScore,
      homeStats.winRate,
      homeStats.last5Avg,
      homeStats.momentum,
      homeStats.streak,
      homeStats.restDays,
      awayStats.avgScore,
      awayStats.winRate,
      awayStats.last5Avg,
      awayStats.momentum,
      awayStats.streak,
      awayStats.restDays,
      headToHead.homeWins / Math.max(1, headToHead.totalGames),
      headToHead.avgScoreDiff,
      1.0, // Home advantage
      new Date(game.start_time).getMonth() / 11,
      new Date(game.start_time).getDay() / 6,
      new Date(game.start_time).getHours() / 23,
      0, // League position diff (would need standings data)
      homeStats.momentum - awayStats.momentum
    ];
  }

  private async extractFeaturesForPrediction(homeTeamId: string, awayTeamId: string, gameDate: Date): Promise<number[]> {
    const [homeStats, awayStats] = await Promise.all([
      this.getTeamStats(homeTeamId, gameDate),
      this.getTeamStats(awayTeamId, gameDate)
    ]);
    
    const headToHead = await this.getHeadToHead(homeTeamId, awayTeamId, gameDate);
    
    return [
      homeStats.avgScore,
      homeStats.winRate,
      homeStats.last5Avg,
      homeStats.momentum,
      homeStats.streak,
      homeStats.restDays,
      awayStats.avgScore,
      awayStats.winRate,
      awayStats.last5Avg,
      awayStats.momentum,
      awayStats.streak,
      awayStats.restDays,
      headToHead.homeWins / Math.max(1, headToHead.totalGames),
      headToHead.avgScoreDiff,
      1.0,
      gameDate.getMonth() / 11,
      gameDate.getDay() / 6,
      gameDate.getHours() / 23,
      0,
      homeStats.momentum - awayStats.momentum
    ];
  }

  private async getTeamStats(teamId: string, beforeDate: Date) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .lt('start_time', beforeDate.toISOString())
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(20);

    if (!games || games.length === 0) {
      return {
        avgScore: 50,
        winRate: 0.5,
        last5Avg: 50,
        momentum: 0,
        streak: 0,
        restDays: 3
      };
    }

    let totalScore = 0;
    let wins = 0;
    let last5Score = 0;
    let momentum = 0;
    let currentStreak = 0;
    let lastResult = '';

    games.forEach((game, index) => {
      const isHome = game.home_team_id === teamId;
      const teamScore = isHome ? game.home_score : game.away_score;
      const oppScore = isHome ? game.away_score : game.home_score;

      totalScore += teamScore;
      
      const won = teamScore > oppScore;
      if (won) wins++;

      if (index < 5) {
        last5Score += teamScore;
        if (won) momentum += (5 - index) / 15;
      }

      // Calculate streak
      if (index === 0) {
        currentStreak = won ? 1 : -1;
        lastResult = won ? 'W' : 'L';
      } else if ((won && lastResult === 'W') || (!won && lastResult === 'L')) {
        currentStreak = Math.abs(currentStreak) + 1;
        if (!won) currentStreak = -currentStreak;
      }
    });

    // Calculate rest days
    const lastGame = games[0];
    const daysSinceLastGame = Math.floor(
      (beforeDate.getTime() - new Date(lastGame.start_time).getTime()) / (1000 * 60 * 60 * 24)
    );

    return {
      avgScore: totalScore / games.length,
      winRate: wins / games.length,
      last5Avg: last5Score / Math.min(5, games.length),
      momentum,
      streak: currentStreak,
      restDays: Math.min(daysSinceLastGame, 7)
    };
  }

  private async getHeadToHead(homeTeamId: string, awayTeamId: string, beforeDate: Date) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .or(`and(home_team_id.eq.${homeTeamId},away_team_id.eq.${awayTeamId}),and(home_team_id.eq.${awayTeamId},away_team_id.eq.${homeTeamId})`)
      .lt('start_time', beforeDate.toISOString())
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(10);

    if (!games || games.length === 0) {
      return {
        homeWins: 0,
        totalGames: 0,
        avgScoreDiff: 0
      };
    }

    let homeWins = 0;
    let totalScoreDiff = 0;

    games.forEach(game => {
      const isOriginalHome = game.home_team_id === homeTeamId;
      const homeScore = isOriginalHome ? game.home_score : game.away_score;
      const awayScore = isOriginalHome ? game.away_score : game.home_score;
      
      if (homeScore > awayScore) homeWins++;
      totalScoreDiff += (homeScore - awayScore);
    });

    return {
      homeWins,
      totalGames: games.length,
      avgScoreDiff: totalScoreDiff / games.length
    };
  }

  async saveModel(path: string) {
    if (!this.model) throw new Error('No model to save');
    
    const modelData = {
      model: this.model.toJSON(),
      featureNames: this.featureNames,
      version: '1.0',
      trainedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(`${path}.json`, JSON.stringify(modelData, null, 2));
    console.log(chalk.green(`✅ XGBoost model saved to ${path}.json`));
  }

  async loadModel(path: string) {
    const modelData = JSON.parse(fs.readFileSync(`${path}.json`, 'utf-8'));
    this.model = XGBoost.fromJSON(modelData.model);
    this.featureNames = modelData.featureNames;
    console.log(chalk.green(`✅ XGBoost model loaded from ${path}.json`));
  }
}
/**
 * 🧠 LSTM TIME SERIES MODEL
 * Predicts game outcomes based on momentum and trends
 */

import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface TimeSeriesData {
  gameId: string;
  timestamp: Date;
  homeTeamForm: number[]; // Last 10 games [0-1]
  awayTeamForm: number[]; // Last 10 games [0-1]
  headToHead: number[]; // Last 5 H2H results
  momentum: number; // -1 to 1 (negative = away, positive = home)
  streakLength: number;
  daysRest: number;
  injuryImpact: number; // 0-1 (0 = no impact, 1 = major impact)
}

export class LSTMPredictor {
  private model?: tf.LayersModel;
  private sequenceLength = 10; // Look at last 10 games
  private features = 25; // Number of features per timestep
  
  async buildModel() {
    console.log(chalk.bold.cyan('🧠 Building LSTM Model...'));
    
    // Input shape: [batch, timesteps, features]
    const input = tf.input({ shape: [this.sequenceLength, this.features] });
    
    // LSTM layers with dropout for regularization
    const lstm1 = tf.layers.lstm({
      units: 128,
      returnSequences: true,
      dropout: 0.2,
      recurrentDropout: 0.2,
      kernelInitializer: 'glorotUniform'
    }).apply(input);
    
    const lstm2 = tf.layers.lstm({
      units: 64,
      returnSequences: false,
      dropout: 0.2,
      recurrentDropout: 0.2
    }).apply(lstm1);
    
    // Dense layers
    const dense1 = tf.layers.dense({
      units: 32,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.01 })
    }).apply(lstm2);
    
    const dropout = tf.layers.dropout({ rate: 0.3 }).apply(dense1);
    
    const dense2 = tf.layers.dense({
      units: 16,
      activation: 'relu'
    }).apply(dropout);
    
    // Output layer - 3 classes: home win, draw, away win
    const output = tf.layers.dense({
      units: 3,
      activation: 'softmax'
    }).apply(dense2);
    
    this.model = tf.model({
      inputs: input,
      outputs: output as tf.SymbolicTensor
    });
    
    // Use Adam optimizer with fixed learning rate
    // TensorFlow.js doesn't support learning rate schedules directly
    const optimizer = tf.train.adam(0.001);
    
    this.model.compile({
      optimizer,
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    console.log(chalk.green('✅ LSTM Model built'));
    this.model.summary();
  }
  
  async prepareTimeSeriesData(teamId: string, gameDate: Date): Promise<number[][]> {
    // Get last 10 games for the team
    const { data: recentGames } = await supabase
      .from('games')
      .select('*')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .lt('start_time', gameDate.toISOString())
      .order('start_time', { ascending: false })
      .limit(this.sequenceLength);
    
    if (!recentGames || recentGames.length < this.sequenceLength) {
      // Pad with neutral values if not enough history
      return Array(this.sequenceLength).fill(Array(this.features).fill(0.5));
    }
    
    // Build time series features for each game
    const timeSeriesData: number[][] = [];
    
    for (let i = recentGames.length - 1; i >= 0; i--) {
      const game = recentGames[i];
      const isHome = game.home_team_id === teamId;
      
      const features = [
        // Result features (one-hot encoded)
        game.home_score > game.away_score && isHome ? 1 : 0, // Won as home
        game.home_score < game.away_score && !isHome ? 1 : 0, // Won as away
        game.home_score === game.away_score ? 1 : 0, // Draw
        
        // Score differential (normalized)
        (game.home_score - game.away_score) / 10,
        
        // Scoring rate
        (game.home_score + game.away_score) / 100,
        
        // Home/Away
        isHome ? 1 : 0,
        
        // Days since last game (normalized)
        i < recentGames.length - 1 ? 
          Math.min(daysBetween(new Date(game.start_time), new Date(recentGames[i + 1].start_time)) / 7, 1) : 0.5,
        
        // Streak features (calculated from previous games)
        ...this.calculateStreakFeatures(recentGames.slice(i), teamId),
        
        // Opposition strength (would need team ratings)
        0.5, // Placeholder
        
        // Time features
        new Date(game.start_time).getMonth() / 11, // Season progress
        new Date(game.start_time).getDay() / 6, // Day of week
        
        // Venue features
        Math.random(), // Attendance (normalized) - placeholder
        Math.random(), // Weather impact - placeholder
        
        // Momentum (calculated from last 3 games)
        ...this.calculateMomentum(recentGames.slice(Math.max(0, i - 3), i + 1), teamId),
        
        // Pad remaining features
        ...Array(Math.max(0, this.features - 14)).fill(0.5)
      ];
      
      timeSeriesData.push(features.slice(0, this.features));
    }
    
    return timeSeriesData;
  }
  
  calculateStreakFeatures(games: any[], teamId: string): number[] {
    let winStreak = 0;
    let unbeatenStreak = 0;
    
    for (const game of games) {
      const isHome = game.home_team_id === teamId;
      const won = (isHome && game.home_score > game.away_score) || 
                  (!isHome && game.away_score > game.home_score);
      const draw = game.home_score === game.away_score;
      
      if (won) {
        winStreak++;
        unbeatenStreak++;
      } else if (draw) {
        winStreak = 0;
        unbeatenStreak++;
      } else {
        winStreak = 0;
        unbeatenStreak = 0;
      }
    }
    
    return [
      Math.min(winStreak / 5, 1), // Normalized win streak
      Math.min(unbeatenStreak / 10, 1) // Normalized unbeaten streak
    ];
  }
  
  calculateMomentum(recentGames: any[], teamId: string): number[] {
    if (recentGames.length === 0) return [0.5, 0.5, 0.5];
    
    let points = 0;
    let goalsFor = 0;
    let goalsAgainst = 0;
    
    recentGames.forEach(game => {
      const isHome = game.home_team_id === teamId;
      const teamScore = isHome ? game.home_score : game.away_score;
      const oppScore = isHome ? game.away_score : game.home_score;
      
      goalsFor += teamScore;
      goalsAgainst += oppScore;
      
      if (teamScore > oppScore) points += 3;
      else if (teamScore === oppScore) points += 1;
    });
    
    return [
      points / (recentGames.length * 3), // Points ratio
      goalsFor / Math.max(1, goalsFor + goalsAgainst), // Goal share
      Math.min(goalsFor / Math.max(1, recentGames.length) / 3, 1) // Goals per game normalized
    ];
  }
  
  async predict(homeTeamId: string, awayTeamId: string, gameDate: Date) {
    if (!this.model) {
      throw new Error('Model not initialized');
    }
    
    // Prepare time series data for both teams
    const [homeTimeSeries, awayTimeSeries] = await Promise.all([
      this.prepareTimeSeriesData(homeTeamId, gameDate),
      this.prepareTimeSeriesData(awayTeamId, gameDate)
    ]);
    
    // Combine features (you could also concatenate or use attention mechanism)
    const combinedFeatures = homeTimeSeries.map((homeFeatures, i) => {
      const awayFeatures = awayTimeSeries[i];
      return [
        ...homeFeatures.slice(0, 12), // Home team features
        ...awayFeatures.slice(0, 12), // Away team features
        homeFeatures[0] - awayFeatures[0] // Differential
      ];
    });
    
    // Make prediction
    const inputTensor = tf.tensor3d([combinedFeatures]);
    const prediction = this.model.predict(inputTensor) as tf.Tensor;
    const probabilities = await prediction.data();
    
    inputTensor.dispose();
    prediction.dispose();
    
    const [homeWinProb, drawProb, awayWinProb] = probabilities;
    
    return {
      homeWinProbability: homeWinProb,
      drawProbability: drawProb,
      awayWinProbability: awayWinProb,
      prediction: homeWinProb > awayWinProb ? 'home' : 'away',
      confidence: Math.max(homeWinProb, awayWinProb),
      momentum: {
        home: this.calculateMomentumScore(homeTimeSeries),
        away: this.calculateMomentumScore(awayTimeSeries)
      }
    };
  }
  
  calculateMomentumScore(timeSeries: number[][]): number {
    // Calculate trend in recent performance
    const recentForm = timeSeries.slice(-3).map(features => features[0] + features[1]); // Wins
    const trend = recentForm.reduce((sum, val, i) => sum + val * (i + 1), 0) / 6; // Weighted recent
    return trend;
  }
  
  async trainModel(trainingData: any[], validationSplit = 0.2) {
    if (!this.model) {
      throw new Error('Model not built');
    }
    
    console.log(chalk.yellow(`Training LSTM on ${trainingData.length} samples...`));
    
    // Prepare training tensors
    const features: number[][][] = [];
    const labels: number[][] = [];
    
    for (const sample of trainingData) {
      const timeSeries = await this.prepareTimeSeriesData(
        sample.homeTeamId,
        new Date(sample.gameDate)
      );
      features.push(timeSeries);
      
      // One-hot encode the result
      const label = [0, 0, 0];
      if (sample.homeScore > sample.awayScore) label[0] = 1;
      else if (sample.homeScore === sample.awayScore) label[1] = 1;
      else label[2] = 1;
      
      labels.push(label);
    }
    
    const xTrain = tf.tensor3d(features);
    const yTrain = tf.tensor2d(labels);
    
    // Train with callbacks
    const history = await this.model.fit(xTrain, yTrain, {
      epochs: 50,
      batchSize: 32,
      validationSplit,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(chalk.gray(`Epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`));
          }
        }
      }
    });
    
    xTrain.dispose();
    yTrain.dispose();
    
    console.log(chalk.green('✅ LSTM training complete'));
    return history;
  }
  
  async saveModel(path: string) {
    if (!this.model) throw new Error('No model to save');
    await this.model.save(`file://${path}`);
    console.log(chalk.green(`✅ Model saved to ${path}`));
  }
  
  async loadModel(path: string) {
    this.model = await tf.loadLayersModel(`file://${path}/model.json`);
    console.log(chalk.green(`✅ Model loaded from ${path}`));
  }
}

// Helper function
function daysBetween(date1: Date, date2: Date): number {
  return Math.abs(date1.getTime() - date2.getTime()) / (1000 * 60 * 60 * 24);
}
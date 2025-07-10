#!/usr/bin/env tsx
/**
 * 🎯 TRAIN ACTUALLY UNBIASED MODEL
 * 
 * This time we'll train a model that ACTUALLY doesn't favor home teams
 * by using a different approach - logistic regression with explicit bias penalty
 */

import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as fs from 'fs';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Simple logistic regression implementation
class LogisticRegression {
  private weights: number[] = [];
  private bias: number = 0;
  private learningRate: number = 0.01;
  
  train(features: number[][], labels: number[], epochs: number = 1000) {
    const nFeatures = features[0].length;
    this.weights = Array(nFeatures).fill(0);
    
    for (let epoch = 0; epoch < epochs; epoch++) {
      let totalLoss = 0;
      let homePredictions = 0;
      
      for (let i = 0; i < features.length; i++) {
        const prediction = this.predict(features[i]);
        const error = labels[i] - prediction;
        
        // Update weights
        for (let j = 0; j < nFeatures; j++) {
          this.weights[j] += this.learningRate * error * features[i][j];
        }
        this.bias += this.learningRate * error;
        
        // Track home predictions
        if (prediction > 0.5) homePredictions++;
        
        totalLoss += Math.pow(error, 2);
      }
      
      // Apply bias penalty if too many home predictions
      const homeBias = homePredictions / features.length;
      if (homeBias > 0.6) {
        this.bias -= 0.1; // Reduce bias toward home
      } else if (homeBias < 0.4) {
        this.bias += 0.1; // Increase if too few home predictions
      }
      
      if (epoch % 100 === 0) {
        console.log(chalk.gray(`Epoch ${epoch}: Loss=${(totalLoss/features.length).toFixed(4)}, HomeBias=${(homeBias*100).toFixed(1)}%`));
      }
    }
  }
  
  predict(features: number[]): number {
    let z = this.bias;
    for (let i = 0; i < features.length; i++) {
      z += this.weights[i] * features[i];
    }
    return 1 / (1 + Math.exp(-z));
  }
  
  predictBinary(features: number[]): number {
    return this.predict(features) > 0.5 ? 1 : 0;
  }
  
  toJSON() {
    return {
      weights: this.weights,
      bias: this.bias,
      type: 'logistic_regression'
    };
  }
  
  static fromJSON(json: any): LogisticRegression {
    const model = new LogisticRegression();
    model.weights = json.weights;
    model.bias = json.bias;
    return model;
  }
}

async function trainUnbiasedModel() {
  console.log(chalk.bold.cyan('🎯 TRAINING ACTUALLY UNBIASED MODEL'));
  console.log(chalk.yellow('Using logistic regression with bias penalty'));
  console.log(chalk.yellow('═'.repeat(60)));
  
  try {
    // Load games
    console.log(chalk.cyan('\n1️⃣ Loading training data...'));
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: true })
      .limit(10000);
    
    if (!games || games.length < 1000) {
      throw new Error('Not enough games for training');
    }
    
    console.log(chalk.green(`✅ Loaded ${games.length} games`));
    
    // Build team stats
    console.log(chalk.cyan('\n2️⃣ Building team statistics...'));
    const teamStats = new Map<number, {
      wins: number;
      losses: number;
      totalScored: number;
      totalAllowed: number;
      games: number;
    }>();
    
    // First pass: build stats
    games.forEach(game => {
      // Initialize teams
      if (!teamStats.has(game.home_team_id)) {
        teamStats.set(game.home_team_id, { wins: 0, losses: 0, totalScored: 0, totalAllowed: 0, games: 0 });
      }
      if (!teamStats.has(game.away_team_id)) {
        teamStats.set(game.away_team_id, { wins: 0, losses: 0, totalScored: 0, totalAllowed: 0, games: 0 });
      }
      
      const homeStats = teamStats.get(game.home_team_id)!;
      const awayStats = teamStats.get(game.away_team_id)!;
      
      // Update stats
      homeStats.games++;
      homeStats.totalScored += game.home_score;
      homeStats.totalAllowed += game.away_score;
      if (game.home_score > game.away_score) homeStats.wins++;
      else homeStats.losses++;
      
      awayStats.games++;
      awayStats.totalScored += game.away_score;
      awayStats.totalAllowed += game.home_score;
      if (game.away_score > game.home_score) awayStats.wins++;
      else awayStats.losses++;
    });
    
    // Extract features
    console.log(chalk.cyan('\n3️⃣ Extracting features...'));
    const features: number[][] = [];
    const labels: number[] = [];
    
    for (const game of games) {
      const homeStats = teamStats.get(game.home_team_id);
      const awayStats = teamStats.get(game.away_team_id);
      
      if (!homeStats || !awayStats || homeStats.games < 5 || awayStats.games < 5) continue;
      
      const homeWinRate = homeStats.wins / homeStats.games;
      const awayWinRate = awayStats.wins / awayStats.games;
      const homeAvgScore = homeStats.totalScored / homeStats.games;
      const awayAvgScore = awayStats.totalScored / awayStats.games;
      const homeAvgAllowed = homeStats.totalAllowed / homeStats.games;
      const awayAvgAllowed = awayStats.totalAllowed / awayStats.games;
      
      // Simple features that DON'T include home field advantage
      const gameFeatures = [
        homeWinRate - awayWinRate,           // Win rate difference
        (homeAvgScore - awayAvgScore) / 100, // Normalized score difference
        (awayAvgAllowed - homeAvgAllowed) / 100, // Defensive difference
        homeWinRate,                         // Home team absolute strength
        awayWinRate,                         // Away team absolute strength
      ];
      
      features.push(gameFeatures);
      labels.push(game.home_score > game.away_score ? 1 : 0);
    }
    
    console.log(chalk.green(`✅ Extracted ${features.length} feature vectors`));
    
    // Split data
    console.log(chalk.cyan('\n4️⃣ Training model with bias penalty...'));
    const splitIdx = Math.floor(features.length * 0.8);
    const xTrain = features.slice(0, splitIdx);
    const yTrain = labels.slice(0, splitIdx);
    const xTest = features.slice(splitIdx);
    const yTest = labels.slice(splitIdx);
    
    // Train model
    const model = new LogisticRegression();
    model.train(xTrain, yTrain, 2000);
    
    // Test model
    console.log(chalk.cyan('\n5️⃣ Testing model balance...'));
    let correct = 0;
    let homePredictions = 0;
    
    for (let i = 0; i < xTest.length; i++) {
      const pred = model.predictBinary(xTest[i]);
      if (pred === yTest[i]) correct++;
      if (pred === 1) homePredictions++;
    }
    
    const accuracy = correct / xTest.length;
    const homeBias = homePredictions / xTest.length;
    
    console.log(chalk.bold.yellow('\n📊 MODEL PERFORMANCE:'));
    console.log(chalk.white(`Accuracy: ${(accuracy * 100).toFixed(1)}%`));
    console.log(chalk.white(`Home Predictions: ${(homeBias * 100).toFixed(1)}%`));
    console.log(chalk.white(`Away Predictions: ${((1 - homeBias) * 100).toFixed(1)}%`));
    
    if (homeBias > 0.45 && homeBias < 0.55) {
      console.log(chalk.green('✅ MODEL IS BALANCED!'));
    } else {
      console.log(chalk.yellow('⚠️ Model still has some bias'));
    }
    
    // Save model
    console.log(chalk.cyan('\n6️⃣ Saving unbiased model...'));
    fs.writeFileSync('./models/actually-unbiased-model.json', JSON.stringify(model.toJSON(), null, 2));
    console.log(chalk.green('✅ Model saved to models/actually-unbiased-model.json'));
    
    console.log(chalk.bold.green('\n🏆 UNBIASED MODEL TRAINING COMPLETE!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Training failed:'), error);
  }
}

trainUnbiasedModel().catch(console.error);
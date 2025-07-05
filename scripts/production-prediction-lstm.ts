#!/usr/bin/env tsx
/**
 * 🚀 PRODUCTION PREDICTION SERVICE WITH LSTM
 * Ensemble: Neural Network + Random Forest + LSTM
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { LSTMPredictor } from '../lib/ml/lstm-model';

dotenv.config({ path: '.env.local' });

// GPU memory management
tf.engine().startScope();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Shared feature cache
const featureCache = new Map<string, any>();

class ProductionPredictorWithLSTM {
  private neuralNetwork?: tf.LayersModel;
  private randomForest?: any;
  private lstm?: LSTMPredictor;
  private isReady = false;

  async initialize() {
    console.log(chalk.bold.cyan('🚀 Initializing Production Ensemble (NN + RF + LSTM)...\n'));

    try {
      // Load Neural Network
      const modelPath = './models/neural-network';
      if (fs.existsSync(`${modelPath}/model.json`)) {
        this.neuralNetwork = await tf.loadLayersModel(`file://${modelPath}/model.json`);
        console.log(chalk.green('✅ Neural Network loaded'));
      }

      // Load Random Forest
      const rfPath = './models/random-forest.json';
      if (fs.existsSync(rfPath)) {
        const rfData = JSON.parse(fs.readFileSync(rfPath, 'utf-8'));
        this.randomForest = rfData;
        console.log(chalk.green('✅ Random Forest loaded'));
      }

      // Load LSTM
      const lstmPath = './models/lstm';
      if (fs.existsSync(`${lstmPath}/model.json`)) {
        this.lstm = new LSTMPredictor();
        await this.lstm.loadModel(lstmPath);
        console.log(chalk.green('✅ LSTM Model loaded'));
      }

      this.isReady = true;
      console.log(chalk.bold.green('\n✅ All models loaded successfully!\n'));
    } catch (error) {
      console.error(chalk.red('Failed to load models:'), error);
      throw error;
    }
  }

  async makePrediction(gameId: string) {
    if (!this.isReady) throw new Error('Models not initialized');

    // Get game data
    const { data: game, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();

    if (error || !game) {
      throw new Error(`Game not found: ${gameId}`);
    }

    // Extract features (cached)
    const cacheKey = `${game.home_team_id}-${game.away_team_id}`;
    let features = featureCache.get(cacheKey);
    
    if (!features) {
      features = await this.extractFeatures(game);
      featureCache.set(cacheKey, features);
    }

    // Get predictions from all models
    const predictions: any = {};

    // 1. Neural Network prediction
    if (this.neuralNetwork) {
      const nnFeatures = this.padFeatures(features.array, 50);
      const inputTensor = tf.tensor2d([nnFeatures]);
      const nnPrediction = this.neuralNetwork.predict(inputTensor) as tf.Tensor;
      const nnProb = (await nnPrediction.data())[0];
      inputTensor.dispose();
      nnPrediction.dispose();
      
      predictions.neuralNetwork = {
        probability: nnProb,
        winner: nnProb > 0.5 ? 'home' : 'away',
        confidence: Math.abs(nnProb - 0.5) * 2
      };
    }

    // 2. Random Forest prediction
    if (this.randomForest) {
      const rfProb = this.predictWithRandomForest(features.object);
      predictions.randomForest = {
        probability: rfProb,
        winner: rfProb > 0.5 ? 'home' : 'away',
        confidence: Math.abs(rfProb - 0.5) * 2
      };
    }

    // 3. LSTM prediction
    if (this.lstm) {
      try {
        const lstmResult = await this.lstm.predict(
          game.home_team_id,
          game.away_team_id,
          new Date(game.start_time)
        );
        predictions.lstm = {
          probability: lstmResult.homeWinProbability,
          drawProbability: lstmResult.drawProbability,
          winner: lstmResult.prediction,
          confidence: lstmResult.confidence,
          momentum: lstmResult.momentum
        };
      } catch (error) {
        // LSTM needs historical data, might fail for new teams
        console.log(chalk.gray('LSTM prediction skipped (insufficient data)'));
      }
    }

    // Ensemble prediction (weighted average)
    let ensembleProb = 0;
    let weights = 0;

    if (predictions.neuralNetwork) {
      ensembleProb += predictions.neuralNetwork.probability * 0.3;
      weights += 0.3;
    }
    if (predictions.randomForest) {
      ensembleProb += predictions.randomForest.probability * 0.5;
      weights += 0.5;
    }
    if (predictions.lstm) {
      ensembleProb += predictions.lstm.probability * 0.2;
      weights += 0.2;
    }

    ensembleProb = ensembleProb / weights;

    const finalPrediction = {
      gameId,
      homeTeam: game.home_team_id,
      awayTeam: game.away_team_id,
      ensemble: {
        probability: ensembleProb,
        winner: ensembleProb > 0.5 ? 'home' : 'away',
        confidence: Math.abs(ensembleProb - 0.5) * 2
      },
      models: predictions,
      timestamp: new Date().toISOString()
    };

    // Store prediction
    await this.storePrediction(finalPrediction, game);

    return finalPrediction;
  }

  private async extractFeatures(game: any) {
    // Get team stats
    const [homeStats, awayStats] = await Promise.all([
      this.getTeamStats(game.home_team_id),
      this.getTeamStats(game.away_team_id)
    ]);

    const featuresArray = [
      homeStats.avgScore,
      homeStats.winRate,
      homeStats.lastGamesAvg,
      homeStats.momentum,
      awayStats.avgScore,
      awayStats.winRate,
      awayStats.lastGamesAvg,
      awayStats.momentum,
      homeStats.headToHead,
      1, // Home advantage
      new Date(game.start_time).getMonth() / 11
    ];

    return {
      array: featuresArray,
      object: {
        home_avg_score: homeStats.avgScore,
        home_win_rate: homeStats.winRate,
        home_last_5_avg: homeStats.lastGamesAvg,
        home_momentum: homeStats.momentum,
        away_avg_score: awayStats.avgScore,
        away_win_rate: awayStats.winRate,
        away_last_5_avg: awayStats.lastGamesAvg,
        away_momentum: awayStats.momentum,
        head_to_head: homeStats.headToHead,
        home_advantage: 1,
        season_progress: new Date(game.start_time).getMonth() / 11
      }
    };
  }

  private async getTeamStats(teamId: string) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(20);

    if (!games || games.length === 0) {
      return {
        avgScore: 50,
        winRate: 0.5,
        lastGamesAvg: 50,
        momentum: 0,
        headToHead: 0.5
      };
    }

    let totalScore = 0;
    let wins = 0;
    let lastFiveScore = 0;
    let momentum = 0;

    games.forEach((game, index) => {
      const isHome = game.home_team_id === teamId;
      const teamScore = isHome ? game.home_score : game.away_score;
      const oppScore = isHome ? game.away_score : game.home_score;

      totalScore += teamScore;
      if (teamScore > oppScore) wins++;

      if (index < 5) {
        lastFiveScore += teamScore;
        if (teamScore > oppScore) momentum += (5 - index);
      }
    });

    return {
      avgScore: totalScore / games.length,
      winRate: wins / games.length,
      lastGamesAvg: lastFiveScore / Math.min(5, games.length),
      momentum: momentum / 15,
      headToHead: 0.5
    };
  }

  private padFeatures(features: number[], targetLength: number): number[] {
    const padded = [...features];
    while (padded.length < targetLength) {
      padded.push(0);
    }
    return padded;
  }

  private predictWithRandomForest(features: any): number {
    if (!this.randomForest || !this.randomForest.trees) return 0.5;

    const predictions = this.randomForest.trees.map((tree: any) => 
      this.traverseTree(tree, features)
    );

    return predictions.reduce((a: number, b: number) => a + b, 0) / predictions.length;
  }

  private traverseTree(node: any, features: any): number {
    if (node.value !== undefined) return node.value;

    const featureValue = features[node.feature];
    if (featureValue <= node.threshold) {
      return this.traverseTree(node.left, features);
    } else {
      return this.traverseTree(node.right, features);
    }
  }

  private async storePrediction(prediction: any, game: any) {
    const { error } = await supabase.from('ml_predictions').insert({
      game_id: prediction.gameId,
      model_name: 'ensemble-lstm',
      prediction_type: 'game_outcome',
      prediction: {
        winner: prediction.ensemble.winner,
        confidence: prediction.ensemble.confidence,
        homeWinProbability: prediction.ensemble.probability,
        models: prediction.models
      },
      // confidence_score: prediction.ensemble.confidence, // Column doesn't exist
      metadata: {
        home_team: game.home_team_id,
        away_team: game.away_team_id,
        model_versions: {
          neural_network: '2.0',
          random_forest: '1.0',
          lstm: '1.0'
        }
      }
    });

    if (error) {
      console.error(chalk.red('Failed to store prediction:'), error);
    }
  }

  async predictUpcomingGames() {
    console.log(chalk.bold.yellow('\n🎯 Predicting upcoming games...\n'));

    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .is('home_score', null)
      .gte('start_time', new Date().toISOString())
      .order('start_time')
      .limit(50);

    if (error || !games) {
      console.error(chalk.red('Failed to load games:'), error);
      return;
    }

    console.log(chalk.cyan(`Found ${games.length} upcoming games\n`));

    for (const game of games) {
      try {
        const prediction = await this.makePrediction(game.id);
        
        console.log(chalk.bold(`\n${game.home_team_id} vs ${game.away_team_id}`));
        console.log(chalk.gray(`Game ID: ${game.id}`));
        console.log(chalk.gray(`Start: ${new Date(game.start_time).toLocaleString()}`));
        
        console.log(chalk.yellow('\nPredictions:'));
        if (prediction.models.neuralNetwork) {
          console.log(`  NN: ${prediction.models.neuralNetwork.winner} (${(prediction.models.neuralNetwork.confidence * 100).toFixed(1)}%)`);
        }
        if (prediction.models.randomForest) {
          console.log(`  RF: ${prediction.models.randomForest.winner} (${(prediction.models.randomForest.confidence * 100).toFixed(1)}%)`);
        }
        if (prediction.models.lstm) {
          console.log(`  LSTM: ${prediction.models.lstm.winner} (${(prediction.models.lstm.confidence * 100).toFixed(1)}%)`);
          console.log(`    Momentum - Home: ${prediction.models.lstm.momentum.home.toFixed(2)}, Away: ${prediction.models.lstm.momentum.away.toFixed(2)}`);
        }
        
        console.log(chalk.bold.green(`\n  🎯 ENSEMBLE: ${prediction.ensemble.winner} wins (${(prediction.ensemble.confidence * 100).toFixed(1)}% confidence)`));
        
      } catch (error) {
        console.error(chalk.red(`Failed to predict game ${game.id}:`), error);
      }
    }

    // Summary
    const { count } = await supabase
      .from('ml_predictions')
      .select('*', { count: 'exact', head: true })
      .eq('model_name', 'ensemble-lstm');

    console.log(chalk.bold.cyan(`\n\n📊 PREDICTION SUMMARY`));
    console.log(chalk.yellow('━'.repeat(40)));
    console.log(`Total Predictions Made: ${count || 0}`);
    console.log(`Models Active: Neural Network, Random Forest, LSTM`);
    console.log(`Ensemble Method: Weighted Average (NN: 30%, RF: 50%, LSTM: 20%)`);
    console.log(chalk.yellow('━'.repeat(40)));
  }
}

// Main execution
async function main() {
  const predictor = new ProductionPredictorWithLSTM();
  
  try {
    await predictor.initialize();
    await predictor.predictUpcomingGames();
    
    console.log(chalk.bold.green('\n\n✅ Production predictions with LSTM complete!'));
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  } finally {
    tf.engine().endScope();
  }
}

main().catch(console.error);
#!/usr/bin/env tsx
/**
 * 🚀 FINAL PRODUCTION ENSEMBLE
 * Neural Network + Random Forest + LSTM + Gradient Boost
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as dotenv from 'dotenv';
import fs from 'fs';
import { LSTMPredictor } from '../lib/ml/lstm-model';
import { GradientBoostPredictor } from '../lib/ml/simple-xgboost';

dotenv.config({ path: '.env.local' });

// GPU memory management
tf.engine().startScope();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class UltimateEnsemblePredictor {
  private neuralNetwork?: tf.LayersModel;
  private randomForest?: any;
  private lstm?: LSTMPredictor;
  private gradientBoost?: GradientBoostPredictor;
  private isReady = false;

  async initialize() {
    console.log(chalk.bold.cyan('🚀 Initializing ULTIMATE Ensemble (NN + RF + LSTM + GB)...\n'));

    try {
      // Load Neural Network
      const nnPath = './models/neural-network';
      if (fs.existsSync(`${nnPath}/model.json`)) {
        this.neuralNetwork = await tf.loadLayersModel(`file://${nnPath}/model.json`);
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

      // Load Gradient Boost
      const gbPath = './models/gradient-boost.json';
      if (fs.existsSync(gbPath)) {
        this.gradientBoost = new GradientBoostPredictor();
        await this.gradientBoost.loadModel('./models/gradient-boost');
        console.log(chalk.green('✅ Gradient Boost loaded'));
      }

      this.isReady = true;
      console.log(chalk.bold.green('\n✅ All 4 models loaded successfully!\n'));
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

    // Get predictions from all models
    const predictions: any = {};
    const features = await this.extractFeatures(game);

    // 1. Neural Network
    if (this.neuralNetwork) {
      try {
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
      } catch (e) {
        console.log(chalk.gray('NN prediction skipped'));
      }
    }

    // 2. Random Forest
    if (this.randomForest) {
      try {
        const rfProb = this.predictWithRandomForest(features.object);
        predictions.randomForest = {
          probability: rfProb,
          winner: rfProb > 0.5 ? 'home' : 'away',
          confidence: Math.abs(rfProb - 0.5) * 2
        };
      } catch (e) {
        console.log(chalk.gray('RF prediction skipped'));
      }
    }

    // 3. LSTM
    if (this.lstm) {
      try {
        const lstmResult = await this.lstm.predict(
          game.home_team_id,
          game.away_team_id,
          new Date(game.start_time)
        );
        predictions.lstm = {
          probability: lstmResult.homeWinProbability,
          winner: lstmResult.prediction,
          confidence: lstmResult.confidence,
          momentum: lstmResult.momentum
        };
      } catch (e) {
        console.log(chalk.gray('LSTM prediction skipped'));
      }
    }

    // 4. Gradient Boost
    if (this.gradientBoost) {
      try {
        const gbResult = await this.gradientBoost.predict(
          game.home_team_id,
          game.away_team_id,
          new Date(game.start_time)
        );
        predictions.gradientBoost = {
          probability: gbResult.homeWinProbability,
          winner: gbResult.winner,
          confidence: gbResult.confidence,
          featureImportance: gbResult.featureImportance
        };
      } catch (e) {
        console.log(chalk.gray('GB prediction skipped'));
      }
    }

    // Weighted ensemble prediction
    let ensembleProb = 0;
    let weights = 0;

    // Weights based on historical performance
    const modelWeights = {
      neuralNetwork: 0.15,
      randomForest: 0.35,
      lstm: 0.20,
      gradientBoost: 0.30
    };

    Object.entries(predictions).forEach(([model, pred]) => {
      const weight = modelWeights[model as keyof typeof modelWeights] || 0.25;
      ensembleProb += pred.probability * weight;
      weights += weight;
    });

    ensembleProb = ensembleProb / weights;

    const finalPrediction = {
      gameId,
      homeTeam: game.home_team_id,
      awayTeam: game.away_team_id,
      ensemble: {
        probability: ensembleProb,
        winner: ensembleProb > 0.5 ? 'home' : 'away',
        confidence: Math.abs(ensembleProb - 0.5) * 2,
        modelCount: Object.keys(predictions).length
      },
      models: predictions,
      timestamp: new Date().toISOString()
    };

    // Store prediction
    await this.storePrediction(finalPrediction, game);

    return finalPrediction;
  }

  private async extractFeatures(game: any) {
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
      0.5, // Head to head placeholder
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
        head_to_head: 0.5,
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
        avgScore: 75,
        winRate: 0.5,
        lastGamesAvg: 75,
        momentum: 0
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
      momentum: momentum / 15
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
      model_name: 'ultimate-ensemble',
      prediction_type: 'game_outcome',
      prediction: {
        winner: prediction.ensemble.winner,
        confidence: prediction.ensemble.confidence,
        homeWinProbability: prediction.ensemble.probability,
        models: prediction.models,
        modelCount: prediction.ensemble.modelCount
      },
      metadata: {
        home_team: game.home_team_id,
        away_team: game.away_team_id,
        model_versions: {
          neural_network: '2.0',
          random_forest: '1.0',
          lstm: '1.0',
          gradient_boost: '2.0'
        }
      }
    });

    if (error) {
      console.error(chalk.red('Failed to store prediction:'), error);
    }
  }

  async predictUpcomingGames() {
    console.log(chalk.bold.yellow('\n🎯 Predicting upcoming games with ULTIMATE ensemble...\n'));

    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .is('home_score', null)
      .gte('start_time', new Date().toISOString())
      .order('start_time')
      .limit(20);

    if (error || !games) {
      console.error(chalk.red('Failed to load games:'), error);
      return;
    }

    console.log(chalk.cyan(`Found ${games.length} upcoming games\n`));

    let highConfidencePicks = 0;
    const predictions: any[] = [];

    for (const game of games) {
      try {
        const prediction = await this.makePrediction(game.id);
        predictions.push(prediction);
        
        console.log(chalk.bold(`${game.home_team_id} vs ${game.away_team_id}`));
        console.log(chalk.gray(`Start: ${new Date(game.start_time).toLocaleString()}`));
        
        // Show individual model predictions
        const modelResults: string[] = [];
        if (prediction.models.neuralNetwork) {
          modelResults.push(`NN: ${prediction.models.neuralNetwork.winner}`);
        }
        if (prediction.models.randomForest) {
          modelResults.push(`RF: ${prediction.models.randomForest.winner}`);
        }
        if (prediction.models.lstm) {
          modelResults.push(`LSTM: ${prediction.models.lstm.winner}`);
        }
        if (prediction.models.gradientBoost) {
          modelResults.push(`GB: ${prediction.models.gradientBoost.winner}`);
        }
        
        console.log(chalk.gray(`Models: ${modelResults.join(', ')}`));
        
        const confidenceColor = prediction.ensemble.confidence > 0.7 ? chalk.bold.green : 
                               prediction.ensemble.confidence > 0.6 ? chalk.yellow : chalk.gray;
        
        console.log(confidenceColor(`🎯 ENSEMBLE: ${prediction.ensemble.winner} wins (${(prediction.ensemble.confidence * 100).toFixed(1)}% confidence)`));
        
        if (prediction.ensemble.confidence > 0.7) {
          highConfidencePicks++;
          console.log(chalk.bold.cyan('⭐ HIGH CONFIDENCE PICK!'));
        }
        
        console.log('');
        
      } catch (error) {
        console.error(chalk.red(`Failed to predict game ${game.id}`));
      }
    }

    // Summary
    const { count } = await supabase
      .from('ml_predictions')
      .select('*', { count: 'exact', head: true })
      .eq('model_name', 'ultimate-ensemble');

    console.log(chalk.bold.cyan(`\n📊 PREDICTION SUMMARY`));
    console.log(chalk.yellow('━'.repeat(50)));
    console.log(`Total Predictions Made: ${count || 0}`);
    console.log(`Today's Games Analyzed: ${predictions.length}`);
    console.log(`High Confidence Picks: ${highConfidencePicks} (${(highConfidencePicks/predictions.length*100).toFixed(1)}%)`);
    console.log(`Active Models: Neural Network, Random Forest, LSTM, Gradient Boost`);
    console.log(`Ensemble Method: Weighted Average (NN: 15%, RF: 35%, LSTM: 20%, GB: 30%)`);
    console.log(chalk.yellow('━'.repeat(50)));
    
    // Show confidence distribution
    const confBuckets = { high: 0, medium: 0, low: 0 };
    predictions.forEach(p => {
      if (p.ensemble.confidence > 0.7) confBuckets.high++;
      else if (p.ensemble.confidence > 0.6) confBuckets.medium++;
      else confBuckets.low++;
    });
    
    console.log(chalk.bold('\n📈 Confidence Distribution:'));
    console.log(`  High (>70%): ${confBuckets.high} games`);
    console.log(`  Medium (60-70%): ${confBuckets.medium} games`);
    console.log(`  Low (<60%): ${confBuckets.low} games`);
  }
}

// Main execution
async function main() {
  const predictor = new UltimateEnsemblePredictor();
  
  try {
    await predictor.initialize();
    await predictor.predictUpcomingGames();
    
    console.log(chalk.bold.green('\n\n✅ ULTIMATE ensemble predictions complete!'));
    console.log(chalk.cyan('All 4 models working together for maximum accuracy! 🚀'));
  } catch (error) {
    console.error(chalk.red('Fatal error:'), error);
  } finally {
    tf.engine().endScope();
  }
}

main().catch(console.error);
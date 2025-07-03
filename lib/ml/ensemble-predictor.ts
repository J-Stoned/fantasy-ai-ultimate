/**
 * 🎯 ENSEMBLE PREDICTOR
 * 
 * Combines multiple ML models for better accuracy:
 * - Neural Network (TensorFlow)
 * - XGBoost (gradient boosting)
 * - Random Forest (decision trees)
 * 
 * Target: 60-65% accuracy
 */

import * as tf from '@tensorflow/tfjs-node';
import { RandomForestClassifier } from 'ml-random-forest';
import chalk from 'chalk';

export interface GameFeatures {
  // Team features (11)
  homeWinRate: number;
  awayWinRate: number;
  winRateDiff: number;
  homeAvgPointsFor: number;
  awayAvgPointsFor: number;
  homeAvgPointsAgainst: number;
  awayAvgPointsAgainst: number;
  homeLast5Form: number;
  awayLast5Form: number;
  homeHomeWinRate: number;
  awayAwayWinRate: number;
  
  // Player features (10)
  homeTopPlayerAvg: number;
  awayTopPlayerAvg: number;
  homeStarActive: boolean;
  awayStarActive: boolean;
  homeAvgFantasy: number;
  awayAvgFantasy: number;
  homeInjuryCount: number;
  awayInjuryCount: number;
  homeFormTrend: number;
  awayFormTrend: number;
  
  // Context features (5)
  seasonProgress: number;
  isWeekend: boolean;
  isHoliday: boolean;
  attendanceNormalized: number;
  hasVenue: boolean;
  
  // Head-to-head features (4)
  h2hWinRate: number;
  h2hPointDiff: number;
  homeStreak: number;
  awayStreak: number;
}

export interface PredictionResult {
  homeWinProbability: number;
  confidence: number;
  modelPredictions: {
    neuralNetwork: number;
    randomForest: number;
    xgboost?: number; // Optional since we'll implement later
  };
  topFactors: string[];
}

export class EnsemblePredictor {
  private neuralNetwork?: tf.LayersModel;
  private randomForest?: RandomForestClassifier;
  private featureNames: string[];
  private isLoaded = false;
  
  constructor() {
    this.featureNames = [
      'homeWinRate', 'awayWinRate', 'winRateDiff',
      'homeAvgPointsFor', 'awayAvgPointsFor',
      'homeAvgPointsAgainst', 'awayAvgPointsAgainst',
      'homeLast5Form', 'awayLast5Form',
      'homeHomeWinRate', 'awayAwayWinRate',
      'homeTopPlayerAvg', 'awayTopPlayerAvg',
      'homeStarActive', 'awayStarActive',
      'homeAvgFantasy', 'awayAvgFantasy',
      'homeInjuryCount', 'awayInjuryCount',
      'homeFormTrend', 'awayFormTrend',
      'seasonProgress', 'isWeekend', 'isHoliday',
      'attendanceNormalized', 'hasVenue',
      'h2hWinRate', 'h2hPointDiff',
      'homeStreak', 'awayStreak'
    ];
  }
  
  /**
   * Load pre-trained models
   */
  async loadModels(modelPath: string = './models') {
    console.log(chalk.cyan('Loading ensemble models...'));
    
    try {
      // Load neural network
      this.neuralNetwork = await tf.loadLayersModel(`file://${modelPath}/enhanced-v2/model.json`);
      console.log(chalk.green('✅ Neural network loaded'));
      
      // Load random forest (if exists)
      try {
        const rfData = require(`${modelPath}/random-forest.json`);
        this.randomForest = RandomForestClassifier.load(rfData);
        console.log(chalk.green('✅ Random forest loaded'));
      } catch (e) {
        console.log(chalk.yellow('⚠️  Random forest not found, will train on demand'));
      }
      
      this.isLoaded = true;
    } catch (error) {
      console.error(chalk.red('Failed to load models:'), error);
      throw error;
    }
  }
  
  /**
   * Train ensemble models
   */
  async trainEnsemble(
    features: number[][],
    labels: number[],
    options: {
      testSplit?: number;
      randomForestTrees?: number;
      saveModels?: boolean;
      modelPath?: string;
    } = {}
  ) {
    const {
      testSplit = 0.2,
      randomForestTrees = 100,
      saveModels = true,
      modelPath = './models'
    } = options;
    
    console.log(chalk.cyan('🎯 Training ensemble models...'));
    
    // Split data
    const splitIdx = Math.floor(features.length * (1 - testSplit));
    const xTrain = features.slice(0, splitIdx);
    const yTrain = labels.slice(0, splitIdx);
    const xTest = features.slice(splitIdx);
    const yTest = labels.slice(splitIdx);
    
    console.log(chalk.yellow(`📊 Training set: ${xTrain.length}, Test set: ${xTest.length}`));
    
    // 1. Train Neural Network (if not loaded)
    if (!this.neuralNetwork) {
      console.log(chalk.cyan('\n1️⃣ Training Neural Network...'));
      this.neuralNetwork = await this.trainNeuralNetwork(xTrain, yTrain, xTest, yTest);
    }
    
    // 2. Train Random Forest
    console.log(chalk.cyan('\n2️⃣ Training Random Forest...'));
    this.randomForest = await this.trainRandomForest(xTrain, yTrain, xTest, yTest, randomForestTrees);
    
    // 3. Train XGBoost (placeholder for now)
    console.log(chalk.yellow('\n3️⃣ XGBoost training skipped (requires native bindings)'));
    
    // Evaluate ensemble
    console.log(chalk.cyan('\n📊 Evaluating ensemble performance...'));
    const ensembleAccuracy = await this.evaluateEnsemble(xTest, yTest);
    console.log(chalk.green(`✅ Ensemble accuracy: ${(ensembleAccuracy * 100).toFixed(2)}%`));
    
    // Save models
    if (saveModels) {
      await this.saveModels(modelPath);
    }
    
    this.isLoaded = true;
    return ensembleAccuracy;
  }
  
  /**
   * Make prediction using ensemble
   */
  async predict(features: GameFeatures): Promise<PredictionResult> {
    if (!this.isLoaded) {
      throw new Error('Models not loaded. Call loadModels() or trainEnsemble() first.');
    }
    
    // Convert features to array
    const featureArray = this.featuresToArray(features);
    
    // Get individual model predictions
    const nnPrediction = await this.predictNeuralNetwork(featureArray);
    const rfPrediction = this.predictRandomForest(featureArray);
    
    // Weighted ensemble (can be optimized)
    const weights = {
      neuralNetwork: 0.4,
      randomForest: 0.4,
      xgboost: 0.2 // Placeholder
    };
    
    const homeWinProbability = 
      nnPrediction * weights.neuralNetwork +
      rfPrediction * weights.randomForest +
      0.5 * weights.xgboost; // Default for XGBoost
    
    // Calculate confidence based on model agreement
    const modelAgreement = 1 - Math.abs(nnPrediction - rfPrediction);
    const dataQuality = this.assessDataQuality(features);
    const confidence = (modelAgreement * 0.7 + dataQuality * 0.3);
    
    // Identify top factors
    const topFactors = this.identifyTopFactors(features);
    
    return {
      homeWinProbability,
      confidence,
      modelPredictions: {
        neuralNetwork: nnPrediction,
        randomForest: rfPrediction
      },
      topFactors
    };
  }
  
  /**
   * Train neural network
   */
  private async trainNeuralNetwork(
    xTrain: number[][],
    yTrain: number[],
    xTest: number[][],
    yTest: number[]
  ): Promise<tf.LayersModel> {
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 256, activation: 'relu', inputShape: [xTrain[0].length] }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dropout({ rate: 0.1 }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    // Convert to tensors
    const xTrainTensor = tf.tensor2d(xTrain);
    const yTrainTensor = tf.tensor1d(yTrain);
    const xTestTensor = tf.tensor2d(xTest);
    const yTestTensor = tf.tensor1d(yTest);
    
    // Train with early stopping
    let bestAccuracy = 0;
    let patience = 10;
    let patienceCounter = 0;
    
    for (let epoch = 0; epoch < 50; epoch++) {
      const h = await model.fit(xTrainTensor, yTrainTensor, {
        epochs: 1,
        validationData: [xTestTensor, yTestTensor],
        verbose: 0
      });
      
      const acc = h.history.val_acc[0] as number;
      if (acc > bestAccuracy) {
        bestAccuracy = acc;
        patienceCounter = 0;
      } else {
        patienceCounter++;
        if (patienceCounter >= patience) break;
      }
      
      if (epoch % 10 === 0) {
        console.log(chalk.gray(`  Epoch ${epoch}: val_acc=${acc.toFixed(3)}`));
      }
    }
    
    console.log(chalk.green(`  ✅ Best NN accuracy: ${(bestAccuracy * 100).toFixed(2)}%`));
    
    // Cleanup
    xTrainTensor.dispose();
    yTrainTensor.dispose();
    xTestTensor.dispose();
    yTestTensor.dispose();
    
    return model;
  }
  
  /**
   * Train random forest
   */
  private async trainRandomForest(
    xTrain: number[][],
    yTrain: number[],
    xTest: number[][],
    yTest: number[],
    nTrees: number
  ): Promise<RandomForestClassifier> {
    const options = {
      seed: 42,
      maxFeatures: 0.8,
      replacement: true,
      nEstimators: nTrees
    };
    
    const rf = new RandomForestClassifier(options);
    rf.train(xTrain, yTrain);
    
    // Evaluate
    const predictions = rf.predict(xTest);
    const accuracy = predictions.reduce((acc, pred, i) => 
      acc + (pred === yTest[i] ? 1 : 0), 0
    ) / predictions.length;
    
    console.log(chalk.green(`  ✅ Random Forest accuracy: ${(accuracy * 100).toFixed(2)}%`));
    
    return rf;
  }
  
  /**
   * Evaluate ensemble performance
   */
  private async evaluateEnsemble(xTest: number[][], yTest: number[]): Promise<number> {
    let correct = 0;
    
    for (let i = 0; i < xTest.length; i++) {
      const features = this.arrayToFeatures(xTest[i]);
      const prediction = await this.predict(features);
      const predicted = prediction.homeWinProbability > 0.5 ? 1 : 0;
      if (predicted === yTest[i]) correct++;
    }
    
    return correct / xTest.length;
  }
  
  /**
   * Save models
   */
  private async saveModels(modelPath: string) {
    console.log(chalk.cyan('\n💾 Saving models...'));
    
    // Save neural network
    if (this.neuralNetwork) {
      await this.neuralNetwork.save(`file://${modelPath}/enhanced-v2`);
      console.log(chalk.green('✅ Neural network saved'));
    }
    
    // Save random forest
    if (this.randomForest) {
      const fs = require('fs');
      fs.writeFileSync(
        `${modelPath}/random-forest.json`,
        JSON.stringify(this.randomForest.toJSON())
      );
      console.log(chalk.green('✅ Random forest saved'));
    }
  }
  
  /**
   * Convert features object to array
   */
  private featuresToArray(features: GameFeatures): number[] {
    return [
      features.homeWinRate,
      features.awayWinRate,
      features.winRateDiff,
      features.homeAvgPointsFor,
      features.awayAvgPointsFor,
      features.homeAvgPointsAgainst,
      features.awayAvgPointsAgainst,
      features.homeLast5Form,
      features.awayLast5Form,
      features.homeHomeWinRate,
      features.awayAwayWinRate,
      features.homeTopPlayerAvg,
      features.awayTopPlayerAvg,
      features.homeStarActive ? 1 : 0,
      features.awayStarActive ? 1 : 0,
      features.homeAvgFantasy,
      features.awayAvgFantasy,
      features.homeInjuryCount,
      features.awayInjuryCount,
      features.homeFormTrend,
      features.awayFormTrend,
      features.seasonProgress,
      features.isWeekend ? 1 : 0,
      features.isHoliday ? 1 : 0,
      features.attendanceNormalized,
      features.hasVenue ? 1 : 0,
      features.h2hWinRate,
      features.h2hPointDiff,
      features.homeStreak,
      features.awayStreak
    ];
  }
  
  /**
   * Convert array to features object
   */
  private arrayToFeatures(array: number[]): GameFeatures {
    return {
      homeWinRate: array[0],
      awayWinRate: array[1],
      winRateDiff: array[2],
      homeAvgPointsFor: array[3],
      awayAvgPointsFor: array[4],
      homeAvgPointsAgainst: array[5],
      awayAvgPointsAgainst: array[6],
      homeLast5Form: array[7],
      awayLast5Form: array[8],
      homeHomeWinRate: array[9],
      awayAwayWinRate: array[10],
      homeTopPlayerAvg: array[11],
      awayTopPlayerAvg: array[12],
      homeStarActive: array[13] > 0.5,
      awayStarActive: array[14] > 0.5,
      homeAvgFantasy: array[15],
      awayAvgFantasy: array[16],
      homeInjuryCount: array[17],
      awayInjuryCount: array[18],
      homeFormTrend: array[19],
      awayFormTrend: array[20],
      seasonProgress: array[21],
      isWeekend: array[22] > 0.5,
      isHoliday: array[23] > 0.5,
      attendanceNormalized: array[24],
      hasVenue: array[25] > 0.5,
      h2hWinRate: array[26],
      h2hPointDiff: array[27],
      homeStreak: array[28],
      awayStreak: array[29]
    };
  }
  
  /**
   * Predict using neural network
   */
  private async predictNeuralNetwork(features: number[]): Promise<number> {
    if (!this.neuralNetwork) return 0.5;
    
    const input = tf.tensor2d([features]);
    const prediction = this.neuralNetwork.predict(input) as tf.Tensor;
    const result = await prediction.data();
    
    input.dispose();
    prediction.dispose();
    
    return result[0];
  }
  
  /**
   * Predict using random forest
   */
  private predictRandomForest(features: number[]): number {
    if (!this.randomForest) return 0.5;
    
    const prediction = this.randomForest.predict([features]);
    return prediction[0];
  }
  
  /**
   * Assess data quality
   */
  private assessDataQuality(features: GameFeatures): number {
    let quality = 0.5;
    
    // More historical data = better
    if (features.homeWinRate > 0 && features.homeWinRate < 1) quality += 0.1;
    if (features.awayWinRate > 0 && features.awayWinRate < 1) quality += 0.1;
    
    // Player data available = better
    if (features.homeTopPlayerAvg > 0) quality += 0.15;
    if (features.awayTopPlayerAvg > 0) quality += 0.15;
    
    return Math.min(quality, 1);
  }
  
  /**
   * Identify top factors influencing prediction
   */
  private identifyTopFactors(features: GameFeatures): string[] {
    const factors: { name: string; impact: number }[] = [];
    
    // Calculate impact scores (simplified)
    if (Math.abs(features.winRateDiff) > 0.2) {
      factors.push({ 
        name: features.winRateDiff > 0 ? 'Home team stronger record' : 'Away team stronger record',
        impact: Math.abs(features.winRateDiff)
      });
    }
    
    if (features.homeFormTrend > 0.2) {
      factors.push({ name: 'Home team on hot streak', impact: features.homeFormTrend });
    }
    
    if (features.awayFormTrend > 0.2) {
      factors.push({ name: 'Away team on hot streak', impact: features.awayFormTrend });
    }
    
    if (!features.homeStarActive) {
      factors.push({ name: 'Home star player injured', impact: 0.3 });
    }
    
    if (!features.awayStarActive) {
      factors.push({ name: 'Away star player injured', impact: 0.3 });
    }
    
    // Sort by impact and return top 3
    return factors
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 3)
      .map(f => f.name);
  }
}

// Export singleton instance
export const ensemblePredictor = new EnsemblePredictor();
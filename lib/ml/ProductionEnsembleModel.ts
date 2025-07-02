/**
 * 🚀 PRODUCTION ENSEMBLE MODEL
 * 
 * Combines Neural Network, XGBoost, and LSTM for superior predictions
 * Inspired by Second Spectrum's multi-model approach
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { XGBoostModel } from './xgboost-wrapper';
import { LSTMPredictor } from './lstm-predictor';
import chalk from 'chalk';

interface EnsemblePrediction {
  winner: string;
  confidence: number;
  breakdown: {
    neural: { winner: string; confidence: number };
    xgboost: { winner: string; confidence: number };
    lstm: { winner: string; confidence: number };
  };
  reasoning: string;
}

export class ProductionEnsembleModel {
  private neuralNet: tf.LayersModel | null = null;
  private xgboost: XGBoostModel | null = null;
  private lstm: LSTMPredictor | null = null;
  
  // Weights for combining predictions (will be optimized)
  private weights = {
    neural: 0.4,
    xgboost: 0.35,
    lstm: 0.25
  };
  
  constructor() {
    console.log(chalk.blue.bold('🚀 Initializing Production Ensemble Model'));
  }
  
  /**
   * Build all three models
   */
  async buildModels(inputShape: number, sequenceLength: number = 10) {
    console.log(chalk.yellow('Building ensemble models...'));
    
    // 1. Neural Network - Good for complex patterns
    this.neuralNet = tf.sequential({
      layers: [
        tf.layers.dense({ 
          inputShape: [inputShape], 
          units: 256, 
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.dense({ 
          units: 128, 
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.batchNormalization(),
        tf.layers.dropout({ rate: 0.3 }),
        
        tf.layers.dense({ 
          units: 64, 
          activation: 'relu',
          kernelInitializer: 'heNormal'
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        tf.layers.dense({ 
          units: 32, 
          activation: 'relu' 
        }),
        
        tf.layers.dense({ 
          units: 1, 
          activation: 'sigmoid' 
        })
      ]
    });
    
    this.neuralNet.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    // 2. XGBoost - Great for structured data
    this.xgboost = new XGBoostModel({
      max_depth: 6,
      learning_rate: 0.1,
      n_estimators: 100,
      objective: 'binary:logistic',
      booster: 'gbtree',
      n_jobs: -1,
      random_state: 42,
      eval_metric: 'logloss'
    });
    
    // 3. LSTM - Captures temporal patterns
    this.lstm = new LSTMPredictor(inputShape, sequenceLength);
    await this.lstm.build();
    
    console.log(chalk.green('✅ All models built successfully'));
  }
  
  /**
   * Train all models in the ensemble
   */
  async train(
    features: number[][],
    labels: number[],
    sequenceData?: number[][][], // For LSTM
    epochs: number = 50
  ) {
    console.log(chalk.blue.bold('\n🏋️ Training Ensemble Models\n'));
    
    const startTime = Date.now();
    
    // Split data for validation
    const splitIdx = Math.floor(features.length * 0.8);
    const trainFeatures = features.slice(0, splitIdx);
    const trainLabels = labels.slice(0, splitIdx);
    const valFeatures = features.slice(splitIdx);
    const valLabels = labels.slice(splitIdx);
    
    // 1. Train Neural Network
    console.log(chalk.yellow('1️⃣ Training Neural Network...'));
    const xTensor = tf.tensor2d(trainFeatures);
    const yTensor = tf.tensor2d(trainLabels, [trainLabels.length, 1]);
    
    await this.neuralNet!.fit(xTensor, yTensor, {
      epochs: epochs,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(chalk.gray(`  Epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, acc=${logs?.acc?.toFixed(4)}`));
          }
        }
      }
    });
    
    xTensor.dispose();
    yTensor.dispose();
    
    // 2. Train XGBoost
    console.log(chalk.yellow('\n2️⃣ Training XGBoost...'));
    await this.xgboost!.train(trainFeatures, trainLabels, valFeatures, valLabels);
    
    // 3. Train LSTM (if sequence data provided)
    if (sequenceData) {
      console.log(chalk.yellow('\n3️⃣ Training LSTM...'));
      const trainSequences = sequenceData.slice(0, splitIdx);
      await this.lstm!.train(trainSequences, trainLabels, epochs);
    }
    
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green.bold(`\n✅ Ensemble training complete in ${elapsed}s`));
    
    // Optimize ensemble weights based on validation performance
    await this.optimizeWeights(valFeatures, valLabels);
  }
  
  /**
   * Make ensemble prediction
   */
  async predict(features: number[], sequenceData?: number[][]): Promise<EnsemblePrediction> {
    // Get individual predictions
    const neuralPred = await this.predictNeural(features);
    const xgboostPred = await this.predictXGBoost(features);
    const lstmPred = sequenceData ? await this.predictLSTM(sequenceData) : null;
    
    // Combine predictions using weighted average
    let combinedConfidence = 
      neuralPred.confidence * this.weights.neural +
      xgboostPred.confidence * this.weights.xgboost;
      
    if (lstmPred) {
      combinedConfidence += lstmPred.confidence * this.weights.lstm;
    } else {
      // Redistribute LSTM weight if no sequence data
      combinedConfidence = combinedConfidence / (this.weights.neural + this.weights.xgboost);
    }
    
    // Determine winner based on combined confidence
    const winner = combinedConfidence > 0.5 ? 'home' : 'away';
    
    // Generate reasoning
    const reasoning = this.generateReasoning(neuralPred, xgboostPred, lstmPred, combinedConfidence);
    
    return {
      winner,
      confidence: Math.min(0.95, Math.max(0.05, combinedConfidence)),
      breakdown: {
        neural: neuralPred,
        xgboost: xgboostPred,
        lstm: lstmPred || { winner: 'none', confidence: 0.5 }
      },
      reasoning
    };
  }
  
  /**
   * Neural network prediction
   */
  private async predictNeural(features: number[]): Promise<{ winner: string; confidence: number }> {
    const input = tf.tensor2d([features]);
    const prediction = this.neuralNet!.predict(input) as tf.Tensor;
    const confidence = (await prediction.data())[0];
    input.dispose();
    prediction.dispose();
    
    return {
      winner: confidence > 0.5 ? 'home' : 'away',
      confidence
    };
  }
  
  /**
   * XGBoost prediction
   */
  private async predictXGBoost(features: number[]): Promise<{ winner: string; confidence: number }> {
    const confidence = await this.xgboost!.predict([features]);
    return {
      winner: confidence[0] > 0.5 ? 'home' : 'away',
      confidence: confidence[0]
    };
  }
  
  /**
   * LSTM prediction
   */
  private async predictLSTM(sequenceData: number[][]): Promise<{ winner: string; confidence: number }> {
    const confidence = await this.lstm!.predict(sequenceData);
    return {
      winner: confidence > 0.5 ? 'home' : 'away',
      confidence
    };
  }
  
  /**
   * Optimize ensemble weights based on validation performance
   */
  private async optimizeWeights(valFeatures: number[][], valLabels: number[]) {
    console.log(chalk.yellow('\n🎯 Optimizing ensemble weights...'));
    
    // Simple grid search for optimal weights
    let bestWeights = { ...this.weights };
    let bestAccuracy = 0;
    
    const weightOptions = [0.2, 0.25, 0.3, 0.35, 0.4, 0.45];
    
    for (const w1 of weightOptions) {
      for (const w2 of weightOptions) {
        const w3 = 1 - w1 - w2;
        if (w3 > 0 && w3 < 1) {
          this.weights = { neural: w1, xgboost: w2, lstm: w3 };
          
          // Test accuracy with these weights
          let correct = 0;
          for (let i = 0; i < valFeatures.length; i++) {
            const pred = await this.predict(valFeatures[i]);
            const actual = valLabels[i] > 0.5 ? 'home' : 'away';
            if (pred.winner === actual) correct++;
          }
          
          const accuracy = correct / valFeatures.length;
          if (accuracy > bestAccuracy) {
            bestAccuracy = accuracy;
            bestWeights = { ...this.weights };
          }
        }
      }
    }
    
    this.weights = bestWeights;
    console.log(chalk.green(`✅ Optimal weights: NN=${this.weights.neural}, XGB=${this.weights.xgboost}, LSTM=${this.weights.lstm}`));
    console.log(chalk.green(`   Validation accuracy: ${(bestAccuracy * 100).toFixed(1)}%`));
  }
  
  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    neural: { winner: string; confidence: number },
    xgboost: { winner: string; confidence: number },
    lstm: { winner: string; confidence: number } | null,
    combined: number
  ): string {
    const agreements = [];
    const disagreements = [];
    
    // Check agreement between models
    if (neural.winner === xgboost.winner) {
      agreements.push('Neural and XGBoost agree');
    } else {
      disagreements.push('Neural and XGBoost disagree');
    }
    
    if (lstm && lstm.winner !== 'none') {
      if (lstm.winner === neural.winner) agreements.push('LSTM agrees with Neural');
      if (lstm.winner === xgboost.winner) agreements.push('LSTM agrees with XGBoost');
    }
    
    // Build reasoning
    let reasoning = `Ensemble prediction with ${(combined * 100).toFixed(1)}% confidence. `;
    
    if (agreements.length > 0) {
      reasoning += agreements.join(', ') + '. ';
    }
    
    if (disagreements.length > 0) {
      reasoning += 'Note: ' + disagreements.join(', ') + '. ';
    }
    
    // Add confidence levels
    reasoning += `Individual models: Neural (${(neural.confidence * 100).toFixed(1)}%), `;
    reasoning += `XGBoost (${(xgboost.confidence * 100).toFixed(1)}%)`;
    if (lstm) {
      reasoning += `, LSTM (${(lstm.confidence * 100).toFixed(1)}%)`;
    }
    
    return reasoning;
  }
  
  /**
   * Save ensemble models
   */
  async save(path: string) {
    console.log(chalk.yellow('Saving ensemble models...'));
    
    // Save neural network
    await this.neuralNet!.save(`file://${path}/neural`);
    
    // Save XGBoost
    await this.xgboost!.save(`${path}/xgboost`);
    
    // Save LSTM
    await this.lstm!.save(`${path}/lstm`);
    
    // Save weights
    const fs = require('fs').promises;
    await fs.writeFile(
      `${path}/ensemble_weights.json`,
      JSON.stringify(this.weights, null, 2)
    );
    
    console.log(chalk.green('✅ Ensemble models saved'));
  }
  
  /**
   * Load ensemble models
   */
  async load(path: string) {
    console.log(chalk.yellow('Loading ensemble models...'));
    
    // Load neural network
    this.neuralNet = await tf.loadLayersModel(`file://${path}/neural/model.json`);
    
    // Load XGBoost
    this.xgboost = new XGBoostModel();
    await this.xgboost.load(`${path}/xgboost`);
    
    // Load LSTM
    this.lstm = new LSTMPredictor();
    await this.lstm.load(`${path}/lstm`);
    
    // Load weights
    const fs = require('fs').promises;
    const weightsJson = await fs.readFile(`${path}/ensemble_weights.json`, 'utf-8');
    this.weights = JSON.parse(weightsJson);
    
    console.log(chalk.green('✅ Ensemble models loaded'));
  }
}
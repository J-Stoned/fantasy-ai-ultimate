import * as tf from '@tensorflow/tfjs-node';
import { prisma } from '../prisma';
import { MLPredictionEngine } from './MLPredictionEngine';
import * as fs from 'fs/promises';
import * as path from 'path';
import { mlLogger } from '../utils/logger';

interface TrainingConfig {
  batchSize: number;
  epochs: number;
  validationSplit: number;
  learningRate: number;
  patience: number;
}

interface TrainingResult {
  position: string;
  loss: number;
  accuracy: number;
  epochs: number;
  trainingTime: number;
}

export class ModelTrainer {
  private mlEngine: MLPredictionEngine;
  private modelsDir = './models';

  constructor() {
    this.mlEngine = new MLPredictionEngine();
  }

  async initialize() {
    // Ensure models directory exists
    await fs.mkdir(this.modelsDir, { recursive: true });
    await this.mlEngine.initialize();
    mlLogger.info('Model Trainer initialized');
  }

  // Train all position models
  async trainAllModels(config: Partial<TrainingConfig> = {}): Promise<TrainingResult[]> {
    const defaultConfig: TrainingConfig = {
      batchSize: 32,
      epochs: 100,
      validationSplit: 0.2,
      learningRate: 0.001,
      patience: 10,
      ...config,
    };

    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
    const results: TrainingResult[] = [];

    for (const position of positions) {
      mlLogger.info('Training position model', { position });
      const result = await this.trainPositionModel(position, defaultConfig);
      results.push(result);
    }

    return results;
  }

  // Train model for specific position
  private async trainPositionModel(
    position: string,
    config: TrainingConfig
  ): Promise<TrainingResult> {
    const startTime = Date.now();

    // Get training data
    mlLogger.info('Loading training data', { position });
    const { features, labels, players } = await this.prepareTrainingData(position);
    
    if (features.length === 0) {
      mlLogger.warn('No training data found', { position });
      return {
        position,
        loss: Infinity,
        accuracy: 0,
        epochs: 0,
        trainingTime: 0,
      };
    }

    mlLogger.info('Training data loaded', { exampleCount: features.length, playerCount: players.size, position });

    // Split data
    const splitIndex = Math.floor(features.length * (1 - config.validationSplit));
    const indices = Array.from({ length: features.length }, (_, i) => i);
    
    // Shuffle indices
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }

    const trainIndices = indices.slice(0, splitIndex);
    const valIndices = indices.slice(splitIndex);

    // Create tensors
    const xTrain = tf.tensor2d(trainIndices.map(i => features[i]));
    const yTrain = tf.tensor2d(trainIndices.map(i => [labels[i]]));
    const xVal = tf.tensor2d(valIndices.map(i => features[i]));
    const yVal = tf.tensor2d(valIndices.map(i => [labels[i]]));

    // Create or load model
    const model = await this.createAdvancedModel(position, features[0].length);

    // Setup callbacks
    let bestValLoss = Infinity;
    let patienceCounter = 0;
    let actualEpochs = 0;

    const callbacks: tf.CustomCallbackArgs = {
      onEpochEnd: async (epoch, logs) => {
        actualEpochs = epoch + 1;
        
        if (logs?.val_loss !== undefined) {
          if (logs.val_loss < bestValLoss) {
            bestValLoss = logs.val_loss;
            patienceCounter = 0;
            // Save best model
            await model.save(`file://${this.modelsDir}/${position.toLowerCase()}_model`);
          } else {
            patienceCounter++;
          }
        }

        if (epoch % 10 === 0) {
          mlLogger.debug('Training progress', {
            position,
            epoch: epoch + 1,
            totalEpochs: config.epochs,
            loss: logs?.loss?.toFixed(4),
            valLoss: logs?.val_loss?.toFixed(4),
            patience: patienceCounter,
            maxPatience: config.patience
          });
        }

        // Early stopping
        if (patienceCounter >= config.patience) {
          mlLogger.info('Early stopping triggered', { position });
          model.stopTraining = true;
        }
      },
    };

    // Train model
    mlLogger.info('Starting model training', { position });
    const history = await model.fit(xTrain, yTrain, {
      batchSize: config.batchSize,
      epochs: config.epochs,
      validationData: [xVal, yVal],
      callbacks,
      verbose: 0,
    });

    // Calculate final metrics
    const finalLoss = history.history.loss[history.history.loss.length - 1] as number;
    const accuracy = await this.calculateAccuracy(model, xVal, yVal);

    // Cleanup
    xTrain.dispose();
    yTrain.dispose();
    xVal.dispose();
    yVal.dispose();

    const trainingTime = (Date.now() - startTime) / 1000;
    mlLogger.info('Model training completed', { position, trainingTimeSeconds: trainingTime.toFixed(1) });

    return {
      position,
      loss: finalLoss,
      accuracy,
      epochs: actualEpochs,
      trainingTime,
    };
  }

  private async createAdvancedModel(position: string, inputSize: number): Promise<tf.LayersModel> {
    const model = tf.sequential();

    // Input layer with batch normalization
    model.add(tf.layers.dense({
      inputShape: [inputSize],
      units: 256,
      activation: 'relu',
      kernelInitializer: 'heNormal',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.dropout({ rate: 0.3 }));

    // Hidden layers
    model.add(tf.layers.dense({
      units: 128,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    }));
    model.add(tf.layers.batchNormalization());
    model.add(tf.layers.dropout({ rate: 0.2 }));

    model.add(tf.layers.dense({
      units: 64,
      activation: 'relu',
      kernelRegularizer: tf.regularizers.l2({ l2: 0.001 }),
    }));
    model.add(tf.layers.dropout({ rate: 0.1 }));

    // Position-specific layers
    if (['QB', 'RB', 'WR'].includes(position)) {
      model.add(tf.layers.dense({
        units: 32,
        activation: 'relu',
      }));
    }

    // Output layer
    model.add(tf.layers.dense({
      units: 1,
      activation: 'linear',
    }));

    // Compile with advanced optimizer
    model.compile({
      optimizer: tf.train.adamax(0.001),
      loss: 'huberLoss',
      metrics: ['mse', 'mae'],
    });

    return model;
  }

  private async prepareTrainingData(position: string): Promise<{
    features: number[][];
    labels: number[];
    players: Set<string>;
  }> {
    // Get all players for this position with sufficient data
    const players = await prisma.player.findMany({
      where: {
        position,
        stats: {
          some: {
            fantasy_points_ppr: { gte: 0 },
          },
        },
      },
      include: {
        stats: {
          orderBy: [{ season: 'desc' }, { week: 'desc' }],
          take: 50, // Last 50 games per player
        },
        team: true,
      },
    });

    const features: number[][] = [];
    const labels: number[] = [];
    const playerSet = new Set<string>();

    for (const player of players) {
      if (player.stats.length < 10) continue; // Need enough history

      // Create sliding windows
      for (let i = 0; i < player.stats.length - 10; i++) {
        const window = player.stats.slice(i, i + 10);
        const target = player.stats[i + 10];

        const feature = this.extractAdvancedFeatures(window, player, target);
        if (feature.length > 0) {
          features.push(feature);
          labels.push(target.fantasy_points_ppr || 0);
          playerSet.add(player.id);
        }
      }
    }

    return { features, labels, players: playerSet };
  }

  private extractAdvancedFeatures(stats: any[], player: any, targetGame: any): number[] {
    const features: number[] = [];

    // Recent performance (last 3, 5, 10 games)
    const recent3 = stats.slice(0, 3);
    const recent5 = stats.slice(0, 5);
    
    // Points
    features.push(this.average(recent3.map(s => s.fantasy_points_ppr || 0)));
    features.push(this.average(recent5.map(s => s.fantasy_points_ppr || 0)));
    features.push(this.average(stats.map(s => s.fantasy_points_ppr || 0)));
    
    // Trend
    features.push(this.calculateTrend(stats.map(s => s.fantasy_points_ppr || 0)));
    
    // Consistency
    features.push(this.calculateStdDev(stats.map(s => s.fantasy_points_ppr || 0)));
    
    // Position-specific features
    if (player.position === 'QB') {
      features.push(this.average(stats.map(s => s.passing_yards || 0)));
      features.push(this.average(stats.map(s => s.passing_touchdowns || 0)));
      features.push(this.average(stats.map(s => s.interceptions || 0)));
      features.push(this.average(stats.map(s => 
        s.attempts > 0 ? (s.completions || 0) / s.attempts : 0
      )));
    } else if (['RB', 'WR', 'TE'].includes(player.position)) {
      features.push(this.average(stats.map(s => s.carries || 0)));
      features.push(this.average(stats.map(s => s.targets || 0)));
      features.push(this.average(stats.map(s => s.receptions || 0)));
      features.push(this.average(stats.map(s => s.receiving_yards || 0)));
      features.push(this.average(stats.map(s => s.rushing_yards || 0)));
    }

    // Usage metrics
    features.push(this.average(stats.map(s => s.snap_count || 0)));
    features.push(this.average(stats.map(s => s.red_zone_touches || 0)));
    
    // Game context for target game
    features.push(targetGame.is_home ? 1 : 0);
    features.push((32 - (targetGame.opponent_defense_rank || 16)) / 32);
    features.push(targetGame.week / 17); // Normalize week
    
    // Opponent strength (if available)
    const oppDefenseRating = targetGame.opponent_defense_rating || 0.5;
    features.push(oppDefenseRating);
    
    // Days rest (estimated)
    const avgDaysRest = 7; // Default to weekly games
    features.push(avgDaysRest / 14); // Normalize

    // Momentum features
    const momentum = this.calculateMomentum(stats.map(s => s.fantasy_points_ppr || 0));
    features.push(momentum);

    // Ceiling/floor analysis
    const points = stats.map(s => s.fantasy_points_ppr || 0);
    const ceiling = Math.max(...points);
    const floor = Math.min(...points.filter(p => p > 0));
    features.push(ceiling);
    features.push(floor);
    features.push(ceiling - floor); // Volatility

    return features;
  }

  private average(values: number[]): number {
    return values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private calculateStdDev(values: number[]): number {
    const mean = this.average(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    return Math.sqrt(variance);
  }

  private calculateMomentum(values: number[]): number {
    if (values.length < 3) return 0;
    
    const recent = this.average(values.slice(0, 3));
    const previous = this.average(values.slice(3, 6));
    
    return previous > 0 ? (recent - previous) / previous : 0;
  }

  private async calculateAccuracy(
    model: tf.LayersModel,
    xVal: tf.Tensor,
    yVal: tf.Tensor
  ): Promise<number> {
    const predictions = model.predict(xVal) as tf.Tensor;
    const predArray = await predictions.array() as number[][];
    const actualArray = await yVal.array() as number[][];
    
    let correctWithinThreshold = 0;
    const threshold = 3; // Within 3 points
    
    for (let i = 0; i < predArray.length; i++) {
      const pred = predArray[i][0];
      const actual = actualArray[i][0];
      
      if (Math.abs(pred - actual) <= threshold) {
        correctWithinThreshold++;
      }
    }
    
    predictions.dispose();
    
    return (correctWithinThreshold / predArray.length) * 100;
  }

  // Incremental learning from new data
  async updateModelsWithNewData(week: number, season: number): Promise<void> {
    mlLogger.info('Updating models with week data', { week });
    
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
    
    for (const position of positions) {
      await this.incrementalUpdate(position, week, season);
    }
  }

  private async incrementalUpdate(position: string, week: number, season: number): Promise<void> {
    // Get new data for the week
    const newData = await prisma.playerStat.findMany({
      where: {
        week,
        season,
        player: { position },
      },
      include: {
        player: {
          include: {
            stats: {
              where: {
                week: { lt: week },
                season,
              },
              orderBy: { week: 'desc' },
              take: 10,
            },
          },
        },
      },
    });

    if (newData.length === 0) return;

    // Prepare features and labels
    const features: number[][] = [];
    const labels: number[] = [];

    for (const stat of newData) {
      if (stat.player.stats.length >= 5) {
        const feature = this.extractAdvancedFeatures(
          stat.player.stats,
          stat.player,
          stat
        );
        
        if (feature.length > 0) {
          features.push(feature);
          labels.push(stat.fantasy_points_ppr || 0);
        }
      }
    }

    if (features.length === 0) return;

    // Load existing model
    try {
      const model = await tf.loadLayersModel(
        `file://${this.modelsDir}/${position.toLowerCase()}_model/model.json`
      );

      // Create tensors
      const x = tf.tensor2d(features);
      const y = tf.tensor2d(labels.map(l => [l]));

      // Fine-tune with new data
      await model.fit(x, y, {
        epochs: 10,
        batchSize: Math.min(16, features.length),
        verbose: 0,
      });

      // Save updated model
      await model.save(`file://${this.modelsDir}/${position.toLowerCase()}_model`);
      
      mlLogger.info('Updated model with new examples', { position, exampleCount: features.length });

      // Cleanup
      x.dispose();
      y.dispose();
      model.dispose();
    } catch (error) {
      mlLogger.error('Failed to update model', error, { position });
    }
  }

  // Export training data for analysis
  async exportTrainingData(position: string, outputPath: string): Promise<void> {
    const { features, labels, players } = await this.prepareTrainingData(position);
    
    const data = {
      position,
      totalExamples: features.length,
      uniquePlayers: players.size,
      features: features.slice(0, 100), // First 100 examples
      labels: labels.slice(0, 100),
      featureNames: this.getFeatureNames(position),
      statistics: {
        meanLabel: this.average(labels),
        stdLabel: this.calculateStdDev(labels),
        minLabel: Math.min(...labels),
        maxLabel: Math.max(...labels),
      },
    };

    await fs.writeFile(outputPath, JSON.stringify(data, null, 2));
    mlLogger.info('Exported training data', { outputPath });
  }

  private getFeatureNames(position: string): string[] {
    const baseFeatures = [
      'avg_points_3',
      'avg_points_5',
      'avg_points_10',
      'trend',
      'consistency',
    ];

    const positionFeatures: Record<string, string[]> = {
      QB: ['avg_passing_yards', 'avg_passing_tds', 'avg_ints', 'completion_pct'],
      RB: ['avg_carries', 'avg_targets', 'avg_receptions', 'avg_rec_yards', 'avg_rush_yards'],
      WR: ['avg_carries', 'avg_targets', 'avg_receptions', 'avg_rec_yards', 'avg_rush_yards'],
      TE: ['avg_carries', 'avg_targets', 'avg_receptions', 'avg_rec_yards', 'avg_rush_yards'],
      K: ['avg_fg_made', 'avg_fg_attempts', 'avg_xp_made'],
      DST: ['avg_sacks', 'avg_ints', 'avg_points_allowed'],
    };

    const contextFeatures = [
      'avg_snaps',
      'avg_rz_touches',
      'is_home',
      'opp_def_rank',
      'week_normalized',
      'opp_def_rating',
      'days_rest',
      'momentum',
      'ceiling',
      'floor',
      'volatility',
    ];

    return [
      ...baseFeatures,
      ...(positionFeatures[position] || []),
      ...contextFeatures,
    ];
  }
}
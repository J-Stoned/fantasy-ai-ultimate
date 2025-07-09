import * as tf from '@tensorflow/tfjs';
import { prisma } from '../prisma';
import { cache } from '../cache/RedisCache';
import { mlLogger } from '../utils/logger';

interface PlayerFeatures {
  // Basic stats
  points: number[];
  yards: number[];
  touchdowns: number[];
  receptions?: number[];
  completions?: number[];
  attempts?: number[];
  
  // Advanced metrics
  usage: number[];
  targetShare?: number[];
  redZoneUsage?: number[];
  snapCount?: number[];
  
  // Contextual
  isHome: boolean[];
  oppDefenseRank: number[];
  weather?: number[]; // 0-1 scale (bad to good)
  injuries?: number[]; // 0-1 scale (healthy to injured)
}

interface PredictionResult {
  playerId: string;
  playerName: string;
  predictedPoints: number;
  confidence: number;
  insights: string[];
  features: PlayerFeatures;
}

export class MLPredictionEngine {
  private models: Map<string, tf.LayersModel> = new Map();
  private isInitialized = false;

  async initialize() {
    mlLogger.info('Initializing ML Prediction Engine...');
    
    // Load or create models for each position
    const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
    
    for (const position of positions) {
      const model = await this.loadOrCreateModel(position);
      this.models.set(position, model);
    }
    
    this.isInitialized = true;
    mlLogger.info('ML Engine initialized', { modelCount: this.models.size });
  }

  private async loadOrCreateModel(position: string): Promise<tf.LayersModel> {
    const modelPath = `./models/${position.toLowerCase()}_model.json`;
    
    try {
      // Try to load existing model
      const model = await tf.loadLayersModel(`file://${modelPath}`);
      mlLogger.info('Loaded existing model', { position });
      return model;
    } catch (error) {
      // Create new model if not found
      mlLogger.info('Creating new model', { position });
      return this.createModel(position);
    }
  }

  private createModel(position: string): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        // Input layer - features vary by position
        tf.layers.dense({
          inputShape: [this.getFeatureCount(position)],
          units: 128,
          activation: 'relu',
          kernelInitializer: 'glorotUniform',
        }),
        
        // Dropout for regularization
        tf.layers.dropout({ rate: 0.3 }),
        
        // Hidden layers
        tf.layers.dense({
          units: 64,
          activation: 'relu',
        }),
        tf.layers.dropout({ rate: 0.2 }),
        
        tf.layers.dense({
          units: 32,
          activation: 'relu',
        }),
        
        // Output layer - predicted fantasy points
        tf.layers.dense({
          units: 1,
          activation: 'linear',
        }),
      ],
    });

    // Compile with appropriate loss and optimizer
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse', 'mae'],
    });

    return model;
  }

  private getFeatureCount(position: string): number {
    // Different positions have different feature counts
    const featureCounts: Record<string, number> = {
      QB: 20,  // passing, rushing, game context
      RB: 18,  // rushing, receiving, usage
      WR: 17,  // receiving, targets, air yards
      TE: 16,  // receiving, blocking snaps
      K: 12,   // FG attempts, distance, weather
      DST: 15, // sacks, turnovers, points allowed
    };
    
    return featureCounts[position] || 15;
  }

  async predictPlayerPerformance(
    playerId: string,
    weekNumber: number,
    season: number = new Date().getFullYear()
  ): Promise<PredictionResult | null> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Declare tensors outside try block for cleanup
    let inputTensor: tf.Tensor | null = null;
    let prediction: tf.Tensor | null = null;

    try {
      // Check cache first
      const cacheKey = `prediction:${playerId}:${season}:${weekNumber}`;
      const cached = await cache.get<PredictionResult>(cacheKey);
      if (cached) return cached;

      // Get player data
      const player = await prisma.player.findUnique({
        where: { id: playerId },
        include: {
          stats: {
            where: {
              season,
            },
            orderBy: { createdAt: 'desc' },
            take: 10, // Last 10 games
          },
          currentTeam: true,
        },
      });

      if (!player || !player.stats.length) {
        return null;
      }

      // Extract features
      const features = await this.extractFeatures(player, weekNumber, season);
      
      // Get the appropriate model
      const model = this.models.get(player.position[0]);
      if (!model) {
        mlLogger.warn('No model found for position', { position: player.position });
        return null;
      }

      // Prepare input tensor
      inputTensor = this.prepareInputTensor(features, player.position[0]);
      
      // Make prediction
      prediction = model.predict(inputTensor) as tf.Tensor;
      const predictedPoints = (await prediction.data())[0];
      
      // Calculate confidence based on recent consistency
      const confidence = this.calculateConfidence(features);
      
      // Generate insights
      const insights = this.generateInsights(player, features, predictedPoints);

      const result: PredictionResult = {
        playerId,
        playerName: `${player.firstName} ${player.lastName}`,
        predictedPoints: Math.max(0, predictedPoints), // No negative points
        confidence,
        insights,
        features,
      };

      // Cache the result
      await cache.set(cacheKey, result, 3600); // 1 hour cache

      return result;
    } catch (error) {
      mlLogger.error('Prediction error', error);
      return null;
    } finally {
      // Always cleanup tensors, even if error occurred
      inputTensor?.dispose();
      prediction?.dispose();
    }
  }

  private async extractFeatures(
    player: any,
    weekNumber: number,
    season: number
  ): Promise<PlayerFeatures> {
    // Extract recent performance data
    const recentStats = player.stats.slice(0, 5); // Last 5 games
    
    const features: PlayerFeatures = {
      points: recentStats.map((s: any) => s.stats?.fantasy_points_ppr || 0),
      yards: recentStats.map((s: any) => {
        const stats = s.stats || {};
        if (player.position[0] === 'QB') return stats.passing_yards || 0;
        if (['RB', 'WR', 'TE'].includes(player.position[0])) return (stats.rushing_yards || 0) + (stats.receiving_yards || 0);
        return 0;
      }),
      touchdowns: recentStats.map((s: any) => {
        const stats = s.stats || {};
        const passingTDs = stats.passing_touchdowns || 0;
        const rushingTDs = stats.rushing_touchdowns || 0;
        const receivingTDs = stats.receiving_touchdowns || 0;
        return passingTDs + rushingTDs + receivingTDs;
      }),
      isHome: recentStats.map((s: any) => s.stats?.is_home || false),
      oppDefenseRank: recentStats.map((s: any) => s.stats?.opponent_defense_rank || 16),
      usage: recentStats.map((s: any) => {
        const stats = s.stats || {};
        // Calculate usage rate based on team's total plays
        const teamPlays = stats.team_total_plays || 60;
        const playerTouches = (stats.passing_attempts || 0) + (stats.rushing_attempts || 0) + (stats.targets || 0);
        return playerTouches / teamPlays;
      }),
    };

    // Position-specific features
    if (player.position[0] === 'QB') {
      features.completions = recentStats.map((s: any) => s.stats?.completions || 0);
      features.attempts = recentStats.map((s: any) => s.stats?.attempts || 0);
    }

    if (['RB', 'WR', 'TE'].includes(player.position[0])) {
      features.receptions = recentStats.map((s: any) => s.stats?.receptions || 0);
      features.targetShare = recentStats.map((s: any) => s.stats?.target_share || 0);
    }

    // Advanced metrics
    features.snapCount = recentStats.map((s: any) => s.stats?.snap_count || 0);
    features.redZoneUsage = recentStats.map((s: any) => s.stats?.red_zone_touches || 0);

    return features;
  }

  private prepareInputTensor(features: PlayerFeatures, position: string): tf.Tensor2D {
    const featureArray: number[] = [];
    
    // Add recent averages (last 3 games)
    const recent = 3;
    featureArray.push(this.average(features.points.slice(0, recent)));
    featureArray.push(this.average(features.yards.slice(0, recent)));
    featureArray.push(this.average(features.touchdowns.slice(0, recent)));
    
    // Add season averages
    featureArray.push(this.average(features.points));
    featureArray.push(this.average(features.yards));
    featureArray.push(this.average(features.touchdowns));
    
    // Add trend (positive/negative)
    featureArray.push(this.calculateTrend(features.points));
    featureArray.push(this.calculateTrend(features.yards));
    
    // Add consistency score
    featureArray.push(this.calculateConsistency(features.points));
    
    // Position-specific features
    if (position === 'QB' && features.completions && features.attempts) {
      featureArray.push(this.average(features.completions));
      featureArray.push(this.average(features.attempts));
      const completionPct = features.completions.map((c, i) => 
        features.attempts![i] > 0 ? c / features.attempts![i] : 0
      );
      featureArray.push(this.average(completionPct));
    }

    if (['RB', 'WR', 'TE'].includes(position) && features.receptions) {
      featureArray.push(this.average(features.receptions));
      featureArray.push(this.average(features.targetShare || []));
    }

    // Add contextual features
    featureArray.push(features.isHome[0] ? 1 : 0);
    featureArray.push((32 - features.oppDefenseRank[0]) / 32); // Normalize defense rank
    
    // Pad to expected feature count
    while (featureArray.length < this.getFeatureCount(position)) {
      featureArray.push(0);
    }

    return tf.tensor2d([featureArray]);
  }

  private average(arr: number[]): number {
    if (arr.length === 0) return 0;
    return arr.reduce((a, b) => a + b, 0) / arr.length;
  }

  private calculateTrend(values: number[]): number {
    if (values.length < 2) return 0;
    
    // Simple linear regression slope
    const n = values.length;
    const sumX = (n * (n - 1)) / 2;
    const sumY = values.reduce((a, b) => a + b, 0);
    const sumXY = values.reduce((sum, y, x) => sum + x * y, 0);
    const sumX2 = (n * (n - 1) * (2 * n - 1)) / 6;
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private calculateConsistency(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = this.average(values);
    const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    
    // Lower std dev = higher consistency
    return mean > 0 ? 1 - (stdDev / mean) : 0;
  }

  private calculateConfidence(features: PlayerFeatures): number {
    // Base confidence on consistency and sample size
    const consistency = this.calculateConsistency(features.points);
    const sampleSize = Math.min(features.points.length / 10, 1); // Max at 10 games
    
    // Weight consistency more heavily
    const confidence = (consistency * 0.7 + sampleSize * 0.3) * 100;
    
    return Math.round(Math.max(0, Math.min(100, confidence)));
  }

  private generateInsights(player: any, features: PlayerFeatures, prediction: number): string[] {
    const insights: string[] = [];
    
    // Performance trend
    const trend = this.calculateTrend(features.points);
    if (trend > 0.5) {
      insights.push('📈 Trending upward over last few games');
    } else if (trend < -0.5) {
      insights.push('📉 Trending downward recently');
    }
    
    // Consistency
    const consistency = this.calculateConsistency(features.points);
    if (consistency > 0.8) {
      insights.push('🎯 Very consistent performer');
    } else if (consistency < 0.5) {
      insights.push('🎲 High variance player - boom or bust');
    }
    
    // Matchup
    if (features.oppDefenseRank[0] <= 10) {
      insights.push('🛡️ Tough matchup against top-10 defense');
    } else if (features.oppDefenseRank[0] >= 23) {
      insights.push('🎯 Favorable matchup against weak defense');
    }
    
    // Home/Away
    if (features.isHome[0]) {
      insights.push('🏠 Playing at home');
    }
    
    // Recent performance
    const recentAvg = this.average(features.points.slice(0, 3));
    const seasonAvg = this.average(features.points);
    if (recentAvg > seasonAvg * 1.2) {
      insights.push('🔥 Hot streak - performing above season average');
    } else if (recentAvg < seasonAvg * 0.8) {
      insights.push('❄️ Cold streak - below season average');
    }
    
    return insights;
  }

  async trainModel(position: string, trainingData?: any) {
    const model = this.models.get(position);
    if (!model) {
      mlLogger.warn('No model found for position', { position });
      return;
    }

    mlLogger.info('Training model', { position });
    
    // Declare tensors outside try block for cleanup
    let inputTensor: tf.Tensor | null = null;
    let outputTensor: tf.Tensor | null = null;

    try {
      // Get historical data if not provided
      if (!trainingData) {
        trainingData = await this.getTrainingData(position);
      }

      const { inputs, outputs } = trainingData;
      
      // Convert to tensors
      inputTensor = tf.tensor2d(inputs);
      outputTensor = tf.tensor2d(outputs.map((o: number) => [o]));
      
      // Train the model
      const history = await model.fit(inputTensor, outputTensor, {
        epochs: 50,
        batchSize: 32,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            if (epoch % 10 === 0) {
              mlLogger.debug('Training progress', { position, epoch, loss: logs?.loss?.toFixed(4) });
            }
          },
        },
      });

      // Save the model
      await model.save(`file://./models/${position.toLowerCase()}_model.json`);
      mlLogger.info('Model trained and saved', { position });
    } catch (error) {
      mlLogger.error('Error training model', error, { position });
      throw error;
    } finally {
      // Always cleanup tensors, even if error occurred
      inputTensor?.dispose();
      outputTensor?.dispose();
    }
  }

  private async getTrainingData(position: string) {
    // Fetch historical player performance data
    const players = await prisma.player.findMany({
      where: { position: { has: position } },
      include: {
        stats: {
          orderBy: { createdAt: 'desc' },
          take: 100, // Last 100 games per player
        },
      },
    });

    const inputs: number[][] = [];
    const outputs: number[] = [];

    for (const player of players) {
      // Create training examples from historical data
      for (let i = 10; i < player.stats.length; i++) {
        // Use previous 10 games to predict the 11th
        const historicalStats = player.stats.slice(i - 10, i);
        const targetStat = player.stats[i];
        
        if (historicalStats.length === 10) {
          // Declare tensor outside try block for cleanup
          let input: tf.Tensor | null = null;
          
          try {
            // Extract features for this training example
            const features = await this.extractFeatures(
              { ...player, stats: historicalStats },
              i, // Use index as week number for training
              targetStat.season
            );
            
            input = this.prepareInputTensor(features, position);
            const inputArray = await input.data();
            
            inputs.push(Array.from(inputArray));
            outputs.push((targetStat.stats as any).fantasy_points_ppr || 0);
          } catch (error) {
            mlLogger.error('Error processing training data', error);
            // Continue with next example
          } finally {
            // Always dispose tensor
            input?.dispose();
          }
        }
      }
    }

    return { inputs, outputs };
  }

  async comparePlayerPredictions(
    playerIds: string[],
    weekNumber: number,
    season?: number
  ): Promise<PredictionResult[]> {
    const predictions = await Promise.all(
      playerIds.map(id => this.predictPlayerPerformance(id, weekNumber, season))
    );

    return predictions
      .filter((p): p is PredictionResult => p !== null)
      .sort((a, b) => b.predictedPoints - a.predictedPoints);
  }

  async updateModelWithResults(
    weekNumber: number,
    season: number = new Date().getFullYear()
  ) {
    mlLogger.info('Updating models with week results', { weekNumber });
    
    // Get actual results for the season
    // Since we don't have week numbers in PlayerStats, we'll use the most recent stats
    const actualResults = await prisma.playerStats.findMany({
      where: {
        season,
      },
      include: {
        player: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
      take: 100, // Get recent stats
    });

    // Group by position
    const resultsByPosition = new Map<string, any[]>();
    
    for (const result of actualResults) {
      const position = result.player.position[0];
      if (!resultsByPosition.has(position)) {
        resultsByPosition.set(position, []);
      }
      resultsByPosition.get(position)!.push(result);
    }

    // Update each model
    for (const [position, results] of resultsByPosition) {
      const model = this.models.get(position);
      if (!model) continue;

      // Prepare incremental training data
      const inputs: number[][] = [];
      const outputs: number[] = [];

      for (const result of results) {
        // Get historical data for this player
        const historicalStats = await prisma.playerStats.findMany({
          where: {
            playerId: result.playerId,
            season,
          },
          orderBy: { createdAt: 'desc' },
          take: 10,
        });

        if (historicalStats.length >= 5) {
          const features = await this.extractFeatures(
            { ...result.player, stats: historicalStats },
            weekNumber,
            season
          );
          
          const input = this.prepareInputTensor(features, position);
          const inputArray = await input.data();
          
          inputs.push(Array.from(inputArray));
          outputs.push((result.stats as any).fantasy_points_ppr || 0);
          
          input.dispose();
        }
      }

      if (inputs.length > 0) {
        // Declare tensors outside try block for cleanup
        let inputTensor: tf.Tensor | null = null;
        let outputTensor: tf.Tensor | null = null;
        
        try {
          // Incremental training
          inputTensor = tf.tensor2d(inputs);
          outputTensor = tf.tensor2d(outputs.map(o => [o]));
          
          await model.fit(inputTensor, outputTensor, {
            epochs: 10, // Fewer epochs for incremental updates
            batchSize: 16,
          });
          
          // Save updated model
          await model.save(`file://./models/${position.toLowerCase()}_model.json`);
          mlLogger.info('Updated model with new examples', { position, exampleCount: inputs.length });
        } catch (error) {
          mlLogger.error('Error updating model', error, { position });
        } finally {
          // Always cleanup tensors
          inputTensor?.dispose();
          outputTensor?.dispose();
        }
      }
    }
  }

  // Cleanup resources
  dispose() {
    for (const model of this.models.values()) {
      model.dispose();
    }
    this.models.clear();
  }
}

// Singleton instance
export const mlEngine = new MLPredictionEngine();
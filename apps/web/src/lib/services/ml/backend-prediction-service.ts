/**
 * 🧠 Backend ML Prediction Service
 * Handles TensorFlow operations on the server side
 */

import { logger } from '@/lib/logging/logger';
import { db } from '@/lib/database/connection-manager';
import * as tf from '@tensorflow/tfjs-node-gpu';
import path from 'path';
import fs from 'fs/promises';

interface PredictionRequest {
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL';
  playerId: string;
  features: {
    recentGames: Array<{
      fantasyPoints: number;
      minutes?: number;
      opponent: string;
      isHome: boolean;
      daysRest: number;
    }>;
    seasonAverage: number;
    careerAverage: number;
    vsTeamAverage?: number;
    injuryStatus?: 'healthy' | 'questionable' | 'doubtful';
  };
  modelType: 'standard' | 'advanced' | 'ensemble';
}

interface PredictionResult {
  projectedPoints: number;
  confidence: number;
  range: {
    low: number;
    high: number;
  };
  factors: Array<{
    name: string;
    impact: number;
    value: any;
  }>;
  modelVersion: string;
}

export class MLPredictionService {
  private models: Map<string, tf.LayersModel> = new Map();
  private initialized = false;
  private modelVersion = '2025.1.0';
  private readonly modelsPath = path.join(process.cwd(), 'models');

  /**
   * Initialize the service and load models
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    try {
      logger.info('Initializing ML prediction service...');
      
      // Set up TensorFlow backend
      await tf.ready();
      
      // Log GPU availability
      const gpuAvailable = tf.env().get('WEBGL_VERSION') > 0;
      logger.info('TensorFlow initialized', {
        backend: tf.getBackend(),
        gpuAvailable,
        tfVersion: tf.version.tfjs,
      });
      
      // Load models for each sport
      await this.loadModels();
      
      this.initialized = true;
      logger.info('ML prediction service initialized successfully');
      
    } catch (error) {
      logger.error('Failed to initialize ML service', { error });
      throw error;
    }
  }

  /**
   * Load pre-trained models
   */
  private async loadModels(): Promise<void> {
    const sports = ['NFL', 'NBA', 'MLB', 'NHL'];
    
    for (const sport of sports) {
      try {
        const modelPath = path.join(this.modelsPath, sport.toLowerCase(), 'model.json');
        
        // Check if model exists
        const exists = await fs.access(modelPath).then(() => true).catch(() => false);
        
        if (exists) {
          const model = await tf.loadLayersModel(`file://${modelPath}`);
          this.models.set(sport, model);
          logger.info(`Loaded ${sport} model`);
        } else {
          logger.warn(`Model not found for ${sport}, using mock model`);
          // Create a simple mock model for development
          const mockModel = this.createMockModel();
          this.models.set(sport, mockModel);
        }
      } catch (error) {
        logger.error(`Failed to load ${sport} model`, { error });
        // Use mock model as fallback
        const mockModel = this.createMockModel();
        this.models.set(sport, mockModel);
      }
    }
  }

  /**
   * Create a mock model for development/testing
   */
  private createMockModel(): tf.LayersModel {
    const input = tf.input({ shape: [10] });
    const dense1 = tf.layers.dense({ units: 64, activation: 'relu' }).apply(input);
    const dense2 = tf.layers.dense({ units: 32, activation: 'relu' }).apply(dense1);
    const output = tf.layers.dense({ units: 1, activation: 'linear' }).apply(dense2);
    
    const model = tf.model({ inputs: input, outputs: output as tf.SymbolicTensor });
    model.compile({
      optimizer: 'adam',
      loss: 'meanSquaredError',
    });
    
    return model;
  }

  /**
   * Make a prediction
   */
  async predict(request: PredictionRequest): Promise<PredictionResult> {
    if (!this.initialized) {
      await this.initialize();
    }

    const startTime = Date.now();
    
    try {
      // Get model for sport
      const model = this.models.get(request.sport);
      if (!model) {
        throw new Error(`No model available for ${request.sport}`);
      }
      
      // Prepare features
      const features = await this.prepareFeatures(request);
      
      // Make prediction
      const prediction = await this.runPrediction(model, features);
      
      // Calculate confidence and range
      const confidence = this.calculateConfidence(request, prediction);
      const range = this.calculateRange(prediction, confidence);
      
      // Identify key factors
      const factors = this.identifyKeyFactors(request, prediction);
      
      const duration = Date.now() - startTime;
      logger.info('ML prediction completed', {
        sport: request.sport,
        playerId: request.playerId,
        prediction: prediction,
        confidence,
        duration,
      });
      
      return {
        projectedPoints: prediction,
        confidence,
        range,
        factors,
        modelVersion: this.modelVersion,
      };
      
    } catch (error) {
      logger.error('Prediction failed', { error, request });
      throw error;
    }
  }

  /**
   * Prepare feature vector for model
   */
  private async prepareFeatures(request: PredictionRequest): Promise<number[]> {
    const features: number[] = [];
    
    // Recent game features (last 5 games)
    const recentGames = request.features.recentGames.slice(-5);
    const recentAvg = recentGames.reduce((sum, g) => sum + g.fantasyPoints, 0) / recentGames.length || 0;
    const recentStd = this.calculateStd(recentGames.map(g => g.fantasyPoints));
    
    features.push(recentAvg);
    features.push(recentStd);
    features.push(request.features.seasonAverage);
    features.push(request.features.careerAverage);
    
    // Home/away split
    const homeGames = recentGames.filter(g => g.isHome);
    const awayGames = recentGames.filter(g => !g.isHome);
    features.push(homeGames.length > 0 ? homeGames.reduce((sum, g) => sum + g.fantasyPoints, 0) / homeGames.length : recentAvg);
    features.push(awayGames.length > 0 ? awayGames.reduce((sum, g) => sum + g.fantasyPoints, 0) / awayGames.length : recentAvg);
    
    // Rest days
    const avgRest = recentGames.reduce((sum, g) => sum + g.daysRest, 0) / recentGames.length || 1;
    features.push(avgRest);
    
    // Injury factor
    const injuryFactor = request.features.injuryStatus === 'healthy' ? 1.0 : 
                        request.features.injuryStatus === 'questionable' ? 0.9 : 0.75;
    features.push(injuryFactor);
    
    // Trend (recent vs season average)
    const trend = recentAvg / (request.features.seasonAverage || recentAvg);
    features.push(trend);
    
    // Consistency factor
    const consistency = recentStd > 0 ? recentAvg / recentStd : 1;
    features.push(consistency);
    
    return features;
  }

  /**
   * Run model prediction
   */
  private async runPrediction(model: tf.LayersModel, features: number[]): Promise<number> {
    const input = tf.tensor2d([features]);
    
    try {
      const output = model.predict(input) as tf.Tensor;
      const prediction = await output.data();
      
      // Cleanup tensors
      input.dispose();
      output.dispose();
      
      return prediction[0];
    } catch (error) {
      input.dispose();
      throw error;
    }
  }

  /**
   * Calculate prediction confidence
   */
  private calculateConfidence(request: PredictionRequest, prediction: number): number {
    let confidence = 0.7; // Base confidence
    
    // More recent games = higher confidence
    if (request.features.recentGames.length >= 5) confidence += 0.1;
    
    // Healthy = higher confidence
    if (request.features.injuryStatus === 'healthy') confidence += 0.1;
    
    // Consistent performance = higher confidence
    const std = this.calculateStd(request.features.recentGames.map(g => g.fantasyPoints));
    if (std < request.features.seasonAverage * 0.2) confidence += 0.05;
    
    // Cap confidence
    return Math.min(confidence, 0.95);
  }

  /**
   * Calculate prediction range
   */
  private calculateRange(prediction: number, confidence: number): { low: number; high: number } {
    const variance = prediction * (1 - confidence) * 0.5;
    
    return {
      low: Math.max(0, prediction - variance),
      high: prediction + variance,
    };
  }

  /**
   * Identify key factors affecting prediction
   */
  private identifyKeyFactors(request: PredictionRequest, prediction: number): Array<{ name: string; impact: number; value: any }> {
    const factors: Array<{ name: string; impact: number; value: any }> = [];
    
    // Recent form
    const recentAvg = request.features.recentGames.reduce((sum, g) => sum + g.fantasyPoints, 0) / request.features.recentGames.length || 0;
    const formImpact = (recentAvg - request.features.seasonAverage) / request.features.seasonAverage;
    
    factors.push({
      name: 'Recent Form',
      impact: formImpact,
      value: `${recentAvg.toFixed(1)} pts (last ${request.features.recentGames.length} games)`,
    });
    
    // Injury status
    if (request.features.injuryStatus && request.features.injuryStatus !== 'healthy') {
      factors.push({
        name: 'Injury Status',
        impact: -0.1,
        value: request.features.injuryStatus,
      });
    }
    
    // Home/away
    const lastGame = request.features.recentGames[request.features.recentGames.length - 1];
    if (lastGame) {
      factors.push({
        name: 'Venue',
        impact: lastGame.isHome ? 0.05 : -0.05,
        value: lastGame.isHome ? 'Home' : 'Away',
      });
    }
    
    // Sort by impact
    factors.sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));
    
    return factors;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStd(values: number[]): number {
    if (values.length === 0) return 0;
    
    const mean = values.reduce((sum, v) => sum + v, 0) / values.length;
    const variance = values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{
    isHealthy: boolean;
    models: Record<string, boolean>;
    tensorflowVersion: string;
    gpuAvailable: boolean;
  }> {
    const models: Record<string, boolean> = {};
    
    for (const [sport, model] of this.models.entries()) {
      models[sport] = model !== null;
    }
    
    return {
      isHealthy: this.initialized && Object.values(models).some(v => v),
      models,
      tensorflowVersion: tf.version.tfjs,
      gpuAvailable: tf.getBackend() === 'webgl' || tf.getBackend() === 'gpu',
    };
  }

  /**
   * Cleanup resources
   */
  async cleanup(): Promise<void> {
    for (const [sport, model] of this.models.entries()) {
      model.dispose();
    }
    this.models.clear();
    this.initialized = false;
  }
}
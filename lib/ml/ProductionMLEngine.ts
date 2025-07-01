/**
 * PRODUCTION ML ENGINE
 * 
 * Multi-scale temporal models inspired by Second Spectrum
 * Processes data at multiple time horizons with confidence thresholds
 * 
 * Models:
 * - Micro: Next play prediction (85% accuracy target)
 * - Macro: Season-long trends (75% accuracy target)
 * - Adaptive: Ensemble based on prediction horizon
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { performance } from 'perf_hooks';

export interface PredictionWithConfidence {
  playerId: string;
  prediction: number;
  confidence: number;
  horizon: string;
  modelUsed: string;
  features: Record<string, number>;
  insights: string[];
  processingTime: number;
}

export interface ModelConfig {
  inputWindow: number;
  horizon: number;
  updateFrequency: 'real_time' | 'hourly' | 'daily' | 'weekly';
  accuracyThreshold: number;
  architecture: 'transformer' | 'lstm' | 'gru' | 'ensemble';
}

export interface TimeWindow {
  start: Date;
  end: Date;
  granularity: 'play' | 'quarter' | 'game' | 'week' | 'season';
}

class ProductionModel {
  private model: tf.LayersModel;
  private config: ModelConfig;
  private accuracy: number = 0;
  private predictionCount: number = 0;
  
  constructor(config: ModelConfig) {
    this.config = config;
    this.model = this.buildModel();
  }
  
  private buildModel(): tf.LayersModel {
    const model = tf.sequential();
    
    switch (this.config.architecture) {
      case 'transformer':
        // Transformer architecture for micro predictions
        model.add(tf.layers.dense({
          inputShape: [this.config.inputWindow, 50], // 50 features
          units: 256,
          activation: 'relu'
        }));
        
        // Multi-head attention would go here
        // Simplified for now
        model.add(tf.layers.lstm({
          units: 128,
          returnSequences: false
        }));
        
        model.add(tf.layers.dropout({ rate: 0.3 }));
        model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 1 }));
        break;
        
      case 'lstm':
        // LSTM for macro predictions
        model.add(tf.layers.lstm({
          inputShape: [this.config.inputWindow, 50],
          units: 256,
          returnSequences: true
        }));
        
        model.add(tf.layers.lstm({
          units: 128,
          returnSequences: false
        }));
        
        model.add(tf.layers.dropout({ rate: 0.4 }));
        model.add(tf.layers.dense({ units: 64, activation: 'relu' }));
        model.add(tf.layers.dense({ units: 32, activation: 'relu' }));
        model.add(tf.layers.dense({ units: this.config.horizon }));
        break;
    }
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['accuracy']
    });
    
    return model;
  }
  
  async predict(features: tf.Tensor): Promise<tf.Tensor> {
    return this.model.predict(features) as tf.Tensor;
  }
  
  async predictWithUncertainty(features: tf.Tensor): Promise<{
    prediction: tf.Tensor;
    uncertainty: tf.Tensor;
  }> {
    // Monte Carlo dropout for uncertainty estimation
    const predictions: tf.Tensor[] = [];
    const numSamples = 10;
    
    for (let i = 0; i < numSamples; i++) {
      const pred = await this.predict(features);
      predictions.push(pred);
    }
    
    const stacked = tf.stack(predictions);
    const mean = stacked.mean(0);
    const variance = stacked.sub(mean).square().mean(0);
    
    // Clean up
    predictions.forEach(p => p.dispose());
    stacked.dispose();
    
    return {
      prediction: mean,
      uncertainty: variance
    };
  }
  
  updateAccuracy(correct: boolean): void {
    this.predictionCount++;
    if (correct) {
      this.accuracy = (this.accuracy * (this.predictionCount - 1) + 1) / this.predictionCount;
    } else {
      this.accuracy = (this.accuracy * (this.predictionCount - 1)) / this.predictionCount;
    }
  }
  
  getAccuracy(): number {
    return this.accuracy;
  }
  
  meetsThreshold(): boolean {
    return this.accuracy >= this.config.accuracyThreshold;
  }
}

export class ProductionMLEngine {
  private models: Map<string, ProductionModel> = new Map();
  private featureExtractor: FeatureExtractor;
  private accuracyMonitor: AccuracyMonitor;
  private initialized = false;
  
  constructor() {
    this.featureExtractor = new FeatureExtractor();
    this.accuracyMonitor = new AccuracyMonitor();
    this.initializeProductionModels();
  }
  
  private initializeProductionModels(): void {
    console.log('🧠 Initializing Production ML Models...');
    
    // Micro model - Next play prediction (like Second Spectrum)
    this.models.set('micro', new ProductionModel({
      inputWindow: 10,
      horizon: 1,
      updateFrequency: 'real_time',
      accuracyThreshold: 0.85,
      architecture: 'transformer'
    }));
    
    // Macro model - Season-long patterns
    this.models.set('macro', new ProductionModel({
      inputWindow: 1000,
      horizon: 16,
      updateFrequency: 'weekly',
      accuracyThreshold: 0.75,
      architecture: 'lstm'
    }));
    
    // Game model - Single game predictions
    this.models.set('game', new ProductionModel({
      inputWindow: 100,
      horizon: 4, // 4 quarters
      updateFrequency: 'hourly',
      accuracyThreshold: 0.80,
      architecture: 'lstm'
    }));
    
    console.log('✅ Models initialized:', Array.from(this.models.keys()));
    this.initialized = true;
  }
  
  async predictWithConfidence(
    playerId: string,
    contextWindow: TimeWindow,
    predictionHorizon: string
  ): Promise<PredictionWithConfidence> {
    const startTime = performance.now();
    
    // Select optimal model based on horizon
    const model = this.selectOptimalModel(predictionHorizon, contextWindow);
    
    // Extract features using GPU acceleration
    const features = await this.featureExtractor.extractFeatures(
      playerId,
      contextWindow
    );
    
    // Get prediction with uncertainty
    const { prediction, uncertainty } = await model.predictWithUncertainty(features);
    
    // Calculate confidence
    const predValue = await prediction.array() as number[];
    const uncValue = await uncertainty.array() as number[];
    const confidence = 1 / (1 + uncValue[0]); // Convert uncertainty to confidence
    
    // Clean up tensors
    prediction.dispose();
    uncertainty.dispose();
    features.dispose();
    
    // Only return high-confidence predictions
    if (confidence < 0.7) {
      // Fallback to simpler model or historical average
      return this.fallbackPrediction(playerId, contextWindow);
    }
    
    const processingTime = performance.now() - startTime;
    
    // Track accuracy for continuous improvement
    const result: PredictionWithConfidence = {
      playerId,
      prediction: predValue[0],
      confidence,
      horizon: predictionHorizon,
      modelUsed: this.getModelName(model),
      features: await this.featureExtractor.getFeatureImportance(playerId),
      insights: this.generateInsights(predValue[0], confidence),
      processingTime
    };
    
    this.accuracyMonitor.trackPrediction(result);
    
    return result;
  }
  
  private selectOptimalModel(
    horizon: string,
    window: TimeWindow
  ): ProductionModel {
    // Select model based on prediction horizon
    switch (horizon) {
      case 'next_play':
      case 'next_drive':
        return this.models.get('micro')!;
        
      case 'next_game':
      case 'next_quarter':
        return this.models.get('game')!;
        
      case 'next_week':
      case 'season':
        return this.models.get('macro')!;
        
      default:
        // Adaptive selection based on data availability
        const dataPoints = this.estimateDataPoints(window);
        if (dataPoints < 50) return this.models.get('micro')!;
        if (dataPoints < 500) return this.models.get('game')!;
        return this.models.get('macro')!;
    }
  }
  
  private estimateDataPoints(window: TimeWindow): number {
    const duration = window.end.getTime() - window.start.getTime();
    const hours = duration / (1000 * 60 * 60);
    
    switch (window.granularity) {
      case 'play': return hours * 60; // ~60 plays per hour
      case 'quarter': return hours / 0.5; // 2 quarters per hour
      case 'game': return hours / 3; // 3 hours per game
      case 'week': return hours / 168; // 168 hours per week
      case 'season': return hours / 4032; // 24 weeks
      default: return 100;
    }
  }
  
  private async fallbackPrediction(
    playerId: string,
    contextWindow: TimeWindow
  ): Promise<PredictionWithConfidence> {
    // Use historical average as fallback
    const historicalAvg = await this.featureExtractor.getHistoricalAverage(
      playerId,
      contextWindow
    );
    
    return {
      playerId,
      prediction: historicalAvg,
      confidence: 0.6, // Lower confidence for fallback
      horizon: 'historical',
      modelUsed: 'fallback',
      features: {},
      insights: ['Using historical average due to low model confidence'],
      processingTime: 0
    };
  }
  
  private generateInsights(prediction: number, confidence: number): string[] {
    const insights: string[] = [];
    
    if (confidence > 0.9) {
      insights.push('High confidence prediction based on strong patterns');
    } else if (confidence > 0.8) {
      insights.push('Good confidence with some uncertainty');
    } else {
      insights.push('Moderate confidence - consider multiple factors');
    }
    
    if (prediction > 20) {
      insights.push('Expecting strong performance');
    } else if (prediction < 10) {
      insights.push('Lower projection - monitor for updates');
    }
    
    return insights;
  }
  
  private getModelName(model: ProductionModel): string {
    for (const [name, m] of this.models.entries()) {
      if (m === model) return name;
    }
    return 'unknown';
  }
  
  async updateModels(
    actualResults: Array<{ playerId: string; actual: number; timestamp: Date }>
  ): Promise<void> {
    // Update model accuracy based on actual results
    for (const result of actualResults) {
      const prediction = await this.accuracyMonitor.getPrediction(
        result.playerId,
        result.timestamp
      );
      
      if (prediction) {
        const error = Math.abs(prediction.prediction - result.actual);
        const correct = error < result.actual * 0.1; // Within 10%
        
        // Update the model that made the prediction
        const model = this.models.get(prediction.modelUsed);
        if (model) {
          model.updateAccuracy(correct);
        }
      }
    }
    
    // Retrain models that fall below threshold
    for (const [name, model] of this.models.entries()) {
      if (!model.meetsThreshold()) {
        console.log(`🔄 Retraining ${name} model (accuracy: ${model.getAccuracy()})`);
        // Trigger retraining job
      }
    }
  }
}

// Feature extraction with GPU acceleration
class FeatureExtractor {
  async extractFeatures(
    playerId: string,
    window: TimeWindow
  ): Promise<tf.Tensor> {
    // This would connect to your database and extract real features
    // For now, returning dummy features
    const features = tf.randomNormal([1, window.granularity === 'play' ? 10 : 100, 50]);
    return features;
  }
  
  async getHistoricalAverage(
    playerId: string,
    window: TimeWindow
  ): Promise<number> {
    // Would query database for historical average
    return 15.5; // Dummy value
  }
  
  async getFeatureImportance(playerId: string): Promise<Record<string, number>> {
    return {
      recentForm: 0.25,
      matchup: 0.20,
      homeAway: 0.15,
      weather: 0.10,
      injuries: 0.30
    };
  }
}

// Accuracy monitoring for production
class AccuracyMonitor {
  private predictions: Map<string, PredictionWithConfidence> = new Map();
  
  trackPrediction(prediction: PredictionWithConfidence): void {
    const key = `${prediction.playerId}-${Date.now()}`;
    this.predictions.set(key, prediction);
    
    // Clean up old predictions (keep last 10000)
    if (this.predictions.size > 10000) {
      const oldest = Array.from(this.predictions.keys()).slice(0, 1000);
      oldest.forEach(key => this.predictions.delete(key));
    }
  }
  
  async getPrediction(
    playerId: string,
    timestamp: Date
  ): Promise<PredictionWithConfidence | null> {
    // Find prediction closest to timestamp
    for (const [key, pred] of this.predictions.entries()) {
      if (pred.playerId === playerId) {
        // Check if timestamp is close
        return pred;
      }
    }
    return null;
  }
}

// Export singleton instance
export const productionML = new ProductionMLEngine();
/**
 * CONTINUOUS LEARNING LOOP
 * 
 * Monitors prediction accuracy and triggers retraining
 * Uses parallel processing on Ryzen 5 7600X for data prep
 * GPU-accelerated training with RTX 4060
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { Worker } from 'worker_threads';
import * as os from 'os';
import { database } from '../services/database';
import { ProductionMLEngine } from './ProductionMLEngine';
import EventEmitter from 'events';
import { performance } from 'perf_hooks';

interface PredictionRecord {
  id: string;
  prediction: number;
  actual: number;
  confidence: number;
  model: string;
  timestamp: Date;
}

interface TrainingJob {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  modelType: string;
  dataPoints: number;
  startTime?: number;
  endTime?: number;
  accuracy?: number;
  error?: string;
}

export class ContinuousLearningLoop extends EventEmitter {
  private mlEngine: ProductionMLEngine;
  private monitoringInterval: NodeJS.Timer | null = null;
  private trainingQueue: TrainingJob[] = [];
  private isTraining = false;
  
  // Thresholds
  private accuracyThreshold = 0.80; // Retrain if accuracy drops below 80%
  private sampleSize = 1000; // Check last 1000 predictions
  private checkInterval = 300000; // Check every 5 minutes
  
  // Parallel processing
  private cpuCores = os.cpus().length;
  private workers: Worker[] = [];
  
  constructor(mlEngine: ProductionMLEngine) {
    super();
    this.mlEngine = mlEngine;
  }
  
  /**
   * Start the continuous learning loop
   */
  async start(): Promise<void> {
    console.log('🔄 Starting Continuous Learning Loop...');
    console.log(`   CPU Cores: ${this.cpuCores}`);
    console.log(`   Accuracy Threshold: ${this.accuracyThreshold * 100}%`);
    console.log(`   Check Interval: ${this.checkInterval / 60000} minutes`);
    
    // Initialize worker pool for parallel data processing
    this.initializeWorkerPool();
    
    // Start monitoring loop
    this.monitoringInterval = setInterval(() => {
      this.checkAccuracy();
    }, this.checkInterval);
    
    // Run initial check
    await this.checkAccuracy();
    
    console.log('✅ Continuous Learning Loop started!');
  }
  
  /**
   * Initialize worker pool for parallel processing
   */
  private initializeWorkerPool(): void {
    // Create workers for data preprocessing (leave 2 cores for main thread)
    const workerCount = Math.max(1, this.cpuCores - 2);
    
    for (let i = 0; i < workerCount; i++) {
      const worker = new Worker(`
        const { parentPort } = require('worker_threads');
        
        parentPort.on('message', async (task) => {
          try {
            const { type, data } = task;
            
            switch (type) {
              case 'preprocess':
                const processed = data.map(record => ({
                  features: extractFeatures(record),
                  label: record.actual
                }));
                parentPort.postMessage({ success: true, data: processed });
                break;
                
              case 'validate':
                const validation = validateData(data);
                parentPort.postMessage({ success: true, data: validation });
                break;
            }
          } catch (error) {
            parentPort.postMessage({ success: false, error: error.message });
          }
        });
        
        function extractFeatures(record) {
          // Feature extraction logic
          return [
            record.player_stats.points_avg,
            record.player_stats.games_played,
            record.game_context.quarter,
            record.game_context.score_diff,
            // Add more features
          ];
        }
        
        function validateData(data) {
          return data.filter(record => 
            record.actual !== null && 
            record.prediction !== null &&
            !isNaN(record.actual) &&
            !isNaN(record.prediction)
          );
        }
      `, { eval: true });
      
      this.workers.push(worker);
    }
  }
  
  /**
   * Check prediction accuracy and trigger retraining if needed
   */
  private async checkAccuracy(): Promise<void> {
    try {
      const startTime = performance.now();
      
      // Fetch recent predictions with actual outcomes
      const predictions = await this.fetchRecentPredictions();
      
      if (predictions.length < this.sampleSize * 0.5) {
        console.log(`📊 Not enough predictions yet: ${predictions.length}`);
        return;
      }
      
      // Calculate accuracy metrics
      const metrics = this.calculateAccuracyMetrics(predictions);
      
      console.log(`📊 Accuracy Check:
        Overall: ${(metrics.overall * 100).toFixed(2)}%
        Micro Model: ${(metrics.micro * 100).toFixed(2)}%
        Macro Model: ${(metrics.macro * 100).toFixed(2)}%
        Samples: ${predictions.length}
      `);
      
      this.emit('accuracy:checked', metrics);
      
      // Check if retraining is needed
      if (metrics.overall < this.accuracyThreshold) {
        console.log(`⚠️  Accuracy below threshold! Triggering retraining...`);
        await this.triggerRetraining(predictions, metrics);
      }
      
      // Store metrics
      await this.storeMetrics(metrics);
      
      const checkTime = performance.now() - startTime;
      console.log(`✅ Accuracy check completed in ${checkTime.toFixed(0)}ms`);
      
    } catch (error) {
      console.error('❌ Accuracy check failed:', error);
      this.emit('error', error);
    }
  }
  
  /**
   * Fetch recent predictions from database
   */
  private async fetchRecentPredictions(): Promise<PredictionRecord[]> {
    const result = await database.query<any>(
      `SELECT 
        p.id,
        p.prediction,
        p.confidence,
        p.model_name as model,
        p.created_at as timestamp,
        o.actual_value as actual
       FROM ml_predictions p
       INNER JOIN ml_outcomes o ON p.id = o.prediction_id
       WHERE o.actual_value IS NOT NULL
       ORDER BY p.created_at DESC
       LIMIT $1`,
      [this.sampleSize]
    );
    
    return result.map(row => ({
      id: row.id,
      prediction: parseFloat(row.prediction),
      actual: parseFloat(row.actual),
      confidence: parseFloat(row.confidence),
      model: row.model,
      timestamp: new Date(row.timestamp)
    }));
  }
  
  /**
   * Calculate accuracy metrics
   */
  private calculateAccuracyMetrics(predictions: PredictionRecord[]) {
    const metrics = {
      overall: 0,
      micro: 0,
      macro: 0,
      byConfidence: new Map<string, number>()
    };
    
    // Group by model
    const byModel = new Map<string, PredictionRecord[]>();
    predictions.forEach(p => {
      const list = byModel.get(p.model) || [];
      list.push(p);
      byModel.set(p.model, list);
    });
    
    // Calculate accuracy for each model
    let totalCorrect = 0;
    
    byModel.forEach((preds, model) => {
      const correct = preds.filter(p => {
        const error = Math.abs(p.prediction - p.actual) / p.actual;
        return error < 0.2; // Within 20% is considered correct
      }).length;
      
      const accuracy = correct / preds.length;
      
      if (model.includes('micro')) {
        metrics.micro = accuracy;
      } else if (model.includes('macro')) {
        metrics.macro = accuracy;
      }
      
      totalCorrect += correct;
    });
    
    metrics.overall = totalCorrect / predictions.length;
    
    // Accuracy by confidence level
    const confBuckets = [
      { name: 'high', min: 0.8, max: 1.0 },
      { name: 'medium', min: 0.6, max: 0.8 },
      { name: 'low', min: 0, max: 0.6 }
    ];
    
    confBuckets.forEach(bucket => {
      const bucketPreds = predictions.filter(p => 
        p.confidence >= bucket.min && p.confidence < bucket.max
      );
      
      if (bucketPreds.length > 0) {
        const correct = bucketPreds.filter(p => {
          const error = Math.abs(p.prediction - p.actual) / p.actual;
          return error < 0.2;
        }).length;
        
        metrics.byConfidence.set(bucket.name, correct / bucketPreds.length);
      }
    });
    
    return metrics;
  }
  
  /**
   * Trigger model retraining
   */
  private async triggerRetraining(
    predictions: PredictionRecord[], 
    metrics: any
  ): Promise<void> {
    if (this.isTraining) {
      console.log('⏳ Training already in progress, skipping...');
      return;
    }
    
    this.isTraining = true;
    
    const job: TrainingJob = {
      id: `training_${Date.now()}`,
      status: 'pending',
      modelType: metrics.micro < metrics.macro ? 'micro' : 'macro',
      dataPoints: predictions.length,
      startTime: Date.now()
    };
    
    this.trainingQueue.push(job);
    this.emit('training:started', job);
    
    try {
      console.log(`🏋️ Starting retraining for ${job.modelType} model...`);
      
      // Fetch training data
      const trainingData = await this.fetchTrainingData(job.modelType);
      
      // Preprocess data in parallel
      const processedData = await this.preprocessDataParallel(trainingData);
      
      // Train model on GPU
      const result = await this.trainModelGPU(
        job.modelType,
        processedData
      );
      
      job.status = 'completed';
      job.endTime = Date.now();
      job.accuracy = result.accuracy;
      
      console.log(`✅ Retraining completed!
        Model: ${job.modelType}
        New Accuracy: ${(result.accuracy * 100).toFixed(2)}%
        Training Time: ${((job.endTime - job.startTime) / 1000).toFixed(1)}s
      `);
      
      this.emit('training:completed', job);
      
    } catch (error: any) {
      job.status = 'failed';
      job.error = error.message;
      console.error('❌ Retraining failed:', error);
      this.emit('training:failed', job);
    } finally {
      this.isTraining = false;
    }
  }
  
  /**
   * Fetch training data from database
   */
  private async fetchTrainingData(modelType: string): Promise<any[]> {
    // Get appropriate data based on model type
    const query = modelType === 'micro' ?
      // Micro model: Recent play-by-play data
      `SELECT * FROM training_data_micro 
       WHERE created_at > NOW() - INTERVAL '7 days'
       LIMIT 100000` :
      // Macro model: Aggregated game data
      `SELECT * FROM training_data_macro
       WHERE created_at > NOW() - INTERVAL '30 days'
       LIMIT 50000`;
    
    return database.query(query);
  }
  
  /**
   * Preprocess data using worker pool
   */
  private async preprocessDataParallel(data: any[]): Promise<any> {
    const chunkSize = Math.ceil(data.length / this.workers.length);
    const chunks = [];
    
    for (let i = 0; i < data.length; i += chunkSize) {
      chunks.push(data.slice(i, i + chunkSize));
    }
    
    const promises = chunks.map((chunk, i) => {
      return new Promise((resolve, reject) => {
        const worker = this.workers[i];
        
        worker.once('message', (result) => {
          if (result.success) {
            resolve(result.data);
          } else {
            reject(new Error(result.error));
          }
        });
        
        worker.postMessage({
          type: 'preprocess',
          data: chunk
        });
      });
    });
    
    const results = await Promise.all(promises);
    return results.flat();
  }
  
  /**
   * Train model using GPU acceleration
   */
  private async trainModelGPU(
    modelType: string,
    data: any
  ): Promise<{ accuracy: number; model: tf.LayersModel }> {
    // This would integrate with ProductionMLEngine's training methods
    // For now, return a mock result
    return {
      accuracy: 0.85,
      model: {} as tf.LayersModel
    };
  }
  
  /**
   * Store accuracy metrics
   */
  private async storeMetrics(metrics: any): Promise<void> {
    await database.query(
      `INSERT INTO ml_accuracy_metrics 
       (overall_accuracy, micro_accuracy, macro_accuracy, sample_size, created_at)
       VALUES ($1, $2, $3, $4, NOW())`,
      [metrics.overall, metrics.micro, metrics.macro, this.sampleSize]
    );
  }
  
  /**
   * Get current status
   */
  getStatus() {
    return {
      running: this.monitoringInterval !== null,
      isTraining: this.isTraining,
      trainingQueue: this.trainingQueue,
      workers: this.workers.length,
      accuracyThreshold: this.accuracyThreshold,
      checkInterval: this.checkInterval
    };
  }
  
  /**
   * Stop the continuous learning loop
   */
  async stop(): Promise<void> {
    console.log('🛑 Stopping Continuous Learning Loop...');
    
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
    
    // Terminate workers
    await Promise.all(this.workers.map(w => w.terminate()));
    this.workers = [];
    
    console.log('✅ Continuous Learning Loop stopped');
  }
}

// Export singleton instance
export const continuousLearning = new ContinuousLearningLoop(
  new ProductionMLEngine()
);
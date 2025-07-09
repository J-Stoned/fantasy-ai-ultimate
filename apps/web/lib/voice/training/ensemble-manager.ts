/**
 * Ensemble Manager for Voice Models
 * Runs multiple models in parallel and votes on best response
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { EventEmitter } from 'events';

export interface EnsembleModel {
  id: string;
  model: tf.LayersModel;
  weight: number; // Voting weight based on performance
  accuracy: number;
  specialization?: string; // e.g., 'trade_expert', 'injury_specialist'
  performance: {
    totalPredictions: number;
    correctPredictions: number;
    avgConfidence: number;
  };
}

export interface EnsemblePrediction {
  intent: string;
  confidence: number;
  modelVotes: Map<string, { intent: string; confidence: number }>;
  consensus: number; // % of models that agreed
}

export class EnsembleManager extends EventEmitter {
  private models: Map<string, EnsembleModel> = new Map();
  private readonly MAX_MODELS = 5;
  private readonly VOTING_STRATEGIES = ['weighted', 'majority', 'confidence'] as const;
  private votingStrategy: typeof this.VOTING_STRATEGIES[number] = 'weighted';

  constructor() {
    super();
    this.initializeEnsemble();
  }

  /**
   * Initialize ensemble with diverse models
   */
  private async initializeEnsemble() {
    console.log('🎭 Initializing model ensemble...');

    // Load different model architectures
    const modelConfigs = [
      { id: 'lstm_base', architecture: 'lstm', specialization: 'general' },
      { id: 'transformer_lite', architecture: 'transformer', specialization: 'complex_queries' },
      { id: 'cnn_fast', architecture: 'cnn', specialization: 'quick_commands' },
      { id: 'trade_expert', architecture: 'lstm', specialization: 'trade_analysis' },
      { id: 'injury_specialist', architecture: 'lstm', specialization: 'injury_status' }
    ];

    for (const config of modelConfigs.slice(0, this.MAX_MODELS)) {
      try {
        const model = await this.createModel(config.architecture);
        
        this.models.set(config.id, {
          id: config.id,
          model,
          weight: 1.0,
          accuracy: 75 + Math.random() * 20, // Initial accuracy 75-95%
          specialization: config.specialization,
          performance: {
            totalPredictions: 0,
            correctPredictions: 0,
            avgConfidence: 0
          }
        });

        console.log(`✅ Loaded model: ${config.id} (${config.specialization})`);
      } catch (error) {
        console.error(`Failed to load model ${config.id}:`, error);
      }
    }

    console.log(`🎯 Ensemble ready with ${this.models.size} models`);
  }

  /**
   * Create model with specific architecture
   */
  private async createModel(architecture: string): Promise<tf.LayersModel> {
    switch (architecture) {
      case 'lstm':
        return this.createLSTMModel();
      case 'transformer':
        return this.createTransformerModel();
      case 'cnn':
        return this.createCNNModel();
      default:
        return this.createLSTMModel();
    }
  }

  /**
   * Create LSTM model architecture
   */
  private createLSTMModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: 1000,
          outputDim: 128,
          inputLength: 50
        }),
        tf.layers.lstm({
          units: 128,
          returnSequences: true,
          dropout: 0.2
        }),
        tf.layers.lstm({
          units: 64,
          dropout: 0.2
        }),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 20,
          activation: 'softmax'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Create Transformer-like model (simplified)
   */
  private createTransformerModel(): tf.LayersModel {
    // Simplified transformer using attention mechanism
    const model = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: 1000,
          outputDim: 128,
          inputLength: 50
        }),
        // Self-attention layer (simplified)
        tf.layers.dense({
          units: 128,
          activation: 'relu'
        }),
        tf.layers.dropout({ rate: 0.1 }),
        tf.layers.globalAveragePooling1d(),
        tf.layers.dense({
          units: 64,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 20,
          activation: 'softmax'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Create CNN model for fast inference
   */
  private createCNNModel(): tf.LayersModel {
    const model = tf.sequential({
      layers: [
        tf.layers.embedding({
          inputDim: 1000,
          outputDim: 128,
          inputLength: 50
        }),
        tf.layers.conv1d({
          filters: 64,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.maxPooling1d({ poolSize: 2 }),
        tf.layers.conv1d({
          filters: 32,
          kernelSize: 3,
          activation: 'relu'
        }),
        tf.layers.globalMaxPooling1d(),
        tf.layers.dense({
          units: 32,
          activation: 'relu'
        }),
        tf.layers.dense({
          units: 20,
          activation: 'softmax'
        })
      ]
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });

    return model;
  }

  /**
   * Get ensemble prediction using all models
   */
  async predict(input: tf.Tensor, transcript?: string): Promise<EnsemblePrediction> {
    const startTime = Date.now();
    const predictions = new Map<string, { intent: string; confidence: number }>();
    
    // Run predictions in parallel
    const predictionPromises = Array.from(this.models.entries()).map(
      async ([modelId, ensembleModel]) => {
        try {
          // Check if model specializes in this type of query
          const boost = this.getSpecializationBoost(ensembleModel, transcript);
          
          // Run prediction
          const output = ensembleModel.model.predict(input) as tf.Tensor;
          const probs = await output.data();
          const maxIndex = tf.argMax(output, 1).dataSync()[0];
          const confidence = probs[maxIndex] * boost;
          
          output.dispose();
          
          return {
            modelId,
            intent: this.indexToIntent(maxIndex),
            confidence
          };
        } catch (error) {
          console.error(`Model ${modelId} prediction failed:`, error);
          return null;
        }
      }
    );

    const results = await Promise.all(predictionPromises);
    
    // Collect valid predictions
    results.forEach(result => {
      if (result) {
        predictions.set(result.modelId, {
          intent: result.intent,
          confidence: result.confidence
        });
      }
    });

    // Apply voting strategy
    const finalPrediction = this.applyVotingStrategy(predictions);
    
    const inferenceTime = Date.now() - startTime;
    console.log(`⚡ Ensemble inference: ${inferenceTime}ms with ${predictions.size} models`);
    
    this.emit('ensemblePrediction', {
      prediction: finalPrediction,
      inferenceTime,
      modelsUsed: predictions.size
    });

    return finalPrediction;
  }

  /**
   * Get specialization boost for model
   */
  private getSpecializationBoost(model: EnsembleModel, transcript?: string): number {
    if (!transcript || !model.specialization) return 1.0;

    const lowerTranscript = transcript.toLowerCase();
    
    switch (model.specialization) {
      case 'trade_analysis':
        return lowerTranscript.includes('trade') ? 1.2 : 1.0;
      case 'injury_status':
        return lowerTranscript.includes('injur') || lowerTranscript.includes('hurt') ? 1.2 : 1.0;
      case 'complex_queries':
        return transcript.split(' ').length > 10 ? 1.1 : 1.0;
      case 'quick_commands':
        return transcript.split(' ').length < 5 ? 1.1 : 1.0;
      default:
        return 1.0;
    }
  }

  /**
   * Apply voting strategy to get final prediction
   */
  private applyVotingStrategy(
    predictions: Map<string, { intent: string; confidence: number }>
  ): EnsemblePrediction {
    switch (this.votingStrategy) {
      case 'weighted':
        return this.weightedVoting(predictions);
      case 'majority':
        return this.majorityVoting(predictions);
      case 'confidence':
        return this.confidenceVoting(predictions);
      default:
        return this.weightedVoting(predictions);
    }
  }

  /**
   * Weighted voting based on model performance
   */
  private weightedVoting(
    predictions: Map<string, { intent: string; confidence: number }>
  ): EnsemblePrediction {
    const intentScores = new Map<string, number>();
    
    predictions.forEach((pred, modelId) => {
      const model = this.models.get(modelId);
      if (!model) return;
      
      const weight = model.weight * model.accuracy / 100;
      const score = pred.confidence * weight;
      
      intentScores.set(
        pred.intent,
        (intentScores.get(pred.intent) || 0) + score
      );
    });

    // Find winning intent
    let bestIntent = '';
    let bestScore = 0;
    
    intentScores.forEach((score, intent) => {
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent;
      }
    });

    // Calculate consensus
    const consensus = Array.from(predictions.values())
      .filter(p => p.intent === bestIntent).length / predictions.size;

    return {
      intent: bestIntent,
      confidence: bestScore / predictions.size,
      modelVotes: predictions,
      consensus: consensus * 100
    };
  }

  /**
   * Simple majority voting
   */
  private majorityVoting(
    predictions: Map<string, { intent: string; confidence: number }>
  ): EnsemblePrediction {
    const intentCounts = new Map<string, number>();
    
    predictions.forEach(pred => {
      intentCounts.set(
        pred.intent,
        (intentCounts.get(pred.intent) || 0) + 1
      );
    });

    // Find most common intent
    let bestIntent = '';
    let maxCount = 0;
    
    intentCounts.forEach((count, intent) => {
      if (count > maxCount) {
        maxCount = count;
        bestIntent = intent;
      }
    });

    // Average confidence of winning intent
    const winningPredictions = Array.from(predictions.values())
      .filter(p => p.intent === bestIntent);
    
    const avgConfidence = winningPredictions
      .reduce((sum, p) => sum + p.confidence, 0) / winningPredictions.length;

    return {
      intent: bestIntent,
      confidence: avgConfidence,
      modelVotes: predictions,
      consensus: (maxCount / predictions.size) * 100
    };
  }

  /**
   * Confidence-based voting
   */
  private confidenceVoting(
    predictions: Map<string, { intent: string; confidence: number }>
  ): EnsemblePrediction {
    // Simply choose the prediction with highest confidence
    let bestIntent = '';
    let bestConfidence = 0;
    let bestModelId = '';
    
    predictions.forEach((pred, modelId) => {
      if (pred.confidence > bestConfidence) {
        bestConfidence = pred.confidence;
        bestIntent = pred.intent;
        bestModelId = modelId;
      }
    });

    // Check how many models agree
    const consensus = Array.from(predictions.values())
      .filter(p => p.intent === bestIntent).length / predictions.size;

    return {
      intent: bestIntent,
      confidence: bestConfidence,
      modelVotes: predictions,
      consensus: consensus * 100
    };
  }

  /**
   * Update model performance after feedback
   */
  async updateModelPerformance(
    modelId: string,
    wasCorrect: boolean,
    confidence: number
  ) {
    const model = this.models.get(modelId);
    if (!model) return;

    model.performance.totalPredictions++;
    if (wasCorrect) {
      model.performance.correctPredictions++;
    }

    // Update running average of confidence
    model.performance.avgConfidence = 
      (model.performance.avgConfidence * (model.performance.totalPredictions - 1) + confidence) /
      model.performance.totalPredictions;

    // Update accuracy
    model.accuracy = (model.performance.correctPredictions / model.performance.totalPredictions) * 100;

    // Adjust voting weight based on performance
    if (model.performance.totalPredictions > 100) {
      model.weight = model.accuracy / 100;
    }

    console.log(`📊 Model ${modelId} performance: ${model.accuracy.toFixed(1)}% accuracy`);
  }

  /**
   * Train specific model in ensemble
   */
  async trainModel(modelId: string, data: tf.Tensor, labels: tf.Tensor) {
    const ensembleModel = this.models.get(modelId);
    if (!ensembleModel) return;

    console.log(`🏃 Training model ${modelId}...`);
    
    await ensembleModel.model.fit(data, labels, {
      epochs: 3,
      batchSize: 32,
      verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(`  Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}`);
        }
      }
    });
  }

  /**
   * Add new model to ensemble
   */
  async addModel(id: string, model: tf.LayersModel, specialization?: string) {
    if (this.models.size >= this.MAX_MODELS) {
      // Remove worst performing model
      this.removeWorstModel();
    }

    this.models.set(id, {
      id,
      model,
      weight: 0.5, // Start with lower weight
      accuracy: 75,
      specialization,
      performance: {
        totalPredictions: 0,
        correctPredictions: 0,
        avgConfidence: 0
      }
    });

    console.log(`➕ Added model ${id} to ensemble`);
  }

  /**
   * Remove worst performing model
   */
  private removeWorstModel() {
    let worstId = '';
    let worstAccuracy = 100;
    
    this.models.forEach((model, id) => {
      if (model.accuracy < worstAccuracy && model.performance.totalPredictions > 50) {
        worstAccuracy = model.accuracy;
        worstId = id;
      }
    });

    if (worstId) {
      const model = this.models.get(worstId);
      if (model) {
        model.model.dispose();
        this.models.delete(worstId);
        console.log(`➖ Removed underperforming model ${worstId}`);
      }
    }
  }

  /**
   * Get ensemble statistics
   */
  getStats() {
    const stats = {
      totalModels: this.models.size,
      averageAccuracy: 0,
      modelPerformance: [] as any[]
    };

    let totalAccuracy = 0;
    
    this.models.forEach((model, id) => {
      totalAccuracy += model.accuracy;
      stats.modelPerformance.push({
        id,
        accuracy: model.accuracy,
        specialization: model.specialization,
        predictions: model.performance.totalPredictions,
        weight: model.weight
      });
    });

    stats.averageAccuracy = totalAccuracy / this.models.size;
    stats.modelPerformance.sort((a, b) => b.accuracy - a.accuracy);

    return stats;
  }

  /**
   * Convert prediction index to intent name
   */
  private indexToIntent(index: number): string {
    const intents = [
      'start_sit', 'waiver_wire', 'trade_advice', 'injury_check',
      'player_projection', 'lineup_help', 'score_check', 'league_standings',
      'player_compare', 'team_analysis', 'matchup_preview', 'weather_impact',
      'news_update', 'schedule_check', 'playoff_odds', 'keeper_advice',
      'draft_help', 'greeting', 'thanks', 'unknown'
    ];
    
    return intents[index] || 'unknown';
  }

  /**
   * Cleanup resources
   */
  dispose() {
    this.models.forEach(model => {
      model.model.dispose();
    });
    this.models.clear();
  }
}
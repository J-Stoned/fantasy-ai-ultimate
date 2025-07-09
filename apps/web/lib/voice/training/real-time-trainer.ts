/**
 * Real-Time Voice Training System
 * Learns from every command instantly using RTX 4060 GPU acceleration
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';

// Create supabase client lazily to ensure env vars are loaded
let supabase: any = null;

function getSupabase() {
  if (!supabase) {
    supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );
  }
  return supabase;
}

export interface VoiceCommand {
  id: string;
  transcript: string;
  intent: string;
  entities: Record<string, string>;
  confidence: number;
  timestamp: Date;
  userId?: string;
  feedback?: 'positive' | 'negative' | null;
  outcome?: 'followed' | 'ignored' | null;
}

export interface TrainingMetrics {
  accuracy: number;
  totalCommands: number;
  successfulCommands: number;
  retrainingCycles: number;
  lastTrainingTime: Date;
  modelVersion: string;
}

export class RealTimeVoiceTrainer extends EventEmitter {
  private model: tf.Sequential | null = null;
  private tokenizer: Map<string, number> = new Map();
  private intents: string[] = [];
  private trainingQueue: VoiceCommand[] = [];
  private isTraining: boolean = false;
  private metrics: TrainingMetrics;
  private readonly BATCH_SIZE = 32;
  private readonly RETRAIN_THRESHOLD = 10; // Retrain after 10 new commands
  private readonly MAX_TOKENS = 1000;

  constructor() {
    super();
    this.metrics = {
      accuracy: 0,
      totalCommands: 0,
      successfulCommands: 0,
      retrainingCycles: 0,
      lastTrainingTime: new Date(),
      modelVersion: '1.0.0'
    };
    
    this.initializeModel();
    this.startContinuousTraining();
  }

  /**
   * Initialize or load the neural network model
   */
  private async initializeModel() {
    try {
      // Try to load existing model
      this.model = await tf.loadLayersModel('file://./models/voice-intent/model.json') as tf.Sequential;
      console.log('🧠 Loaded existing voice model');
    } catch (error) {
      // Create new model
      console.log('🆕 Creating new voice model with GPU acceleration');
      this.model = tf.sequential({
        layers: [
          tf.layers.embedding({
            inputDim: this.MAX_TOKENS,
            outputDim: 128,
            inputLength: 50
          }),
          tf.layers.lstm({
            units: 256,
            returnSequences: true,
            dropout: 0.2,
            recurrentDropout: 0.2
          }),
          tf.layers.lstm({
            units: 128,
            dropout: 0.2,
            recurrentDropout: 0.2
          }),
          tf.layers.dense({
            units: 64,
            activation: 'relu'
          }),
          tf.layers.dropout({ rate: 0.5 }),
          tf.layers.dense({
            units: 20, // Number of intent categories
            activation: 'softmax'
          })
        ]
      });

      this.model.compile({
        optimizer: tf.train.adam(0.001),
        loss: 'categoricalCrossentropy',
        metrics: ['accuracy']
      });
    }

    // Load intent categories
    this.intents = [
      'start_sit', 'waiver_wire', 'trade_advice', 'injury_check',
      'player_projection', 'lineup_help', 'score_check', 'league_standings',
      'player_compare', 'team_analysis', 'matchup_preview', 'weather_impact',
      'news_update', 'schedule_check', 'playoff_odds', 'keeper_advice',
      'draft_help', 'greeting', 'thanks', 'unknown'
    ];
  }

  /**
   * Process and learn from a voice command in real-time
   */
  async processCommand(command: VoiceCommand): Promise<string> {
    // Add to training queue
    this.trainingQueue.push(command);
    this.metrics.totalCommands++;

    // Predict intent
    const prediction = await this.predictIntent(command.transcript);
    command.intent = prediction.intent;
    command.confidence = prediction.confidence;

    // Store in database for later analysis
    this.storeCommand(command);

    // Trigger retraining if threshold reached
    if (this.trainingQueue.length >= this.RETRAIN_THRESHOLD) {
      this.triggerRetraining();
    }

    this.emit('commandProcessed', command);
    return prediction.intent;
  }

  /**
   * Predict intent using the current model
   */
  private async predictIntent(transcript: string): Promise<{ intent: string; confidence: number }> {
    if (!this.model) {
      return { intent: 'unknown', confidence: 0 };
    }

    // Tokenize and pad input
    const tokens = this.tokenizeText(transcript);
    const padded = this.padSequence(tokens, 50);
    const input = tf.tensor2d([padded]);

    // Run prediction
    const prediction = this.model.predict(input) as tf.Tensor;
    const probabilities = await prediction.data();
    const maxIndex = tf.argMax(prediction, 1).dataSync()[0];
    const confidence = probabilities[maxIndex];

    // Cleanup
    input.dispose();
    prediction.dispose();

    return {
      intent: this.intents[maxIndex],
      confidence: confidence
    };
  }

  /**
   * Tokenize text into numerical representation
   */
  private tokenizeText(text: string): number[] {
    const words = text.toLowerCase().split(/\s+/);
    return words.map(word => {
      if (!this.tokenizer.has(word)) {
        this.tokenizer.set(word, this.tokenizer.size + 1);
      }
      return this.tokenizer.get(word)!;
    });
  }

  /**
   * Pad sequence to fixed length
   */
  private padSequence(tokens: number[], length: number): number[] {
    if (tokens.length >= length) {
      return tokens.slice(0, length);
    }
    return [...tokens, ...Array(length - tokens.length).fill(0)];
  }

  /**
   * Handle user feedback on command response
   */
  async provideFeedback(commandId: string, feedback: 'positive' | 'negative') {
    const command = this.trainingQueue.find(c => c.id === commandId);
    if (command) {
      command.feedback = feedback;
      
      if (feedback === 'positive') {
        this.metrics.successfulCommands++;
      }

      // Update accuracy metric
      this.metrics.accuracy = (this.metrics.successfulCommands / this.metrics.totalCommands) * 100;

      // Immediate retraining on negative feedback
      if (feedback === 'negative') {
        console.log('👎 Negative feedback received, triggering immediate retraining');
        this.triggerRetraining();
      }
    }

    this.emit('feedbackReceived', { commandId, feedback });
  }

  /**
   * Continuous training loop - runs every 5 minutes
   */
  private startContinuousTraining() {
    setInterval(() => {
      if (this.trainingQueue.length > 0 && !this.isTraining) {
        this.trainModel();
      }
    }, 5 * 60 * 1000); // 5 minutes
  }

  /**
   * Trigger immediate retraining
   */
  private async triggerRetraining() {
    if (!this.isTraining) {
      console.log('🔄 Triggering immediate model retraining...');
      await this.trainModel();
    }
  }

  /**
   * Train the model with accumulated commands
   */
  private async trainModel() {
    if (!this.model || this.trainingQueue.length === 0) return;

    this.isTraining = true;
    const startTime = Date.now();

    try {
      // Prepare training data
      const trainingData = this.prepareTrainingData();
      
      // Create tensors
      const xs = tf.tensor2d(trainingData.inputs);
      const ys = tf.oneHot(tf.tensor1d(trainingData.labels, 'int32'), this.intents.length);

      // Train model
      console.log(`🏃 Training on ${trainingData.inputs.length} samples with GPU acceleration...`);
      
      await this.model.fit(xs, ys, {
        epochs: 5,
        batchSize: this.BATCH_SIZE,
        validationSplit: 0.2,
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(`Epoch ${epoch + 1}: loss = ${logs?.loss?.toFixed(4)}, accuracy = ${logs?.acc?.toFixed(4)}`);
          }
        }
      });

      // Save updated model
      await this.model.save('file://./models/voice-intent');
      
      // Update metrics
      this.metrics.retrainingCycles++;
      this.metrics.lastTrainingTime = new Date();
      this.metrics.modelVersion = this.incrementVersion(this.metrics.modelVersion);

      const duration = Date.now() - startTime;
      console.log(`✅ Training completed in ${duration}ms`);
      console.log(`📊 Model v${this.metrics.modelVersion} - Accuracy: ${this.metrics.accuracy.toFixed(2)}%`);

      // Clear processed commands
      this.trainingQueue = this.trainingQueue.filter(cmd => !cmd.feedback);

      // Cleanup tensors
      xs.dispose();
      ys.dispose();

      this.emit('modelTrained', this.metrics);
    } catch (error) {
      console.error('❌ Training error:', error);
    } finally {
      this.isTraining = false;
    }
  }

  /**
   * Prepare training data from command queue
   */
  private prepareTrainingData(): { inputs: number[][], labels: number[] } {
    const inputs: number[][] = [];
    const labels: number[] = [];

    this.trainingQueue.forEach(command => {
      const tokens = this.tokenizeText(command.transcript);
      const padded = this.padSequence(tokens, 50);
      const intentIndex = this.intents.indexOf(command.intent);
      
      if (intentIndex !== -1) {
        inputs.push(padded);
        labels.push(intentIndex);
      }
    });

    return { inputs, labels };
  }

  /**
   * Store command in database for analysis
   */
  private async storeCommand(command: VoiceCommand) {
    try {
      await getSupabase().from('voice_training_data').insert({
        transcript: command.transcript,
        intent: command.intent,
        confidence: command.confidence,
        user_id: command.userId,
        feedback: command.feedback,
        created_at: command.timestamp
      });
    } catch (error) {
      console.error('Failed to store command:', error);
    }
  }

  /**
   * Increment model version
   */
  private incrementVersion(version: string): string {
    const parts = version.split('.');
    parts[2] = (parseInt(parts[2]) + 1).toString();
    return parts.join('.');
  }

  /**
   * Get current training metrics
   */
  getMetrics(): TrainingMetrics {
    return { ...this.metrics };
  }

  /**
   * Export training data for analysis
   */
  async exportTrainingData(): Promise<VoiceCommand[]> {
    const { data } = await supabase
      .from('voice_training_data')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    
    return data || [];
  }
}
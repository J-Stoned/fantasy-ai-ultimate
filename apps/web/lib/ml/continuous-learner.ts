/**
 * 🧠 CONTINUOUS LEARNING SYSTEM
 * 
 * Learns from prediction outcomes and retrains models
 */

import * as tf from '@tensorflow/tfjs-node';
import { createClient } from '@supabase/supabase-js';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs/promises';
import { config } from 'dotenv';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface LearningConfig {
  batchSize: number;
  learningRate: number;
  retrainThreshold: number;
  maxDataAge: number; // days
  minSamplesForRetrain: number;
}

export class ContinuousLearner {
  private neuralNetwork: tf.LayersModel | null = null;
  private config: LearningConfig;
  private isLearning = false;
  private metrics = {
    predictionsAnalyzed: 0,
    correctPredictions: 0,
    retrainCount: 0,
    lastAccuracy: 0,
    improvementRate: 0
  };
  
  constructor(config?: Partial<LearningConfig>) {
    this.config = {
      batchSize: 32,
      learningRate: 0.0001,
      retrainThreshold: 0.48, // Retrain if accuracy drops below this
      maxDataAge: 30,
      minSamplesForRetrain: 100,
      ...config
    };
  }
  
  /**
   * Initialize the continuous learner
   */
  async initialize(): Promise<void> {
    console.log(chalk.bold.cyan('🧠 Initializing Continuous Learning System'));
    
    // Load existing model
    try {
      const modelPath = path.join(process.cwd(), 'models/production_ensemble_v2/neural_network');
      this.neuralNetwork = await tf.loadLayersModel(`file://${modelPath}/model.json`);
      console.log(chalk.green('✅ Neural network loaded'));
      
      // Set up optimizer with lower learning rate for fine-tuning
      this.neuralNetwork.compile({
        optimizer: tf.train.adam(this.config.learningRate),
        loss: 'binaryCrossentropy',
        metrics: ['accuracy']
      });
    } catch (error) {
      console.error(chalk.red('❌ Failed to load model:'), error);
      throw error;
    }
  }
  
  /**
   * Analyze prediction outcomes
   */
  async analyzePredictionOutcomes(): Promise<{
    accuracy: number;
    samples: number;
    shouldRetrain: boolean;
  }> {
    console.log(chalk.yellow('📊 Analyzing prediction outcomes...'));
    
    // Get predictions with known outcomes
    const { data: predictions, error } = await supabase
      .from('ml_predictions')
      .select(`
        *,
        game:games!inner(
          id,
          home_score,
          away_score,
          status,
          home_team_id,
          away_team_id
        )
      `)
      .eq('model_name', 'ensemble_v2')
      .eq('game.status', 'completed')
      .not('game.home_score', 'is', null)
      .not('game.away_score', 'is', null)
      .gte('created_at', new Date(Date.now() - this.config.maxDataAge * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(1000);
    
    if (error || !predictions || predictions.length === 0) {
      console.log(chalk.gray('No completed predictions to analyze'));
      return { accuracy: 0, samples: 0, shouldRetrain: false };
    }
    
    // Calculate accuracy
    let correct = 0;
    const analyzed: Array<{
      features: number[];
      actual: number;
      predicted: number;
    }> = [];
    
    for (const pred of predictions) {
      const metadata = pred.metadata as any;
      const homeWon = pred.game.home_score > pred.game.away_score;
      const predictedHomeWin = metadata.home_win_probability > 0.5;
      
      if (homeWon === predictedHomeWin) {
        correct++;
      }
      
      // Extract features for retraining
      if (metadata.features) {
        analyzed.push({
          features: this.extractFeatureArray(metadata.features),
          actual: homeWon ? 1 : 0,
          predicted: metadata.home_win_probability
        });
      }
    }
    
    const accuracy = correct / predictions.length;
    this.metrics.predictionsAnalyzed = predictions.length;
    this.metrics.correctPredictions = correct;
    this.metrics.lastAccuracy = accuracy;
    
    console.log(chalk.blue(`Analyzed ${predictions.length} predictions`));
    console.log(chalk.green(`Accuracy: ${(accuracy * 100).toFixed(2)}%`));
    
    // Store analyzed data for potential retraining
    if (analyzed.length > 0) {
      await this.storeAnalyzedData(analyzed);
    }
    
    // Determine if retraining is needed
    const shouldRetrain = 
      accuracy < this.config.retrainThreshold && 
      analyzed.length >= this.config.minSamplesForRetrain;
    
    if (shouldRetrain) {
      console.log(chalk.yellow('⚠️  Accuracy below threshold, retraining recommended'));
    }
    
    return { accuracy, samples: analyzed.length, shouldRetrain };
  }
  
  /**
   * Extract feature array from metadata
   */
  private extractFeatureArray(features: any): number[] {
    // Convert feature object to array in consistent order
    return [
      features.homeWinRate || 0,
      features.awayWinRate || 0,
      features.winRateDiff || 0,
      features.homeAvgPointsFor || 0,
      features.awayAvgPointsFor || 0,
      features.homeAvgPointsAgainst || 0,
      features.awayAvgPointsAgainst || 0,
      features.homeLast5Form || 0,
      features.awayLast5Form || 0,
      features.homeHomeWinRate || 0,
      features.awayAwayWinRate || 0,
      features.homeTopPlayerAvg || 0,
      features.awayTopPlayerAvg || 0,
      features.homeStarActive ? 1 : 0,
      features.awayStarActive ? 1 : 0,
      features.homeAvgFantasy || 0,
      features.awayAvgFantasy || 0,
      features.homeInjuryCount || 0,
      features.awayInjuryCount || 0,
      features.homeFormTrend || 0,
      features.awayFormTrend || 0,
      features.seasonProgress || 0,
      features.isWeekend ? 1 : 0,
      features.isHoliday ? 1 : 0,
      features.attendanceNormalized || 0,
      features.hasVenue ? 1 : 0,
      features.h2hWinRate || 0,
      features.h2hPointDiff || 0,
      features.homeStreak || 0,
      features.awayStreak || 0
    ];
  }
  
  /**
   * Store analyzed data for future training
   */
  private async storeAnalyzedData(data: Array<{
    features: number[];
    actual: number;
    predicted: number;
  }>): Promise<void> {
    const filepath = path.join(process.cwd(), 'data/continuous-learning');
    await fs.mkdir(filepath, { recursive: true });
    
    const filename = `analyzed_${Date.now()}.json`;
    await fs.writeFile(
      path.join(filepath, filename),
      JSON.stringify(data, null, 2)
    );
    
    console.log(chalk.gray(`Stored ${data.length} samples for future training`));
  }
  
  /**
   * Perform incremental learning
   */
  async performIncrementalLearning(): Promise<{
    success: boolean;
    improvement: number;
  }> {
    if (!this.neuralNetwork || this.isLearning) {
      return { success: false, improvement: 0 };
    }
    
    this.isLearning = true;
    console.log(chalk.bold.yellow('\n🔄 Starting Incremental Learning...'));
    
    try {
      // Load recent analyzed data
      const dataPath = path.join(process.cwd(), 'data/continuous-learning');
      const files = await fs.readdir(dataPath).catch(() => []);
      
      if (files.length === 0) {
        console.log(chalk.gray('No training data available'));
        return { success: false, improvement: 0 };
      }
      
      // Load most recent files
      const recentFiles = files
        .filter(f => f.startsWith('analyzed_'))
        .sort()
        .slice(-5); // Last 5 files
      
      let allData: Array<{ features: number[]; actual: number }> = [];
      
      for (const file of recentFiles) {
        const content = await fs.readFile(path.join(dataPath, file), 'utf-8');
        const data = JSON.parse(content);
        allData = allData.concat(data);
      }
      
      if (allData.length < this.config.minSamplesForRetrain) {
        console.log(chalk.gray(`Insufficient data: ${allData.length} samples`));
        return { success: false, improvement: 0 };
      }
      
      console.log(chalk.blue(`Training on ${allData.length} samples...`));
      
      // Prepare tensors
      const features = allData.map(d => d.features);
      const labels = allData.map(d => d.actual);
      
      // Pad features to 50 (model expects this)
      const paddedFeatures = features.map(f => {
        const padded = [...f];
        while (padded.length < 50) padded.push(0);
        return padded;
      });
      
      const xs = tf.tensor2d(paddedFeatures);
      const ys = tf.tensor2d(labels, [labels.length, 1]);
      
      // Split into train/validation
      const splitIdx = Math.floor(allData.length * 0.8);
      const trainXs = xs.slice([0, 0], [splitIdx, -1]);
      const trainYs = ys.slice([0, 0], [splitIdx, -1]);
      const valXs = xs.slice([splitIdx, 0], [-1, -1]);
      const valYs = ys.slice([splitIdx, 0], [-1, -1]);
      
      // Get baseline accuracy
      const baselineEval = await this.neuralNetwork.evaluate(valXs, valYs) as tf.Scalar[];
      const baselineAcc = await baselineEval[1].data();
      
      // Perform training
      const history = await this.neuralNetwork.fit(trainXs, trainYs, {
        epochs: 10,
        batchSize: this.config.batchSize,
        validationData: [valXs, valYs],
        callbacks: {
          onEpochEnd: (epoch, logs) => {
            console.log(chalk.gray(
              `  Epoch ${epoch + 1}/10 - loss: ${logs?.loss.toFixed(4)} - ` +
              `acc: ${logs?.acc.toFixed(4)} - val_acc: ${logs?.val_acc.toFixed(4)}`
            ));
          }
        }
      });
      
      // Get final accuracy
      const finalEval = await this.neuralNetwork.evaluate(valXs, valYs) as tf.Scalar[];
      const finalAcc = await finalEval[1].data();
      
      const improvement = (finalAcc[0] - baselineAcc[0]) * 100;
      this.metrics.improvementRate = improvement;
      this.metrics.retrainCount++;
      
      // Save updated model if improved
      if (improvement > 0) {
        await this.saveUpdatedModel();
        console.log(chalk.green(`✅ Model improved by ${improvement.toFixed(2)}%`));
      } else {
        console.log(chalk.yellow(`⚠️  No improvement achieved`));
      }
      
      // Cleanup tensors
      xs.dispose();
      ys.dispose();
      trainXs.dispose();
      trainYs.dispose();
      valXs.dispose();
      valYs.dispose();
      baselineEval.forEach(t => t.dispose());
      finalEval.forEach(t => t.dispose());
      
      return { success: true, improvement };
      
    } catch (error) {
      console.error(chalk.red('❌ Learning failed:'), error);
      return { success: false, improvement: 0 };
    } finally {
      this.isLearning = false;
    }
  }
  
  /**
   * Save updated model
   */
  private async saveUpdatedModel(): Promise<void> {
    if (!this.neuralNetwork) return;
    
    const modelPath = path.join(
      process.cwd(), 
      'models/continuous_learning',
      `model_${Date.now()}`
    );
    
    await fs.mkdir(modelPath, { recursive: true });
    await this.neuralNetwork.save(`file://${modelPath}`);
    
    console.log(chalk.gray(`Model saved to ${modelPath}`));
  }
  
  /**
   * Get learning metrics
   */
  getMetrics() {
    return {
      ...this.metrics,
      accuracyPercent: (this.metrics.lastAccuracy * 100).toFixed(2) + '%',
      isLearning: this.isLearning
    };
  }
}

// Export singleton instance
export const continuousLearner = new ContinuousLearner();
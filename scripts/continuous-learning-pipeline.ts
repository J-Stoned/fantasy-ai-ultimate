#!/usr/bin/env tsx
/**
 * 🔄 CONTINUOUS LEARNING PIPELINE
 * 
 * Automatically learns from predictions and improves over time
 * Tracks accuracy, retrains models, and adjusts weights
 */

import chalk from 'chalk';
import { config } from 'dotenv';
import { createClient } from '@supabase/supabase-js';
import { ensemblePredictor } from '../lib/ml/ensemble-predictor';
import * as cron from 'node-cron';
import * as fs from 'fs/promises';
import * as path from 'path';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface PredictionRecord {
  id: string;
  game_id: number;
  predicted_winner: 'home' | 'away';
  home_win_probability: number;
  confidence: number;
  model_predictions: {
    neuralNetwork: number;
    randomForest: number;
    xgboost?: number;
  };
  actual_winner?: 'home' | 'away';
  correct?: boolean;
  created_at: string;
  game_date: string;
  sport: string;
}

class ContinuousLearningPipeline {
  private predictions: Map<number, PredictionRecord> = new Map();
  private modelAccuracy = {
    overall: { correct: 0, total: 0 },
    neuralNetwork: { correct: 0, total: 0 },
    randomForest: { correct: 0, total: 0 },
    xgboost: { correct: 0, total: 0 },
    bySport: new Map<string, { correct: number; total: number }>(),
    byConfidence: {
      high: { correct: 0, total: 0 },    // > 0.7
      medium: { correct: 0, total: 0 },   // 0.5-0.7
      low: { correct: 0, total: 0 }       // < 0.5
    }
  };
  
  async initialize() {
    console.log(chalk.cyan('🔄 Initializing Continuous Learning Pipeline...'));
    
    // Load existing predictions
    await this.loadPredictions();
    
    // Load ensemble model
    const modelsDir = path.join(process.cwd(), 'models');
    await ensemblePredictor.loadModels(modelsDir);
    
    console.log(chalk.green('✅ Pipeline initialized'));
    console.log(chalk.yellow(`📊 Loaded ${this.predictions.size} historical predictions`));
    
    // Calculate initial accuracy
    this.calculateAccuracy();
    this.printAccuracyReport();
  }
  
  /**
   * Make a prediction and store it
   */
  async makePrediction(gameId: number, features: any): Promise<PredictionRecord> {
    const prediction = await ensemblePredictor.predict(features);
    
    const record: PredictionRecord = {
      id: `pred_${Date.now()}_${gameId}`,
      game_id: gameId,
      predicted_winner: prediction.homeWinProbability > 0.5 ? 'home' : 'away',
      home_win_probability: prediction.homeWinProbability,
      confidence: prediction.confidence,
      model_predictions: prediction.modelPredictions,
      created_at: new Date().toISOString(),
      game_date: '', // Will be filled from game data
      sport: '' // Will be filled from game data
    };
    
    // Store prediction
    this.predictions.set(gameId, record);
    await this.savePrediction(record);
    
    return record;
  }
  
  /**
   * Update prediction with actual result
   */
  async updateWithResult(gameId: number, homeScore: number, awayScore: number) {
    const prediction = this.predictions.get(gameId);
    if (!prediction) return;
    
    const actualWinner = homeScore > awayScore ? 'home' : 'away';
    prediction.actual_winner = actualWinner;
    prediction.correct = prediction.predicted_winner === actualWinner;
    
    // Update accuracy stats
    this.updateAccuracyStats(prediction);
    
    // Save updated prediction
    await this.savePrediction(prediction);
    
    // Check if retraining is needed
    if (this.shouldRetrain()) {
      console.log(chalk.yellow('📈 Accuracy dropped - triggering retraining...'));
      await this.triggerRetraining();
    }
  }
  
  /**
   * Load historical predictions
   */
  private async loadPredictions() {
    try {
      const filePath = path.join(process.cwd(), 'data', 'predictions.json');
      const data = await fs.readFile(filePath, 'utf-8');
      const predictions = JSON.parse(data) as PredictionRecord[];
      
      predictions.forEach(pred => {
        this.predictions.set(pred.game_id, pred);
        if (pred.correct !== undefined) {
          this.updateAccuracyStats(pred);
        }
      });
    } catch (error) {
      // File doesn't exist yet
      console.log(chalk.gray('No historical predictions found'));
    }
  }
  
  /**
   * Save prediction
   */
  private async savePrediction(prediction: PredictionRecord) {
    const dataDir = path.join(process.cwd(), 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    const filePath = path.join(dataDir, 'predictions.json');
    const predictions = Array.from(this.predictions.values());
    
    await fs.writeFile(filePath, JSON.stringify(predictions, null, 2));
  }
  
  /**
   * Update accuracy statistics
   */
  private updateAccuracyStats(prediction: PredictionRecord) {
    if (prediction.correct === undefined) return;
    
    // Overall accuracy
    this.modelAccuracy.overall.total++;
    if (prediction.correct) this.modelAccuracy.overall.correct++;
    
    // Individual model accuracy (based on which agreed with final prediction)
    const nnCorrect = (prediction.model_predictions.neuralNetwork > 0.5) === (prediction.actual_winner === 'home');
    const rfCorrect = (prediction.model_predictions.randomForest > 0.5) === (prediction.actual_winner === 'home');
    
    this.modelAccuracy.neuralNetwork.total++;
    if (nnCorrect) this.modelAccuracy.neuralNetwork.correct++;
    
    this.modelAccuracy.randomForest.total++;
    if (rfCorrect) this.modelAccuracy.randomForest.correct++;
    
    // Sport-specific accuracy
    if (prediction.sport) {
      if (!this.modelAccuracy.bySport.has(prediction.sport)) {
        this.modelAccuracy.bySport.set(prediction.sport, { correct: 0, total: 0 });
      }
      const sportStats = this.modelAccuracy.bySport.get(prediction.sport)!;
      sportStats.total++;
      if (prediction.correct) sportStats.correct++;
    }
    
    // Confidence-based accuracy
    if (prediction.confidence > 0.7) {
      this.modelAccuracy.byConfidence.high.total++;
      if (prediction.correct) this.modelAccuracy.byConfidence.high.correct++;
    } else if (prediction.confidence > 0.5) {
      this.modelAccuracy.byConfidence.medium.total++;
      if (prediction.correct) this.modelAccuracy.byConfidence.medium.correct++;
    } else {
      this.modelAccuracy.byConfidence.low.total++;
      if (prediction.correct) this.modelAccuracy.byConfidence.low.correct++;
    }
  }
  
  /**
   * Calculate current accuracy
   */
  private calculateAccuracy() {
    // Reset and recalculate from all predictions
    this.modelAccuracy = {
      overall: { correct: 0, total: 0 },
      neuralNetwork: { correct: 0, total: 0 },
      randomForest: { correct: 0, total: 0 },
      xgboost: { correct: 0, total: 0 },
      bySport: new Map(),
      byConfidence: {
        high: { correct: 0, total: 0 },
        medium: { correct: 0, total: 0 },
        low: { correct: 0, total: 0 }
      }
    };
    
    this.predictions.forEach(pred => {
      if (pred.correct !== undefined) {
        this.updateAccuracyStats(pred);
      }
    });
  }
  
  /**
   * Print accuracy report
   */
  printAccuracyReport() {
    console.log(chalk.bold.cyan('\n📊 MODEL ACCURACY REPORT'));
    console.log(chalk.gray('='.repeat(50)));
    
    const overall = this.modelAccuracy.overall;
    if (overall.total > 0) {
      const accuracy = (overall.correct / overall.total * 100).toFixed(1);
      console.log(chalk.yellow(`Overall Accuracy: ${accuracy}% (${overall.correct}/${overall.total})`));
    }
    
    // Individual models
    console.log(chalk.cyan('\nModel Performance:'));
    const nn = this.modelAccuracy.neuralNetwork;
    if (nn.total > 0) {
      console.log(`  Neural Network: ${(nn.correct / nn.total * 100).toFixed(1)}%`);
    }
    
    const rf = this.modelAccuracy.randomForest;
    if (rf.total > 0) {
      console.log(`  Random Forest: ${(rf.correct / rf.total * 100).toFixed(1)}%`);
    }
    
    // By sport
    if (this.modelAccuracy.bySport.size > 0) {
      console.log(chalk.cyan('\nBy Sport:'));
      this.modelAccuracy.bySport.forEach((stats, sport) => {
        if (stats.total > 0) {
          console.log(`  ${sport}: ${(stats.correct / stats.total * 100).toFixed(1)}%`);
        }
      });
    }
    
    // By confidence
    console.log(chalk.cyan('\nBy Confidence:'));
    const conf = this.modelAccuracy.byConfidence;
    if (conf.high.total > 0) {
      console.log(`  High (>70%): ${(conf.high.correct / conf.high.total * 100).toFixed(1)}%`);
    }
    if (conf.medium.total > 0) {
      console.log(`  Medium (50-70%): ${(conf.medium.correct / conf.medium.total * 100).toFixed(1)}%`);
    }
    if (conf.low.total > 0) {
      console.log(`  Low (<50%): ${(conf.low.correct / conf.low.total * 100).toFixed(1)}%`);
    }
    
    console.log(chalk.gray('='.repeat(50)));
  }
  
  /**
   * Check if retraining is needed
   */
  private shouldRetrain(): boolean {
    const overall = this.modelAccuracy.overall;
    if (overall.total < 50) return false; // Need enough data
    
    const currentAccuracy = overall.correct / overall.total;
    
    // Retrain if accuracy drops below 55%
    return currentAccuracy < 0.55;
  }
  
  /**
   * Trigger model retraining
   */
  private async triggerRetraining() {
    console.log(chalk.yellow('🔄 Starting model retraining...'));
    
    // Collect recent games and predictions
    const recentPredictions = Array.from(this.predictions.values())
      .filter(p => p.correct !== undefined)
      .slice(-1000); // Last 1000 predictions
    
    // TODO: Implement actual retraining logic
    console.log(chalk.green('✅ Retraining complete (placeholder)'));
  }
  
  /**
   * Monitor live games and update predictions
   */
  async monitorLiveGames() {
    console.log(chalk.cyan('👁️  Monitoring live games...'));
    
    const { data: liveGames } = await supabase
      .from('games')
      .select('*')
      .in('status', ['scheduled', 'in_progress'])
      .order('start_time', { ascending: true })
      .limit(10);
    
    if (!liveGames || liveGames.length === 0) {
      console.log(chalk.gray('No live games found'));
      return;
    }
    
    console.log(chalk.yellow(`Found ${liveGames.length} upcoming/live games`));
    
    // Make predictions for games without them
    for (const game of liveGames) {
      if (!this.predictions.has(game.id)) {
        // TODO: Extract features and make prediction
        console.log(chalk.gray(`  Game ${game.id}: Need to make prediction`));
      }
    }
  }
}

// Main execution
async function main() {
  console.log(chalk.bold.cyan('\n🔄 CONTINUOUS LEARNING PIPELINE'));
  console.log(chalk.gray('='.repeat(50)));
  
  const pipeline = new ContinuousLearningPipeline();
  await pipeline.initialize();
  
  // Set up scheduled tasks
  console.log(chalk.cyan('\n⏰ Setting up scheduled tasks...'));
  
  // Check for completed games every 5 minutes
  cron.schedule('*/5 * * * *', async () => {
    console.log(chalk.gray(`[${new Date().toISOString()}] Checking for completed games...`));
    
    const { data: completedGames } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'completed')
      .gt('updated_at', new Date(Date.now() - 10 * 60 * 1000).toISOString())
      .not('home_score', 'is', null);
    
    if (completedGames && completedGames.length > 0) {
      console.log(chalk.yellow(`Found ${completedGames.length} newly completed games`));
      
      for (const game of completedGames) {
        await pipeline.updateWithResult(game.id, game.home_score, game.away_score);
      }
      
      pipeline.printAccuracyReport();
    }
  });
  
  // Monitor live games every hour
  cron.schedule('0 * * * *', async () => {
    console.log(chalk.gray(`[${new Date().toISOString()}] Monitoring live games...`));
    await pipeline.monitorLiveGames();
  });
  
  // Daily accuracy report
  cron.schedule('0 9 * * *', () => {
    console.log(chalk.bold.cyan('\n📊 DAILY ACCURACY REPORT'));
    pipeline.printAccuracyReport();
  });
  
  console.log(chalk.green('✅ Continuous learning pipeline active'));
  console.log(chalk.gray('Press Ctrl+C to stop'));
  
  // Initial check
  await pipeline.monitorLiveGames();
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Shutting down continuous learning pipeline...'));
  process.exit(0);
});

main().catch(console.error);
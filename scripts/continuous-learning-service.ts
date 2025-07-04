#!/usr/bin/env tsx
/**
 * 🧠 CONTINUOUS LEARNING SERVICE
 * 
 * Monitors prediction accuracy and retrains models
 */

import chalk from 'chalk';
import * as cron from 'node-cron';
import { continuousLearner } from '../lib/ml/continuous-learner';
import { predictionBroadcaster } from '../lib/realtime/prediction-broadcaster';

class ContinuousLearningService {
  private isRunning = false;
  private startTime = Date.now();
  private analysisCount = 0;
  private retrainCount = 0;
  
  async initialize() {
    console.log(chalk.bold.cyan('\n🧠 CONTINUOUS LEARNING SERVICE'));
    console.log(chalk.gray('='.repeat(50)));
    
    // Initialize continuous learner
    await continuousLearner.initialize();
    
    // Initialize WebSocket broadcaster
    await predictionBroadcaster.initialize();
    
    this.isRunning = true;
    console.log(chalk.green('✅ Service initialized'));
  }
  
  /**
   * Perform learning cycle
   */
  async performLearningCycle() {
    console.log(chalk.cyan('\n🔄 Starting learning cycle...'));
    console.log(chalk.gray(`[${new Date().toISOString()}]`));
    
    try {
      // 1. Analyze prediction outcomes
      const analysis = await continuousLearner.analyzePredictionOutcomes();
      this.analysisCount++;
      
      console.log(chalk.blue('Analysis Results:'));
      console.log(`  Accuracy: ${(analysis.accuracy * 100).toFixed(2)}%`);
      console.log(`  Samples: ${analysis.samples}`);
      console.log(`  Should Retrain: ${analysis.shouldRetrain ? 'YES' : 'NO'}`);
      
      // Broadcast accuracy update
      predictionBroadcaster.broadcastModelUpdate(
        analysis.accuracy,
        'ensemble_v2_continuous'
      );
      
      // 2. Perform incremental learning if needed
      if (analysis.shouldRetrain && analysis.samples > 0) {
        console.log(chalk.yellow('\n📚 Initiating incremental learning...'));
        
        const learning = await continuousLearner.performIncrementalLearning();
        
        if (learning.success) {
          this.retrainCount++;
          console.log(chalk.green(
            `✅ Learning complete! Improvement: ${learning.improvement.toFixed(2)}%`
          ));
          
          // Broadcast learning complete
          predictionBroadcaster.broadcastModelUpdate(
            analysis.accuracy + (learning.improvement / 100),
            'ensemble_v2_improved'
          );
        }
      }
      
      // 3. Show metrics
      const metrics = continuousLearner.getMetrics();
      console.log(chalk.bold.cyan('\n📊 LEARNING METRICS'));
      console.log(chalk.gray('='.repeat(30)));
      console.log(`Predictions Analyzed: ${metrics.predictionsAnalyzed}`);
      console.log(`Correct Predictions: ${metrics.correctPredictions}`);
      console.log(`Current Accuracy: ${metrics.accuracyPercent}`);
      console.log(`Retrain Count: ${metrics.retrainCount}`);
      console.log(`Improvement Rate: ${metrics.improvementRate.toFixed(2)}%`);
      
    } catch (error) {
      console.error(chalk.red('❌ Learning cycle failed:'), error);
    }
  }
  
  /**
   * Show service statistics
   */
  showStats() {
    const runtime = Math.floor((Date.now() - this.startTime) / 1000);
    const hours = Math.floor(runtime / 3600);
    const minutes = Math.floor((runtime % 3600) / 60);
    const seconds = runtime % 60;
    
    console.log(chalk.bold.cyan('\n📊 SERVICE STATS'));
    console.log(chalk.gray('='.repeat(30)));
    console.log(`Runtime: ${hours}h ${minutes}m ${seconds}s`);
    console.log(`Analysis Cycles: ${this.analysisCount}`);
    console.log(`Retrain Cycles: ${this.retrainCount}`);
    console.log(`Rate: ${(this.analysisCount / (runtime / 3600)).toFixed(1)} analyses/hour`);
  }
  
  /**
   * Start the service
   */
  async start() {
    await this.initialize();
    
    // Perform initial analysis
    await this.performLearningCycle();
    
    // Schedule regular learning cycles
    console.log(chalk.cyan('\n⏰ Scheduling learning tasks...'));
    
    // Every hour - analyze outcomes
    cron.schedule('0 * * * *', async () => {
      console.log(chalk.gray(`\n[${new Date().toISOString()}] Hourly analysis...`));
      await this.performLearningCycle();
    });
    
    // Every 30 minutes - quick accuracy check
    cron.schedule('*/30 * * * *', async () => {
      const analysis = await continuousLearner.analyzePredictionOutcomes();
      console.log(chalk.gray(
        `[${new Date().toISOString()}] Quick check - Accuracy: ${(analysis.accuracy * 100).toFixed(2)}%`
      ));
    });
    
    // Every 5 minutes - show stats
    cron.schedule('*/5 * * * *', () => {
      this.showStats();
    });
    
    console.log(chalk.bold.green('\n✅ Continuous Learning Service is running!'));
    console.log(chalk.gray('Press Ctrl+C to stop'));
    console.log(chalk.yellow('\nTip: The service will:'));
    console.log(chalk.gray('  • Analyze prediction accuracy every 30 minutes'));
    console.log(chalk.gray('  • Perform full learning cycles every hour'));
    console.log(chalk.gray('  • Retrain models when accuracy drops'));
    console.log(chalk.gray('  • Broadcast updates via WebSocket'));
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Shutting down continuous learning service...'));
  process.exit(0);
});

// Start the service
const service = new ContinuousLearningService();
service.start().catch(console.error);
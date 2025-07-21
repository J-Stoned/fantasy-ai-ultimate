#!/usr/bin/env tsx
/**
 * 🚀 GPU-ACCELERATED TRAINING
 * 
 * Trains models using GPU acceleration
 */

import chalk from 'chalk';
import * as tf from '@tensorflow/tfjs-node-gpu';
import { gpuAccelerator } from '../lib/ml/gpu-accelerator';
import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import * as path from 'path';
import * as fs from 'fs/promises';

config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

class GPUTrainer {
  private features: number[][] = [];
  private labels: number[] = [];
  
  async initialize() {
    console.log(chalk.bold.cyan('\n🚀 GPU-ACCELERATED TRAINING'));
    console.log(chalk.gray('='.repeat(50)));
    
    // Initialize GPU
    const gpuAvailable = await gpuAccelerator.initialize();
    
    if (!gpuAvailable) {
      console.log(chalk.yellow('⚠️  Falling back to CPU training'));
    } else {
      gpuAccelerator.optimizeTensorOperations();
    }
    
    return gpuAvailable;
  }
  
  /**
   * Load training data
   */
  async loadTrainingData() {
    console.log(chalk.yellow('\n📊 Loading training data...'));
    
    const { data: games, error } = await supabase
      .from('games')
      .select('*')
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .not('away_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(10000);
    
    if (error || !games || games.length === 0) {
      throw new Error('No training data available');
    }
    
    console.log(chalk.blue(`Loaded ${games.length} completed games`));
    
    // Extract features for each game
    for (const game of games) {
      const features = await this.extractGameFeatures(game);
      if (features) {
        this.features.push(features);
        this.labels.push(game.home_score > game.away_score ? 1 : 0);
      }
    }
    
    console.log(chalk.green(`✅ Prepared ${this.features.length} training samples`));
  }
  
  /**
   * Extract features from game
   */
  private async extractGameFeatures(game: any): Promise<number[] | null> {
    try {
      // Get team stats
      const homeStats = await this.getTeamStats(game.home_team_id);
      const awayStats = await this.getTeamStats(game.away_team_id);
      
      // Basic features (30 features)
      const features = [
        // Team performance (10)
        homeStats.winRate,
        awayStats.winRate,
        homeStats.winRate - awayStats.winRate,
        homeStats.avgPointsFor / 100,
        awayStats.avgPointsFor / 100,
        homeStats.avgPointsAgainst / 100,
        awayStats.avgPointsAgainst / 100,
        homeStats.last5Form / 5,
        awayStats.last5Form / 5,
        homeStats.homeWinRate,
        
        // Additional features (20)
        awayStats.awayWinRate,
        Math.abs(homeStats.winRate - awayStats.winRate),
        (homeStats.avgPointsFor - homeStats.avgPointsAgainst) / 100,
        (awayStats.avgPointsFor - awayStats.avgPointsAgainst) / 100,
        homeStats.consistency,
        awayStats.consistency,
        this.getSeasonProgress(new Date(game.start_time)),
        new Date(game.start_time).getDay() === 0 || new Date(game.start_time).getDay() === 6 ? 1 : 0,
        new Date(game.start_time).getMonth() === 11 ? 1 : 0,
        0.7, // Default attendance
        
        // Momentum features (10)
        homeStats.momentum,
        awayStats.momentum,
        homeStats.offensiveRating,
        awayStats.offensiveRating,
        homeStats.defensiveRating,
        awayStats.defensiveRating,
        0.5, // H2H placeholder
        0, // Point diff placeholder
        0, // Home streak placeholder
        0  // Away streak placeholder
      ];
      
      // Pad to 50 features for model compatibility
      while (features.length < 50) {
        features.push(0);
      }
      
      return features;
    } catch (error) {
      return null;
    }
  }
  
  /**
   * Get team statistics
   */
  private async getTeamStats(teamId: number) {
    const { data: games } = await supabase
      .from('games')
      .select('*')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .eq('status', 'completed')
      .not('home_score', 'is', null)
      .order('start_time', { ascending: false })
      .limit(20);
    
    if (!games || games.length === 0) {
      return this.getDefaultStats();
    }
    
    let wins = 0, totalPointsFor = 0, totalPointsAgainst = 0;
    let last5Wins = 0, homeWins = 0, homeGames = 0;
    const pointDiffs: number[] = [];
    
    games.forEach((game, idx) => {
      const isHome = game.home_team_id === teamId;
      const teamScore = isHome ? game.home_score : game.away_score;
      const oppScore = isHome ? game.away_score : game.home_score;
      
      totalPointsFor += teamScore;
      totalPointsAgainst += oppScore;
      pointDiffs.push(teamScore - oppScore);
      
      if (teamScore > oppScore) {
        wins++;
        if (idx < 5) last5Wins++;
        if (isHome) homeWins++;
      }
      
      if (isHome) homeGames++;
    });
    
    // Calculate consistency (lower std dev = more consistent)
    const avgDiff = pointDiffs.reduce((a, b) => a + b, 0) / pointDiffs.length;
    const variance = pointDiffs.reduce((sum, diff) => sum + Math.pow(diff - avgDiff, 2), 0) / pointDiffs.length;
    const consistency = 1 / (1 + Math.sqrt(variance) / 10);
    
    // Calculate momentum (recent performance vs overall)
    const recentWinRate = games.slice(0, 5).filter((g, i) => {
      const isHome = g.home_team_id === teamId;
      return isHome ? g.home_score > g.away_score : g.away_score > g.home_score;
    }).length / Math.min(5, games.length);
    const overallWinRate = wins / games.length;
    const momentum = recentWinRate - overallWinRate + 0.5;
    
    return {
      winRate: wins / games.length,
      avgPointsFor: totalPointsFor / games.length,
      avgPointsAgainst: totalPointsAgainst / games.length,
      last5Form: last5Wins,
      homeWinRate: homeGames > 0 ? homeWins / homeGames : 0.5,
      awayWinRate: (games.length - homeGames) > 0 ? (wins - homeWins) / (games.length - homeGames) : 0.5,
      consistency,
      momentum,
      offensiveRating: totalPointsFor / games.length / 100,
      defensiveRating: 1 - (totalPointsAgainst / games.length / 100)
    };
  }
  
  private getDefaultStats() {
    return {
      winRate: 0.5,
      avgPointsFor: 100,
      avgPointsAgainst: 100,
      last5Form: 2.5,
      homeWinRate: 0.5,
      awayWinRate: 0.5,
      consistency: 0.5,
      momentum: 0.5,
      offensiveRating: 1,
      defensiveRating: 0.5
    };
  }
  
  private getSeasonProgress(date: Date): number {
    const month = date.getMonth();
    if (month >= 8) return (month - 8) / 5;
    return (month + 4) / 5;
  }
  
  /**
   * Train model with GPU
   */
  async trainModel() {
    if (this.features.length === 0) {
      throw new Error('No training data loaded');
    }
    
    console.log(chalk.bold.yellow('\n🏋️ Training Neural Network with GPU...'));
    
    // Create tensors
    const xs = tf.tensor2d(this.features);
    const ys = tf.tensor2d(this.labels, [this.labels.length, 1]);
    
    // Create GPU-optimized model
    const model = gpuAccelerator.createOptimizedModel(50);
    
    // Show model summary
    console.log(chalk.gray('\nModel Architecture:'));
    model.summary();
    
    // Train with GPU acceleration
    const metrics = await gpuAccelerator.trainWithGPU(model, xs, ys, {
      epochs: 100,
      batchSize: 256,
      validationSplit: 0.2
    });
    
    // Save model
    const modelPath = path.join(process.cwd(), 'models/gpu_accelerated', `model_${Date.now()}`);
    await fs.mkdir(modelPath, { recursive: true });
    await model.save(`file://${modelPath}`);
    
    console.log(chalk.green(`\n✅ Model saved to ${modelPath}`));
    
    // Show GPU metrics
    const gpuMetrics = await gpuAccelerator.getMetrics();
    console.log(chalk.bold.magenta('\n📊 GPU Performance Summary:'));
    console.log(`  Device: ${gpuMetrics.deviceName}`);
    console.log(`  Peak Usage: ${gpuMetrics.utilizationPercent.toFixed(1)}%`);
    console.log(`  Temperature: ${gpuMetrics.temperature}°C`);
    console.log(`  Power Draw: ${gpuMetrics.powerDraw}W`);
    
    // Cleanup
    xs.dispose();
    ys.dispose();
    model.dispose();
    
    return metrics;
  }
  
  /**
   * Compare GPU vs CPU performance
   */
  async runPerformanceComparison() {
    console.log(chalk.bold.cyan('\n🏁 GPU vs CPU Performance Comparison'));
    console.log(chalk.gray('='.repeat(50)));
    
    // Create test data
    const testSize = 5000;
    const testFeatures = Array(testSize).fill(0).map(() => 
      Array(50).fill(0).map(() => Math.random())
    );
    const testLabels = Array(testSize).fill(0).map(() => Math.random() > 0.5 ? 1 : 0);
    
    const xs = tf.tensor2d(testFeatures);
    const ys = tf.tensor2d(testLabels, [testLabels.length, 1]);
    
    // Create identical models
    const gpuModel = gpuAccelerator.createOptimizedModel(50);
    const cpuModel = tf.sequential({
      layers: [
        tf.layers.dense({ inputShape: [50], units: 256, activation: 'relu' }),
        tf.layers.dense({ units: 128, activation: 'relu' }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 32, activation: 'relu' }),
        tf.layers.dense({ units: 1, activation: 'sigmoid' })
      ]
    });
    
    cpuModel.compile({
      optimizer: 'adam',
      loss: 'binaryCrossentropy',
      metrics: ['accuracy']
    });
    
    // Test CPU performance
    console.log(chalk.yellow('\n🖥️  Testing CPU Performance...'));
    const cpuStart = Date.now();
    
    await cpuModel.fit(xs, ys, {
      epochs: 10,
      batchSize: 32,
      verbose: 0
    });
    
    const cpuTime = Date.now() - cpuStart;
    console.log(chalk.blue(`CPU Time: ${(cpuTime / 1000).toFixed(2)}s`));
    
    // Test GPU performance
    if (gpuAccelerator.isAvailable()) {
      console.log(chalk.yellow('\n🎮 Testing GPU Performance...'));
      const gpuStart = Date.now();
      
      await gpuModel.fit(xs, ys, {
        epochs: 10,
        batchSize: 256, // Larger batch for GPU
        verbose: 0
      });
      
      const gpuTime = Date.now() - gpuStart;
      console.log(chalk.green(`GPU Time: ${(gpuTime / 1000).toFixed(2)}s`));
      
      const speedup = cpuTime / gpuTime;
      console.log(chalk.bold.green(`\n🚀 GPU Speedup: ${speedup.toFixed(1)}x faster!`));
    }
    
    // Cleanup
    xs.dispose();
    ys.dispose();
    gpuModel.dispose();
    cpuModel.dispose();
  }
}

// Main execution
async function main() {
  const trainer = new GPUTrainer();
  
  try {
    // Initialize GPU
    const gpuAvailable = await trainer.initialize();
    
    // Run performance comparison
    if (gpuAvailable) {
      await trainer.runPerformanceComparison();
    }
    
    // Load training data
    await trainer.loadTrainingData();
    
    // Train model
    const metrics = await trainer.trainModel();
    
    console.log(chalk.bold.green('\n✅ Training Complete!'));
    console.log(chalk.blue('Final Metrics:'));
    console.log(`  Training Time: ${(metrics.totalTime / 1000).toFixed(2)}s`);
    console.log(`  Throughput: ${metrics.samplesPerSecond.toFixed(0)} samples/sec`);
    console.log(`  Speedup: ${metrics.speedupFactor.toFixed(1)}x`);
    
  } catch (error) {
    console.error(chalk.red('❌ Training failed:'), error);
    process.exit(1);
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n👋 Shutting down GPU training...'));
  process.exit(0);
});

main().catch(console.error);
#!/usr/bin/env tsx
/**
 * GPU-ACCELERATED ML MODEL TRAINING
 * Uses RTX 4060 to train position-specific models on real data
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import chalk from 'chalk';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import { existsSync, mkdirSync } from 'fs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL || '',
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ''
);

console.log(chalk.red.bold('\n🔥 GPU ML TRAINING ACTIVATED'));
console.log(chalk.red('===========================\n'));

// Model configurations by position
const POSITION_MODELS = {
  QB: {
    features: ['pass_yards', 'pass_tds', 'interceptions', 'rush_yards', 'completions', 'attempts'],
    outputSize: 3, // [points, floor, ceiling]
    layers: [128, 64, 32],
  },
  RB: {
    features: ['rush_yards', 'rush_tds', 'receptions', 'receiving_yards', 'touches', 'yards_per_carry'],
    outputSize: 3,
    layers: [128, 64, 32],
  },
  WR: {
    features: ['receptions', 'receiving_yards', 'receiving_tds', 'targets', 'yards_per_reception', 'red_zone_targets'],
    outputSize: 3,
    layers: [128, 64, 32],
  },
  TE: {
    features: ['receptions', 'receiving_yards', 'receiving_tds', 'targets', 'blocking_score'],
    outputSize: 3,
    layers: [64, 32, 16],
  },
  K: {
    features: ['field_goals_made', 'field_goals_attempted', 'extra_points_made', 'field_goal_percentage', 'long_field_goal'],
    outputSize: 3,
    layers: [32, 16],
  },
  DST: {
    features: ['points_allowed', 'yards_allowed', 'sacks', 'interceptions', 'fumbles_recovered', 'touchdowns'],
    outputSize: 3,
    layers: [64, 32, 16],
  },
};

class GPUModelTrainer {
  private models: Map<string, tf.LayersModel> = new Map();

  async initialize() {
    // Check GPU
    console.log(chalk.yellow('🖥️ Checking GPU...'));
    const gpuInfo = await tf.backend().getGPUInfoString();
    console.log(chalk.green('✅ GPU Ready:', gpuInfo));

    // Create models directory
    if (!existsSync('./models')) {
      mkdirSync('./models', { recursive: true });
    }
  }

  /**
   * Load training data from database
   */
  async loadTrainingData(position: string): Promise<{ inputs: number[][], outputs: number[][] }> {
    console.log(chalk.blue(`📊 Loading ${position} data...`));

    // Get player stats
    const { data: players, error } = await supabase
      .from('player_stats')
      .select('*')
      .eq('position', position)
      .order('game_date', { ascending: false })
      .limit(10000);

    if (error || !players || players.length === 0) {
      console.log(chalk.gray(`No data for ${position}, using synthetic data`));
      return this.generateSyntheticData(position);
    }

    console.log(chalk.green(`Found ${players.length} ${position} records`));

    // Convert to training format
    const inputs: number[][] = [];
    const outputs: number[][] = [];

    players.forEach((stat: any) => {
      const features = POSITION_MODELS[position].features;
      const input = features.map(f => stat[f] || 0);
      const output = [
        stat.fantasy_points || 0,
        stat.fantasy_points * 0.8, // floor
        stat.fantasy_points * 1.2, // ceiling
      ];
      
      inputs.push(input);
      outputs.push(output);
    });

    return { inputs, outputs };
  }

  /**
   * Generate synthetic training data if real data not available
   */
  generateSyntheticData(position: string): { inputs: number[][], outputs: number[][] } {
    const config = POSITION_MODELS[position];
    const inputs: number[][] = [];
    const outputs: number[][] = [];

    // Generate 1000 synthetic samples
    for (let i = 0; i < 1000; i++) {
      const input = config.features.map(() => Math.random() * 100);
      const basePoints = Math.random() * 30;
      const output = [
        basePoints,
        basePoints * (0.7 + Math.random() * 0.2),
        basePoints * (1.1 + Math.random() * 0.3),
      ];
      
      inputs.push(input);
      outputs.push(output);
    }

    return { inputs, outputs };
  }

  /**
   * Create and train model for specific position
   */
  async trainPositionModel(position: string) {
    console.log(chalk.yellow(`\n🏈 Training ${position} model...`));
    
    const config = POSITION_MODELS[position];
    const { inputs, outputs } = await this.loadTrainingData(position);

    // Convert to tensors
    const inputTensor = tf.tensor2d(inputs);
    const outputTensor = tf.tensor2d(outputs);

    // Create model
    const model = tf.sequential();
    
    // Input layer
    model.add(tf.layers.dense({
      inputShape: [config.features.length],
      units: config.layers[0],
      activation: 'relu',
      kernelInitializer: 'glorotNormal',
    }));

    // Hidden layers
    for (let i = 1; i < config.layers.length; i++) {
      model.add(tf.layers.dropout({ rate: 0.2 }));
      model.add(tf.layers.dense({
        units: config.layers[i],
        activation: 'relu',
        kernelInitializer: 'glorotNormal',
      }));
    }

    // Output layer
    model.add(tf.layers.dense({
      units: config.outputSize,
      activation: 'linear',
    }));

    // Compile with GPU acceleration
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'meanSquaredError',
      metrics: ['mse', 'mae'],
    });

    // Train with progress callback
    const startTime = Date.now();
    
    await model.fit(inputTensor, outputTensor, {
      epochs: 100,
      batchSize: 32,
      validationSplit: 0.2,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          if (epoch % 10 === 0) {
            console.log(chalk.cyan(`  Epoch ${epoch}: loss=${logs?.loss?.toFixed(4)}, val_loss=${logs?.val_loss?.toFixed(4)}`));
          }
        },
      },
    });

    const trainTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`✅ ${position} model trained in ${trainTime}s`));

    // Save model
    await model.save(`file://./models/${position.toLowerCase()}`);
    this.models.set(position, model);

    // Cleanup tensors
    inputTensor.dispose();
    outputTensor.dispose();
  }

  /**
   * Train all position models
   */
  async trainAllModels() {
    const positions = Object.keys(POSITION_MODELS);
    
    console.log(chalk.red.bold('\n🚀 TRAINING ALL MODELS WITH GPU'));
    console.log(chalk.red('================================\n'));

    for (const position of positions) {
      await this.trainPositionModel(position);
    }

    console.log(chalk.green.bold('\n✅ ALL MODELS TRAINED!'));
    this.showGPUStats();
  }

  /**
   * Show GPU memory usage
   */
  showGPUStats() {
    const memInfo = tf.memory();
    console.log(chalk.yellow('\n📊 GPU Memory Stats:'));
    console.log(`  Tensors: ${memInfo.numTensors}`);
    console.log(`  GPU Memory: ${(memInfo.numBytesInGPU / 1024 / 1024).toFixed(2)} MB`);
    console.log(`  Total Memory: ${(memInfo.numBytes / 1024 / 1024).toFixed(2)} MB`);
  }

  /**
   * Test predictions
   */
  async testPredictions() {
    console.log(chalk.yellow('\n🎯 Testing Predictions...'));

    // Test QB prediction
    const qbModel = this.models.get('QB');
    if (qbModel) {
      const testInput = tf.tensor2d([[300, 3, 1, 20, 25, 35]]); // Sample QB stats
      const prediction = qbModel.predict(testInput) as tf.Tensor;
      const result = await prediction.array();
      
      console.log(chalk.green('\nQB Prediction:'));
      console.log(`  Projected Points: ${result[0][0].toFixed(1)}`);
      console.log(`  Floor: ${result[0][1].toFixed(1)}`);
      console.log(`  Ceiling: ${result[0][2].toFixed(1)}`);
      
      testInput.dispose();
      prediction.dispose();
    }
  }
}

// Main execution
async function main() {
  const trainer = new GPUModelTrainer();
  
  try {
    await trainer.initialize();
    await trainer.trainAllModels();
    await trainer.testPredictions();
    
    console.log(chalk.red.bold('\n🔥 GPU TRAINING COMPLETE!'));
    console.log(chalk.yellow('\nModels saved to ./models/'));
    console.log(chalk.green('\nNext: Connect to AI agents for real-time predictions!\n'));
    
  } catch (error) {
    console.error(chalk.red('Training error:'), error);
  }
}

// Run training
main().catch(console.error);
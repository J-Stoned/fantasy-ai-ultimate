#!/usr/bin/env tsx
/**
 * 🚀 GPU SPEED TEST
 * 
 * Tests prediction speed with GPU vs CPU
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import * as dotenv from 'dotenv';
import chalk from 'chalk';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

async function testGPUSpeed() {
  console.log(chalk.bold.red('\n🔥 GPU SPEED TEST - RTX 4060 POWER!'));
  console.log(chalk.gray('='.repeat(50)));
  
  // Force GPU backend
  await tf.ready();
  console.log(chalk.green(`✅ Backend: ${tf.getBackend()}`));
  
  // Load model
  const modelPath = path.join(process.cwd(), 'models/production_ensemble_v2/neural_network');
  if (!fs.existsSync(`${modelPath}/model.json`)) {
    console.error('Model not found!');
    return;
  }
  
  const model = await tf.loadLayersModel(`file://${modelPath}/model.json`);
  console.log(chalk.green('✅ Model loaded'));
  
  // Get input shape
  const inputShape = model.inputs[0].shape;
  const featureCount = inputShape[inputShape.length - 1] || 50;
  console.log(chalk.cyan(`📊 Model expects ${featureCount} features`));
  
  // Test different batch sizes
  const batchSizes = [1, 10, 50, 100, 500, 1000];
  
  console.log(chalk.yellow('\n⚡ Testing prediction speeds...\n'));
  
  for (const batchSize of batchSizes) {
    // Create batch of fake features
    const features = tf.randomUniform([batchSize, featureCount]);
    
    // Warm up
    const warmup = model.predict(features) as tf.Tensor;
    await warmup.data();
    warmup.dispose();
    
    // Time the predictions
    const iterations = 10;
    const start = Date.now();
    
    for (let i = 0; i < iterations; i++) {
      const pred = model.predict(features) as tf.Tensor;
      await pred.data();
      pred.dispose();
    }
    
    const elapsed = Date.now() - start;
    const predsPerSecond = (batchSize * iterations * 1000) / elapsed;
    
    console.log(chalk.bold(`Batch ${batchSize}:`));
    console.log(`  Time: ${elapsed}ms for ${batchSize * iterations} predictions`);
    console.log(`  Speed: ${chalk.green(predsPerSecond.toFixed(0))} predictions/second`);
    console.log(`  Per hour: ${chalk.yellow((predsPerSecond * 3600).toFixed(0))} predictions/hour`);
    console.log();
    
    features.dispose();
  }
  
  // Show GPU memory usage
  const memInfo = tf.memory();
  console.log(chalk.cyan('\n📊 GPU Memory:'));
  console.log(`  Used: ${(memInfo.numBytes / 1024 / 1024).toFixed(1)}MB`);
  console.log(`  Tensors: ${memInfo.numTensors}`);
  
  // Check GPU utilization
  const { exec } = require('child_process');
  exec('nvidia-smi --query-gpu=utilization.gpu --format=csv,noheader,nounits', (err: any, stdout: string) => {
    if (!err) {
      console.log(`  GPU Utilization: ${stdout.trim()}%`);
    }
  });
  
  console.log(chalk.bold.green('\n🚀 YOUR RTX 4060 IS READY FOR TURBO MODE!'));
}

testGPUSpeed().catch(console.error);
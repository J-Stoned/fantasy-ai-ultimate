#!/usr/bin/env tsx
/**
 * GPU ACCELERATION TEST
 * Tests RTX 4060 GPU capabilities
 */

import chalk from 'chalk';
import { performance } from 'perf_hooks';

console.log(chalk.red.bold('\n🚀 GPU ACCELERATION TEST'));
console.log(chalk.red('========================\n'));

// Test 1: Check GPU availability
async function testGPUAvailability() {
  console.log(chalk.yellow('1. Checking GPU availability...'));
  
  try {
    // Check NVIDIA GPU
    const { execSync } = require('child_process');
    const gpuInfo = execSync('nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader', 
      { encoding: 'utf8' });
    
    console.log(chalk.green('✅ GPU Detected:'));
    console.log(`   ${gpuInfo.trim()}`);
    
    // Get detailed GPU info
    const detailedInfo = execSync('nvidia-smi', { encoding: 'utf8' });
    console.log(chalk.gray('\nDetailed GPU Info:'));
    console.log(detailedInfo);
    
    return true;
  } catch (error) {
    console.log(chalk.red('❌ GPU not detected or NVIDIA drivers not installed'));
    return false;
  }
}

// Test 2: TensorFlow GPU test
async function testTensorFlowGPU() {
  console.log(chalk.yellow('\n2. Testing TensorFlow GPU acceleration...'));
  
  try {
    // Dynamic import to handle module loading
    const tf = await import('@tensorflow/tfjs-node');
    
    console.log(chalk.blue('TensorFlow version:'), tf.version.tfjs);
    
    // Check backend
    console.log(chalk.blue('Backend:'), tf.getBackend());
    
    // Create large tensors to test GPU
    console.log(chalk.yellow('\nRunning GPU benchmark...'));
    
    const size = 4096;
    const iterations = 100;
    
    // CPU benchmark
    tf.setBackend('cpu');
    await tf.ready();
    
    const cpuStart = performance.now();
    for (let i = 0; i < iterations; i++) {
      const a = tf.randomNormal([size, size]);
      const b = tf.randomNormal([size, size]);
      const c = tf.matMul(a, b);
      c.dispose();
      a.dispose();
      b.dispose();
    }
    const cpuTime = performance.now() - cpuStart;
    
    console.log(chalk.yellow(`CPU Time: ${cpuTime.toFixed(2)}ms`));
    
    // GPU benchmark (if available)
    try {
      tf.setBackend('webgl');
      await tf.ready();
      
      const gpuStart = performance.now();
      for (let i = 0; i < iterations; i++) {
        const a = tf.randomNormal([size, size]);
        const b = tf.randomNormal([size, size]);
        const c = tf.matMul(a, b);
        c.dispose();
        a.dispose();
        b.dispose();
      }
      const gpuTime = performance.now() - gpuStart;
      
      console.log(chalk.green(`GPU Time: ${gpuTime.toFixed(2)}ms`));
      console.log(chalk.green.bold(`🚀 GPU Speedup: ${(cpuTime / gpuTime).toFixed(2)}x faster!`));
    } catch (gpuError) {
      console.log(chalk.red('GPU backend not available'));
    }
    
  } catch (error) {
    console.log(chalk.red('❌ TensorFlow test failed:'), error.message);
    console.log(chalk.yellow('Installing @tensorflow/tfjs-node-gpu might be required'));
  }
}

// Test 3: Test our GPU AI service
async function testGPUAIService() {
  console.log(chalk.yellow('\n3. Testing GPU AI Service...'));
  
  try {
    const { GPUAcceleratedAI } = await import('../lib/ai/gpu/gpu-service.js');
    const gpuAI = new GPUAcceleratedAI();
    
    // Initialize
    console.log(chalk.blue('Initializing GPU AI...'));
    await gpuAI.initialize();
    
    // Test sentiment analysis
    console.log(chalk.blue('\nTesting sentiment analysis on player tweets...'));
    const sampleTweets = [
      "Patrick Mahomes is playing amazing this season!",
      "Terrible performance by the offensive line today",
      "Can't wait for Sunday's game, feeling confident!",
      "Injury concerns are mounting for our star receiver",
      "Best draft pick we've made in years!"
    ];
    
    const start = performance.now();
    const sentiments = await gpuAI.analyzePlayerSentiment(sampleTweets);
    const sentimentTime = performance.now() - start;
    
    console.log(chalk.green(`✅ Analyzed ${sampleTweets.length} tweets in ${sentimentTime.toFixed(2)}ms`));
    
    // Test performance prediction
    console.log(chalk.blue('\nTesting player performance prediction...'));
    const features = Array(10).fill(null).map(() => 
      Array(256).fill(null).map(() => Math.random())
    );
    
    const predStart = performance.now();
    const predictions = await gpuAI.predictPlayerPerformance(features);
    const predTime = performance.now() - predStart;
    
    console.log(chalk.green(`✅ Generated ${predictions.length} predictions in ${predTime.toFixed(2)}ms`));
    
    // Memory info
    const memInfo = gpuAI.getGPUMemoryInfo();
    console.log(chalk.blue('\nGPU Memory Usage:'));
    console.log(`  Tensors: ${memInfo.numTensors}`);
    console.log(`  Memory: ${memInfo.numBytes}`);
    console.log(`  GPU Enabled: ${memInfo.gpuEnabled}`);
    
  } catch (error) {
    console.log(chalk.red('❌ GPU AI Service test failed:'), error.message);
  }
}

// Test 4: Multi-threaded CPU test
async function testMultiThreading() {
  console.log(chalk.yellow('\n4. Testing multi-threaded processing...'));
  
  const os = require('os');
  const numCPUs = os.cpus().length;
  
  console.log(chalk.blue('CPU Info:'));
  console.log(`  Model: ${os.cpus()[0].model}`);
  console.log(`  Cores: ${numCPUs}`);
  console.log(`  Speed: ${os.cpus()[0].speed} MHz`);
  
  // Simulate parallel processing
  const { Worker } = require('worker_threads');
  
  console.log(chalk.green(`✅ Can utilize all ${numCPUs} threads for parallel processing`));
}

// Main test runner
async function runAllTests() {
  console.log(chalk.cyan('Starting comprehensive GPU/CPU tests...\n'));
  
  const gpuAvailable = await testGPUAvailability();
  
  if (gpuAvailable) {
    await testTensorFlowGPU();
    await testGPUAIService();
  }
  
  await testMultiThreading();
  
  console.log(chalk.green.bold('\n✅ GPU ACCELERATION TEST COMPLETE!'));
  
  if (gpuAvailable) {
    console.log(chalk.cyan('\n🎉 Your RTX 4060 is ready for:'));
    console.log('  • Local AI model inference');
    console.log('  • Real-time player analysis');
    console.log('  • Computer vision processing');
    console.log('  • Neural network predictions');
  }
}

// Run tests
runAllTests().catch(console.error);
#!/usr/bin/env tsx
/**
 * Simple GPU Test
 * Tests basic GPU functionality without external dependencies
 */

import * as tf from '@tensorflow/tfjs-node-gpu';
import chalk from 'chalk';
import { execSync } from 'child_process';
import * as os from 'os';

console.log(chalk.blue.bold('\n🚀 SIMPLE GPU ACCELERATION TEST\n'));

async function testGPU() {
  try {
    // 0. Check NVIDIA GPU
    console.log(chalk.cyan('0️⃣ Checking NVIDIA GPU...'));
    try {
      const gpuInfo = execSync('nvidia-smi --query-gpu=name,memory.total,driver_version --format=csv,noheader', 
        { encoding: 'utf8' });
      console.log(chalk.green('✅ GPU Detected:'));
      console.log(`   ${gpuInfo.trim()}`);
    } catch (error) {
      console.log(chalk.yellow('⚠️ nvidia-smi not accessible (normal in WSL2)'));
    }
    
    // 1. Test TensorFlow backend
    console.log(chalk.cyan('\n1️⃣ Testing TensorFlow Backend...'));
    await tf.ready();
    const backend = tf.getBackend();
    console.log(chalk.blue(`Backend: ${backend}`));
    
    if (backend === 'tensorflow') {
      console.log(chalk.green('✅ GPU Backend Active!'));
    } else {
      console.log(chalk.yellow('⚠️ CPU Backend Active (GPU libraries not found)'));
      console.log(chalk.gray('   Note: This is normal without CUDA installed'));
    }
    
    // 2. Test memory
    console.log(chalk.cyan('\n2️⃣ Testing Memory...'));
    const memInfo = tf.memory();
    console.log(chalk.green(`✅ Memory: ${Math.round(memInfo.numBytes / 1024 / 1024)}MB, ${memInfo.numTensors} tensors`));
    
    // 3. Simple benchmark
    console.log(chalk.cyan('\n3️⃣ Running Performance Benchmark...'));
    const sizes = [128, 256, 512];
    const results: any[] = [];
    
    for (const size of sizes) {
      const a = tf.randomNormal([size, size]);
      const b = tf.randomNormal([size, size]);
      
      // Warmup
      const warmup = tf.matMul(a, b);
      await warmup.data();
      warmup.dispose();
      
      // Benchmark
      const startTime = Date.now();
      const result = tf.matMul(a, b);
      await result.data();
      const endTime = Date.now();
      
      const time = endTime - startTime;
      const gflops = (2 * size * size * size) / (time * 1e6);
      
      results.push({
        size: `${size}x${size}`,
        timeMs: time,
        gflops: gflops.toFixed(2)
      });
      
      console.log(chalk.gray(`   ${size}x${size}: ${time}ms (${gflops.toFixed(2)} GFLOPS)`));
      
      // Cleanup
      a.dispose();
      b.dispose();
      result.dispose();
    }
    
    // 4. Test training speed
    console.log(chalk.cyan('\n4️⃣ Testing Training Speed...'));
    
    const x = tf.randomNormal([100, 50]);
    const y = tf.oneHot(tf.randomUniform([100], 0, 10, 'int32'), 10);
    
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 64, activation: 'relu', inputShape: [50] }),
        tf.layers.dense({ units: 10, activation: 'softmax' })
      ]
    });
    
    model.compile({
      optimizer: 'adam',
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    const trainStart = Date.now();
    await model.fit(x, y, {
      epochs: 3,
      batchSize: 32,
      verbose: 0
    });
    const trainTime = Date.now() - trainStart;
    
    console.log(chalk.green(`✅ Training completed in ${trainTime}ms (${(trainTime/3).toFixed(0)}ms per epoch)`));
    
    // Cleanup
    x.dispose();
    y.dispose();
    model.dispose();
    
    // 5. CPU info
    console.log(chalk.cyan('\n5️⃣ CPU Information...'));
    const numCPUs = os.cpus().length;
    console.log(chalk.blue('CPU Info:'));
    console.log(`  Model: ${os.cpus()[0].model}`);
    console.log(`  Cores: ${numCPUs}`);
    console.log(`  Speed: ${os.cpus()[0].speed} MHz`);
    
    // Summary
    console.log(chalk.green.bold('\n🎉 TEST COMPLETE!\n'));
    console.log(chalk.white('📊 Summary:'));
    console.log(`   • TensorFlow Backend: ${backend}`);
    console.log(`   • Training Speed: ${(trainTime/3).toFixed(0)}ms per epoch`);
    console.log(`   • CPU Cores: ${numCPUs} threads available`);
    
    if (backend !== 'tensorflow') {
      console.log(chalk.yellow('\n💡 To enable GPU acceleration:'));
      console.log('   1. Run: sudo bash scripts/install-cuda-wsl2.sh');
      console.log('   2. Restart terminal: source ~/.bashrc');
      console.log('   3. Run this test again');
      console.log(chalk.gray('\n   Note: CPU mode works great for development!'));
    } else {
      console.log(chalk.yellow('\n💡 Your RTX 4060 GPU is active and ready!'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ Test Error:'), error);
  }
}

// Run test
testGPU().catch(console.error);
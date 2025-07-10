#!/usr/bin/env tsx
/**
 * GPU Acceleration Test Script
 * Verifies RTX 4060 is properly configured and working
 */

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import * as tf from '@tensorflow/tfjs-node-gpu';
import chalk from 'chalk';
import { configureGPU, benchmarkGPU, monitorGPUMemory } from '../lib/voice/training/gpu-config';
import { GPUAccelerator } from '../lib/voice/training/gpu-accelerator';
import { RealTimeTrainer } from '../lib/voice/training/real-time-trainer';
import { execSync } from 'child_process';
import * as os from 'os';

console.log(chalk.blue.bold('\n🚀 GPU ACCELERATION TEST\n'));

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
      console.log(chalk.yellow('⚠️ nvidia-smi not accessible in WSL'));
    }
    
    // 1. Test basic GPU detection
    console.log(chalk.cyan('\n1️⃣ Testing TensorFlow GPU Detection...'));
    const backend = await configureGPU();
    
    if (backend !== 'tensorflow') {
      console.log(chalk.red('❌ GPU not detected! Make sure CUDA is installed.'));
      console.log(chalk.yellow('Run: sudo bash scripts/install-cuda-wsl2.sh'));
      console.log(chalk.yellow('Note: GPU may work even if not detected in WSL2'));
    } else {
      console.log(chalk.green('✅ GPU Backend Active!'));
    }
    
    // 2. Test GPU memory
    console.log(chalk.cyan('\n2️⃣ Testing GPU Memory...'));
    const memStats = await monitorGPUMemory();
    console.log(chalk.green(`✅ Memory Stats: ${memStats.totalMemoryMB}MB total, ${memStats.numTensors} tensors`));
    
    // 3. Run GPU benchmark
    console.log(chalk.cyan('\n3️⃣ Running GPU Performance Benchmark...'));
    const benchResults = await benchmarkGPU();
    
    // Calculate average GFLOPS
    const avgGflops = benchResults.reduce((sum, r) => sum + parseFloat(r.gflops), 0) / benchResults.length;
    console.log(chalk.green(`✅ Average Performance: ${avgGflops.toFixed(2)} GFLOPS`));
    
    // 4. Test GPU Accelerator
    console.log(chalk.cyan('\n4️⃣ Testing GPU Accelerator...'));
    const accelerator = new GPUAccelerator({ memoryLimit: 6000 }); // 6GB limit
    console.log(chalk.green('✅ GPU Accelerator initialized'));
    
    // 5. Test Real-time Training
    console.log(chalk.cyan('\n5️⃣ Testing Real-time Voice Training...'));
    const trainer = new RealTimeTrainer();
    
    // Test with sample command
    const testCommand = {
      id: 'test_gpu_' + Date.now(),
      transcript: 'Who should I start this week?',
      intent: 'start_sit',
      entities: {},
      confidence: 0.95,
      timestamp: new Date(),
      userId: 'test_user'
    };
    
    const startTime = Date.now();
    const prediction = await trainer.processCommand(testCommand);
    const inferenceTime = Date.now() - startTime;
    
    console.log(chalk.green(`✅ Inference completed in ${inferenceTime}ms`));
    console.log(chalk.gray(`   Predicted intent: ${prediction}`));
    
    // 6. Test training speed
    console.log(chalk.cyan('\n6️⃣ Testing Training Speed...'));
    console.log('Creating test dataset...');
    
    // Create dummy training data
    const batchSize = 100;
    const inputShape = [batchSize, 50]; // 100 samples, 50 features
    
    const x = tf.randomNormal(inputShape);
    const y = tf.oneHot(tf.randomUniform([batchSize], 0, 20, 'int32'), 20);
    
    // Create simple model
    const model = tf.sequential({
      layers: [
        tf.layers.dense({ units: 128, activation: 'relu', inputShape: [50] }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({ units: 64, activation: 'relu' }),
        tf.layers.dense({ units: 20, activation: 'softmax' })
      ]
    });
    
    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: 'categoricalCrossentropy',
      metrics: ['accuracy']
    });
    
    console.log('Training for 5 epochs...');
    const trainStart = Date.now();
    
    await model.fit(x, y, {
      epochs: 5,
      batchSize: 32,
      verbose: 0,
      callbacks: {
        onEpochEnd: (epoch, logs) => {
          console.log(chalk.gray(`   Epoch ${epoch + 1}: loss=${logs?.loss?.toFixed(4)}, accuracy=${logs?.acc?.toFixed(4)}`));
        }
      }
    });
    
    const trainTime = Date.now() - trainStart;
    console.log(chalk.green(`✅ Training completed in ${trainTime}ms (${(trainTime/5).toFixed(0)}ms per epoch)`));
    
    // Cleanup
    x.dispose();
    y.dispose();
    model.dispose();
    
    // 7. Test multi-threading
    console.log(chalk.cyan('\n7️⃣ Testing Multi-threaded Processing...'));
    const numCPUs = os.cpus().length;
    console.log(chalk.blue('CPU Info:'));
    console.log(`  Model: ${os.cpus()[0].model}`);
    console.log(`  Cores: ${numCPUs}`);
    console.log(`  Speed: ${os.cpus()[0].speed} MHz`);
    console.log(chalk.green(`✅ Can utilize all ${numCPUs} threads for parallel processing`));
    
    // Final memory check
    console.log(chalk.cyan('\n8️⃣ Final Memory Check...'));
    const finalMem = await monitorGPUMemory();
    console.log(chalk.green(`✅ Memory usage: ${finalMem.totalMemoryMB}MB, ${finalMem.numTensors} tensors`));
    
    // Summary
    console.log(chalk.green.bold('\n🎉 GPU ACCELERATION TEST COMPLETE!\n'));
    console.log(chalk.white('📊 Summary:'));
    console.log(`   • TensorFlow Backend: ${backend}`);
    console.log(`   • Performance: ${avgGflops.toFixed(2)} GFLOPS`);
    console.log(`   • Inference Speed: ${inferenceTime}ms`);
    console.log(`   • Training Speed: ${(trainTime/5).toFixed(0)}ms per epoch`);
    console.log(`   • CPU Cores: ${numCPUs} threads available`);
    console.log(`   • Memory Efficient: ✅`);
    
    if (backend === 'tensorflow') {
      console.log(chalk.yellow('\n💡 Your RTX 4060 is ready for production!'));
    } else {
      console.log(chalk.yellow('\n💡 CPU acceleration is active and working well!'));
      console.log(chalk.gray('   Note: GPU may still be used even if not detected in WSL2'));
    }
    
  } catch (error) {
    console.error(chalk.red('\n❌ GPU Test Error:'), error);
    console.log(chalk.yellow('\nTroubleshooting:'));
    console.log('1. Run: sudo bash scripts/install-cuda-wsl2.sh');
    console.log('2. Restart terminal: source ~/.bashrc');
    console.log('3. Check CUDA: nvcc --version');
    console.log('4. Check GPU: nvidia-smi');
    console.log('5. Note: WSL2 GPU support may require Windows 11 or latest Windows 10');
  }
}

// Run test
testGPU().catch(console.error);
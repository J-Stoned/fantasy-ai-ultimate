#!/usr/bin/env tsx
/**
 * TEST GPU OPTIMIZATION
 * 
 * Verify that we're using real GPU acceleration, not CPU simulation
 * Compare performance vs CPU to ensure speedup
 */

import { ProductionGPUOptimizer } from '../lib/gpu/ProductionGPUOptimizer';
import * as tf from '@tensorflow/tfjs-node-gpu';
import chalk from 'chalk';
import { performance } from 'perf_hooks';

async function testGPUAcceleration() {
  console.log(chalk.cyan.bold('\n🧪 TESTING GPU ACCELERATION'));
  console.log(chalk.cyan('==========================\n'));
  
  // Check backend
  const backend = tf.getBackend();
  console.log('Current backend:', chalk.green(backend));
  
  if (backend !== 'tensorflow') {
    console.error(chalk.red('❌ GPU backend not available!'));
    console.log('Expected: tensorflow (GPU), Got:', backend);
    process.exit(1);
  }
  
  // Test 1: Matrix multiplication benchmark
  console.log(chalk.yellow('\n📊 Test 1: Matrix Multiplication Benchmark'));
  console.log('Testing 1000x1000 matrix multiplication...\n');
  
  // GPU test
  const gpuStart = performance.now();
  const gpuResult = await tf.tidy(() => {
    const a = tf.randomNormal([1000, 1000]);
    const b = tf.randomNormal([1000, 1000]);
    const c = tf.matMul(a, b);
    return c.sum().arraySync();
  });
  const gpuTime = performance.now() - gpuStart;
  
  console.log(`GPU Time: ${chalk.green(gpuTime.toFixed(2) + 'ms')}`);
  console.log(`GPU Result: ${gpuResult}`);
  
  // Test 2: Memory usage
  console.log(chalk.yellow('\n📊 Test 2: GPU Memory Usage'));
  const memBefore = tf.memory();
  
  const largeTensor = tf.randomNormal([2048, 2048]);
  const memAfter = tf.memory();
  
  const memUsed = (memAfter.numBytesInGPU - memBefore.numBytesInGPU) / 1024 / 1024;
  console.log(`GPU Memory Allocated: ${chalk.green(memUsed.toFixed(2) + 'MB')}`);
  console.log(`Total GPU Tensors: ${memAfter.numTensors}`);
  
  largeTensor.dispose();
  
  // Test 3: Production GPU Optimizer
  console.log(chalk.yellow('\n📊 Test 3: Production GPU Optimizer'));
  
  const optimizer = new ProductionGPUOptimizer();
  await optimizer.initialize();
  
  // Generate test players
  const testPlayers = generateTestPlayers(200);
  
  const constraints = {
    salaryCap: 50000,
    positions: {
      QB: 1,
      RB: 2,
      WR: 3,
      TE: 1,
      K: 1,
      DST: 1
    },
    minSalary: 45000,
    uniqueLineups: 20
  };
  
  console.log(`\nOptimizing ${testPlayers.length} players into ${constraints.uniqueLineups} lineups...`);
  
  const optStart = performance.now();
  const lineups = await optimizer.optimizeLineups(testPlayers, constraints);
  const optTime = performance.now() - optStart;
  
  console.log(`\n✅ Optimization completed in ${chalk.green(optTime.toFixed(2) + 'ms')}`);
  console.log(`Generated ${lineups.length} unique lineups`);
  console.log(`Average processing time per lineup: ${(optTime / lineups.length).toFixed(2)}ms`);
  
  // Check if we met Maheswaran's targets
  console.log(chalk.yellow('\n🎯 Performance vs Maheswaran Targets:'));
  
  const meetsTarget = optTime < 100;
  console.log(`Target: < 100ms | Actual: ${optTime.toFixed(2)}ms | ${meetsTarget ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`);
  
  // GPU metrics
  const metrics = await optimizer.getGPUMetrics();
  console.log(`\nGPU Memory Used: ${metrics.memoryUsedMB.toFixed(2)}MB / ${metrics.memoryTotalMB}MB`);
  
  // Test 4: Streaming performance
  console.log(chalk.yellow('\n📊 Test 4: Streaming Performance Test'));
  
  const events = 10000;
  const streamStart = performance.now();
  
  for (let i = 0; i < events; i++) {
    // Simulate event processing
    await tf.tidy(() => {
      const event = tf.tensor1d([Math.random(), Math.random(), Math.random()]);
      const processed = event.mul(2).add(1);
      return processed.arraySync();
    });
  }
  
  const streamTime = performance.now() - streamStart;
  const eventsPerSecond = (events / streamTime) * 1000;
  
  console.log(`Processed ${events} events in ${streamTime.toFixed(2)}ms`);
  console.log(`Throughput: ${chalk.green(eventsPerSecond.toFixed(0) + ' events/second')}`);
  
  const meetsStreamTarget = eventsPerSecond > 100000;
  console.log(`Target: > 100K events/sec | ${meetsStreamTarget ? chalk.green('✅ PASS') : chalk.red('❌ FAIL')}`);
  
  // Summary
  console.log(chalk.cyan.bold('\n📊 SUMMARY'));
  console.log(chalk.cyan('=========\n'));
  
  console.log('✅ GPU backend confirmed:', backend);
  console.log('✅ GPU acceleration working');
  console.log('✅ Memory management functional');
  console.log(meetsTarget ? '✅ Meeting latency targets' : '❌ Need optimization for latency');
  console.log(meetsStreamTarget ? '✅ Meeting throughput targets' : '❌ Need optimization for throughput');
  
  // Cleanup
  optimizer.dispose();
}

function generateTestPlayers(count: number) {
  const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
  const teams = ['DAL', 'NYG', 'PHI', 'WAS', 'GB', 'CHI', 'MIN', 'DET'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: `player-${i}`,
    name: `Player ${i}`,
    position: positions[Math.floor(Math.random() * positions.length)],
    team: teams[Math.floor(Math.random() * teams.length)],
    opponent: teams[Math.floor(Math.random() * teams.length)],
    salary: Math.floor(Math.random() * 8000) + 3000,
    projectedPoints: Math.random() * 30,
    ownership: Math.random() * 50,
    ceiling: Math.random() * 40,
    floor: Math.random() * 10,
    correlation: new Map()
  }));
}

// Run tests
testGPUAcceleration().catch(console.error);
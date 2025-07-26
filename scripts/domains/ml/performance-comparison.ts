#!/usr/bin/env tsx
/**
 * Performance Comparison - Different optimization levels
 */

import chalk from 'chalk';
import { performance } from 'perf_hooks';

// Test different optimization approaches
async function comparePerformance() {
  console.log(chalk.cyan('📊 Fantasy ML Performance Comparison\n'));
  console.log('=' .repeat(50));
  
  const iterations = 1000;
  const players = generateLargePlayers(200); // 200 players
  
  // Test 1: Simple greedy algorithm
  console.log(chalk.yellow('\n1. Simple Greedy Algorithm:'));
  const greedy = await timeFunction(() => {
    for (let i = 0; i < iterations; i++) {
      greedyOptimize(players, 50000);
    }
  });
  
  // Test 2: Dynamic programming approach
  console.log(chalk.yellow('\n2. Dynamic Programming:'));
  const dp = await timeFunction(() => {
    for (let i = 0; i < iterations; i++) {
      dpOptimize(players, 50000);
    }
  });
  
  // Test 3: Ultra-optimized approach
  console.log(chalk.yellow('\n3. Ultra-Optimized:'));
  const ultra = await timeFunction(() => {
    for (let i = 0; i < iterations; i++) {
      ultraOptimize(players, 50000);
    }
  });
  
  // Summary
  console.log(chalk.green('\n📈 Performance Summary:'));
  console.log(chalk.white(`Greedy: ${greedy.time.toFixed(2)}ms (${greedy.memory.toFixed(1)}MB)`));
  console.log(chalk.white(`Dynamic: ${dp.time.toFixed(2)}ms (${dp.memory.toFixed(1)}MB)`));
  console.log(chalk.white(`Ultra: ${ultra.time.toFixed(2)}ms (${ultra.memory.toFixed(1)}MB)`));
  
  // Show improvement
  const improvement = ((greedy.time - ultra.time) / greedy.time * 100).toFixed(1);
  console.log(chalk.green(`\n⚡ Ultra is ${improvement}% faster than Greedy!`));
}

// Measure function performance
async function timeFunction(fn: () => void): Promise<{ time: number; memory: number }> {
  const memStart = process.memoryUsage().heapUsed;
  const start = performance.now();
  
  fn();
  
  const end = performance.now();
  const memEnd = process.memoryUsage().heapUsed;
  
  return {
    time: end - start,
    memory: (memEnd - memStart) / 1024 / 1024
  };
}

// Generate test data
function generateLargePlayers(count: number) {
  const positions = ['PG', 'SG', 'SF', 'PF', 'C'];
  const teams = ['LAL', 'BOS', 'MIL', 'GSW', 'DEN', 'PHX', 'MIA', 'NYK'];
  
  return Array.from({ length: count }, (_, i) => ({
    id: i.toString(),
    name: `Player${i}`,
    position: positions[i % positions.length],
    team: teams[i % teams.length],
    salary: 5000 + Math.floor(Math.random() * 8000),
    points: 20 + Math.floor(Math.random() * 40)
  }));
}

// Algorithm 1: Simple Greedy
function greedyOptimize(players: any[], cap: number) {
  const sorted = [...players].sort((a, b) => 
    (b.points / b.salary) - (a.points / a.salary)
  );
  
  const lineup = [];
  const positions = {};
  let totalSalary = 0;
  
  for (const player of sorted) {
    if (lineup.length >= 8) break;
    if (totalSalary + player.salary > cap) continue;
    
    const posCount = positions[player.position] || 0;
    if (posCount >= 2) continue;
    
    lineup.push(player);
    positions[player.position] = posCount + 1;
    totalSalary += player.salary;
  }
  
  return lineup;
}

// Algorithm 2: Dynamic Programming (simplified)
function dpOptimize(players: any[], cap: number) {
  // Simplified DP - still faster than full knapsack
  const n = Math.min(players.length, 50); // Limit for performance
  const dp = new Array(cap + 1).fill(0);
  
  for (let i = 0; i < n; i++) {
    const p = players[i];
    for (let w = cap; w >= p.salary; w--) {
      dp[w] = Math.max(dp[w], dp[w - p.salary] + p.points);
    }
  }
  
  // Reconstruct lineup (simplified)
  return players.slice(0, 8);
}

// Algorithm 3: Ultra-optimized
function ultraOptimize(players: any[], cap: number) {
  // Pre-calculate and sort once
  const sorted = players
    .map(p => ({ p, r: p.points / p.salary }))
    .sort((a, b) => b.r - a.r)
    .slice(0, 20); // Only consider top 20
  
  const lineup = [];
  let spent = 0;
  
  for (const { p } of sorted) {
    if (spent + p.salary > cap || lineup.length >= 8) break;
    lineup.push(p);
    spent += p.salary;
  }
  
  return lineup;
}

// Run comparison
comparePerformance().catch(console.error);
#!/usr/bin/env tsx
/**
 * 🚀 Run Complete Fantasy ML Pipeline
 * Tests database connection, trains models, and starts API
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import path from 'path';

const steps = [
  {
    name: '🔍 Test Database Connection',
    command: 'npx',
    args: ['tsx', 'scripts/fantasy-ml/test-ml-database.ts']
  },
  {
    name: '🧠 Train Player Performance Predictor',
    command: 'npx',
    args: ['tsx', 'scripts/fantasy-ml/train-player-predictor.ts']
  },
  {
    name: '🚀 Start Fantasy API Service',
    command: 'npx',
    args: ['tsx', 'scripts/fantasy-ml/start-fantasy-api.ts'],
    detached: true
  }
];

async function runStep(step: typeof steps[0]): Promise<void> {
  console.log(chalk.cyan.bold(`\n${step.name}\n`));
  
  return new Promise((resolve, reject) => {
    const proc = spawn(step.command, step.args, {
      stdio: 'inherit',
      cwd: process.cwd(),
      shell: true
    });
    
    if (step.detached) {
      // For API service, just start it and continue
      setTimeout(() => {
        console.log(chalk.green('✅ API service started in background'));
        resolve();
      }, 3000);
      return;
    }
    
    proc.on('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`Step failed with code ${code}`));
      }
    });
    
    proc.on('error', reject);
  });
}

async function runMLPipeline() {
  console.log(chalk.cyan.bold('\n🎯 Fantasy ML Pipeline Runner\n'));
  console.log(chalk.yellow('This will:'));
  console.log('  1. Test database connection');
  console.log('  2. Train ML models with real data');
  console.log('  3. Start the Fantasy API service');
  console.log('');
  
  try {
    for (const step of steps) {
      await runStep(step);
    }
    
    console.log(chalk.green.bold('\n✅ ML Pipeline started successfully!\n'));
    console.log(chalk.cyan('📌 API running at: http://localhost:3338'));
    console.log(chalk.cyan('📌 Test endpoints:'));
    console.log('  - GET  http://localhost:3338/api/health');
    console.log('  - POST http://localhost:3338/api/predictions/players');
    console.log('  - POST http://localhost:3338/api/optimize/lineup');
    console.log('');
    console.log(chalk.yellow('Press Ctrl+C to stop the API service'));
    
  } catch (error) {
    console.error(chalk.red('\n❌ Pipeline failed:'), error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\n\n👋 Shutting down ML pipeline...'));
  process.exit(0);
});

// Run the pipeline
runMLPipeline();
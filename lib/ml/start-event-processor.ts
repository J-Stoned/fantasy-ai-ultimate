#!/usr/bin/env tsx
/**
 * Real-Time Event Processor Launcher
 */

import { RealTimeEventProcessor } from './RealTimeEventProcessor';
import chalk from 'chalk';

console.log(chalk.yellow.bold('\n⚡ Starting Real-Time Event Processor...'));

async function start() {
  try {
    const processor = new RealTimeEventProcessor();
    await processor.start();
    
    console.log(chalk.green('✅ Event processor running'));
    console.log(chalk.cyan('📊 Processing game events in real-time'));
    console.log(chalk.cyan('🧠 ML predictions with GPU acceleration'));
    
  } catch (error) {
    console.error(chalk.red('❌ Failed to start event processor:'), error);
    process.exit(1);
  }
}

// Handle shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\nShutting down event processor...'));
  process.exit(0);
});

start();
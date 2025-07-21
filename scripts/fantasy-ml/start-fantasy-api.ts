#!/usr/bin/env tsx
/**
 * 🚀 Start Fantasy ML API Service
 * Production-ready API for serving ML predictions
 */

import chalk from 'chalk';
import { spawn } from 'child_process';
import path from 'path';
import { testDatabaseConnection } from './config/database';

async function startFantasyAPI() {
  console.log(chalk.cyan.bold('\n🚀 Starting Fantasy ML API Service...\n'));
  
  // Test database connection first
  const connected = await testDatabaseConnection();
  if (!connected) {
    console.error(chalk.red('❌ Cannot start API without database connection'));
    process.exit(1);
  }
  
  console.log(chalk.green('\n✅ Database connected, starting API server...\n'));
  
  // Start the API service
  const apiPath = path.join(__dirname, 'services', 'fantasy-api-service.ts');
  const apiProcess = spawn('tsx', [apiPath], {
    stdio: 'inherit',
    env: { ...process.env }
  });
  
  apiProcess.on('error', (error) => {
    console.error(chalk.red('❌ Failed to start API:'), error);
  });
  
  apiProcess.on('exit', (code) => {
    console.log(chalk.yellow(`\nAPI process exited with code ${code}`));
  });
  
  // Handle graceful shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\n👋 Shutting down Fantasy API...'));
    apiProcess.kill('SIGINT');
    process.exit(0);
  });
}

startFantasyAPI().catch(console.error);
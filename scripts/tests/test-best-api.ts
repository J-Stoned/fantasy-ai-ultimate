#!/usr/bin/env tsx
/**
 * 🎯 TEST BEST API
 * Quick test of the production API with best model
 */

import chalk from 'chalk';
import axios from 'axios';

async function testBestAPI() {
  console.log(chalk.bold.cyan('🎯 TESTING PRODUCTION API WITH BEST MODEL'));
  console.log(chalk.yellow('═'.repeat(50)));
  
  // First, start the API in background
  console.log(chalk.cyan('1️⃣ Starting API...'));
  const { spawn } = require('child_process');
  const api = spawn('npx', ['tsx', 'scripts/production-api-v3.ts'], {
    cwd: process.cwd(),
    detached: true
  });
  
  // Wait for API to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  try {
    // Test health
    console.log(chalk.cyan('\n2️⃣ Testing health endpoint...'));
    const health = await axios.get('http://localhost:3333/health');
    console.log(chalk.green('✅ API is running'));
    console.log('Model status:', health.data.models);
    
    // Test predictions
    console.log(chalk.cyan('\n3️⃣ Testing predictions...'));
    const predictions = await axios.get('http://localhost:3333/api/v2/predictions');
    console.log(chalk.green(`✅ Got ${predictions.data.count} predictions`));
    
    if (predictions.data.predictions.length > 0) {
      const pred = predictions.data.predictions[0];
      console.log(chalk.yellow('\n📊 Sample Prediction:'));
      console.log(`${pred.homeTeam} vs ${pred.awayTeam}`);
      console.log(`Winner: ${pred.predictedWinner}`);
      console.log(`Confidence: ${(pred.confidence * 100).toFixed(1)}%`);
    }
    
    console.log(chalk.bold.green('\n✅ API WORKING WITH BEST MODEL!'));
    
  } catch (error) {
    console.error(chalk.red('❌ Error:'), error.message);
  } finally {
    // Clean up
    try {
      process.kill(-api.pid);
    } catch (e) {}
  }
}

testBestAPI().catch(console.error);
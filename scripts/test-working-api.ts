#!/usr/bin/env tsx
/**
 * 🧪 TEST WORKING API
 * Quick test to verify the API is actually working
 */

import chalk from 'chalk';
import axios from 'axios';

const API_URL = 'http://localhost:3333';

async function testWorkingAPI() {
  console.log(chalk.bold.cyan('🧪 TESTING PRODUCTION API V3'));
  console.log(chalk.yellow('═'.repeat(50)));
  
  try {
    // 1. Test health endpoint
    console.log(chalk.cyan('\n1️⃣ Testing health endpoint...'));
    const healthResponse = await axios.get(`${API_URL}/health`);
    console.log(chalk.green('✅ Health check passed'));
    console.log(chalk.gray('Response:', JSON.stringify(healthResponse.data, null, 2)));
    
    // 2. Test stats endpoint
    console.log(chalk.cyan('\n2️⃣ Testing stats endpoint...'));
    const statsResponse = await axios.get(`${API_URL}/api/v2/stats`);
    console.log(chalk.green('✅ Stats endpoint working'));
    console.log(chalk.gray('Model accuracy:', statsResponse.data.model.accuracy));
    
    // 3. Test predictions endpoint
    console.log(chalk.cyan('\n3️⃣ Testing predictions endpoint...'));
    const predictResponse = await axios.get(`${API_URL}/api/v2/predictions`);
    console.log(chalk.green('✅ Predictions endpoint working'));
    console.log(chalk.gray(`Got ${predictResponse.data.count} predictions`));
    
    if (predictResponse.data.predictions.length > 0) {
      const prediction = predictResponse.data.predictions[0];
      console.log(chalk.yellow('\n📊 Sample Prediction:'));
      console.log(chalk.white(`${prediction.homeTeam} vs ${prediction.awayTeam}`));
      console.log(chalk.white(`Winner: ${prediction.predictedWinner}`));
      console.log(chalk.white(`Confidence: ${(prediction.confidence * 100).toFixed(1)}%`));
      console.log(chalk.white(`Home Win: ${(prediction.homeWinProbability * 100).toFixed(1)}%`));
      console.log(chalk.white(`Away Win: ${(prediction.awayWinProbability * 100).toFixed(1)}%`));
    }
    
    // 4. Test single prediction
    console.log(chalk.cyan('\n4️⃣ Testing single prediction...'));
    const singlePrediction = await axios.post(`${API_URL}/api/v2/predictions`, {
      homeTeamId: 'test-home-id',
      awayTeamId: 'test-away-id',
      homeTeamName: 'Test Home Team',
      awayTeamName: 'Test Away Team'
    });
    console.log(chalk.green('✅ Single prediction working'));
    console.log(chalk.gray('Winner:', singlePrediction.data.predictedWinner));
    
    console.log(chalk.bold.green('\n🎉 ALL TESTS PASSED!'));
    console.log(chalk.green('The API is working correctly on port 3333'));
    
  } catch (error) {
    if (error.code === 'ECONNREFUSED') {
      console.error(chalk.red('\n❌ API is not running!'));
      console.log(chalk.yellow('Start it with:'));
      console.log(chalk.white('npx tsx scripts/production-api-v3.ts'));
    } else {
      console.error(chalk.red('\n❌ Test failed:'), error.message);
    }
  }
}

testWorkingAPI().catch(console.error);
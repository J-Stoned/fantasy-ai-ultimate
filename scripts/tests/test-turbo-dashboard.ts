#!/usr/bin/env tsx
/**
 * Test Turbo Dashboard WebSocket Connection
 */

import WebSocket from 'ws';
import chalk from 'chalk';

async function testTurboDashboard() {
  console.log(chalk.bold.yellow('\n🔥 TESTING TURBO DASHBOARD CONNECTION...\n'));
  
  const ws = new WebSocket('ws://localhost:8080');
  let messageCount = 0;
  let predictionCount = 0;
  const startTime = Date.now();
  
  ws.on('open', () => {
    console.log(chalk.green('✅ Connected to WebSocket server'));
    console.log(chalk.cyan('Listening for turbo predictions...\n'));
  });
  
  ws.on('message', (data) => {
    messageCount++;
    try {
      const message = JSON.parse(data.toString());
      
      if (message.channel === 'predictions') {
        predictionCount++;
        const pred = message.data;
        
        console.log(chalk.bold(`🎯 Prediction #${predictionCount}:`));
        console.log(`   Game: ${pred.game?.home_team || 'Unknown'} vs ${pred.game?.away_team || 'Unknown'}`);
        console.log(`   Winner: ${chalk.green(pred.prediction.winner.toUpperCase())}`);
        console.log(`   Confidence: ${chalk.yellow(pred.prediction.confidence.toFixed(1) + '%')}`);
        console.log(`   Probability: ${(pred.prediction.homeWinProbability * 100).toFixed(1)}%`);
        console.log(chalk.gray(`   Timestamp: ${new Date(message.timestamp).toLocaleTimeString()}\n`));
      } else {
        console.log(chalk.gray(`📨 ${message.channel}: ${JSON.stringify(message.data).substring(0, 100)}...`));
      }
    } catch (err) {
      console.error(chalk.red('Failed to parse message:'), err);
    }
  });
  
  ws.on('error', (error) => {
    console.error(chalk.red('WebSocket error:'), error);
  });
  
  ws.on('close', () => {
    const elapsed = (Date.now() - startTime) / 1000;
    console.log(chalk.yellow('\n📊 Connection Summary:'));
    console.log(`   Total messages: ${messageCount}`);
    console.log(`   Predictions received: ${predictionCount}`);
    console.log(`   Duration: ${elapsed.toFixed(1)}s`);
    console.log(`   Rate: ${(predictionCount / elapsed).toFixed(1)} predictions/second`);
  });
  
  // Close after 30 seconds
  setTimeout(() => {
    console.log(chalk.yellow('\n👋 Closing connection...'));
    ws.close();
  }, 30000);
}

testTurboDashboard().catch(console.error);
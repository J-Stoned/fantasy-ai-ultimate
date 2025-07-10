#!/usr/bin/env tsx
/**
 * 🧪 WebSocket Integration Test
 * 
 * Tests the full prediction broadcasting pipeline
 */

import WebSocket from 'ws';
import chalk from 'chalk';
import { ensemblePredictor } from '../lib/ml/ensemble-predictor';
import { predictionBroadcaster } from '../lib/realtime/prediction-broadcaster';
import * as path from 'path';

const WS_URL = 'ws://localhost:8080';

async function testIntegration() {
  console.log(chalk.bold.cyan('\n🧪 TESTING WEBSOCKET INTEGRATION'));
  console.log(chalk.gray('='.repeat(50)));
  
  // 1. Connect to WebSocket
  console.log(chalk.yellow('\n1. Connecting to WebSocket server...'));
  const ws = new WebSocket(WS_URL);
  
  let messageCount = 0;
  let predictionReceived = false;
  
  ws.on('open', () => {
    console.log(chalk.green('✅ Connected to WebSocket server'));
    
    // Subscribe to channels
    ws.send(JSON.stringify({
      type: 'subscribe',
      channels: ['predictions', 'alerts', 'system']
    }));
  });
  
  ws.on('message', (data) => {
    messageCount++;
    const message = JSON.parse(data.toString());
    
    if (message.type === 'predictions' && message.data.type === 'new_prediction') {
      predictionReceived = true;
      console.log(chalk.green('✅ Received prediction broadcast!'));
      console.log(chalk.gray(`   Game: ${message.data.data.game.homeTeam} vs ${message.data.data.game.awayTeam}`));
      console.log(chalk.gray(`   Winner: ${message.data.data.prediction.winner}`));
      console.log(chalk.gray(`   Confidence: ${(message.data.data.prediction.confidence * 100).toFixed(1)}%`));
    }
  });
  
  // 2. Initialize prediction broadcaster
  console.log(chalk.yellow('\n2. Initializing prediction broadcaster...'));
  await predictionBroadcaster.initialize();
  
  if (predictionBroadcaster.isAvailable()) {
    console.log(chalk.green('✅ Prediction broadcaster ready'));
  }
  
  // 3. Load ML models
  console.log(chalk.yellow('\n3. Loading ML models...'));
  try {
    await ensemblePredictor.loadModels(path.join(process.cwd(), 'models'));
    console.log(chalk.green('✅ ML models loaded'));
  } catch (error) {
    console.log(chalk.red('❌ Could not load models:', error.message));
    return;
  }
  
  // 4. Create and broadcast a test prediction
  console.log(chalk.yellow('\n4. Creating test prediction...'));
  
  const testPrediction = {
    gameId: 'test_' + Date.now(),
    prediction: {
      winner: 'home' as const,
      homeWinProbability: 0.65,
      confidence: 0.75,
      models: {
        neuralNetwork: 0.63,
        randomForest: 0.67
      }
    },
    game: {
      homeTeam: 'Test Home Team',
      awayTeam: 'Test Away Team',
      startTime: new Date().toISOString(),
      sport: 'nfl'
    },
    timestamp: Date.now()
  };
  
  // Broadcast the prediction
  console.log(chalk.yellow('Broadcasting test prediction...'));
  predictionBroadcaster.broadcastPrediction(testPrediction);
  
  // Wait for message
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // 5. Check results
  console.log(chalk.bold.cyan('\n📊 TEST RESULTS'));
  console.log(chalk.gray('='.repeat(30)));
  console.log(`Messages received: ${messageCount}`);
  console.log(`Prediction broadcast received: ${predictionReceived ? '✅ YES' : '❌ NO'}`);
  
  const metrics = predictionBroadcaster.getMetrics();
  if (metrics) {
    console.log(`\nBroadcaster metrics:`);
    console.log(`  Active clients: ${metrics.activeClients}`);
    console.log(`  Messages sent: ${metrics.messagesSent}`);
    console.log(`  Predictions broadcast: ${metrics.predictionsBroadcast}`);
  }
  
  if (predictionReceived) {
    console.log(chalk.bold.green('\n✅ WebSocket integration test PASSED!'));
  } else {
    console.log(chalk.bold.red('\n❌ WebSocket integration test FAILED!'));
  }
  
  // Cleanup
  ws.close();
}

testIntegration().catch(console.error);
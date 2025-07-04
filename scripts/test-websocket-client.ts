#!/usr/bin/env tsx
/**
 * 🧪 WebSocket Client Test
 * 
 * Tests real-time prediction broadcasts
 */

import WebSocket from 'ws';
import chalk from 'chalk';

const WS_URL = 'ws://localhost:8080';

async function testWebSocketClient() {
  console.log(chalk.bold.cyan('\n🧪 TESTING WEBSOCKET CLIENT'));
  console.log(chalk.gray('='.repeat(40)));
  
  const ws = new WebSocket(WS_URL);
  
  ws.on('open', () => {
    console.log(chalk.green('✅ Connected to WebSocket server'));
    
    // Subscribe to channels
    ws.send(JSON.stringify({
      type: 'subscribe',
      channels: ['predictions', 'alerts', 'system', 'metrics']
    }));
    
    // Send ping
    ws.send(JSON.stringify({ type: 'ping' }));
  });
  
  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'welcome':
          console.log(chalk.cyan('👋 Welcome message received'));
          console.log(chalk.gray(`   Client ID: ${message.data.clientId}`));
          break;
          
        case 'subscribed':
          console.log(chalk.green('✅ Subscribed to channels:'), message.data.channels);
          break;
          
        case 'pong':
          console.log(chalk.blue('🏓 Pong received'));
          break;
          
        case 'predictions':
          if (message.data.type === 'new_prediction') {
            const pred = message.data.data;
            console.log(chalk.yellow('\n🔮 NEW PREDICTION:'));
            console.log(`   ${pred.game.homeTeam} vs ${pred.game.awayTeam}`);
            console.log(`   Winner: ${pred.prediction.winner.toUpperCase()}`);
            console.log(`   Confidence: ${(pred.prediction.confidence * 100).toFixed(1)}%`);
            console.log(`   Home Win: ${(pred.prediction.homeWinProbability * 100).toFixed(1)}%`);
          }
          break;
          
        case 'alerts':
          if (message.data.type === 'high_confidence_prediction') {
            console.log(chalk.red.bold('\n🚨 HIGH CONFIDENCE ALERT:'));
            console.log(`   ${message.data.data.message}`);
          }
          break;
          
        case 'system':
          if (message.data.type === 'batch_complete') {
            console.log(chalk.green(`\n✅ Batch complete: ${message.data.data.predictions} predictions`));
          } else if (message.data.type === 'server_ready') {
            console.log(chalk.blue(`📡 ${message.data.data.message}`));
          }
          break;
          
        case 'metrics':
          if (message.data.type === 'model_accuracy') {
            console.log(chalk.magenta('\n📊 Model Update:'));
            console.log(`   Model: ${message.data.data.model}`);
            console.log(`   Accuracy: ${(message.data.data.accuracy * 100).toFixed(1)}%`);
          }
          break;
          
        default:
          console.log(chalk.gray('📨 Message:'), message.type);
      }
    } catch (error) {
      console.error(chalk.red('Error parsing message:'), error);
    }
  });
  
  ws.on('error', (error) => {
    console.error(chalk.red('❌ WebSocket error:'), error.message);
  });
  
  ws.on('close', () => {
    console.log(chalk.yellow('\n👋 Disconnected from WebSocket server'));
  });
  
  // Keep connection alive
  setInterval(() => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'ping' }));
    }
  }, 30000);
  
  // Handle shutdown
  process.on('SIGINT', () => {
    console.log(chalk.yellow('\nClosing WebSocket connection...'));
    ws.close();
    process.exit(0);
  });
}

testWebSocketClient().catch(console.error);
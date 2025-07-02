#!/usr/bin/env tsx
/**
 * 🧪 TEST WEBSOCKET CONNECTION
 * 
 * Verifies the real-time server is working correctly
 */

import WebSocket from 'ws';
import chalk from 'chalk';

async function testWebSocketConnection() {
  console.log(chalk.blue.bold('\n🧪 TESTING WEBSOCKET CONNECTION\n'));
  
  const ws = new WebSocket('ws://localhost:8080');
  let messageCount = 0;
  
  ws.on('open', () => {
    console.log(chalk.green('✅ Connected to WebSocket server'));
    
    // Subscribe to channels
    ws.send(JSON.stringify({
      type: 'subscribe',
      channels: ['predictions', 'games', 'alerts', 'metrics']
    }));
  });
  
  ws.on('message', (data) => {
    messageCount++;
    const message = JSON.parse(data.toString());
    
    console.log(chalk.cyan(`\n📨 Message #${messageCount}:`));
    console.log(chalk.gray(`Type: ${message.type}`));
    
    if (message.type === 'welcome') {
      console.log(chalk.green('Welcome message received!'));
      console.log('Client ID:', message.data.clientId);
    } else if (message.type === 'subscribed') {
      console.log(chalk.green('Subscribed to channels:'), message.data.channels);
    } else if (message.type === 'predictions') {
      console.log(chalk.yellow('Predictions received:'));
      if (message.data.predictions) {
        console.log(`  - ${message.data.predictions.length} game predictions`);
        console.log(`  - Model accuracy: ${(message.data.accuracy * 100).toFixed(1)}%`);
      }
    } else if (message.type === 'games') {
      console.log(chalk.magenta('Game update:'));
      console.log(`  - ${message.data.homeTeam} vs ${message.data.awayTeam}`);
      console.log(`  - Score: ${message.data.homeScore}-${message.data.awayScore}`);
    } else if (message.type === 'metrics') {
      console.log(chalk.blue('System metrics:'));
      console.log(`  - Active clients: ${message.data.websocket?.activeClients || 0}`);
      console.log(`  - ML latency: ${message.data.ml?.predictionLatency || 0}ms`);
    }
  });
  
  ws.on('error', (error) => {
    console.error(chalk.red('❌ WebSocket error:'), error.message);
  });
  
  ws.on('close', () => {
    console.log(chalk.yellow('\n🔌 Disconnected from server'));
    console.log(chalk.cyan(`Total messages received: ${messageCount}`));
  });
  
  // Send test ping
  setTimeout(() => {
    console.log(chalk.gray('\n🏓 Sending ping...'));
    ws.send(JSON.stringify({ type: 'ping' }));
  }, 2000);
  
  // Test for 30 seconds then disconnect
  setTimeout(() => {
    console.log(chalk.yellow('\n🛑 Test complete, closing connection...'));
    ws.close();
    
    if (messageCount > 0) {
      console.log(chalk.green.bold('\n✅ WebSocket test PASSED!'));
      console.log(chalk.gray(`Received ${messageCount} messages in 30 seconds`));
    } else {
      console.log(chalk.red.bold('\n❌ WebSocket test FAILED!'));
      console.log(chalk.gray('No messages received'));
    }
    
    process.exit(messageCount > 0 ? 0 : 1);
  }, 30000);
}

// Check if server is running first
const checkServer = new WebSocket('ws://localhost:8080');

checkServer.on('error', () => {
  console.error(chalk.red('❌ WebSocket server not running!'));
  console.log(chalk.yellow('Start the server with: npm run start:realtime'));
  process.exit(1);
});

checkServer.on('open', () => {
  checkServer.close();
  testWebSocketConnection();
});
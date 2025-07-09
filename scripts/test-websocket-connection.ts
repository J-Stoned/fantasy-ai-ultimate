#!/usr/bin/env tsx

/**
 * Test WebSocket Connection
 * Verifies that WebSocket is properly configured and working
 */

import { io } from 'socket.io-client';
import chalk from 'chalk';

async function testWebSocketConnection() {
  console.log(chalk.blue('🧪 Testing WebSocket Connection...\n'));
  
  const url = 'http://localhost:3000';
  console.log(`📡 Connecting to: ${url}`);
  
  const socket = io(url, {
    transports: ['websocket', 'polling'],
    reconnection: false
  });
  
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.disconnect();
      reject(new Error('Connection timeout'));
    }, 10000);
    
    socket.on('connect', () => {
      clearTimeout(timeout);
      console.log(chalk.green('✅ WebSocket connected successfully!'));
      console.log(`   Socket ID: ${socket.id}`);
      console.log(`   Transport: ${socket.io.engine.transport.name}\n`);
      
      // Test sending a message
      console.log('📤 Sending test message...');
      socket.emit('test', { message: 'Hello from test script!' });
      
      // Test subscribing to a channel
      console.log('📡 Subscribing to test channel...');
      socket.emit('subscribe', { channel: 'test' });
      
      setTimeout(() => {
        socket.disconnect();
        resolve(true);
      }, 2000);
    });
    
    socket.on('connect_error', (error) => {
      clearTimeout(timeout);
      console.error(chalk.red('❌ Connection failed:'), error.message);
      reject(error);
    });
    
    socket.on('message', (data) => {
      console.log(chalk.cyan('📨 Received message:'), data);
    });
    
    socket.on('error', (error) => {
      console.error(chalk.red('🚨 Socket error:'), error);
    });
  });
}

// Run the test
testWebSocketConnection()
  .then(() => {
    console.log(chalk.green('\n✅ WebSocket test passed!'));
    process.exit(0);
  })
  .catch((error) => {
    console.error(chalk.red('\n❌ WebSocket test failed!'));
    console.error(chalk.yellow('\nMake sure the server is running:'));
    console.error(chalk.yellow('  npm run dev:web'));
    process.exit(1);
  });
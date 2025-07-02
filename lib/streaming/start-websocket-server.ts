#!/usr/bin/env tsx
/**
 * WebSocket Server Launcher
 */

import { WebSocketBroadcaster } from './WebSocketBroadcaster';
import chalk from 'chalk';

console.log(chalk.blue.bold('\n🌐 Starting WebSocket Server...'));

const broadcaster = new WebSocketBroadcaster();

// Handle shutdown
process.on('SIGINT', () => {
  console.log(chalk.yellow('\nShutting down WebSocket server...'));
  process.exit(0);
});

console.log(chalk.green('✅ WebSocket server running on ws://localhost:3001'));
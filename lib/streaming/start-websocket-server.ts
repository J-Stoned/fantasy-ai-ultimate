#!/usr/bin/env tsx
/**
 * WebSocket Server Launcher
 */

import { WebSocketBroadcaster } from './WebSocketBroadcaster';
import chalk from 'chalk';

async function startWebSocketServer() {
  console.log(chalk.blue.bold('\n🌐 Starting WebSocket Server...'));
  
  const broadcaster = new WebSocketBroadcaster(8080);
  
  try {
    await broadcaster.initialize();
    console.log(chalk.green('✅ WebSocket server running on ws://localhost:8080'));
    
    // Log metrics every 30 seconds
    setInterval(() => {
      const metrics = broadcaster.getMetrics();
      console.log(chalk.cyan('\n📊 WebSocket Metrics:'));
      console.log(`  Active clients: ${metrics.activeClients}`);
      console.log(`  Messages sent: ${metrics.messagesSent}`);
      console.log(`  Data transferred: ${metrics.bytesTransferred} bytes`);
      console.log(`  Queue size: ${metrics.queueSize}`);
    }, 30000);
    
    // Test broadcast
    setTimeout(() => {
      broadcaster.broadcast('system', {
        type: 'server_ready',
        message: 'WebSocket server is ready for real-time updates!'
      });
    }, 1000);
    
    // Add HTTP health endpoint
    const http = require('http');
    const healthServer = http.createServer((req: any, res: any) => {
      if (req.url === '/health') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
          status: 'ok',
          clients: broadcaster.getMetrics().activeClients,
          uptime: process.uptime()
        }));
      } else {
        res.writeHead(404);
        res.end();
      }
    });
    healthServer.listen(8081, () => {
      console.log(chalk.green('✅ Health check available at http://localhost:8081/health'));
    });
    
  } catch (error) {
    console.error(chalk.red('Failed to start WebSocket server:'), error);
    process.exit(1);
  }
  
  // Handle shutdown
  process.on('SIGINT', async () => {
    console.log(chalk.yellow('\nShutting down WebSocket server...'));
    await broadcaster.shutdown();
    process.exit(0);
  });
}

startWebSocketServer().catch(console.error);
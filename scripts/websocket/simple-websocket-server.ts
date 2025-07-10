#!/usr/bin/env tsx
/**
 * Simple WebSocket Server for Pattern Alerts
 */

import { WebSocketServer } from 'ws';
import chalk from 'chalk';

const PORT = 8080;

const wss = new WebSocketServer({ port: PORT });
const clients = new Set<any>();

console.log(chalk.green(`✅ WebSocket server running on ws://localhost:${PORT}`));

wss.on('connection', (ws) => {
  const clientId = Math.random().toString(36).substring(7);
  const client = { id: clientId, ws, subscriptions: new Set(['all']) };
  clients.add(client);
  
  console.log(chalk.cyan(`👤 Client connected: ${clientId} (Total: ${clients.size})`));
  
  // Send welcome message
  ws.send(JSON.stringify({
    type: 'welcome',
    data: { clientId, server: 'pattern-alerts' }
  }));
  
  ws.on('message', (message) => {
    try {
      const msg = JSON.parse(message.toString());
      
      if (msg.type === 'subscribe' && Array.isArray(msg.channels)) {
        msg.channels.forEach((ch: string) => client.subscriptions.add(ch));
        ws.send(JSON.stringify({
          type: 'subscribed',
          data: { channels: msg.channels }
        }));
      } else if (msg.type === 'broadcast' && msg.channel && msg.data) {
        // Broadcast to all clients subscribed to this channel
        broadcast(msg.channel, msg.data);
      }
    } catch (error) {
      console.error('Message error:', error);
    }
  });
  
  ws.on('close', () => {
    clients.delete(client);
    console.log(chalk.yellow(`👋 Client disconnected: ${clientId} (Total: ${clients.size})`));
  });
  
  ws.on('error', (error) => {
    console.error(chalk.red(`Client ${clientId} error:`), error);
    clients.delete(client);
  });
});

function broadcast(channel: string, data: any) {
  const message = JSON.stringify({
    channel,
    data,
    timestamp: new Date().toISOString()
  });
  
  let sent = 0;
  clients.forEach((client) => {
    if (client.subscriptions.has(channel) || client.subscriptions.has('all')) {
      if (client.ws.readyState === 1) { // OPEN
        client.ws.send(message);
        sent++;
      }
    }
  });
  
  console.log(chalk.blue(`📡 Broadcast to ${sent} clients on channel: ${channel}`));
}

// Log stats every 30 seconds
setInterval(() => {
  console.log(chalk.cyan(`\n📊 WebSocket Stats:`));
  console.log(`  Active clients: ${clients.size}`);
}, 30000);

// Test broadcast
setTimeout(() => {
  broadcast('system', {
    type: 'server_ready',
    message: 'WebSocket server ready for pattern alerts!'
  });
}, 1000);

process.on('SIGINT', () => {
  console.log(chalk.yellow('\nShutting down...'));
  wss.close();
  process.exit(0);
});
/**
 * 🔥 WEBSOCKET SERVER WITH KAFKA CONSUMER
 * Broadcasts predictions from Kafka to all connected clients
 */

import WebSocket from 'ws';
import { kafkaClient } from '../kafka/kafka-client';
import { EachMessagePayload } from 'kafkajs';
import chalk from 'chalk';

export class WebSocketKafkaServer {
  private wss: WebSocket.Server;
  private clients: Map<string, WebSocket> = new Map();
  private stats = {
    messagesReceived: 0,
    messagesBroadcast: 0,
    bytesTransferred: 0
  };
  
  constructor(port: number = 8080) {
    this.wss = new WebSocket.Server({ port });
    console.log(chalk.bold.cyan(`🌐 WebSocket + Kafka Server starting on port ${port}...`));
    
    this.setupWebSocketServer();
    this.startKafkaConsumer();
  }
  
  private setupWebSocketServer() {
    this.wss.on('connection', (ws: WebSocket, req) => {
      const clientId = `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.clients.set(clientId, ws);
      
      console.log(chalk.green(`👤 New client connected: ${clientId}`));
      console.log(chalk.gray(`   Total clients: ${this.clients.size}`));
      
      // Send welcome message with real-time stats
      ws.send(JSON.stringify({
        type: 'welcome',
        clientId,
        activeClients: this.clients.size,
        serverStats: this.stats,
        timestamp: Date.now()
      }));
      
      // Handle client messages
      ws.on('message', (message: string) => {
        try {
          const data = JSON.parse(message);
          this.handleClientMessage(clientId, data);
        } catch (error) {
          console.error(chalk.red('Invalid message from client:'), error);
        }
      });
      
      // Handle disconnection
      ws.on('close', () => {
        this.clients.delete(clientId);
        console.log(chalk.yellow(`👋 Client disconnected: ${clientId}`));
        console.log(chalk.gray(`   Total clients: ${this.clients.size}`));
      });
      
      ws.on('error', (error) => {
        console.error(chalk.red(`Client ${clientId} error:`), error);
      });
    });
    
    console.log(chalk.green('✅ WebSocket server ready'));
  }
  
  private async startKafkaConsumer() {
    try {
      // Consumer for predictions
      await kafkaClient.startConsumer(
        'websocket-broadcaster',
        ['predictions', 'notifications', 'game-events'],
        this.handleKafkaMessage.bind(this)
      );
      
      console.log(chalk.green('✅ Kafka consumer started'));
    } catch (error) {
      console.error(chalk.red('Failed to start Kafka consumer:'), error);
    }
  }
  
  private async handleKafkaMessage(payload: EachMessagePayload) {
    const { topic, message } = payload;
    
    if (!message.value) return;
    
    try {
      const data = JSON.parse(message.value.toString());
      this.stats.messagesReceived++;
      
      // Prepare broadcast message
      let broadcastMessage: any = {
        type: 'kafka_event',
        topic,
        timestamp: Date.now()
      };
      
      switch (topic) {
        case 'predictions':
          broadcastMessage = {
            type: 'new_prediction',
            data: {
              gameId: data.gameId,
              prediction: data.prediction,
              model: data.model,
              confidence: data.prediction.confidence,
              timestamp: data.timestamp
            }
          };
          break;
          
        case 'notifications':
          broadcastMessage = {
            type: 'notification',
            data: {
              title: data.title,
              message: data.message,
              notificationType: data.type,
              data: data.data
            }
          };
          break;
          
        case 'game-events':
          broadcastMessage = {
            type: 'game_update',
            data: {
              gameId: data.gameId,
              eventType: data.type,
              teams: data.teams,
              score: data.score
            }
          };
          break;
      }
      
      // Broadcast to all clients
      this.broadcast(broadcastMessage);
      
      // Show activity
      if (this.stats.messagesReceived % 1000 === 0) {
        console.log(chalk.cyan(`📡 Processed ${this.stats.messagesReceived} Kafka messages`));
      }
    } catch (error) {
      console.error(chalk.red('Error processing Kafka message:'), error);
    }
  }
  
  private handleClientMessage(clientId: string, data: any) {
    switch (data.type) {
      case 'subscribe':
        console.log(chalk.gray(`Client ${clientId} subscribed to: ${data.topics?.join(', ')}`));
        break;
        
      case 'ping':
        const client = this.clients.get(clientId);
        if (client) {
          client.send(JSON.stringify({ type: 'pong', timestamp: Date.now() }));
        }
        break;
        
      default:
        console.log(chalk.gray(`Unknown message type from ${clientId}: ${data.type}`));
    }
  }
  
  private broadcast(message: any) {
    const messageStr = JSON.stringify(message);
    const messageSize = Buffer.byteLength(messageStr);
    let sent = 0;
    
    this.clients.forEach((client, clientId) => {
      if (client.readyState === WebSocket.OPEN) {
        try {
          client.send(messageStr);
          sent++;
          this.stats.bytesTransferred += messageSize;
        } catch (error) {
          console.error(chalk.red(`Failed to send to ${clientId}:`), error);
        }
      }
    });
    
    this.stats.messagesBroadcast++;
    
    // High-frequency logging (every 10k messages)
    if (this.stats.messagesBroadcast % 10000 === 0) {
      this.showStats();
    }
  }
  
  private showStats() {
    console.log(chalk.bold.yellow('\n📊 WEBSOCKET + KAFKA METRICS:'));
    console.log(chalk.green(`   Active Clients: ${this.clients.size}`));
    console.log(chalk.green(`   Kafka Messages: ${this.stats.messagesReceived.toLocaleString()}`));
    console.log(chalk.green(`   Broadcasts: ${this.stats.messagesBroadcast.toLocaleString()}`));
    console.log(chalk.green(`   Data Transferred: ${(this.stats.bytesTransferred / 1024 / 1024).toFixed(2)} MB`));
    console.log(chalk.green(`   Throughput: ${(this.stats.messagesReceived / (Date.now() / 1000)).toFixed(0)} msg/sec`));
  }
  
  // Periodic stats
  startStatsInterval() {
    setInterval(() => {
      this.showStats();
    }, 30000); // Every 30 seconds
  }
  
  async shutdown() {
    console.log(chalk.yellow('Shutting down WebSocket + Kafka server...'));
    
    // Close all client connections
    this.clients.forEach((client, clientId) => {
      client.close(1000, 'Server shutting down');
    });
    
    // Close WebSocket server
    this.wss.close();
    
    // Shutdown Kafka
    await kafkaClient.shutdown();
    
    console.log(chalk.green('✅ Server shutdown complete'));
  }
}

// Start server if run directly
if (require.main === module) {
  const server = new WebSocketKafkaServer(8080);
  server.startStatsInterval();
  
  process.on('SIGINT', async () => {
    await server.shutdown();
    process.exit(0);
  });
}
/**
 * WEBSOCKET BROADCASTER
 * 
 * Broadcasts real-time ML predictions to connected clients
 * Handles 10K+ concurrent connections with priority queuing
 */

import { WebSocketServer, WebSocket } from 'ws';
import { createServer } from 'http';
import { performance } from 'perf_hooks';
import EventEmitter from 'events';

interface Client {
  id: string;
  ws: WebSocket;
  subscriptions: Set<string>;
  priority: 'high' | 'normal' | 'low';
  lastActivity: number;
}

interface BroadcastMessage {
  type: string;
  data: any;
  timestamp: number;
  priority?: number;
}

export class WebSocketBroadcaster extends EventEmitter {
  private wss: WebSocketServer | null = null;
  private clients: Map<string, Client> = new Map();
  private messageQueue: BroadcastMessage[] = [];
  private broadcasting = false;
  private port: number;
  
  // Metrics
  private messagesSent = 0;
  private bytesTransferred = 0;
  
  constructor(port: number = 8080) {
    super();
    this.port = port;
  }
  
  /**
   * Initialize WebSocket server
   */
  async initialize(): Promise<void> {
    const server = createServer();
    this.wss = new WebSocketServer({ server });
    
    this.wss.on('connection', (ws, req) => {
      this.handleNewConnection(ws, req);
    });
    
    server.listen(this.port, () => {
      console.log(`📡 WebSocket server listening on port ${this.port}`);
    });
    
    // Start broadcast loop
    this.startBroadcastLoop();
    
    // Start health check
    this.startHealthCheck();
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleNewConnection(ws: WebSocket, req: any): void {
    const clientId = this.generateClientId();
    const client: Client = {
      id: clientId,
      ws,
      subscriptions: new Set(['all']),
      priority: 'normal',
      lastActivity: Date.now()
    };
    
    this.clients.set(clientId, client);
    console.log(`👤 New client connected: ${clientId}`);
    
    // Send welcome message
    this.sendToClient(client, {
      type: 'welcome',
      data: {
        clientId,
        availableSubscriptions: ['all', 'predictions', 'alerts', 'metrics']
      }
    });
    
    // Handle messages
    ws.on('message', (message) => {
      this.handleClientMessage(client, message.toString());
    });
    
    // Handle disconnect
    ws.on('close', () => {
      this.clients.delete(clientId);
      console.log(`👋 Client disconnected: ${clientId}`);
    });
    
    // Handle errors
    ws.on('error', (error) => {
      console.error(`Client ${clientId} error:`, error);
      this.clients.delete(clientId);
    });
  }
  
  /**
   * Handle messages from clients
   */
  private handleClientMessage(client: Client, message: string): void {
    try {
      const msg = JSON.parse(message);
      client.lastActivity = Date.now();
      
      switch (msg.type) {
        case 'subscribe':
          if (Array.isArray(msg.channels)) {
            msg.channels.forEach((channel: string) => {
              client.subscriptions.add(channel);
            });
            this.sendToClient(client, {
              type: 'subscribed',
              data: { channels: msg.channels }
            });
          }
          break;
          
        case 'unsubscribe':
          if (Array.isArray(msg.channels)) {
            msg.channels.forEach((channel: string) => {
              client.subscriptions.delete(channel);
            });
          }
          break;
          
        case 'ping':
          this.sendToClient(client, { type: 'pong' });
          break;
      }
    } catch (error) {
      console.error('Invalid client message:', error);
    }
  }
  
  /**
   * Broadcast message to all subscribed clients
   */
  broadcast(channel: string, data: any, priority: number = 5): void {
    const message: BroadcastMessage = {
      type: channel,
      data,
      timestamp: Date.now(),
      priority
    };
    
    // High priority messages skip the queue
    if (priority >= 8) {
      this.sendBroadcast(message);
    } else {
      this.messageQueue.push(message);
      this.messageQueue.sort((a, b) => (b.priority || 5) - (a.priority || 5));
    }
  }
  
  /**
   * Send broadcast to clients
   */
  private sendBroadcast(message: BroadcastMessage): void {
    const messageStr = JSON.stringify(message);
    const messageSize = Buffer.byteLength(messageStr);
    let sentCount = 0;
    
    this.clients.forEach(client => {
      if (client.subscriptions.has(message.type) || 
          client.subscriptions.has('all')) {
        if (client.ws.readyState === WebSocket.OPEN) {
          client.ws.send(messageStr);
          sentCount++;
          this.bytesTransferred += messageSize;
        }
      }
    });
    
    this.messagesSent += sentCount;
    
    if (sentCount > 0) {
      this.emit('broadcast', {
        channel: message.type,
        recipients: sentCount,
        size: messageSize
      });
    }
  }
  
  /**
   * Send message to specific client
   */
  private sendToClient(client: Client, message: any): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify({
        ...message,
        timestamp: Date.now()
      }));
    }
  }
  
  /**
   * Start broadcast loop for queued messages
   */
  private startBroadcastLoop(): void {
    setInterval(() => {
      if (!this.broadcasting && this.messageQueue.length > 0) {
        this.broadcasting = true;
        
        // Process up to 100 messages per tick
        const batch = this.messageQueue.splice(0, 100);
        batch.forEach(msg => this.sendBroadcast(msg));
        
        this.broadcasting = false;
      }
    }, 10); // 100Hz broadcast rate
  }
  
  /**
   * Health check for disconnected clients
   */
  private startHealthCheck(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = 60000; // 1 minute timeout
      
      this.clients.forEach((client, id) => {
        if (now - client.lastActivity > timeout) {
          if (client.ws.readyState === WebSocket.OPEN) {
            client.ws.ping();
          } else {
            this.clients.delete(id);
          }
        }
      });
      
      this.emit('health', {
        activeClients: this.clients.size,
        messagesSent: this.messagesSent,
        bytesTransferred: this.bytesTransferred,
        queueSize: this.messageQueue.length
      });
    }, 30000); // Every 30 seconds
  }
  
  /**
   * Generate unique client ID
   */
  private generateClientId(): string {
    return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }
  
  /**
   * Get current metrics
   */
  getMetrics() {
    return {
      activeClients: this.clients.size,
      messagesSent: this.messagesSent,
      bytesTransferred: this.bytesTransferred,
      queueSize: this.messageQueue.length,
      clientDetails: Array.from(this.clients.values()).map(c => ({
        id: c.id,
        subscriptions: Array.from(c.subscriptions),
        priority: c.priority,
        connected: c.ws.readyState === WebSocket.OPEN
      }))
    };
  }
  
  /**
   * Shutdown broadcaster
   */
  async shutdown(): Promise<void> {
    // Send shutdown notice
    this.broadcast('system', { 
      type: 'shutdown',
      message: 'Server is shutting down'
    }, 10);
    
    // Close all connections
    this.clients.forEach(client => {
      client.ws.close(1001, 'Server shutdown');
    });
    
    // Close server
    if (this.wss) {
      this.wss.close();
    }
  }
}

// Export singleton instance
export const broadcaster = new WebSocketBroadcaster();
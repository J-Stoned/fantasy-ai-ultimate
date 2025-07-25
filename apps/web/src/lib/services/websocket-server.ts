import { WebSocketServer, WebSocket } from 'ws';
import { createServer, IncomingMessage } from 'http';
import { parse } from 'url';
import { verify, JwtPayload } from 'jsonwebtoken';
import { Redis } from 'ioredis';
import { config } from '../config';
import { getOracleWebSocketHandler } from './websocket/oracle-websocket';
import { getAgentDebateEngine } from './ai/agent-debate-engine';
import type { 
import { logger } from '../logging/logger';
  WebSocketMessage as WSMessage,
  WebSocketEventType,
  ContestEvent,
  WebSocketError
} from '../../types/websocket';

interface AuthenticatedWebSocket extends WebSocket {
  userId?: string;
  isAlive?: boolean;
}

interface WebSocketMessage {
  type: string;
  channel?: string;
  data?: unknown;
}

interface LineupUpdateData {
  lineupId: string;
  players: string[];
  totalSalary: number;
  projectedPoints: number;
}

interface ContestJoinData {
  contestId: string;
  entryId?: string;
}

interface OptimizationRequestData {
  requestId: string;
  contestId: string;
  constraints?: Record<string, unknown>;
}

export class RealtimeWebSocketServer {
  private wss: WebSocketServer;
  private redis: Redis;
  private redisSub: Redis;
  private clients: Map<string, Set<AuthenticatedWebSocket>>;
  private channels: Map<string, Set<string>>; // channel -> Set of userIds

  constructor(port: number = 3001) {
    // Create HTTP server
    const server = createServer();
    
    // Create WebSocket server
    this.wss = new WebSocketServer({ server });
    
    // Initialize Redis clients
    this.redis = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    });
    
    this.redisSub = new Redis({
      host: config.redis.host,
      port: config.redis.port,
      password: config.redis.password,
    });
    
    // Initialize client and channel maps
    this.clients = new Map();
    this.channels = new Map();
    
    // Set up WebSocket server
    this.setupWebSocketServer();
    
    // Set up Redis subscriptions
    this.setupRedisSubscriptions();
    
    // Start heartbeat
    this.startHeartbeat();
    
    // Initialize Oracle WebSocket handler
    const oracleHandler = getOracleWebSocketHandler();
    oracleHandler.initialize(server);
    
    // Initialize Agent Debate Engine
    const debateEngine = getAgentDebateEngine();
    debateEngine.initializeWebSocket(server);
    
    // Start server
    server.listen(port, () => {
      logger.info('WebSocket server listening on port ${port}');
      logger.info('🔮 Oracle WebSocket ready at ws://localhost:${port}/ws/oracle');
      logger.info('🎭 Debate WebSocket ready at ws://localhost:${port}/ws/debates');
    });
  }

  private setupWebSocketServer() {
    this.wss.on('connection', async (ws: AuthenticatedWebSocket, req) => {
      try {
        // Authenticate connection
        const token = this.extractToken(req);
        if (!token) {
          ws.close(1008, 'Unauthorized');
          return;
        }

        const userId = await this.verifyToken(token);
        if (!userId) {
          ws.close(1008, 'Invalid token');
          return;
        }

        // Set up authenticated connection
        ws.userId = userId;
        ws.isAlive = true;

        // Add to clients map
        if (!this.clients.has(userId)) {
          this.clients.set(userId, new Set());
        }
        this.clients.get(userId)!.add(ws);

        // Send welcome message
        this.sendToClient(ws, {
          type: 'connected',
          data: { userId, timestamp: new Date().toISOString() },
        });

        // Handle messages
        ws.on('message', (data) => this.handleMessage(ws, data));

        // Handle pong
        ws.on('pong', () => {
          ws.isAlive = true;
        });

        // Handle close
        ws.on('close', () => this.handleDisconnect(ws));

        // Handle error
        ws.on('error', (error) => {
          logger.error('WebSocket error:', { error: error });
          this.handleDisconnect(ws);
        });
      } catch (error) {
        logger.error('Connection setup error:', { error: error });
        ws.close(1011, 'Server error');
      }
    });
  }

  private setupRedisSubscriptions() {
    // Subscribe to global events
    this.redisSub.subscribe('global:events');
    
    // Handle Redis messages
    this.redisSub.on('message', (channel, message) => {
      try {
        const data = JSON.parse(message);
        this.broadcastToChannel(channel, data);
      } catch (error) {
        logger.error('Redis message parse error:', { error: error });
      }
    });
  }

  private extractToken(req: IncomingMessage): string | null {
    const url = parse(req.url!, true);
    const token = url.query.token as string;
    
    if (token) return token;
    
    // Check authorization header
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      return auth.substring(7);
    }
    
    return null;
  }

  private async verifyToken(token: string): Promise<string | null> {
    try {
      const decoded = verify(token, config.jwt.secret) as JwtPayload & { userId?: string; sub?: string };
      return decoded.userId || decoded.sub || null;
    } catch (error) {
      logger.error('Token verification error:', { error: error });
      return null;
    }
  }

  private handleMessage(ws: AuthenticatedWebSocket, data: Buffer | ArrayBuffer | Buffer[]) {
    try {
      const message: WebSocketMessage = JSON.parse(data.toString());
      
      switch (message.type) {
        case 'subscribe':
          this.handleSubscribe(ws, message.channel!);
          break;
          
        case 'unsubscribe':
          this.handleUnsubscribe(ws, message.channel!);
          break;
          
        case 'ping':
          this.sendToClient(ws, { type: 'pong' });
          break;
          
        default:
          // Forward to message handler
          this.handleCustomMessage(ws, message);
      }
    } catch (error) {
      logger.error('Message handling error:', { error: error });
      this.sendToClient(ws, {
        type: 'error',
        data: { message: 'Invalid message format' },
      });
    }
  }

  private handleSubscribe(ws: AuthenticatedWebSocket, channel: string) {
    if (!ws.userId) return;
    
    // Validate channel access
    if (!this.canAccessChannel(ws.userId, channel)) {
      this.sendToClient(ws, {
        type: 'error',
        data: { message: 'Access denied to channel' },
      });
      return;
    }
    
    // Add to channel
    if (!this.channels.has(channel)) {
      this.channels.set(channel, new Set());
      // Subscribe to Redis channel
      this.redisSub.subscribe(channel);
    }
    this.channels.get(channel)!.add(ws.userId);
    
    // Confirm subscription
    this.sendToClient(ws, {
      type: 'subscribed',
      data: { channel },
    });
  }

  private handleUnsubscribe(ws: AuthenticatedWebSocket, channel: string) {
    if (!ws.userId) return;
    
    const channelUsers = this.channels.get(channel);
    if (channelUsers) {
      channelUsers.delete(ws.userId);
      
      // Clean up empty channels
      if (channelUsers.size === 0) {
        this.channels.delete(channel);
        this.redisSub.unsubscribe(channel);
      }
    }
    
    // Confirm unsubscription
    this.sendToClient(ws, {
      type: 'unsubscribed',
      data: { channel },
    });
  }

  private handleDisconnect(ws: AuthenticatedWebSocket) {
    if (!ws.userId) return;
    
    // Remove from clients
    const userClients = this.clients.get(ws.userId);
    if (userClients) {
      userClients.delete(ws);
      if (userClients.size === 0) {
        this.clients.delete(ws.userId);
        
        // Remove from all channels
        this.channels.forEach((users, channel) => {
          if (users.has(ws.userId!)) {
            users.delete(ws.userId!);
            if (users.size === 0) {
              this.channels.delete(channel);
              this.redisSub.unsubscribe(channel);
            }
          }
        });
      }
    }
  }

  private handleCustomMessage(ws: AuthenticatedWebSocket, message: WebSocketMessage) {
    // Handle custom message types
    switch (message.type) {
      case 'lineup:update':
        this.broadcastLineupUpdate(ws.userId!, message.data);
        break;
        
      case 'contest:join':
        this.broadcastContestJoin(ws.userId!, message.data);
        break;
        
      case 'optimization:request':
        this.handleOptimizationRequest(ws.userId!, message.data);
        break;
        
      default:
        logger.warn('Unknown message type:'message.type);
    }
  }

  private canAccessChannel(userId: string, channel: string): boolean {
    // Implement channel access control
    // For now, allow access to user's own channels and public channels
    if (channel.startsWith(`user:${userId}:`)) return true;
    if (channel.startsWith('public:')) return true;
    if (channel === 'global:events') return true;
    
    return false;
  }

  private sendToClient(ws: WebSocket, message: WebSocketMessage) {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private sendToUser(userId: string, message: WebSocketMessage) {
    const userClients = this.clients.get(userId);
    if (userClients) {
      userClients.forEach(ws => this.sendToClient(ws, message));
    }
  }

  private broadcastToChannel(channel: string, message: unknown) {
    const channelUsers = this.channels.get(channel);
    if (channelUsers) {
      channelUsers.forEach(userId => {
        this.sendToUser(userId, {
          type: 'channel:message',
          channel,
          data: message,
        });
      });
    }
  }

  private broadcastLineupUpdate(userId: string, data: LineupUpdateData) {
    // Broadcast to user's channel
    const channel = `user:${userId}:lineups`;
    this.redis.publish(channel, JSON.stringify({
      type: 'lineup:updated',
      userId,
      data,
      timestamp: new Date().toISOString(),
    }));
  }

  private broadcastContestJoin(userId: string, data: ContestJoinData) {
    // Broadcast to contest channel
    const channel = `contest:${data.contestId}`;
    this.redis.publish(channel, JSON.stringify({
      type: 'contest:user_joined',
      userId,
      contestId: data.contestId,
      timestamp: new Date().toISOString(),
    }));
  }

  private async handleOptimizationRequest(userId: string, data: OptimizationRequestData) {
    // Publish optimization request to queue
    await this.redis.publish('optimization:requests', JSON.stringify({
      userId,
      data,
      timestamp: new Date().toISOString(),
    }));
    
    // Send acknowledgment
    this.sendToUser(userId, {
      type: 'optimization:queued',
      data: { requestId: data.requestId },
    });
  }

  private startHeartbeat() {
    const interval = setInterval(() => {
      this.wss.clients.forEach((ws) => {
        const authWs = ws as AuthenticatedWebSocket;
        if (authWs.isAlive === false) {
          authWs.terminate();
          return;
        }
        
        authWs.isAlive = false;
        authWs.ping();
      });
    }, 30000); // 30 seconds

    this.wss.on('close', () => {
      clearInterval(interval);
    });
  }

  // Public methods for external use
  public broadcast(message: WebSocketMessage) {
    this.wss.clients.forEach((ws) => {
      this.sendToClient(ws, message);
    });
  }

  public sendToUserId(userId: string, message: WebSocketMessage) {
    this.sendToUser(userId, message);
  }

  public publishToChannel(channel: string, data: unknown) {
    this.redis.publish(channel, JSON.stringify(data));
  }

  public async close() {
    // Close all connections
    this.wss.clients.forEach((ws) => {
      ws.close(1000, 'Server shutting down');
    });
    
    // Close WebSocket server
    this.wss.close();
    
    // Close Redis connections
    await this.redis.quit();
    await this.redisSub.quit();
  }
}

// Export singleton instance
export const realtimeServer = new RealtimeWebSocketServer();
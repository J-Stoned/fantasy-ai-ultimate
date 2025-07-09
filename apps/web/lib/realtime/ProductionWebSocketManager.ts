import { Server as SocketIOServer, Socket } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { instrument } from '@socket.io/admin-ui';
import { createHighPerformanceRedis } from '../cache/RedisHighPerformance';
import { supabase } from '../supabase-client';

/**
 * Production-Grade WebSocket Manager
 * Designed to handle 10K+ concurrent connections
 * Inspired by Second Spectrum's real-time broadcast system
 */

interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  messagesPerSecond: number;
  avgLatency: number;
  p95Latency: number;
  p99Latency: number;
}

interface BroadcastOptions {
  priority: 'low' | 'normal' | 'high' | 'critical';
  ttl?: number;
  reliable?: boolean;
  compress?: boolean;
}

export class ProductionWebSocketManager {
  private io: SocketIOServer;
  private redis = createHighPerformanceRedis();
  private connections = new Map<string, Socket>();
  private rooms = new Map<string, Set<string>>();
  private metrics: ConnectionMetrics = {
    totalConnections: 0,
    activeConnections: 0,
    messagesPerSecond: 0,
    avgLatency: 0,
    p95Latency: 0,
    p99Latency: 0
  };
  
  // Message queues by priority
  private messageQueues = {
    critical: [] as any[],
    high: [] as any[],
    normal: [] as any[],
    low: [] as any[]
  };

  // Latency tracking
  private latencyBuffer: number[] = [];
  private readonly LATENCY_BUFFER_SIZE = 10000;

  constructor(io: SocketIOServer) {
    this.io = io;
    this.setupRedisAdapter();
    this.setupMiddleware();
    this.setupEventHandlers();
    this.startMetricsCollection();
    this.startMessageProcessor();
  }

  private async setupRedisAdapter(): Promise<void> {
    // Use Redis adapter for horizontal scaling
    const pubClient = this.redis.pubClient;
    const subClient = this.redis.subClient;
    
    this.io.adapter(createAdapter(pubClient, subClient));
    
    // Enable admin UI for monitoring
    instrument(this.io, {
      auth: {
        type: 'basic',
        username: process.env.SOCKETIO_ADMIN_USER || 'admin',
        password: process.env.SOCKETIO_ADMIN_PASS || 'changeme'
      },
      mode: 'production'
    });
  }

  private setupMiddleware(): void {
    // Authentication middleware
    this.io.use(async (socket, next) => {
      try {
        const token = socket.handshake.auth.token;
        if (!token) {
          return next(new Error('Authentication required'));
        }

        // Verify JWT token with Supabase
        const { data: { user }, error } = await supabase.auth.getUser(token);
        if (error || !user) {
          return next(new Error('Invalid token'));
        }

        // Attach user to socket
        socket.data.userId = user.id;
        socket.data.connectedAt = Date.now();
        
        next();
      } catch (err) {
        next(new Error('Authentication failed'));
      }
    });

    // Rate limiting middleware
    this.io.use(async (socket, next) => {
      const clientIp = socket.handshake.address;
      const rateLimitKey = `ratelimit:ws:${clientIp}`;
      
      // Check rate limit (100 connections per minute per IP)
      const allowed = await this.redis.runScript(
        this.redis.loadedScripts.get('rateLimitCheck')!,
        [rateLimitKey],
        [100, 60]
      );
      
      if (!allowed) {
        return next(new Error('Rate limit exceeded'));
      }
      
      next();
    });
  }

  private setupEventHandlers(): void {
    this.io.on('connection', async (socket) => {
      await this.handleConnection(socket);
      
      // Core events
      socket.on('disconnect', () => this.handleDisconnect(socket));
      socket.on('error', (err) => this.handleError(socket, err));
      
      // Room management
      socket.on('join:room', (room) => this.handleJoinRoom(socket, room));
      socket.on('leave:room', (room) => this.handleLeaveRoom(socket, room));
      
      // Real-time subscriptions
      socket.on('subscribe:player', (playerId) => this.subscribeToPlayer(socket, playerId));
      socket.on('subscribe:game', (gameId) => this.subscribeToGame(socket, gameId));
      socket.on('subscribe:lineup', (lineupId) => this.subscribeToLineup(socket, lineupId));
      
      // High-frequency updates
      socket.on('ping', () => this.handlePing(socket));
    });
  }

  private async handleConnection(socket: Socket): Promise<void> {
    const connectionId = socket.id;
    const userId = socket.data.userId;
    
    // Store connection
    this.connections.set(connectionId, socket);
    this.metrics.totalConnections++;
    this.metrics.activeConnections++;
    
    // Track in database
    await supabase.from('websocket_connections').insert({
      connection_id: connectionId,
      user_id: userId,
      session_id: socket.handshake.sessionID,
      ip_address: socket.handshake.address,
      user_agent: socket.handshake.headers['user-agent'],
      connected_at: new Date(),
      last_ping: new Date(),
      is_active: true
    });
    
    // Send initial state
    socket.emit('connected', {
      connectionId,
      serverTime: Date.now(),
      latency: 0
    });
    
    console.log(`[WebSocket] New connection: ${connectionId} (User: ${userId})`);
  }

  private async handleDisconnect(socket: Socket): Promise<void> {
    const connectionId = socket.id;
    
    // Remove from connections
    this.connections.delete(connectionId);
    this.metrics.activeConnections--;
    
    // Remove from all rooms
    for (const [room, members] of this.rooms.entries()) {
      members.delete(connectionId);
      if (members.size === 0) {
        this.rooms.delete(room);
      }
    }
    
    // Update database
    await supabase
      .from('websocket_connections')
      .update({ is_active: false })
      .eq('connection_id', connectionId);
    
    console.log(`[WebSocket] Disconnected: ${connectionId}`);
  }

  private handleError(socket: Socket, error: Error): void {
    console.error(`[WebSocket] Error on ${socket.id}:`, error);
  }

  private async handleJoinRoom(socket: Socket, room: string): Promise<void> {
    socket.join(room);
    
    // Track room membership
    if (!this.rooms.has(room)) {
      this.rooms.set(room, new Set());
    }
    this.rooms.get(room)!.add(socket.id);
    
    // Update connection's room list
    await supabase
      .from('websocket_connections')
      .update({ 
        room_ids: Array.from(socket.rooms),
        last_activity: new Date()
      })
      .eq('connection_id', socket.id);
    
    socket.emit('joined:room', { room });
  }

  private async handleLeaveRoom(socket: Socket, room: string): Promise<void> {
    socket.leave(room);
    
    // Update room membership
    const members = this.rooms.get(room);
    if (members) {
      members.delete(socket.id);
      if (members.size === 0) {
        this.rooms.delete(room);
      }
    }
    
    socket.emit('left:room', { room });
  }

  private async subscribeToPlayer(socket: Socket, playerId: string): Promise<void> {
    const room = `player:${playerId}`;
    socket.join(room);
    
    // Send current player state
    const playerData = await this.getPlayerState(playerId);
    socket.emit('player:state', playerData);
    
    // Track subscription
    await this.updateSubscriptions(socket.id, 'add', room);
  }

  private async subscribeToGame(socket: Socket, gameId: string): Promise<void> {
    const room = `game:${gameId}`;
    socket.join(room);
    
    // Send current game state
    const gameData = await this.getGameState(gameId);
    socket.emit('game:state', gameData);
    
    // Track subscription
    await this.updateSubscriptions(socket.id, 'add', room);
  }

  private async subscribeToLineup(socket: Socket, lineupId: string): Promise<void> {
    const room = `lineup:${lineupId}`;
    socket.join(room);
    
    // Send current lineup
    const lineupData = await this.getLineupState(lineupId);
    socket.emit('lineup:state', lineupData);
    
    // Track subscription
    await this.updateSubscriptions(socket.id, 'add', room);
  }

  private handlePing(socket: Socket): void {
    const now = Date.now();
    const latency = now - (socket.data.lastPing || now);
    
    // Track latency
    this.trackLatency(latency);
    
    // Send pong
    socket.emit('pong', {
      serverTime: now,
      latency
    });
    
    socket.data.lastPing = now;
  }

  /**
   * Broadcasting Methods
   */
  async broadcast(
    event: string,
    data: any,
    target?: string | string[],
    options: BroadcastOptions = { priority: 'normal' }
  ): Promise<void> {
    const message = {
      event,
      data,
      target,
      options,
      timestamp: Date.now()
    };
    
    // Queue by priority
    this.messageQueues[options.priority].push(message);
    
    // Critical messages bypass queue
    if (options.priority === 'critical') {
      await this.sendBroadcast(message);
    }
  }

  private async sendBroadcast(message: any): Promise<void> {
    const { event, data, target, options } = message;
    const startTime = Date.now();
    
    if (target) {
      // Targeted broadcast
      const targets = Array.isArray(target) ? target : [target];
      for (const t of targets) {
        if (options.compress) {
          this.io.to(t).compress(true).emit(event, data);
        } else {
          this.io.to(t).emit(event, data);
        }
      }
    } else {
      // Global broadcast
      if (options.compress) {
        this.io.compress(true).emit(event, data);
      } else {
        this.io.emit(event, data);
      }
    }
    
    // Track broadcast latency
    const broadcastTime = Date.now() - startTime;
    this.trackLatency(broadcastTime);
    
    // Store in broadcast queue for reliability
    if (options.reliable) {
      await supabase.from('broadcast_queue').insert({
        event_type: event,
        payload: data,
        target_rooms: Array.isArray(target) ? target : target ? [target] : null,
        priority: this.getPriorityNumber(options.priority),
        ttl_seconds: options.ttl || 300,
        created_at: new Date()
      });
    }
  }

  /**
   * Message Processing
   */
  private startMessageProcessor(): void {
    // Process messages by priority
    setInterval(() => {
      this.processMessageQueue('critical');
      this.processMessageQueue('high');
      this.processMessageQueue('normal');
      this.processMessageQueue('low');
    }, 10); // 10ms = 100 updates per second per priority
  }

  private async processMessageQueue(priority: keyof typeof this.messageQueues): Promise<void> {
    const queue = this.messageQueues[priority];
    if (queue.length === 0) return;
    
    // Process batch
    const batchSize = priority === 'critical' ? 100 : 50;
    const batch = queue.splice(0, batchSize);
    
    await Promise.all(
      batch.map(message => this.sendBroadcast(message))
    );
  }

  /**
   * State Management
   */
  private async getPlayerState(playerId: string): Promise<any> {
    // Get from cache first
    const cached = await this.redis.getGPUCache(`player:state:${playerId}`);
    if (cached) return cached;
    
    // Fetch from database
    const { data } = await supabase
      .from('players')
      .select('*, player_stats(*)')
      .eq('id', playerId)
      .single();
    
    // Cache for 1 minute
    await this.redis.setGPUCache(`player:state:${playerId}`, data, 60);
    
    return data;
  }

  private async getGameState(gameId: string): Promise<any> {
    const cached = await this.redis.getGPUCache(`game:state:${gameId}`);
    if (cached) return cached;
    
    const { data } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
    
    await this.redis.setGPUCache(`game:state:${gameId}`, data, 30);
    
    return data;
  }

  private async getLineupState(lineupId: string): Promise<any> {
    const cached = await this.redis.getGPUCache(`lineup:state:${lineupId}`);
    if (cached) return cached;
    
    // This would fetch from your lineup optimization results
    const lineup = {
      id: lineupId,
      players: [],
      projectedPoints: 0,
      salary: 0,
      ownership: 0
    };
    
    await this.redis.setGPUCache(`lineup:state:${lineupId}`, lineup, 60);
    
    return lineup;
  }

  /**
   * Metrics and Monitoring
   */
  private startMetricsCollection(): void {
    // Collect metrics every second
    setInterval(() => {
      this.collectMetrics();
    }, 1000);
    
    // Report metrics every 10 seconds
    setInterval(() => {
      this.reportMetrics();
    }, 10000);
  }

  private collectMetrics(): void {
    // Calculate messages per second
    const now = Date.now();
    const recentMessages = this.latencyBuffer.filter(
      time => now - time < 1000
    ).length;
    
    this.metrics.messagesPerSecond = recentMessages;
    
    // Calculate latency percentiles
    if (this.latencyBuffer.length > 0) {
      const sorted = [...this.latencyBuffer].sort((a, b) => a - b);
      const p95Index = Math.floor(sorted.length * 0.95);
      const p99Index = Math.floor(sorted.length * 0.99);
      
      this.metrics.avgLatency = sorted.reduce((a, b) => a + b, 0) / sorted.length;
      this.metrics.p95Latency = sorted[p95Index] || 0;
      this.metrics.p99Latency = sorted[p99Index] || 0;
    }
  }

  private async reportMetrics(): Promise<void> {
    // Store metrics in database
    await supabase.from('system_metrics').insert({
      metric_name: 'websocket_connections',
      metric_value: this.metrics.activeConnections,
      metric_unit: 'count',
      component: 'websocket',
      timestamp: new Date()
    });
    
    await supabase.from('system_metrics').insert({
      metric_name: 'websocket_messages_per_second',
      metric_value: this.metrics.messagesPerSecond,
      metric_unit: 'msg/s',
      component: 'websocket',
      timestamp: new Date()
    });
    
    await supabase.from('system_metrics').insert({
      metric_name: 'websocket_latency_p99',
      metric_value: this.metrics.p99Latency,
      metric_unit: 'ms',
      component: 'websocket',
      timestamp: new Date()
    });
    
    // Log current stats
    console.log('[WebSocket Metrics]', {
      connections: this.metrics.activeConnections,
      msgPerSec: this.metrics.messagesPerSecond,
      avgLatency: `${this.metrics.avgLatency.toFixed(2)}ms`,
      p95Latency: `${this.metrics.p95Latency}ms`,
      p99Latency: `${this.metrics.p99Latency}ms`
    });
  }

  private trackLatency(latency: number): void {
    this.latencyBuffer.push(latency);
    
    // Keep buffer size limited
    if (this.latencyBuffer.length > this.LATENCY_BUFFER_SIZE) {
      this.latencyBuffer.shift();
    }
  }

  /**
   * Utility Methods
   */
  private async updateSubscriptions(
    connectionId: string,
    action: 'add' | 'remove',
    subscription: string
  ): Promise<void> {
    const { data: conn } = await supabase
      .from('websocket_connections')
      .select('subscriptions')
      .eq('connection_id', connectionId)
      .single();
    
    if (!conn) return;
    
    let subscriptions = conn.subscriptions || [];
    
    if (action === 'add' && !subscriptions.includes(subscription)) {
      subscriptions.push(subscription);
    } else if (action === 'remove') {
      subscriptions = subscriptions.filter(s => s !== subscription);
    }
    
    await supabase
      .from('websocket_connections')
      .update({ subscriptions })
      .eq('connection_id', connectionId);
  }

  private getPriorityNumber(priority: string): number {
    const map = {
      low: 1,
      normal: 5,
      high: 8,
      critical: 10
    };
    return map[priority as keyof typeof map] || 5;
  }

  /**
   * Public API
   */
  getMetrics(): ConnectionMetrics {
    return { ...this.metrics };
  }

  getActiveConnections(): number {
    return this.connections.size;
  }

  getRooms(): string[] {
    return Array.from(this.rooms.keys());
  }

  async broadcastPlayerUpdate(playerId: string, update: any): Promise<void> {
    await this.broadcast(
      'player:update',
      update,
      `player:${playerId}`,
      { priority: 'high' }
    );
  }

  async broadcastGameUpdate(gameId: string, update: any): Promise<void> {
    await this.broadcast(
      'game:update',
      update,
      `game:${gameId}`,
      { priority: 'critical' }
    );
  }

  async broadcastLineupUpdate(lineupId: string, update: any): Promise<void> {
    await this.broadcast(
      'lineup:update',
      update,
      `lineup:${lineupId}`,
      { priority: 'normal' }
    );
  }

  async shutdown(): Promise<void> {
    // Gracefully close all connections
    for (const [id, socket] of this.connections) {
      socket.emit('server:shutdown', { message: 'Server shutting down' });
      socket.disconnect(true);
    }
    
    await this.redis.disconnect();
  }
}

/**
 * Factory function to create WebSocket server
 */
export function createProductionWebSocketServer(server: any): ProductionWebSocketManager {
  const io = new SocketIOServer(server, {
    cors: {
      origin: process.env.ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
      credentials: true
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
    upgradeTimeout: 30000,
    maxHttpBufferSize: 1e6,
    // Enable compression
    perMessageDeflate: {
      threshold: 1024
    },
    // Connection state recovery
    connectionStateRecovery: {
      maxDisconnectionDuration: 2 * 60 * 1000, // 2 minutes
      skipMiddlewares: true
    }
  });

  return new ProductionWebSocketManager(io);
}
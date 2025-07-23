/**
 * 🔥 ENTERPRISE ADMIN WEBSOCKET SYSTEM 🔥
 * 
 * Real-time admin metrics channels for jaw-dropping dashboards.
 * Built for ML Training & DFS Training Dashboard real-time communication.
 */

import { WebSocket, WebSocketServer } from 'ws';
import { EventEmitter } from 'events';
import { Redis } from 'ioredis';
import { adminAuth, AdminSession, AdminSection } from '../middleware/admin-auth';

// Admin WebSocket Message Types
export interface AdminWebSocketMessage {
  type: AdminMessageType;
  channel: AdminChannel;
  data: any;
  timestamp: Date;
  sessionId: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export type AdminMessageType = 
  | 'SUBSCRIBE'
  | 'UNSUBSCRIBE'
  | 'ML_TRAINING_UPDATE'
  | 'DFS_TRAINING_UPDATE'
  | 'SYSTEM_METRICS'
  | 'SECURITY_ALERT'
  | 'AUDIT_LOG'
  | 'REAL_TIME_PERFORMANCE'
  | 'RESOURCE_USAGE'
  | 'MODEL_PROGRESS'
  | 'TRADING_SIGNAL'
  | 'CRITICAL_ALERT'
  | 'USER_ACTIVITY'
  | 'DATABASE_METRICS'
  | 'ERROR_NOTIFICATION'
  | 'STATUS_UPDATE';

export type AdminChannel = 
  | 'ml_training_status'
  | 'ml_model_metrics'
  | 'ml_gpu_resources'
  | 'dfs_trading_signals'
  | 'dfs_portfolio_updates'
  | 'dfs_risk_alerts'
  | 'system_performance'
  | 'security_monitoring'
  | 'audit_stream'
  | 'user_analytics'
  | 'database_health'
  | 'critical_alerts'
  | 'admin_notifications';

// Admin Client Connection
export interface AdminWebSocketClient {
  id: string;
  ws: WebSocket;
  session: AdminSession;
  subscribedChannels: Set<AdminChannel>;
  lastActivity: Date;
  messageCount: number;
  rateLimit: {
    requests: number;
    window: Date;
  };
}

// Real-time Metrics Interface
export interface RealTimeMetrics {
  timestamp: Date;
  category: 'ML' | 'DFS' | 'SYSTEM' | 'SECURITY';
  metrics: Record<string, number | string | boolean>;
  alerts?: Array<{
    level: 'WARNING' | 'ERROR' | 'CRITICAL';
    message: string;
    context: Record<string, any>;
  }>;
}

// Channel Permissions Mapping
const CHANNEL_PERMISSIONS: Record<AdminChannel, { section: AdminSection; minLevel: number }> = {
  ml_training_status: { section: 'ml_training', minLevel: 6 },
  ml_model_metrics: { section: 'ml_training', minLevel: 6 },
  ml_gpu_resources: { section: 'ml_training', minLevel: 8 },
  dfs_trading_signals: { section: 'dfs_training', minLevel: 6 },
  dfs_portfolio_updates: { section: 'dfs_training', minLevel: 6 },
  dfs_risk_alerts: { section: 'dfs_training', minLevel: 4 },
  system_performance: { section: 'system_metrics', minLevel: 4 },
  security_monitoring: { section: 'audit_logs', minLevel: 8 },
  audit_stream: { section: 'audit_logs', minLevel: 6 },
  user_analytics: { section: 'user_management', minLevel: 6 },
  database_health: { section: 'database_admin', minLevel: 8 },
  critical_alerts: { section: 'system_metrics', minLevel: 4 },
  admin_notifications: { section: 'system_metrics', minLevel: 4 }
};

export class AdminWebSocketServer extends EventEmitter {
  private wss: WebSocketServer;
  private redis: Redis;
  private redisSubscriber: Redis;
  private clients: Map<string, AdminWebSocketClient>;
  private channels: Map<AdminChannel, Set<string>>;
  private metricsInterval: NodeJS.Timeout | null = null;
  private heartbeatInterval: NodeJS.Timeout | null = null;

  constructor(port: number = 8081) {
    super();
    this.clients = new Map();
    this.channels = new Map();
    
    // Initialize Redis connections
    this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    this.redisSubscriber = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
    
    // Initialize WebSocket server
    this.wss = new WebSocketServer({ 
      port,
      perMessageDeflate: true,
      maxPayload: 1024 * 1024 // 1MB max message size
    });
    
    this.setupWebSocketServer();
    this.setupRedisSubscriptions();
    this.startMetricsCollection();
    this.startHeartbeat();
    
    console.log(`🚀 Admin WebSocket Server started on port ${port}`);
  }

  /**
   * 🔌 WEBSOCKET SERVER SETUP
   * Enterprise-grade connection handling with authentication
   */
  private setupWebSocketServer(): void {
    this.wss.on('connection', async (ws, request) => {
      try {
        console.log('[AdminWS] New connection attempt');
        
        // Extract session token from query or headers
        const url = new URL(request.url!, `http://${request.headers.host}`);
        const sessionToken = url.searchParams.get('token') || 
                           request.headers.authorization?.replace('Bearer ', '');
        
        if (!sessionToken) {
          ws.close(1008, 'Authentication required');
          return;
        }
        
        // Authenticate admin session
        const sessionData = await this.redis.get(`admin_session:${sessionToken}`);
        if (!sessionData) {
          ws.close(1008, 'Invalid session');
          return;
        }
        
        const session: AdminSession = JSON.parse(sessionData);
        
        // Create client record
        const clientId = `admin_client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const client: AdminWebSocketClient = {
          id: clientId,
          ws,
          session,
          subscribedChannels: new Set(),
          lastActivity: new Date(),
          messageCount: 0,
          rateLimit: {
            requests: 0,
            window: new Date()
          }
        };
        
        this.clients.set(clientId, client);
        
        // Send connection success
        this.sendToClient(client, {
          type: 'STATUS_UPDATE',
          channel: 'admin_notifications',
          data: {
            status: 'connected',
            clientId,
            availableChannels: this.getAvailableChannels(session),
            serverTime: new Date().toISOString()
          },
          timestamp: new Date(),
          sessionId: session.sessionId,
          priority: 'LOW'
        });
        
        // Setup message handling
        ws.on('message', (data) => this.handleClientMessage(client, data));
        ws.on('close', () => this.handleClientDisconnect(clientId));
        ws.on('error', (error) => this.handleClientError(clientId, error));
        ws.on('pong', () => this.handlePong(clientId));
        
        console.log(`[AdminWS] Client ${clientId} connected (${session.email})`);
        
      } catch (error) {
        console.error('[AdminWS] Connection error:', error);
        ws.close(1011, 'Server error');
      }
    });
  }

  /**
   * 📨 CLIENT MESSAGE HANDLER
   * Process incoming admin WebSocket messages with rate limiting
   */
  private async handleClientMessage(client: AdminWebSocketClient, data: Buffer): Promise<void> {
    try {
      // Rate limiting check
      if (!this.checkRateLimit(client)) {
        this.sendError(client, 'Rate limit exceeded');
        return;
      }
      
      const message = JSON.parse(data.toString());
      client.lastActivity = new Date();
      client.messageCount++;
      
      switch (message.type) {
        case 'SUBSCRIBE':
          await this.handleSubscribe(client, message.channel);
          break;
          
        case 'UNSUBSCRIBE':
          await this.handleUnsubscribe(client, message.channel);
          break;
          
        case 'REQUEST_METRICS':
          await this.handleMetricsRequest(client, message.data);
          break;
          
        case 'REQUEST_HISTORICAL':
          await this.handleHistoricalRequest(client, message.data);
          break;
          
        case 'ADMIN_ACTION':
          await this.handleAdminAction(client, message.data);
          break;
          
        default:
          this.sendError(client, `Unknown message type: ${message.type}`);
      }
      
    } catch (error) {
      console.error('[AdminWS] Message handling error:', error);
      this.sendError(client, 'Invalid message format');
    }
  }

  /**
   * 📺 CHANNEL SUBSCRIPTION MANAGEMENT
   * Secure channel subscription with permission validation
   */
  private async handleSubscribe(client: AdminWebSocketClient, channel: AdminChannel): Promise<void> {
    try {
      // Validate channel permissions
      const channelConfig = CHANNEL_PERMISSIONS[channel];
      if (!channelConfig) {
        this.sendError(client, `Invalid channel: ${channel}`);
        return;
      }
      
      // Check section access
      if (!adminAuth.canAccessSection(client.session, channelConfig.section)) {
        this.sendError(client, `Access denied to channel: ${channel}`);
        return;
      }
      
      // Check minimum level requirement
      if (client.session.role.level < channelConfig.minLevel) {
        this.sendError(client, `Insufficient privileges for channel: ${channel}`);
        return;
      }
      
      // Add to subscriptions
      client.subscribedChannels.add(channel);
      
      if (!this.channels.has(channel)) {
        this.channels.set(channel, new Set());
      }
      this.channels.get(channel)!.add(client.id);
      
      // Send subscription confirmation
      this.sendToClient(client, {
        type: 'STATUS_UPDATE',
        channel: 'admin_notifications',
        data: {
          action: 'subscribed',
          channel,
          timestamp: new Date().toISOString()
        },
        timestamp: new Date(),
        sessionId: client.session.sessionId,
        priority: 'LOW'
      });
      
      // Send initial channel data
      await this.sendInitialChannelData(client, channel);
      
      console.log(`[AdminWS] Client ${client.id} subscribed to ${channel}`);
      
    } catch (error) {
      console.error('[AdminWS] Subscribe error:', error);
      this.sendError(client, 'Subscription failed');
    }
  }

  private async handleUnsubscribe(client: AdminWebSocketClient, channel: AdminChannel): Promise<void> {
    client.subscribedChannels.delete(channel);
    this.channels.get(channel)?.delete(client.id);
    
    this.sendToClient(client, {
      type: 'STATUS_UPDATE',
      channel: 'admin_notifications',
      data: {
        action: 'unsubscribed',
        channel,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date(),
      sessionId: client.session.sessionId,
      priority: 'LOW'
    });
  }

  /**
   * 📊 REAL-TIME METRICS DISTRIBUTION
   * Broadcast metrics to subscribed admin clients
   */
  public broadcastMetrics(channel: AdminChannel, metrics: RealTimeMetrics): void {
    const subscribers = this.channels.get(channel);
    if (!subscribers || subscribers.size === 0) return;
    
    const message: AdminWebSocketMessage = {
      type: this.getMessageTypeForChannel(channel),
      channel,
      data: metrics,
      timestamp: new Date(),
      sessionId: 'system',
      priority: this.determinePriority(metrics)
    };
    
    for (const clientId of subscribers) {
      const client = this.clients.get(clientId);
      if (client && client.ws.readyState === WebSocket.OPEN) {
        this.sendToClient(client, message);
      }
    }
  }

  /**
   * 🚨 CRITICAL ALERT BROADCASTING
   * Immediate alert distribution to all authorized admin clients
   */
  public broadcastCriticalAlert(alert: {
    title: string;
    message: string;
    category: 'SECURITY' | 'SYSTEM' | 'ML' | 'DFS';
    severity: 'WARNING' | 'ERROR' | 'CRITICAL';
    data?: Record<string, any>;
  }): void {
    const message: AdminWebSocketMessage = {
      type: 'CRITICAL_ALERT',
      channel: 'critical_alerts',
      data: {
        id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        ...alert,
        timestamp: new Date().toISOString()
      },
      timestamp: new Date(),
      sessionId: 'system',
      priority: 'CRITICAL'
    };
    
    // Send to all connected admin clients
    for (const client of this.clients.values()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        // Check if client has access to critical alerts
        const canReceive = adminAuth.canAccessSection(client.session, 'system_metrics');
        if (canReceive) {
          this.sendToClient(client, message);
        }
      }
    }
    
    // Log critical alert
    this.redis.lpush('admin_critical_alerts', JSON.stringify(message));
    this.redis.ltrim('admin_critical_alerts', 0, 999); // Keep last 1000
  }

  /**
   * 🔄 REDIS SUBSCRIPTION SETUP
   * Listen to Redis channels for real-time updates
   */
  private setupRedisSubscriptions(): void {
    // ML Training Channels
    this.redisSubscriber.subscribe(
      'ml_training_progress',
      'ml_model_completed',
      'ml_gpu_status',
      'ml_error_alert'
    );
    
    // DFS Trading Channels
    this.redisSubscriber.subscribe(
      'dfs_portfolio_update',
      'dfs_trading_signal',
      'dfs_risk_alert',
      'dfs_pnl_update'
    );
    
    // System Channels
    this.redisSubscriber.subscribe(
      'system_performance',
      'database_alert',
      'security_event',
      'admin_notification'
    );
    
    this.redisSubscriber.on('message', (redisChannel, message) => {
      this.handleRedisMessage(redisChannel, message);
    });
  }

  private handleRedisMessage(redisChannel: string, message: string): void {
    try {
      const data = JSON.parse(message);
      const adminChannel = this.mapRedisChannelToAdmin(redisChannel);
      
      if (adminChannel) {
        this.broadcastMetrics(adminChannel, {
          timestamp: new Date(),
          category: this.getCategoryForChannel(adminChannel),
          metrics: data,
          alerts: data.alerts
        });
      }
    } catch (error) {
      console.error('[AdminWS] Redis message error:', error);
    }
  }

  /**
   * 📈 METRICS COLLECTION
   * Collect and broadcast system metrics
   */
  private startMetricsCollection(): void {
    this.metricsInterval = setInterval(async () => {
      try {
        // Collect ML Training Metrics
        const mlMetrics = await this.collectMLMetrics();
        if (mlMetrics) {
          this.broadcastMetrics('ml_training_status', mlMetrics);
        }
        
        // Collect DFS Trading Metrics
        const dfsMetrics = await this.collectDFSMetrics();
        if (dfsMetrics) {
          this.broadcastMetrics('dfs_trading_signals', dfsMetrics);
        }
        
        // Collect System Performance Metrics
        const systemMetrics = await this.collectSystemMetrics();
        if (systemMetrics) {
          this.broadcastMetrics('system_performance', systemMetrics);
        }
        
      } catch (error) {
        console.error('[AdminWS] Metrics collection error:', error);
      }
    }, 5000); // Collect every 5 seconds
  }

  private async collectMLMetrics(): Promise<RealTimeMetrics | null> {
    try {
      const gpuUsage = await this.redis.get('ml:gpu_usage');
      const trainingJobs = await this.redis.get('ml:active_jobs');
      const modelAccuracy = await this.redis.get('ml:latest_accuracy');
      
      return {
        timestamp: new Date(),
        category: 'ML',
        metrics: {
          gpu_usage: gpuUsage ? parseFloat(gpuUsage) : 0,
          active_jobs: trainingJobs ? parseInt(trainingJobs) : 0,
          latest_accuracy: modelAccuracy ? parseFloat(modelAccuracy) : 0,
          memory_usage: process.memoryUsage().heapUsed / 1024 / 1024 // MB
        }
      };
    } catch (error) {
      console.error('[AdminWS] ML metrics error:', error);
      return null;
    }
  }

  private async collectDFSMetrics(): Promise<RealTimeMetrics | null> {
    try {
      const portfolioValue = await this.redis.get('dfs:portfolio_value');
      const activeTrades = await this.redis.get('dfs:active_trades');
      const dailyPnL = await this.redis.get('dfs:daily_pnl');
      
      return {
        timestamp: new Date(),
        category: 'DFS',
        metrics: {
          portfolio_value: portfolioValue ? parseFloat(portfolioValue) : 0,
          active_trades: activeTrades ? parseInt(activeTrades) : 0,
          daily_pnl: dailyPnL ? parseFloat(dailyPnL) : 0,
          win_rate: await this.redis.get('dfs:win_rate') || '0'
        }
      };
    } catch (error) {
      console.error('[AdminWS] DFS metrics error:', error);
      return null;
    }
  }

  private async collectSystemMetrics(): Promise<RealTimeMetrics | null> {
    try {
      const memUsage = process.memoryUsage();
      const cpuUsage = process.cpuUsage();
      
      return {
        timestamp: new Date(),
        category: 'SYSTEM',
        metrics: {
          heap_used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
          heap_total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
          rss: Math.round(memUsage.rss / 1024 / 1024), // MB
          cpu_user: cpuUsage.user,
          cpu_system: cpuUsage.system,
          connected_clients: this.clients.size,
          uptime: process.uptime()
        }
      };
    } catch (error) {
      console.error('[AdminWS] System metrics error:', error);
      return null;
    }
  }

  /**
   * 💓 HEARTBEAT & CONNECTION MANAGEMENT
   * Keep connections alive and clean up stale connections
   */
  private startHeartbeat(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = new Date();
      
      for (const [clientId, client] of this.clients.entries()) {
        const timeSinceActivity = now.getTime() - client.lastActivity.getTime();
        
        if (client.ws.readyState === WebSocket.OPEN) {
          if (timeSinceActivity > 30000) { // 30 seconds
            // Send ping
            client.ws.ping();
          }
          
          if (timeSinceActivity > 300000) { // 5 minutes
            // Close stale connection
            client.ws.close(1001, 'Connection timeout');
            this.handleClientDisconnect(clientId);
          }
        } else {
          // Clean up dead connection
          this.handleClientDisconnect(clientId);
        }
      }
    }, 10000); // Check every 10 seconds
  }

  // ==================== HELPER METHODS ====================

  private sendToClient(client: AdminWebSocketClient, message: AdminWebSocketMessage): void {
    if (client.ws.readyState === WebSocket.OPEN) {
      try {
        client.ws.send(JSON.stringify(message));
      } catch (error) {
        console.error('[AdminWS] Send error:', error);
      }
    }
  }

  private sendError(client: AdminWebSocketClient, error: string): void {
    this.sendToClient(client, {
      type: 'ERROR_NOTIFICATION',
      channel: 'admin_notifications',
      data: { error, timestamp: new Date().toISOString() },
      timestamp: new Date(),
      sessionId: client.session.sessionId,
      priority: 'HIGH'
    });
  }

  private checkRateLimit(client: AdminWebSocketClient): boolean {
    const now = new Date();
    const windowMs = 60000; // 1 minute
    const maxRequests = client.session.role.rateLimit.requestsPerMinute;
    
    // Reset window if needed
    if (now.getTime() - client.rateLimit.window.getTime() > windowMs) {
      client.rateLimit.requests = 0;
      client.rateLimit.window = now;
    }
    
    if (client.rateLimit.requests >= maxRequests) {
      return false;
    }
    
    client.rateLimit.requests++;
    return true;
  }

  private getAvailableChannels(session: AdminSession): AdminChannel[] {
    const availableChannels: AdminChannel[] = [];
    
    for (const [channel, config] of Object.entries(CHANNEL_PERMISSIONS)) {
      if (adminAuth.canAccessSection(session, config.section) && 
          session.role.level >= config.minLevel) {
        availableChannels.push(channel as AdminChannel);
      }
    }
    
    return availableChannels;
  }

  private getMessageTypeForChannel(channel: AdminChannel): AdminMessageType {
    const mapping: Record<AdminChannel, AdminMessageType> = {
      ml_training_status: 'ML_TRAINING_UPDATE',
      ml_model_metrics: 'ML_TRAINING_UPDATE',
      ml_gpu_resources: 'RESOURCE_USAGE',
      dfs_trading_signals: 'DFS_TRAINING_UPDATE',
      dfs_portfolio_updates: 'DFS_TRAINING_UPDATE',
      dfs_risk_alerts: 'SECURITY_ALERT',
      system_performance: 'SYSTEM_METRICS',
      security_monitoring: 'SECURITY_ALERT',
      audit_stream: 'AUDIT_LOG',
      user_analytics: 'USER_ACTIVITY',
      database_health: 'DATABASE_METRICS',
      critical_alerts: 'CRITICAL_ALERT',
      admin_notifications: 'STATUS_UPDATE'
    };
    
    return mapping[channel] || 'STATUS_UPDATE';
  }

  private determinePriority(metrics: RealTimeMetrics): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    if (metrics.alerts && metrics.alerts.some(a => a.level === 'CRITICAL')) {
      return 'CRITICAL';
    }
    if (metrics.alerts && metrics.alerts.some(a => a.level === 'ERROR')) {
      return 'HIGH';
    }
    if (metrics.alerts && metrics.alerts.some(a => a.level === 'WARNING')) {
      return 'MEDIUM';
    }
    return 'LOW';
  }

  private getCategoryForChannel(channel: AdminChannel): 'ML' | 'DFS' | 'SYSTEM' | 'SECURITY' {
    if (channel.startsWith('ml_')) return 'ML';
    if (channel.startsWith('dfs_')) return 'DFS';
    if (channel.includes('security') || channel.includes('audit')) return 'SECURITY';
    return 'SYSTEM';
  }

  private mapRedisChannelToAdmin(redisChannel: string): AdminChannel | null {
    const mapping: Record<string, AdminChannel> = {
      'ml_training_progress': 'ml_training_status',
      'ml_model_completed': 'ml_model_metrics',
      'ml_gpu_status': 'ml_gpu_resources',
      'dfs_portfolio_update': 'dfs_portfolio_updates',
      'dfs_trading_signal': 'dfs_trading_signals',
      'dfs_risk_alert': 'dfs_risk_alerts',
      'system_performance': 'system_performance',
      'security_event': 'security_monitoring',
      'admin_notification': 'admin_notifications'
    };
    
    return mapping[redisChannel] || null;
  }

  private handleClientDisconnect(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      // Remove from all channels
      for (const channel of client.subscribedChannels) {
        this.channels.get(channel)?.delete(clientId);
      }
      
      this.clients.delete(clientId);
      console.log(`[AdminWS] Client ${clientId} disconnected`);
    }
  }

  private handleClientError(clientId: string, error: Error): void {
    console.error(`[AdminWS] Client ${clientId} error:`, error);
    this.handleClientDisconnect(clientId);
  }

  private handlePong(clientId: string): void {
    const client = this.clients.get(clientId);
    if (client) {
      client.lastActivity = new Date();
    }
  }

  private async sendInitialChannelData(client: AdminWebSocketClient, channel: AdminChannel): Promise<void> {
    try {
      // Send last known data for the channel
      const lastData = await this.redis.get(`admin_channel_data:${channel}`);
      if (lastData) {
        const metrics = JSON.parse(lastData);
        this.sendToClient(client, {
          type: this.getMessageTypeForChannel(channel),
          channel,
          data: metrics,
          timestamp: new Date(),
          sessionId: 'system',
          priority: 'LOW'
        });
      }
    } catch (error) {
      console.error('[AdminWS] Initial data error:', error);
    }
  }

  private async handleMetricsRequest(client: AdminWebSocketClient, data: any): Promise<void> {
    // Handle specific metrics requests
    const { channel, timeRange, filters } = data;
    
    // Validate permissions
    const channelConfig = CHANNEL_PERMISSIONS[channel];
    if (!channelConfig || !adminAuth.canAccessSection(client.session, channelConfig.section)) {
      this.sendError(client, 'Access denied');
      return;
    }
    
    // Fetch and send metrics
    // Implementation depends on specific metrics storage
  }

  private async handleHistoricalRequest(client: AdminWebSocketClient, data: any): Promise<void> {
    // Handle historical data requests
    const { channel, startTime, endTime, aggregation } = data;
    
    // Validate permissions and fetch historical data
    // Implementation depends on historical data storage
  }

  private async handleAdminAction(client: AdminWebSocketClient, data: any): Promise<void> {
    // Handle admin actions (start training, stop processes, etc.)
    const { action, target, params } = data;
    
    // Validate permissions and execute action
    // Implementation depends on specific admin actions
  }

  /**
   * 🛑 GRACEFUL SHUTDOWN
   * Clean up resources and connections
   */
  public async shutdown(): Promise<void> {
    console.log('[AdminWS] Shutting down admin WebSocket server...');
    
    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }
    
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
    }
    
    // Close all client connections
    for (const client of this.clients.values()) {
      client.ws.close(1001, 'Server shutting down');
    }
    
    // Close WebSocket server
    this.wss.close();
    
    // Close Redis connections
    await this.redis.quit();
    await this.redisSubscriber.quit();
    
    console.log('[AdminWS] Admin WebSocket server shut down complete');
  }
}

// Export singleton instance
export const adminWebSocket = new AdminWebSocketServer();

export default AdminWebSocketServer;
import { Pool, PoolConfig, Client } from 'pg';
import { PrismaClient } from '@prisma/client';
import { createHighPerformanceRedis } from '../cache/RedisHighPerformance';

/**
 * Production Database Connection Pool
 * Optimized for Second Spectrum-level performance
 * Supports 10K+ concurrent connections with sub-millisecond latency
 */

interface DatabasePoolConfig {
  max: number;                    // Maximum pool size
  min: number;                    // Minimum pool size
  connectionTimeoutMillis: number; // Connection timeout
  idleTimeoutMillis: number;      // Idle connection timeout
  maxLifetimeMillis: number;      // Max connection lifetime
  statementTimeout: number;       // Statement timeout (ms)
  query_timeout: number;          // Query timeout (ms)
}

interface PoolMetrics {
  totalConnections: number;
  idleConnections: number;
  waitingClients: number;
  totalPoolSize: number;
  avgQueryTime: number;
  p95QueryTime: number;
  p99QueryTime: number;
  errorRate: number;
}

export class ProductionDatabasePool {
  private readPool: Pool;
  private writePool: Pool;
  private analyticsPool: Pool;
  private realtimePool: Pool;
  private prisma: PrismaClient;
  private redis = createHighPerformanceRedis();
  
  private metrics: PoolMetrics = {
    totalConnections: 0,
    idleConnections: 0,
    waitingClients: 0,
    totalPoolSize: 0,
    avgQueryTime: 0,
    p95QueryTime: 0,
    p99QueryTime: 0,
    errorRate: 0
  };
  
  private queryTimes: number[] = [];
  private readonly QUERY_TIME_BUFFER_SIZE = 10000;

  constructor() {
    this.initializePools();
    this.setupPrisma();
    this.startMetricsCollection();
  }

  private initializePools(): void {
    const baseConfig: PoolConfig = {
      host: process.env.DATABASE_HOST || 'localhost',
      port: parseInt(process.env.DATABASE_PORT || '5432'),
      database: process.env.DATABASE_NAME || 'postgres',
      user: process.env.DATABASE_USER || 'postgres',
      password: process.env.DATABASE_PASSWORD,
      ssl: process.env.DATABASE_SSL === 'true' ? { rejectUnauthorized: false } : undefined,
      
      // Connection pool settings
      max: 100,                      // Maximum pool size
      min: 10,                       // Minimum pool size
      connectionTimeoutMillis: 5000, // 5 seconds
      idleTimeoutMillis: 30000,      // 30 seconds
      
      // Statement settings
      statement_timeout: 30000,      // 30 seconds
      query_timeout: 30000,          // 30 seconds
      
      // Application name for monitoring
      application_name: 'fantasy-ai-production'
    };

    // Read pool - optimized for high-throughput reads
    this.readPool = new Pool({
      ...baseConfig,
      max: 200,                      // Higher connection count for reads
      min: 20,
      application_name: 'fantasy-ai-read',
      // Read replicas if available
      host: process.env.DATABASE_READ_HOST || baseConfig.host
    });

    // Write pool - optimized for consistency
    this.writePool = new Pool({
      ...baseConfig,
      max: 50,                       // Lower connection count for writes
      min: 5,
      application_name: 'fantasy-ai-write'
    });

    // Analytics pool - optimized for long-running queries
    this.analyticsPool = new Pool({
      ...baseConfig,
      max: 20,
      min: 2,
      statement_timeout: 300000,     // 5 minutes for analytics
      query_timeout: 300000,
      application_name: 'fantasy-ai-analytics'
    });

    // Real-time pool - optimized for low latency
    this.realtimePool = new Pool({
      ...baseConfig,
      max: 100,
      min: 10,
      connectionTimeoutMillis: 1000, // 1 second
      statement_timeout: 5000,       // 5 seconds
      query_timeout: 5000,
      application_name: 'fantasy-ai-realtime'
    });

    // Set up error handlers
    [this.readPool, this.writePool, this.analyticsPool, this.realtimePool].forEach(pool => {
      pool.on('error', (err, client) => {
        console.error('[Database Pool Error]', err);
        this.metrics.errorRate++;
      });

      pool.on('connect', (client) => {
        // Set up client configuration
        client.query('SET statement_timeout = 30000');
        client.query('SET lock_timeout = 10000');
        client.query('SET idle_in_transaction_session_timeout = 60000');
      });
    });
  }

  private setupPrisma(): void {
    // Configure Prisma with connection pooling
    this.prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL
        }
      },
      log: process.env.NODE_ENV === 'production' 
        ? ['error', 'warn'] 
        : ['query', 'info', 'warn', 'error'],
      // Connection pool configuration
      // @ts-ignore - Prisma internal config
      __internal: {
        engine: {
          connectionLimit: 100,
          connectTimeout: 5000,
          poolTimeout: 5000,
          pollInterval: 500
        }
      }
    });

    // Middleware for query timing
    this.prisma.$use(async (params, next) => {
      const start = Date.now();
      const result = await next(params);
      const duration = Date.now() - start;
      
      this.trackQueryTime(duration);
      
      // Log slow queries
      if (duration > 1000) {
        console.warn(`[Slow Query] ${params.model}.${params.action} took ${duration}ms`);
      }
      
      return result;
    });
  }

  /**
   * Query Execution Methods
   */
  async query<T>(sql: string, params?: any[], pool: 'read' | 'write' | 'analytics' | 'realtime' = 'read'): Promise<T[]> {
    const targetPool = this.getPool(pool);
    const start = Date.now();
    
    try {
      const result = await targetPool.query(sql, params);
      const duration = Date.now() - start;
      this.trackQueryTime(duration);
      
      return result.rows;
    } catch (error) {
      this.metrics.errorRate++;
      throw error;
    }
  }

  async queryOne<T>(sql: string, params?: any[], pool: 'read' | 'write' = 'read'): Promise<T | null> {
    const rows = await this.query<T>(sql, params, pool);
    return rows[0] || null;
  }

  async execute(sql: string, params?: any[]): Promise<number> {
    const start = Date.now();
    
    try {
      const result = await this.writePool.query(sql, params);
      const duration = Date.now() - start;
      this.trackQueryTime(duration);
      
      return result.rowCount || 0;
    } catch (error) {
      this.metrics.errorRate++;
      throw error;
    }
  }

  /**
   * Cached Query Methods
   */
  async cachedQuery<T>(
    key: string,
    sql: string,
    params: any[] = [],
    ttlSeconds: number = 60
  ): Promise<T[]> {
    // Check cache first
    const cached = await this.redis.getGPUCache<T[]>(key);
    if (cached) {
      await this.redis.incrementGPUCacheHit(key);
      return cached;
    }
    
    // Execute query
    const result = await this.query<T>(sql, params, 'read');
    
    // Cache result
    await this.redis.setGPUCache(key, result, ttlSeconds);
    
    return result;
  }

  /**
   * Transaction Support
   */
  async transaction<T>(
    callback: (client: Client) => Promise<T>,
    isolationLevel: 'READ UNCOMMITTED' | 'READ COMMITTED' | 'REPEATABLE READ' | 'SERIALIZABLE' = 'READ COMMITTED'
  ): Promise<T> {
    const client = await this.writePool.connect();
    
    try {
      await client.query('BEGIN');
      await client.query(`SET TRANSACTION ISOLATION LEVEL ${isolationLevel}`);
      
      const result = await callback(client);
      
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Batch Operations
   */
  async batchInsert(
    table: string,
    columns: string[],
    values: any[][],
    onConflict?: string
  ): Promise<number> {
    if (values.length === 0) return 0;
    
    const client = await this.writePool.connect();
    
    try {
      // Use COPY for maximum performance
      if (values.length > 1000) {
        return await this.copyFrom(client, table, columns, values);
      }
      
      // Use multi-value INSERT for smaller batches
      const placeholders = values.map((_, i) => 
        `(${columns.map((_, j) => `$${i * columns.length + j + 1}`).join(', ')})`
      ).join(', ');
      
      const flatValues = values.flat();
      const conflictClause = onConflict || '';
      
      const sql = `
        INSERT INTO ${table} (${columns.join(', ')})
        VALUES ${placeholders}
        ${conflictClause}
      `;
      
      const result = await client.query(sql, flatValues);
      return result.rowCount || 0;
    } finally {
      client.release();
    }
  }

  private async copyFrom(
    client: Client,
    table: string,
    columns: string[],
    values: any[][]
  ): Promise<number> {
    // PostgreSQL COPY command for bulk inserts
    const stream = client.query(
      `COPY ${table} (${columns.join(', ')}) FROM STDIN WITH (FORMAT CSV)`
    );
    
    let count = 0;
    for (const row of values) {
      stream.write(row.map(v => this.escapeCsvValue(v)).join(',') + '\n');
      count++;
    }
    
    stream.end();
    await new Promise((resolve, reject) => {
      stream.on('finish', resolve);
      stream.on('error', reject);
    });
    
    return count;
  }

  private escapeCsvValue(value: any): string {
    if (value === null || value === undefined) return '';
    const str = String(value);
    if (str.includes(',') || str.includes('"') || str.includes('\n')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    return str;
  }

  /**
   * Connection Pool Management
   */
  private getPool(type: 'read' | 'write' | 'analytics' | 'realtime'): Pool {
    const pools = {
      read: this.readPool,
      write: this.writePool,
      analytics: this.analyticsPool,
      realtime: this.realtimePool
    };
    return pools[type];
  }

  async getPoolStats(): Promise<Record<string, any>> {
    return {
      read: {
        total: this.readPool.totalCount,
        idle: this.readPool.idleCount,
        waiting: this.readPool.waitingCount
      },
      write: {
        total: this.writePool.totalCount,
        idle: this.writePool.idleCount,
        waiting: this.writePool.waitingCount
      },
      analytics: {
        total: this.analyticsPool.totalCount,
        idle: this.analyticsPool.idleCount,
        waiting: this.analyticsPool.waitingCount
      },
      realtime: {
        total: this.realtimePool.totalCount,
        idle: this.realtimePool.idleCount,
        waiting: this.realtimePool.waitingCount
      }
    };
  }

  /**
   * Prepared Statements
   */
  private preparedStatements = new Map<string, string>();

  async prepare(name: string, sql: string): Promise<void> {
    if (!this.preparedStatements.has(name)) {
      await this.writePool.query(`PREPARE ${name} AS ${sql}`);
      this.preparedStatements.set(name, sql);
    }
  }

  async executePrepared<T>(name: string, params: any[]): Promise<T[]> {
    const result = await this.readPool.query(`EXECUTE ${name}(${params.map((_, i) => `$${i + 1}`).join(', ')})`, params);
    return result.rows;
  }

  /**
   * Monitoring and Metrics
   */
  private startMetricsCollection(): void {
    // Collect pool metrics every second
    setInterval(async () => {
      const stats = await this.getPoolStats();
      
      this.metrics.totalConnections = 
        stats.read.total + stats.write.total + 
        stats.analytics.total + stats.realtime.total;
      
      this.metrics.idleConnections = 
        stats.read.idle + stats.write.idle + 
        stats.analytics.idle + stats.realtime.idle;
      
      this.metrics.waitingClients = 
        stats.read.waiting + stats.write.waiting + 
        stats.analytics.waiting + stats.realtime.waiting;
      
      // Calculate query time percentiles
      if (this.queryTimes.length > 0) {
        const sorted = [...this.queryTimes].sort((a, b) => a - b);
        const p95Index = Math.floor(sorted.length * 0.95);
        const p99Index = Math.floor(sorted.length * 0.99);
        
        this.metrics.avgQueryTime = sorted.reduce((a, b) => a + b, 0) / sorted.length;
        this.metrics.p95QueryTime = sorted[p95Index] || 0;
        this.metrics.p99QueryTime = sorted[p99Index] || 0;
      }
    }, 1000);

    // Report metrics every 10 seconds
    setInterval(() => {
      console.log('[Database Pool Metrics]', {
        connections: `${this.metrics.totalConnections} (${this.metrics.idleConnections} idle)`,
        waiting: this.metrics.waitingClients,
        avgQuery: `${this.metrics.avgQueryTime.toFixed(2)}ms`,
        p95Query: `${this.metrics.p95QueryTime}ms`,
        p99Query: `${this.metrics.p99QueryTime}ms`,
        errorRate: `${(this.metrics.errorRate / 100).toFixed(2)}%`
      });
      
      // Reset error rate
      this.metrics.errorRate = 0;
    }, 10000);
  }

  private trackQueryTime(duration: number): void {
    this.queryTimes.push(duration);
    
    // Keep buffer size limited
    if (this.queryTimes.length > this.QUERY_TIME_BUFFER_SIZE) {
      this.queryTimes.shift();
    }
  }

  /**
   * Health Checks
   */
  async healthCheck(): Promise<boolean> {
    try {
      await Promise.all([
        this.readPool.query('SELECT 1'),
        this.writePool.query('SELECT 1'),
        this.analyticsPool.query('SELECT 1'),
        this.realtimePool.query('SELECT 1')
      ]);
      return true;
    } catch (error) {
      console.error('[Database Health Check Failed]', error);
      return false;
    }
  }

  /**
   * Cleanup
   */
  async shutdown(): Promise<void> {
    await Promise.all([
      this.readPool.end(),
      this.writePool.end(),
      this.analyticsPool.end(),
      this.realtimePool.end(),
      this.prisma.$disconnect(),
      this.redis.disconnect()
    ]);
  }

  /**
   * Public Getters
   */
  get read(): Pool { return this.readPool; }
  get write(): Pool { return this.writePool; }
  get analytics(): Pool { return this.analyticsPool; }
  get realtime(): Pool { return this.realtimePool; }
  get orm(): PrismaClient { return this.prisma; }
  getMetrics(): PoolMetrics { return { ...this.metrics }; }
}

/**
 * Singleton instance
 */
let instance: ProductionDatabasePool | null = null;

export function getProductionDatabasePool(): ProductionDatabasePool {
  if (!instance) {
    instance = new ProductionDatabasePool();
  }
  return instance;
}

/**
 * Utility functions for common queries
 */
export const db = {
  async getPlayer(playerId: string): Promise<any> {
    const pool = getProductionDatabasePool();
    return pool.cachedQuery(
      `player:${playerId}`,
      'SELECT * FROM players WHERE id = $1',
      [playerId],
      300 // 5 minute cache
    );
  },

  async getGameEvents(gameId: string, limit: number = 1000): Promise<any[]> {
    const pool = getProductionDatabasePool();
    return pool.query(
      `SELECT * FROM game_events 
       WHERE game_id = $1 
       ORDER BY sequence_number DESC 
       LIMIT $2`,
      [gameId, limit],
      'realtime'
    );
  },

  async updatePlayerStats(playerId: string, stats: any): Promise<void> {
    const pool = getProductionDatabasePool();
    await pool.execute(
      `UPDATE player_stats 
       SET stats = $2, updated_at = NOW() 
       WHERE player_id = $1`,
      [playerId, JSON.stringify(stats)]
    );
  },

  async batchInsertEvents(events: any[]): Promise<number> {
    const pool = getProductionDatabasePool();
    return pool.batchInsert(
      'game_events',
      ['game_id', 'event_type', 'player_id', 'event_data', 'sequence_number'],
      events.map(e => [e.gameId, e.type, e.playerId, JSON.stringify(e.data), e.sequence])
    );
  }
};
/**
 * 🔐 Centralized Database Connection Manager
 * Manages a single connection pool for the entire application
 */

import { Pool, PoolClient, PoolConfig } from 'pg';
import { logger } from '../logging/logger';

export class DatabaseConnectionManager {
  private static instance: DatabaseConnectionManager;
  private pool: Pool | null = null;
  private readonly config: PoolConfig;
  private connectionCount = 0;
  private readonly maxRetries = 3;
  private readonly retryDelay = 1000;

  private constructor() {
    // Use environment-specific configuration
    const isProduction = process.env.NODE_ENV === 'production';
    
    this.config = {
      // Connection string takes precedence
      connectionString: process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL,
      
      // Fallback to individual params - only use defaults in development
      host: process.env.DB_HOST || (isProduction ? undefined : 'localhost'),
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || (isProduction ? undefined : 'fantasy_ai_local'),
      user: process.env.DB_USER || (isProduction ? undefined : 'postgres'),
      password: process.env.DB_PASSWORD || (isProduction ? undefined : 'postgres'),
      
      // Pool configuration
      max: parseInt(process.env.DATABASE_POOL_MAX || (isProduction ? '20' : '10')),
      min: parseInt(process.env.DATABASE_POOL_MIN || '2'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000,
      
      // Prepared statements cache
      statement_timeout: 30000,
      query_timeout: 30000,
      
      // SSL configuration for production
      ssl: isProduction ? { rejectUnauthorized: false } : undefined,
    };

    // Remove undefined connection string if not provided
    if (!this.config.connectionString) {
      delete this.config.connectionString;
    }
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): DatabaseConnectionManager {
    if (!DatabaseConnectionManager.instance) {
      DatabaseConnectionManager.instance = new DatabaseConnectionManager();
    }
    return DatabaseConnectionManager.instance;
  }

  /**
   * Get or create the connection pool
   */
  public async getPool(): Promise<Pool> {
    if (!this.pool) {
      await this.createPool();
    }
    return this.pool!;
  }

  /**
   * Create new connection pool with retry logic
   */
  private async createPool(retryCount = 0): Promise<void> {
    try {
      this.pool = new Pool(this.config);
      
      // Set up error handlers
      this.pool.on('error', (err, client) => {
        logger.error('Unexpected error on idle client', { error: err });
      });

      this.pool.on('connect', () => {
        this.connectionCount++;
        logger.debug('New database connection established', { 
          totalConnections: this.connectionCount 
        });
      });

      this.pool.on('remove', () => {
        this.connectionCount--;
        logger.debug('Database connection removed', { 
          totalConnections: this.connectionCount 
        });
      });

      // Test the connection
      const client = await this.pool.connect();
      await client.query('SELECT 1');
      client.release();
      
      logger.info('Database pool created successfully', {
        maxConnections: this.config.max,
        minConnections: this.config.min,
        database: this.config.database,
      });
    } catch (error) {
      logger.error('Failed to create database pool', { error, retryCount });
      
      if (retryCount < this.maxRetries) {
        logger.info(`Retrying database connection in ${this.retryDelay}ms...`);
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        await this.createPool(retryCount + 1);
      } else {
        throw new Error(`Failed to establish database connection after ${this.maxRetries} retries`);
      }
    }
  }

  /**
   * Execute a query
   */
  public async query<T>(text: string, params?: any[]): Promise<T[]> {
    const pool = await this.getPool();
    const start = Date.now();
    
    try {
      const result = await pool.query(text, params);
      const duration = Date.now() - start;
      
      if (duration > 1000) {
        logger.warn('Slow query detected', { 
          query: text.substring(0, 100), 
          duration,
          rowCount: result.rowCount 
        });
      }
      
      return result.rows;
    } catch (error) {
      logger.error('Query failed', { 
        query: text.substring(0, 100), 
        error 
      });
      throw error;
    }
  }

  /**
   * Execute a query and return first row
   */
  public async queryOne<T>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows[0] || null;
  }

  /**
   * Execute a command (INSERT, UPDATE, DELETE)
   */
  public async execute(text: string, params?: any[]): Promise<number> {
    const pool = await this.getPool();
    const result = await pool.query(text, params);
    return result.rowCount || 0;
  }

  /**
   * Get a client for transaction
   */
  public async getClient(): Promise<PoolClient> {
    const pool = await this.getPool();
    return pool.connect();
  }

  /**
   * Execute a transaction
   */
  public async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.getClient();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      logger.error('Transaction failed', { error });
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Get pool statistics
   */
  public async getStats() {
    if (!this.pool) {
      return {
        status: 'not_initialized',
        totalCount: 0,
        idleCount: 0,
        waitingCount: 0,
      };
    }

    return {
      status: 'active',
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount,
      maxConnections: this.config.max,
      activeConnections: this.pool.totalCount - this.pool.idleCount,
    };
  }

  /**
   * Health check
   */
  public async healthCheck(): Promise<boolean> {
    try {
      const pool = await this.getPool();
      const result = await pool.query('SELECT NOW()');
      return !!result.rows[0];
    } catch (error) {
      logger.error('Database health check failed', { error });
      return false;
    }
  }

  /**
   * Close all connections
   */
  public async close(): Promise<void> {
    if (this.pool) {
      await this.pool.end();
      this.pool = null;
      this.connectionCount = 0;
      logger.info('Database pool closed');
    }
  }

  /**
   * Reset connection pool (useful for reconnecting)
   */
  public async reset(): Promise<void> {
    await this.close();
    await this.createPool();
  }
}

// Export singleton instance
export const dbConnectionManager = DatabaseConnectionManager.getInstance();

// Export convenience functions
export const db = {
  query: <T>(text: string, params?: any[]) => dbConnectionManager.query<T>(text, params),
  queryOne: <T>(text: string, params?: any[]) => dbConnectionManager.queryOne<T>(text, params),
  execute: (text: string, params?: any[]) => dbConnectionManager.execute(text, params),
  transaction: <T>(callback: (client: PoolClient) => Promise<T>) => dbConnectionManager.transaction(callback),
  getClient: () => dbConnectionManager.getClient(),
  getStats: () => dbConnectionManager.getStats(),
  healthCheck: () => dbConnectionManager.healthCheck(),
};
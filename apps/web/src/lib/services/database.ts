/**
 * 📊 Database Service
 * Handles all database operations with connection pooling
 */

import { Pool, PoolClient } from 'pg';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

class DatabaseService {
  private pool: Pool;
  private initialized: boolean = false;

  constructor() {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'fantasy_ai_local',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });
  }

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      await this.pool.query('SELECT 1');
      this.initialized = true;
      console.log('✅ Database service initialized');
    } catch (error) {
      console.error('❌ Database initialization failed:', error);
      throw error;
    }
  }

  /**
   * Execute a query
   */
  async query<T>(
    text: string,
    params?: any[],
    mode: 'read' | 'write' = 'read'
  ): Promise<T[]> {
    const result = await this.pool.query(text, params);
    return result.rows;
  }

  /**
   * Execute a query and return first row
   */
  async queryOne<T>(
    text: string,
    params?: any[],
    mode: 'read' | 'write' = 'read'
  ): Promise<T | null> {
    const result = await this.pool.query(text, params);
    return result.rows[0] || null;
  }

  /**
   * Execute a command (INSERT, UPDATE, DELETE)
   */
  async execute(
    text: string,
    params?: any[]
  ): Promise<number> {
    const result = await this.pool.query(text, params);
    return result.rowCount || 0;
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
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
   * Get pool statistics
   */
  getPoolStats() {
    return {
      totalCount: this.pool.totalCount,
      idleCount: this.pool.idleCount,
      waitingCount: this.pool.waitingCount
    };
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await this.pool.end();
    console.log('🧹 Database connections closed');
  }
}

// Export singleton instance
export const database = new DatabaseService();
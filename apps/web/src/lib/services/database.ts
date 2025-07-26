/**
 * 📊 Database Service
 * Handles all database operations using centralized connection manager
 */

import { PoolClient } from 'pg';
import { logger } from '../logging/logger';
import { db, dbConnectionManager } from '../database/connection-manager';

export interface QueryResult<T> {
  rows: T[];
  rowCount: number;
}

class DatabaseService {
  private initialized: boolean = false;

  /**
   * Initialize database connection
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;
    
    try {
      // Connection manager handles pool creation
      const isHealthy = await dbConnectionManager.healthCheck();
      if (isHealthy) {
        this.initialized = true;
        logger.info('✅ Database service initialized');
      } else {
        throw new Error('Database health check failed');
      }
    } catch (error) {
      logger.error('❌ Database initialization failed:', { error: error });
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
    return db.query<T>(text, params);
  }

  /**
   * Execute a query and return first row
   */
  async queryOne<T>(
    text: string,
    params?: any[],
    mode: 'read' | 'write' = 'read'
  ): Promise<T | null> {
    return db.queryOne<T>(text, params);
  }

  /**
   * Execute a command (INSERT, UPDATE, DELETE)
   */
  async execute(
    text: string,
    params?: any[]
  ): Promise<number> {
    return db.execute(text, params);
  }

  /**
   * Execute multiple queries in a transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
  ): Promise<T> {
    return db.transaction(callback);
  }

  /**
   * Get pool statistics
   */
  async getPoolStats() {
    return db.getStats();
  }

  /**
   * Cleanup
   */
  async cleanup(): Promise<void> {
    await dbConnectionManager.close();
    logger.info('🧹 Database connections closed');
  }
}

// Export singleton instance
export const database = new DatabaseService();
/**
 * Database service implementation using dependency injection
 */

import { Pool, PoolClient } from 'pg';
import { Injectable, Inject } from '../container';
import { IDatabase, ILogger, SERVICE_TOKENS } from '../interfaces';

@Injectable({ singleton: true })
export class DatabaseService implements IDatabase {
  private pool: Pool;

  constructor(
    @Inject(SERVICE_TOKENS.Logger) private logger: ILogger
  ) {
    this.pool = new Pool({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.DB_NAME || 'fantasy_ai',
      user: process.env.DB_USER || 'postgres',
      password: process.env.DB_PASSWORD || 'postgres',
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    });

    this.pool.on('error', (err) => {
      this.logger.error('Database pool error', err);
    });
  }

  async query<T>(sql: string, params?: any[]): Promise<T[]> {
    const start = Date.now();
    try {
      const result = await this.pool.query(sql, params);
      const duration = Date.now() - start;
      
      this.logger.debug('Query executed', {
        sql: sql.substring(0, 100),
        params: params?.length,
        rows: result.rowCount,
        duration
      });
      
      return result.rows;
    } catch (error) {
      this.logger.error('Query error', error, { sql, params });
      throw error;
    }
  }

  async queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(sql, params);
    return rows[0] || null;
  }

  async execute(sql: string, params?: any[]): Promise<number> {
    const start = Date.now();
    try {
      const result = await this.pool.query(sql, params);
      const duration = Date.now() - start;
      
      this.logger.debug('Command executed', {
        sql: sql.substring(0, 100),
        params: params?.length,
        affected: result.rowCount,
        duration
      });
      
      return result.rowCount || 0;
    } catch (error) {
      this.logger.error('Execute error', error, { sql, params });
      throw error;
    }
  }

  async transaction<T>(callback: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await this.pool.connect();
    
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      this.logger.error('Transaction error', error);
      throw error;
    } finally {
      client.release();
    }
  }

  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error('Health check failed', error);
      return false;
    }
  }

  async cleanup(): Promise<void> {
    await this.pool.end();
    this.logger.info('Database connections closed');
  }
}
/**
 * 🚀 LOCAL POSTGRESQL CONNECTION POOL
 * 
 * High-performance connection pool optimized for:
 * - Ryzen 5 7600X (12 threads)
 * - 32GB RAM
 * - 1.24M rows of data
 * - Sub-millisecond queries
 */

import { Pool, PoolConfig, QueryResult } from 'pg';
import { performance } from 'perf_hooks';

// Pool configuration optimized for local high-performance setup
const poolConfig: PoolConfig = {
  // Connection settings
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432'),
  database: process.env.DATABASE_NAME || 'fantasy_ai_local',
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || 'postgres',
  
  // Pool settings optimized for Ryzen 5 7600X (12 threads)
  min: parseInt(process.env.DATABASE_POOL_MIN || '10'),
  max: parseInt(process.env.DATABASE_POOL_MAX || '100'),
  
  // Connection settings
  connectionTimeoutMillis: 30000, // 30 seconds
  idleTimeoutMillis: 10000, // 10 seconds
  
  // Query settings
  query_timeout: 120000, // 2 minutes for complex queries
  statement_timeout: 120000, // 2 minutes
  
  // Keep alive
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
};

// Create singleton pool instance
let pool: Pool | null = null;

/**
 * Get or create the database connection pool
 */
export function getPool(): Pool {
  if (!pool) {
    pool = new Pool(poolConfig);
    
    // Pool error handling
    pool.on('error', (err) => {
      console.error('Unexpected pool error:', err);
    });
    
    // Log pool creation
    console.log('🚀 PostgreSQL pool created with config:', {
      host: poolConfig.host,
      database: poolConfig.database,
      min: poolConfig.min,
      max: poolConfig.max,
    });
  }
  
  return pool;
}

/**
 * Execute a query with automatic timing and error handling
 */
export async function query<T = any>(
  text: string,
  params?: any[]
): Promise<QueryResult<T>> {
  const pool = getPool();
  const start = performance.now();
  
  try {
    const result = await pool.query<T>(text, params);
    const duration = performance.now() - start;
    
    // Log slow queries
    if (duration > 100) {
      console.warn(`⚠️ Slow query (${duration.toFixed(2)}ms):`, text.substring(0, 100));
    }
    
    return result;
  } catch (error) {
    const duration = performance.now() - start;
    console.error(`❌ Query failed after ${duration.toFixed(2)}ms:`, error);
    throw error;
  }
}

/**
 * Execute multiple queries in a transaction
 */
export async function transaction<T = any>(
  queries: Array<{ text: string; params?: any[] }>
): Promise<T[]> {
  const pool = getPool();
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const results: T[] = [];
    for (const q of queries) {
      const result = await client.query(q.text, q.params);
      results.push(result.rows as T);
    }
    
    await client.query('COMMIT');
    return results;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Stream large result sets to avoid memory issues
 */
export async function* streamQuery<T = any>(
  text: string,
  params?: any[],
  batchSize = 1000
): AsyncGenerator<T[], void, unknown> {
  const pool = getPool();
  let offset = 0;
  let hasMore = true;
  
  while (hasMore) {
    const paginatedQuery = `${text} LIMIT ${batchSize} OFFSET ${offset}`;
    const result = await pool.query<T>(paginatedQuery, params);
    
    if (result.rows.length > 0) {
      yield result.rows;
      offset += batchSize;
      hasMore = result.rows.length === batchSize;
    } else {
      hasMore = false;
    }
  }
}

/**
 * Execute a query and return the first row
 */
export async function queryOne<T = any>(
  text: string,
  params?: any[]
): Promise<T | null> {
  const result = await query<T>(text, params);
  return result.rows[0] || null;
}

/**
 * Execute a query and return all rows
 */
export async function queryMany<T = any>(
  text: string,
  params?: any[]
): Promise<T[]> {
  const result = await query<T>(text, params);
  return result.rows;
}

/**
 * Get pool statistics
 */
export function getPoolStats() {
  const pool = getPool();
  return {
    totalCount: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
  };
}

/**
 * Close all connections (for graceful shutdown)
 */
export async function closePool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
    console.log('PostgreSQL pool closed');
  }
}

// Handle process termination
process.on('SIGINT', closePool);
process.on('SIGTERM', closePool);

// Export types for convenience
export type { QueryResult, Pool } from 'pg';
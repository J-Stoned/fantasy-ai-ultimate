/**
 * 🗄️ Database Configuration for Fantasy ML
 * Centralized database connection for all ML models
 */

import { Pool } from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';

// Load environment variables
dotenv.config({ path: '.env.local' });

// PostgreSQL connection pool
export const pgPool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: parseInt(process.env.DATABASE_POOL_MAX || '100'),
  min: parseInt(process.env.DATABASE_POOL_MIN || '10'),
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Supabase client for real-time features
export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL as string,
  process.env.SUPABASE_SERVICE_ROLE_KEY as string
);

// Test database connection
export async function testDatabaseConnection(): Promise<boolean> {
  try {
    const result = await pgPool.query('SELECT NOW()');
    console.log(chalk.green('✅ Database connected successfully'));
    console.log(chalk.cyan(`📅 Server time: ${result.rows[0].now}`));
    
    // Check for required tables
    const tables = await pgPool.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      AND tablename IN ('players', 'player_stats', 'game_logs', 'teams', 'injuries')
      ORDER BY tablename
    `);
    
    console.log(chalk.cyan('\n📊 Available ML tables:'));
    tables.rows.forEach(row => {
      console.log(chalk.green(`  ✓ ${row.tablename}`));
    });
    
    // Get row counts only for existing tables
    const tableQueries = tables.rows.map(row => {
      return `SELECT '${row.tablename}' as table_name, COUNT(*) as count FROM ${row.tablename}`;
    });
    
    const counts = await pgPool.query(
      tableQueries.join(' UNION ALL ') + ' ORDER BY count DESC'
    );
    
    console.log(chalk.cyan('\n📈 Data volume:'));
    counts.rows.forEach(row => {
      console.log(chalk.yellow(`  ${row.table_name}: ${parseInt(row.count).toLocaleString()} records`));
    });
    
    return true;
  } catch (error) {
    console.error(chalk.red('❌ Database connection failed:'), error);
    return false;
  }
}

// Query helper with error handling
export async function query<T = any>(sql: string, params?: any[]): Promise<T[]> {
  try {
    const result = await pgPool.query(sql, params);
    return result.rows;
  } catch (error) {
    console.error(chalk.red('Query error:'), error);
    throw error;
  }
}

// Transaction helper
export async function transaction<T = any>(
  callback: (client: any) => Promise<T>
): Promise<T> {
  const client = await pgPool.connect();
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

// Close connections on exit
process.on('SIGINT', async () => {
  await pgPool.end();
  console.log(chalk.yellow('\n👋 Database connections closed'));
  process.exit(0);
});
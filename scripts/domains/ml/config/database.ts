/**
 * 🗄️ Database Configuration for Fantasy ML
 * Uses centralized database connection manager
 */

import { PoolClient } from 'pg';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import chalk from 'chalk';
import { db, dbConnectionManager } from '../../../apps/web/src/lib/database/connection-manager';

// Load environment variables
dotenv.config({ path: '.env.local' });

// Use centralized connection manager instead of creating new pool
export const pgPool = {
  query: (text: string, params?: any[]) => db.query(text, params),
  connect: () => dbConnectionManager.getClient(),
  end: () => dbConnectionManager.close(),
  on: (event: string, listener: any) => {
    // Connection manager handles events internally
    console.log(chalk.yellow(`⚠️ Event listener '${event}' not supported with connection manager`));
  }
};

// Supabase client for real-time features (optional)
export const supabase = process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY
  ? createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY
    )
  : null;

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
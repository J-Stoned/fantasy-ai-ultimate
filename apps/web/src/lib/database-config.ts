import { logger } from './logging/logger';

/**
 * Centralized database configuration
 * SECURITY: Never hard-code database credentials!
 */

// Get database URL from environment with validation
export function getDatabaseUrl(): string {
  const dbUrl = process.env.DATABASE_URL_LOCAL || process.env.DATABASE_URL;
  
  if (!dbUrl && process.env.NODE_ENV === 'production') {
    throw new Error('DATABASE_URL environment variable is required in production');
  }
  
  // In development, use a safe default without credentials
  if (!dbUrl && process.env.NODE_ENV !== 'production') {
    logger.warn('[DATABASE] No DATABASE_URL configured, using development placeholder');
    logger.warn('[DATABASE] Please set DATABASE_URL_LOCAL in your .env file');
    // Return empty string - the calling code should handle this case
    return '';
  }
  
  return dbUrl || '';
}

// Database pool configuration
export const databaseConfig = {
  connectionString: getDatabaseUrl(),
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20, // Maximum number of clients in the pool
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
};
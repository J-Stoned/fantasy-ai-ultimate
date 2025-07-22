/**
 * PostgreSQL configuration for data collection
 * Forces IPv4 connection to avoid IPv6 issues
 */

import { Pool } from 'pg';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../../.env') });
dotenv.config({ path: path.join(__dirname, '../../.env.local') });

// Use LOCAL PostgreSQL database on Windows host - not Supabase!
const DATABASE_URL = process.env.DATABASE_URL_LOCAL || 'postgresql://postgres:postgres@172.30.176.1:5432/fantasy_ai_local';

// Create pool with the pooler URL
export const pgPool = new Pool({
  connectionString: DATABASE_URL,
  max: 100,
  min: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

// Test connection
pgPool.query('SELECT NOW()', (err, res) => {
  if (err) {
    console.error('Database connection error:', err);
  } else {
    console.log('✅ Database connected via IPv4:', res.rows[0].now);
  }
});

export default pgPool;
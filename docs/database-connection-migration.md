# Database Connection Pooling Migration Guide

## Problem
The codebase currently has 247+ duplicate database connections because each script creates its own `Pool` or `Client` instance. This leads to:
- Resource exhaustion
- Connection limit errors
- Poor performance
- Database overload

## Solution
We've implemented a centralized `DatabaseConnectionManager` that maintains a single connection pool for the entire application.

## Migration Steps

### 1. For Scripts Using `new Pool()`

**Before:**
```typescript
import { Pool } from 'pg';

const pool = new Pool({
  host: 'localhost',
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres',
});

// Usage
const result = await pool.query('SELECT * FROM players');
```

**After:**
```typescript
import { db } from '../apps/web/src/lib/database/connection-manager';

// Usage
const result = await db.query('SELECT * FROM players');
```

### 2. For Scripts Using `new Client()`

**Before:**
```typescript
import { Client } from 'pg';

const client = new Client({
  host: 'localhost',
  port: 5432,
  database: 'fantasy_ai_local',
  user: 'postgres',
  password: 'postgres',
});

await client.connect();
const result = await client.query('SELECT * FROM players');
await client.end();
```

**After:**
```typescript
import { db } from '../apps/web/src/lib/database/connection-manager';

// For single queries
const result = await db.query('SELECT * FROM players');

// For transactions or multiple queries with same client
const client = await db.getClient();
try {
  await client.query('BEGIN');
  await client.query('INSERT INTO ...');
  await client.query('UPDATE ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

### 3. For Scripts with Custom Pool Configuration

**Before:**
```typescript
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 100,
  min: 10,
  idleTimeoutMillis: 30000,
});
```

**After:**
The connection manager uses environment variables for configuration:
- `DATABASE_URL_LOCAL` or `DATABASE_URL` for connection string
- `DATABASE_POOL_MAX` (default: 20 for prod, 10 for dev)
- `DATABASE_POOL_MIN` (default: 2)

Set these in your `.env.local` file if you need custom values.

### 4. For Scripts with Pool Event Handlers

**Before:**
```typescript
pool.on('error', (err, client) => {
  console.error('Pool error:', err);
});

pool.on('connect', () => {
  console.log('New connection');
});
```

**After:**
The connection manager handles these events internally with proper logging. If you need custom handling, extend the `DatabaseConnectionManager` class.

### 5. For Testing

**Before:**
```typescript
const mockPool = {
  query: jest.fn(),
  connect: jest.fn(),
  end: jest.fn(),
};
```

**After:**
```typescript
import { db } from '../apps/web/src/lib/database/connection-manager';

jest.mock('../apps/web/src/lib/database/connection-manager', () => ({
  db: {
    query: jest.fn(),
    queryOne: jest.fn(),
    execute: jest.fn(),
    transaction: jest.fn(),
    getClient: jest.fn(),
  },
  dbConnectionManager: {
    healthCheck: jest.fn().mockResolvedValue(true),
    getStats: jest.fn().mockResolvedValue({
      status: 'active',
      totalCount: 10,
      idleCount: 8,
      waitingCount: 0,
    }),
  },
}));
```

## Benefits

1. **Single Connection Pool**: Only one pool is created and shared across the entire application
2. **Automatic Retry**: Connection manager retries failed connections automatically
3. **Health Checks**: Built-in health check functionality
4. **Performance Monitoring**: Logs slow queries automatically
5. **Statistics**: Easy access to pool statistics for monitoring
6. **Transaction Support**: Simplified transaction handling
7. **Type Safety**: Full TypeScript support with generics

## Usage Examples

### Basic Query
```typescript
import { db } from '../apps/web/src/lib/database/connection-manager';

// Simple query
const players = await db.query<Player>('SELECT * FROM players WHERE sport = $1', ['NFL']);

// Single row
const player = await db.queryOne<Player>('SELECT * FROM players WHERE id = $1', [playerId]);

// Execute command
const rowsAffected = await db.execute('UPDATE players SET active = true WHERE id = $1', [playerId]);
```

### Transaction
```typescript
const result = await db.transaction(async (client) => {
  const player = await client.query('INSERT INTO players (name) VALUES ($1) RETURNING *', ['New Player']);
  await client.query('INSERT INTO player_stats (player_id) VALUES ($1)', [player.rows[0].id]);
  return player.rows[0];
});
```

### Health Check
```typescript
const isHealthy = await db.healthCheck();
if (!isHealthy) {
  console.error('Database is not healthy!');
}
```

### Pool Statistics
```typescript
const stats = await db.getStats();
console.log(`Active connections: ${stats.activeConnections}/${stats.maxConnections}`);
```

## Migration Priority

1. **High Priority** (Most connections):
   - Scripts in `/scripts/domains/ml/` directory
   - API routes in `/apps/web/src/app/api/`
   - Worker scripts in `/apps/web/src/lib/workers/`

2. **Medium Priority**:
   - Test files creating connections
   - Utility scripts in `/scripts/`
   - Migration scripts

3. **Low Priority**:
   - Archive files
   - One-off scripts

## Notes

- The connection manager is a singleton, so it's safe to import and use anywhere
- Connection pooling is handled automatically
- The pool size adjusts based on environment (production vs development)
- All queries are logged with timing information
- Slow queries (>1s) generate warning logs
- Failed queries are logged with full error details

## Monitoring

After migration, monitor the connection pool using:

```typescript
// In your monitoring endpoint or script
import { db } from '../apps/web/src/lib/database/connection-manager';

setInterval(async () => {
  const stats = await db.getStats();
  console.log('Pool Stats:', stats);
  
  if (stats.waitingCount > 5) {
    console.warn('High number of waiting connections!');
  }
}, 60000); // Check every minute
```
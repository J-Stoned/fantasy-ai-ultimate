# 🏗️ Database Standardization Guide

## Overview
We've implemented a standardized database interaction layer to ensure consistency across all scripts and services.

## Key Components

### 1. Database Service (`/lib/services/database-service.ts`)
Central service for all database operations:
- Automatic retry logic (3 attempts by default)
- Batch processing for large datasets
- Consistent error handling
- Built-in caching for teams
- Type-safe queries

### 2. Base Collector (`/lib/collectors/base-collector.ts`)
Standard foundation for all data collection scripts:
- Progress tracking and reporting
- Concurrent processing with rate limiting
- Retry logic for failed games
- Consistent error logging
- ETA calculations

### 3. Data Validation Service (`/lib/services/data-validation-service.ts`)
Ensures data integrity:
- Game data validation
- Player log validation
- Stats validation by sport
- Batch validation support
- Warning system for unusual values

## Usage Examples

### Using the Database Service

```typescript
import { db } from '../lib/services/database-service'

// Get games with filters
const games = await db.getGames({
  sport: 'NFL',
  status: 'completed',
  startDate: '2024-09-01',
  endDate: '2024-12-31',
  limit: 100
})

// Count records
const logCount = await db.countRecords('player_game_logs', {
  game_id: 12345
})

// Batch upsert with automatic chunking
await db.upsertBatch('player_game_logs', playerLogs, {
  onConflict: 'player_id,game_id',
  batchSize: 50
})

// Ensure players exist before inserting logs
await db.ensurePlayersExist([123, 456, 789])

// Work with external IDs
await db.addExternalId(gameId, 'espn', '401547652')
const game = await db.findGameByExternalId('espn', '401547652')
```

### Creating a New Collector

```typescript
import { BaseCollector } from '../lib/collectors/base-collector'

class MyCollector extends BaseCollector {
  constructor() {
    super({
      name: 'My Custom Collector',
      concurrencyLimit: 5,
      batchSize: 10,
      retryAttempts: 3
    })
  }
  
  async getGamesToProcess() {
    // Return array of games to process
    return await this.db.getGames({
      sport: 'NBA',
      status: 'completed'
    })
  }
  
  async processGame(game: any) {
    // Process individual game
    // Stats are automatically tracked
    // Errors are automatically handled
  }
}
```

### Data Validation

```typescript
import { DataValidationService } from '../lib/services/data-validation-service'

// Validate single record
const result = DataValidationService.validateGame({
  sport: 'NFL',
  start_time: '2024-09-15T17:00:00Z',
  home_team_id: 1,
  away_team_id: 2,
  universal_id: 'nfl_20240915_1700_dal_nyg'
})

if (!result.isValid) {
  console.error('Validation errors:', result.errors)
}

// Validate batch
const { valid, invalid } = DataValidationService.validateBatch(
  playerLogs,
  log => DataValidationService.validatePlayerGameLog(log),
  'PlayerGameLog'
)
```

## Migration Checklist

When updating a script to use standardized database interactions:

1. ✅ Remove direct Supabase client creation
2. ✅ Import `db` from database service
3. ✅ Replace raw queries with service methods
4. ✅ Add data validation before inserts
5. ✅ Use batch operations for bulk data
6. ✅ Implement proper error handling
7. ✅ Consider extending BaseCollector for collection scripts

## Benefits

1. **Consistency**: All scripts use the same patterns
2. **Reliability**: Automatic retries and error handling
3. **Performance**: Batch processing and connection pooling
4. **Maintainability**: Single source of truth for DB logic
5. **Monitoring**: Built-in progress tracking and logging
6. **Type Safety**: TypeScript support throughout

## Scripts Already Updated

- ✅ `mlb-season-collector.ts` → Uses `db` service
- ✅ `smart-season-collector.ts` → Uses `db` service
- ✅ `mlb-season-collector-v2.ts` → Extends BaseCollector
- 🔄 Other scripts pending update...

## Next Steps

1. Update remaining collection scripts
2. Add transaction support to database service
3. Implement query result caching
4. Add performance metrics collection
5. Create migration tool for legacy scripts
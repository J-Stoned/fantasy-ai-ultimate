# 🏆 NCAA SPORTS DATA COLLECTION PLAN - ULTRA SPEED EDITION (6-8 HOURS!)

## Overview
Complete collection of NCAA sports data for MOST RECENT COMPLETED seasons with AGGRESSIVE optimization for Ryzen 5 7600X + 32GB RAM:
1. **Football** (2024 season - completed Jan 2025) - 1.5 hours
2. **Basketball** (2024-2025 season - completed April 2025) - 2 hours  
3. **Baseball** (2025 season - completed June 2025) - 3 hours
4. **Hockey** (2024-2025 season - completed April 2025) - 30 minutes

## 🚀 AGGRESSIVE CONFIGURATION FOR ALL COLLECTORS:
```typescript
const CONFIG = {
  // CPU Optimization - MAXED OUT
  CONCURRENT_REQUESTS: 20,     // Ryzen 5 7600X can handle it!
  
  // Batch Sizes - AGGRESSIVE
  DB_QUERY_BATCH: 1000,        // Maximum allowed
  COLLECTION_BATCH: 1000,      // Process 1000 games at once
  INSERT_BATCH: 900,           // Just under Supabase limit
  
  // Memory Management - 32GB RAM
  MAX_MEMORY_RECORDS: 100000,  // Hold 100K records in memory
  SAVE_INTERVAL: 50000,        // Save checkpoint every 50K
  
  // Performance
  API_DELAY: 50,               // Minimal delay between requests
  CHECKPOINT_INTERVAL: 30000,  // Save progress every 30 seconds
  
  // No timeouts - run to completion!
  NO_TIMEOUT: true
};
```

## Phase 1: NCAA Football Collection (1.5 hours)

### 1.1 NCAA Football Games (existing)
- Already have `fetch-ncaa-football-games.ts`
- Season: August 2024 - January 2025 (COMPLETED)

### 1.2 NCAA Football Teams Collector
```typescript
// collect-ncaa-football-teams.ts
- Fetch all 130 FBS teams in ONE request
- Batch insert all teams at once
- Time: 2 minutes
```

### 1.3 NCAA Football Players Collector
```typescript
// collect-ncaa-football-players.ts
- 20 concurrent team roster requests
- Load all 11,050 players into memory
- Single batch insert (split into 900-record chunks)
- Time: 10 minutes
```

### 1.4 NCAA Football Stats Collector
```typescript
// collect-ncaa-football-stats.ts
- Process 1,000 games per batch
- 20 concurrent API requests
- ~150,000 stats total
- Insert in 900-record batches
- Time: 1.5 hours
```

## Phase 2: NCAA Basketball Collection (2 hours)

### 2.1 NCAA Basketball Games (existing)
- Already have `fetch-ncaa-basketball-games.ts`
- Season: November 2024 - April 2025 (COMPLETED)

### 2.2 NCAA Basketball Teams Collector
```typescript
// collect-ncaa-basketball-teams.ts
- Fetch all 362 Division I teams
- Process in 2 batches of ~180 teams
- Time: 5 minutes
```

### 2.3 NCAA Basketball Players Collector
```typescript
// collect-ncaa-basketball-players.ts
- 20 concurrent roster requests
- Process all 5,430 players
- Batch insert in 900-record chunks
- Time: 15 minutes
```

### 2.4 NCAA Basketball Stats Collector
```typescript
// collect-ncaa-basketball-stats.ts
- Process 1,000 games per batch
- ~220,000 stats total
- Memory buffer: 50,000 stats before save
- Time: 2 hours
```

## Phase 3: NCAA Baseball Collection (3 hours)

### 3.1 NCAA Baseball Games Fetcher
```typescript
// fetch-ncaa-baseball-games.ts
- Fetch completed 2025 season (Feb-June 2025) 
- College World Series ended in June 2025
- Process 7 days at a time
- ~10,000 games total
- Time: 10 minutes
```

### 3.2 NCAA Baseball Teams Collector
```typescript
// collect-ncaa-baseball-teams.ts
- Fetch all ~300 Division I teams
- Single batch process
- Time: 3 minutes
```

### 3.3 NCAA Baseball Players Collector
```typescript
// collect-ncaa-baseball-players.ts
- 20 concurrent roster requests
- ~10,500 total players
- Batch insert in 900-record chunks
- Time: 12 minutes
```

### 3.4 NCAA Baseball Stats Collector
```typescript
// collect-ncaa-baseball-stats.ts
- Highest volume: ~300,000 stats
- Process 1,000 games per batch
- 20 concurrent requests
- Save every 50,000 stats
- Time: 3 hours
```

## Phase 4: NCAA Hockey Collection (30 minutes)

### 4.1 NCAA Hockey Games Fetcher
```typescript
// fetch-ncaa-hockey-games.ts
- Fetch Oct 2024 - April 2025 (COMPLETED)
- Frozen Four completed in April 2025
- ~2,000 games total
- Time: 5 minutes
```

### 4.2 NCAA Hockey Teams Collector
```typescript
// collect-ncaa-hockey-teams.ts
- Fetch all 60 Division I teams
- Single API call and batch insert
- Time: 1 minute
```

### 4.3 NCAA Hockey Players Collector
```typescript
// collect-ncaa-hockey-players.ts
- Process all 60 teams concurrently
- ~1,500 total players
- Time: 3 minutes
```

### 4.4 NCAA Hockey Stats Collector
```typescript
// collect-ncaa-hockey-stats.ts
- Smallest dataset: ~50,000 stats
- Process all 2,000 games in 2 batches
- Time: 20 minutes
```

## Key Performance Optimizations:

### 1. **Parallel Processing Strategy**:
```typescript
const limit = pLimit(20); // 20 concurrent operations

// Process games in massive batches
const gameBatches = chunk(games, 1000);
await Promise.all(
  gameBatches.map(batch => 
    limit(() => processGameBatch(batch))
  )
);
```

### 2. **Memory-First Approach**:
```typescript
// Accumulate stats in memory
const statsBuffer: PlayerGameLog[] = [];

// Only save when buffer is full
if (statsBuffer.length >= 50000) {
  await saveStats(statsBuffer);
  statsBuffer.length = 0; // Clear buffer
}
```

### 3. **Efficient Database Operations**:
```typescript
// Split large inserts into 900-record chunks
const chunks = chunk(allStats, 900);
for (const chunk of chunks) {
  await supabase.from('player_game_logs').insert(chunk);
}
```

### 4. **Progress Tracking**:
```typescript
const progressBar = new cliProgress.SingleBar({
  format: 'NCAA {sport} |{bar}| {percentage}% | {value}/{total} | {duration_formatted} | ETA: {eta_formatted}',
  barCompleteChar: '\u2588',
  barIncompleteChar: '\u2591',
});
```

## Total Estimated Timeline:
- **NCAA Football**: 1.5 hours (150K stats)
- **NCAA Basketball**: 2 hours (220K stats)
- **NCAA Baseball**: 3 hours (300K stats)
- **NCAA Hockey**: 30 minutes (50K stats)
- **TOTAL**: **6-8 hours for 720,000+ stats!**

## Commands to Run (in order):
```bash
# First commit current progress
git add -A && git commit -m "feat: Complete injury and weather collection - ready for NCAA! 🎓"

# Phase 1: Football
npx tsx scripts/collect-ncaa-football-teams.ts
npx tsx scripts/collect-ncaa-football-players.ts
npx tsx scripts/collect-ncaa-football-stats.ts

# Phase 2: Basketball  
npx tsx scripts/collect-ncaa-basketball-teams.ts
npx tsx scripts/collect-ncaa-basketball-players.ts
npx tsx scripts/collect-ncaa-basketball-stats.ts

# Phase 3: Baseball
npx tsx scripts/fetch-ncaa-baseball-games.ts
npx tsx scripts/collect-ncaa-baseball-teams.ts
npx tsx scripts/collect-ncaa-baseball-players.ts
npx tsx scripts/collect-ncaa-baseball-stats.ts

# Phase 4: Hockey
npx tsx scripts/fetch-ncaa-hockey-games.ts
npx tsx scripts/collect-ncaa-hockey-teams.ts
npx tsx scripts/collect-ncaa-hockey-players.ts
npx tsx scripts/collect-ncaa-hockey-stats.ts
```

## Key Lessons Applied From Professional Sports Collection:
- **Database Query Limits**: 1,000 records per query with pagination
- **Player Name Matching**: Match by normalized names, not external IDs
- **ESPN API Differences**: Each sport has unique endpoints and data structures
- **CPU Optimization**: Ryzen 5 7600X can handle 20 concurrent requests
- **Batch Processing**: Save every 50,000 records to prevent data loss
- **Clean Exit**: Use process.exit(0) when complete

## ESPN API Patterns:
```typescript
// NCAA Football
`https://site.api.espn.com/apis/site/v2/sports/football/college-football/scoreboard?groups=80`

// NCAA Basketball  
`https://site.api.espn.com/apis/site/v2/sports/basketball/mens-college-basketball/scoreboard?groups=50`

// NCAA Baseball
`https://site.api.espn.com/apis/site/v2/sports/baseball/college-baseball/scoreboard`

// NCAA Hockey
`https://site.api.espn.com/apis/site/v2/sports/hockey/college-hockey/scoreboard`
```

## Database Schema Alignment:
- Use existing `games` table with sport values: 'NCAA_FB', 'NCAA_BB', 'NCAA_BSB', 'NCAA_HK'
- Store in `teams` table with proper sport_id
- Use `players` table with college field populated
- Store stats in `player_game_logs` table

Ready to build these ultra-optimized collectors? 🚀
# 📊 STATS COLLECTION MASTER PLAN

## 🎯 Mission: Achieve 100% Stats Coverage for 76.4% Pattern Accuracy

### Current Status (2025-07-10)
- **Coverage**: 0.7% (27 games with stats out of 3,829)
- **Target**: 100% coverage → 76.4% accuracy → $131,976/year additional profit
- **Games to Process**: 3,802

## 🏆 Proven Collector Best Practices

### 1. **Architecture Requirements**
✅ Use BaseCollector framework with:
- Bloom filters for deduplication (ultra-fast lookups)
- Two-tier caching (Bloom + in-memory)
- Rate limiting (1.5s between teams, 100 concurrent requests)
- Retry logic (3 attempts with exponential backoff)
- Checkpoint system for resume capability

### 2. **Optimal Processing Parameters**
```typescript
const OPTIMAL_SETTINGS = {
  gameBatchSize: 100,           // Process 100 games at a time
  statsBatchSize: 1000,         // Insert 1000 stats per batch
  gameLogsBatchSize: 500,       // Insert 500 game logs per batch
  concurrentRequests: 100,      // 100 parallel API calls
  apiDelay: 1500,              // 1.5s between team calls
  requestTimeout: 30000,        // 30s timeout per request
  retryAttempts: 3,            // 3 retries with backoff
  checkpointInterval: 100       // Save progress every 100 games
};
```

### 3. **ESPN API Endpoints**
```typescript
// Game data endpoint
`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/summary?event=${gameId}`

// Team roster endpoint  
`https://site.api.espn.com/apis/site/v2/sports/${sport}/${league}/teams/${teamId}/roster`

// Handle these response codes:
// 200: Success
// 404: Game doesn't exist (skip gracefully)
// 429: Rate limited (exponential backoff)
// 500+: Server error (retry)
```

### 4. **Deduplication Strategy**
```typescript
// External ID format
const externalId = `espn_${sport}_${playerId}`;

// Bloom filter for O(1) lookups
bloomFilter.add(externalId);
if (bloomFilter.has(externalId)) {
  // Skip - already processed
}

// Database upsert with conflict handling
await supabase.from('players').upsert({
  external_id: externalId,
  // ... other fields
}, {
  onConflict: 'external_id',
  ignoreDuplicates: true
});
```

### 5. **Error Handling Pattern**
```typescript
try {
  // Process game
} catch (error) {
  if (error.status === 404) {
    // Game doesn't exist - log and continue
    stats.gamesNotFound++;
  } else if (error.status === 429) {
    // Rate limited - wait and retry
    await sleep(exponentialBackoff(attempt));
  } else {
    // Log error but continue processing
    stats.errors++;
    logger.error(`Game ${gameId} failed:`, error);
  }
  // Never stop the entire collection!
}
```

### 6. **Progress Monitoring**
```typescript
// Real-time progress dashboard
const progress = {
  processed: 1523,
  total: 3829,
  percentage: 39.8,
  rate: 12.5, // games/second
  eta: '18 minutes',
  cacheHitRate: 85.2,
  successRate: 97.3,
  errors: 42
};
```

### 7. **Memory Management**
- Clear caches every 1000 games
- Use streaming for large result sets
- Garbage collect after each batch
- Monitor memory usage and alert if > 80%

### 8. **Database Optimization**
- Use bulk inserts (1000 records at a time)
- Index on external_id for fast lookups
- Partition player_stats by game_date
- Use connection pooling

### 9. **GPU Acceleration**
- Calculate fantasy points in parallel
- Batch matrix operations for efficiency
- Use GPU for pattern detection calculations
- Monitor GPU memory and temperature

### 10. **Success Metrics**
Track and report:
- Games processed per second
- API success rate
- Cache hit rate
- Duplicate detection rate
- Fantasy points calculated
- Database insert rate
- Total processing time

## 🚀 Implementation Steps

### Phase 1: Setup (5 mins)
1. Verify database schema
2. Initialize Bloom filters with existing data
3. Set up checkpoint system
4. Configure monitoring dashboard

### Phase 2: Collection (20-30 mins)
1. Process games in batches of 100
2. Use GPU acceleration for calculations
3. Monitor progress in real-time
4. Handle errors gracefully

### Phase 3: Verification (5 mins)
1. Verify all games processed
2. Check data quality
3. Run pattern analysis
4. Generate final report

## 📈 Expected Outcomes
- **Coverage**: 0.7% → 100%
- **Pattern Accuracy**: 65.2% → 76.4%
- **Additional Profit**: $131,976/year
- **Processing Time**: 20-30 minutes
- **Success Rate**: >95%

## 🎯 Success Criteria
- [ ] All 3,802 games have stats
- [ ] Player matching rate >98%
- [ ] Fantasy points calculated for all
- [ ] No data corruption
- [ ] Checkpoint system working
- [ ] Can resume from failures

## 💡 Key Lessons from Previous Collectors
1. **NBA Success**: 596 players, 30 teams - used proper deduplication
2. **MLB Success**: 914 players, 30 teams - handled large rosters well
3. **NHL Success**: Completed with checkpoint recovery
4. **NCAA Success**: Handled conference complexity

## 🔧 Tools & Commands
```bash
# Run the master collector
npx tsx scripts/gpu-stats-collector/master-collector.ts

# Check progress
npx tsx scripts/check-current-stats-coverage.ts

# Verify data quality
npx tsx scripts/check-stats-structure.ts

# Run pattern analysis
npx tsx scripts/analyze-pattern-accuracy.ts
```

## ⚠️ Common Pitfalls to Avoid
1. Don't process all games at once (memory issues)
2. Don't skip checkpoint saves (can't resume)
3. Don't ignore 404 errors (they're normal)
4. Don't use synchronous database operations
5. Don't forget to clear caches periodically

## 🎉 End Goal
Transform our pattern detection system from good (65.2%) to GREAT (76.4%) by providing complete player stats data for all games. This $131,976/year improvement is just 20-30 minutes away!
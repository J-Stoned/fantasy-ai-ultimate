# 🚀 10X STAT COLLECTION PLAN - WINNING FORMULA

## Current Status ✅
- **Teams**: ✓ 1,652 teams loaded
- **Players**: ✓ 5,573 players loaded  
- **Games**: ✗ 0 games (NEXT STEP)
- **Stats**: ✗ 0 stats

## 🎯 The Winning Formula: Teams ✓ → Players ✓ → **Games** → Stats

## Phase 3: GAMES COLLECTION (Current Priority)

### Step 1: Collect Historical Games (2023-2025)
We'll use the proven ESPN API approach for all sports:

1. **NBA Games** (2,460 games per season)
   - Use ESPN scoreboard API with date ranges
   - Seasons: 2023-24 (completed), 2024-25 (in progress)
   - Script: `collect-nba-games-2023-2025.ts`

2. **NFL Games** (544 games per season)  
   - Regular season + playoffs
   - Seasons: 2023, 2024
   - Script: `collect-nfl-games-2023-2024.ts`

3. **MLB Games** (4,860 games per season)
   - Regular season + playoffs
   - Seasons: 2023, 2024
   - Script: `collect-mlb-games-2023-2024.ts`

4. **NHL Games** (2,542 games per season)
   - Regular season + playoffs  
   - Seasons: 2023-24, 2024-25
   - Script: `collect-nhl-games-2023-2025.ts`

### Step 2: Verify Games Data
- Create `verify-games-collection.ts` to ensure:
  - All games have valid team IDs
  - Start times are correct
  - External IDs follow ESPN format
  - No duplicate games

## Phase 4: STATS COLLECTION (After Games)

### Step 1: Player Game Logs Collection
Using the `player_game_logs` table structure:

1. **Parallel Collection Strategy**
   - Use `universal-stats-collector.ts` with multi-core processing
   - 10 concurrent API calls per sport
   - Batch insert 500 records at a time
   - ESPN standardized IDs throughout

2. **Data to Collect**:
   ```javascript
   {
     player_id: // Link to players table
     game_id: // Link to games table  
     team_id: // Link to teams table
     game_date: // From game
     opponent_id: // From game
     is_home: // From game
     minutes_played: // From boxscore
     stats: {
       // Sport-specific stats (points, rebounds, etc.)
     },
     fantasy_points: // Calculate based on scoring
     raw_stats: // Original API response
     computed_metrics: // Advanced stats
     tracking_data: // If available
     metadata: // Additional context
   }
   ```

3. **Collection Order** (by data volume):
   - MLB: ~162 games × 26 players × 30 teams = 126,360 logs/season
   - NBA: ~82 games × 15 players × 30 teams = 36,900 logs/season  
   - NHL: ~82 games × 23 players × 32 teams = 60,352 logs/season
   - NFL: ~17 games × 53 players × 32 teams = 28,832 logs/season

### Step 2: Aggregate Stats Tables
After game logs are collected:

1. **player_stats** table - Aggregated career stats
2. **player_season_stats** table - Season totals
3. **player_injuries** table - From injury reports
4. **weather_data** table - For outdoor games

## 🏃 Execution Plan

### Week 1: Games Collection
- Day 1-2: Create and test games collection scripts
- Day 3-4: Run NBA + NFL games collection
- Day 5-6: Run MLB + NHL games collection  
- Day 7: Verify all games data

### Week 2: Stats Collection
- Day 1-2: Create universal stats collector
- Day 3-4: Collect NBA + NFL stats
- Day 5-6: Collect MLB + NHL stats
- Day 7: Verify and aggregate stats

### Success Metrics
- ✅ 15,000+ games collected
- ✅ 250,000+ player game logs
- ✅ All ESPN IDs standardized
- ✅ No duplicate data
- ✅ 95%+ data completeness

## 🔧 Technical Implementation

### Games Collector Template:
```typescript
// collect-{sport}-games-{years}.ts
const collectGames = async () => {
  // 1. Get date range for seasons
  // 2. For each date, fetch games from ESPN
  // 3. Map team external_ids to our team IDs
  // 4. Insert games with proper ESPN external_id format
  // 5. Track progress and handle errors
};
```

### Stats Collector Strategy:
```typescript
// universal-stats-collector.ts
const collectStats = async () => {
  // 1. Get all completed games
  // 2. For each game, fetch boxscore
  // 3. Parse player stats based on sport
  // 4. Batch insert to player_game_logs
  // 5. Calculate fantasy points
  // 6. Update aggregate tables
};
```

## 🎯 Expected Outcome
By following this proven approach:
- Complete games database for pattern detection
- Rich stats for ML training
- Foundation for 65%+ accuracy betting patterns
- All data properly linked and searchable

## 📋 Progress Tracking

### NBA Collection
- [ ] Games 2023-24 season
- [ ] Games 2024-25 season  
- [ ] Player game logs
- [ ] Verify data integrity
- [ ] Commit: "feat: Complete NBA games and stats collection 🏀"

### NFL Collection
- [ ] Games 2023 season
- [ ] Games 2024 season
- [ ] Player game logs
- [ ] Verify data integrity
- [ ] Commit: "feat: Complete NFL games and stats collection 🏈"

### MLB Collection
- [ ] Games 2023 season
- [ ] Games 2024 season
- [ ] Player game logs
- [ ] Verify data integrity
- [ ] Commit: "feat: Complete MLB games and stats collection ⚾"

### NHL Collection
- [ ] Games 2023-24 season
- [ ] Games 2024-25 season
- [ ] Player game logs
- [ ] Verify data integrity
- [ ] Commit: "feat: Complete NHL games and stats collection 🏒"

Ready to execute this 10X collection plan! 🚀
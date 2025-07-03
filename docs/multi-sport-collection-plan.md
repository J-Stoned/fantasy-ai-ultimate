# Multi-Sport Data Collection Plan

## Current Status (2025-07-03)

### ✅ Completed
1. **Schema Enhancements Applied** - Successfully migrated to hybrid schema supporting complex features
2. **Universal Sports Collector Created** - Single collector for NFL, NBA, and MLB data
3. **Schema Adapter Pattern** - Compatibility layer between simple and complex schemas
4. **Database Backup** - 30,019 records safely backed up before migration

### 🏗️ Architecture

```
Universal Sports Collector
├── NFL Collection
│   ├── Games from ESPN API
│   ├── Player Stats (passing, rushing, receiving)
│   └── Fantasy Points Calculation
├── NBA Collection  
│   ├── Games from ESPN API
│   ├── Player Stats (points, rebounds, assists)
│   └── DFS-style Scoring
└── MLB Collection
    ├── Games from ESPN API
    ├── Batting Stats (AVG, HR, RBI)
    ├── Pitching Stats (ERA, W, L, SO)
    └── Fantasy Points Calculation
```

### 📋 Next Steps

1. **Update Schema Adapter for MLB**
   - Add MLB-specific positions (P, C, 1B, 2B, etc.)
   - Handle batting vs pitching stats
   - Support flexible JSONB storage

2. **Test Universal Collector**
   ```bash
   npx tsx scripts/universal-sports-collector.ts
   ```

3. **Integrate with Mega Collector V3**
   - Replace individual collectors with universal
   - Maintain Bloom filter efficiency
   - Track cross-sport duplicates

4. **Update ML Training**
   - Use real player stats from enhanced schema
   - Sport-specific feature engineering
   - Cross-sport model comparisons

### 🔑 Key Files

- `/scripts/universal-sports-collector.ts` - Multi-sport data collector
- `/lib/db/schema-adapter.ts` - Schema compatibility layer
- `/scripts/schema-enhancements/` - Migration scripts (completed)
- `/scripts/mega-data-collector-v3.ts` - Production collector to update

### 📊 Database Schema (Enhanced)

```sql
-- Players table now includes:
- external_id (for ESPN/other platform IDs)
- team (actual team names)
- sport (football/basketball/baseball)
- sport_id (nfl/nba/mlb)

-- New tables:
- player_platform_mapping (track IDs across sources)
- player_game_logs (detailed game stats)
- player_season_stats (aggregated stats)

-- JSONB stats storage for flexibility
- NFL: passing_yards, rushing_tds, etc.
- NBA: points, rebounds, assists, etc.
- MLB: batting_avg, home_runs, era, etc.
```

### 🎯 Goals

1. **Collect Real Player Data** - Replace simulated data with actual stats
2. **Support Multiple Sports** - NFL, NBA, and MLB in one system
3. **Improve ML Accuracy** - Use player-level features (currently 51% with team data only)
4. **Production Ready** - No fake values, all real data

### 💡 Technical Decisions

1. **Hybrid Schema Approach** - Keep integer IDs for compatibility while adding complex features
2. **JSONB for Stats** - Flexible storage for sport-specific statistics
3. **External ID Tracking** - Map players across ESPN, Sleeper, etc.
4. **Universal Collector** - Single codebase for all sports reduces maintenance

### 🚨 Important Notes

- ESPN API has rate limits - collector uses pLimit(5) for concurrent requests
- Different sports have different stat structures - handled by sport-specific parsers
- Fantasy scoring varies by sport - implemented standard scoring systems
- Database uses firstname/lastname (not single name field) - adapter handles this
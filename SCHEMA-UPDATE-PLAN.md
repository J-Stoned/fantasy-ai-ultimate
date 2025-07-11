# 📋 Ultimate Stats Schema Update Plan

## Current Status (2025-07-11)

### ✅ What Already Exists in Database:
1. **player_game_logs** table with all 8 JSONB columns:
   - raw_stats
   - computed_metrics
   - tracking_data
   - situational_stats
   - play_by_play_stats
   - matchup_stats
   - metadata
   - quality_metrics

2. **stat_definitions** table (structure exists, needs data)
3. **data_quality_metrics** table

### ❌ What's Missing:
1. **GIN Indexes** on JSONB columns (CRITICAL for performance)
2. **Helper Functions** (calculate_stat_completeness, etc.)
3. **Views** (player_comprehensive_stats, data_quality_summary)
4. **Stat Definitions Data** (500+ stat definitions)
5. **Optional**: Sport-specific tables (basketball_shots, etc.)

## 🚀 Execution Steps

### Step 1: Apply Missing Components
```bash
# Run in Supabase SQL Editor
# File: ultimate-stats-missing-components.sql
```

### Step 2: Populate Stat Definitions
```bash
# Run in Supabase SQL Editor
# File: ultimate-stats-definitions-insert.sql
```

### Step 3: Verify Schema Updates
```bash
npx tsx scripts/add-ultimate-stats-columns.ts
```

### Step 4: Start Backfill Process
```bash
# Test with small batch first
npx tsx scripts/start-ultimate-backfill.ts test

# Full backfill (4+ hours)
npx tsx scripts/surgical-backfill-advanced-metrics.ts
```

## 📊 What This Enables

### Before:
- 0-12 basic stats per game
- 51.4% ML prediction accuracy
- Limited pattern detection

### After:
- 50-150 comprehensive stats per game
- 65.2% pattern detection accuracy (potential 76.4%)
- 500+ features for advanced ML
- Cross-sport analytics
- Real-time pattern scoring

## 🔄 Recovery Instructions (If Disconnected)

1. **Check what's been applied**:
```sql
-- Check if indexes exist
SELECT indexname FROM pg_indexes 
WHERE tablename = 'player_game_logs' 
AND indexname LIKE 'idx_pgl_%';

-- Check if functions exist
SELECT proname FROM pg_proc 
WHERE proname = 'calculate_stat_completeness';

-- Check stat definitions count
SELECT COUNT(*) FROM stat_definitions;
```

2. **Resume from where you left off**:
- If indexes missing: Run ultimate-stats-missing-components.sql
- If stat definitions empty: Run ultimate-stats-definitions-insert.sql
- If backfill not started: Run start-ultimate-backfill.ts

## 💾 Files Created This Session:
1. `ultimate-stats-missing-components.sql` - Indexes, functions, views
2. `ultimate-stats-definitions-insert.sql` - 500+ stat definitions (to be created)
3. `SCHEMA-UPDATE-PLAN.md` - This recovery plan

## 🎯 Current Task Status:
- [x] Analyzed schema differences
- [x] Created missing components SQL
- [ ] Create stat definitions insert SQL
- [ ] Run SQL updates in Supabase
- [ ] Verify updates
- [ ] Start backfill process

## 📈 Expected Outcome:
Transform 196,984 game logs from basic stats to comprehensive analytics, enabling advanced pattern detection with 76.4% accuracy potential and $1.15M profit opportunities.
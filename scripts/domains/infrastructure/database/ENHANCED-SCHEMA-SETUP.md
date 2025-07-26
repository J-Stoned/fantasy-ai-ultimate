# 🚀 ENHANCED SYNERGY SCHEMA SETUP

## Overview
This migration enhances the `team_synergy_stats` table with proper queryable columns instead of encoded hashes, enabling advanced analytics and ML features.

## Step 1: Run the Schema Migration

```bash
# Run this SQL in Supabase first
cat scripts/database/enhance-synergy-schema.sql
```

Copy and paste the SQL into Supabase SQL editor and run it.

## Step 2: Generate Enhanced Synergies

```bash
# After SQL migration, run the enhanced generator
npx tsx scripts/enhanced-synergy-generator.ts
```

## What This Achieves

### 🎯 **Target: 10,000+ Synergies**
- **Current**: 1,550 synergies (hash-based)
- **Target**: 10,000+ synergies (context-based)
- **Method**: 13 lineup sizes × 3 contexts × 2 home/away = 78x combinations per team-game

### 📊 **Enhanced Schema Features**

#### **New Columns:**
- `lineup_size`: 3-15 players (queryable!)
- `context_type`: 'standard', 'positional', 'temporal'
- `home_away`: 'home', 'away', null
- `position_type`: 'starters', 'bench', 'clutch', 'defensive', 'offensive'
- `time_context`: 'q1', 'q2', 'q3', 'q4', 'overtime', 'full_game'
- `opponent_context`: 'vs_fast_pace', 'vs_slow_pace', 'vs_good_defense', 'vs_bad_defense'
- `season_context`: 'early_season', 'mid_season', 'late_season', 'playoffs'

#### **Analytics Queries Enabled:**
```sql
-- Find best 5-player home lineups
SELECT * FROM team_synergy_stats 
WHERE lineup_size = 5 AND home_away = 'home' 
ORDER BY net_rating DESC LIMIT 10;

-- Compare performance by lineup size
SELECT lineup_size, AVG(net_rating) as avg_rating
FROM team_synergy_stats 
GROUP BY lineup_size 
ORDER BY lineup_size;

-- Find clutch performers
SELECT * FROM team_synergy_stats 
WHERE position_type = 'clutch' 
ORDER BY avg_fantasy_points DESC LIMIT 20;

-- Analyze home field advantage
SELECT 
    home_away, 
    AVG(net_rating) as avg_rating,
    COUNT(*) as synergy_count
FROM team_synergy_stats 
GROUP BY home_away;
```

#### **ML Features Ready:**
```sql
-- Get features for ML model
SELECT 
    lineup_size,
    context_type,
    home_away,
    position_type,
    net_rating,
    offensive_rating,
    defensive_rating,
    avg_fantasy_points
FROM team_synergy_stats 
WHERE team_id = ?;
```

## Expected Results

### 📈 **Synergy Multiplication:**
- **3-player synergies**: ~2,000 combinations
- **5-player synergies**: ~2,500 combinations  
- **7-player synergies**: ~2,000 combinations
- **10-player synergies**: ~1,500 combinations
- **15-player synergies**: ~1,000 combinations
- **Context variations**: 3x multiplier per base synergy
- **Home/Away**: 2x multiplier per context
- **Total**: 10,000+ synergies

### 🎯 **Quality Improvements:**
- **Queryable**: Can filter by any dimension
- **Analyzable**: Ready for advanced analytics
- **ML-Ready**: Perfect feature matrix for models
- **Debuggable**: Clear understanding of each synergy
- **Scalable**: Easy to add new contexts

## Future Phases

### **Phase 2: Advanced Contexts** (After 2021-2022 data)
- More position types (point_guard, center, etc.)
- Opponent-specific contexts (vs_warriors, vs_lakers)
- Season situations (must_win, playoff_push)

### **Phase 3: ML Integration** (After Phase 2)
- Synergy-based predictions
- Lineup optimization
- Fantasy team building
- Betting edge detection

## Verification

After running both steps, verify with:

```sql
-- Check total synergies
SELECT COUNT(*) FROM team_synergy_stats;

-- Check lineup size distribution
SELECT lineup_size, COUNT(*) 
FROM team_synergy_stats 
GROUP BY lineup_size 
ORDER BY lineup_size;

-- Check context distribution
SELECT context_type, COUNT(*) 
FROM team_synergy_stats 
GROUP BY context_type;
```

Expected results: 10,000+ synergies across all contexts!
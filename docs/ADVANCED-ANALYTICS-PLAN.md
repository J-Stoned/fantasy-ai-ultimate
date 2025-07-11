# Comprehensive Plan for Efficient Data Storage & Cross-Sport Advanced Analytics

## 1. **Optimize Current Data Storage Structure**

### A. Enhance player_game_logs table with computed columns:
```sql
-- Add computed columns for advanced metrics that work across all sports
ALTER TABLE player_game_logs ADD COLUMN IF NOT EXISTS computed_metrics JSONB;
ALTER TABLE player_game_logs ADD COLUMN IF NOT EXISTS metadata JSONB;
ALTER TABLE player_game_logs ADD COLUMN IF NOT EXISTS opponent_id INTEGER;
```

### B. Create a universal stats mapping table:
```sql
CREATE TABLE universal_stat_mappings (
  id SERIAL PRIMARY KEY,
  sport TEXT NOT NULL,
  stat_name TEXT NOT NULL,
  universal_name TEXT NOT NULL,
  calculation_formula TEXT,
  unit TEXT
);
```

## 2. **Implement Cross-Sport Advanced Analytics**

### A. Create universal advanced metrics calculator:
- **Efficiency Rating**: Works for all sports (points per possession/opportunity)
- **Usage Rate**: Percentage of team plays while player is active
- **Impact Score**: Player's effect on team performance
- **Clutch Performance**: Performance in high-pressure situations
- **Consistency Index**: Variance in performance across games
- **Rest Impact**: Performance based on days of rest
- **Matchup Efficiency**: Performance vs specific opponent types

### B. Add sport-specific advanced metrics:
- **Basketball**: True Shooting %, PER, BPM, VORP, PIE
- **Football**: YAC, Passer Rating, DVOA, EPA
- **Baseball**: WAR, OPS+, FIP, BABIP, wRC+
- **Hockey**: Corsi, Fenwick, PDO, GAR
- **Soccer**: xG, xA, Progressive Passes, Pressure Success Rate

## 3. **Storage Optimization Strategy**

### A. Implement data compression:
- Store raw stats in optimized JSONB format
- Pre-compute frequently accessed metrics
- Use PostgreSQL table partitioning by sport and date
- Implement automatic archiving for old data

### B. Create materialized views for analytics:
```sql
CREATE MATERIALIZED VIEW player_advanced_metrics AS
SELECT 
  player_id,
  sport,
  season,
  -- Universal metrics
  AVG(fantasy_points) as avg_fantasy_points,
  STDDEV(fantasy_points) as consistency_score,
  -- Sport-specific computations
  CASE 
    WHEN sport IN ('NBA', 'NCAA_BB') THEN 
      -- Basketball advanced metrics
    WHEN sport = 'NFL' THEN
      -- Football advanced metrics
    -- etc for each sport
  END as advanced_metrics
FROM player_game_logs
GROUP BY player_id, sport, season;
```

## 4. **Ensure Data Completeness**

### A. Add validation for all new data:
- Ensure opponent_id is always populated
- Calculate double-doubles/triple-doubles for basketball
- Track hat tricks for hockey/soccer
- Record cycles/no-hitters for baseball

### B. Create data quality monitoring:
```typescript
// Data validation service
interface GameLogValidation {
  hasOpponentId: boolean;
  hasAllRequiredStats: boolean;
  hasAdvancedMetrics: boolean;
  hasMetadata: boolean;
}
```

## 5. **Implementation Steps**

1. **Update all existing collectors** to:
   - Always populate opponent_id
   - Calculate advanced metrics during collection
   - Add metadata (starter/bench, weather, etc.)

2. **Create unified analytics engine**:
   - `scripts/calculate-universal-metrics.ts`
   - `scripts/calculate-sport-specific-metrics.ts`
   - `scripts/backfill-advanced-metrics.ts`

3. **Optimize storage**:
   - Implement JSONB compression
   - Create sport-specific partitions
   - Build analytics indexes

4. **Add new sports with full metrics**:
   - MLS: xG, xA, possession stats
   - WNBA: Same as NBA metrics
   - PGA: Strokes gained, putting stats
   - UFC: Strike accuracy, takedown %

## 6. **Expected Benefits**

- **Storage**: 40-50% reduction through compression
- **Query Speed**: 10x faster with materialized views
- **Analytics**: 100% coverage of advanced metrics
- **Pattern Recognition**: Universal metrics enable cross-sport patterns
- **Scale**: Support for 10M+ logs with sub-second queries

This approach ensures all sports have comprehensive advanced analytics while maintaining efficient storage and fast query performance.
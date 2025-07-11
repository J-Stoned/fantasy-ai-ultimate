-- Missing Components for Ultimate Stats Schema
-- Run this after verifying the base tables exist

-- =====================================================
-- STEP 1: Create missing indexes on JSONB columns
-- =====================================================

-- These GIN indexes are CRITICAL for query performance on JSONB data
CREATE INDEX IF NOT EXISTS idx_pgl_raw_stats ON player_game_logs USING GIN (raw_stats);
CREATE INDEX IF NOT EXISTS idx_pgl_computed_metrics ON player_game_logs USING GIN (computed_metrics);
CREATE INDEX IF NOT EXISTS idx_pgl_tracking_data ON player_game_logs USING GIN (tracking_data);
CREATE INDEX IF NOT EXISTS idx_pgl_situational_stats ON player_game_logs USING GIN (situational_stats);
CREATE INDEX IF NOT EXISTS idx_pgl_metadata ON player_game_logs USING GIN (metadata);

-- Compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pgl_player_date_sport 
ON player_game_logs(player_id, game_date) 
WHERE computed_metrics IS NOT NULL;

-- Indexes for stat_definitions table
CREATE INDEX IF NOT EXISTS idx_stat_def_sport ON stat_definitions(sport);
CREATE INDEX IF NOT EXISTS idx_stat_def_category ON stat_definitions(sport, stat_category);

-- =====================================================
-- STEP 2: Create helper functions
-- =====================================================

-- Function to check data completeness
CREATE OR REPLACE FUNCTION calculate_stat_completeness(stats JSONB, sport TEXT)
RETURNS FLOAT AS $$
DECLARE
  expected_count INTEGER;
  actual_count INTEGER;
BEGIN
  -- Define expected stats per sport
  CASE sport
    WHEN 'NBA', 'NCAA_BB' THEN expected_count := 15;
    WHEN 'NFL', 'NCAA_FB' THEN expected_count := 10;
    WHEN 'MLB' THEN expected_count := 12;
    WHEN 'NHL' THEN expected_count := 10;
    ELSE expected_count := 8;
  END CASE;
  
  -- Count non-null stats
  SELECT COUNT(*) INTO actual_count
  FROM jsonb_each(stats)
  WHERE value::text != 'null' AND value::text != '0';
  
  RETURN actual_count::FLOAT / expected_count::FLOAT;
END;
$$ LANGUAGE plpgsql;

-- Function to aggregate play-by-play stats
CREATE OR REPLACE FUNCTION aggregate_play_by_play_stats(p_game_id INTEGER, p_player_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}';
  play_stats JSONB;
BEGIN
  -- This function is a placeholder for when play_by_play_data table exists
  -- For now, return empty object
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 3: Create comprehensive stats view
-- =====================================================

CREATE OR REPLACE VIEW player_comprehensive_stats AS
SELECT 
  pgl.id,
  pgl.player_id,
  pgl.game_id,
  pgl.game_date,
  g.sport,
  pgl.minutes_played,
  pgl.fantasy_points,
  pgl.stats AS basic_stats,
  pgl.computed_metrics,
  pgl.tracking_data,
  pgl.situational_stats,
  pgl.metadata,
  -- Extract commonly used stats for easy access
  (pgl.stats->>'points')::int as points,
  (pgl.stats->>'rebounds')::int as rebounds,
  (pgl.stats->>'assists')::int as assists,
  (pgl.computed_metrics->>'true_shooting_pct')::float as true_shooting_pct,
  (pgl.tracking_data->>'distance_traveled')::float as distance_traveled,
  (pgl.situational_stats->>'clutch_points')::int as clutch_points
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id;

-- =====================================================
-- STEP 4: Add missing columns to stat_definitions if needed
-- =====================================================

-- Ensure all columns exist
ALTER TABLE stat_definitions 
ADD COLUMN IF NOT EXISTS calculation_formula TEXT,
ADD COLUMN IF NOT EXISTS source_field TEXT,
ADD COLUMN IF NOT EXISTS importance_score INTEGER DEFAULT 5,
ADD COLUMN IF NOT EXISTS fantasy_relevance BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS requires_tracking_data BOOLEAN DEFAULT false;

-- =====================================================
-- STEP 5: Create quality check view
-- =====================================================

CREATE OR REPLACE VIEW data_quality_summary AS
SELECT 
  g.sport,
  COUNT(pgl.id) as total_logs,
  COUNT(pgl.raw_stats) FILTER (WHERE pgl.raw_stats != '{}') as logs_with_raw_stats,
  COUNT(pgl.computed_metrics) FILTER (WHERE pgl.computed_metrics != '{}') as logs_with_computed_metrics,
  COUNT(pgl.tracking_data) FILTER (WHERE pgl.tracking_data != '{}') as logs_with_tracking_data,
  AVG((SELECT COUNT(*) FROM jsonb_object_keys(pgl.stats))) as avg_basic_stats_count,
  AVG((SELECT COUNT(*) FROM jsonb_object_keys(pgl.computed_metrics))) as avg_computed_metrics_count
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
GROUP BY g.sport;

-- =====================================================
-- STEP 6: Add helpful comments
-- =====================================================

COMMENT ON FUNCTION calculate_stat_completeness IS 
'Calculates the percentage of expected stats that are present for a given sport';

COMMENT ON VIEW player_comprehensive_stats IS 
'Unified view of all player stats with easy access to common metrics';

COMMENT ON VIEW data_quality_summary IS 
'Summary of data completeness by sport for monitoring backfill progress';
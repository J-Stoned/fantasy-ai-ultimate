-- Ultimate Stats Schema Enhancement
-- Generated: 2025-07-11T13:00:12.087Z
-- Total logs to migrate: 196,984

-- =====================================================
-- STEP 1: Add comprehensive stats columns
-- =====================================================

-- Add JSONB columns for complete stats storage
ALTER TABLE player_game_logs 
ADD COLUMN IF NOT EXISTS raw_stats JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS computed_metrics JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS tracking_data JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS situational_stats JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS play_by_play_stats JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS matchup_stats JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',
ADD COLUMN IF NOT EXISTS quality_metrics JSONB DEFAULT '{}';

-- =====================================================
-- STEP 2: Create performance indexes
-- =====================================================

CREATE INDEX IF NOT EXISTS idx_pgl_raw_stats ON player_game_logs USING GIN (raw_stats);
CREATE INDEX IF NOT EXISTS idx_pgl_computed_metrics ON player_game_logs USING GIN (computed_metrics);
CREATE INDEX IF NOT EXISTS idx_pgl_tracking_data ON player_game_logs USING GIN (tracking_data);
CREATE INDEX IF NOT EXISTS idx_pgl_situational_stats ON player_game_logs USING GIN (situational_stats);
CREATE INDEX IF NOT EXISTS idx_pgl_metadata ON player_game_logs USING GIN (metadata);

-- Compound indexes for common queries
CREATE INDEX IF NOT EXISTS idx_pgl_player_date_sport 
ON player_game_logs(player_id, game_date) 
WHERE computed_metrics IS NOT NULL;

-- =====================================================
-- STEP 3: Create stat definitions table
-- =====================================================

CREATE TABLE IF NOT EXISTS stat_definitions (
  id SERIAL PRIMARY KEY,
  sport TEXT NOT NULL,
  stat_category TEXT NOT NULL,
  stat_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  unit TEXT,
  calculation_formula TEXT,
  source_field TEXT,
  importance_score INTEGER DEFAULT 5,
  fantasy_relevance BOOLEAN DEFAULT true,
  requires_tracking_data BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, stat_name)
);

-- Index for quick lookups
CREATE INDEX IF NOT EXISTS idx_stat_def_sport ON stat_definitions(sport);
CREATE INDEX IF NOT EXISTS idx_stat_def_category ON stat_definitions(sport, stat_category);

-- =====================================================
-- STEP 4: Create data quality tracking
-- =====================================================

CREATE TABLE IF NOT EXISTS data_quality_metrics (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  sport TEXT NOT NULL,
  basic_stats_coverage FLOAT,
  advanced_stats_coverage FLOAT,
  tracking_data_available BOOLEAN DEFAULT false,
  play_by_play_available BOOLEAN DEFAULT false,
  data_source TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  issues JSONB DEFAULT '[]',
  UNIQUE(game_id)
);

-- =====================================================
-- STEP 5: Create helper functions
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

-- =====================================================
-- STEP 6: Add comments for documentation
-- =====================================================

COMMENT ON COLUMN player_game_logs.raw_stats IS 
'Original stats data exactly as received from data source (ESPN, etc)';

COMMENT ON COLUMN player_game_logs.computed_metrics IS 
'Calculated advanced metrics: PER, true shooting %, usage rate, etc';

COMMENT ON COLUMN player_game_logs.tracking_data IS 
'Player movement data: distance, speed, touches, time of possession';

COMMENT ON COLUMN player_game_logs.situational_stats IS 
'Context-specific: clutch time, red zone, power play, RISP';

COMMENT ON COLUMN player_game_logs.play_by_play_stats IS 
'Aggregated from granular play data: touches, play types, etc';

COMMENT ON COLUMN player_game_logs.metadata IS 
'Game context: weather, injuries, starter/bench, lineup position';

COMMENT ON COLUMN player_game_logs.quality_metrics IS 
'Data quality indicators: completeness, source, last updated';

-- =====================================================
-- STEP 7: Initial stat definitions
-- =====================================================

-- Basketball core stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, unit, importance_score) VALUES
('NBA', 'basic', 'points', 'Points', 'count', 10),
('NBA', 'basic', 'rebounds', 'Rebounds', 'count', 8),
('NBA', 'basic', 'assists', 'Assists', 'count', 8),
('NBA', 'basic', 'steals', 'Steals', 'count', 7),
('NBA', 'basic', 'blocks', 'Blocks', 'count', 7),
('NBA', 'basic', 'turnovers', 'Turnovers', 'count', 6),
('NBA', 'shooting', 'fg_percentage', 'Field Goal %', 'percentage', 9),
('NBA', 'shooting', 'three_percentage', '3-Point %', 'percentage', 8),
('NBA', 'shooting', 'ft_percentage', 'Free Throw %', 'percentage', 7),
('NBA', 'advanced', 'true_shooting_pct', 'True Shooting %', 'percentage', 10),
('NBA', 'advanced', 'usage_rate', 'Usage Rate', 'percentage', 9),
('NBA', 'advanced', 'player_efficiency_rating', 'PER', 'rating', 10),
('NBA', 'tracking', 'touches', 'Touches', 'count', 7),
('NBA', 'tracking', 'distance_traveled', 'Distance', 'feet', 6),
('NBA', 'situational', 'clutch_points', 'Clutch Points', 'count', 8)
ON CONFLICT (sport, stat_name) DO NOTHING;

-- Add other sports...

-- =====================================================
-- VERIFICATION QUERIES
-- =====================================================

-- Check column addition
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'player_game_logs' 
AND column_name IN ('raw_stats', 'computed_metrics', 'tracking_data', 
                    'situational_stats', 'metadata', 'quality_metrics');

-- Check indexes
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'player_game_logs' 
AND indexname LIKE 'idx_pgl_%';

-- Sample data quality check
SELECT 
  COUNT(*) as total_logs,
  COUNT(computed_metrics) as logs_with_metrics,
  COUNT(raw_stats) as logs_with_raw_stats,
  AVG(CASE WHEN stats IS NOT NULL 
    THEN (SELECT COUNT(*) FROM jsonb_object_keys(stats))
    ELSE 0 END) as avg_stat_count
FROM player_game_logs
LIMIT 1000;

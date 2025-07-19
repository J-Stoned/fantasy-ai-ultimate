-- 🔥 PERFORMANCE INDEXES PART 4: ML ENRICHMENT TABLES
-- Betting lines, weather data, injuries

-- Betting lines indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_betting_lines_game 
  ON betting_lines(game_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_betting_lines_created 
  ON betting_lines(created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_betting_lines_timestamp 
  ON betting_lines(timestamp);

-- Weather data indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_data_game 
  ON weather_data(game_id);

-- Player injuries indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_injuries_player 
  ON player_injuries(player_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_injuries_created 
  ON player_injuries(created_at DESC);

-- Update statistics
ANALYZE betting_lines;
ANALYZE weather_data;
ANALYZE player_injuries;

-- Check ML enrichment table sizes
SELECT 
    'betting_lines' as table_name,
    COUNT(*) as row_count
FROM betting_lines
UNION ALL
SELECT 
    'weather_data' as table_name,
    COUNT(*) as row_count
FROM weather_data
UNION ALL
SELECT 
    'player_injuries' as table_name,
    COUNT(*) as row_count
FROM player_injuries;
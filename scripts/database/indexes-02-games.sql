-- 🔥 PERFORMANCE INDEXES PART 2: GAMES TABLE
-- Core lookup table with 30K+ games

-- Games table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_external 
  ON games(external_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_sport_id_time 
  ON games(sport_id, start_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_teams 
  ON games(home_team_id, away_team_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_status 
  ON games(status);

-- Composite index for complex filtering
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_teams_composite 
  ON games(home_team_id, away_team_id, sport_id, start_time DESC);

-- Partial index for upcoming games
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_upcoming 
  ON games(start_time, sport_id)
  WHERE start_time >= CURRENT_TIMESTAMP;

-- JSONB index for metadata
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_metadata_gin 
  ON games USING GIN (metadata);

-- Update statistics
ANALYZE games;

-- Check results
SELECT COUNT(*) as game_count FROM games;
SELECT 
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public' 
  AND tablename = 'games'
ORDER BY indexname;
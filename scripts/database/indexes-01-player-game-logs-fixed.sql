-- 🔥 PERFORMANCE INDEXES PART 1: PLAYER GAME LOGS
-- This is the most critical table with 600K+ records
-- Run each part separately to avoid timeouts

-- Player game logs indexes (most heavily queried table)
CREATE INDEX IF NOT EXISTS idx_pgl_game_team 
  ON player_game_logs(game_id, team_id);

CREATE INDEX IF NOT EXISTS idx_pgl_player_game 
  ON player_game_logs(player_id, game_id);

CREATE INDEX IF NOT EXISTS idx_pgl_created 
  ON player_game_logs(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pgl_game_date 
  ON player_game_logs(game_date);

-- Composite index for complex queries
CREATE INDEX IF NOT EXISTS idx_pgl_game_team_player 
  ON player_game_logs(game_id, team_id, player_id);

-- Fantasy points index for sorting
CREATE INDEX IF NOT EXISTS idx_pgl_game_fantasy 
  ON player_game_logs(game_id, fantasy_points DESC);

-- JSONB index for stats queries (this might take longer)
CREATE INDEX IF NOT EXISTS idx_pgl_stats_gin 
  ON player_game_logs USING GIN (stats);

-- Update statistics for this table
ANALYZE player_game_logs;

-- Check index creation status
SELECT 
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public' 
  AND tablename = 'player_game_logs'
ORDER BY indexname;
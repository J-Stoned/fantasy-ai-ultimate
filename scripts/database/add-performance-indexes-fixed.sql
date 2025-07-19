-- 🔥 PERFORMANCE INDEXES FOR FANTASY AI 🔥
-- Optimized for pattern detection and ML queries
-- Updated: 2025-07-19 - Fixed column names to match actual schema

-- ========================================
-- CRITICAL PERFORMANCE INDEXES (10x+ improvement)
-- ========================================

-- 1. Player game logs - Most heavily queried table
CREATE INDEX IF NOT EXISTS idx_pgl_game_team ON player_game_logs(game_id, team_id);
CREATE INDEX IF NOT EXISTS idx_pgl_player_game ON player_game_logs(player_id, game_id);
CREATE INDEX IF NOT EXISTS idx_pgl_created ON player_game_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pgl_game_date ON player_game_logs(game_date);

-- 2. Games table - Core lookup table
CREATE INDEX IF NOT EXISTS idx_games_external ON games(external_id);
CREATE INDEX IF NOT EXISTS idx_games_sport_id_time ON games(sport_id, start_time DESC);
CREATE INDEX IF NOT EXISTS idx_games_teams ON games(home_team_id, away_team_id);
CREATE INDEX IF NOT EXISTS idx_games_status ON games(status);

-- 3. Enhanced synergies - Pattern detection queries (if table exists)
-- CREATE INDEX IF NOT EXISTS idx_synergies_hash ON enhanced_synergies(lineup_hash);
-- CREATE INDEX IF NOT EXISTS idx_synergies_game ON enhanced_synergies(game_id);
-- CREATE INDEX IF NOT EXISTS idx_synergies_lineup_size ON enhanced_synergies(lineup_size);
-- CREATE INDEX IF NOT EXISTS idx_synergies_context ON enhanced_synergies(context_type, lineup_size);

-- 4. Players table - Frequent joins
CREATE INDEX IF NOT EXISTS idx_players_external ON players(external_id);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_sport_id ON players(sport_id);
CREATE INDEX IF NOT EXISTS idx_players_name ON players(firstname, lastname);

-- 5. Teams table - Lookup optimization
CREATE INDEX IF NOT EXISTS idx_teams_external ON teams(external_id);
CREATE INDEX IF NOT EXISTS idx_teams_sport_id ON teams(sport_id);
CREATE INDEX IF NOT EXISTS idx_teams_abbreviation ON teams(abbreviation);

-- 6. Betting lines - Pattern correlation
CREATE INDEX IF NOT EXISTS idx_betting_lines_game ON betting_lines(game_id);
CREATE INDEX IF NOT EXISTS idx_betting_lines_created ON betting_lines(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_betting_lines_timestamp ON betting_lines(timestamp);

-- 7. Weather data - ML enrichment
CREATE INDEX IF NOT EXISTS idx_weather_data_game ON weather_data(game_id);

-- 8. Player injuries - ML features
CREATE INDEX IF NOT EXISTS idx_player_injuries_player ON player_injuries(player_id);
-- Note: player_injuries table doesn't have game_id column

-- ========================================
-- TEAM SYNERGY INDEXES
-- ========================================

CREATE INDEX IF NOT EXISTS idx_team_synergy_team ON team_synergy_stats(team_id);
CREATE INDEX IF NOT EXISTS idx_team_synergy_hash ON team_synergy_stats(lineup_hash);
CREATE INDEX IF NOT EXISTS idx_team_synergy_size ON team_synergy_stats(lineup_size);
CREATE INDEX IF NOT EXISTS idx_team_synergy_context ON team_synergy_stats(context_type, lineup_size);

-- ========================================
-- ML AND PATTERN INDEXES
-- ========================================

-- Pattern Performance Indexes
CREATE INDEX IF NOT EXISTS idx_pattern_performance_accuracy 
  ON pattern_performance(accuracy_rate DESC);

CREATE INDEX IF NOT EXISTS idx_pattern_performance_sport_accuracy 
  ON pattern_performance(sport, accuracy_rate DESC);

CREATE INDEX IF NOT EXISTS idx_pattern_performance_pattern_type 
  ON pattern_performance(pattern_type);

-- ML Predictions Indexes
CREATE INDEX IF NOT EXISTS idx_ml_predictions_game_model 
  ON ml_predictions(game_id, model_name);

CREATE INDEX IF NOT EXISTS idx_ml_predictions_confidence 
  ON ml_predictions(confidence DESC);

-- Fantasy Betting Insights Indexes
CREATE INDEX IF NOT EXISTS idx_fantasy_betting_insights_game 
  ON fantasy_betting_insights(game_id);

CREATE INDEX IF NOT EXISTS idx_fantasy_betting_insights_confidence 
  ON fantasy_betting_insights(pattern_confidence DESC);

CREATE INDEX IF NOT EXISTS idx_fantasy_betting_insights_active 
  ON fantasy_betting_insights(has_betting_edge, pattern_confidence DESC)
  WHERE has_betting_edge = true;

-- ========================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ========================================

-- Composite index for player game logs
CREATE INDEX IF NOT EXISTS idx_pgl_game_team_player ON player_game_logs(game_id, team_id, player_id);

-- Composite index for game filtering
CREATE INDEX IF NOT EXISTS idx_games_teams_composite 
  ON games(home_team_id, away_team_id, sport_id, start_time DESC);

-- Player game logs with fantasy points
CREATE INDEX IF NOT EXISTS idx_pgl_game_fantasy 
  ON player_game_logs(game_id, fantasy_points DESC);

-- ========================================
-- PARTIAL INDEXES FOR COMMON FILTERS
-- ========================================

-- Upcoming games
CREATE INDEX IF NOT EXISTS idx_games_upcoming 
  ON games(start_time, sport_id)
  WHERE start_time >= CURRENT_TIMESTAMP;

-- Recent ML predictions
CREATE INDEX IF NOT EXISTS idx_ml_predictions_recent 
  ON ml_predictions(created_at DESC, model_name)
  WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days';

-- ========================================
-- JSONB INDEXES
-- ========================================

-- Stats JSONB index for player game logs
CREATE INDEX IF NOT EXISTS idx_pgl_stats_gin 
  ON player_game_logs USING GIN (stats);

-- Metadata JSONB indexes
CREATE INDEX IF NOT EXISTS idx_games_metadata_gin 
  ON games USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_players_metadata_gin 
  ON players USING GIN (metadata);

-- ========================================
-- STATISTICS UPDATE (CRITICAL FOR QUERY PLANNER)
-- ========================================

-- Update statistics on all critical tables
ANALYZE player_game_logs;
ANALYZE games;
ANALYZE players;
ANALYZE teams;
ANALYZE betting_lines;
ANALYZE weather_data;
ANALYZE player_injuries;
ANALYZE team_synergy_stats;
ANALYZE pattern_performance;
ANALYZE ml_predictions;
ANALYZE fantasy_betting_insights;

-- ========================================
-- MONITORING QUERY TO CHECK INDEX USAGE
-- ========================================

-- Run this query after indexes are created to monitor usage
/*
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
ORDER BY idx_scan DESC;
*/
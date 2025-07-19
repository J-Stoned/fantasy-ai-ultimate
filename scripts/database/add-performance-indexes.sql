-- 🔥 PERFORMANCE INDEXES FOR FANTASY AI 🔥
-- Optimized for pattern detection and ML queries
-- Updated: 2025-07-19 - Added critical missing indexes from performance analysis

-- ========================================
-- CRITICAL PERFORMANCE INDEXES (10x+ improvement)
-- ========================================

-- 1. Player game logs - Most heavily queried table
CREATE INDEX IF NOT EXISTS idx_pgl_game_team ON player_game_logs(game_id, team_id);
CREATE INDEX IF NOT EXISTS idx_pgl_sport ON player_game_logs(sport);
CREATE INDEX IF NOT EXISTS idx_pgl_created ON player_game_logs(created_at DESC);

-- 2. Games table - Core lookup table
CREATE INDEX IF NOT EXISTS idx_games_external ON games(external_id);
CREATE INDEX IF NOT EXISTS idx_games_season ON games(season, sport);

-- 3. Enhanced synergies - Pattern detection queries  
CREATE INDEX IF NOT EXISTS idx_synergies_hash ON enhanced_synergies(lineup_hash);
CREATE INDEX IF NOT EXISTS idx_synergies_game ON enhanced_synergies(game_id);
CREATE INDEX IF NOT EXISTS idx_synergies_lineup_size ON enhanced_synergies(lineup_size);
CREATE INDEX IF NOT EXISTS idx_synergies_context ON enhanced_synergies(context_type, lineup_size);

-- 4. Players table - Frequent joins
CREATE INDEX IF NOT EXISTS idx_players_external ON players(external_id);
CREATE INDEX IF NOT EXISTS idx_players_team ON players(team_id);
CREATE INDEX IF NOT EXISTS idx_players_sport ON players(sport);

-- 5. Teams table - Lookup optimization
CREATE INDEX IF NOT EXISTS idx_teams_external ON teams(external_id);
CREATE INDEX IF NOT EXISTS idx_teams_sport ON teams(sport);

-- 6. Betting lines - Pattern correlation
CREATE INDEX IF NOT EXISTS idx_betting_game ON betting_lines(game_id);
CREATE INDEX IF NOT EXISTS idx_betting_created ON betting_lines(created_at DESC);

-- 7. Weather data - ML enrichment
CREATE INDEX IF NOT EXISTS idx_weather_game ON weather_data(game_id);

-- 8. Player injuries - ML features
CREATE INDEX IF NOT EXISTS idx_injuries_player ON player_injuries(player_id);
CREATE INDEX IF NOT EXISTS idx_injuries_game ON player_injuries(game_id);

-- ========================================
-- EXISTING PATTERN DETECTION INDEXES
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

CREATE INDEX IF NOT EXISTS idx_ml_predictions_player_model 
  ON ml_predictions(player_id, model_name, created_at DESC);

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

-- Pattern Analysis History Indexes
CREATE INDEX IF NOT EXISTS idx_pattern_analysis_history_game 
  ON pattern_analysis_history(game_id, created_at DESC);

-- Games Indexes for Pattern Queries
CREATE INDEX IF NOT EXISTS idx_games_sport_start_time 
  ON games(sport, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_games_status_start_time 
  ON games(status, start_time DESC);

-- Player Game Logs Indexes for Performance Analysis
CREATE INDEX IF NOT EXISTS idx_player_game_logs_player_game 
  ON player_game_logs(player_id, game_id);

CREATE INDEX IF NOT EXISTS idx_player_game_logs_game_stats 
  ON player_game_logs(game_id, points DESC);

-- User Pattern Preferences Index
CREATE INDEX IF NOT EXISTS idx_user_pattern_preferences_user 
  ON user_pattern_preferences(user_id);

-- Composite Indexes for Complex Queries
CREATE INDEX IF NOT EXISTS idx_games_teams_composite 
  ON games(home_team_id, away_team_id, sport, start_time DESC);

CREATE INDEX IF NOT EXISTS idx_pattern_multipliers_composite 
  ON pattern_multipliers(pattern_type, sport);

-- Partial Indexes for Common Filters
CREATE INDEX IF NOT EXISTS idx_games_upcoming 
  ON games(start_time, sport)
  WHERE start_time >= CURRENT_TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_ml_predictions_recent 
  ON ml_predictions(created_at DESC, model_name)
  WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days';

-- GIN Index for JSONB Pattern Arrays
CREATE INDEX IF NOT EXISTS idx_fantasy_betting_insights_patterns_gin 
  ON fantasy_betting_insights USING GIN (active_patterns);

-- ========================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ========================================

-- Composite index for synergy generation queries
CREATE INDEX IF NOT EXISTS idx_pgl_game_team_player ON player_game_logs(game_id, team_id, player_id);

-- Composite index for game filtering
CREATE INDEX IF NOT EXISTS idx_games_sport_season_time ON games(sport, season, start_time DESC);

-- Pattern detection optimization with partial index
CREATE INDEX IF NOT EXISTS idx_pattern_opportunity ON enhanced_synergies(context_type, home_away, lineup_size) 
    WHERE lineup_size >= 5;

-- ========================================
-- STATISTICS UPDATE (CRITICAL FOR QUERY PLANNER)
-- ========================================

-- Update statistics on all critical tables
ANALYZE player_game_logs;
ANALYZE games;
ANALYZE enhanced_synergies;
ANALYZE players;
ANALYZE teams;
ANALYZE betting_lines;
ANALYZE weather_data;
ANALYZE player_injuries;
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
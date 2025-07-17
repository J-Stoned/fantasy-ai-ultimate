-- 🔥 PERFORMANCE INDEXES FOR FANTASY AI 🔥
-- Optimized for pattern detection and ML queries

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

-- Statistics Update
ANALYZE pattern_performance;
ANALYZE ml_predictions;
ANALYZE fantasy_betting_insights;
ANALYZE games;
ANALYZE player_game_logs;
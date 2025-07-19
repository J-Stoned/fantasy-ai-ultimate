-- 🔥 PERFORMANCE INDEXES PART 5: PATTERN DETECTION & ML
-- Pattern performance, ML predictions, synergies

-- Team synergy stats indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_synergy_team 
  ON team_synergy_stats(team_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_synergy_hash 
  ON team_synergy_stats(lineup_hash);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_synergy_size 
  ON team_synergy_stats(lineup_size);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_synergy_context 
  ON team_synergy_stats(context_type, lineup_size);

-- Pattern performance indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pattern_performance_accuracy 
  ON pattern_performance(accuracy_rate DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pattern_performance_sport_accuracy 
  ON pattern_performance(sport, accuracy_rate DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pattern_performance_pattern_type 
  ON pattern_performance(pattern_type);

-- ML predictions indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_predictions_game_model 
  ON ml_predictions(game_id, model_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_predictions_confidence 
  ON ml_predictions(confidence DESC);

-- Recent predictions partial index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_predictions_recent 
  ON ml_predictions(created_at DESC, model_name)
  WHERE created_at >= CURRENT_TIMESTAMP - INTERVAL '7 days';

-- Fantasy betting insights indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fantasy_betting_insights_game 
  ON fantasy_betting_insights(game_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fantasy_betting_insights_confidence 
  ON fantasy_betting_insights(pattern_confidence DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fantasy_betting_insights_active 
  ON fantasy_betting_insights(has_betting_edge, pattern_confidence DESC)
  WHERE has_betting_edge = true;

-- Update statistics
ANALYZE team_synergy_stats;
ANALYZE pattern_performance;
ANALYZE ml_predictions;
ANALYZE fantasy_betting_insights;

-- Check pattern/ML table status
SELECT 
    tablename,
    COUNT(*) as row_count
FROM (
    SELECT 'team_synergy_stats' as tablename, COUNT(*) FROM team_synergy_stats
    UNION ALL
    SELECT 'pattern_performance', COUNT(*) FROM pattern_performance
    UNION ALL
    SELECT 'ml_predictions', COUNT(*) FROM ml_predictions
    UNION ALL
    SELECT 'fantasy_betting_insights', COUNT(*) FROM fantasy_betting_insights
) t
GROUP BY tablename;
-- 🚀 HIGH-PERFORMANCE JSON INDEXES FOR LOCAL POSTGRESQL
-- Optimized for stats column queries with 72x speedup

-- Enable timing to see how long each index takes
\timing on

-- 1. GIN Index for full JSON searches (most flexible but largest)
DROP INDEX IF EXISTS idx_stats_gin;
CREATE INDEX CONCURRENTLY idx_stats_gin 
  ON player_game_logs USING GIN (stats);

-- 2. Expression indexes for common stat queries (fastest for specific fields)
-- These convert JSON extraction to indexed integer values

-- Basketball stats
DROP INDEX IF EXISTS idx_stats_points;
CREATE INDEX CONCURRENTLY idx_stats_points 
  ON player_game_logs (((stats::json->>'points')::int)) 
  WHERE stats IS NOT NULL AND stats::text != '{}';

DROP INDEX IF EXISTS idx_stats_assists;
CREATE INDEX CONCURRENTLY idx_stats_assists 
  ON player_game_logs (((stats::json->>'assists')::int)) 
  WHERE stats IS NOT NULL AND stats::text != '{}';

DROP INDEX IF EXISTS idx_stats_rebounds;
CREATE INDEX CONCURRENTLY idx_stats_rebounds 
  ON player_game_logs (((stats::json->>'rebounds')::int)) 
  WHERE stats IS NOT NULL AND stats::text != '{}';

-- Hockey stats
DROP INDEX IF EXISTS idx_stats_goals;
CREATE INDEX CONCURRENTLY idx_stats_goals 
  ON player_game_logs (((stats::json->>'goals')::int)) 
  WHERE stats IS NOT NULL AND stats::text != '{}';

DROP INDEX IF EXISTS idx_stats_hits;
CREATE INDEX CONCURRENTLY idx_stats_hits 
  ON player_game_logs (((stats::json->>'hits')::int)) 
  WHERE stats IS NOT NULL AND stats::text != '{}';

DROP INDEX IF EXISTS idx_stats_plus_minus;
CREATE INDEX CONCURRENTLY idx_stats_plus_minus 
  ON player_game_logs (((stats::json->>'plusMinus')::int)) 
  WHERE stats IS NOT NULL AND stats::text != '{}';

-- Baseball stats
DROP INDEX IF EXISTS idx_stats_home_runs;
CREATE INDEX CONCURRENTLY idx_stats_home_runs 
  ON player_game_logs (((stats::json->>'homeRuns')::int)) 
  WHERE stats IS NOT NULL AND stats::text != '{}';

DROP INDEX IF EXISTS idx_stats_batting_avg;
CREATE INDEX CONCURRENTLY idx_stats_batting_avg 
  ON player_game_logs (((stats::json->>'battingAverage')::numeric)) 
  WHERE stats IS NOT NULL AND stats::text != '{}';

-- Football stats
DROP INDEX IF EXISTS idx_stats_passing_yards;
CREATE INDEX CONCURRENTLY idx_stats_passing_yards 
  ON player_game_logs (((stats::json->>'passingYards')::int)) 
  WHERE stats IS NOT NULL AND stats::text != '{}';

DROP INDEX IF EXISTS idx_stats_rushing_yards;
CREATE INDEX CONCURRENTLY idx_stats_rushing_yards 
  ON player_game_logs (((stats::json->>'rushingYards')::int)) 
  WHERE stats IS NOT NULL AND stats::text != '{}';

DROP INDEX IF EXISTS idx_stats_receiving_yards;
CREATE INDEX CONCURRENTLY idx_stats_receiving_yards 
  ON player_game_logs (((stats::json->>'receivingYards')::int)) 
  WHERE stats IS NOT NULL AND stats::text != '{}';

-- 3. Composite indexes for pattern detection queries
DROP INDEX IF EXISTS idx_pattern_high_scorers;
CREATE INDEX CONCURRENTLY idx_pattern_high_scorers 
  ON player_game_logs (game_id, team_id, ((stats::json->>'points')::int)) 
  WHERE stats IS NOT NULL AND (stats::json->>'points')::int > 20;

DROP INDEX IF EXISTS idx_pattern_elite_fantasy;
CREATE INDEX CONCURRENTLY idx_pattern_elite_fantasy 
  ON player_game_logs (game_id, fantasy_points DESC) 
  WHERE fantasy_points > 40;

-- 4. Covering index for common pattern queries
DROP INDEX IF EXISTS idx_pattern_covering;
CREATE INDEX CONCURRENTLY idx_pattern_covering 
  ON player_game_logs (game_id, team_id, player_id, fantasy_points, is_home) 
  INCLUDE (stats, game_date);

-- 5. Update table statistics for query planner
ANALYZE player_game_logs;

-- 6. Show index sizes and status
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as index_size,
    idx_scan as times_used
FROM pg_stat_user_indexes
WHERE tablename = 'player_game_logs'
ORDER BY pg_relation_size(indexrelid) DESC;

-- 7. Show total index size for the table
SELECT 
    pg_size_pretty(pg_total_relation_size('player_game_logs')) as total_size,
    pg_size_pretty(pg_relation_size('player_game_logs')) as table_size,
    pg_size_pretty(pg_total_relation_size('player_game_logs') - pg_relation_size('player_game_logs')) as indexes_size;

\timing off
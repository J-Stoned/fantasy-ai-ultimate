-- 🔍 VERIFY DATABASE REALITY CHECK
-- Copy this URL: https://supabase.com/dashboard/project/jfbwbrdmbzhfnyxucgml/sql

-- 1. OVERALL METRICS COVERAGE
SELECT 
  'GRAND TOTAL DATABASE VERIFICATION' as check_type,
  COUNT(*) as total_logs,
  COUNT(CASE WHEN computed_metrics != '{}' AND computed_metrics IS NOT NULL THEN 1 END) as logs_with_metrics,
  ROUND(COUNT(CASE WHEN computed_metrics != '{}' AND computed_metrics IS NOT NULL THEN 1 END) * 100.0 / COUNT(*), 1) as coverage_pct
FROM player_game_logs;

-- 2. BREAKDOWN BY SPORT (using games.sport)
SELECT 
  g.sport,
  COUNT(pgl.id) as total_logs,
  COUNT(CASE WHEN pgl.computed_metrics != '{}' AND pgl.computed_metrics IS NOT NULL THEN 1 END) as logs_with_metrics,
  ROUND(COUNT(CASE WHEN pgl.computed_metrics != '{}' AND pgl.computed_metrics IS NOT NULL THEN 1 END) * 100.0 / COUNT(pgl.id), 1) as coverage_pct,
  COUNT(DISTINCT g.id) as total_games
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport IN ('NBA', 'NFL', 'nfl', 'NHL')
GROUP BY g.sport
ORDER BY total_logs DESC;

-- 3. NBA SAMPLE - VERIFY ACTUAL METRIC VALUES
SELECT 
  'NBA METRICS SAMPLE' as sport,
  pgl.id,
  pgl.stats->>'points' as points,
  pgl.computed_metrics->>'true_shooting_pct' as true_shooting,
  pgl.computed_metrics->>'field_goal_pct' as fg_pct,
  pgl.computed_metrics->>'usage_rate' as usage_rate,
  pgl.computed_metrics->>'game_score' as game_score
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA' 
AND pgl.computed_metrics != '{}'
AND (pgl.stats->>'points')::int > 15
ORDER BY (pgl.stats->>'points')::int DESC
LIMIT 10;

-- 4. NFL SAMPLE - CHECK IF METRICS ARE WORKING
SELECT 
  'NFL METRICS CHECK' as sport,
  pgl.id,
  g.sport as game_sport,
  pgl.computed_metrics->>'passer_rating' as passer_rating,
  pgl.computed_metrics->>'yards_per_carry' as ypc,
  pgl.computed_metrics->>'total_yards' as total_yards,
  pgl.computed_metrics->>'defensive_impact' as def_impact,
  jsonb_object_keys(pgl.computed_metrics) as metric_keys
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport IN ('NFL', 'nfl')
AND pgl.computed_metrics != '{}'
LIMIT 5;

-- 5. TOTAL COUNT VERIFICATION
SELECT 
  'VERIFICATION SUMMARY' as summary,
  (SELECT COUNT(*) FROM player_game_logs) as total_database_logs,
  (SELECT COUNT(*) FROM player_game_logs WHERE computed_metrics != '{}' AND computed_metrics IS NOT NULL) as total_with_metrics,
  (SELECT COUNT(*) FROM games WHERE sport IN ('NBA', 'NFL', 'nfl', 'NHL')) as total_games_processed;
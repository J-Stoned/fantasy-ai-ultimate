-- 🔍 VERIFY NBA METRICS ARE WORKING (Blue URL for Supabase)
-- Copy this URL: https://supabase.com/dashboard/project/jfbwbrdmbzhfnyxucgml/sql

-- Check sample NBA metrics with manual verification
SELECT 
  'NBA Metrics Verification' as check_type,
  pgl.id,
  stats->>'points' as points,
  stats->>'fieldGoalsAttempted' as fga,
  stats->>'fieldGoalsMade' as fgm,
  stats->>'minutes' as minutes,
  
  -- Calculated metrics
  computed_metrics->>'true_shooting_pct' as calculated_ts,
  computed_metrics->>'field_goal_pct' as calculated_fg,
  computed_metrics->>'usage_rate' as usage_rate,
  computed_metrics->>'game_score' as game_score,
  
  -- Manual verification
  CASE 
    WHEN (stats->>'fieldGoalsAttempted')::float > 0 
    THEN ROUND((stats->>'fieldGoalsMade')::float / (stats->>'fieldGoalsAttempted')::float, 3)
    ELSE 0 
  END as manual_fg_pct,
  
  CASE 
    WHEN ((stats->>'fieldGoalsAttempted')::float + 0.44 * (stats->>'freeThrowsAttempted')::float) > 0
    THEN ROUND((stats->>'points')::float / (2 * ((stats->>'fieldGoalsAttempted')::float + 0.44 * (stats->>'freeThrowsAttempted')::float)), 3)
    ELSE 0
  END as manual_ts_pct
  
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND (stats->>'points')::int > 10
AND computed_metrics != '{}'
ORDER BY (stats->>'points')::int DESC
LIMIT 10;

-- Aggregate statistics
SELECT 
  'NBA Aggregate Stats' as summary,
  COUNT(*) as total_logs_with_metrics,
  COUNT(CASE WHEN (computed_metrics->>'true_shooting_pct')::float > 0 THEN 1 END) as non_zero_ts,
  COUNT(CASE WHEN (computed_metrics->>'field_goal_pct')::float > 0 THEN 1 END) as non_zero_fg,
  ROUND(AVG((computed_metrics->>'true_shooting_pct')::float) FILTER (WHERE (computed_metrics->>'true_shooting_pct')::float > 0), 3) as avg_true_shooting,
  ROUND(AVG((computed_metrics->>'field_goal_pct')::float) FILTER (WHERE (computed_metrics->>'field_goal_pct')::float > 0), 3) as avg_field_goal_pct,
  ROUND((COUNT(CASE WHEN (computed_metrics->>'true_shooting_pct')::float > 0 THEN 1 END) * 100.0 / COUNT(*)), 1) as pct_with_ts_data
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND computed_metrics != '{}';

-- Check for any remaining zeros
SELECT 
  'Zero Metrics Check' as check_type,
  COUNT(*) as total_nba_logs,
  COUNT(CASE WHEN computed_metrics = '{}' THEN 1 END) as empty_metrics,
  COUNT(CASE WHEN (computed_metrics->>'true_shooting_pct')::float = 0 THEN 1 END) as zero_ts,
  COUNT(CASE WHEN (computed_metrics->>'field_goal_pct')::float = 0 THEN 1 END) as zero_fg
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA';
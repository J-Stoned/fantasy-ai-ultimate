-- First, let's see what's causing the NULL sports
SELECT 
  COUNT(*) as null_sport_games,
  COUNT(DISTINCT pgl.game_id) as unique_games,
  MIN(pgl.game_date) as earliest_date,
  MAX(pgl.game_date) as latest_date
FROM player_game_logs pgl
LEFT JOIN games g ON pgl.game_id = g.id
WHERE g.sport IS NULL;

-- Check if games table is missing sport data
SELECT 
  COUNT(*) as games_without_sport
FROM games 
WHERE sport IS NULL OR sport = '';

-- Let's check what sports we actually have
SELECT 
  COALESCE(g.sport, 'NULL') as sport,
  COUNT(*) as log_count,
  COUNT(CASE WHEN pgl.computed_metrics != '{}' THEN 1 END) as metrics_filled
FROM player_game_logs pgl
LEFT JOIN games g ON pgl.game_id = g.id
GROUP BY g.sport
ORDER BY log_count DESC;

-- Sample of NBA metrics to verify they're working
SELECT 
  pgl.computed_metrics->>'true_shooting_pct' as true_shooting,
  pgl.computed_metrics->>'field_goal_pct' as fg_pct,
  pgl.computed_metrics->>'usage_rate' as usage_rate,
  pgl.computed_metrics->>'game_score' as game_score,
  COUNT(*) as count_with_these_values
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND pgl.computed_metrics != '{}'
GROUP BY 
  pgl.computed_metrics->>'true_shooting_pct',
  pgl.computed_metrics->>'field_goal_pct',
  pgl.computed_metrics->>'usage_rate',
  pgl.computed_metrics->>'game_score'
ORDER BY count_with_these_values DESC
LIMIT 10;

-- Check if we have actual calculated values (not zeros)
SELECT 
  'NBA Metrics Check' as check_type,
  AVG((pgl.computed_metrics->>'true_shooting_pct')::float) as avg_true_shooting,
  AVG((pgl.computed_metrics->>'field_goal_pct')::float) as avg_fg_pct,
  COUNT(CASE WHEN (pgl.computed_metrics->>'true_shooting_pct')::float > 0 THEN 1 END) as non_zero_ts,
  COUNT(*) as total_with_metrics
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND pgl.computed_metrics != '{}';

-- Fix NULL sports if possible (update games without sport set)
-- This is just to show what we'd need to fix
SELECT 
  'Games needing sport assignment' as issue,
  COUNT(*) as count
FROM games 
WHERE sport IS NULL OR sport = '';
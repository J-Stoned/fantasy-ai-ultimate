-- Check the results of the backfill

-- 1. Overall status by sport
SELECT 
  g.sport,
  COUNT(*) as total_logs,
  COUNT(CASE WHEN pgl.computed_metrics = '{}' THEN 1 END) as empty_metrics,
  COUNT(CASE WHEN pgl.computed_metrics != '{}' THEN 1 END) as filled_metrics,
  ROUND(100.0 * COUNT(CASE WHEN pgl.computed_metrics != '{}' THEN 1 END) / COUNT(*), 1) as pct_filled
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
GROUP BY g.sport
ORDER BY g.sport;

-- 2. Sample of populated NBA metrics
SELECT 
  pgl.player_id,
  p.name as player_name,
  pgl.game_date,
  jsonb_pretty(pgl.computed_metrics) as metrics,
  pgl.stats->>'points' as points,
  pgl.minutes_played
FROM player_game_logs pgl
JOIN players p ON pgl.player_id = p.id
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND pgl.computed_metrics != '{}'
AND pgl.computed_metrics IS NOT NULL
ORDER BY pgl.game_date DESC
LIMIT 5;

-- 3. Check average number of metrics per sport
SELECT 
  g.sport,
  AVG((SELECT COUNT(*) FROM jsonb_object_keys(pgl.computed_metrics))) as avg_metrics_count
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE pgl.computed_metrics != '{}'
GROUP BY g.sport
ORDER BY avg_metrics_count DESC;

-- 4. Sample of actual metric values for verification
SELECT 
  g.sport,
  pgl.computed_metrics->>'true_shooting_pct' as true_shooting,
  pgl.computed_metrics->>'usage_rate' as usage_rate,
  pgl.computed_metrics->>'passer_rating' as passer_rating,
  pgl.computed_metrics->>'ops' as ops,
  COUNT(*) as count
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE pgl.computed_metrics != '{}'
GROUP BY g.sport, 
  pgl.computed_metrics->>'true_shooting_pct',
  pgl.computed_metrics->>'usage_rate',
  pgl.computed_metrics->>'passer_rating',
  pgl.computed_metrics->>'ops'
LIMIT 20;
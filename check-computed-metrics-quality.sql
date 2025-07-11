-- Check what's actually in computed_metrics

-- 1. Sample NBA computed_metrics
SELECT 
  'NBA Sample' as check_type,
  player_id,
  game_date,
  computed_metrics,
  jsonb_pretty(computed_metrics) as pretty_metrics
FROM player_game_logs
WHERE computed_metrics IS NOT NULL
AND computed_metrics != '{}'
AND player_id IN (SELECT id FROM players WHERE sport = 'NBA')
LIMIT 3;

-- 2. Check if computed_metrics are empty
SELECT 
  g.sport,
  COUNT(*) as total_logs,
  COUNT(CASE WHEN pgl.computed_metrics = '{}' THEN 1 END) as empty_metrics,
  COUNT(CASE WHEN pgl.computed_metrics != '{}' THEN 1 END) as has_metrics,
  ROUND(100.0 * COUNT(CASE WHEN pgl.computed_metrics != '{}' THEN 1 END) / COUNT(*), 1) as pct_with_data
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
GROUP BY g.sport
ORDER BY g.sport;

-- 3. Sample of what's in each JSONB column for NBA
SELECT 
  'JSONB Column Contents' as check_type,
  COUNT(CASE WHEN pgl.raw_stats != '{}' THEN 1 END) as raw_stats_filled,
  COUNT(CASE WHEN pgl.computed_metrics != '{}' THEN 1 END) as computed_filled,
  COUNT(CASE WHEN pgl.tracking_data != '{}' THEN 1 END) as tracking_filled,
  COUNT(CASE WHEN pgl.situational_stats != '{}' THEN 1 END) as situational_filled,
  COUNT(CASE WHEN pgl.play_by_play_stats != '{}' THEN 1 END) as pbp_filled,
  COUNT(CASE WHEN pgl.matchup_stats != '{}' THEN 1 END) as matchup_filled,
  COUNT(CASE WHEN pgl.metadata != '{}' THEN 1 END) as metadata_filled,
  COUNT(CASE WHEN pgl.quality_metrics != '{}' THEN 1 END) as quality_filled
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA';

-- 4. Show a sample of what metrics exist
SELECT DISTINCT 
  g.sport,
  jsonb_object_keys(pgl.computed_metrics) as metric_name
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE pgl.computed_metrics != '{}'
AND g.sport IN ('NBA', 'NFL', 'MLB')
GROUP BY g.sport, metric_name
ORDER BY g.sport, metric_name
LIMIT 50;
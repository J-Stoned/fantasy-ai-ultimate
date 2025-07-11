-- Let's see the ACTUAL stats format for NBA to fix the calculator

-- 1. Show raw stats structure for NBA
SELECT 
  'NBA Raw Stats Sample' as check_type,
  jsonb_pretty(stats) as raw_stats,
  minutes_played
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND stats IS NOT NULL
AND stats != '{}'
LIMIT 3;

-- 2. Show all available keys in NBA stats
SELECT DISTINCT 
  'NBA Stats Keys' as type,
  jsonb_object_keys(stats) as available_keys
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND stats IS NOT NULL
AND stats != '{}'
ORDER BY available_keys;

-- 3. Show specific values to understand the data
SELECT 
  'NBA Sample Values' as type,
  stats->>'0' as pos_0,
  stats->>'1' as pos_1,
  stats->>'2' as pos_2,
  stats->>'points' as points_field,
  stats->>'pts' as pts_field,
  stats->>'PTS' as PTS_field,
  jsonb_object_keys(stats) as all_keys
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND stats IS NOT NULL
AND stats != '{}'
LIMIT 5;

-- 4. Check if stats are stored as arrays instead of objects
SELECT 
  'NBA Stats Structure' as type,
  jsonb_typeof(stats) as stats_type,
  CASE 
    WHEN jsonb_typeof(stats) = 'array' THEN jsonb_array_length(stats)
    WHEN jsonb_typeof(stats) = 'object' THEN jsonb_array_length(jsonb_object_keys(stats))
    ELSE 0
  END as element_count,
  stats
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND stats IS NOT NULL
AND stats != '{}'
LIMIT 5;
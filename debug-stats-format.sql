-- Debug: Check what's actually in the stats column

-- 1. Sample raw stats data for NBA
SELECT 
  player_id,
  game_date,
  stats,
  jsonb_pretty(stats) as pretty_stats,
  minutes_played
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND stats IS NOT NULL
AND stats != '{}'
LIMIT 5;

-- 2. Check what keys exist in NBA stats
SELECT DISTINCT 
  jsonb_object_keys(stats) as stat_key
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND stats IS NOT NULL
AND stats != '{}'
ORDER BY stat_key;

-- 3. Sample specific stat values
SELECT 
  stats->>'points' as points,
  stats->>'fg_made' as fg_made,
  stats->>'fg_attempted' as fg_attempted,
  stats->>'assists' as assists,
  stats->>'turnovers' as turnovers,
  stats->>'rebounds' as rebounds,
  COUNT(*) as count
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id  
WHERE g.sport = 'NBA'
AND stats IS NOT NULL
GROUP BY 
  stats->>'points',
  stats->>'fg_made',
  stats->>'fg_attempted',
  stats->>'assists',
  stats->>'turnovers',
  stats->>'rebounds'
LIMIT 20;
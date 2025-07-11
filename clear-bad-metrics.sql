-- Clear the incorrectly calculated metrics (all zeros)
-- This will reset them so we can recalculate with correct field names

UPDATE player_game_logs pgl
SET computed_metrics = '{}'
FROM games g
WHERE pgl.game_id = g.id
AND g.sport = 'NBA'
AND pgl.computed_metrics->>'true_shooting_pct' = '0'
AND pgl.computed_metrics->>'usage_rate' = '0'
AND pgl.computed_metrics != '{}';

-- Check how many were reset
SELECT COUNT(*) as reset_count
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND pgl.computed_metrics = '{}';
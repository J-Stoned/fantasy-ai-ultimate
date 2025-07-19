-- CLEANUP NCAA HOCKEY IN BATCHES
-- Process 50 at a time to avoid timeouts

BEGIN;

-- Create temp table with 50 duplicate groups
CREATE TEMP TABLE ncaa_hky_batch AS
SELECT 
  MIN(id) as keep_id,
  array_agg(id ORDER BY id) as all_ids
FROM games
WHERE sport = 'NCAA_HKY'
  AND home_team_id IS NOT NULL 
  AND away_team_id IS NOT NULL
GROUP BY home_team_id, away_team_id, DATE(start_time)
HAVING COUNT(*) > 1
LIMIT 50;

-- Delete from all referencing tables
DELETE FROM player_game_logs 
WHERE game_id IN (
  SELECT unnest(all_ids) as game_id
  FROM ncaa_hky_batch
) AND game_id NOT IN (
  SELECT keep_id FROM ncaa_hky_batch
);

DELETE FROM advanced_player_metrics 
WHERE game_id IN (
  SELECT unnest(all_ids) as game_id
  FROM ncaa_hky_batch
) AND game_id NOT IN (
  SELECT keep_id FROM ncaa_hky_batch
);

DELETE FROM betting_lines 
WHERE game_id IN (
  SELECT unnest(all_ids) as game_id
  FROM ncaa_hky_batch
) AND game_id NOT IN (
  SELECT keep_id FROM ncaa_hky_batch
);

DELETE FROM weather_data 
WHERE game_id IN (
  SELECT unnest(all_ids) as game_id
  FROM ncaa_hky_batch
) AND game_id NOT IN (
  SELECT keep_id FROM ncaa_hky_batch
);

-- Delete the games
DELETE FROM games 
WHERE id IN (
  SELECT unnest(all_ids) as game_id
  FROM ncaa_hky_batch
) AND id NOT IN (
  SELECT keep_id FROM ncaa_hky_batch
);

DROP TABLE ncaa_hky_batch;

-- Check progress
SELECT 'NCAA_HKY progress:' as status;
SELECT COUNT(*) as remaining_duplicates
FROM (
  SELECT home_team_id, away_team_id, DATE(start_time)
  FROM games
  WHERE sport = 'NCAA_HKY'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t;

COMMIT;

-- Run this script ~7 times (314 / 50) until remaining = 0
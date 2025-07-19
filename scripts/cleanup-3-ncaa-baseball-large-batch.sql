-- CLEANUP NCAA BASEBALL DUPLICATES - LARGE BATCHES
-- Process 250 at a time (most duplicates)

BEGIN;

-- Set a reasonable timeout
SET LOCAL statement_timeout = '10min';

-- Create temp table with 250 duplicate groups
CREATE TEMP TABLE ncaa_bb_batch AS
SELECT 
  MIN(id) as keep_id,
  array_agg(id ORDER BY id) as all_ids
FROM games
WHERE sport = 'NCAA_BASEBALL'
  AND home_team_id IS NOT NULL 
  AND away_team_id IS NOT NULL
GROUP BY home_team_id, away_team_id, DATE(start_time)
HAVING COUNT(*) > 1
LIMIT 250;  -- Even bigger batch for NCAA Baseball

-- Show what we're processing
SELECT 'Processing NCAA_BASEBALL duplicates:' as info, COUNT(*) as batch_size FROM ncaa_bb_batch;

-- Delete from all referencing tables
DELETE FROM player_game_logs 
WHERE game_id IN (
  SELECT unnest(all_ids) as game_id
  FROM ncaa_bb_batch
) AND game_id NOT IN (
  SELECT keep_id FROM ncaa_bb_batch
);

DELETE FROM player_stats 
WHERE game_id IN (
  SELECT unnest(all_ids) as game_id
  FROM ncaa_bb_batch
) AND game_id NOT IN (
  SELECT keep_id FROM ncaa_bb_batch
);

DELETE FROM advanced_player_metrics 
WHERE game_id IN (
  SELECT unnest(all_ids) as game_id
  FROM ncaa_bb_batch
) AND game_id NOT IN (
  SELECT keep_id FROM ncaa_bb_batch
);

DELETE FROM betting_lines 
WHERE game_id IN (
  SELECT unnest(all_ids) as game_id
  FROM ncaa_bb_batch
) AND game_id NOT IN (
  SELECT keep_id FROM ncaa_bb_batch
);

DELETE FROM weather_data 
WHERE game_id IN (
  SELECT unnest(all_ids) as game_id
  FROM ncaa_bb_batch
) AND game_id NOT IN (
  SELECT keep_id FROM ncaa_bb_batch
);

-- Delete the games
DELETE FROM games 
WHERE id IN (
  SELECT unnest(all_ids) as game_id
  FROM ncaa_bb_batch
) AND id NOT IN (
  SELECT keep_id FROM ncaa_bb_batch
);

DROP TABLE ncaa_bb_batch;

-- Check progress
SELECT 'NCAA_BASEBALL progress:' as status;
SELECT COUNT(*) as remaining_duplicates
FROM (
  SELECT home_team_id, away_team_id, DATE(start_time)
  FROM games
  WHERE sport = 'NCAA_BASEBALL'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t;

COMMIT;

-- Run this script ~6 times (1353 / 250) until remaining = 0
-- CLEANUP MLB DUPLICATES IN BATCHES
-- Handle 1044 MLB duplicates, 50 at a time

BEGIN;

-- Set timeout for safety
SET LOCAL statement_timeout = '5min';

-- Process 50 duplicate groups at a time
WITH dup_groups AS (
  SELECT 
    home_team_id,
    away_team_id,
    DATE(start_time) as game_date,
    array_agg(id ORDER BY id DESC) as game_ids  -- DESC so we can pop the last one
  FROM games
  WHERE sport = 'MLB'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
  LIMIT 50
),
games_to_delete AS (
  SELECT unnest(game_ids[2:array_length(game_ids, 1)]) as game_id
  FROM dup_groups
)
-- Delete stats first
DELETE FROM player_game_logs 
WHERE game_id IN (SELECT game_id FROM games_to_delete);

-- Delete the duplicate games
WITH dup_groups AS (
  SELECT 
    home_team_id,
    away_team_id,
    DATE(start_time) as game_date,
    array_agg(id ORDER BY id DESC) as game_ids
  FROM games
  WHERE sport = 'MLB'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
  LIMIT 50
),
games_to_delete AS (
  SELECT unnest(game_ids[2:array_length(game_ids, 1)]) as game_id
  FROM dup_groups
)
DELETE FROM games 
WHERE id IN (SELECT game_id FROM games_to_delete);

-- Check progress
SELECT 'MLB cleanup progress:' as status;
SELECT COUNT(*) as remaining_duplicates
FROM (
  SELECT home_team_id, away_team_id, DATE(start_time)
  FROM games
  WHERE sport = 'MLB'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t;

COMMIT;

-- Note: Run this script ~21 times (1044 / 50) until remaining_duplicates = 0
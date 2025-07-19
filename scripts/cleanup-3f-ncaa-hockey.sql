-- CLEANUP NCAA HOCKEY DUPLICATES
-- Handle 314 NCAA Hockey duplicates

BEGIN;

-- Process in batches to avoid timeout
-- First batch: Delete stats from duplicate games (keeping MIN game_id)
DELETE FROM player_game_logs 
WHERE game_id IN (
  WITH dup_games AS (
    SELECT 
      MIN(id) as keep_id,
      array_agg(id ORDER BY id) as all_ids
    FROM games
    WHERE sport = 'NCAA_HKY'
      AND home_team_id IS NOT NULL 
      AND away_team_id IS NOT NULL
    GROUP BY home_team_id, away_team_id, DATE(start_time)
    HAVING COUNT(*) > 1
    LIMIT 100  -- Process 100 at a time
  )
  SELECT unnest(all_ids) 
  FROM dup_games
  WHERE unnest(all_ids) != keep_id
);

-- Delete the games themselves
DELETE FROM games 
WHERE id IN (
  WITH dup_games AS (
    SELECT 
      MIN(id) as keep_id,
      array_agg(id ORDER BY id) as all_ids
    FROM games
    WHERE sport = 'NCAA_HKY'
      AND home_team_id IS NOT NULL 
      AND away_team_id IS NOT NULL
    GROUP BY home_team_id, away_team_id, DATE(start_time)
    HAVING COUNT(*) > 1
    LIMIT 100
  )
  SELECT unnest(all_ids) 
  FROM dup_games
  WHERE unnest(all_ids) != keep_id
);

-- Check progress
SELECT 'NCAA_HKY cleanup progress:' as status;
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

-- Note: Run this script multiple times until remaining_duplicates = 0
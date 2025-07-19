-- 🏀 STEP 2B: MERGE REMAINING DUPLICATE TEAMS
-- Process remaining duplicates (teams with exactly 2 copies)

BEGIN;

-- Check remaining duplicates
WITH duplicate_counts AS (
  SELECT name, sport, COUNT(*) as count
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) = 2  -- Only exact duplicates
)
SELECT COUNT(*) as duplicate_pairs FROM duplicate_counts;

-- Process exact duplicates (much simpler)
WITH duplicate_pairs AS (
  SELECT 
    name, 
    sport,
    MIN(id) as keep_id,
    MAX(id) as remove_id
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) = 2
)
-- Update all references in one go
UPDATE players 
SET team_id = dp.keep_id
FROM duplicate_pairs dp
WHERE players.team_id = dp.remove_id;

WITH duplicate_pairs AS (
  SELECT 
    name, 
    sport,
    MIN(id) as keep_id,
    MAX(id) as remove_id
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) = 2
)
UPDATE games 
SET home_team_id = dp.keep_id
FROM duplicate_pairs dp
WHERE games.home_team_id = dp.remove_id;

WITH duplicate_pairs AS (
  SELECT 
    name, 
    sport,
    MIN(id) as keep_id,
    MAX(id) as remove_id
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) = 2
)
UPDATE games 
SET away_team_id = dp.keep_id
FROM duplicate_pairs dp
WHERE games.away_team_id = dp.remove_id;

WITH duplicate_pairs AS (
  SELECT 
    name, 
    sport,
    MIN(id) as keep_id,
    MAX(id) as remove_id
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) = 2
)
UPDATE player_game_logs 
SET opponent_id = dp.keep_id
FROM duplicate_pairs dp
WHERE player_game_logs.opponent_id = dp.remove_id;

-- Delete the duplicates
WITH duplicate_pairs AS (
  SELECT 
    name, 
    sport,
    MIN(id) as keep_id,
    MAX(id) as remove_id
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) = 2
)
DELETE FROM teams 
WHERE id IN (SELECT remove_id FROM duplicate_pairs);

-- Final check
SELECT 'Final duplicate count:' as status;
SELECT COUNT(*) as remaining_duplicates
FROM (
  SELECT name, sport
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) > 1
) t;

COMMIT;
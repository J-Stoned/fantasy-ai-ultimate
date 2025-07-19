-- CLEANUP SMALL SPORTS DUPLICATES (NBA, NHL, MILB) - SAFE VERSION
-- Handles all foreign key constraints

BEGIN;

-- NBA (1 duplicate)
-- First delete from all referencing tables
DELETE FROM player_game_logs 
WHERE game_id IN (
  SELECT MAX(id)
  FROM games
  WHERE sport = 'NBA'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
);

DELETE FROM advanced_player_metrics 
WHERE game_id IN (
  SELECT MAX(id)
  FROM games
  WHERE sport = 'NBA'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
);

DELETE FROM games 
WHERE id IN (
  SELECT MAX(id)
  FROM games
  WHERE sport = 'NBA'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
);

-- NHL (10 duplicates)
DELETE FROM player_game_logs 
WHERE game_id IN (
  SELECT MAX(id)
  FROM games
  WHERE sport = 'NHL'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
);

DELETE FROM advanced_player_metrics 
WHERE game_id IN (
  SELECT MAX(id)
  FROM games
  WHERE sport = 'NHL'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
);

DELETE FROM games 
WHERE id IN (
  SELECT MAX(id)
  FROM games
  WHERE sport = 'NHL'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
);

-- MILB (3 duplicates)
DELETE FROM player_game_logs 
WHERE game_id IN (
  SELECT MAX(id)
  FROM games
  WHERE sport = 'MILB'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
);

DELETE FROM advanced_player_metrics 
WHERE game_id IN (
  SELECT MAX(id)
  FROM games
  WHERE sport = 'MILB'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
);

DELETE FROM games 
WHERE id IN (
  SELECT MAX(id)
  FROM games
  WHERE sport = 'MILB'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
);

-- Check results
SELECT 'Cleaned up NBA, NHL, MILB. Remaining:' as status;
SELECT sport, COUNT(*) as duplicates
FROM (
  SELECT sport, home_team_id, away_team_id, DATE(start_time)
  FROM games
  WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
    AND sport IN ('NBA', 'NHL', 'MILB')
  GROUP BY sport, home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t
GROUP BY sport;

COMMIT;
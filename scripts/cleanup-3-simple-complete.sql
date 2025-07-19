-- SIMPLE COMPLETE GAME CLEANUP
-- Direct SQL without functions

BEGIN;

-- NBA cleanup
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

DELETE FROM betting_lines 
WHERE game_id IN (
  SELECT MAX(id)
  FROM games
  WHERE sport = 'NBA'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
);

DELETE FROM weather_data 
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

-- Check results
SELECT 'NBA cleanup complete' as status;

-- NHL cleanup (same pattern)
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

DELETE FROM betting_lines 
WHERE game_id IN (
  SELECT MAX(id)
  FROM games
  WHERE sport = 'NHL'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
);

DELETE FROM weather_data 
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

SELECT 'NHL cleanup complete' as status;

-- MILB cleanup
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

DELETE FROM betting_lines 
WHERE game_id IN (
  SELECT MAX(id)
  FROM games
  WHERE sport = 'MILB'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
);

DELETE FROM weather_data 
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

SELECT 'MILB cleanup complete' as status;

-- Final check
SELECT 'Remaining duplicates:' as status;
SELECT sport, COUNT(*) as duplicate_groups
FROM (
  SELECT sport, home_team_id, away_team_id, DATE(start_time)
  FROM games
  WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
  GROUP BY sport, home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t
GROUP BY sport
ORDER BY duplicate_groups DESC;

COMMIT;
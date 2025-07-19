-- CLEANUP REMAINING MILB DUPLICATES
-- Handle the last 3 MILB duplicates

BEGIN;

-- Show what we're about to delete
SELECT 'MILB duplicates to clean:' as info;
SELECT 
  g1.id as game1_id,
  g2.id as game2_id,
  ht.name as home_team,
  at.name as away_team,
  DATE(g1.start_time) as game_date
FROM games g1
JOIN games g2 ON 
  g1.home_team_id = g2.home_team_id 
  AND g1.away_team_id = g2.away_team_id
  AND DATE(g1.start_time) = DATE(g2.start_time)
  AND g1.id < g2.id
JOIN teams ht ON ht.id = g1.home_team_id
JOIN teams at ON at.id = g1.away_team_id
WHERE g1.sport = 'MILB';

-- Clean all references for MILB duplicates
WITH games_to_delete AS (
  SELECT MAX(id) as game_id
  FROM games
  WHERE sport = 'MILB'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
)
DELETE FROM player_game_logs WHERE game_id IN (SELECT game_id FROM games_to_delete);

WITH games_to_delete AS (
  SELECT MAX(id) as game_id
  FROM games
  WHERE sport = 'MILB'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
)
DELETE FROM advanced_player_metrics WHERE game_id IN (SELECT game_id FROM games_to_delete);

WITH games_to_delete AS (
  SELECT MAX(id) as game_id
  FROM games
  WHERE sport = 'MILB'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
)
DELETE FROM betting_lines WHERE game_id IN (SELECT game_id FROM games_to_delete);

WITH games_to_delete AS (
  SELECT MAX(id) as game_id
  FROM games
  WHERE sport = 'MILB'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
)
DELETE FROM weather_data WHERE game_id IN (SELECT game_id FROM games_to_delete);

-- Delete the games
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

SELECT 'MILB cleanup complete!' as status;

COMMIT;
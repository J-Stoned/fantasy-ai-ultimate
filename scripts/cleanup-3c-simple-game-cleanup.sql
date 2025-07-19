-- SIMPLE GAME DUPLICATE CLEANUP
-- Just delete games with fewer stats to avoid constraint issues

BEGIN;

-- First, show what duplicates remain
SELECT 'Remaining duplicate games:' as info;
WITH dup_analysis AS (
  SELECT 
    g1.id as game1_id,
    g2.id as game2_id,
    g1.sport,
    ht.name as home_team,
    at.name as away_team,
    DATE(g1.start_time) as game_date,
    (SELECT COUNT(*) FROM player_game_logs WHERE game_id = g1.id) as stats_in_game1,
    (SELECT COUNT(*) FROM player_game_logs WHERE game_id = g2.id) as stats_in_game2
  FROM games g1
  JOIN games g2 ON 
    g1.home_team_id = g2.home_team_id 
    AND g1.away_team_id = g2.away_team_id
    AND DATE(g1.start_time) = DATE(g2.start_time)
    AND g1.id < g2.id
  JOIN teams ht ON ht.id = g1.home_team_id
  JOIN teams at ON at.id = g1.away_team_id
  WHERE g1.home_team_id IS NOT NULL 
    AND g1.away_team_id IS NOT NULL
)
SELECT * FROM dup_analysis
ORDER BY sport, game_date;

-- Simple approach: Delete the game with fewer stats (or higher ID if equal)
-- First delete all stats from the games we're removing
DELETE FROM player_game_logs 
WHERE game_id IN (
  WITH game_pairs AS (
    SELECT 
      g1.id as game1_id,
      g2.id as game2_id,
      (SELECT COUNT(*) FROM player_game_logs WHERE game_id = g1.id) as stats1,
      (SELECT COUNT(*) FROM player_game_logs WHERE game_id = g2.id) as stats2
    FROM games g1
    JOIN games g2 ON 
      g1.home_team_id = g2.home_team_id 
      AND g1.away_team_id = g2.away_team_id
      AND DATE(g1.start_time) = DATE(g2.start_time)
      AND g1.id < g2.id
    WHERE g1.home_team_id IS NOT NULL 
      AND g1.away_team_id IS NOT NULL
  )
  SELECT 
    CASE 
      WHEN stats1 > stats2 THEN game2_id
      WHEN stats2 > stats1 THEN game1_id
      ELSE game2_id  -- If equal stats, keep the lower ID
    END as game_to_delete
  FROM game_pairs
);

-- Now delete the duplicate games
DELETE FROM games 
WHERE id IN (
  WITH game_pairs AS (
    SELECT 
      g1.id as game1_id,
      g2.id as game2_id,
      (SELECT COUNT(*) FROM player_game_logs WHERE game_id = g1.id) as stats1,
      (SELECT COUNT(*) FROM player_game_logs WHERE game_id = g2.id) as stats2
    FROM games g1
    JOIN games g2 ON 
      g1.home_team_id = g2.home_team_id 
      AND g1.away_team_id = g2.away_team_id
      AND DATE(g1.start_time) = DATE(g2.start_time)
      AND g1.id < g2.id
    WHERE g1.home_team_id IS NOT NULL 
      AND g1.away_team_id IS NOT NULL
  )
  SELECT 
    CASE 
      WHEN stats1 > stats2 THEN game2_id
      WHEN stats2 > stats1 THEN game1_id
      ELSE game2_id  -- If equal stats, keep the lower ID
    END as game_to_delete
  FROM game_pairs
);

-- Final verification
SELECT 'After cleanup:' as status;
SELECT COUNT(*) as remaining_duplicates
FROM (
  SELECT home_team_id, away_team_id, DATE(start_time)
  FROM games
  WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t;

COMMIT;
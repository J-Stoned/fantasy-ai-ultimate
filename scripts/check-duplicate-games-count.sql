-- CHECK DUPLICATE GAMES COUNT
-- See how many duplicate games we have before running cleanup

SELECT 'Duplicate games analysis:' as info;

-- Count by sport
WITH dup_games AS (
  SELECT 
    g.sport,
    COUNT(*) as total_games,
    COUNT(DISTINCT CONCAT(g.home_team_id, '_', g.away_team_id, '_', DATE(g.start_time))) as unique_games,
    COUNT(*) - COUNT(DISTINCT CONCAT(g.home_team_id, '_', g.away_team_id, '_', DATE(g.start_time))) as duplicates
  FROM games g
  WHERE g.home_team_id IS NOT NULL 
    AND g.away_team_id IS NOT NULL
    AND g.start_time IS NOT NULL
  GROUP BY g.sport
)
SELECT * FROM dup_games
WHERE duplicates > 0
ORDER BY duplicates DESC;

-- Total duplicate count
SELECT 'Total duplicate games to process:' as info, COUNT(*) as count
FROM (
  SELECT home_team_id, away_team_id, DATE(start_time)
  FROM games
  WHERE home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
    AND start_time IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t;
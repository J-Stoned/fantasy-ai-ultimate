-- CHECK REMAINING DUPLICATES BY SPORT
-- Quick query to see what's left

SELECT sport, COUNT(*) as duplicate_groups
FROM (
  SELECT 
    sport,
    home_team_id,
    away_team_id,
    DATE(start_time) as game_date
  FROM games
  WHERE home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
    AND start_time IS NOT NULL
  GROUP BY sport, home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t
GROUP BY sport
ORDER BY duplicate_groups DESC;
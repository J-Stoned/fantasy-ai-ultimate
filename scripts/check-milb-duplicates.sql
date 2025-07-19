-- Quick check for MILB duplicates
SELECT 'MILB duplicate games:' as info;
SELECT 
  COUNT(*) as duplicate_groups,
  SUM(count) - COUNT(*) as extra_games
FROM (
  SELECT 
    home_team_id,
    away_team_id,
    DATE(start_time) as game_date,
    COUNT(*) as count
  FROM games
  WHERE sport = 'MILB'
    AND home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t;
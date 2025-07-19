-- CHECK REMAINING DUPLICATE TEAMS
-- See if we need to clean up NHL and NCAA teams

SELECT 'Remaining duplicate teams by sport:' as info;
WITH dup_teams AS (
  SELECT 
    sport,
    name,
    COUNT(*) as count
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY sport, name
  HAVING COUNT(*) > 1
)
SELECT 
  sport,
  COUNT(*) as duplicate_groups,
  SUM(count - 1) as extra_teams_to_remove
FROM dup_teams
GROUP BY sport
ORDER BY extra_teams_to_remove DESC;

-- Show specific examples
SELECT 'Example duplicates:' as info;
SELECT sport, name, COUNT(*) as count
FROM teams
WHERE sport IS NOT NULL
GROUP BY sport, name
HAVING COUNT(*) > 1
ORDER BY COUNT(*) DESC
LIMIT 10;
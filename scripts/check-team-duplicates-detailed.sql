-- CHECK TEAM DUPLICATES WITH MORE DETAIL
-- Shows external_id and other details to identify real duplicates vs different teams

-- First, show teams that have the same name within the same sport
SELECT 'Potential duplicate teams (same name, same sport):' as info;
SELECT 
  t.sport,
  t.name,
  t.id,
  t.external_id,
  t.abbreviation,
  COUNT(p.id) as player_count,
  COUNT(DISTINCT g1.id) + COUNT(DISTINCT g2.id) as game_count
FROM teams t
LEFT JOIN players p ON p.team_id = t.id
LEFT JOIN games g1 ON g1.home_team_id = t.id
LEFT JOIN games g2 ON g2.away_team_id = t.id
WHERE t.sport IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM teams t2 
    WHERE t2.name = t.name 
      AND t2.sport = t.sport 
      AND t2.id != t.id
  )
GROUP BY t.sport, t.name, t.id, t.external_id, t.abbreviation
ORDER BY t.sport, t.name, t.id;

-- Check if external_ids are different (indicating different teams)
SELECT '';
SELECT 'Teams with same name but different external_ids (likely different teams):' as info;
WITH name_groups AS (
  SELECT 
    sport,
    name,
    COUNT(DISTINCT external_id) as unique_external_ids,
    array_agg(DISTINCT external_id) as external_ids
  FROM teams
  WHERE sport IS NOT NULL AND external_id IS NOT NULL
  GROUP BY sport, name
  HAVING COUNT(*) > 1 AND COUNT(DISTINCT external_id) > 1
)
SELECT * FROM name_groups
ORDER BY sport, name;

-- Look for true duplicates (same name, same external_id)
SELECT '';
SELECT 'TRUE DUPLICATES (same name, same external_id):' as info;
WITH true_duplicates AS (
  SELECT 
    sport,
    name,
    external_id,
    COUNT(*) as count,
    array_agg(id) as team_ids
  FROM teams
  WHERE sport IS NOT NULL AND external_id IS NOT NULL
  GROUP BY sport, name, external_id
  HAVING COUNT(*) > 1
)
SELECT * FROM true_duplicates
ORDER BY count DESC;

-- Show some specific examples
SELECT '';
SELECT 'Example: All teams with "Wildcats" in name:' as info;
SELECT 
  id,
  sport,
  name,
  external_id,
  abbreviation
FROM teams
WHERE LOWER(name) LIKE '%wildcats%'
ORDER BY sport, name;
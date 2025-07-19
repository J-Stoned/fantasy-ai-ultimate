-- CHECK ID STANDARDIZATION CONFLICTS
-- See what conflicts exist before making changes

-- Check numeric ID conflicts
SELECT 'Numeric ID conflicts in teams:' as info;
SELECT 
  t1.id,
  t1.sport,
  t1.external_id as current_id,
  'espn_' || LOWER(t1.sport) || '_' || t1.external_id as proposed_id,
  t1.name,
  t2.name as conflicting_team
FROM teams t1
LEFT JOIN teams t2 ON t2.external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
WHERE t1.external_id ~ '^[0-9]+$' 
  AND t1.sport IN ('NFL', 'NBA', 'MLB', 'NHL')
  AND t2.id IS NOT NULL;

-- Check NCAA Baseball conflicts
SELECT 'NCAA Baseball ID conflicts:' as info;
SELECT 
  t1.id,
  t1.sport,
  t1.external_id as current_id,
  REPLACE(t1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_') as proposed_id,
  t1.name,
  t2.name as conflicting_with
FROM teams t1
LEFT JOIN teams t2 ON t2.external_id = REPLACE(t1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE t1.sport = 'NCAA_BASEBALL' 
  AND t1.external_id LIKE 'espn_ncaa_%' 
  AND t1.external_id NOT LIKE 'espn_ncaa_baseball_%'
  AND t2.id IS NOT NULL;

-- Same for players
SELECT 'NCAA Baseball player ID conflicts:' as info;
SELECT 
  p1.id,
  p1.sport,
  p1.external_id as current_id,
  REPLACE(p1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_') as proposed_id,
  p1.name,
  p2.name as conflicting_with
FROM players p1
LEFT JOIN players p2 ON p2.external_id = REPLACE(p1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE p1.sport = 'NCAA_BASEBALL' 
  AND p1.external_id LIKE 'espn_ncaa_%' 
  AND p1.external_id NOT LIKE 'espn_ncaa_baseball_%'
  AND p2.id IS NOT NULL
LIMIT 20;

-- Count total issues
SELECT 'Summary of ID issues:' as info;
SELECT 
  'Numeric team IDs' as issue,
  COUNT(*) as count
FROM teams 
WHERE external_id ~ '^[0-9]+$'
UNION ALL
SELECT 
  'NCAA Baseball teams needing fix',
  COUNT(*)
FROM teams
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_%' 
  AND external_id NOT LIKE 'espn_ncaa_baseball_%'
UNION ALL
SELECT 
  'NCAA Baseball players needing fix',
  COUNT(*)
FROM players
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_%' 
  AND external_id NOT LIKE 'espn_ncaa_baseball_%';
-- 🏆 STEP 5: STANDARDIZE ESPN IDS (COMPLETE VERSION)
-- Handles all ID standardization with conflict resolution

BEGIN;

-- 1. First, let's see what college teams are incorrectly marked as pro sports
SELECT 'Finding misclassified college teams...' as info;
SELECT id, name, sport, external_id
FROM teams
WHERE (sport IN ('NBA', 'NFL', 'MLB', 'NHL'))
  AND (
    name LIKE '%University%' OR name LIKE '%College%' OR name LIKE '%State%'
    OR name IN ('UCLA Bruins', 'Auburn Tigers', 'Arkansas Razorbacks', 'USC Trojans',
                'Arizona State Sun Devils', 'UAB Blazers', 'Stanford Cardinal', 
                'UC San Diego Tritons', 'California Golden Bears', 'Boston College Eagles')
  );

-- 2. Fix misclassified college teams
UPDATE teams
SET sport = 'NCAA_BB'
WHERE sport = 'NBA'
  AND (
    name LIKE '%University%' OR name LIKE '%College%' OR name LIKE '%State%'
    OR name IN ('UCLA Bruins', 'Auburn Tigers', 'Arkansas Razorbacks', 'USC Trojans',
                'Arizona State Sun Devils', 'UAB Blazers', 'Stanford Cardinal', 
                'UC San Diego Tritons', 'California Golden Bears', 'Boston College Eagles')
  );

UPDATE teams
SET sport = 'NCAA_FB'
WHERE sport = 'NFL'
  AND (name LIKE '%University%' OR name LIKE '%College%' OR name LIKE '%State%');

-- 3. Now handle numeric IDs - check for conflicts first
SELECT 'Checking numeric ID conflicts...' as info;
WITH conflict_check AS (
  SELECT 
    t1.id,
    t1.name,
    t1.sport,
    t1.external_id,
    'espn_' || LOWER(t1.sport) || '_' || t1.external_id as proposed_id,
    t2.id as conflict_id,
    t2.name as conflict_name
  FROM teams t1
  LEFT JOIN teams t2 ON t2.external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
  WHERE t1.external_id ~ '^[0-9]+$'
)
SELECT * FROM conflict_check WHERE conflict_id IS NOT NULL;

-- 4. For teams with numeric IDs, update only if no conflict
UPDATE teams t1
SET external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
WHERE t1.external_id ~ '^[0-9]+$'
  AND NOT EXISTS (
    SELECT 1 FROM teams t2 
    WHERE t2.external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
    AND t2.id != t1.id
  );

-- 5. Handle players with numeric IDs
UPDATE players p1
SET external_id = 'espn_' || LOWER(p1.sport) || '_' || p1.external_id
WHERE p1.external_id ~ '^[0-9]+$'
  AND p1.sport IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM players p2 
    WHERE p2.external_id = 'espn_' || LOWER(p1.sport) || '_' || p1.external_id
    AND p2.id != p1.id
  );

-- 6. Handle games with numeric IDs
UPDATE games g1
SET external_id = 'espn_' || LOWER(g1.sport) || '_' || g1.external_id
WHERE g1.external_id ~ '^[0-9]+$'
  AND g1.sport IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM games g2 
    WHERE g2.external_id = 'espn_' || LOWER(g1.sport) || '_' || g1.external_id
    AND g2.id != g1.id
  );

-- 7. Fix NCAA Baseball IDs (espn_ncaa_ -> espn_ncaa_baseball_)
-- Check for conflicts first
SELECT 'Checking NCAA Baseball conflicts...' as info;
SELECT COUNT(*) as ncaa_baseball_conflicts
FROM players p1
JOIN players p2 ON p2.external_id = REPLACE(p1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE p1.sport = 'NCAA_BASEBALL' 
  AND p1.external_id LIKE 'espn_ncaa_%' 
  AND p1.external_id NOT LIKE 'espn_ncaa_baseball_%'
  AND p1.id != p2.id;

-- If conflicts exist, we need to handle them differently
-- For now, only update if no conflict
UPDATE players
SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_%' 
  AND external_id NOT LIKE 'espn_ncaa_baseball_%'
  AND NOT EXISTS (
    SELECT 1 FROM players p2 
    WHERE p2.external_id = REPLACE(players.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
    AND p2.id != players.id
  );

UPDATE teams
SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_%' 
  AND external_id NOT LIKE 'espn_ncaa_baseball_%'
  AND NOT EXISTS (
    SELECT 1 FROM teams t2 
    WHERE t2.external_id = REPLACE(teams.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
    AND t2.id != teams.id
  );

UPDATE games
SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_%' 
  AND external_id NOT LIKE 'espn_ncaa_baseball_%'
  AND NOT EXISTS (
    SELECT 1 FROM games g2 
    WHERE g2.external_id = REPLACE(games.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
    AND g2.id != games.id
  );

-- 8. Final status report
SELECT 'ID Standardization Summary:' as info;
SELECT 
  'Standardized IDs' as metric,
  COUNT(*) as count
FROM (
  SELECT external_id FROM teams WHERE external_id LIKE 'espn_%_%'
  UNION ALL
  SELECT external_id FROM players WHERE external_id LIKE 'espn_%_%'
  UNION ALL
  SELECT external_id FROM games WHERE external_id LIKE 'espn_%_%'
) t;

SELECT 'Remaining non-standard IDs by type:' as info;
SELECT 
  'Numeric teams' as type,
  COUNT(*) as count
FROM teams 
WHERE external_id ~ '^[0-9]+$'
UNION ALL
SELECT 
  'Numeric players',
  COUNT(*)
FROM players 
WHERE external_id ~ '^[0-9]+$'
UNION ALL
SELECT 
  'Numeric games',
  COUNT(*)
FROM games 
WHERE external_id ~ '^[0-9]+$'
UNION ALL
SELECT 
  'NCAA Baseball needing fix',
  COUNT(*)
FROM teams
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_%' 
  AND external_id NOT LIKE 'espn_ncaa_baseball_%';

-- Show sample of remaining issues
SELECT 'Sample remaining numeric IDs (may have conflicts):' as info;
SELECT 'team' as type, id, name, sport, external_id
FROM teams 
WHERE external_id ~ '^[0-9]+$'
LIMIT 5;

COMMIT;
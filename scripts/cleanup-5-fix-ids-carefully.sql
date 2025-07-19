-- FIX IDS CAREFULLY - SKIP CONFLICTS
-- Only update IDs that won't cause conflicts

BEGIN;

-- Fix numeric team IDs (skip conflicts)
UPDATE teams t1
SET external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
WHERE t1.external_id ~ '^[0-9]+$' 
  AND t1.sport IN ('NFL', 'NBA', 'MLB', 'NHL')
  AND NOT EXISTS (
    SELECT 1 FROM teams t2 
    WHERE t2.external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
  );

-- Show how many were fixed
SELECT 'Numeric team IDs fixed:' as status, COUNT(*) as count
FROM teams 
WHERE external_id LIKE 'espn_%' 
  AND external_id ~ 'espn_[a-z]+_[0-9]+$';

-- For NCAA Baseball players, let's first check a specific example
SELECT 'Checking NCAA Baseball player conflicts:' as info;
SELECT 
  p1.id as player1_id,
  p1.name as player1_name,
  p1.external_id as player1_ext_id,
  p2.id as player2_id,
  p2.name as player2_name,
  p2.external_id as player2_ext_id
FROM players p1
JOIN players p2 ON p2.external_id = REPLACE(p1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE p1.sport = 'NCAA_BASEBALL' 
  AND p1.external_id LIKE 'espn_ncaa_%' 
  AND p1.external_id NOT LIKE 'espn_ncaa_baseball_%'
  AND p1.external_id != p2.external_id
LIMIT 5;

-- If they're the same player, we might have duplicates to clean up
-- For now, let's skip NCAA Baseball players and just fix the safe ones

-- Fix numeric player IDs (skip conflicts)
UPDATE players p1
SET external_id = 'espn_' || LOWER(p1.sport) || '_' || p1.external_id
WHERE p1.external_id ~ '^[0-9]+$' 
  AND p1.sport IN ('NFL', 'NBA', 'MLB', 'NHL')
  AND NOT EXISTS (
    SELECT 1 FROM players p2 
    WHERE p2.external_id = 'espn_' || LOWER(p1.sport) || '_' || p1.external_id
  );

-- Fix numeric game IDs (skip conflicts)
UPDATE games g1
SET external_id = 'espn_' || LOWER(g1.sport) || '_' || g1.external_id
WHERE g1.external_id ~ '^[0-9]+$' 
  AND g1.sport IN ('NFL', 'NBA', 'MLB', 'NHL')
  AND NOT EXISTS (
    SELECT 1 FROM games g2 
    WHERE g2.external_id = 'espn_' || LOWER(g1.sport) || '_' || g1.external_id
  );

-- Final check
SELECT 'Remaining non-standard IDs after safe fixes:' as info;
SELECT 'teams' as table_name, COUNT(*) as count
FROM teams 
WHERE external_id ~ '^[0-9]+$'
UNION ALL
SELECT 'players', COUNT(*)
FROM players 
WHERE external_id ~ '^[0-9]+$'
UNION ALL
SELECT 'games', COUNT(*)
FROM games 
WHERE external_id ~ '^[0-9]+$';

-- Show remaining numeric IDs that have conflicts
SELECT 'Teams with numeric IDs that would conflict:' as info;
SELECT 
  t1.id,
  t1.name,
  t1.sport,
  t1.external_id
FROM teams t1
WHERE t1.external_id ~ '^[0-9]+$'
  AND EXISTS (
    SELECT 1 FROM teams t2 
    WHERE t2.external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
  )
LIMIT 10;

COMMIT;
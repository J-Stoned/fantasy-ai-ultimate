-- 🏆 STEP 5: STANDARDIZE ESPN IDS
-- Fix external_id format to match espn_sport_id pattern

BEGIN;

-- Check current ID formats
SELECT 'Non-standard IDs found:' as info;
SELECT 'teams' as table_name, COUNT(*) as count
FROM teams 
WHERE external_id ~ '^[0-9]+$' OR external_id IS NULL
UNION ALL
SELECT 'players', COUNT(*)
FROM players 
WHERE external_id ~ '^[0-9]+$' OR external_id IS NULL
UNION ALL
SELECT 'games', COUNT(*)
FROM games 
WHERE external_id ~ '^[0-9]+$' OR external_id IS NULL;

-- Fix numeric-only IDs for major sports
UPDATE teams 
SET external_id = 'espn_' || LOWER(sport) || '_' || external_id
WHERE external_id ~ '^[0-9]+$' 
  AND sport IN ('NFL', 'NBA', 'MLB', 'NHL');

UPDATE players 
SET external_id = 'espn_' || LOWER(sport) || '_' || external_id
WHERE external_id ~ '^[0-9]+$' 
  AND sport IN ('NFL', 'NBA', 'MLB', 'NHL');

UPDATE games 
SET external_id = 'espn_' || LOWER(sport) || '_' || external_id
WHERE external_id ~ '^[0-9]+$' 
  AND sport IN ('NFL', 'NBA', 'MLB', 'NHL');

-- Fix NCAA Baseball IDs (espn_ncaa_X → espn_ncaa_baseball_X)
UPDATE players 
SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_%' 
  AND external_id NOT LIKE 'espn_ncaa_baseball_%';

UPDATE teams 
SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_%' 
  AND external_id NOT LIKE 'espn_ncaa_baseball_%';

UPDATE games 
SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_%' 
  AND external_id NOT LIKE 'espn_ncaa_baseball_%';

-- Verify results
SELECT 'Remaining non-standard IDs:' as info;
SELECT 'teams' as table_name, COUNT(*) as count
FROM teams 
WHERE external_id NOT LIKE 'espn_%_%' 
  AND external_id NOT LIKE 'mlb_milb_%'
  AND external_id IS NOT NULL
UNION ALL
SELECT 'players', COUNT(*)
FROM players 
WHERE external_id NOT LIKE 'espn_%_%' 
  AND external_id NOT LIKE 'mlb_milb_%'
  AND external_id IS NOT NULL
UNION ALL
SELECT 'games', COUNT(*)
FROM games 
WHERE external_id NOT LIKE 'espn_%_%' 
  AND external_id NOT LIKE 'mlb_milb_%'
  AND external_id IS NOT NULL;

COMMIT;
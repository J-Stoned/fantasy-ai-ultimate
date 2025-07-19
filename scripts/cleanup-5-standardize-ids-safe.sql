-- 🏆 STEP 5: STANDARDIZE ESPN IDS (SAFE VERSION)
-- Handles unique constraint on external_id

BEGIN;

-- First, check what numeric IDs we have and if they would create conflicts
SELECT 'Checking for potential conflicts...' as info;
WITH numeric_ids AS (
  SELECT 
    'teams' as table_name,
    id,
    sport,
    external_id,
    name,
    CASE 
      WHEN sport = 'NFL' THEN 'espn_nfl_' || external_id
      WHEN sport = 'NBA' THEN 'espn_nba_' || external_id
      WHEN sport = 'MLB' THEN 'espn_mlb_' || external_id
      WHEN sport = 'NHL' THEN 'espn_nhl_' || external_id
      ELSE external_id
    END as proposed_id
  FROM teams
  WHERE external_id ~ '^[0-9]+$' 
    AND sport IN ('NFL', 'NBA', 'MLB', 'NHL')
)
SELECT 
  n.*,
  CASE WHEN EXISTS (SELECT 1 FROM teams t WHERE t.external_id = n.proposed_id) 
       THEN 'CONFLICT' 
       ELSE 'OK' 
  END as status
FROM numeric_ids n;

-- For conflicting IDs, we'll add a suffix
UPDATE teams 
SET external_id = 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM teams t2 WHERE t2.external_id = 'espn_' || LOWER(teams.sport) || '_' || teams.external_id)
    THEN 'espn_' || LOWER(teams.sport) || '_' || teams.external_id
    ELSE 'espn_' || LOWER(teams.sport) || '_' || teams.external_id || '_dup'
  END
WHERE external_id ~ '^[0-9]+$' 
  AND sport IN ('NFL', 'NBA', 'MLB', 'NHL');

-- Same for players
UPDATE players 
SET external_id = 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM players p2 WHERE p2.external_id = 'espn_' || LOWER(players.sport) || '_' || players.external_id)
    THEN 'espn_' || LOWER(players.sport) || '_' || players.external_id
    ELSE 'espn_' || LOWER(players.sport) || '_' || players.external_id || '_dup'
  END
WHERE external_id ~ '^[0-9]+$' 
  AND sport IN ('NFL', 'NBA', 'MLB', 'NHL');

-- Same for games
UPDATE games 
SET external_id = 
  CASE 
    WHEN NOT EXISTS (SELECT 1 FROM games g2 WHERE g2.external_id = 'espn_' || LOWER(games.sport) || '_' || games.external_id)
    THEN 'espn_' || LOWER(games.sport) || '_' || games.external_id
    ELSE 'espn_' || LOWER(games.sport) || '_' || games.external_id || '_dup'
  END
WHERE external_id ~ '^[0-9]+$' 
  AND sport IN ('NFL', 'NBA', 'MLB', 'NHL');

-- Fix NCAA Baseball IDs (these should be safe)
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

-- Check for any remaining issues
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

-- Show any IDs marked as duplicates
SELECT 'IDs marked as duplicates (need manual review):' as info;
SELECT 'teams' as table_name, external_id, name, sport
FROM teams WHERE external_id LIKE '%_dup'
UNION ALL
SELECT 'players', external_id, name, sport
FROM players WHERE external_id LIKE '%_dup'
UNION ALL
SELECT 'games', external_id, NULL, sport
FROM games WHERE external_id LIKE '%_dup';

COMMIT;
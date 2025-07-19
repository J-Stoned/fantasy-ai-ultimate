-- 🏈 STEP 1: STANDARDIZE SPORT NAMES
-- This script fixes sport name variations (football → NFL, etc.)

BEGIN;

-- Show current sport distribution
SELECT 'Current sport values:' as info;
SELECT sport, COUNT(*) as count FROM teams GROUP BY sport ORDER BY count DESC;
SELECT sport, COUNT(*) as count FROM players GROUP BY sport ORDER BY count DESC;
SELECT sport, COUNT(*) as count FROM games GROUP BY sport ORDER BY count DESC;

-- Standardize sport names in all tables
UPDATE players SET sport = 'NFL' WHERE LOWER(sport) IN ('football', 'nfl');
UPDATE players SET sport = 'NBA' WHERE LOWER(sport) IN ('basketball', 'nba');
UPDATE players SET sport = 'MLB' WHERE LOWER(sport) IN ('baseball', 'mlb');
UPDATE players SET sport = 'NHL' WHERE LOWER(sport) IN ('hockey', 'nhl');

UPDATE teams SET sport = 'NFL' WHERE LOWER(sport) IN ('football', 'nfl');
UPDATE teams SET sport = 'NBA' WHERE LOWER(sport) IN ('basketball', 'nba');
UPDATE teams SET sport = 'MLB' WHERE LOWER(sport) IN ('baseball', 'mlb');
UPDATE teams SET sport = 'NHL' WHERE LOWER(sport) IN ('hockey', 'nhl');

UPDATE games SET sport = 'NFL' WHERE LOWER(sport) IN ('football', 'nfl');
UPDATE games SET sport = 'NBA' WHERE LOWER(sport) IN ('basketball', 'nba');
UPDATE games SET sport = 'MLB' WHERE LOWER(sport) IN ('baseball', 'mlb');
UPDATE games SET sport = 'NHL' WHERE LOWER(sport) IN ('hockey', 'nhl');

-- Show results
SELECT 'Sport standardization complete!' as status;
SELECT sport, COUNT(*) as count FROM teams WHERE sport IS NOT NULL GROUP BY sport ORDER BY count DESC;

COMMIT;
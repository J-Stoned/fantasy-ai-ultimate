-- 🚀 FANTASY AI DATABASE CLEANUP SQL
-- Run these commands in your database client (pgAdmin, psql, Supabase SQL Editor, etc.)
-- IMPORTANT: Run inside a transaction so you can rollback if needed

BEGIN;

-- ============================================
-- 1. FIX NULL SPORTS
-- ============================================
-- Delete stats for players with NULL sport first
DELETE FROM player_game_logs 
WHERE player_id IN (SELECT id FROM players WHERE sport IS NULL);

-- Delete stats for games with NULL sport
DELETE FROM player_game_logs
WHERE game_id IN (SELECT id FROM games WHERE sport IS NULL);

-- Delete players with NULL sport
DELETE FROM players WHERE sport IS NULL;

-- Delete games with NULL sport
DELETE FROM games WHERE sport IS NULL;

-- Update players to remove team_id for teams with NULL sport
UPDATE players SET team_id = NULL 
WHERE team_id IN (SELECT id FROM teams WHERE sport IS NULL);

-- Update games to remove team references for teams with NULL sport
UPDATE games SET home_team_id = NULL 
WHERE home_team_id IN (SELECT id FROM teams WHERE sport IS NULL);

UPDATE games SET away_team_id = NULL 
WHERE away_team_id IN (SELECT id FROM teams WHERE sport IS NULL);

-- Now we can safely delete teams with NULL sport
DELETE FROM teams WHERE sport IS NULL;

-- ============================================
-- 2. STANDARDIZE SPORT NAMES
-- ============================================
-- Fix common misspellings and variations
UPDATE players SET sport = 'NFL' WHERE sport IN ('football', 'Football', 'nfl');
UPDATE players SET sport = 'NBA' WHERE sport IN ('basketball', 'Basketball', 'nba');
UPDATE players SET sport = 'MLB' WHERE sport IN ('baseball', 'Baseball', 'mlb');
UPDATE players SET sport = 'NHL' WHERE sport IN ('hockey', 'Hockey', 'nhl');

UPDATE teams SET sport = 'NFL' WHERE sport IN ('football', 'Football', 'nfl');
UPDATE teams SET sport = 'NBA' WHERE sport IN ('basketball', 'Basketball', 'nba');
UPDATE teams SET sport = 'MLB' WHERE sport IN ('baseball', 'Baseball', 'mlb');
UPDATE teams SET sport = 'NHL' WHERE sport IN ('hockey', 'Hockey', 'nhl');

UPDATE games SET sport = 'NFL' WHERE sport IN ('football', 'Football', 'nfl');
UPDATE games SET sport = 'NBA' WHERE sport IN ('basketball', 'Basketball', 'nba');
UPDATE games SET sport = 'MLB' WHERE sport IN ('baseball', 'Baseball', 'mlb');
UPDATE games SET sport = 'NHL' WHERE sport IN ('hockey', 'Hockey', 'nhl');

-- ============================================
-- 3. REMOVE DUPLICATE TEAMS
-- ============================================
-- Create temp table with teams to keep (one per name/sport combo)
CREATE TEMP TABLE teams_to_keep AS
SELECT DISTINCT ON (name, sport) id
FROM teams
WHERE sport IS NOT NULL
ORDER BY name, sport, id;

-- Update all references to point to keeper teams
UPDATE players p
SET team_id = tk.id
FROM teams t1
JOIN teams_to_keep tk ON t1.name = (SELECT name FROM teams WHERE id = tk.id)
  AND t1.sport = (SELECT sport FROM teams WHERE id = tk.id)
WHERE p.team_id = t1.id AND t1.id != tk.id;

UPDATE games g
SET home_team_id = tk.id
FROM teams t1
JOIN teams_to_keep tk ON t1.name = (SELECT name FROM teams WHERE id = tk.id)
  AND t1.sport = (SELECT sport FROM teams WHERE id = tk.id)
WHERE g.home_team_id = t1.id AND t1.id != tk.id;

UPDATE games g
SET away_team_id = tk.id
FROM teams t1
JOIN teams_to_keep tk ON t1.name = (SELECT name FROM teams WHERE id = tk.id)
  AND t1.sport = (SELECT sport FROM teams WHERE id = tk.id)
WHERE g.away_team_id = t1.id AND t1.id != tk.id;

-- Delete duplicate teams
DELETE FROM teams WHERE id NOT IN (SELECT id FROM teams_to_keep);

DROP TABLE teams_to_keep;

-- ============================================
-- 4. REMOVE DUPLICATE GAMES
-- ============================================
-- Keep only one game per team matchup and date
DELETE FROM games g1
WHERE EXISTS (
  SELECT 1
  FROM games g2
  WHERE g1.home_team_id = g2.home_team_id
    AND g1.away_team_id = g2.away_team_id
    AND DATE(g1.date) = DATE(g2.date)
    AND g1.id > g2.id
);

-- ============================================
-- 5. REMOVE EMPTY STATS
-- ============================================
DELETE FROM player_game_logs
WHERE stats IS NULL OR stats::text = '{}';

-- ============================================
-- 6. FIX ORPHANED STATS
-- ============================================
-- Delete stats with missing players
DELETE FROM player_game_logs pgl
WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pgl.player_id);

-- Delete stats with missing games
DELETE FROM player_game_logs pgl
WHERE NOT EXISTS (SELECT 1 FROM games g WHERE g.id = pgl.game_id);

-- ============================================
-- 7. STANDARDIZE ESPN IDS
-- ============================================
-- Fix numeric-only external IDs for major sports
UPDATE teams 
SET external_id = 
  CASE 
    WHEN sport = 'NFL' THEN 'espn_nfl_' || regexp_replace(external_id, '[^0-9]', '', 'g')
    WHEN sport = 'NBA' THEN 'espn_nba_' || regexp_replace(external_id, '[^0-9]', '', 'g')
    WHEN sport = 'MLB' THEN 'espn_mlb_' || regexp_replace(external_id, '[^0-9]', '', 'g')
    WHEN sport = 'NHL' THEN 'espn_nhl_' || regexp_replace(external_id, '[^0-9]', '', 'g')
    ELSE external_id
  END
WHERE external_id ~ '^[0-9]+$';

UPDATE players 
SET external_id = 
  CASE 
    WHEN sport = 'NFL' THEN 'espn_nfl_' || regexp_replace(external_id, '[^0-9]', '', 'g')
    WHEN sport = 'NBA' THEN 'espn_nba_' || regexp_replace(external_id, '[^0-9]', '', 'g')
    WHEN sport = 'MLB' THEN 'espn_mlb_' || regexp_replace(external_id, '[^0-9]', '', 'g')
    WHEN sport = 'NHL' THEN 'espn_nhl_' || regexp_replace(external_id, '[^0-9]', '', 'g')
    ELSE external_id
  END
WHERE external_id ~ '^[0-9]+$';

UPDATE games 
SET external_id = 
  CASE 
    WHEN sport = 'NFL' THEN 'espn_nfl_' || regexp_replace(external_id, '[^0-9]', '', 'g')
    WHEN sport = 'NBA' THEN 'espn_nba_' || regexp_replace(external_id, '[^0-9]', '', 'g')
    WHEN sport = 'MLB' THEN 'espn_mlb_' || regexp_replace(external_id, '[^0-9]', '', 'g')
    WHEN sport = 'NHL' THEN 'espn_nhl_' || regexp_replace(external_id, '[^0-9]', '', 'g')
    ELSE external_id
  END
WHERE external_id ~ '^[0-9]+$';

-- Fix NCAA Baseball misformatted IDs
UPDATE players SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' AND external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%';

UPDATE teams SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' AND external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%';

UPDATE games SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' AND external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%';

-- ============================================
-- VERIFICATION QUERIES (Run these to check results)
-- ============================================
-- Check for remaining issues:
SELECT 'Teams with NULL sport' as issue, COUNT(*) FROM teams WHERE sport IS NULL
UNION ALL
SELECT 'Players with NULL sport', COUNT(*) FROM players WHERE sport IS NULL
UNION ALL
SELECT 'Games with NULL sport', COUNT(*) FROM games WHERE sport IS NULL
UNION ALL
SELECT 'Non-standard team IDs', COUNT(*) FROM teams WHERE external_id NOT LIKE 'espn_%_%' AND external_id NOT LIKE 'mlb_milb_%'
UNION ALL
SELECT 'Non-standard player IDs', COUNT(*) FROM players WHERE external_id NOT LIKE 'espn_%_%' AND external_id NOT LIKE 'mlb_milb_%'
UNION ALL
SELECT 'Non-standard game IDs', COUNT(*) FROM games WHERE external_id NOT LIKE 'espn_%_%' AND external_id NOT LIKE 'mlb_milb_%'
UNION ALL
SELECT 'Empty stats', COUNT(*) FROM player_game_logs WHERE stats IS NULL OR stats::text = '{}'
UNION ALL
SELECT 'Orphaned stats (no player)', COUNT(*) FROM player_game_logs pgl WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pgl.player_id)
UNION ALL
SELECT 'Orphaned stats (no game)', COUNT(*) FROM player_game_logs pgl WHERE NOT EXISTS (SELECT 1 FROM games g WHERE g.id = pgl.game_id);

-- Check duplicate teams
SELECT 'Duplicate teams' as issue, COUNT(*) as groups FROM (
  SELECT name, sport, COUNT(*) 
  FROM teams 
  GROUP BY name, sport 
  HAVING COUNT(*) > 1
) t;

-- Check duplicate games
SELECT 'Duplicate games' as issue, COUNT(*) as groups FROM (
  SELECT home_team_id, away_team_id, DATE(date), COUNT(*)
  FROM games
  WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(date)
  HAVING COUNT(*) > 1
) t;

-- If everything looks good, COMMIT the transaction
-- If there are issues, ROLLBACK instead
COMMIT;
-- or ROLLBACK;
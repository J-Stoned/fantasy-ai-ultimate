-- 🚀 FANTASY AI DATABASE CLEANUP SQL (SAFE VERSION)
-- This version checks for issues and provides safer cleanup options

-- First, let's check what we're dealing with
BEGIN;

-- ============================================
-- ANALYSIS QUERIES - Run these first!
-- ============================================

-- Check teams that would be affected
SELECT 'Teams to be deleted (NULL sport)' as category, COUNT(*) as count
FROM teams WHERE sport IS NULL;

-- Check if any players reference these teams
SELECT 'Players referencing NULL sport teams' as category, COUNT(*) as count
FROM players p
JOIN teams t ON p.team_id = t.id
WHERE t.sport IS NULL;

-- Check duplicate teams
WITH duplicate_teams AS (
  SELECT name, sport, COUNT(*) as count, 
         array_agg(id ORDER BY id) as ids
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) > 1
)
SELECT 'Duplicate team groups' as category, COUNT(*) as count
FROM duplicate_teams;

-- ============================================
-- SAFE CLEANUP OPERATIONS
-- ============================================

-- 1. First, fix sport field issues (safe - just updates)
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

-- 2. Handle duplicate teams more carefully
-- First, let's see what duplicates we have
WITH duplicate_teams AS (
  SELECT name, sport, COUNT(*) as count, 
         array_agg(id ORDER BY id) as ids,
         array_agg(external_id ORDER BY id) as external_ids
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) > 1
)
SELECT * FROM duplicate_teams LIMIT 10;

-- For each duplicate group, we'll keep the one with the most players
WITH team_player_counts AS (
  SELECT t.id, t.name, t.sport, COUNT(p.id) as player_count
  FROM teams t
  LEFT JOIN players p ON p.team_id = t.id
  GROUP BY t.id, t.name, t.sport
),
teams_to_keep AS (
  SELECT DISTINCT ON (name, sport) id
  FROM team_player_counts
  WHERE sport IS NOT NULL
  ORDER BY name, sport, player_count DESC, id
)
-- First update all references
UPDATE players p
SET team_id = tk.id
FROM teams t1
JOIN teams_to_keep tk ON t1.name = (SELECT name FROM teams WHERE id = tk.id)
  AND t1.sport = (SELECT sport FROM teams WHERE id = tk.id)
WHERE p.team_id = t1.id AND t1.id != tk.id;

-- Update player_game_logs opponent_id references
WITH team_player_counts AS (
  SELECT t.id, t.name, t.sport, COUNT(p.id) as player_count
  FROM teams t
  LEFT JOIN players p ON p.team_id = t.id
  GROUP BY t.id, t.name, t.sport
),
teams_to_keep AS (
  SELECT DISTINCT ON (name, sport) id
  FROM team_player_counts
  WHERE sport IS NOT NULL
  ORDER BY name, sport, player_count DESC, id
)
UPDATE player_game_logs pgl
SET opponent_id = tk.id
FROM teams t1
JOIN teams_to_keep tk ON t1.name = (SELECT name FROM teams WHERE id = tk.id)
  AND t1.sport = (SELECT sport FROM teams WHERE id = tk.id)
WHERE pgl.opponent_id = t1.id AND t1.id != tk.id;

-- Update games
WITH team_player_counts AS (
  SELECT t.id, t.name, t.sport, COUNT(p.id) as player_count
  FROM teams t
  LEFT JOIN players p ON p.team_id = t.id
  GROUP BY t.id, t.name, t.sport
),
teams_to_keep AS (
  SELECT DISTINCT ON (name, sport) id
  FROM team_player_counts
  WHERE sport IS NOT NULL
  ORDER BY name, sport, player_count DESC, id
)
UPDATE games g
SET home_team_id = tk.id
FROM teams t1
JOIN teams_to_keep tk ON t1.name = (SELECT name FROM teams WHERE id = tk.id)
  AND t1.sport = (SELECT sport FROM teams WHERE id = tk.id)
WHERE g.home_team_id = t1.id AND t1.id != tk.id;

WITH team_player_counts AS (
  SELECT t.id, t.name, t.sport, COUNT(p.id) as player_count
  FROM teams t
  LEFT JOIN players p ON p.team_id = t.id
  GROUP BY t.id, t.name, t.sport
),
teams_to_keep AS (
  SELECT DISTINCT ON (name, sport) id
  FROM team_player_counts
  WHERE sport IS NOT NULL
  ORDER BY name, sport, player_count DESC, id
)
UPDATE games g
SET away_team_id = tk.id
FROM teams t1
JOIN teams_to_keep tk ON t1.name = (SELECT name FROM teams WHERE id = tk.id)
  AND t1.sport = (SELECT sport FROM teams WHERE id = tk.id)
WHERE g.away_team_id = t1.id AND t1.id != tk.id;

-- Now delete the duplicates
WITH team_player_counts AS (
  SELECT t.id, t.name, t.sport, COUNT(p.id) as player_count
  FROM teams t
  LEFT JOIN players p ON p.team_id = t.id
  GROUP BY t.id, t.name, t.sport
),
teams_to_keep AS (
  SELECT DISTINCT ON (name, sport) id
  FROM team_player_counts
  WHERE sport IS NOT NULL
  ORDER BY name, sport, player_count DESC, id
)
DELETE FROM teams WHERE id NOT IN (SELECT id FROM teams_to_keep) AND sport IS NOT NULL;

-- 3. Remove empty stats (safe)
DELETE FROM player_game_logs
WHERE stats IS NULL OR stats::text = '{}';

-- 4. Remove orphaned stats (safe)
DELETE FROM player_game_logs pgl
WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pgl.player_id);

DELETE FROM player_game_logs pgl
WHERE NOT EXISTS (SELECT 1 FROM games g WHERE g.id = pgl.game_id);

-- 5. Standardize ESPN IDs (safe - just formatting)
UPDATE teams 
SET external_id = 
  CASE 
    WHEN sport = 'NFL' AND external_id ~ '^[0-9]+$' THEN 'espn_nfl_' || external_id
    WHEN sport = 'NBA' AND external_id ~ '^[0-9]+$' THEN 'espn_nba_' || external_id
    WHEN sport = 'MLB' AND external_id ~ '^[0-9]+$' THEN 'espn_mlb_' || external_id
    WHEN sport = 'NHL' AND external_id ~ '^[0-9]+$' THEN 'espn_nhl_' || external_id
    ELSE external_id
  END
WHERE external_id ~ '^[0-9]+$';

UPDATE players 
SET external_id = 
  CASE 
    WHEN sport = 'NFL' AND external_id ~ '^[0-9]+$' THEN 'espn_nfl_' || external_id
    WHEN sport = 'NBA' AND external_id ~ '^[0-9]+$' THEN 'espn_nba_' || external_id
    WHEN sport = 'MLB' AND external_id ~ '^[0-9]+$' THEN 'espn_mlb_' || external_id
    WHEN sport = 'NHL' AND external_id ~ '^[0-9]+$' THEN 'espn_nhl_' || external_id
    ELSE external_id
  END
WHERE external_id ~ '^[0-9]+$';

UPDATE games 
SET external_id = 
  CASE 
    WHEN sport = 'NFL' AND external_id ~ '^[0-9]+$' THEN 'espn_nfl_' || external_id
    WHEN sport = 'NBA' AND external_id ~ '^[0-9]+$' THEN 'espn_nba_' || external_id
    WHEN sport = 'MLB' AND external_id ~ '^[0-9]+$' THEN 'espn_mlb_' || external_id
    WHEN sport = 'NHL' AND external_id ~ '^[0-9]+$' THEN 'espn_nhl_' || external_id
    ELSE external_id
  END
WHERE external_id ~ '^[0-9]+$';

-- Fix NCAA Baseball IDs
UPDATE players SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' AND external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%';

UPDATE teams SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' AND external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%';

UPDATE games SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' AND external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%';

-- ============================================
-- FINAL VERIFICATION
-- ============================================
SELECT 'Remaining NULL sport teams' as issue, COUNT(*) as count FROM teams WHERE sport IS NULL
UNION ALL
SELECT 'Remaining NULL sport players', COUNT(*) FROM players WHERE sport IS NULL
UNION ALL
SELECT 'Remaining NULL sport games', COUNT(*) FROM games WHERE sport IS NULL
UNION ALL
SELECT 'Duplicate teams remaining', COUNT(*) FROM (
  SELECT name, sport FROM teams GROUP BY name, sport HAVING COUNT(*) > 1
) t
UNION ALL
SELECT 'Empty stats remaining', COUNT(*) FROM player_game_logs WHERE stats IS NULL OR stats::text = '{}'
UNION ALL
SELECT 'Orphaned stats remaining', COUNT(*) FROM player_game_logs pgl 
  WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pgl.player_id)
     OR NOT EXISTS (SELECT 1 FROM games g WHERE g.id = pgl.game_id);

-- If everything looks good:
COMMIT;

-- If you need to rollback:
-- ROLLBACK;
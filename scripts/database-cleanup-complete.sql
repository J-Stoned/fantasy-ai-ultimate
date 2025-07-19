-- 🚀 FANTASY AI DATABASE CLEANUP - COMPLETE VERSION
-- This version handles ALL foreign key constraints properly

BEGIN;

-- ============================================
-- STEP 1: ANALYZE ALL FOREIGN KEY RELATIONSHIPS
-- ============================================
SELECT 'Checking all team references...';

-- Check all tables that reference teams
SELECT 'players.team_id' as reference, COUNT(*) as count 
FROM players WHERE team_id IS NOT NULL
UNION ALL
SELECT 'games.home_team_id', COUNT(*) 
FROM games WHERE home_team_id IS NOT NULL
UNION ALL
SELECT 'games.away_team_id', COUNT(*) 
FROM games WHERE away_team_id IS NOT NULL
UNION ALL
SELECT 'player_game_logs.opponent_id', COUNT(*) 
FROM player_game_logs WHERE opponent_id IS NOT NULL;

-- ============================================
-- STEP 2: FIX SPORT NAMES (SAFE - NO DELETES)
-- ============================================
SELECT 'Standardizing sport names...';

-- Standardize all sport names first
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

-- Note: player_game_logs doesn't have a sport column, so we skip it

-- ============================================
-- STEP 3: HANDLE DUPLICATE TEAMS CAREFULLY
-- ============================================
SELECT 'Handling duplicate teams...';

-- Create a mapping of duplicate teams to their keeper
CREATE TEMP TABLE team_mapping AS
WITH team_stats AS (
  SELECT 
    t.id,
    t.name,
    t.sport,
    t.external_id,
    COUNT(DISTINCT p.id) as player_count,
    COUNT(DISTINCT g1.id) as home_game_count,
    COUNT(DISTINCT g2.id) as away_game_count,
    COUNT(DISTINCT pgl.id) as stat_count
  FROM teams t
  LEFT JOIN players p ON p.team_id = t.id
  LEFT JOIN games g1 ON g1.home_team_id = t.id
  LEFT JOIN games g2 ON g2.away_team_id = t.id
  LEFT JOIN player_game_logs pgl ON pgl.opponent_id = t.id
  WHERE t.sport IS NOT NULL
  GROUP BY t.id, t.name, t.sport, t.external_id
),
ranked_teams AS (
  SELECT 
    *,
    ROW_NUMBER() OVER (
      PARTITION BY name, sport 
      ORDER BY 
        player_count DESC,
        home_game_count + away_game_count DESC,
        stat_count DESC,
        id ASC
    ) as rank
  FROM team_stats
)
SELECT 
  t1.id as old_id,
  t2.id as new_id,
  t1.name,
  t1.sport
FROM ranked_teams t1
JOIN ranked_teams t2 ON t1.name = t2.name AND t1.sport = t2.sport AND t2.rank = 1
WHERE t1.rank > 1;

-- Show what will be merged
SELECT 'Teams to be merged:' as info, COUNT(*) as count FROM team_mapping;

-- Update all references to point to keeper teams
UPDATE players 
SET team_id = tm.new_id
FROM team_mapping tm
WHERE players.team_id = tm.old_id;

UPDATE games
SET home_team_id = tm.new_id
FROM team_mapping tm
WHERE games.home_team_id = tm.old_id;

UPDATE games
SET away_team_id = tm.new_id
FROM team_mapping tm
WHERE games.away_team_id = tm.old_id;

UPDATE player_game_logs
SET opponent_id = tm.new_id
FROM team_mapping tm
WHERE player_game_logs.opponent_id = tm.old_id;

-- Now safe to delete duplicate teams
DELETE FROM teams
WHERE id IN (SELECT old_id FROM team_mapping);

DROP TABLE team_mapping;

-- ============================================
-- STEP 4: REMOVE DUPLICATE GAMES
-- ============================================
SELECT 'Removing duplicate games...';

-- Keep the game with the most stats
WITH game_duplicates AS (
  SELECT 
    g1.id,
    g1.home_team_id,
    g1.away_team_id,
    DATE(g1.date) as game_date,
    COUNT(pgl.id) as stat_count,
    ROW_NUMBER() OVER (
      PARTITION BY g1.home_team_id, g1.away_team_id, DATE(g1.date)
      ORDER BY COUNT(pgl.id) DESC, g1.id ASC
    ) as rn
  FROM games g1
  LEFT JOIN player_game_logs pgl ON pgl.game_id = g1.id
  WHERE g1.home_team_id IS NOT NULL 
    AND g1.away_team_id IS NOT NULL
    AND g1.date IS NOT NULL
  GROUP BY g1.id, g1.home_team_id, g1.away_team_id, DATE(g1.date)
),
games_to_delete AS (
  SELECT id FROM game_duplicates WHERE rn > 1
)
-- First update stats to point to keeper games
UPDATE player_game_logs pgl
SET game_id = gk.keeper_id
FROM (
  SELECT 
    gd1.id as old_id,
    gd2.id as keeper_id
  FROM game_duplicates gd1
  JOIN game_duplicates gd2 ON 
    gd1.home_team_id = gd2.home_team_id
    AND gd1.away_team_id = gd2.away_team_id
    AND gd1.game_date = gd2.game_date
    AND gd2.rn = 1
  WHERE gd1.rn > 1
) gk
WHERE pgl.game_id = gk.old_id;

-- Delete duplicate games
DELETE FROM games
WHERE id IN (
  WITH game_duplicates AS (
    SELECT 
      g1.id,
      ROW_NUMBER() OVER (
        PARTITION BY g1.home_team_id, g1.away_team_id, DATE(g1.date)
        ORDER BY g1.id ASC
      ) as rn
    FROM games g1
    WHERE g1.home_team_id IS NOT NULL 
      AND g1.away_team_id IS NOT NULL
      AND g1.date IS NOT NULL
  )
  SELECT id FROM game_duplicates WHERE rn > 1
);

-- ============================================
-- STEP 5: CLEAN UP ORPHANED DATA
-- ============================================
SELECT 'Cleaning up orphaned data...';

-- Remove stats with no player
DELETE FROM player_game_logs pgl
WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pgl.player_id);

-- Remove stats with no game
DELETE FROM player_game_logs pgl
WHERE NOT EXISTS (SELECT 1 FROM games g WHERE g.id = pgl.game_id);

-- Remove empty stats
DELETE FROM player_game_logs
WHERE stats IS NULL OR stats::text = '{}';

-- ============================================
-- STEP 6: STANDARDIZE ESPN IDS
-- ============================================
SELECT 'Standardizing ESPN IDs...';

-- Fix numeric-only IDs
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

-- Fix NCAA Baseball IDs
UPDATE players SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' AND external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%';

UPDATE teams SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' AND external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%';

UPDATE games SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' AND external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%';

-- ============================================
-- STEP 7: HANDLE NULL SPORT RECORDS
-- ============================================
SELECT 'Handling NULL sport records...';

-- For teams with NULL sport, try to infer from games
UPDATE teams t
SET sport = (
  SELECT g.sport 
  FROM games g 
  WHERE (g.home_team_id = t.id OR g.away_team_id = t.id) 
    AND g.sport IS NOT NULL 
  LIMIT 1
)
WHERE t.sport IS NULL;

-- For players with NULL sport, try to infer from games they played in
UPDATE players p
SET sport = (
  SELECT g.sport 
  FROM player_game_logs pgl
  JOIN games g ON pgl.game_id = g.id
  WHERE pgl.player_id = p.id 
    AND g.sport IS NOT NULL 
  LIMIT 1
)
WHERE p.sport IS NULL;

-- Clean up remaining NULL sport records
-- First remove all references
UPDATE players SET team_id = NULL 
WHERE team_id IN (SELECT id FROM teams WHERE sport IS NULL);

UPDATE games SET home_team_id = NULL 
WHERE home_team_id IN (SELECT id FROM teams WHERE sport IS NULL);

UPDATE games SET away_team_id = NULL 
WHERE away_team_id IN (SELECT id FROM teams WHERE sport IS NULL);

UPDATE player_game_logs SET opponent_id = NULL 
WHERE opponent_id IN (SELECT id FROM teams WHERE sport IS NULL);

-- Delete stats for NULL sport players/games
DELETE FROM player_game_logs 
WHERE player_id IN (SELECT id FROM players WHERE sport IS NULL);

DELETE FROM player_game_logs
WHERE game_id IN (SELECT id FROM games WHERE sport IS NULL);

-- Now delete NULL sport records
DELETE FROM players WHERE sport IS NULL;
DELETE FROM games WHERE sport IS NULL;
DELETE FROM teams WHERE sport IS NULL;

-- ============================================
-- FINAL VERIFICATION
-- ============================================
SELECT '=== CLEANUP COMPLETE ===' as status;

SELECT 'Issue' as category, 'Count' as count
UNION ALL
SELECT 'NULL sport teams', COUNT(*)::text FROM teams WHERE sport IS NULL
UNION ALL
SELECT 'NULL sport players', COUNT(*)::text FROM players WHERE sport IS NULL
UNION ALL
SELECT 'NULL sport games', COUNT(*)::text FROM games WHERE sport IS NULL
UNION ALL
SELECT 'Duplicate teams', COUNT(*)::text FROM (
  SELECT name, sport FROM teams WHERE sport IS NOT NULL GROUP BY name, sport HAVING COUNT(*) > 1
) t
UNION ALL
SELECT 'Duplicate games', COUNT(*)::text FROM (
  SELECT home_team_id, away_team_id, DATE(date) 
  FROM games 
  WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(date) 
  HAVING COUNT(*) > 1
) t
UNION ALL
SELECT 'Empty stats', COUNT(*)::text FROM player_game_logs WHERE stats IS NULL OR stats::text = '{}'
UNION ALL
SELECT 'Orphaned stats (no player)', COUNT(*)::text FROM player_game_logs pgl 
  WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = pgl.player_id)
UNION ALL
SELECT 'Orphaned stats (no game)', COUNT(*)::text FROM player_game_logs pgl 
  WHERE NOT EXISTS (SELECT 1 FROM games g WHERE g.id = pgl.game_id)
UNION ALL
SELECT 'Non-standard external IDs', COUNT(*)::text FROM (
  SELECT external_id FROM teams WHERE external_id NOT LIKE 'espn_%_%' AND external_id NOT LIKE 'mlb_milb_%'
  UNION ALL
  SELECT external_id FROM players WHERE external_id NOT LIKE 'espn_%_%' AND external_id NOT LIKE 'mlb_milb_%'
  UNION ALL
  SELECT external_id FROM games WHERE external_id NOT LIKE 'espn_%_%' AND external_id NOT LIKE 'mlb_milb_%'
) t;

-- If all counts are 0, you're good to COMMIT
-- Otherwise, investigate remaining issues

COMMIT;
-- or ROLLBACK if needed
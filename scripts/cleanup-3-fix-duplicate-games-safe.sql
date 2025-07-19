-- ⚾ STEP 3: FIX DUPLICATE GAMES (SAFE VERSION)
-- Handles duplicate player_game_logs entries

BEGIN;

-- Check for duplicate games
SELECT 'Checking for duplicate games...' as info;
WITH dup_games AS (
  SELECT 
    home_team_id,
    away_team_id,
    DATE(start_time) as game_date,
    COUNT(*) as count,
    array_agg(id ORDER BY id) as game_ids
  FROM games
  WHERE home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
    AND start_time IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
)
SELECT COUNT(*) as duplicate_game_groups FROM dup_games;

-- Create mapping for game merging
CREATE TEMP TABLE game_merge_map AS
WITH game_stats AS (
  SELECT 
    g.id,
    g.home_team_id,
    g.away_team_id,
    DATE(g.start_time) as game_date,
    COUNT(pgl.id) as stat_count
  FROM games g
  LEFT JOIN player_game_logs pgl ON pgl.game_id = g.id
  WHERE g.home_team_id IS NOT NULL 
    AND g.away_team_id IS NOT NULL
    AND g.start_time IS NOT NULL
  GROUP BY g.id, g.home_team_id, g.away_team_id, DATE(g.start_time)
),
best_games AS (
  SELECT DISTINCT ON (home_team_id, away_team_id, game_date)
    id as keep_id,
    home_team_id,
    away_team_id,
    game_date
  FROM game_stats
  ORDER BY home_team_id, away_team_id, game_date, stat_count DESC, id ASC
)
SELECT 
  g.id as old_id,
  bg.keep_id as new_id
FROM games g
JOIN best_games bg ON 
  g.home_team_id = bg.home_team_id
  AND g.away_team_id = bg.away_team_id
  AND DATE(g.start_time) = bg.game_date
WHERE g.id != bg.keep_id;

-- First, check for conflicting player_game_logs
SELECT 'Checking for conflicting stats...' as info;
WITH conflicts AS (
  SELECT 
    pgl1.player_id,
    m.new_id as game_id,
    COUNT(*) as conflict_count
  FROM player_game_logs pgl1
  JOIN game_merge_map m ON pgl1.game_id = m.old_id
  JOIN player_game_logs pgl2 ON pgl2.player_id = pgl1.player_id AND pgl2.game_id = m.new_id
  GROUP BY pgl1.player_id, m.new_id
)
SELECT COUNT(*) as players_with_conflicts FROM conflicts;

-- Delete stats from the games we're going to remove
-- (we keep the stats in the keeper game)
DELETE FROM player_game_logs 
WHERE game_id IN (SELECT old_id FROM game_merge_map)
  AND (player_id, game_id) IN (
    -- Only delete if there's already a stat in the keeper game
    SELECT pgl1.player_id, pgl1.game_id
    FROM player_game_logs pgl1
    JOIN game_merge_map m ON pgl1.game_id = m.old_id
    JOIN player_game_logs pgl2 ON pgl2.player_id = pgl1.player_id AND pgl2.game_id = m.new_id
  );

-- Now update remaining stats to point to keeper games
UPDATE player_game_logs SET game_id = m.new_id
FROM game_merge_map m 
WHERE player_game_logs.game_id = m.old_id
  AND NOT EXISTS (
    -- Only update if there's no conflict
    SELECT 1 FROM player_game_logs pgl2 
    WHERE pgl2.player_id = player_game_logs.player_id 
    AND pgl2.game_id = m.new_id
  );

-- Delete duplicate games
DELETE FROM games WHERE id IN (SELECT old_id FROM game_merge_map);

-- Verify
SELECT 'Remaining duplicate games:' as info, COUNT(*) as count
FROM (
  SELECT home_team_id, away_team_id, DATE(start_time)
  FROM games
  WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
  GROUP BY home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t;

DROP TABLE game_merge_map;

COMMIT;
-- ⚾ MERGE DUPLICATE GAMES BY COMBINING STATS
-- For MILB games that appear to have split stats

BEGIN;

-- First, let's handle MILB separately since it has the most issues
SELECT 'Processing MILB duplicate games...' as info;

-- Create a mapping of duplicate MILB games
CREATE TEMP TABLE milb_game_merge AS
WITH duplicate_games AS (
  SELECT 
    MIN(g.id) as keep_id,
    MAX(g.id) as remove_id,
    g.home_team_id,
    g.away_team_id,
    DATE(g.start_time) as game_date
  FROM games g
  WHERE g.sport = 'MILB'
    AND g.home_team_id IS NOT NULL 
    AND g.away_team_id IS NOT NULL
    AND g.start_time IS NOT NULL
  GROUP BY g.home_team_id, g.away_team_id, DATE(g.start_time)
  HAVING COUNT(*) = 2  -- Only handle pairs for now
)
SELECT * FROM duplicate_games;

-- Show what we're about to merge
SELECT COUNT(*) as milb_games_to_merge FROM milb_game_merge;

-- For MILB, we'll keep all stats (they seem to be different players)
-- First, update the game_id for stats in the game we're removing
UPDATE player_game_logs pgl
SET game_id = m.keep_id
FROM milb_game_merge m
WHERE pgl.game_id = m.remove_id
  -- Only update if this player doesn't already have stats in the keeper game
  AND NOT EXISTS (
    SELECT 1 FROM player_game_logs pgl2 
    WHERE pgl2.player_id = pgl.player_id 
    AND pgl2.game_id = m.keep_id
  );

-- For any remaining conflicts (same player in both games), keep the one with more stats
DELETE FROM player_game_logs pgl1
USING milb_game_merge m, player_game_logs pgl2
WHERE pgl1.game_id = m.remove_id
  AND pgl2.game_id = m.keep_id
  AND pgl1.player_id = pgl2.player_id
  AND (
    -- Delete the one with smaller stats object or smaller id if equal
    COALESCE(jsonb_typeof(pgl1.stats), 'null') = 'null'
    OR (jsonb_typeof(pgl1.stats) != 'null' AND jsonb_typeof(pgl2.stats) != 'null' AND pgl1.id > pgl2.id)
  );

-- Now we can safely delete the duplicate MILB games
DELETE FROM games WHERE id IN (SELECT remove_id FROM milb_game_merge);

DROP TABLE milb_game_merge;

-- Check if there are duplicates in other sports
SELECT 'Checking other sports for duplicates...' as info;
SELECT 
  sport,
  COUNT(*) as duplicate_groups
FROM (
  SELECT 
    sport,
    home_team_id,
    away_team_id,
    DATE(start_time) as game_date
  FROM games
  WHERE home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
    AND start_time IS NOT NULL
    AND sport != 'MILB'
  GROUP BY sport, home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t
GROUP BY sport
ORDER BY duplicate_groups DESC;

-- Handle other sports with a simpler approach (keep game with most stats)
CREATE TEMP TABLE other_game_merge AS
WITH game_stats AS (
  SELECT 
    g.id,
    g.sport,
    g.home_team_id,
    g.away_team_id,
    DATE(g.start_time) as game_date,
    COUNT(pgl.id) as stat_count,
    ROW_NUMBER() OVER (
      PARTITION BY g.sport, g.home_team_id, g.away_team_id, DATE(g.start_time)
      ORDER BY COUNT(pgl.id) DESC, g.id
    ) as rn
  FROM games g
  LEFT JOIN player_game_logs pgl ON pgl.game_id = g.id
  WHERE g.home_team_id IS NOT NULL 
    AND g.away_team_id IS NOT NULL
    AND g.start_time IS NOT NULL
    AND g.sport != 'MILB'
  GROUP BY g.id, g.sport, g.home_team_id, g.away_team_id, DATE(g.start_time)
)
SELECT 
  gs1.id as keep_id,
  gs2.id as remove_id
FROM game_stats gs1
JOIN game_stats gs2 ON 
  gs1.sport = gs2.sport
  AND gs1.home_team_id = gs2.home_team_id
  AND gs1.away_team_id = gs2.away_team_id
  AND gs1.game_date = gs2.game_date
  AND gs1.rn = 1
  AND gs2.rn > 1;

-- Delete stats from games we're removing (for other sports)
DELETE FROM player_game_logs 
WHERE game_id IN (SELECT remove_id FROM other_game_merge);

-- Delete the duplicate games
DELETE FROM games WHERE id IN (SELECT remove_id FROM other_game_merge);

DROP TABLE other_game_merge;

-- Final verification
SELECT 'Remaining duplicate games:' as info;
SELECT 
  sport,
  COUNT(*) as duplicate_count
FROM (
  SELECT 
    sport,
    home_team_id,
    away_team_id,
    DATE(start_time)
  FROM games
  WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
  GROUP BY sport, home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t
GROUP BY sport;

COMMIT;
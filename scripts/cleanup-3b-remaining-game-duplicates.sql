-- CHECK AND FIX REMAINING GAME DUPLICATES

-- First, see what duplicates remain
SELECT 'Remaining duplicate games by sport:' as info;
WITH remaining_dups AS (
  SELECT 
    sport,
    home_team_id,
    away_team_id,
    DATE(start_time) as game_date,
    COUNT(*) as game_count,
    array_agg(id ORDER BY id) as game_ids
  FROM games
  WHERE home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
    AND start_time IS NOT NULL
  GROUP BY sport, home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
)
SELECT 
  rd.sport,
  ht.name as home_team,
  at.name as away_team,
  rd.game_date,
  rd.game_count,
  rd.game_ids
FROM remaining_dups rd
JOIN teams ht ON ht.id = rd.home_team_id
JOIN teams at ON at.id = rd.away_team_id
ORDER BY rd.sport, rd.game_date;

-- Handle remaining duplicates (keep game with most stats)
BEGIN;

-- For all remaining duplicates, keep the one with most stats
WITH dup_games AS (
  SELECT 
    g.id,
    g.sport,
    g.home_team_id,
    g.away_team_id,
    DATE(g.start_time) as game_date,
    COUNT(pgl.id) as stat_count,
    ROW_NUMBER() OVER (
      PARTITION BY g.sport, g.home_team_id, g.away_team_id, DATE(g.start_time)
      ORDER BY COUNT(pgl.id) DESC, g.id ASC
    ) as rn
  FROM games g
  LEFT JOIN player_game_logs pgl ON pgl.game_id = g.id
  WHERE g.home_team_id IS NOT NULL 
    AND g.away_team_id IS NOT NULL
    AND g.start_time IS NOT NULL
  GROUP BY g.id, g.sport, g.home_team_id, g.away_team_id, DATE(g.start_time)
),
games_to_remove AS (
  SELECT id FROM dup_games WHERE rn > 1
)
-- First move any stats from games we're removing
UPDATE player_game_logs pgl
SET game_id = (
  SELECT dg1.id 
  FROM dup_games dg1
  JOIN dup_games dg2 ON 
    dg1.sport = dg2.sport
    AND dg1.home_team_id = dg2.home_team_id
    AND dg1.away_team_id = dg2.away_team_id
    AND dg1.game_date = dg2.game_date
    AND dg1.rn = 1
  WHERE dg2.id = pgl.game_id
  LIMIT 1
)
WHERE game_id IN (SELECT id FROM games_to_remove)
  AND NOT EXISTS (
    -- Only move if player doesn't have stats in keeper game
    SELECT 1 
    FROM player_game_logs pgl2
    WHERE pgl2.player_id = pgl.player_id
      AND pgl2.game_id = (
        SELECT dg1.id 
        FROM dup_games dg1
        JOIN dup_games dg2 ON 
          dg1.sport = dg2.sport
          AND dg1.home_team_id = dg2.home_team_id
          AND dg1.away_team_id = dg2.away_team_id
          AND dg1.game_date = dg2.game_date
          AND dg1.rn = 1
        WHERE dg2.id = pgl.game_id
        LIMIT 1
      )
  );

-- Delete any remaining stats from duplicate games
DELETE FROM player_game_logs 
WHERE game_id IN (
  WITH dup_games AS (
    SELECT 
      g.id,
      ROW_NUMBER() OVER (
        PARTITION BY g.sport, g.home_team_id, g.away_team_id, DATE(g.start_time)
        ORDER BY g.id ASC
      ) as rn
    FROM games g
    WHERE g.home_team_id IS NOT NULL 
      AND g.away_team_id IS NOT NULL
      AND g.start_time IS NOT NULL
  )
  SELECT id FROM dup_games WHERE rn > 1
);

-- Delete the duplicate games
DELETE FROM games 
WHERE id IN (
  WITH dup_games AS (
    SELECT 
      g.id,
      ROW_NUMBER() OVER (
        PARTITION BY g.sport, g.home_team_id, g.away_team_id, DATE(g.start_time)
        ORDER BY g.id ASC
      ) as rn
    FROM games g
    WHERE g.home_team_id IS NOT NULL 
      AND g.away_team_id IS NOT NULL
      AND g.start_time IS NOT NULL
  )
  SELECT id FROM dup_games WHERE rn > 1
);

-- Final check
SELECT 'After cleanup - total remaining duplicates:' as info;
SELECT COUNT(*) as total_duplicates
FROM (
  SELECT sport, home_team_id, away_team_id, DATE(start_time)
  FROM games
  WHERE home_team_id IS NOT NULL 
    AND away_team_id IS NOT NULL
  GROUP BY sport, home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t;

COMMIT;
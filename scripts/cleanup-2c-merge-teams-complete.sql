-- 🏀 MERGE DUPLICATE TEAMS - COMPLETE VERSION
-- Handles ALL foreign key references including player_game_logs.team_id

BEGIN;

-- Set a reasonable timeout for this operation
SET LOCAL statement_timeout = '10min';

-- First, see what we're dealing with
WITH dup_summary AS (
  SELECT 
    COUNT(DISTINCT name || '_' || sport) as duplicate_groups,
    COUNT(*) - COUNT(DISTINCT name || '_' || sport) as extras_to_remove
  FROM teams
  WHERE sport IS NOT NULL
)
SELECT * FROM dup_summary;

-- Process one sport at a time to avoid timeouts
-- Start with NFL (usually has fewer teams)
CREATE TEMP TABLE nfl_team_map AS
WITH team_ranks AS (
  SELECT 
    id,
    name,
    sport,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) as rn
  FROM teams
  WHERE sport = 'NFL'
)
SELECT 
  t1.id as old_id,
  t2.id as new_id
FROM team_ranks t1
JOIN team_ranks t2 ON t1.name = t2.name AND t2.rn = 1
WHERE t1.rn > 1;

-- Update ALL references for NFL teams
UPDATE players SET team_id = m.new_id
FROM nfl_team_map m WHERE players.team_id = m.old_id;

UPDATE games SET home_team_id = m.new_id
FROM nfl_team_map m WHERE games.home_team_id = m.old_id;

UPDATE games SET away_team_id = m.new_id
FROM nfl_team_map m WHERE games.away_team_id = m.old_id;

UPDATE player_game_logs SET opponent_id = m.new_id
FROM nfl_team_map m WHERE player_game_logs.opponent_id = m.old_id;

UPDATE player_game_logs SET team_id = m.new_id
FROM nfl_team_map m WHERE player_game_logs.team_id = m.old_id;

-- Delete NFL duplicates
DELETE FROM teams WHERE id IN (SELECT old_id FROM nfl_team_map);

DROP TABLE nfl_team_map;

-- Process NBA
CREATE TEMP TABLE nba_team_map AS
WITH team_ranks AS (
  SELECT 
    id,
    name,
    sport,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) as rn
  FROM teams
  WHERE sport = 'NBA'
)
SELECT 
  t1.id as old_id,
  t2.id as new_id
FROM team_ranks t1
JOIN team_ranks t2 ON t1.name = t2.name AND t2.rn = 1
WHERE t1.rn > 1;

UPDATE players SET team_id = m.new_id
FROM nba_team_map m WHERE players.team_id = m.old_id;

UPDATE games SET home_team_id = m.new_id
FROM nba_team_map m WHERE games.home_team_id = m.old_id;

UPDATE games SET away_team_id = m.new_id
FROM nba_team_map m WHERE games.away_team_id = m.old_id;

UPDATE player_game_logs SET opponent_id = m.new_id
FROM nba_team_map m WHERE player_game_logs.opponent_id = m.old_id;

UPDATE player_game_logs SET team_id = m.new_id
FROM nba_team_map m WHERE player_game_logs.team_id = m.old_id;

DELETE FROM teams WHERE id IN (SELECT old_id FROM nba_team_map);

DROP TABLE nba_team_map;

-- Check progress
SELECT 'Progress after NFL/NBA:' as status;
SELECT sport, COUNT(*) as teams, COUNT(DISTINCT name) as unique_names
FROM teams
WHERE sport IN ('NFL', 'NBA')
GROUP BY sport;

-- Show remaining duplicates
WITH remaining AS (
  SELECT sport, COUNT(*) as total_dups
  FROM (
    SELECT name, sport
    FROM teams
    WHERE sport IS NOT NULL
    GROUP BY name, sport
    HAVING COUNT(*) > 1
  ) t
  GROUP BY sport
)
SELECT * FROM remaining ORDER BY total_dups DESC;

COMMIT;

-- Note: Run separate scripts for MLB, NHL, and NCAA sports to avoid timeout
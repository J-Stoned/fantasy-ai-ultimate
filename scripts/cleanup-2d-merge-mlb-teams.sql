-- 🏀 MERGE MLB TEAMS
-- Process MLB teams separately

BEGIN;

-- Check MLB duplicates
SELECT 'MLB duplicate teams:' as info;
SELECT name, COUNT(*) as count
FROM teams
WHERE sport = 'MLB'
GROUP BY name
HAVING COUNT(*) > 1
ORDER BY count DESC;

-- Create mapping for MLB
CREATE TEMP TABLE mlb_team_map AS
WITH team_ranks AS (
  SELECT 
    id,
    name,
    sport,
    ROW_NUMBER() OVER (PARTITION BY name ORDER BY id) as rn
  FROM teams
  WHERE sport = 'MLB'
)
SELECT 
  t1.id as old_id,
  t2.id as new_id
FROM team_ranks t1
JOIN team_ranks t2 ON t1.name = t2.name AND t2.rn = 1
WHERE t1.rn > 1;

-- Show what will be merged
SELECT COUNT(*) as mlb_teams_to_merge FROM mlb_team_map;

-- Update all references
UPDATE players SET team_id = m.new_id
FROM mlb_team_map m WHERE players.team_id = m.old_id;

UPDATE games SET home_team_id = m.new_id
FROM mlb_team_map m WHERE games.home_team_id = m.old_id;

UPDATE games SET away_team_id = m.new_id
FROM mlb_team_map m WHERE games.away_team_id = m.old_id;

UPDATE player_game_logs SET opponent_id = m.new_id
FROM mlb_team_map m WHERE player_game_logs.opponent_id = m.old_id;

UPDATE player_game_logs SET team_id = m.new_id
FROM mlb_team_map m WHERE player_game_logs.team_id = m.old_id;

-- Delete MLB duplicates
DELETE FROM teams WHERE id IN (SELECT old_id FROM mlb_team_map);

DROP TABLE mlb_team_map;

-- Verify
SELECT 'MLB teams after cleanup:' as status;
SELECT COUNT(*) as total_teams, COUNT(DISTINCT name) as unique_teams
FROM teams WHERE sport = 'MLB';

COMMIT;
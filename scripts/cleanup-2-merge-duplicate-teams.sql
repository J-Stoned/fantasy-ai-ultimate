-- 🏀 STEP 2: MERGE DUPLICATE TEAMS
-- This script safely merges duplicate teams, updating all references

BEGIN;

-- First, let's see what duplicates we have
SELECT 'Duplicate teams found:' as info;
WITH duplicate_teams AS (
  SELECT name, sport, COUNT(*) as count, array_agg(id ORDER BY id) as ids
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) > 1
)
SELECT * FROM duplicate_teams ORDER BY count DESC LIMIT 20;

-- Create mapping table for merging
CREATE TEMP TABLE team_merge_map AS
WITH team_stats AS (
  SELECT 
    t.id,
    t.name,
    t.sport,
    t.external_id,
    COUNT(DISTINCT p.id) as player_count,
    COUNT(DISTINCT g1.id) + COUNT(DISTINCT g2.id) as game_count,
    COUNT(DISTINCT pgl.id) as stat_references
  FROM teams t
  LEFT JOIN players p ON p.team_id = t.id
  LEFT JOIN games g1 ON g1.home_team_id = t.id
  LEFT JOIN games g2 ON g2.away_team_id = t.id
  LEFT JOIN player_game_logs pgl ON pgl.opponent_id = t.id
  WHERE t.sport IS NOT NULL
  GROUP BY t.id
),
best_teams AS (
  SELECT DISTINCT ON (name, sport) 
    id as keep_id,
    name,
    sport
  FROM team_stats
  ORDER BY name, sport, 
    player_count DESC, 
    game_count DESC, 
    stat_references DESC, 
    id ASC
)
SELECT 
  t.id as old_id,
  bt.keep_id as new_id,
  t.name,
  t.sport
FROM teams t
JOIN best_teams bt ON t.name = bt.name AND t.sport = bt.sport
WHERE t.id != bt.keep_id;

-- Show what will be merged
SELECT COUNT(*) as teams_to_merge FROM team_merge_map;

-- Update all references
UPDATE players SET team_id = m.new_id
FROM team_merge_map m WHERE players.team_id = m.old_id;

UPDATE games SET home_team_id = m.new_id
FROM team_merge_map m WHERE games.home_team_id = m.old_id;

UPDATE games SET away_team_id = m.new_id
FROM team_merge_map m WHERE games.away_team_id = m.old_id;

UPDATE player_game_logs SET opponent_id = m.new_id
FROM team_merge_map m WHERE player_game_logs.opponent_id = m.old_id;

-- Delete duplicate teams
DELETE FROM teams WHERE id IN (SELECT old_id FROM team_merge_map);

-- Verify results
SELECT 'Remaining duplicates:' as info;
SELECT name, sport, COUNT(*) as count
FROM teams
WHERE sport IS NOT NULL
GROUP BY name, sport
HAVING COUNT(*) > 1;

DROP TABLE team_merge_map;

COMMIT;
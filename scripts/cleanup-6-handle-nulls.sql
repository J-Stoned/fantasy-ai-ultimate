-- 🧹 STEP 6: HANDLE NULL SPORT RECORDS
-- Clean up records with NULL sport values

BEGIN;

-- First, try to infer sport from related data
SELECT 'Attempting to infer sport values...' as info;

-- For teams, infer from games they play in
UPDATE teams t
SET sport = (
  SELECT g.sport 
  FROM games g 
  WHERE (g.home_team_id = t.id OR g.away_team_id = t.id) 
    AND g.sport IS NOT NULL 
  LIMIT 1
)
WHERE t.sport IS NULL;

-- For players, infer from their team or games
UPDATE players p
SET sport = COALESCE(
  -- First try their team's sport
  (SELECT t.sport FROM teams t WHERE t.id = p.team_id AND t.sport IS NOT NULL),
  -- Then try games they played in
  (SELECT g.sport 
   FROM player_game_logs pgl
   JOIN games g ON pgl.game_id = g.id
   WHERE pgl.player_id = p.id AND g.sport IS NOT NULL
   LIMIT 1)
)
WHERE p.sport IS NULL;

-- Check remaining NULL sports
SELECT 'Remaining NULL sport records:' as info;
SELECT 'teams' as table_name, COUNT(*) as count FROM teams WHERE sport IS NULL
UNION ALL
SELECT 'players', COUNT(*) FROM players WHERE sport IS NULL
UNION ALL
SELECT 'games', COUNT(*) FROM games WHERE sport IS NULL;

-- For remaining NULL sport records, we need to clean references first
-- Update references to NULL sport teams
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

-- Final check
SELECT 'Final NULL sport count:' as info;
SELECT 'teams' as table_name, COUNT(*) as count FROM teams WHERE sport IS NULL
UNION ALL
SELECT 'players', COUNT(*) FROM players WHERE sport IS NULL
UNION ALL
SELECT 'games', COUNT(*) FROM games WHERE sport IS NULL;

COMMIT;
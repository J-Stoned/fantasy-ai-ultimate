-- FIX WILDCATS AND NCAA TEAM ISSUES
-- Handle the specific duplicate patterns we found

BEGIN;

-- 1. Fix NBA teams that are actually college teams
-- These should be NCAA_BB teams, not NBA
UPDATE teams 
SET sport = 'NCAA_BB' 
WHERE sport = 'NBA' 
  AND name IN ('Arizona Wildcats', 'Kentucky Wildcats', 'Northwestern Wildcats', 'Villanova Wildcats');

-- Update related records
UPDATE players 
SET sport = 'NCAA_BB' 
WHERE team_id IN (
  SELECT id FROM teams 
  WHERE sport = 'NCAA_BB' 
  AND name IN ('Arizona Wildcats', 'Kentucky Wildcats', 'Northwestern Wildcats', 'Villanova Wildcats')
);

UPDATE games 
SET sport = 'NCAA_BB' 
WHERE (home_team_id IN (SELECT id FROM teams WHERE sport = 'NCAA_BB' AND name LIKE '%Wildcats') 
   OR away_team_id IN (SELECT id FROM teams WHERE sport = 'NCAA_BB' AND name LIKE '%Wildcats'))
  AND sport = 'NBA';

-- 2. Merge NCAA_BB teams with just "Wildcats" into their full-named counterparts
-- Map based on external_id numbers
CREATE TEMP TABLE wildcats_merge AS
SELECT 
  w.id as old_id,
  f.id as new_id,
  w.external_id as old_external,
  f.external_id as new_external,
  f.name as full_name
FROM teams w
JOIN teams f ON 
  -- Match the numeric part of the external_id
  REPLACE(w.external_id, 'espn_ncaabb_', '') = REPLACE(f.external_id, 'espn_', '')
  AND w.sport = 'NCAA_BB'
  AND f.sport = 'NCAA_BB'
  AND w.name = 'Wildcats'
  AND f.name LIKE '%Wildcats'
  AND f.name != 'Wildcats';

-- Update all references
UPDATE players SET team_id = m.new_id
FROM wildcats_merge m WHERE players.team_id = m.old_id;

UPDATE games SET home_team_id = m.new_id
FROM wildcats_merge m WHERE games.home_team_id = m.old_id;

UPDATE games SET away_team_id = m.new_id
FROM wildcats_merge m WHERE games.away_team_id = m.old_id;

UPDATE player_game_logs SET opponent_id = m.new_id
FROM wildcats_merge m WHERE player_game_logs.opponent_id = m.old_id;

UPDATE player_game_logs SET team_id = m.new_id
FROM wildcats_merge m WHERE player_game_logs.team_id = m.old_id;

-- Delete the generic "Wildcats" teams
DELETE FROM teams WHERE id IN (SELECT old_id FROM wildcats_merge);

DROP TABLE wildcats_merge;

-- 3. Fix NCAA_FB duplicate external_id formats
-- Keep the newer format (espn_ncaa_fb_X) and update the old format
CREATE TEMP TABLE ncaa_fb_merge AS
SELECT 
  old.id as old_id,
  new.id as new_id
FROM teams old
JOIN teams new ON 
  old.name = new.name
  AND old.sport = 'NCAA_FB'
  AND new.sport = 'NCAA_FB'
  AND old.external_id LIKE 'espn_ncaaf_%'
  AND new.external_id LIKE 'espn_ncaa_fb_%'
  AND REPLACE(old.external_id, 'espn_ncaaf_', '') = REPLACE(new.external_id, 'espn_ncaa_fb_', '');

-- Update references
UPDATE players SET team_id = m.new_id
FROM ncaa_fb_merge m WHERE players.team_id = m.old_id;

UPDATE games SET home_team_id = m.new_id
FROM ncaa_fb_merge m WHERE games.home_team_id = m.old_id;

UPDATE games SET away_team_id = m.new_id
FROM ncaa_fb_merge m WHERE games.away_team_id = m.old_id;

UPDATE player_game_logs SET opponent_id = m.new_id
FROM ncaa_fb_merge m WHERE player_game_logs.opponent_id = m.old_id;

UPDATE player_game_logs SET team_id = m.new_id
FROM ncaa_fb_merge m WHERE player_game_logs.team_id = m.old_id;

-- Delete old format teams
DELETE FROM teams WHERE id IN (SELECT old_id FROM ncaa_fb_merge);

DROP TABLE ncaa_fb_merge;

-- 4. Handle NULL sport teams - try to infer from external_id
UPDATE teams
SET sport = 'NCAA_BB'
WHERE sport IS NULL 
  AND external_id LIKE 'mens-college-basketball_%';

UPDATE teams
SET sport = 'NCAA_FB'
WHERE sport IS NULL 
  AND external_id LIKE 'college-football_%';

-- Show results
SELECT 'Cleanup complete. Remaining Wildcats teams:' as status;
SELECT sport, COUNT(*) as count, COUNT(DISTINCT name) as unique_names
FROM teams
WHERE name LIKE '%Wildcats%'
GROUP BY sport
ORDER BY sport;

COMMIT;
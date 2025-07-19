-- STEP 2: Merge generic "Wildcats" teams
-- Process one at a time to avoid timeout

BEGIN;

-- Just handle a few at a time
-- First, Weber State
UPDATE players SET team_id = 802555
WHERE team_id = 810752;  -- Generic Wildcats with espn_ncaabb_2692

UPDATE games SET home_team_id = 802555 WHERE home_team_id = 810752;
UPDATE games SET away_team_id = 802555 WHERE away_team_id = 810752;
UPDATE player_game_logs SET opponent_id = 802555 WHERE opponent_id = 810752;
UPDATE player_game_logs SET team_id = 802555 WHERE team_id = 810752;

DELETE FROM teams WHERE id = 810752;

-- Arizona
UPDATE players SET team_id = 800727 WHERE team_id = 810418;
UPDATE games SET home_team_id = 800727 WHERE home_team_id = 810418;
UPDATE games SET away_team_id = 800727 WHERE away_team_id = 810418;
UPDATE player_game_logs SET opponent_id = 800727 WHERE opponent_id = 810418;
UPDATE player_game_logs SET team_id = 800727 WHERE team_id = 810418;

DELETE FROM teams WHERE id = 810418;

-- Kentucky
UPDATE players SET team_id = 96 WHERE team_id = 810542;
UPDATE games SET home_team_id = 96 WHERE home_team_id = 810542;
UPDATE games SET away_team_id = 96 WHERE away_team_id = 810542;
UPDATE player_game_logs SET opponent_id = 96 WHERE opponent_id = 810542;
UPDATE player_game_logs SET team_id = 96 WHERE team_id = 810542;

DELETE FROM teams WHERE id = 810542;

-- Show remaining generic Wildcats
SELECT 'Remaining generic Wildcats teams:' as status;
SELECT id, external_id 
FROM teams 
WHERE sport = 'NCAA_BB' AND name = 'Wildcats';

COMMIT;
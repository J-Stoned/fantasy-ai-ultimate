-- STEP 3: Fix NCAA_FB external_id format duplicates
-- Merge espn_ncaaf_X into espn_ncaa_fb_X

BEGIN;

-- Check how many we have
SELECT 'NCAA_FB format duplicates:' as info, COUNT(*) as count
FROM teams 
WHERE sport = 'NCAA_FB' AND external_id LIKE 'espn_ncaaf_%';

-- Process a few major ones first
-- Abilene Christian
UPDATE players SET team_id = 811436 WHERE team_id = 809908;
UPDATE games SET home_team_id = 811436 WHERE home_team_id = 809908;
UPDATE games SET away_team_id = 811436 WHERE away_team_id = 809908;
UPDATE player_game_logs SET opponent_id = 811436 WHERE opponent_id = 809908;
UPDATE player_game_logs SET team_id = 811436 WHERE team_id = 809908;
DELETE FROM teams WHERE id = 809908;

-- Arizona
UPDATE players SET team_id = 811457 WHERE team_id = 809929;
UPDATE games SET home_team_id = 811457 WHERE home_team_id = 809929;
UPDATE games SET away_team_id = 811457 WHERE away_team_id = 809929;
UPDATE player_game_logs SET opponent_id = 811457 WHERE opponent_id = 809929;
UPDATE player_game_logs SET team_id = 811457 WHERE team_id = 809929;
DELETE FROM teams WHERE id = 809929;

-- Kansas State
UPDATE players SET team_id = 811685 WHERE team_id = 810157;
UPDATE games SET home_team_id = 811685 WHERE home_team_id = 810157;
UPDATE games SET away_team_id = 811685 WHERE away_team_id = 810157;
UPDATE player_game_logs SET opponent_id = 811685 WHERE opponent_id = 810157;
UPDATE player_game_logs SET team_id = 811685 WHERE team_id = 810157;
DELETE FROM teams WHERE id = 810157;

-- Kentucky
UPDATE players SET team_id = 811691 WHERE team_id = 810163;
UPDATE games SET home_team_id = 811691 WHERE home_team_id = 810163;
UPDATE games SET away_team_id = 811691 WHERE away_team_id = 810163;
UPDATE player_game_logs SET opponent_id = 811691 WHERE opponent_id = 810163;
UPDATE player_game_logs SET team_id = 811691 WHERE team_id = 810163;
DELETE FROM teams WHERE id = 810163;

-- Show progress
SELECT 'Remaining old format NCAA_FB teams:' as status, COUNT(*) as count
FROM teams 
WHERE sport = 'NCAA_FB' AND external_id LIKE 'espn_ncaaf_%';

COMMIT;
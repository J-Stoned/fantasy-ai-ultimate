-- 💣 NUKE ALL FAKE DATA - DIRECT SQL APPROACH
-- Run this in Supabase SQL Editor (SQL tab in dashboard)

-- STEP 1: Delete fake games (82,755 with NULL external_id)
BEGIN;

-- First delete any game logs for these games
DELETE FROM player_game_logs 
WHERE game_id IN (
  SELECT id FROM games WHERE external_id IS NULL
);

-- Now delete the fake games
DELETE FROM games 
WHERE external_id IS NULL;

COMMIT;

-- STEP 2: Delete test players and their data
BEGIN;

-- Get all test player IDs into a temp table
CREATE TEMP TABLE fake_player_ids AS
SELECT id FROM players 
WHERE name LIKE '%_175133%_%'
   OR name LIKE '%_1751332533434_%'
   OR name IS NULL 
   OR firstname IS NULL 
   OR lastname IS NULL
   OR name LIKE '%test%'
   OR name LIKE '%demo%'
   OR name LIKE '%sample%'
   OR name LIKE 'Player %';

-- Delete all related data
DELETE FROM player_stats WHERE player_id IN (SELECT id FROM fake_player_ids);
DELETE FROM player_injuries WHERE player_id IN (SELECT id FROM fake_player_ids);
DELETE FROM player_game_logs WHERE player_id IN (SELECT id FROM fake_player_ids);
DELETE FROM player_news WHERE player_id IN (SELECT id FROM fake_player_ids);

-- Delete the players
DELETE FROM players WHERE id IN (SELECT id FROM fake_player_ids);

DROP TABLE fake_player_ids;

COMMIT;

-- STEP 3: Clean up any orphaned stats
BEGIN;

-- Delete stats for non-existent players
DELETE FROM player_stats 
WHERE player_id NOT IN (SELECT id FROM players);

-- Delete game logs for non-existent games
DELETE FROM player_game_logs 
WHERE game_id NOT IN (SELECT id FROM games);

COMMIT;

-- STEP 4: Show final counts
SELECT 
  (SELECT COUNT(*) FROM players) as total_players,
  (SELECT COUNT(*) FROM games) as total_games,
  (SELECT COUNT(*) FROM games WHERE external_id IS NOT NULL) as valid_games,
  (SELECT COUNT(*) FROM player_stats) as total_stats,
  (SELECT COUNT(*) FROM players WHERE external_id LIKE 'sleeper_%') as nfl_players,
  (SELECT COUNT(*) FROM players WHERE external_id LIKE 'espn_ncaa_%') as ncaa_players;
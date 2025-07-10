-- 🎯 BATCH DELETE WITH PROPER TYPE HANDLING
-- Run this multiple times in Supabase SQL Editor

-- First, let's check what we're dealing with
DO $$
DECLARE
    fake_game_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO fake_game_count FROM games WHERE external_id IS NULL;
    RAISE NOTICE 'Fake games to delete: %', fake_game_count;
END $$;

-- Delete related data and games in one transaction
BEGIN;

-- Create temp table with game IDs to delete (avoiding type issues)
CREATE TEMP TABLE games_to_delete AS
SELECT id FROM games WHERE external_id IS NULL LIMIT 1000;

-- Delete from player_stats (handling type conversion if needed)
DELETE FROM player_stats 
WHERE game_id::bigint IN (SELECT id FROM games_to_delete);

-- Delete from player_game_logs (handling type conversion if needed)
DELETE FROM player_game_logs 
WHERE game_id::bigint IN (SELECT id FROM games_to_delete);

-- Delete from ml_predictions (handling type conversion if needed)
DELETE FROM ml_predictions 
WHERE game_id::bigint IN (SELECT id FROM games_to_delete);

-- Delete the games themselves
DELETE FROM games 
WHERE id IN (SELECT id FROM games_to_delete);

-- Get counts for feedback
SELECT 
    (SELECT COUNT(*) FROM games_to_delete) as deleted_in_this_batch,
    (SELECT COUNT(*) FROM games WHERE external_id IS NULL) as fake_games_remaining;

-- Clean up temp table
DROP TABLE games_to_delete;

COMMIT;
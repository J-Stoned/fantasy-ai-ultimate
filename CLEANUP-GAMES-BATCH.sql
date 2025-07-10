-- 🎯 BATCH DELETE FAKE GAMES - Run this multiple times until all fake games are gone
-- This version is optimized to avoid timeouts

DO $$
DECLARE
    batch_size INT := 100;  -- Small batch size to avoid timeouts
    deleted_games INT;
    deleted_stats INT;
    deleted_logs INT;
BEGIN
    RAISE NOTICE '🧹 Deleting batch of % fake games...', batch_size;
    
    -- Create temp table with batch of game IDs to delete
    CREATE TEMP TABLE IF NOT EXISTS batch_game_ids AS
    SELECT id FROM games 
    WHERE external_id IS NULL 
    LIMIT batch_size;
    
    -- Count what we're about to delete
    RAISE NOTICE 'Found % games to delete in this batch', (SELECT COUNT(*) FROM batch_game_ids);
    
    -- Delete related player_stats first
    DELETE FROM player_stats 
    WHERE game_id IN (SELECT id FROM batch_game_ids);
    GET DIAGNOSTICS deleted_stats = ROW_COUNT;
    
    -- Delete related player_game_logs
    DELETE FROM player_game_logs 
    WHERE game_id IN (SELECT id FROM batch_game_ids);
    GET DIAGNOSTICS deleted_logs = ROW_COUNT;
    
    -- Delete the games
    DELETE FROM games 
    WHERE id IN (SELECT id FROM batch_game_ids);
    GET DIAGNOSTICS deleted_games = ROW_COUNT;
    
    -- Report results
    RAISE NOTICE '✅ Deleted % games, % stats, % logs', deleted_games, deleted_stats, deleted_logs;
    
    DROP TABLE IF EXISTS batch_game_ids;
END $$;

-- Show current status
SELECT 
    'Current Status' as info,
    COUNT(*) as total_games,
    COUNT(CASE WHEN external_id IS NOT NULL THEN 1 END) as real_games,
    COUNT(CASE WHEN external_id IS NULL THEN 1 END) as fake_games_remaining
FROM games;
-- 🚀 CREATE A DATABASE FUNCTION FOR CLEANUP
-- This runs server-side without client timeout limits

-- Step 1: Create the cleanup function
CREATE OR REPLACE FUNCTION cleanup_all_fake_games()
RETURNS jsonb AS $$
DECLARE
    stats_deleted INT;
    logs_deleted INT;
    games_deleted INT;
    start_time TIMESTAMP;
    end_time TIMESTAMP;
BEGIN
    start_time := CURRENT_TIMESTAMP;
    
    -- Delete player_stats for fake games
    DELETE FROM player_stats 
    WHERE game_id IN (SELECT id FROM games WHERE external_id IS NULL);
    GET DIAGNOSTICS stats_deleted = ROW_COUNT;
    
    -- Delete player_game_logs for fake games
    DELETE FROM player_game_logs
    WHERE game_id IN (SELECT id FROM games WHERE external_id IS NULL);
    GET DIAGNOSTICS logs_deleted = ROW_COUNT;
    
    -- Delete fake games
    DELETE FROM games WHERE external_id IS NULL;
    GET DIAGNOSTICS games_deleted = ROW_COUNT;
    
    end_time := CURRENT_TIMESTAMP;
    
    -- Return results as JSON
    RETURN jsonb_build_object(
        'success', true,
        'stats_deleted', stats_deleted,
        'logs_deleted', logs_deleted,
        'games_deleted', games_deleted,
        'duration_seconds', EXTRACT(EPOCH FROM (end_time - start_time)),
        'completed_at', end_time
    );
EXCEPTION
    WHEN OTHERS THEN
        RETURN jsonb_build_object(
            'success', false,
            'error', SQLERRM
        );
END;
$$ LANGUAGE plpgsql;

-- Step 2: Run the function
-- SELECT cleanup_all_fake_games();

-- Step 3: Check results
-- SELECT COUNT(*) as remaining_games FROM games;
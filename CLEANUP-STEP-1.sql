-- STEP 1: Delete fake games (Run this first)
-- This deletes 1000 fake games at a time

DO $$
DECLARE
    deleted_count INT;
    total_deleted INT := 0;
BEGIN
    RAISE NOTICE 'Starting to delete fake games with NULL external_id...';
    
    -- Delete in batches of 1000
    FOR i IN 1..100 LOOP
        -- Delete related data first
        WITH games_to_delete AS (
            SELECT id FROM games 
            WHERE external_id IS NULL 
            LIMIT 1000
        )
        DELETE FROM player_stats 
        WHERE game_id IN (SELECT id FROM games_to_delete);
        
        WITH games_to_delete AS (
            SELECT id FROM games 
            WHERE external_id IS NULL 
            LIMIT 1000
        )
        DELETE FROM player_game_logs 
        WHERE game_id IN (SELECT id FROM games_to_delete);
        
        -- Now delete the games
        WITH deleted AS (
            DELETE FROM games 
            WHERE external_id IS NULL
            AND id IN (
                SELECT id FROM games 
                WHERE external_id IS NULL 
                LIMIT 1000
            )
            RETURNING *
        )
        SELECT COUNT(*) INTO deleted_count FROM deleted;
        
        -- Exit if no more games to delete
        EXIT WHEN deleted_count = 0;
        
        total_deleted := total_deleted + deleted_count;
        
        -- Progress update
        IF i % 5 = 0 THEN
            RAISE NOTICE 'Progress: Deleted % games so far...', total_deleted;
        END IF;
    END LOOP;
    
    RAISE NOTICE '✅ COMPLETE! Deleted % fake games', total_deleted;
    RAISE NOTICE 'Remaining NULL external_id games: %', 
        (SELECT COUNT(*) FROM games WHERE external_id IS NULL);
END $$;

-- Show results
SELECT 
    COUNT(*) as total_games,
    COUNT(CASE WHEN external_id IS NOT NULL THEN 1 END) as valid_games,
    COUNT(CASE WHEN external_id IS NULL THEN 1 END) as null_games
FROM games;
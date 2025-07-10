-- 🚀 EASY ONE-CLICK CLEANUP - Just run this once!

DO $$
DECLARE
    total_deleted INT := 0;
    batch_deleted INT;
BEGIN
    RAISE NOTICE '🧹 Starting automatic cleanup...';
    
    -- Keep deleting until nothing left
    LOOP
        -- Delete batch of fake games and their data
        WITH games_to_delete AS (
            SELECT id FROM games 
            WHERE external_id IS NULL 
            LIMIT 500
        ),
        deleted_stats AS (
            DELETE FROM player_stats 
            WHERE game_id IN (SELECT id FROM games_to_delete)
        ),
        deleted_logs AS (
            DELETE FROM player_game_logs 
            WHERE game_id IN (SELECT id FROM games_to_delete)
        )
        DELETE FROM games 
        WHERE id IN (SELECT id FROM games_to_delete);
        
        GET DIAGNOSTICS batch_deleted = ROW_COUNT;
        EXIT WHEN batch_deleted = 0;
        
        total_deleted := total_deleted + batch_deleted;
        RAISE NOTICE 'Deleted % games (total: %)', batch_deleted, total_deleted;
    END LOOP;
    
    RAISE NOTICE '✅ Done! Deleted % fake games total', total_deleted;
    
    -- Now clean fake players
    DELETE FROM player_stats WHERE player_id IN (
        SELECT id FROM players WHERE name LIKE '%_175133%_%' OR name IS NULL
    );
    
    DELETE FROM player_injuries WHERE player_id IN (
        SELECT id FROM players WHERE name LIKE '%_175133%_%' OR name IS NULL
    );
    
    DELETE FROM player_game_logs WHERE player_id IN (
        SELECT id FROM players WHERE name LIKE '%_175133%_%' OR name IS NULL
    );
    
    DELETE FROM players WHERE name LIKE '%_175133%_%' OR name IS NULL;
    
    RAISE NOTICE '✅ ALL CLEANUP COMPLETE!';
END $$;

-- Show what's left
SELECT 
    (SELECT COUNT(*) FROM games WHERE external_id IS NOT NULL) as real_games,
    (SELECT COUNT(*) FROM players WHERE external_id IS NOT NULL) as real_players;
-- 🔥 AGGRESSIVE CLEANUP - Delete ALL fake data NOW
-- This script is more direct and should work faster

-- First, show what we're about to delete
SELECT 
    'BEFORE CLEANUP' as status,
    (SELECT COUNT(*) FROM games WHERE external_id IS NULL) as fake_games,
    (SELECT COUNT(*) FROM players WHERE name IS NULL OR name LIKE '%_175133%_%') as fake_players,
    (SELECT COUNT(*) FROM player_stats) as total_stats;

-- STEP 1: Delete player_stats for fake games (in chunks to avoid timeout)
DO $$
DECLARE
    deleted INT;
    total INT := 0;
BEGIN
    LOOP
        DELETE FROM player_stats 
        WHERE game_id IN (
            SELECT id FROM games 
            WHERE external_id IS NULL 
            LIMIT 1000
        );
        
        GET DIAGNOSTICS deleted = ROW_COUNT;
        EXIT WHEN deleted = 0;
        
        total := total + deleted;
        RAISE NOTICE 'Deleted % player_stats (total: %)', deleted, total;
    END LOOP;
    
    RAISE NOTICE '✅ Deleted % total player_stats for fake games', total;
END $$;

-- STEP 2: Delete player_game_logs for fake games
DELETE FROM player_game_logs 
WHERE game_id IN (SELECT id FROM games WHERE external_id IS NULL);

-- STEP 3: NOW delete the fake games themselves
DO $$
DECLARE
    deleted INT;
    total INT := 0;
BEGIN
    LOOP
        DELETE FROM games 
        WHERE external_id IS NULL
        AND id IN (
            SELECT id FROM games 
            WHERE external_id IS NULL 
            LIMIT 1000
        );
        
        GET DIAGNOSTICS deleted = ROW_COUNT;
        EXIT WHEN deleted = 0;
        
        total := total + deleted;
        RAISE NOTICE 'Deleted % games (total: %)', deleted, total;
    END LOOP;
    
    RAISE NOTICE '✅ Deleted % total fake games', total;
END $$;

-- STEP 4: Clean fake players
DELETE FROM player_stats 
WHERE player_id IN (
    SELECT id FROM players 
    WHERE name LIKE '%_175133%_%' 
    OR name IS NULL 
    OR firstname IS NULL
);

DELETE FROM player_injuries
WHERE player_id IN (
    SELECT id FROM players 
    WHERE name LIKE '%_175133%_%' 
    OR name IS NULL 
    OR firstname IS NULL
);

DELETE FROM player_game_logs
WHERE player_id IN (
    SELECT id FROM players 
    WHERE name LIKE '%_175133%_%' 
    OR name IS NULL 
    OR firstname IS NULL
);

DELETE FROM players 
WHERE name LIKE '%_175133%_%' 
OR name IS NULL 
OR firstname IS NULL;

-- STEP 5: Show final results
SELECT 
    'AFTER CLEANUP' as status,
    (SELECT COUNT(*) FROM games) as total_games,
    (SELECT COUNT(*) FROM games WHERE external_id IS NOT NULL) as real_games,
    (SELECT COUNT(*) FROM players) as total_players,
    (SELECT COUNT(*) FROM player_stats) as total_stats;

-- Vacuum to reclaim space
VACUUM ANALYZE games;
VACUUM ANALYZE players;
VACUUM ANALYZE player_stats;
-- 🎯 MOST EFFICIENT DELETE APPROACH
-- Uses EXISTS clause which is optimized in PostgreSQL

-- Check current status
SELECT 
    COUNT(*) as total_games,
    COUNT(CASE WHEN external_id IS NULL THEN 1 END) as fake_games
FROM games;

-- Delete all related data for fake games using EXISTS
-- This is more efficient than IN with 82k IDs
BEGIN;

-- Delete player_stats
DELETE FROM player_stats ps
WHERE EXISTS (
    SELECT 1 FROM games g 
    WHERE g.id = ps.game_id 
    AND g.external_id IS NULL
);

-- Delete player_game_logs  
DELETE FROM player_game_logs pgl
WHERE EXISTS (
    SELECT 1 FROM games g 
    WHERE g.id = pgl.game_id 
    AND g.external_id IS NULL
);

-- Delete the games
DELETE FROM games 
WHERE external_id IS NULL;

COMMIT;

-- Verify cleanup worked
SELECT 
    COUNT(*) as remaining_games,
    COUNT(CASE WHEN external_id IS NOT NULL THEN 1 END) as real_games
FROM games;
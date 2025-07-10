-- 🎯 SIMPLE DELETE - Just Games
-- If foreign keys have CASCADE DELETE, this should work

-- Show current status
SELECT 
    COUNT(*) FILTER (WHERE external_id IS NULL) as fake_games,
    COUNT(*) FILTER (WHERE external_id IS NOT NULL) as real_games,
    COUNT(*) as total_games
FROM games;

-- Delete 1000 fake games
DELETE FROM games 
WHERE id IN (
    SELECT id 
    FROM games 
    WHERE external_id IS NULL 
    ORDER BY id 
    LIMIT 1000
);

-- Show updated status
SELECT 
    COUNT(*) FILTER (WHERE external_id IS NULL) as fake_games_remaining,
    COUNT(*) FILTER (WHERE external_id IS NOT NULL) as real_games,
    COUNT(*) as total_games
FROM games;
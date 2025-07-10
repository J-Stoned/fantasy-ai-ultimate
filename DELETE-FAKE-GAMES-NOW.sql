-- 🔥 DIRECT DELETION - NO LOOPS, JUST DELETE

-- First, let's see what we're dealing with
SELECT COUNT(*) as fake_games_count 
FROM games 
WHERE external_id IS NULL;

-- Delete related player_stats DIRECTLY (this might take a while)
DELETE FROM player_stats 
WHERE game_id IN (
    SELECT id FROM games WHERE external_id IS NULL
);

-- Delete related player_game_logs DIRECTLY
DELETE FROM player_game_logs
WHERE game_id IN (
    SELECT id FROM games WHERE external_id IS NULL
);

-- NOW DELETE ALL FAKE GAMES AT ONCE
DELETE FROM games WHERE external_id IS NULL;

-- Show results
SELECT 
    COUNT(*) as remaining_games,
    COUNT(CASE WHEN external_id IS NOT NULL THEN 1 END) as real_games
FROM games;
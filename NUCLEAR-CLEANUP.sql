-- 🚨 NUCLEAR CLEANUP OPTION - This WILL delete ALL fake data
-- Only use if batch deletion is taking too long

-- First, disable foreign key checks temporarily (if your Supabase allows it)
-- Note: This might not work in Supabase due to security restrictions

BEGIN;

-- Step 1: Clean player_stats of any references to fake games
DELETE FROM player_stats 
WHERE game_id IN (
    SELECT id FROM games WHERE external_id IS NULL
);

-- Step 2: Clean player_game_logs of any references to fake games  
DELETE FROM player_game_logs
WHERE game_id IN (
    SELECT id FROM games WHERE external_id IS NULL
);

-- Step 3: Delete all fake games
DELETE FROM games WHERE external_id IS NULL;

-- Step 4: Clean up fake players
DELETE FROM player_stats 
WHERE player_id IN (
    SELECT id FROM players 
    WHERE name LIKE '%_175133%_%'
       OR name IS NULL 
       OR firstname IS NULL
       OR name ILIKE '%test%'
);

DELETE FROM player_injuries
WHERE player_id IN (
    SELECT id FROM players 
    WHERE name LIKE '%_175133%_%'
       OR name IS NULL 
       OR firstname IS NULL
       OR name ILIKE '%test%'
);

DELETE FROM player_game_logs
WHERE player_id IN (
    SELECT id FROM players 
    WHERE name LIKE '%_175133%_%'
       OR name IS NULL 
       OR firstname IS NULL
       OR name ILIKE '%test%'
);

-- Note: Removing player_news since it doesn't exist
-- DELETE FROM player_news WHERE player_id IN (...);

DELETE FROM players 
WHERE name LIKE '%_175133%_%'
   OR name IS NULL 
   OR firstname IS NULL
   OR name ILIKE '%test%';

-- Step 5: Final cleanup of any orphaned data
DELETE FROM player_stats WHERE player_id NOT IN (SELECT id FROM players);
DELETE FROM player_stats WHERE game_id NOT IN (SELECT id FROM games);
DELETE FROM player_game_logs WHERE player_id NOT IN (SELECT id FROM players);
DELETE FROM player_game_logs WHERE game_id NOT IN (SELECT id FROM games);

COMMIT;

-- Final status report
SELECT 
    'FINAL CLEANUP RESULTS' as status,
    (SELECT COUNT(*) FROM players) as total_players,
    (SELECT COUNT(*) FROM games) as total_games,
    (SELECT COUNT(*) FROM games WHERE external_id IS NOT NULL) as real_games,
    (SELECT COUNT(*) FROM player_stats) as total_stats;
-- STEP 2: Delete fake players (FIXED - removed non-existent tables)

DO $$
DECLARE
    fake_players INT;
    fake_stats INT;
BEGIN
    RAISE NOTICE 'Deleting fake players...';
    
    -- Create temp table with fake player IDs
    CREATE TEMP TABLE IF NOT EXISTS fake_player_ids AS
    SELECT id FROM players 
    WHERE name LIKE '%_175133%_%'
       OR name LIKE '%_1751332%_%'
       OR name IS NULL 
       OR firstname IS NULL 
       OR lastname IS NULL
       OR name ILIKE '%test%'
       OR name ILIKE '%demo%'
       OR name ILIKE '%sample%'
       OR name LIKE 'Player %'
    LIMIT 5000; -- Process 5000 at a time
    
    -- Count them
    SELECT COUNT(*) INTO fake_players FROM fake_player_ids;
    RAISE NOTICE 'Found % fake players to delete', fake_players;
    
    -- Delete related data (only tables that exist)
    DELETE FROM player_stats WHERE player_id IN (SELECT id FROM fake_player_ids);
    GET DIAGNOSTICS fake_stats = ROW_COUNT;
    RAISE NOTICE 'Deleted % player stats', fake_stats;
    
    DELETE FROM player_injuries WHERE player_id IN (SELECT id FROM fake_player_ids);
    DELETE FROM player_game_logs WHERE player_id IN (SELECT id FROM fake_player_ids);
    
    -- Delete the players
    DELETE FROM players WHERE id IN (SELECT id FROM fake_player_ids);
    GET DIAGNOSTICS fake_players = ROW_COUNT;
    RAISE NOTICE '✅ Deleted % fake players', fake_players;
    
    DROP TABLE IF EXISTS fake_player_ids;
END $$;

-- Show results
SELECT 
    COUNT(*) as total_players,
    COUNT(CASE WHEN external_id LIKE 'sleeper_%' THEN 1 END) as nfl_players,
    COUNT(CASE WHEN external_id LIKE 'espn_ncaa_%' THEN 1 END) as ncaa_players,
    COUNT(CASE WHEN name IS NULL OR firstname IS NULL THEN 1 END) as players_without_names
FROM players;
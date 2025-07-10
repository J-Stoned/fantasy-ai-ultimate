-- 🚨 FIXED CLEANUP SOLUTION - RUN THIS IN SUPABASE SQL EDITOR
-- This handles ALL constraints and will delete ALL fake data

-- Create a function to delete fake games in batches
CREATE OR REPLACE FUNCTION delete_fake_games_batch(batch_size INT DEFAULT 100)
RETURNS TABLE(deleted_count INT, stats_deleted INT) AS $$
DECLARE
    game_ids INT[];
    stats_count INT;
    games_count INT;
BEGIN
    -- Get batch of fake game IDs
    SELECT ARRAY_AGG(id) INTO game_ids
    FROM games
    WHERE external_id IS NULL
    LIMIT batch_size;
    
    -- If no games found, return
    IF game_ids IS NULL THEN
        RETURN QUERY SELECT 0, 0;
        RETURN;
    END IF;
    
    -- Delete related data first (only tables that exist)
    DELETE FROM player_stats WHERE game_id = ANY(game_ids);
    GET DIAGNOSTICS stats_count = ROW_COUNT;
    
    DELETE FROM player_game_logs WHERE game_id = ANY(game_ids);
    
    -- Delete the games
    DELETE FROM games WHERE id = ANY(game_ids);
    GET DIAGNOSTICS games_count = ROW_COUNT;
    
    RETURN QUERY SELECT games_count, stats_count;
END;
$$ LANGUAGE plpgsql;

-- Create a function to delete all fake games
CREATE OR REPLACE FUNCTION delete_all_fake_games()
RETURNS TABLE(total_deleted INT, total_stats_deleted INT, batches INT) AS $$
DECLARE
    batch_result RECORD;
    total_games INT := 0;
    total_stats INT := 0;
    batch_count INT := 0;
BEGIN
    -- Loop until all fake games are deleted
    LOOP
        SELECT * INTO batch_result FROM delete_fake_games_batch(500);
        
        EXIT WHEN batch_result.deleted_count = 0;
        
        total_games := total_games + batch_result.deleted_count;
        total_stats := total_stats + batch_result.stats_deleted;
        batch_count := batch_count + 1;
        
        -- Log progress every 10 batches
        IF batch_count % 10 = 0 THEN
            RAISE NOTICE 'Progress: % batches, % games deleted, % stats deleted', 
                batch_count, total_games, total_stats;
        END IF;
    END LOOP;
    
    RETURN QUERY SELECT total_games, total_stats, batch_count;
END;
$$ LANGUAGE plpgsql;

-- EXECUTE THE CLEANUP
DO $$
DECLARE
    result RECORD;
    fake_players INT;
    fake_stats INT;
BEGIN
    RAISE NOTICE '🧹 STARTING COMPREHENSIVE FAKE DATA CLEANUP';
    
    -- Step 1: Delete fake games
    RAISE NOTICE 'Step 1: Deleting fake games with NULL external_id...';
    SELECT * INTO result FROM delete_all_fake_games();
    RAISE NOTICE '✅ Deleted % fake games and % related stats in % batches', 
        result.total_deleted, result.total_stats_deleted, result.batches;
    
    -- Step 2: Delete fake players
    RAISE NOTICE 'Step 2: Deleting fake players...';
    
    -- Create temp table with fake player IDs
    CREATE TEMP TABLE fake_player_ids AS
    SELECT id FROM players 
    WHERE name LIKE '%_175133%_%'
       OR name LIKE '%_1751332%_%'
       OR name IS NULL 
       OR firstname IS NULL 
       OR lastname IS NULL
       OR name ILIKE '%test%'
       OR name ILIKE '%demo%'
       OR name ILIKE '%sample%'
       OR name LIKE 'Player %';
    
    -- Count how many we're about to delete
    RAISE NOTICE 'Found % fake players to delete', (SELECT COUNT(*) FROM fake_player_ids);
    
    -- Delete related data
    DELETE FROM player_stats WHERE player_id IN (SELECT id FROM fake_player_ids);
    GET DIAGNOSTICS fake_stats = ROW_COUNT;
    RAISE NOTICE 'Deleted % fake player stats', fake_stats;
    
    DELETE FROM player_injuries WHERE player_id IN (SELECT id FROM fake_player_ids);
    DELETE FROM player_game_logs WHERE player_id IN (SELECT id FROM fake_player_ids);
    DELETE FROM player_news WHERE player_id IN (SELECT id FROM fake_player_ids);
    
    -- Delete the players
    DELETE FROM players WHERE id IN (SELECT id FROM fake_player_ids);
    GET DIAGNOSTICS fake_players = ROW_COUNT;
    RAISE NOTICE '✅ Deleted % fake players', fake_players;
    
    -- Step 3: Clean orphaned data
    RAISE NOTICE 'Step 3: Cleaning orphaned data...';
    DELETE FROM player_stats WHERE player_id NOT IN (SELECT id FROM players);
    DELETE FROM player_game_logs WHERE game_id NOT IN (SELECT id FROM games);
    
    -- Step 4: Report final status
    RAISE NOTICE '';
    RAISE NOTICE '✅ CLEANUP COMPLETE!';
    RAISE NOTICE '';
    RAISE NOTICE '📊 FINAL DATABASE STATUS:';
    RAISE NOTICE 'Total players remaining: %', (SELECT COUNT(*) FROM players);
    RAISE NOTICE 'Total games remaining: %', (SELECT COUNT(*) FROM games);
    RAISE NOTICE 'Games with valid external_id: %', (SELECT COUNT(*) FROM games WHERE external_id IS NOT NULL);
    RAISE NOTICE 'NFL players (Sleeper): %', (SELECT COUNT(*) FROM players WHERE external_id LIKE 'sleeper_%');
    RAISE NOTICE 'NCAA players: %', (SELECT COUNT(*) FROM players WHERE external_id LIKE 'espn_ncaa_%');
    
    DROP TABLE IF EXISTS fake_player_ids;
END $$;

-- Clean up the functions
DROP FUNCTION IF EXISTS delete_fake_games_batch;
DROP FUNCTION IF EXISTS delete_all_fake_games;

-- Show final results in a nice table
SELECT 
    'Players' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN external_id LIKE 'sleeper_%' THEN 1 END) as nfl_count,
    COUNT(CASE WHEN external_id LIKE 'espn_ncaa_%' THEN 1 END) as ncaa_count
FROM players
UNION ALL
SELECT 
    'Games' as table_name,
    COUNT(*) as total_count,
    COUNT(CASE WHEN external_id IS NOT NULL THEN 1 END) as valid_count,
    COUNT(CASE WHEN external_id IS NULL THEN 1 END) as null_count
FROM games
UNION ALL
SELECT 
    'Player Stats' as table_name,
    COUNT(*) as total_count,
    NULL as extra1,
    NULL as extra2
FROM player_stats;
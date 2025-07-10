-- 🚀 SMART CLEANUP: Save the 5% good data instead of deleting 95% bad data!

-- STEP 1: Create backup tables for REAL data only
CREATE TABLE IF NOT EXISTS games_backup AS 
SELECT * FROM games WHERE external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS player_stats_backup AS
SELECT ps.* FROM player_stats ps
JOIN games g ON ps.game_id = g.id
WHERE g.external_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS player_game_logs_backup AS
SELECT pgl.* FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.external_id IS NOT NULL;

-- Show what we're keeping
SELECT 
    'Backup Complete' as status,
    (SELECT COUNT(*) FROM games_backup) as real_games_saved,
    (SELECT COUNT(*) FROM player_stats_backup) as real_stats_saved,
    (SELECT COUNT(*) FROM player_game_logs_backup) as real_logs_saved;

-- STEP 2: TRUNCATE the original tables (instant!)
TRUNCATE TABLE player_stats CASCADE;
TRUNCATE TABLE player_game_logs CASCADE;
TRUNCATE TABLE games CASCADE;

-- STEP 3: Restore ONLY the real data
INSERT INTO games SELECT * FROM games_backup;
INSERT INTO player_stats SELECT * FROM player_stats_backup;
INSERT INTO player_game_logs SELECT * FROM player_game_logs_backup;

-- STEP 4: Drop the backup tables
DROP TABLE games_backup;
DROP TABLE player_stats_backup;
DROP TABLE player_game_logs_backup;

-- Final result
SELECT 
    'CLEANUP COMPLETE!' as status,
    COUNT(*) as total_games,
    COUNT(CASE WHEN external_id IS NOT NULL THEN 1 END) as real_games,
    COUNT(CASE WHEN external_id IS NULL THEN 1 END) as fake_games
FROM games;
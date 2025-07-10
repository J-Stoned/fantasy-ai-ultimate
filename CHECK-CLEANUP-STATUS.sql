-- 🔍 COMPREHENSIVE CLEANUP STATUS CHECK

-- Games Status
SELECT 
    '📊 GAMES STATUS' as category,
    COUNT(*) as total,
    COUNT(CASE WHEN external_id IS NOT NULL THEN 1 END) as real_games,
    COUNT(CASE WHEN external_id IS NULL THEN 1 END) as fake_games,
    ROUND(100.0 * COUNT(CASE WHEN external_id IS NULL THEN 1 END) / COUNT(*), 2) as fake_percentage
FROM games;

-- Players Status
SELECT 
    '👥 PLAYERS STATUS' as category,
    COUNT(*) as total,
    COUNT(CASE WHEN external_id LIKE 'sleeper_%' THEN 1 END) as nfl_players,
    COUNT(CASE WHEN external_id LIKE 'espn_ncaa_%' THEN 1 END) as ncaa_players,
    COUNT(CASE WHEN name IS NULL OR firstname IS NULL THEN 1 END) as incomplete_players,
    COUNT(CASE WHEN name LIKE '%_175133%_%' OR name LIKE '%test%' THEN 1 END) as test_players
FROM players;

-- Player Stats Status
SELECT 
    '📈 PLAYER STATS STATUS' as category,
    COUNT(*) as total_stats,
    COUNT(DISTINCT player_id) as unique_players,
    COUNT(DISTINCT game_id) as unique_games,
    ROUND(AVG(fantasy_points), 2) as avg_fantasy_points
FROM player_stats;

-- Check for orphaned data
SELECT 
    '⚠️  ORPHANED DATA CHECK' as category,
    (SELECT COUNT(*) FROM player_stats ps WHERE NOT EXISTS (SELECT 1 FROM players p WHERE p.id = ps.player_id)) as orphaned_stats,
    (SELECT COUNT(*) FROM player_stats ps WHERE NOT EXISTS (SELECT 1 FROM games g WHERE g.id = ps.game_id)) as stats_without_games,
    (SELECT COUNT(*) FROM player_game_logs pgl WHERE NOT EXISTS (SELECT 1 FROM games g WHERE g.id = pgl.game_id)) as logs_without_games;

-- Sample of fake games to understand the pattern
SELECT 
    '🔍 SAMPLE FAKE GAMES' as info,
    id, 
    home_team_id, 
    away_team_id, 
    scheduled_at,
    external_id
FROM games 
WHERE external_id IS NULL 
LIMIT 5;
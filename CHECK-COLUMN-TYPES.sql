-- Check the actual data types of columns
SELECT 
    table_name,
    column_name,
    data_type,
    udt_name
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name IN ('games', 'player_stats', 'player_game_logs', 'ml_predictions')
AND column_name IN ('id', 'game_id', 'player_id')
ORDER BY table_name, column_name;
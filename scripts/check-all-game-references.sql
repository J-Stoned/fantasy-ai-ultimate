-- CHECK ALL TABLES THAT REFERENCE GAMES
-- Complete list of foreign key constraints

SELECT 
  tc.table_name,
  kcu.column_name,
  tc.constraint_name,
  COUNT(*) OVER() as total_constraints
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'games'
ORDER BY tc.table_name;

-- Check row counts for all tables with game_id
SELECT 'Row counts for tables with game references:' as info;
SELECT 
  'player_game_logs' as table_name, COUNT(*) as total_rows
FROM player_game_logs
UNION ALL
SELECT 'advanced_player_metrics', COUNT(*) FROM advanced_player_metrics
UNION ALL
SELECT 'betting_lines', COUNT(*) FROM betting_lines
UNION ALL
SELECT 'weather_data', COUNT(*) FROM weather_data
UNION ALL
SELECT 'player_stats', COUNT(*) FROM player_stats
ORDER BY total_rows DESC;
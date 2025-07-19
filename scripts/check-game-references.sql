-- CHECK ALL TABLES THAT REFERENCE GAMES
-- Find all foreign key constraints pointing to games table

SELECT 
  tc.table_name,
  kcu.column_name,
  tc.constraint_name
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

-- Also check which of these tables have data
SELECT 'Tables with game references and row counts:' as info;
SELECT 
  'player_game_logs' as table_name, 
  COUNT(DISTINCT game_id) as games_referenced,
  COUNT(*) as total_rows
FROM player_game_logs
UNION ALL
SELECT 
  'advanced_player_metrics', 
  COUNT(DISTINCT game_id),
  COUNT(*)
FROM advanced_player_metrics
UNION ALL
SELECT 
  'betting_lines', 
  COUNT(DISTINCT game_id),
  COUNT(*)
FROM betting_lines
UNION ALL
SELECT 
  'weather_data', 
  COUNT(DISTINCT game_id),
  COUNT(*)
FROM weather_data;
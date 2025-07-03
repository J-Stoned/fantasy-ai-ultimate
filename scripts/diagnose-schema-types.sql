-- Diagnostic queries to understand current schema types

-- 1. Check data types of key tables
SELECT 
  t.table_name,
  c.column_name,
  c.data_type,
  c.udt_name
FROM information_schema.tables t
JOIN information_schema.columns c ON t.table_name = c.table_name
WHERE t.table_schema = 'public'
  AND t.table_name IN ('players', 'games', 'teams', 'player_stats', 'player_game_logs')
  AND c.column_name IN ('id', 'player_id', 'game_id', 'team_id')
ORDER BY t.table_name, c.ordinal_position;

-- 2. Check if player_game_logs exists and its structure
SELECT 
  'player_game_logs exists' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'player_game_logs'
  ) as result;

-- 3. Check specific column types in player_game_logs
SELECT 
  column_name,
  data_type,
  udt_name,
  is_nullable
FROM information_schema.columns
WHERE table_name = 'player_game_logs'
  AND column_name IN ('id', 'player_id', 'game_id')
ORDER BY ordinal_position;

-- 4. Sample data to verify actual types
SELECT 
  'players.id type' as check_name,
  pg_typeof(id) as actual_type
FROM players
LIMIT 1;

-- 5. Check for any UUID columns in players table
SELECT 
  column_name,
  data_type
FROM information_schema.columns
WHERE table_name = 'players'
  AND data_type = 'uuid';

-- 6. List all foreign key constraints
SELECT
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  col.data_type AS local_type,
  fcol.data_type AS foreign_type
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.columns col
  ON col.table_name = tc.table_name 
  AND col.column_name = kcu.column_name
JOIN information_schema.columns fcol
  ON fcol.table_name = ccu.table_name 
  AND fcol.column_name = ccu.column_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_name IN ('player_game_logs', 'player_stats');
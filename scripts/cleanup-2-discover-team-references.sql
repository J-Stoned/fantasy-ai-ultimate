-- 🔍 DISCOVER ALL TEAM REFERENCES
-- First, let's find ALL columns that reference teams

-- Check information schema for foreign keys
SELECT 
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  tc.constraint_name
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND ccu.table_name = 'teams'
ORDER BY tc.table_name, kcu.column_name;

-- Also check for any column named %team% that might reference teams
SELECT 
  table_name,
  column_name,
  data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND column_name LIKE '%team%'
ORDER BY table_name, column_name;

-- Count references in each table
SELECT 'References to teams:' as info;
SELECT 'players.team_id' as reference, COUNT(*) as count 
FROM players WHERE team_id IS NOT NULL
UNION ALL
SELECT 'games.home_team_id', COUNT(*) 
FROM games WHERE home_team_id IS NOT NULL
UNION ALL
SELECT 'games.away_team_id', COUNT(*) 
FROM games WHERE away_team_id IS NOT NULL
UNION ALL
SELECT 'player_game_logs.opponent_id', COUNT(*) 
FROM player_game_logs WHERE opponent_id IS NOT NULL
UNION ALL
SELECT 'player_game_logs.team_id', COUNT(*) 
FROM player_game_logs WHERE team_id IS NOT NULL;
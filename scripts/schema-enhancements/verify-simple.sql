-- Simple verification script that works in Supabase
-- Returns all checks in a single result set

SELECT 
  'Columns' as category,
  'players.external_id' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'external_id'
  ) as exists

UNION ALL

SELECT 
  'Columns' as category,
  'players.team' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'team'
  ) as exists

UNION ALL

SELECT 
  'Columns' as category,
  'players.sport' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'sport'
  ) as exists

UNION ALL

SELECT 
  'Columns' as category,
  'games.external_id' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'games' AND column_name = 'external_id'
  ) as exists

UNION ALL

SELECT 
  'Tables' as category,
  'player_platform_mapping' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'player_platform_mapping'
  ) as exists

UNION ALL

SELECT 
  'Tables' as category,
  'player_game_logs' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'player_game_logs'
  ) as exists

UNION ALL

SELECT 
  'Tables' as category,
  'player_season_stats' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'player_season_stats'
  ) as exists

UNION ALL

SELECT 
  'Functions' as category,
  'get_player_stats_for_game' as check_name,
  EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_player_stats_for_game'
  ) as exists

UNION ALL

SELECT 
  'Functions' as category,
  'update_updated_at' as check_name,
  EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'update_updated_at'
  ) as exists

UNION ALL

SELECT 
  'Functions' as category,
  'search_players_simple' as check_name,
  EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'search_players_simple'
  ) as exists

UNION ALL

SELECT 
  'Indexes' as category,
  'idx_players_external_id' as check_name,
  EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE indexname = 'idx_players_external_id'
  ) as exists

UNION ALL

SELECT 
  'Views' as category,
  'v_player_all_stats' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.views 
    WHERE table_name = 'v_player_all_stats'
  ) as exists

ORDER BY category, check_name;
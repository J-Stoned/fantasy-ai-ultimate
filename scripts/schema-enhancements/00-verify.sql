-- Verification queries to check if enhancements were applied
-- Run this after applying all parts to verify success

SELECT 'Checking schema enhancements...' as status;

-- Check if new columns exist
SELECT 
  'players.external_id' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'external_id'
  ) as exists;

-- Check if new tables exist
SELECT 
  'player_platform_mapping table' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'player_platform_mapping'
  ) as exists;

SELECT 
  'player_game_logs table' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'player_game_logs'
  ) as exists;

-- Check data types are correct
SELECT 
  'player_game_logs.player_id is INTEGER' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'player_game_logs' 
    AND column_name = 'player_id'
    AND data_type = 'integer'
  ) as correct;

-- Count records
SELECT 
  'players with team names' as check_name,
  COUNT(*) as count
FROM players 
WHERE team IS NOT NULL AND team != '';

-- Check if functions exist
SELECT 
  'get_player_stats_for_game function' as check_name,
  EXISTS (
    SELECT 1 FROM pg_proc 
    WHERE proname = 'get_player_stats_for_game'
  ) as exists;
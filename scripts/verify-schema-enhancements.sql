
-- Verification queries to check if enhancements were applied
SELECT 
  'players_external_id' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'players' AND column_name = 'external_id'
  ) as passed
UNION ALL
SELECT 
  'player_platform_mapping_table' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'player_platform_mapping'
  ) as passed
UNION ALL
SELECT 
  'player_game_logs_table' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'player_game_logs'
  ) as passed
UNION ALL
SELECT 
  'player_season_stats_table' as check_name,
  EXISTS (
    SELECT 1 FROM information_schema.tables 
    WHERE table_name = 'player_season_stats'
  ) as passed;

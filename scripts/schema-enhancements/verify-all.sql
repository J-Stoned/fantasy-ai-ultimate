-- Unified verification script that returns all results in one table
-- This avoids the issue where Supabase only shows the last result set

WITH checks AS (
  -- Check new columns
  SELECT 
    1 as check_order,
    'Columns' as category,
    'players.external_id column' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' AND column_name = 'external_id'
      ) THEN '✅ EXISTS'
      ELSE '❌ MISSING'
    END as status,
    '' as details
  
  UNION ALL
  
  SELECT 
    2 as check_order,
    'Columns' as category,
    'players.team column' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'players' AND column_name = 'team'
      ) THEN '✅ EXISTS'
      ELSE '❌ MISSING'
    END as status,
    '' as details
    
  UNION ALL
  
  SELECT 
    3 as check_order,
    'Columns' as category,
    'games.external_id column' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'games' AND column_name = 'external_id'
      ) THEN '✅ EXISTS'
      ELSE '❌ MISSING'
    END as status,
    '' as details
  
  -- Check new tables
  UNION ALL
  
  SELECT 
    4 as check_order,
    'Tables' as category,
    'player_platform_mapping table' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'player_platform_mapping'
      ) THEN '✅ EXISTS'
      ELSE '❌ MISSING'
    END as status,
    '' as details
  
  UNION ALL
  
  SELECT 
    5 as check_order,
    'Tables' as category,
    'player_game_logs table' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'player_game_logs'
      ) THEN '✅ EXISTS'
      ELSE '❌ MISSING'
    END as status,
    '' as details
    
  UNION ALL
  
  SELECT 
    6 as check_order,
    'Tables' as category,
    'player_season_stats table' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.tables 
        WHERE table_name = 'player_season_stats'
      ) THEN '✅ EXISTS'
      ELSE '❌ MISSING'
    END as status,
    '' as details
  
  -- Check data types
  UNION ALL
  
  SELECT 
    7 as check_order,
    'Data Types' as category,
    'player_game_logs.player_id type' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'player_game_logs' 
        AND column_name = 'player_id'
        AND data_type = 'integer'
      ) THEN '✅ INTEGER'
      WHEN EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'player_game_logs' 
        AND column_name = 'player_id'
      ) THEN '❌ WRONG TYPE'
      ELSE '❌ TABLE MISSING'
    END as status,
    COALESCE(
      (SELECT data_type FROM information_schema.columns 
       WHERE table_name = 'player_game_logs' AND column_name = 'player_id'),
      'N/A'
    ) as details
  
  -- Check functions
  UNION ALL
  
  SELECT 
    8 as check_order,
    'Functions' as category,
    'get_player_stats_for_game function' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'get_player_stats_for_game'
      ) THEN '✅ EXISTS'
      ELSE '❌ MISSING'
    END as status,
    '' as details
    
  UNION ALL
  
  SELECT 
    9 as check_order,
    'Functions' as category,
    'search_players_simple function' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_proc 
        WHERE proname = 'search_players_simple'
      ) THEN '✅ EXISTS'
      ELSE '❌ MISSING'
    END as status,
    '' as details
  
  -- Check indexes
  UNION ALL
  
  SELECT 
    10 as check_order,
    'Indexes' as category,
    'idx_players_external_id index' as check_name,
    CASE 
      WHEN EXISTS (
        SELECT 1 FROM pg_indexes 
        WHERE indexname = 'idx_players_external_id'
      ) THEN '✅ EXISTS'
      ELSE '❌ MISSING'
    END as status,
    '' as details
)
SELECT category, check_name, status, details
FROM checks
ORDER BY check_order;

-- Additional summary query
SELECT 
  '📊 SUMMARY' as category,
  'Total Enhancements' as check_name,
  COUNT(*) || ' checks' as status,
  COUNT(CASE WHEN status LIKE '✅%' THEN 1 END) || ' passed, ' || 
  COUNT(CASE WHEN status LIKE '❌%' THEN 1 END) || ' failed' as details
FROM checks;

-- Data counts
SELECT 
  '📈 DATA COUNTS' as category,
  'Players with team names' as check_name,
  COUNT(*)::TEXT as status,
  ROUND(COUNT(*)::NUMERIC / NULLIF((SELECT COUNT(*) FROM players), 0) * 100, 1) || '% have team names' as details
FROM players 
WHERE team IS NOT NULL AND team != ''

UNION ALL

SELECT 
  '📈 DATA COUNTS' as category,
  'Players with external IDs' as check_name,
  COUNT(*)::TEXT as status,
  ROUND(COUNT(*)::NUMERIC / NULLIF((SELECT COUNT(*) FROM players), 0) * 100, 1) || '% have external IDs' as details
FROM players 
WHERE external_id IS NOT NULL

UNION ALL

SELECT 
  '📈 DATA COUNTS' as category,
  'Games with external IDs' as check_name,
  COUNT(*)::TEXT as status,
  ROUND(COUNT(*)::NUMERIC / NULLIF((SELECT COUNT(*) FROM games), 0) * 100, 1) || '% have external IDs' as details
FROM games 
WHERE external_id IS NOT NULL

UNION ALL

SELECT 
  '📈 DATA COUNTS' as category,
  'Player game logs entries' as check_name,
  COALESCE((SELECT COUNT(*) FROM player_game_logs)::TEXT, '0') as status,
  CASE 
    WHEN EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'player_game_logs')
    THEN 'Table exists'
    ELSE 'Table missing'
  END as details;
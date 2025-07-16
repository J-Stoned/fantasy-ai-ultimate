-- COMPREHENSIVE DATABASE DATA CHECK
-- Run this in Supabase SQL Editor for a complete overview

-- 1. Overall Table Summary
WITH table_counts AS (
  SELECT 
    'sports' as table_name, COUNT(*) as count FROM sports
  UNION ALL
  SELECT 'leagues', COUNT(*) FROM leagues
  UNION ALL
  SELECT 'teams_master', COUNT(*) FROM teams_master
  UNION ALL
  SELECT 'players', COUNT(*) FROM players
  UNION ALL
  SELECT 'games', COUNT(*) FROM games
  UNION ALL
  SELECT 'player_stats', COUNT(*) FROM player_stats
  UNION ALL
  SELECT 'player_injuries', COUNT(*) FROM player_injuries
  UNION ALL
  SELECT 'news_articles', COUNT(*) FROM news_articles
  UNION ALL
  SELECT 'betting_lines', COUNT(*) FROM betting_lines
  UNION ALL
  SELECT 'fantasy_projections', COUNT(*) FROM fantasy_projections
  UNION ALL
  SELECT 'player_game_logs', COUNT(*) FROM player_game_logs
  UNION ALL
  SELECT 'social_mentions', COUNT(*) FROM social_mentions
)
SELECT 
  table_name,
  count,
  CASE 
    WHEN count = 0 THEN '❌ EMPTY'
    WHEN count < 100 THEN '⚠️  Low Data'
    ELSE '✅ OK'
  END as status
FROM table_counts
ORDER BY count DESC;

-- 2. Sports Breakdown
SELECT 
  s.name as sport,
  s.sport_type,
  COUNT(DISTINCT l.id) as leagues,
  COUNT(DISTINCT t.id) as teams,
  COUNT(DISTINCT p.id) as players,
  COUNT(DISTINCT g.id) as games
FROM sports s
LEFT JOIN leagues l ON s.id = l.sport_id
LEFT JOIN teams_master t ON l.id = t.league_id
LEFT JOIN players p ON s.id = p.sport_id
LEFT JOIN games g ON s.id = g.sport_id
GROUP BY s.id, s.name, s.sport_type
ORDER BY s.name;

-- 3. NBA Specific Data Check
WITH nba_sport AS (
  SELECT id FROM sports WHERE sport_type = 'basketball' LIMIT 1
),
nba_league AS (
  SELECT id FROM leagues WHERE abbreviation = 'NBA' LIMIT 1
)
SELECT 
  'NBA Teams' as category,
  COUNT(*) as count
FROM teams_master t
JOIN nba_league nl ON t.league_id = nl.id
UNION ALL
SELECT 
  'NBA Players',
  COUNT(*)
FROM players p
JOIN nba_sport ns ON p.sport_id = ns.id
WHERE p.current_league_id IN (SELECT id FROM nba_league)
UNION ALL
SELECT 
  'NBA Games (Last 30 days)',
  COUNT(*)
FROM games g
JOIN nba_sport ns ON g.sport_id = ns.id
WHERE g.game_date >= CURRENT_DATE - INTERVAL '30 days'
UNION ALL
SELECT 
  'NBA Player Stats (Current Season)',
  COUNT(*)
FROM player_stats ps
JOIN players p ON ps.player_id = p.id
JOIN nba_sport ns ON p.sport_id = ns.id
WHERE ps.season = EXTRACT(YEAR FROM CURRENT_DATE);

-- 4. Recent Data Activity (Last 7 Days)
SELECT 
  'New Players' as activity,
  COUNT(*) as count
FROM players
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
UNION ALL
SELECT 
  'New Games',
  COUNT(*)
FROM games
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
UNION ALL
SELECT 
  'New Stats',
  COUNT(*)
FROM player_stats
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
UNION ALL
SELECT 
  'New Injuries',
  COUNT(*)
FROM player_injuries
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days'
UNION ALL
SELECT 
  'New News',
  COUNT(*)
FROM news_articles
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- 5. Data Quality Check
SELECT 
  'Players without team' as issue,
  COUNT(*) as count
FROM players
WHERE current_team_id IS NULL AND status = 'active'
UNION ALL
SELECT 
  'Games without scores',
  COUNT(*)
FROM games
WHERE game_date < CURRENT_DATE 
  AND (final_score_home IS NULL OR final_score_away IS NULL)
UNION ALL
SELECT 
  'Players without stats',
  COUNT(*)
FROM players p
WHERE NOT EXISTS (
  SELECT 1 FROM player_stats ps WHERE ps.player_id = p.id
)
AND p.status = 'active';

-- 6. Top 10 Players by Stats Entries
SELECT 
  p.full_name,
  p.jersey_number,
  t.name as team,
  COUNT(ps.id) as stat_entries
FROM players p
LEFT JOIN teams_master t ON p.current_team_id = t.id
LEFT JOIN player_stats ps ON p.id = ps.player_id
GROUP BY p.id, p.full_name, p.jersey_number, t.name
ORDER BY stat_entries DESC
LIMIT 10;

-- 7. Games Schedule Overview
SELECT 
  DATE_TRUNC('week', game_date) as week,
  COUNT(*) as games_count,
  COUNT(DISTINCT sport_id) as sports_count
FROM games
WHERE game_date >= CURRENT_DATE - INTERVAL '30 days'
  AND game_date <= CURRENT_DATE + INTERVAL '30 days'
GROUP BY DATE_TRUNC('week', game_date)
ORDER BY week;

-- 8. Fantasy Data Coverage
SELECT 
  'Fantasy Leagues' as category,
  COUNT(*) as count
FROM fantasy_leagues
WHERE is_active = true
UNION ALL
SELECT 
  'Fantasy Teams',
  COUNT(*)
FROM fantasy_teams ft
JOIN fantasy_leagues fl ON ft.league_id = fl.id
WHERE fl.is_active = true
UNION ALL
SELECT 
  'Fantasy Projections',
  COUNT(*)
FROM fantasy_projections
WHERE created_at >= CURRENT_DATE - INTERVAL '7 days';

-- 9. API and System Health
SELECT 
  'Total Users' as metric,
  COUNT(*) as value
FROM user_profiles
UNION ALL
SELECT 
  'Active Platform Connections',
  COUNT(*)
FROM platform_connections
WHERE is_active = true
UNION ALL
SELECT 
  'Recent Imports (7 days)',
  COUNT(*)
FROM import_history
WHERE started_at >= CURRENT_DATE - INTERVAL '7 days';

-- 10. Grand Summary
SELECT 
  SUM(count) as total_records,
  COUNT(*) as tables_checked,
  COUNT(CASE WHEN count > 0 THEN 1 END) as tables_with_data,
  COUNT(CASE WHEN count = 0 THEN 1 END) as empty_tables
FROM (
  SELECT COUNT(*) as count FROM sports
  UNION ALL SELECT COUNT(*) FROM leagues
  UNION ALL SELECT COUNT(*) FROM teams_master
  UNION ALL SELECT COUNT(*) FROM players
  UNION ALL SELECT COUNT(*) FROM games
  UNION ALL SELECT COUNT(*) FROM player_stats
  UNION ALL SELECT COUNT(*) FROM player_injuries
  UNION ALL SELECT COUNT(*) FROM news_articles
  UNION ALL SELECT COUNT(*) FROM betting_lines
  UNION ALL SELECT COUNT(*) FROM fantasy_projections
) counts;
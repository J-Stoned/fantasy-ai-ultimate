-- ANALYZE GAME DUPLICATES AND CONFLICTS
-- Let's see exactly what's causing the issue

-- First, find the specific problematic case
SELECT 'Analyzing the specific conflict:' as info;
SELECT 
  pgl.id,
  pgl.player_id,
  pgl.game_id,
  p.name as player_name,
  g.home_team_id,
  g.away_team_id,
  g.start_time,
  g.sport
FROM player_game_logs pgl
JOIN players p ON p.id = pgl.player_id
JOIN games g ON g.id = pgl.game_id
WHERE pgl.player_id = 121672110
  AND pgl.game_id IN (
    SELECT g2.id
    FROM games g1
    JOIN games g2 ON g1.home_team_id = g2.home_team_id 
      AND g1.away_team_id = g2.away_team_id
      AND DATE(g1.start_time) = DATE(g2.start_time)
    WHERE g1.id = 3863839
  );

-- Check how many stats would have conflicts
SELECT 'Total potential conflicts:' as info;
WITH duplicate_games AS (
  SELECT 
    g1.id as game1_id,
    g2.id as game2_id,
    g1.home_team_id,
    g1.away_team_id,
    DATE(g1.start_time) as game_date
  FROM games g1
  JOIN games g2 ON g1.home_team_id = g2.home_team_id 
    AND g1.away_team_id = g2.away_team_id
    AND DATE(g1.start_time) = DATE(g2.start_time)
    AND g1.id < g2.id
  WHERE g1.home_team_id IS NOT NULL 
    AND g1.away_team_id IS NOT NULL
),
stat_conflicts AS (
  SELECT 
    dg.game1_id,
    dg.game2_id,
    COUNT(DISTINCT pgl1.player_id) as players_in_game1,
    COUNT(DISTINCT pgl2.player_id) as players_in_game2,
    COUNT(DISTINCT CASE WHEN pgl1.player_id = pgl2.player_id THEN pgl1.player_id END) as conflicting_players
  FROM duplicate_games dg
  LEFT JOIN player_game_logs pgl1 ON pgl1.game_id = dg.game1_id
  LEFT JOIN player_game_logs pgl2 ON pgl2.game_id = dg.game2_id
  GROUP BY dg.game1_id, dg.game2_id
)
SELECT 
  COUNT(*) as duplicate_game_pairs,
  SUM(conflicting_players) as total_conflicts,
  SUM(players_in_game1 + players_in_game2) as total_stats_affected
FROM stat_conflicts;

-- Show some example conflicts
SELECT 'Example conflicts (first 10):' as info;
WITH duplicate_games AS (
  SELECT 
    g1.id as game1_id,
    g2.id as game2_id,
    g1.sport,
    g1.home_team_id,
    g1.away_team_id,
    g1.start_time
  FROM games g1
  JOIN games g2 ON g1.home_team_id = g2.home_team_id 
    AND g1.away_team_id = g2.away_team_id
    AND DATE(g1.start_time) = DATE(g2.start_time)
    AND g1.id < g2.id
  WHERE g1.home_team_id IS NOT NULL 
    AND g1.away_team_id IS NOT NULL
)
SELECT 
  dg.sport,
  dg.game1_id,
  dg.game2_id,
  ht.name as home_team,
  at.name as away_team,
  DATE(dg.start_time) as game_date,
  (SELECT COUNT(*) FROM player_game_logs WHERE game_id = dg.game1_id) as stats_in_game1,
  (SELECT COUNT(*) FROM player_game_logs WHERE game_id = dg.game2_id) as stats_in_game2
FROM duplicate_games dg
JOIN teams ht ON ht.id = dg.home_team_id
JOIN teams at ON at.id = dg.away_team_id
ORDER BY dg.sport, dg.start_time
LIMIT 10;
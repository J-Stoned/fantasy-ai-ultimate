-- 🏀 STEP 2: MERGE DUPLICATE TEAMS (OPTIMIZED VERSION)
-- This version processes duplicates in smaller batches to avoid timeouts

BEGIN;

-- First, let's see how many duplicates we have
WITH duplicate_counts AS (
  SELECT name, sport, COUNT(*) as count
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) > 1
)
SELECT 
  COUNT(*) as duplicate_groups,
  SUM(count - 1) as total_duplicates_to_remove
FROM duplicate_counts;

-- Process only the worst offenders first (teams with 3+ duplicates)
CREATE TEMP TABLE high_priority_merges AS
WITH team_stats AS (
  SELECT 
    t.id,
    t.name,
    t.sport,
    COUNT(DISTINCT p.id) as player_count
  FROM teams t
  LEFT JOIN players p ON p.team_id = t.id
  WHERE t.sport IS NOT NULL
  GROUP BY t.id
),
duplicate_groups AS (
  SELECT name, sport
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) >= 3  -- Only process teams with 3+ duplicates
),
best_teams AS (
  SELECT DISTINCT ON (ts.name, ts.sport) 
    ts.id as keep_id,
    ts.name,
    ts.sport
  FROM team_stats ts
  JOIN duplicate_groups dg ON ts.name = dg.name AND ts.sport = dg.sport
  ORDER BY ts.name, ts.sport, ts.player_count DESC, ts.id ASC
)
SELECT 
  t.id as old_id,
  bt.keep_id as new_id
FROM teams t
JOIN best_teams bt ON t.name = bt.name AND t.sport = bt.sport
WHERE t.id != bt.keep_id;

-- Show what we're about to merge
SELECT COUNT(*) as high_priority_teams_to_merge FROM high_priority_merges;

-- Update references for high priority merges only
UPDATE players p
SET team_id = m.new_id
FROM high_priority_merges m 
WHERE p.team_id = m.old_id;

UPDATE games g
SET home_team_id = m.new_id
FROM high_priority_merges m 
WHERE g.home_team_id = m.old_id;

UPDATE games g
SET away_team_id = m.new_id
FROM high_priority_merges m 
WHERE g.away_team_id = m.old_id;

-- For player_game_logs, update in batches
UPDATE player_game_logs pgl
SET opponent_id = m.new_id
FROM high_priority_merges m 
WHERE pgl.opponent_id = m.old_id
  AND pgl.id IN (
    SELECT id FROM player_game_logs 
    WHERE opponent_id IN (SELECT old_id FROM high_priority_merges)
    LIMIT 10000
  );

-- Delete the high priority duplicates
DELETE FROM teams 
WHERE id IN (SELECT old_id FROM high_priority_merges);

DROP TABLE high_priority_merges;

-- Show remaining duplicates
WITH remaining_dups AS (
  SELECT name, sport, COUNT(*) as count
  FROM teams
  WHERE sport IS NOT NULL
  GROUP BY name, sport
  HAVING COUNT(*) > 1
)
SELECT 
  COUNT(*) as remaining_duplicate_groups,
  SUM(count - 1) as remaining_duplicates
FROM remaining_dups;

COMMIT;

-- Note: If there are still duplicates remaining, you can run this script again
-- or use the batch processing script for the remaining duplicates
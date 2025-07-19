-- 🔨 BATCH SQL FIX FOR NCAA BASEBALL PLAYERS
-- Much faster than processing one by one

BEGIN;

-- Step 1: Create temp table of conflicts
CREATE TEMP TABLE ncaa_conflicts AS
SELECT 
  p1.id as old_id,
  p1.name as old_name,
  p1.external_id as old_external_id,
  p2.id as new_id,
  p2.name as new_name,
  REPLACE(p1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_') as target_external_id
FROM players p1
JOIN players p2 ON p2.external_id = REPLACE(p1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE p1.sport = 'NCAA_BASEBALL' 
  AND p1.external_id LIKE 'espn_ncaa_%' 
  AND p1.external_id NOT LIKE 'espn_ncaa_baseball_%'
  AND p1.id != p2.id;

-- Show conflict count
SELECT 'Found conflicts:' as info, COUNT(*) as count FROM ncaa_conflicts;

-- Step 2: For conflicts, check who has stats
CREATE TEMP TABLE conflict_stats AS
SELECT 
  nc.*,
  COALESCE(old_stats.stat_count, 0) as old_stat_count,
  COALESCE(new_stats.stat_count, 0) as new_stat_count
FROM ncaa_conflicts nc
LEFT JOIN (
  SELECT player_id, COUNT(*) as stat_count 
  FROM player_game_logs 
  GROUP BY player_id
) old_stats ON old_stats.player_id = nc.old_id
LEFT JOIN (
  SELECT player_id, COUNT(*) as stat_count 
  FROM player_game_logs 
  GROUP BY player_id
) new_stats ON new_stats.player_id = nc.new_id;

-- Show sample
SELECT 'Sample conflicts with stats:' as info;
SELECT * FROM conflict_stats LIMIT 10;

-- Step 3: Delete players with no stats when there's a duplicate with stats
DELETE FROM players
WHERE id IN (
  SELECT 
    CASE 
      WHEN old_stat_count = 0 AND new_stat_count > 0 THEN old_id
      WHEN old_stat_count > 0 AND new_stat_count = 0 THEN new_id
      WHEN old_stat_count = 0 AND new_stat_count = 0 AND old_id < new_id THEN old_id
      ELSE NULL
    END
  FROM conflict_stats
  WHERE CASE 
      WHEN old_stat_count = 0 AND new_stat_count > 0 THEN old_id
      WHEN old_stat_count > 0 AND new_stat_count = 0 THEN new_id
      WHEN old_stat_count = 0 AND new_stat_count = 0 AND old_id < new_id THEN old_id
      ELSE NULL
    END IS NOT NULL
);

-- Show delete count
SELECT 'Deleted duplicate players:' as info, ROW_COUNT() as count;

-- Step 4: Update remaining old format players (no conflicts)
UPDATE players
SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_%' 
  AND external_id NOT LIKE 'espn_ncaa_baseball_%'
  AND NOT EXISTS (
    SELECT 1 FROM players p2 
    WHERE p2.external_id = REPLACE(players.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
    AND p2.id != players.id
  );

-- Show update count
SELECT 'Updated player IDs:' as info, ROW_COUNT() as count;

-- Step 5: Final check
SELECT 'Remaining NCAA Baseball players with old format:' as info;
SELECT COUNT(*) as remaining
FROM players
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_%' 
  AND external_id NOT LIKE 'espn_ncaa_baseball_%';

-- Clean up
DROP TABLE IF EXISTS ncaa_conflicts;
DROP TABLE IF EXISTS conflict_stats;

COMMIT;
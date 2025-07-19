-- 🏁 CLEANUP 5 SUMMARY - CHECK FINAL STATE

-- Summary of ID standardization
SELECT 'ID STANDARDIZATION SUMMARY' as info;

-- Teams
SELECT 'Teams by ID format:' as metric;
SELECT 
  CASE 
    WHEN external_id LIKE 'espn_%_%' THEN 'Standardized ESPN'
    WHEN external_id LIKE 'mlb_milb_%' THEN 'MLB MiLB format'
    WHEN external_id ~ '^[0-9]+$' THEN 'Numeric only'
    WHEN external_id IS NULL THEN 'NULL'
    ELSE 'Other'
  END as id_format,
  COUNT(*) as count
FROM teams
GROUP BY id_format
ORDER BY count DESC;

-- Players  
SELECT 'Players by ID format:' as metric;
SELECT 
  CASE 
    WHEN external_id LIKE 'espn_%_%' THEN 'Standardized ESPN'
    WHEN external_id LIKE 'mlb_milb_%' THEN 'MLB MiLB format'
    WHEN external_id ~ '^[0-9]+$' THEN 'Numeric only'
    WHEN external_id LIKE 'espn_ncaa_%' AND external_id NOT LIKE 'espn_ncaa_baseball_%' 
         AND sport = 'NCAA_BASEBALL' THEN 'NCAA Baseball Old Format'
    WHEN external_id IS NULL THEN 'NULL'
    ELSE 'Other'
  END as id_format,
  COUNT(*) as count
FROM players
GROUP BY id_format
ORDER BY count DESC;

-- Games
SELECT 'Games by ID format:' as metric;
SELECT 
  CASE 
    WHEN external_id LIKE 'espn_%_%' THEN 'Standardized ESPN'
    WHEN external_id LIKE 'mlb_milb_%' THEN 'MLB MiLB format'
    WHEN external_id ~ '^[0-9]+$' THEN 'Numeric only'
    WHEN external_id IS NULL THEN 'NULL'
    ELSE 'Other'
  END as id_format,
  COUNT(*) as count
FROM games
GROUP BY id_format
ORDER BY count DESC;

-- Check teams per sport
SELECT 'Teams per sport:' as info;
SELECT sport, COUNT(*) as team_count
FROM teams
GROUP BY sport
ORDER BY team_count DESC;

-- Show remaining non-standard IDs
SELECT 'Remaining non-standard team IDs:' as info;
SELECT id, name, sport, external_id
FROM teams
WHERE external_id ~ '^[0-9]+$'
   OR external_id IS NULL
   OR (external_id NOT LIKE 'espn_%_%' AND external_id NOT LIKE 'mlb_milb_%')
LIMIT 20;

-- NCAA Baseball status
SELECT 'NCAA Baseball ID status:' as info;
SELECT 
  'Players with old format' as type,
  COUNT(*) as count
FROM players
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_%' 
  AND external_id NOT LIKE 'espn_ncaa_baseball_%'
UNION ALL
SELECT 
  'Players with new format',
  COUNT(*)
FROM players
WHERE sport = 'NCAA_BASEBALL' 
  AND external_id LIKE 'espn_ncaa_baseball_%';

-- Final counts
SELECT 'FINAL COUNTS:' as info;
SELECT 
  'Total Teams' as entity,
  COUNT(*) as count
FROM teams
UNION ALL
SELECT 'Total Players', COUNT(*) FROM players
UNION ALL
SELECT 'Total Games', COUNT(*) FROM games;
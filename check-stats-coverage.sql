-- Diagnostic query to check what stats we have

-- 1. Show count by sport
SELECT sport, COUNT(*) as stat_count 
FROM stat_definitions 
GROUP BY sport
ORDER BY sport;

-- 2. Show which sports are missing
SELECT 
  sport_name,
  CASE 
    WHEN sd.count IS NULL THEN 'MISSING'
    ELSE sd.count::text || ' stats'
  END as status
FROM (
  VALUES 
    ('NBA'), ('NFL'), ('MLB'), ('NHL'), ('MLS'),
    ('NCAA_BB'), ('NCAA_FB'), ('NCAA_BSB'), ('NCAA_HKY'), ('NCAA_SOC')
) AS expected_sports(sport_name)
LEFT JOIN (
  SELECT sport, COUNT(*) as count
  FROM stat_definitions
  GROUP BY sport
) sd ON expected_sports.sport_name = sd.sport;

-- 3. Show category breakdown for existing sports
SELECT sport, stat_category, COUNT(*) as count
FROM stat_definitions
WHERE sport IN ('NBA', 'NFL', 'MLB', 'NHL', 'MLS')
GROUP BY sport, stat_category
ORDER BY sport, stat_category;

-- 4. Check if NCAA sports were populated
SELECT 
  'NCAA Sports Present:' as check_type,
  COUNT(DISTINCT sport) as ncaa_sports_count,
  STRING_AGG(DISTINCT sport, ', ' ORDER BY sport) as ncaa_sports_list
FROM stat_definitions
WHERE sport LIKE 'NCAA%';

-- 5. Total unique stats by category
SELECT 
  stat_category,
  COUNT(*) as total_stats,
  COUNT(DISTINCT sport) as sports_with_category
FROM stat_definitions
GROUP BY stat_category
ORDER BY total_stats DESC;
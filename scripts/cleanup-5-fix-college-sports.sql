-- FIX COLLEGE TEAMS MARKED AS NBA
-- These are clearly college teams, not NBA teams

BEGIN;

-- Show all college teams incorrectly marked as NBA
SELECT 'College teams marked as NBA:' as info;
SELECT id, name, sport, external_id
FROM teams
WHERE sport = 'NBA'
  AND (
    name LIKE '%University%'
    OR name LIKE '%College%'
    OR name LIKE '%State%'
    OR name LIKE '%Bruins'
    OR name LIKE '%Tigers'
    OR name LIKE '%Razorbacks'
    OR name LIKE '%Trojans'
    OR name LIKE '%Sun Devils'
    OR name LIKE '%Blazers'
    OR name LIKE '%Cardinal'
    OR name LIKE '%Tritons'
    OR name LIKE '%Golden Bears'
    OR name LIKE '%Eagles'
    OR name LIKE '%Wildcats'
    OR name LIKE '%Bulldogs'
    OR name LIKE '%Aggies'
    OR name LIKE '%Spartans'
    OR name LIKE '%Wolverines'
    OR name LIKE '%Buckeyes'
    OR name LIKE '%Crimson Tide'
    OR name LIKE '%Seminoles'
    OR name LIKE '%Hurricanes'
    OR name LIKE '%Tar Heels'
    OR name LIKE '%Blue Devils'
    OR name LIKE '%Hoyas'
    OR name LIKE '%Huskies'
    OR name LIKE '%Cougars'
    OR name LIKE '%Bears'
    OR name LIKE '%Panthers'
    OR name LIKE '%Knights'
  )
ORDER BY name;

-- Fix all college teams to NCAA_BB
UPDATE teams
SET sport = 'NCAA_BB'
WHERE sport = 'NBA'
  AND (
    name LIKE '%University%'
    OR name LIKE '%College%'
    OR name LIKE '%State%'
    OR name LIKE '%Bruins'
    OR name LIKE '%Tigers'
    OR name LIKE '%Razorbacks'
    OR name LIKE '%Trojans'
    OR name LIKE '%Sun Devils'
    OR name LIKE '%Blazers'
    OR name LIKE '%Cardinal'
    OR name LIKE '%Tritons'
    OR name LIKE '%Golden Bears'
    OR name LIKE '%Eagles'
    OR name LIKE '%Wildcats'
    OR name LIKE '%Bulldogs'
    OR name LIKE '%Aggies'
    OR name LIKE '%Spartans'
    OR name LIKE '%Wolverines'
    OR name LIKE '%Buckeyes'
    OR name LIKE '%Crimson Tide'
    OR name LIKE '%Seminoles'
    OR name LIKE '%Hurricanes'
    OR name LIKE '%Tar Heels'
    OR name LIKE '%Blue Devils'
    OR name LIKE '%Hoyas'
    OR name LIKE '%Huskies'
    OR name LIKE '%Cougars'
    OR name LIKE '%Bears'
    OR name LIKE '%Panthers'
    OR name LIKE '%Knights'
  );

-- Also check for any obvious NBA teams that should stay NBA
SELECT 'Verifying real NBA teams:' as info;
SELECT id, name, sport, external_id
FROM teams
WHERE sport = 'NBA'
  AND name IN (
    'Los Angeles Lakers', 'Boston Celtics', 'Golden State Warriors',
    'Chicago Bulls', 'Miami Heat', 'San Antonio Spurs',
    'Philadelphia 76ers', 'Detroit Pistons', 'Houston Rockets',
    'New York Knicks', 'Brooklyn Nets', 'Milwaukee Bucks',
    'Phoenix Suns', 'Denver Nuggets', 'Portland Trail Blazers',
    'Utah Jazz', 'Oklahoma City Thunder', 'Dallas Mavericks',
    'Los Angeles Clippers', 'Memphis Grizzlies', 'Toronto Raptors',
    'Indiana Pacers', 'Charlotte Hornets', 'Orlando Magic',
    'Washington Wizards', 'Atlanta Hawks', 'Cleveland Cavaliers',
    'New Orleans Pelicans', 'Minnesota Timberwolves', 'Sacramento Kings'
  );

-- Now we can safely fix numeric IDs for teams
UPDATE teams
SET external_id = 
  CASE 
    WHEN sport = 'NCAA_BB' THEN 'espn_ncaabb_' || external_id
    WHEN sport = 'NFL' THEN 'espn_nfl_' || external_id
    WHEN sport = 'NBA' THEN 'espn_nba_' || external_id
    WHEN sport = 'MLB' THEN 'espn_mlb_' || external_id
    WHEN sport = 'NHL' THEN 'espn_nhl_' || external_id
    ELSE external_id
  END
WHERE external_id ~ '^[0-9]+$';

-- Show results
SELECT 'Teams with standardized IDs by sport:' as info;
SELECT sport, COUNT(*) as count
FROM teams
WHERE external_id LIKE 'espn_%'
GROUP BY sport
ORDER BY count DESC;

COMMIT;
-- 🧹 CLEANUP SYNTHETIC DATA
-- Keep only real data from APIs

BEGIN;

-- Delete synthetic players (those without external_id starting with real API prefixes)
DELETE FROM players 
WHERE external_id IS NULL 
   OR (external_id NOT LIKE 'balldontlie_%' 
       AND external_id NOT LIKE 'espn_%' 
       AND external_id NOT LIKE 'sportsradar_%'
       AND external_id NOT LIKE 'mysportsfeeds_%');

-- Delete synthetic games
DELETE FROM games 
WHERE external_id IS NULL 
   OR (external_id NOT LIKE 'balldontlie_%' 
       AND external_id NOT LIKE 'espn_%' 
       AND external_id NOT LIKE 'odds_api_%'
       AND external_id NOT LIKE 'sportsradar_%');

-- Delete synthetic news (keep real ones from APIs)
DELETE FROM news_articles 
WHERE source NOT IN (
    'The Odds API', 
    'OpenWeather', 
    'ESPN NBA', 
    'ESPN NFL',
    'ESPN MLB',
    'ESPN NHL',
    'ESPN SOCCER',
    'BallDontLie Live',
    'reddit'
) 
AND source NOT LIKE 'r/%'
AND source NOT LIKE 'ESPN %';

-- Keep all weather data (it's real from OpenWeather)
-- Keep all betting odds (they're real from The Odds API)
-- Keep all AI insights (they're generated from real data)

-- Show remaining counts
SELECT 'Players' as table_name, COUNT(*) as count FROM players
UNION ALL
SELECT 'Games', COUNT(*) FROM games
UNION ALL
SELECT 'News Articles', COUNT(*) FROM news_articles
UNION ALL
SELECT 'Weather Conditions', COUNT(*) FROM weather_conditions
UNION ALL
SELECT 'Betting Odds', COUNT(*) FROM betting_odds
UNION ALL
SELECT 'AI Insights', COUNT(*) FROM ai_insights;

COMMIT;
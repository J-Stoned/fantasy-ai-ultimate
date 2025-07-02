-- Check all table counts
SELECT 'player_stats' as table_name, COUNT(*) as count FROM player_stats
UNION ALL
SELECT 'weather_data', COUNT(*) FROM weather_data
UNION ALL
SELECT 'injuries', COUNT(*) FROM injuries
UNION ALL
SELECT 'games', COUNT(*) FROM games
UNION ALL
SELECT 'players', COUNT(*) FROM players
UNION ALL
SELECT 'teams', COUNT(*) FROM teams
UNION ALL
SELECT 'news_articles', COUNT(*) FROM news_articles
UNION ALL
SELECT 'betting_odds', COUNT(*) FROM betting_odds
UNION ALL
SELECT 'ml_predictions', COUNT(*) FROM ml_predictions
UNION ALL
SELECT 'correlation_insights', COUNT(*) FROM correlation_insights
UNION ALL
SELECT 'fantasy_rankings', COUNT(*) FROM fantasy_rankings
UNION ALL
SELECT 'trending_players', COUNT(*) FROM trending_players
UNION ALL
SELECT 'player_projections', COUNT(*) FROM player_projections
UNION ALL
SELECT 'dfs_salaries', COUNT(*) FROM dfs_salaries
UNION ALL
SELECT 'api_usage', COUNT(*) FROM api_usage
UNION ALL
SELECT 'breaking_news', COUNT(*) FROM breaking_news
UNION ALL
SELECT 'video_content', COUNT(*) FROM video_content
ORDER BY count DESC;

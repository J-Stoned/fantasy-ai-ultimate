-- Import all Fantasy AI data
-- Run this after importing the schema

\echo 'Importing Fantasy AI data...'
\echo '============================='

\echo 'Importing sports...'
\i sports.sql
\echo 'Importing teams...'
\i teams.sql
\echo 'Importing players...'
\i players.sql
\echo 'Importing games...'
\i games.sql
\echo 'Importing player_game_logs...'
\i player_game_logs.sql
\echo 'Importing player_stats...'
\i player_stats.sql
\echo 'Importing betting_lines...'
\i betting_lines.sql
\echo 'Importing weather_data...'
\i weather_data.sql
\echo 'Importing player_injuries...'
\i player_injuries.sql
\echo 'Importing enhanced_synergies...'
\i enhanced_synergies.sql
\echo 'Importing team_synergy_stats...'
\i team_synergy_stats.sql
\echo 'Importing pattern_performance...'
\i pattern_performance.sql
\echo 'Importing ml_predictions...'
\i ml_predictions.sql
\echo 'Importing fantasy_betting_insights...'
\i fantasy_betting_insights.sql

\echo '============================='
\echo 'Import complete!'
\echo 'Running ANALYZE to update statistics...'

ANALYZE sports;
ANALYZE teams;
ANALYZE players;
ANALYZE games;
ANALYZE player_game_logs;
ANALYZE player_stats;
ANALYZE betting_lines;
ANALYZE weather_data;
ANALYZE player_injuries;
ANALYZE enhanced_synergies;
ANALYZE team_synergy_stats;
ANALYZE pattern_performance;
ANALYZE ml_predictions;
ANALYZE fantasy_betting_insights;

\echo 'All done! Your local database is ready.'

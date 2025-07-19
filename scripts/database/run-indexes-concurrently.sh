#!/bin/bash
# Run indexes with CONCURRENTLY option outside of transaction blocks
# This prevents table locking during index creation

echo "🔥 APPLYING FANTASY AI PERFORMANCE INDEXES (CONCURRENT MODE)"
echo "==========================================================="
echo ""

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo "❌ ERROR: DATABASE_URL environment variable not set"
    echo "Please set: export DATABASE_URL='your_database_url'"
    exit 1
fi

echo "Creating indexes without locking tables..."
echo "This may take several minutes but won't block queries."
echo ""

# Part 1: Player game logs indexes
echo "📊 Creating player_game_logs indexes..."

psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pgl_game_team ON player_game_logs(game_id, team_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pgl_player_game ON player_game_logs(player_id, game_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pgl_created ON player_game_logs(created_at DESC);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pgl_game_date ON player_game_logs(game_date);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pgl_game_team_player ON player_game_logs(game_id, team_id, player_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pgl_game_fantasy ON player_game_logs(game_id, fantasy_points DESC);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pgl_stats_gin ON player_game_logs USING GIN (stats);"

echo "✅ Player game logs indexes complete"
echo ""

# Part 2: Games table indexes
echo "🎮 Creating games table indexes..."

psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_external ON games(external_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_sport_id_time ON games(sport_id, start_time DESC);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_teams ON games(home_team_id, away_team_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_status ON games(status);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_teams_composite ON games(home_team_id, away_team_id, sport_id, start_time DESC);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_upcoming ON games(start_time, sport_id) WHERE start_time >= CURRENT_TIMESTAMP;"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_metadata_gin ON games USING GIN (metadata);"

echo "✅ Games indexes complete"
echo ""

# Part 3: Players and teams indexes
echo "👥 Creating players and teams indexes..."

psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_external ON players(external_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_team ON players(team_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_sport_id ON players(sport_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_name ON players(firstname, lastname);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_metadata_gin ON players USING GIN (metadata);"

psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_external ON teams(external_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_sport_id ON teams(sport_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_teams_abbreviation ON teams(abbreviation);"

echo "✅ Players and teams indexes complete"
echo ""

# Part 4: ML enrichment indexes
echo "🤖 Creating ML enrichment indexes..."

psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_betting_lines_game ON betting_lines(game_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_betting_lines_created ON betting_lines(created_at DESC);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_betting_lines_timestamp ON betting_lines(timestamp);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_weather_data_game ON weather_data(game_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_injuries_player ON player_injuries(player_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_injuries_created ON player_injuries(created_at DESC);"

echo "✅ ML enrichment indexes complete"
echo ""

# Part 5: Pattern detection indexes
echo "🎯 Creating pattern detection indexes..."

psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_synergy_team ON team_synergy_stats(team_id);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_synergy_hash ON team_synergy_stats(lineup_hash);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_synergy_size ON team_synergy_stats(lineup_size);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_team_synergy_context ON team_synergy_stats(context_type, lineup_size);"

psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pattern_performance_accuracy ON pattern_performance(accuracy_rate DESC);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pattern_performance_sport_accuracy ON pattern_performance(sport, accuracy_rate DESC);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_pattern_performance_pattern_type ON pattern_performance(pattern_type);"

psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_predictions_game_model ON ml_predictions(game_id, model_name);"
psql $DATABASE_URL -c "CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ml_predictions_confidence ON ml_predictions(confidence DESC);"

echo "✅ Pattern detection indexes complete"
echo ""

# Update statistics
echo "📊 Updating table statistics..."
psql $DATABASE_URL -c "ANALYZE player_game_logs, games, players, teams, betting_lines, weather_data, player_injuries;"

echo ""
echo "==========================================================="
echo "✅ ALL INDEXES CREATED SUCCESSFULLY!"
echo ""
echo "To check index usage:"
echo "psql \$DATABASE_URL -c \"SELECT tablename, indexname, idx_scan FROM pg_stat_user_indexes WHERE schemaname = 'public' ORDER BY idx_scan DESC LIMIT 20;\"" 
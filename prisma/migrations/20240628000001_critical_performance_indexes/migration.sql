-- Critical Performance Indexes for Production Load

-- Fantasy Teams - High traffic queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fantasy_teams_user_league_season 
ON fantasy_teams(userId, leagueId, season);

-- Player Stats - Most common query pattern
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_stats_player_season_week 
ON player_stats(playerId, season, week);

-- Players - Position queries (GIN index for array)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_position 
ON players USING GIN(position);

-- Games - Gameday queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_date_teams 
ON games(gameDate, homeTeamId, awayTeamId);

-- User queries with platform
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_fantasy_teams_user_platform_active 
ON fantasy_teams(userId, platform) WHERE isActive = true;

-- Player injuries for active players
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_injuries_player_date 
ON player_injuries(playerId, injuryDate) WHERE status != 'healthy';

-- Contest entries for quick lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_contest_entries_user_contest 
ON contest_entries(userId, contestId);

-- PlayerStats JSON optimization (GIN index)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_stats_stats_gin 
ON player_stats USING GIN(stats);

-- Composite index for waiver processing
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_waiver_claims_league_process_time 
ON waiver_claims(leagueId, processTime) WHERE status = 'pending';

-- Trade deadline queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_trades_league_deadline 
ON trades(leagueId, createdAt) WHERE status = 'pending';

-- Draft optimization
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_draft_picks_draft_round_pick 
ON draft_picks(draftId, round, pickNumber);

-- Real-time game updates
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_games_status_date 
ON games(status, gameDate) WHERE status IN ('in_progress', 'scheduled');

-- MCP service logs for monitoring
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_mcp_logs_service_timestamp 
ON mcp_service_logs(serviceId, timestamp);

-- Voice conversation lookups
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_voice_sessions_user_created 
ON voice_sessions(userId, createdAt);

-- Performance: Partial indexes for hot paths
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_players_active_position 
ON players(position) WHERE isActive = true;

-- NFL Sunday specific index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_game_logs_date_player 
ON player_game_logs(gameDate, playerId) 
WHERE gameDate >= CURRENT_DATE - INTERVAL '7 days';

-- Statistics and analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_player_stats_fantasy_points 
ON player_stats((stats->>'fantasy_points_ppr')::float) 
WHERE season = EXTRACT(YEAR FROM CURRENT_DATE);

-- Add table statistics for query planner
ANALYZE fantasy_teams;
ANALYZE player_stats;
ANALYZE players;
ANALYZE games;
ANALYZE contest_entries;
ANALYZE trades;
ANALYZE draft_picks;
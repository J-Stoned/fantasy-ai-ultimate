-- Part 3: Create indexes
-- Run this after part 2

-- Indexes for external_id columns
CREATE INDEX IF NOT EXISTS idx_players_external_id ON players(external_id);
CREATE INDEX IF NOT EXISTS idx_games_external_id ON games(external_id);
CREATE INDEX IF NOT EXISTS idx_teams_external_id ON teams(external_id);

-- Indexes for new tables
CREATE INDEX IF NOT EXISTS idx_player_platform_mapping_lookup 
  ON player_platform_mapping(platform, platform_player_id);
  
CREATE INDEX IF NOT EXISTS idx_player_game_logs_player_game 
  ON player_game_logs(player_id, game_id);
  
CREATE INDEX IF NOT EXISTS idx_player_game_logs_date 
  ON player_game_logs(game_date DESC);
  
CREATE INDEX IF NOT EXISTS idx_player_season_stats_lookup 
  ON player_season_stats(player_id, season DESC);

-- GIN indexes for JSONB columns (these are optional, add if needed for performance)
-- CREATE INDEX IF NOT EXISTS idx_players_metadata ON players USING gin(metadata);
-- CREATE INDEX IF NOT EXISTS idx_games_metadata ON games USING gin(metadata);
-- CREATE INDEX IF NOT EXISTS idx_player_game_logs_stats ON player_game_logs USING gin(stats);
-- CREATE INDEX IF NOT EXISTS idx_player_season_stats_stats ON player_season_stats USING gin(stats);
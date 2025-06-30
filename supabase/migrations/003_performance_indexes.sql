-- Performance Indexes for Fantasy AI Ultimate
-- Optimized for Small Supabase instance

-- ===== PLAYERS TABLE INDEXES =====
-- Most critical table - will have millions of records

-- Composite index for common player queries
CREATE INDEX idx_players_sport_league_status ON players(sport_id, current_league_id, status);

-- Partial index for active players only (90% of queries)
CREATE INDEX idx_players_active ON players(sport_id, current_league_id) 
WHERE status = 'active';

-- Index for name searches (case-insensitive)
CREATE INDEX idx_players_name_lower ON players(LOWER(full_name));

-- GIN index for full text search
CREATE INDEX idx_players_search ON players USING gin(to_tsvector('english', 
  COALESCE(full_name, '') || ' ' || 
  COALESCE(display_name, '') || ' ' || 
  COALESCE(search_tags, '')
));

-- ===== PLAYER STATS INDEXES =====
-- Second most queried table

-- Composite index for stat lookups
CREATE INDEX idx_player_stats_lookup ON player_stats(player_id, season DESC, season_type);

-- Partial index for current season stats
CREATE INDEX idx_player_stats_current ON player_stats(player_id, stat_type) 
WHERE season = EXTRACT(YEAR FROM CURRENT_DATE);

-- GIN index for JSON stats queries
CREATE INDEX idx_player_stats_json ON player_stats USING gin(stats);

-- ===== PLAYER GAME LOGS INDEXES =====
-- For recent game queries

CREATE INDEX idx_game_logs_player_date ON player_game_logs(player_id, game_date DESC);

-- Partial index for last 30 days
CREATE INDEX idx_game_logs_recent ON player_game_logs(player_id, game_date DESC) 
WHERE game_date > CURRENT_DATE - INTERVAL '30 days';

-- ===== FANTASY PLATFORM INDEXES =====

-- Platform mapping for cross-platform lookups
CREATE INDEX idx_platform_mapping ON player_platform_mapping(player_id, platform);
CREATE INDEX idx_platform_external ON player_platform_mapping(platform, external_id);

-- Fantasy leagues and teams
CREATE INDEX idx_fantasy_leagues_active ON fantasy_leagues(platform, user_id) 
WHERE is_active = true;
CREATE INDEX idx_fantasy_teams_lookup ON fantasy_teams(league_id, user_id);

-- ===== INJURY AND NEWS INDEXES =====

CREATE INDEX idx_injuries_active ON player_injuries(player_id, status) 
WHERE return_date IS NULL OR return_date > CURRENT_DATE;

CREATE INDEX idx_news_recent ON player_news(player_id, published_date DESC);

-- ===== TEAM AND LEAGUE INDEXES =====

CREATE INDEX idx_teams_league ON teams_master(league_id);
CREATE INDEX idx_teams_name ON teams_master(LOWER(name), LOWER(city));

-- ===== USER ACTIVITY INDEXES =====

CREATE INDEX idx_user_profiles_user ON user_profiles(user_id);
CREATE INDEX idx_user_profiles_username ON user_profiles(LOWER(username));

-- ===== MATERIALIZED VIEWS FOR EXPENSIVE QUERIES =====

-- Player season stats summary (refresh daily)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_player_current_season_stats AS
SELECT 
  p.id,
  p.full_name,
  p.current_team_id,
  p.sport_id,
  ps.season,
  ps.games_played,
  ps.stats,
  ps.fantasy_points_total
FROM players p
JOIN player_stats ps ON p.id = ps.player_id
WHERE ps.season = EXTRACT(YEAR FROM CURRENT_DATE)
  AND ps.season_type = 'regular'
  AND p.status = 'active';

CREATE INDEX idx_mv_player_stats_id ON mv_player_current_season_stats(id);
CREATE INDEX idx_mv_player_stats_team ON mv_player_current_season_stats(current_team_id);

-- Top performers by position (refresh hourly)
CREATE MATERIALIZED VIEW IF NOT EXISTS mv_top_performers_by_position AS
SELECT 
  p.id,
  p.full_name,
  p.position,
  p.sport_id,
  p.current_team_id,
  ps.fantasy_points_total,
  ROW_NUMBER() OVER (PARTITION BY p.sport_id, p.position ORDER BY ps.fantasy_points_total DESC) as rank
FROM players p
JOIN player_stats ps ON p.id = ps.player_id
WHERE ps.season = EXTRACT(YEAR FROM CURRENT_DATE)
  AND ps.season_type = 'regular'
  AND p.status = 'active'
  AND ps.games_played > 0;

CREATE INDEX idx_mv_top_performers ON mv_top_performers_by_position(sport_id, position, rank);

-- ===== DATABASE FUNCTIONS FOR COMPLEX QUERIES =====

-- Function to get player with all related data
CREATE OR REPLACE FUNCTION get_player_full_data(player_uuid UUID)
RETURNS TABLE (
  player JSONB,
  current_stats JSONB,
  recent_games JSONB,
  injury_status JSONB,
  fantasy_info JSONB
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    to_jsonb(p.*) as player,
    to_jsonb(ps.*) as current_stats,
    COALESCE(
      jsonb_agg(DISTINCT jsonb_build_object(
        'date', pgl.game_date,
        'opponent', pgl.opponent,
        'stats', pgl.stats
      )) FILTER (WHERE pgl.game_date IS NOT NULL),
      '[]'::jsonb
    ) as recent_games,
    to_jsonb(pi.*) as injury_status,
    jsonb_build_object(
      'platforms', COALESCE(
        jsonb_agg(DISTINCT jsonb_build_object(
          'platform', ppm.platform,
          'external_id', ppm.external_id
        )) FILTER (WHERE ppm.platform IS NOT NULL),
        '[]'::jsonb
      )
    ) as fantasy_info
  FROM players p
  LEFT JOIN player_stats ps ON p.id = ps.player_id 
    AND ps.season = EXTRACT(YEAR FROM CURRENT_DATE)
    AND ps.season_type = 'regular'
  LEFT JOIN player_game_logs pgl ON p.id = pgl.player_id 
    AND pgl.game_date > CURRENT_DATE - INTERVAL '10 days'
  LEFT JOIN player_injuries pi ON p.id = pi.player_id 
    AND pi.is_active = true
  LEFT JOIN player_platform_mapping ppm ON p.id = ppm.player_id
  WHERE p.id = player_uuid
  GROUP BY p.id, ps.player_id, ps.season, ps.season_type, pi.id;
END;
$$ LANGUAGE plpgsql;

-- Function for fuzzy player search
CREATE OR REPLACE FUNCTION search_players_fuzzy(
  search_term TEXT,
  sport_filter UUID DEFAULT NULL,
  result_limit INTEGER DEFAULT 25
)
RETURNS TABLE (
  id UUID,
  full_name TEXT,
  display_name TEXT,
  team_name TEXT,
  position TEXT,
  similarity_score REAL
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id,
    p.full_name,
    p.display_name,
    t.name as team_name,
    p.position,
    similarity(p.full_name, search_term) as similarity_score
  FROM players p
  LEFT JOIN teams_master t ON p.current_team_id = t.id
  WHERE 
    (sport_filter IS NULL OR p.sport_id = sport_filter)
    AND (
      p.full_name ILIKE '%' || search_term || '%'
      OR p.display_name ILIKE '%' || search_term || '%'
      OR similarity(p.full_name, search_term) > 0.3
    )
    AND p.status = 'active'
  ORDER BY 
    CASE 
      WHEN p.full_name ILIKE search_term || '%' THEN 1
      WHEN p.full_name ILIKE '%' || search_term || '%' THEN 2
      ELSE 3
    END,
    similarity(p.full_name, search_term) DESC
  LIMIT result_limit;
END;
$$ LANGUAGE plpgsql;

-- ===== QUERY PERFORMANCE SETTINGS =====

-- Analyze tables after index creation
ANALYZE players;
ANALYZE player_stats;
ANALYZE player_game_logs;
ANALYZE fantasy_leagues;
ANALYZE fantasy_teams;
-- Enhanced Schema: Add complex schema features while keeping integer IDs
-- Version 3: Fixed column name references to match actual schema

-- 1. Add missing columns to existing tables for API compatibility
ALTER TABLE players ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;
ALTER TABLE players ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE players ADD COLUMN IF NOT EXISTS search_vector tsvector;

ALTER TABLE games ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;
ALTER TABLE games ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE games ADD COLUMN IF NOT EXISTS sport VARCHAR(50);
ALTER TABLE games ADD COLUMN IF NOT EXISTS league VARCHAR(50);

ALTER TABLE teams ADD COLUMN IF NOT EXISTS external_id VARCHAR(255) UNIQUE;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE teams ADD COLUMN IF NOT EXISTS sport VARCHAR(50);

-- 2. Create platform mapping table for external IDs
CREATE TABLE IF NOT EXISTS player_platform_mapping (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  platform VARCHAR(50) NOT NULL,
  platform_player_id VARCHAR(255) NOT NULL,
  platform_data JSONB DEFAULT '{}',
  confidence_score DECIMAL(3,2) DEFAULT 1.0,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(platform, platform_player_id)
);

-- 3. Create detailed game logs table (complex schema feature)
CREATE TABLE IF NOT EXISTS player_game_logs (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  game_id INTEGER REFERENCES games(id) ON DELETE CASCADE,
  team_id INTEGER REFERENCES teams(id),
  game_date DATE NOT NULL,
  opponent_id INTEGER REFERENCES teams(id),
  is_home BOOLEAN,
  minutes_played INTEGER,
  stats JSONB NOT NULL DEFAULT '{}',
  fantasy_points DECIMAL(8,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, game_id)
);

-- 4. Create season aggregates table (complex schema feature)
CREATE TABLE IF NOT EXISTS player_season_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id) ON DELETE CASCADE,
  season INTEGER NOT NULL,
  season_type VARCHAR(20) DEFAULT 'regular',
  team_id INTEGER REFERENCES teams(id),
  games_played INTEGER DEFAULT 0,
  stats JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, season, season_type, team_id)
);

-- 5. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_external_id ON players(external_id);
CREATE INDEX IF NOT EXISTS idx_games_external_id ON games(external_id);
CREATE INDEX IF NOT EXISTS idx_teams_external_id ON teams(external_id);
CREATE INDEX IF NOT EXISTS idx_player_platform_mapping_lookup ON player_platform_mapping(platform, platform_player_id);
CREATE INDEX IF NOT EXISTS idx_player_game_logs_player_game ON player_game_logs(player_id, game_id);
CREATE INDEX IF NOT EXISTS idx_player_game_logs_date ON player_game_logs(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_player_season_stats_lookup ON player_season_stats(player_id, season DESC);

-- 6. Add GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_players_metadata ON players USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_games_metadata ON games USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_player_game_logs_stats ON player_game_logs USING gin(stats);
CREATE INDEX IF NOT EXISTS idx_player_season_stats_stats ON player_season_stats USING gin(stats);

-- 7. Create helper functions for working with both schemas
CREATE OR REPLACE FUNCTION get_player_stats_for_game(p_player_id INTEGER, p_game_id INTEGER)
RETURNS TABLE(
  stat_type VARCHAR,
  stat_value NUMERIC,
  fantasy_points NUMERIC
) AS $$
BEGIN
  -- First check new game logs table
  IF EXISTS (SELECT 1 FROM player_game_logs WHERE player_id = p_player_id AND game_id = p_game_id) THEN
    RETURN QUERY
    SELECT 
      key::VARCHAR as stat_type,
      (value::TEXT)::NUMERIC as stat_value,
      pgl.fantasy_points
    FROM player_game_logs pgl,
    LATERAL jsonb_each(pgl.stats)
    WHERE pgl.player_id = p_player_id 
    AND pgl.game_id = p_game_id;
  ELSE
    -- Fall back to old player_stats table
    RETURN QUERY
    SELECT 
      ps.stat_type::VARCHAR,
      ps.stat_value::NUMERIC,
      ps.fantasy_points::NUMERIC
    FROM player_stats ps
    WHERE ps.player_id = p_player_id 
    AND ps.game_id = p_game_id;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 8. Create view for unified player stats access (FIXED column names)
CREATE OR REPLACE VIEW v_player_all_stats AS
SELECT 
  p.id as player_id,
  CONCAT(p.firstname, ' ', p.lastname) as player_name,
  p.external_id,
  ps.game_id,
  ps.stat_type,
  ps.stat_value,
  ps.fantasy_points,
  'legacy' as source
FROM players p
JOIN player_stats ps ON p.id = ps.player_id
UNION ALL
SELECT 
  p.id as player_id,
  CONCAT(p.firstname, ' ', p.lastname) as player_name,
  p.external_id,
  pgl.game_id,
  key as stat_type,
  (value::TEXT)::NUMERIC as stat_value,
  pgl.fantasy_points,
  'game_logs' as source
FROM players p
JOIN player_game_logs pgl ON p.id = pgl.player_id,
LATERAL jsonb_each(pgl.stats);

-- 9. Add update triggers
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers only if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_player_platform_mapping_updated_at') THEN
    CREATE TRIGGER update_player_platform_mapping_updated_at 
      BEFORE UPDATE ON player_platform_mapping
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_player_game_logs_updated_at') THEN
    CREATE TRIGGER update_player_game_logs_updated_at 
      BEFORE UPDATE ON player_game_logs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_player_season_stats_updated_at') THEN
    CREATE TRIGGER update_player_season_stats_updated_at 
      BEFORE UPDATE ON player_season_stats
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- 10. Create search function for players (FIXED to use actual column names)
CREATE OR REPLACE FUNCTION search_players(search_term TEXT)
RETURNS TABLE(
  player_id INTEGER,
  player_name TEXT,
  player_team_id INTEGER,
  player_position TEXT,
  player_external_id VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id AS player_id,
    CONCAT(p.firstname, ' ', p.lastname) AS player_name,
    p.team_id AS player_team_id,
    p.position[1] AS player_position,  -- position is an array, get first element
    p.external_id AS player_external_id
  FROM players p
  WHERE 
    CONCAT(p.firstname, ' ', p.lastname) ILIKE '%' || search_term || '%'
    OR p.lastname ILIKE '%' || search_term || '%'
    OR p.external_id ILIKE '%' || search_term || '%'
    OR p.team_abbreviation ILIKE '%' || search_term || '%'
  ORDER BY 
    CASE 
      WHEN CONCAT(p.firstname, ' ', p.lastname) ILIKE search_term || '%' THEN 1
      WHEN p.lastname ILIKE search_term || '%' THEN 2
      WHEN CONCAT(p.firstname, ' ', p.lastname) ILIKE '%' || search_term || '%' THEN 3
      ELSE 4
    END,
    p.lastname, p.firstname
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;

-- 11. Add helper function to get player full name
CREATE OR REPLACE FUNCTION get_player_full_name(player_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  full_name TEXT;
BEGIN
  SELECT CONCAT(firstname, ' ', lastname) INTO full_name
  FROM players
  WHERE id = player_id;
  
  RETURN full_name;
END;
$$ LANGUAGE plpgsql;

-- 12. Add convenience columns that collectors expect (if they don't exist)
ALTER TABLE players ADD COLUMN IF NOT EXISTS name VARCHAR(255) GENERATED ALWAYS AS (CONCAT(firstname, ' ', lastname)) STORED;
ALTER TABLE players ADD COLUMN IF NOT EXISTS team VARCHAR(100);
ALTER TABLE players ADD COLUMN IF NOT EXISTS sport VARCHAR(50);
ALTER TABLE players ADD COLUMN IF NOT EXISTS college VARCHAR(100);

-- Update team column if empty (use team name from teams table)
UPDATE players p
SET team = t.name
FROM teams t
WHERE p.team_id = t.id
AND p.team IS NULL;

-- Update sport column if empty (based on sport_id)
UPDATE players
SET sport = CASE 
  WHEN sport_id = 'nfl' THEN 'football'
  WHEN sport_id = 'nba' THEN 'basketball'
  WHEN sport_id = 'mlb' THEN 'baseball'
  WHEN sport_id = 'nhl' THEN 'hockey'
  ELSE sport_id
END
WHERE sport IS NULL;

-- Summary: This approach gives us:
-- 1. Compatibility with existing integer-based data
-- 2. Support for external API mappings
-- 3. Flexible JSONB stats storage
-- 4. Gradual migration path
-- 5. Better performance with proper indexes
-- 6. Fixed references to actual column names (firstname, lastname, not name)
-- 7. Generated name column for compatibility
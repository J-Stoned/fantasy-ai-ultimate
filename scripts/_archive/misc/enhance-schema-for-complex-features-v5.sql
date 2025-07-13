-- Enhanced Schema: Add complex schema features while keeping integer IDs
-- Version 5: Fixed UNION type mismatch and JSONB handling

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

-- 2. Drop and recreate tables if they have wrong types
DO $$
BEGIN
  -- Check if player_game_logs exists with wrong types
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'player_game_logs' 
    AND column_name = 'player_id' 
    AND data_type = 'uuid'
  ) THEN
    DROP TABLE IF EXISTS player_game_logs CASCADE;
  END IF;
END $$;

-- 3. Create platform mapping table for external IDs
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

-- 4. Create detailed game logs table with correct types
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

-- 5. Create season aggregates table with correct types
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

-- 6. Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_external_id ON players(external_id);
CREATE INDEX IF NOT EXISTS idx_games_external_id ON games(external_id);
CREATE INDEX IF NOT EXISTS idx_teams_external_id ON teams(external_id);
CREATE INDEX IF NOT EXISTS idx_player_platform_mapping_lookup ON player_platform_mapping(platform, platform_player_id);
CREATE INDEX IF NOT EXISTS idx_player_game_logs_player_game ON player_game_logs(player_id, game_id);
CREATE INDEX IF NOT EXISTS idx_player_game_logs_date ON player_game_logs(game_date DESC);
CREATE INDEX IF NOT EXISTS idx_player_season_stats_lookup ON player_season_stats(player_id, season DESC);

-- 7. Add GIN indexes for JSONB columns
CREATE INDEX IF NOT EXISTS idx_players_metadata ON players USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_games_metadata ON games USING gin(metadata);
CREATE INDEX IF NOT EXISTS idx_player_game_logs_stats ON player_game_logs USING gin(stats);
CREATE INDEX IF NOT EXISTS idx_player_season_stats_stats ON player_season_stats USING gin(stats);

-- 8. Create helper functions for working with both schemas
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
      CASE 
        WHEN jsonb_typeof(value) = 'number' THEN value::TEXT::NUMERIC
        ELSE 0::NUMERIC
      END as stat_value,
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

-- 9. Drop and recreate view with proper type handling
DROP VIEW IF EXISTS v_player_all_stats CASCADE;

CREATE VIEW v_player_all_stats AS
-- Legacy player_stats (already has numeric stat_value)
SELECT 
  p.id::INTEGER as player_id,
  CONCAT(p.firstname, ' ', p.lastname) as player_name,
  p.external_id,
  ps.game_id::INTEGER as game_id,
  ps.stat_type::TEXT as stat_type,
  ps.stat_value::NUMERIC as stat_value,
  ps.fantasy_points::NUMERIC as fantasy_points,
  'legacy'::TEXT as source
FROM players p
INNER JOIN player_stats ps ON p.id = ps.player_id

UNION ALL

-- New game logs (need to extract from JSONB)
SELECT 
  p.id::INTEGER as player_id,
  CONCAT(p.firstname, ' ', p.lastname) as player_name,
  p.external_id,
  pgl.game_id::INTEGER as game_id,
  stat.key::TEXT as stat_type,
  CASE 
    WHEN jsonb_typeof(stat.value) = 'number' THEN stat.value::TEXT::NUMERIC
    WHEN stat.value::TEXT ~ '^[0-9]+\.?[0-9]*$' THEN stat.value::TEXT::NUMERIC
    ELSE 0::NUMERIC
  END as stat_value,
  pgl.fantasy_points::NUMERIC as fantasy_points,
  'game_logs'::TEXT as source
FROM players p
INNER JOIN player_game_logs pgl ON p.id::INTEGER = pgl.player_id
CROSS JOIN LATERAL jsonb_each(pgl.stats) as stat(key, value);

-- 10. Add update triggers
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

-- 11. Create search function for players
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
    p.id::INTEGER AS player_id,
    CONCAT(p.firstname, ' ', p.lastname) AS player_name,
    p.team_id::INTEGER AS player_team_id,
    CASE 
      WHEN array_length(p.position, 1) > 0 THEN p.position[1]
      ELSE NULL
    END AS player_position,
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

-- 12. Add helper function to get player full name
CREATE OR REPLACE FUNCTION get_player_full_name(p_player_id INTEGER)
RETURNS TEXT AS $$
DECLARE
  full_name TEXT;
BEGIN
  SELECT CONCAT(firstname, ' ', lastname) INTO full_name
  FROM players
  WHERE id = p_player_id;
  
  RETURN full_name;
END;
$$ LANGUAGE plpgsql;

-- 13. Add convenience columns that collectors expect (if they don't exist)
DO $$
BEGIN
  -- Check if generated column syntax is supported
  BEGIN
    ALTER TABLE players ADD COLUMN IF NOT EXISTS name VARCHAR(255) GENERATED ALWAYS AS (CONCAT(firstname, ' ', lastname)) STORED;
  EXCEPTION
    WHEN OTHERS THEN
      -- If generated columns not supported, use a regular column
      ALTER TABLE players ADD COLUMN IF NOT EXISTS name VARCHAR(255);
  END;
END $$;

ALTER TABLE players ADD COLUMN IF NOT EXISTS team VARCHAR(100);
ALTER TABLE players ADD COLUMN IF NOT EXISTS sport VARCHAR(50);
ALTER TABLE players ADD COLUMN IF NOT EXISTS college VARCHAR(100);

-- Update name column if it's not generated
UPDATE players 
SET name = CONCAT(firstname, ' ', lastname)
WHERE name IS NULL OR name = '';

-- Update team column if empty
UPDATE players p
SET team = t.name
FROM teams t
WHERE p.team_id = t.id
AND (p.team IS NULL OR p.team = '');

-- Update sport column if empty
UPDATE players
SET sport = CASE 
  WHEN sport_id = 'nfl' THEN 'football'
  WHEN sport_id = 'nba' THEN 'basketball'
  WHEN sport_id = 'mlb' THEN 'baseball'
  WHEN sport_id = 'nhl' THEN 'hockey'
  ELSE sport_id
END
WHERE sport IS NULL OR sport = '';

-- 14. Create a simpler stats view for testing
CREATE OR REPLACE VIEW v_player_stats_simple AS
SELECT 
  player_id,
  game_id,
  stat_type,
  stat_value,
  fantasy_points
FROM player_stats;

-- Summary: Version 5 improvements:
-- 1. Fixed UNION type mismatch by ensuring all columns have consistent types
-- 2. Proper JSONB value extraction with type checking
-- 3. Handles both numeric and string values in JSONB
-- 4. Explicit type casts for all columns in UNION
-- 5. Fallback handling for generated columns
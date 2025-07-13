-- ESPN ID Standardization Migration
-- Generated: 2025-07-13
-- Standardizes all ESPN IDs to format: espn_{sport}_{numeric_id}

-- =====================================================
-- STEP 1: Create ESPN ID mapping table
-- =====================================================

CREATE TABLE IF NOT EXISTS espn_id_mappings (
  id SERIAL PRIMARY KEY,
  table_name VARCHAR(50) NOT NULL,
  record_id INTEGER NOT NULL,
  original_id VARCHAR(255) NOT NULL,
  standard_id VARCHAR(255) NOT NULL,
  sport VARCHAR(20),
  confidence DECIMAL(3,2) DEFAULT 1.0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(table_name, record_id)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_espn_mappings_original ON espn_id_mappings(original_id);
CREATE INDEX IF NOT EXISTS idx_espn_mappings_standard ON espn_id_mappings(standard_id);
CREATE INDEX IF NOT EXISTS idx_espn_mappings_table ON espn_id_mappings(table_name);
CREATE INDEX IF NOT EXISTS idx_espn_mappings_sport ON espn_id_mappings(sport);

-- =====================================================
-- STEP 2: Add comments for documentation
-- =====================================================

COMMENT ON TABLE espn_id_mappings IS 
'Tracks migration of ESPN IDs from various formats to standardized format: espn_{sport}_{numeric_id}';

COMMENT ON COLUMN espn_id_mappings.table_name IS 
'Name of table where ID was standardized (games, teams, players)';

COMMENT ON COLUMN espn_id_mappings.record_id IS 
'ID of the record that was updated';

COMMENT ON COLUMN espn_id_mappings.original_id IS 
'Original ESPN ID before standardization';

COMMENT ON COLUMN espn_id_mappings.standard_id IS 
'Standardized ESPN ID in format: espn_{sport}_{numeric_id}';

COMMENT ON COLUMN espn_id_mappings.sport IS 
'Sport code used in standardization (nba, nfl, mlb, nhl, ncaab, ncaaf, mls)';

COMMENT ON COLUMN espn_id_mappings.confidence IS 
'Confidence level in the mapping (0.0 to 1.0)';

-- =====================================================
-- STEP 3: Add ESPN ID validation constraints
-- =====================================================

-- Add check constraints to ensure standardized format
ALTER TABLE games 
ADD CONSTRAINT IF NOT EXISTS check_espn_id_format 
CHECK (
  external_id IS NULL OR 
  external_id !~ '^espn_' OR 
  external_id ~ '^espn_(nba|nfl|mlb|nhl|ncaab|ncaaf|mls)_\d+$' OR
  external_id ~ '^espn_.+_(dup|alt)\d*$'
);

ALTER TABLE teams 
ADD CONSTRAINT IF NOT EXISTS check_team_espn_id_format 
CHECK (
  external_id IS NULL OR 
  external_id !~ '^espn_' OR 
  external_id ~ '^espn_(nba|nfl|mlb|nhl|ncaab|ncaaf|mls)_\d+$'
);

ALTER TABLE players 
ADD CONSTRAINT IF NOT EXISTS check_player_espn_id_format 
CHECK (
  external_id IS NULL OR 
  external_id !~ '^espn_' OR 
  external_id ~ '^espn_(nba|nfl|mlb|nhl|ncaab|ncaaf|mls)_\d+$'
);

-- =====================================================
-- STEP 4: Create ESPN ID utility functions
-- =====================================================

-- Function to validate ESPN ID format
CREATE OR REPLACE FUNCTION is_valid_espn_id(id TEXT)
RETURNS BOOLEAN AS $$
BEGIN
  RETURN id ~ '^espn_(nba|nfl|mlb|nhl|ncaab|ncaaf|mls)_\d+$';
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to extract sport from ESPN ID
CREATE OR REPLACE FUNCTION extract_espn_sport(id TEXT)
RETURNS TEXT AS $$
BEGIN
  IF is_valid_espn_id(id) THEN
    RETURN split_part(id, '_', 2);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to extract numeric ID from ESPN ID
CREATE OR REPLACE FUNCTION extract_espn_numeric_id(id TEXT)
RETURNS TEXT AS $$
BEGIN
  IF is_valid_espn_id(id) THEN
    RETURN split_part(id, '_', 3);
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to generate standardized ESPN ID
CREATE OR REPLACE FUNCTION generate_espn_id(sport TEXT, numeric_id TEXT)
RETURNS TEXT AS $$
DECLARE
  sport_code TEXT;
BEGIN
  -- Normalize sport to lowercase and map to standard codes
  sport_code := CASE LOWER(sport)
    WHEN 'nba', 'basketball' THEN 'nba'
    WHEN 'nfl', 'football' THEN 'nfl'
    WHEN 'mlb', 'baseball' THEN 'mlb'
    WHEN 'nhl', 'hockey' THEN 'nhl'
    WHEN 'ncaab', 'college-basketball', 'mens-college-basketball' THEN 'ncaab'
    WHEN 'ncaaf', 'college-football' THEN 'ncaaf'
    WHEN 'mls', 'soccer' THEN 'mls'
    ELSE NULL
  END;
  
  IF sport_code IS NOT NULL AND numeric_id ~ '^\d+$' THEN
    RETURN 'espn_' || sport_code || '_' || numeric_id;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- STEP 5: Create ESPN ID statistics view
-- =====================================================

CREATE OR REPLACE VIEW espn_id_stats AS
SELECT 
  'games' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_valid_espn_id(external_id) THEN 1 END) as standardized_count,
  COUNT(CASE WHEN external_id LIKE 'espn_%' AND NOT is_valid_espn_id(external_id) THEN 1 END) as needs_standardization,
  COUNT(CASE WHEN external_id LIKE '%_dup%' THEN 1 END) as duplicate_count,
  ROUND(
    100.0 * COUNT(CASE WHEN is_valid_espn_id(external_id) THEN 1 END) / 
    NULLIF(COUNT(CASE WHEN external_id LIKE 'espn_%' THEN 1 END), 0), 
    2
  ) as standardization_percentage
FROM games
WHERE external_id IS NOT NULL

UNION ALL

SELECT 
  'teams' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_valid_espn_id(external_id) THEN 1 END) as standardized_count,
  COUNT(CASE WHEN external_id LIKE 'espn_%' AND NOT is_valid_espn_id(external_id) THEN 1 END) as needs_standardization,
  0 as duplicate_count,
  ROUND(
    100.0 * COUNT(CASE WHEN is_valid_espn_id(external_id) THEN 1 END) / 
    NULLIF(COUNT(CASE WHEN external_id LIKE 'espn_%' THEN 1 END), 0), 
    2
  ) as standardization_percentage
FROM teams
WHERE external_id IS NOT NULL

UNION ALL

SELECT 
  'players' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN is_valid_espn_id(external_id) THEN 1 END) as standardized_count,
  COUNT(CASE WHEN external_id LIKE 'espn_%' AND NOT is_valid_espn_id(external_id) THEN 1 END) as needs_standardization,
  0 as duplicate_count,
  ROUND(
    100.0 * COUNT(CASE WHEN is_valid_espn_id(external_id) THEN 1 END) / 
    NULLIF(COUNT(CASE WHEN external_id LIKE 'espn_%' THEN 1 END), 0), 
    2
  ) as standardization_percentage
FROM players
WHERE external_id IS NOT NULL;

-- =====================================================
-- STEP 6: Add indexes for ESPN ID operations
-- =====================================================

-- Indexes for ESPN ID filtering and validation
CREATE INDEX IF NOT EXISTS idx_games_espn_id_pattern 
ON games(external_id) 
WHERE external_id LIKE 'espn_%';

CREATE INDEX IF NOT EXISTS idx_teams_espn_id_pattern 
ON teams(external_id) 
WHERE external_id LIKE 'espn_%';

CREATE INDEX IF NOT EXISTS idx_players_espn_id_pattern 
ON players(external_id) 
WHERE external_id LIKE 'espn_%';

-- Sport-specific indexes for quick filtering
CREATE INDEX IF NOT EXISTS idx_games_espn_sport 
ON games(extract_espn_sport(external_id)) 
WHERE is_valid_espn_id(external_id);

-- =====================================================
-- STEP 7: Create data quality monitoring
-- =====================================================

CREATE TABLE IF NOT EXISTS espn_id_quality_report (
  id SERIAL PRIMARY KEY,
  report_date DATE DEFAULT CURRENT_DATE,
  table_name VARCHAR(50) NOT NULL,
  total_espn_records INTEGER,
  standardized_records INTEGER,
  standardization_percentage DECIMAL(5,2),
  duplicate_records INTEGER,
  invalid_format_records INTEGER,
  issues JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(report_date, table_name)
);

-- Function to generate quality report
CREATE OR REPLACE FUNCTION generate_espn_id_quality_report()
RETURNS void AS $$
BEGIN
  INSERT INTO espn_id_quality_report (
    table_name, 
    total_espn_records, 
    standardized_records, 
    standardization_percentage,
    duplicate_records,
    invalid_format_records
  )
  SELECT 
    table_name,
    total_records as total_espn_records,
    standardized_count as standardized_records,
    standardization_percentage,
    duplicate_count as duplicate_records,
    needs_standardization as invalid_format_records
  FROM espn_id_stats
  ON CONFLICT (report_date, table_name) 
  DO UPDATE SET
    total_espn_records = EXCLUDED.total_espn_records,
    standardized_records = EXCLUDED.standardized_records,
    standardization_percentage = EXCLUDED.standardization_percentage,
    duplicate_records = EXCLUDED.duplicate_records,
    invalid_format_records = EXCLUDED.invalid_format_records,
    created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STEP 8: Add triggers for data quality monitoring
-- =====================================================

-- Function to log ESPN ID changes
CREATE OR REPLACE FUNCTION log_espn_id_change()
RETURNS TRIGGER AS $$
BEGIN
  -- Only log if external_id changed and involves ESPN IDs
  IF TG_OP = 'UPDATE' AND 
     OLD.external_id IS DISTINCT FROM NEW.external_id AND
     (OLD.external_id LIKE 'espn_%' OR NEW.external_id LIKE 'espn_%') THEN
    
    INSERT INTO espn_id_mappings (
      table_name,
      record_id,
      original_id,
      standard_id,
      sport,
      confidence
    ) VALUES (
      TG_TABLE_NAME,
      NEW.id,
      COALESCE(OLD.external_id, ''),
      NEW.external_id,
      CASE TG_TABLE_NAME
        WHEN 'games' THEN NEW.sport
        WHEN 'teams' THEN NEW.sport
        WHEN 'players' THEN NEW.sport
        ELSE NULL
      END,
      CASE WHEN is_valid_espn_id(NEW.external_id) THEN 1.0 ELSE 0.5 END
    ) ON CONFLICT (table_name, record_id) DO UPDATE SET
      standard_id = EXCLUDED.standard_id,
      sport = EXCLUDED.sport,
      confidence = EXCLUDED.confidence,
      created_at = NOW();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for ESPN ID change tracking
CREATE TRIGGER espn_id_change_games
  AFTER UPDATE ON games
  FOR EACH ROW EXECUTE FUNCTION log_espn_id_change();

CREATE TRIGGER espn_id_change_teams
  AFTER UPDATE ON teams
  FOR EACH ROW EXECUTE FUNCTION log_espn_id_change();

CREATE TRIGGER espn_id_change_players
  AFTER UPDATE ON players
  FOR EACH ROW EXECUTE FUNCTION log_espn_id_change();

-- =====================================================
-- FINAL: Generate initial quality report
-- =====================================================

SELECT generate_espn_id_quality_report();

-- Add final comment
COMMENT ON DATABASE CURRENT_DATABASE IS 
CONCAT(
  COALESCE(obj_description(oid, 'pg_database'), ''), 
  ' | ESPN ID Standardization: espn_{sport}_{numeric_id} format enforced | Migration completed: 2025-07-13'
) 
FROM pg_database WHERE datname = current_database();
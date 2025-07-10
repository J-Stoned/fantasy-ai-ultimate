-- Migration: Prevent Fake Data Insertion
-- Description: Add constraints to prevent test/fake data from being inserted

-- 1. PLAYERS TABLE CONSTRAINTS
-- Drop existing constraints if they exist
ALTER TABLE players DROP CONSTRAINT IF EXISTS check_no_test_names;
ALTER TABLE players DROP CONSTRAINT IF EXISTS check_valid_player_name;
ALTER TABLE players DROP CONSTRAINT IF EXISTS check_external_id_format;

-- Add constraint to prevent test/fake player names
ALTER TABLE players ADD CONSTRAINT check_no_test_names 
CHECK (
  name NOT ILIKE '%test%' AND 
  name NOT ILIKE '%fake%' AND 
  name NOT ILIKE '%demo%' AND
  name NOT ILIKE '%dummy%' AND
  name NOT ILIKE '%sample%' AND
  name NOT LIKE '%_175133%_%' AND
  name NOT LIKE 'Player %' AND
  name NOT LIKE 'Test Player%'
);

-- Ensure players have valid names
ALTER TABLE players ADD CONSTRAINT check_valid_player_name
CHECK (
  (name IS NOT NULL AND LENGTH(name) >= 3) OR
  (firstname IS NOT NULL AND lastname IS NOT NULL)
);

-- Ensure external_ids don't contain test patterns
ALTER TABLE players ADD CONSTRAINT check_external_id_format
CHECK (
  external_id IS NULL OR (
    external_id NOT LIKE 'test_%' AND
    external_id NOT LIKE 'fake_%' AND
    external_id NOT LIKE 'temp_%' AND
    external_id NOT LIKE 'demo_%'
  )
);

-- 2. GAMES TABLE CONSTRAINTS
-- Drop existing constraints if they exist
ALTER TABLE games DROP CONSTRAINT IF EXISTS check_external_id_required;
ALTER TABLE games DROP CONSTRAINT IF EXISTS check_realistic_scores;
ALTER TABLE games DROP CONSTRAINT IF EXISTS check_valid_game_data;

-- Require external_id for all games
ALTER TABLE games ADD CONSTRAINT check_external_id_required
CHECK (external_id IS NOT NULL);

-- Prevent impossible scores
ALTER TABLE games ADD CONSTRAINT check_realistic_scores
CHECK (
  (home_score IS NULL OR (home_score >= 0 AND home_score <= 200)) AND
  (away_score IS NULL OR (away_score >= 0 AND away_score <= 200))
);

-- Ensure games have valid team references
ALTER TABLE games ADD CONSTRAINT check_valid_game_data
CHECK (
  home_team_id IS NOT NULL AND
  away_team_id IS NOT NULL AND
  home_team_id != away_team_id AND
  start_time IS NOT NULL
);

-- 3. PLAYER_STATS TABLE CONSTRAINTS
-- Drop existing constraints if they exist
ALTER TABLE player_stats DROP CONSTRAINT IF EXISTS check_valid_stat_references;
ALTER TABLE player_stats DROP CONSTRAINT IF EXISTS check_realistic_stat_values;

-- Ensure stats reference valid players and games
ALTER TABLE player_stats ADD CONSTRAINT check_valid_stat_references
CHECK (
  player_id IS NOT NULL AND
  game_id IS NOT NULL
);

-- Ensure realistic stat values
ALTER TABLE player_stats ADD CONSTRAINT check_realistic_stat_values
CHECK (
  (fantasy_points IS NULL OR (fantasy_points >= -10 AND fantasy_points <= 100))
);

-- 4. CREATE VALIDATION FUNCTION
CREATE OR REPLACE FUNCTION validate_bulk_insert()
RETURNS TRIGGER AS $$
DECLARE
  row_count INTEGER;
BEGIN
  -- Count rows being inserted
  GET DIAGNOSTICS row_count = ROW_COUNT;
  
  -- Alert on suspicious bulk inserts
  IF row_count > 1000 THEN
    RAISE WARNING 'Large bulk insert detected: % rows in table %', row_count, TG_TABLE_NAME;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 5. CREATE TRIGGERS FOR MONITORING
-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS monitor_bulk_players ON players;
DROP TRIGGER IF EXISTS monitor_bulk_games ON games;
DROP TRIGGER IF EXISTS monitor_bulk_stats ON player_stats;

-- Create triggers to monitor bulk inserts
CREATE TRIGGER monitor_bulk_players
AFTER INSERT ON players
FOR EACH STATEMENT
EXECUTE FUNCTION validate_bulk_insert();

CREATE TRIGGER monitor_bulk_games
AFTER INSERT ON games
FOR EACH STATEMENT
EXECUTE FUNCTION validate_bulk_insert();

CREATE TRIGGER monitor_bulk_stats
AFTER INSERT ON player_stats
FOR EACH STATEMENT
EXECUTE FUNCTION validate_bulk_insert();

-- 6. CREATE DATA QUALITY VIEW
CREATE OR REPLACE VIEW data_quality_check AS
SELECT 
  'players' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN name IS NULL THEN 1 END) as null_names,
  COUNT(CASE WHEN external_id IS NULL THEN 1 END) as null_external_ids,
  COUNT(CASE WHEN name ILIKE '%test%' OR name ILIKE '%fake%' THEN 1 END) as suspicious_names
FROM players
UNION ALL
SELECT 
  'games' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN external_id IS NULL THEN 1 END) as null_external_ids,
  COUNT(CASE WHEN home_score > 200 OR away_score > 200 THEN 1 END) as impossible_scores,
  0 as suspicious_names
FROM games
UNION ALL
SELECT 
  'player_stats' as table_name,
  COUNT(*) as total_records,
  COUNT(CASE WHEN player_id IS NULL THEN 1 END) as null_player_refs,
  COUNT(CASE WHEN game_id IS NULL THEN 1 END) as null_game_refs,
  0 as suspicious_names
FROM player_stats;

-- 7. CREATE CLEANUP POLICIES
-- Create policy to prevent deletion of real data
CREATE POLICY "Prevent accidental deletion of valid players" ON players
FOR DELETE
USING (
  name ILIKE '%test%' OR 
  name ILIKE '%fake%' OR 
  name LIKE '%_175133%_%' OR
  name IS NULL
);

-- 8. ADD COMMENTS FOR DOCUMENTATION
COMMENT ON CONSTRAINT check_no_test_names ON players IS 
'Prevents insertion of test/fake player names';

COMMENT ON CONSTRAINT check_external_id_required ON games IS 
'Ensures all games have valid external IDs from real data sources';

COMMENT ON CONSTRAINT check_realistic_scores ON games IS 
'Prevents games with unrealistic scores from being inserted';

-- 9. CREATE AUDIT LOG TABLE
CREATE TABLE IF NOT EXISTS data_audit_log (
  id SERIAL PRIMARY KEY,
  table_name TEXT NOT NULL,
  action TEXT NOT NULL,
  row_count INTEGER,
  user_id TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW(),
  details JSONB
);

-- 10. CREATE FUNCTION TO LOG DATA CHANGES
CREATE OR REPLACE FUNCTION log_data_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO data_audit_log (table_name, action, row_count, user_id, details)
  VALUES (
    TG_TABLE_NAME,
    TG_OP,
    CASE 
      WHEN TG_OP = 'INSERT' THEN (SELECT COUNT(*) FROM inserted)
      WHEN TG_OP = 'DELETE' THEN (SELECT COUNT(*) FROM deleted)
      ELSE 1
    END,
    current_user,
    jsonb_build_object('time', NOW(), 'operation', TG_OP)
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add audit triggers
CREATE TRIGGER audit_players_changes
AFTER INSERT OR DELETE ON players
FOR EACH STATEMENT
EXECUTE FUNCTION log_data_changes();

CREATE TRIGGER audit_games_changes
AFTER INSERT OR DELETE ON games
FOR EACH STATEMENT
EXECUTE FUNCTION log_data_changes();

-- Final message
DO $$
BEGIN
  RAISE NOTICE 'Data validation constraints and monitoring have been added successfully!';
  RAISE NOTICE 'Run the remove-all-fake-data-safely.ts script to clean existing fake data.';
END $$;
-- Fix Spatial Analytics Schema Issues
-- Addresses team_id type mismatch and adds missing constraints

-- 1. Fix player_tracking_data team_id type issue
ALTER TABLE player_tracking_data 
DROP CONSTRAINT IF EXISTS fk_tracking_team;

-- Convert team_id from TEXT to INTEGER (handle existing data gracefully)
ALTER TABLE player_tracking_data 
ALTER COLUMN team_id TYPE INTEGER USING 
  CASE 
    WHEN team_id ~ '^[0-9]+$' THEN team_id::INTEGER
    ELSE NULL
  END;

-- Add foreign key constraint
ALTER TABLE player_tracking_data 
ADD CONSTRAINT fk_tracking_team 
FOREIGN KEY (team_id) REFERENCES teams(id);

-- 2. Ensure service role has proper permissions
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO service_role;

-- 3. Add indexes for better performance
CREATE INDEX IF NOT EXISTS idx_basketball_shots_player_game 
ON basketball_shots(player_id, game_id);

CREATE INDEX IF NOT EXISTS idx_movement_patterns_player_season 
ON movement_patterns(player_id, season);

CREATE INDEX IF NOT EXISTS idx_player_synergies_season 
ON player_synergies(season);

CREATE INDEX IF NOT EXISTS idx_tracking_game_timestamp 
ON player_tracking_data(game_id, timestamp);

-- 4. Update RLS policies to ensure service role access
ALTER TABLE basketball_shots DISABLE ROW LEVEL SECURITY;
ALTER TABLE movement_patterns DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_tracking_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE player_synergies DISABLE ROW LEVEL SECURITY;
ALTER TABLE spatial_analysis_cache DISABLE ROW LEVEL SECURITY;
ALTER TABLE football_routes DISABLE ROW LEVEL SECURITY;

-- Re-enable with proper service role policies
ALTER TABLE basketball_shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_tracking_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_synergies ENABLE ROW LEVEL SECURITY;
ALTER TABLE spatial_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE football_routes ENABLE ROW LEVEL SECURITY;

-- Service role bypass policies
CREATE POLICY "Service role can do everything on basketball_shots" 
ON basketball_shots FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on movement_patterns" 
ON movement_patterns FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on player_tracking_data" 
ON player_tracking_data FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on player_synergies" 
ON player_synergies FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on spatial_analysis_cache" 
ON spatial_analysis_cache FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE POLICY "Service role can do everything on football_routes" 
ON football_routes FOR ALL TO service_role USING (true) WITH CHECK (true);
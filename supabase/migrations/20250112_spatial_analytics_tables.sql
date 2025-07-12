-- Spatial Analytics Tables for Dr. Aris Thorne's Methodologies
-- This migration creates the tables required for xG models, pitch control, and movement patterns

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Player Tracking Data Table
-- Stores real-time position and movement data for spatial analysis
CREATE TABLE IF NOT EXISTS player_tracking_data (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  player_id INTEGER REFERENCES players(id),
  team_id TEXT NOT NULL,
  timestamp DECIMAL NOT NULL,
  x_position FLOAT NOT NULL,
  y_position FLOAT NOT NULL,
  z_position FLOAT DEFAULT 0,
  speed FLOAT,
  acceleration FLOAT,
  direction FLOAT, -- in radians
  x_velocity FLOAT,
  y_velocity FLOAT,
  heart_rate INTEGER,
  additional_sensors JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  -- Indexes for performance
  CONSTRAINT tracking_game_player_time UNIQUE(game_id, player_id, timestamp)
);

-- Indexes for tracking data queries
CREATE INDEX idx_tracking_game_time ON player_tracking_data(game_id, timestamp);
CREATE INDEX idx_tracking_player_game ON player_tracking_data(player_id, game_id);
CREATE INDEX idx_tracking_timestamp ON player_tracking_data(timestamp);

-- 2. Basketball Shots Table
-- For xG calculations and shot quality analysis
CREATE TABLE IF NOT EXISTS basketball_shots (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  player_id INTEGER REFERENCES players(id),
  team_id INTEGER REFERENCES teams(id),
  quarter INTEGER NOT NULL,
  game_clock FLOAT,
  shot_clock FLOAT,
  shot_type TEXT NOT NULL, -- 'jump_shot', 'layup', 'dunk', 'three_pointer', etc.
  shot_distance FLOAT,
  shot_angle FLOAT,
  x_coordinate FLOAT NOT NULL,
  y_coordinate FLOAT NOT NULL,
  made BOOLEAN NOT NULL,
  shot_value INTEGER CHECK (shot_value IN (2, 3)),
  defender_distance FLOAT,
  defender_id INTEGER REFERENCES players(id),
  dribbles_before_shot INTEGER,
  touch_time FLOAT,
  game_situation TEXT, -- 'open_play', 'fast_break', 'after_timeout', etc.
  assist_player_id INTEGER REFERENCES players(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for shot data
CREATE INDEX idx_shots_game ON basketball_shots(game_id);
CREATE INDEX idx_shots_player ON basketball_shots(player_id);
CREATE INDEX idx_shots_location ON basketball_shots(x_coordinate, y_coordinate);

-- 3. Football Routes Table
-- For route pattern analysis and separation metrics
CREATE TABLE IF NOT EXISTS football_routes (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  player_id INTEGER REFERENCES players(id),
  play_id TEXT NOT NULL,
  route_type TEXT NOT NULL, -- 'slant', 'go', 'curl', 'post', etc.
  route_depth FLOAT,
  target_depth FLOAT,
  separation_at_throw FLOAT,
  separation_at_catch FLOAT,
  air_yards FLOAT,
  yards_after_catch FLOAT,
  targeted BOOLEAN DEFAULT false,
  reception BOOLEAN DEFAULT false,
  coverage_type TEXT, -- 'man', 'zone', 'double'
  defender_id INTEGER REFERENCES players(id),
  pressure_on_qb BOOLEAN,
  time_to_throw FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for route data
CREATE INDEX idx_routes_game ON football_routes(game_id);
CREATE INDEX idx_routes_player ON football_routes(player_id);
CREATE INDEX idx_routes_play ON football_routes(play_id);

-- 4. Spatial Analysis Results Cache
-- Store computed spatial metrics for faster access
CREATE TABLE IF NOT EXISTS spatial_analysis_cache (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  analysis_type TEXT NOT NULL, -- 'pitch_control', 'movement_pattern', 'xg', 'synergy'
  game_id INTEGER REFERENCES games(id),
  player_id INTEGER REFERENCES players(id),
  timestamp TIMESTAMPTZ NOT NULL,
  metrics JSONB NOT NULL,
  confidence FLOAT,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for cache
CREATE INDEX idx_spatial_cache_type ON spatial_analysis_cache(analysis_type);
CREATE INDEX idx_spatial_cache_game ON spatial_analysis_cache(game_id);
CREATE INDEX idx_spatial_cache_player ON spatial_analysis_cache(player_id);
CREATE INDEX idx_spatial_cache_expires ON spatial_analysis_cache(expires_at);

-- 5. Movement Pattern Library
-- Store identified movement patterns for quick lookup
CREATE TABLE IF NOT EXISTS movement_patterns (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  pattern_type TEXT NOT NULL,
  pattern_name TEXT NOT NULL,
  frequency INTEGER DEFAULT 0,
  success_rate FLOAT,
  avg_space_created FLOAT,
  preferred_zones JSONB,
  season INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for patterns
CREATE INDEX idx_patterns_player ON movement_patterns(player_id);
CREATE INDEX idx_patterns_type ON movement_patterns(pattern_type);

-- 6. Player Synergies Table
-- Store calculated synergies between players
CREATE TABLE IF NOT EXISTS player_synergies (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  player1_id INTEGER REFERENCES players(id),
  player2_id INTEGER REFERENCES players(id),
  synergy_type TEXT NOT NULL, -- 'offensive', 'defensive', 'spacing'
  synergy_score FLOAT NOT NULL,
  sample_size INTEGER,
  complementary_patterns TEXT[],
  overlapping_zones FLOAT,
  last_calculated TIMESTAMPTZ DEFAULT NOW(),
  season INTEGER,
  CONSTRAINT unique_player_pair UNIQUE(player1_id, player2_id, synergy_type, season)
);

-- Indexes for synergies
CREATE INDEX idx_synergies_player1 ON player_synergies(player1_id);
CREATE INDEX idx_synergies_player2 ON player_synergies(player2_id);
CREATE INDEX idx_synergies_score ON player_synergies(synergy_score DESC);

-- Enable Row Level Security
ALTER TABLE player_tracking_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE basketball_shots ENABLE ROW LEVEL SECURITY;
ALTER TABLE football_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE spatial_analysis_cache ENABLE ROW LEVEL SECURITY;
ALTER TABLE movement_patterns ENABLE ROW LEVEL SECURITY;
ALTER TABLE player_synergies ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Public read access for authenticated users
CREATE POLICY "Public read access" ON player_tracking_data FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read access" ON basketball_shots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read access" ON football_routes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read access" ON spatial_analysis_cache FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read access" ON movement_patterns FOR SELECT TO authenticated USING (true);
CREATE POLICY "Public read access" ON player_synergies FOR SELECT TO authenticated USING (true);

-- Service role write access
CREATE POLICY "Service role write" ON player_tracking_data FOR ALL TO service_role USING (true);
CREATE POLICY "Service role write" ON basketball_shots FOR ALL TO service_role USING (true);
CREATE POLICY "Service role write" ON football_routes FOR ALL TO service_role USING (true);
CREATE POLICY "Service role write" ON spatial_analysis_cache FOR ALL TO service_role USING (true);
CREATE POLICY "Service role write" ON movement_patterns FOR ALL TO service_role USING (true);
CREATE POLICY "Service role write" ON player_synergies FOR ALL TO service_role USING (true);

-- Grant permissions
GRANT SELECT ON player_tracking_data TO authenticated;
GRANT SELECT ON basketball_shots TO authenticated;
GRANT SELECT ON football_routes TO authenticated;
GRANT SELECT ON spatial_analysis_cache TO authenticated;
GRANT SELECT ON movement_patterns TO authenticated;
GRANT SELECT ON player_synergies TO authenticated;

GRANT ALL ON player_tracking_data TO service_role;
GRANT ALL ON basketball_shots TO service_role;
GRANT ALL ON football_routes TO service_role;
GRANT ALL ON spatial_analysis_cache TO service_role;
GRANT ALL ON movement_patterns TO service_role;
GRANT ALL ON player_synergies TO service_role;

-- Grant sequence permissions
GRANT USAGE ON SEQUENCE player_tracking_data_id_seq TO service_role;
GRANT USAGE ON SEQUENCE basketball_shots_id_seq TO service_role;
GRANT USAGE ON SEQUENCE football_routes_id_seq TO service_role;
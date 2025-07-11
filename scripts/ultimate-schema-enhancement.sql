-- Ultimate Schema Enhancement for Complete Micro-Analytics
-- This ensures we can capture EVERY possible stat from any sport

-- 1. Enhance player_game_logs with comprehensive columns
ALTER TABLE player_game_logs 
ADD COLUMN IF NOT EXISTS raw_stats JSONB DEFAULT '{}',           -- Raw stats from data source
ADD COLUMN IF NOT EXISTS computed_metrics JSONB DEFAULT '{}',     -- Calculated advanced metrics
ADD COLUMN IF NOT EXISTS tracking_data JSONB DEFAULT '{}',        -- Player tracking/movement data
ADD COLUMN IF NOT EXISTS situational_stats JSONB DEFAULT '{}',    -- Clutch, red zone, etc.
ADD COLUMN IF NOT EXISTS play_by_play_stats JSONB DEFAULT '{}',   -- Aggregated from play data
ADD COLUMN IF NOT EXISTS matchup_stats JSONB DEFAULT '{}',        -- vs specific opponent/pitcher
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}',             -- Game context, weather, etc.
ADD COLUMN IF NOT EXISTS quality_metrics JSONB DEFAULT '{}';      -- Data quality indicators

-- 2. Create comprehensive stat definitions table
CREATE TABLE IF NOT EXISTS stat_definitions (
  id SERIAL PRIMARY KEY,
  sport TEXT NOT NULL,
  stat_category TEXT NOT NULL,      -- 'basic', 'advanced', 'tracking', 'situational'
  stat_name TEXT NOT NULL,
  display_name TEXT NOT NULL,
  description TEXT,
  unit TEXT,                        -- 'count', 'percentage', 'rate', 'time', 'distance'
  calculation_formula TEXT,         -- How to calculate if derived
  source_field TEXT,                -- Where to find in raw data
  importance_score INTEGER DEFAULT 5, -- 1-10 scale
  fantasy_relevance BOOLEAN DEFAULT true,
  requires_tracking_data BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, stat_name)
);

-- 3. Create play-by-play table for granular data
CREATE TABLE IF NOT EXISTS play_by_play_data (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  play_id TEXT NOT NULL,
  quarter_period INTEGER,
  time_remaining TEXT,
  play_type TEXT,
  players_involved JSONB,          -- Array of player IDs and roles
  play_result JSONB,               -- Detailed outcome
  location_data JSONB,             -- Field/court position
  tracking_data JSONB,             -- Speed, distance, etc.
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, play_id)
);

-- 4. Create tracking data table for movement analytics
CREATE TABLE IF NOT EXISTS player_tracking_data (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  player_id INTEGER REFERENCES players(id),
  timestamp TIMESTAMPTZ NOT NULL,
  x_position FLOAT,
  y_position FLOAT,
  z_position FLOAT,                -- For 3D sports
  speed FLOAT,
  acceleration FLOAT,
  direction FLOAT,
  heart_rate INTEGER,              -- If available
  additional_sensors JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Create sport-specific extension tables

-- Basketball shot chart data
CREATE TABLE IF NOT EXISTS basketball_shots (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  player_id INTEGER REFERENCES players(id),
  shot_type TEXT,
  shot_distance FLOAT,
  shot_angle FLOAT,
  x_coordinate FLOAT,
  y_coordinate FLOAT,
  shot_made BOOLEAN,
  shot_value INTEGER,              -- 2 or 3
  defender_distance FLOAT,
  shot_clock_remaining FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Baseball pitch data
CREATE TABLE IF NOT EXISTS baseball_pitches (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  pitcher_id INTEGER REFERENCES players(id),
  batter_id INTEGER REFERENCES players(id),
  pitch_type TEXT,
  velocity FLOAT,
  spin_rate FLOAT,
  horizontal_break FLOAT,
  vertical_break FLOAT,
  release_point_x FLOAT,
  release_point_y FLOAT,
  release_point_z FLOAT,
  plate_x FLOAT,
  plate_z FLOAT,
  outcome TEXT,
  count_balls INTEGER,
  count_strikes INTEGER,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Football routes and targets
CREATE TABLE IF NOT EXISTS football_routes (
  id BIGSERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  player_id INTEGER REFERENCES players(id),
  play_id TEXT,
  route_type TEXT,
  target_depth FLOAT,
  separation_at_catch FLOAT,
  air_yards FLOAT,
  yards_after_catch FLOAT,
  pressure_on_qb BOOLEAN,
  time_to_throw FLOAT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_logs_raw_stats ON player_game_logs USING GIN (raw_stats);
CREATE INDEX IF NOT EXISTS idx_logs_computed ON player_game_logs USING GIN (computed_metrics);
CREATE INDEX IF NOT EXISTS idx_logs_tracking ON player_game_logs USING GIN (tracking_data);
CREATE INDEX IF NOT EXISTS idx_logs_situational ON player_game_logs USING GIN (situational_stats);
CREATE INDEX IF NOT EXISTS idx_pbp_game ON play_by_play_data(game_id);
CREATE INDEX IF NOT EXISTS idx_pbp_players ON play_by_play_data USING GIN (players_involved);
CREATE INDEX IF NOT EXISTS idx_tracking_game_player ON player_tracking_data(game_id, player_id);

-- 7. Insert comprehensive stat definitions for all sports

-- Basketball stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit) VALUES
-- Basic stats
('NBA', 'basic', 'points', 'Points', 'Total points scored', 'count'),
('NBA', 'basic', 'rebounds', 'Rebounds', 'Total rebounds', 'count'),
('NBA', 'basic', 'assists', 'Assists', 'Total assists', 'count'),
('NBA', 'basic', 'steals', 'Steals', 'Total steals', 'count'),
('NBA', 'basic', 'blocks', 'Blocks', 'Total blocks', 'count'),
-- Shooting zones
('NBA', 'advanced', 'points_in_paint', 'Points in Paint', 'Points scored in the paint', 'count'),
('NBA', 'advanced', 'corner_three_percentage', 'Corner 3P%', 'Corner three point percentage', 'percentage'),
-- Hustle stats
('NBA', 'tracking', 'deflections', 'Deflections', 'Total deflections', 'count'),
('NBA', 'tracking', 'loose_balls_recovered', 'Loose Balls', 'Loose balls recovered', 'count'),
('NBA', 'tracking', 'screen_assists', 'Screen Assists', 'Screens leading to scores', 'count'),
('NBA', 'tracking', 'contested_shots', 'Contested Shots', 'Shots contested on defense', 'count'),
-- Movement tracking
('NBA', 'tracking', 'distance_traveled', 'Distance', 'Total distance traveled', 'distance'),
('NBA', 'tracking', 'average_speed', 'Avg Speed', 'Average speed', 'speed'),
('NBA', 'tracking', 'touches', 'Touches', 'Total touches', 'count'),
('NBA', 'tracking', 'time_of_possession', 'Time of Poss', 'Time with ball', 'time'),
-- Play types
('NBA', 'situational', 'isolation_points', 'ISO Points', 'Points from isolation plays', 'count'),
('NBA', 'situational', 'pick_roll_points', 'PnR Points', 'Points from pick and roll', 'count'),
('NBA', 'situational', 'transition_points', 'Transition Pts', 'Fast break points', 'count'),
-- Clutch stats
('NBA', 'situational', 'clutch_points', 'Clutch Points', 'Points in clutch time', 'count'),
('NBA', 'situational', 'clutch_plus_minus', 'Clutch +/-', 'Plus/minus in clutch', 'differential')
ON CONFLICT (sport, stat_name) DO NOTHING;

-- Football stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit) VALUES
-- Passing
('NFL', 'basic', 'passing_yards', 'Pass Yards', 'Total passing yards', 'count'),
('NFL', 'basic', 'passing_touchdowns', 'Pass TDs', 'Passing touchdowns', 'count'),
('NFL', 'advanced', 'air_yards', 'Air Yards', 'Yards ball traveled in air', 'count'),
('NFL', 'advanced', 'yards_after_catch', 'YAC', 'Yards after catch', 'count'),
('NFL', 'advanced', 'time_to_throw', 'Time to Throw', 'Time before throwing', 'time'),
('NFL', 'advanced', 'pressure_percentage', 'Pressure %', 'Pressured on dropbacks', 'percentage'),
-- Rushing
('NFL', 'basic', 'rushing_yards', 'Rush Yards', 'Total rushing yards', 'count'),
('NFL', 'advanced', 'yards_before_contact', 'YBC', 'Yards before contact', 'count'),
('NFL', 'advanced', 'yards_after_contact', 'YAC', 'Yards after contact', 'count'),
('NFL', 'advanced', 'broken_tackles', 'Broken Tackles', 'Tackles broken', 'count'),
-- Defense
('NFL', 'basic', 'tackles_total', 'Tackles', 'Total tackles', 'count'),
('NFL', 'advanced', 'pressure_rate', 'Pressure Rate', 'QB pressures per snap', 'rate'),
('NFL', 'advanced', 'coverage_snaps', 'Coverage Snaps', 'Snaps in coverage', 'count'),
('NFL', 'advanced', 'missed_tackle_rate', 'Missed Tackle %', 'Missed tackle percentage', 'percentage')
ON CONFLICT (sport, stat_name) DO NOTHING;

-- Baseball stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit) VALUES
-- Batting
('MLB', 'basic', 'batting_average', 'AVG', 'Batting average', 'percentage'),
('MLB', 'advanced', 'launch_angle', 'Launch Angle', 'Average launch angle', 'degrees'),
('MLB', 'advanced', 'exit_velocity', 'Exit Velo', 'Average exit velocity', 'speed'),
('MLB', 'advanced', 'barrel_rate', 'Barrel %', 'Barrel percentage', 'percentage'),
('MLB', 'advanced', 'hard_hit_rate', 'Hard Hit %', 'Hard hit percentage', 'percentage'),
-- Pitching
('MLB', 'basic', 'strikeouts', 'K', 'Strikeouts', 'count'),
('MLB', 'advanced', 'spin_rate', 'Spin Rate', 'Average spin rate', 'rpm'),
('MLB', 'advanced', 'release_extension', 'Extension', 'Release point extension', 'distance'),
('MLB', 'advanced', 'whiff_rate', 'Whiff %', 'Swings and misses rate', 'percentage'),
-- Fielding
('MLB', 'advanced', 'outs_above_average', 'OAA', 'Outs above average', 'count'),
('MLB', 'advanced', 'arm_strength', 'Arm Strength', 'Throwing velocity', 'speed')
ON CONFLICT (sport, stat_name) DO NOTHING;

-- Hockey stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit) VALUES
('NHL', 'basic', 'goals', 'Goals', 'Goals scored', 'count'),
('NHL', 'advanced', 'expected_goals', 'xG', 'Expected goals', 'decimal'),
('NHL', 'advanced', 'high_danger_chances', 'HDC', 'High danger chances', 'count'),
('NHL', 'tracking', 'zone_entries', 'Zone Entries', 'Offensive zone entries', 'count'),
('NHL', 'tracking', 'zone_exits', 'Zone Exits', 'Defensive zone exits', 'count')
ON CONFLICT (sport, stat_name) DO NOTHING;

-- Soccer stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit) VALUES
('MLS', 'basic', 'goals', 'Goals', 'Goals scored', 'count'),
('MLS', 'advanced', 'expected_goals', 'xG', 'Expected goals', 'decimal'),
('MLS', 'advanced', 'expected_assists', 'xA', 'Expected assists', 'decimal'),
('MLS', 'tracking', 'progressive_carries', 'Prog Carries', 'Progressive ball carries', 'count'),
('MLS', 'tracking', 'pressures_applied', 'Pressures', 'Defensive pressures', 'count')
ON CONFLICT (sport, stat_name) DO NOTHING;

-- 8. Create views for easy stat access

-- Comprehensive player stats view
CREATE OR REPLACE VIEW player_comprehensive_stats AS
SELECT 
  pgl.id,
  pgl.player_id,
  pgl.game_id,
  pgl.game_date,
  g.sport,
  pgl.minutes_played,
  pgl.fantasy_points,
  pgl.stats AS basic_stats,
  pgl.computed_metrics,
  pgl.tracking_data,
  pgl.situational_stats,
  pgl.metadata,
  -- Extract commonly used stats
  (pgl.stats->>'points')::int as points,
  (pgl.stats->>'rebounds')::int as rebounds,
  (pgl.stats->>'assists')::int as assists,
  (pgl.computed_metrics->>'true_shooting_pct')::float as true_shooting_pct,
  (pgl.tracking_data->>'distance_traveled')::float as distance_traveled,
  (pgl.situational_stats->>'clutch_points')::int as clutch_points
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id;

-- 9. Create functions for stat aggregation

CREATE OR REPLACE FUNCTION aggregate_play_by_play_stats(p_game_id INTEGER, p_player_id INTEGER)
RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}';
  play_stats JSONB;
BEGIN
  -- Aggregate stats from play-by-play data
  SELECT 
    jsonb_build_object(
      'touches', COUNT(*) FILTER (WHERE players_involved ? p_player_id::text),
      'plays_involved', COUNT(*) FILTER (WHERE players_involved ? p_player_id::text),
      'scoring_plays', COUNT(*) FILTER (WHERE players_involved ? p_player_id::text AND play_result->>'points' IS NOT NULL)
    ) INTO play_stats
  FROM play_by_play_data
  WHERE game_id = p_game_id;
  
  RETURN play_stats;
END;
$$ LANGUAGE plpgsql;

-- 10. Create data quality tracking

CREATE TABLE IF NOT EXISTS data_quality_metrics (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  sport TEXT NOT NULL,
  basic_stats_coverage FLOAT,        -- % of expected basic stats present
  advanced_stats_coverage FLOAT,     -- % of expected advanced stats
  tracking_data_available BOOLEAN,
  play_by_play_available BOOLEAN,
  data_source TEXT,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  issues JSONB DEFAULT '[]',
  UNIQUE(game_id)
);

-- Comments for documentation
COMMENT ON COLUMN player_game_logs.raw_stats IS 'Unprocessed stats exactly as received from data source';
COMMENT ON COLUMN player_game_logs.computed_metrics IS 'Calculated advanced metrics like PER, true shooting %, etc';
COMMENT ON COLUMN player_game_logs.tracking_data IS 'Player movement and biometric data from tracking systems';
COMMENT ON COLUMN player_game_logs.situational_stats IS 'Context-specific stats like clutch, red zone, with runners in scoring position';
COMMENT ON COLUMN player_game_logs.play_by_play_stats IS 'Stats aggregated from granular play-by-play data';
COMMENT ON COLUMN player_game_logs.matchup_stats IS 'Performance vs specific opponents, pitchers, or defensive schemes';
COMMENT ON COLUMN player_game_logs.metadata IS 'Game context: weather, injuries, lineup position, etc';
COMMENT ON COLUMN player_game_logs.quality_metrics IS 'Indicators of data completeness and reliability';
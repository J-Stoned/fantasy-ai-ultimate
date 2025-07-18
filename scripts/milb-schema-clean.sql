-- Minor League Baseball Schema Extensions
-- Add MiLB-specific columns to existing tables

ALTER TABLE teams ADD COLUMN IF NOT EXISTS parent_org_id INTEGER REFERENCES teams(id);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS league_level VARCHAR(20);
ALTER TABLE teams ADD COLUMN IF NOT EXISTS milb_league_id INTEGER;
ALTER TABLE teams ADD COLUMN IF NOT EXISTS milb_division VARCHAR(50);

ALTER TABLE games ADD COLUMN IF NOT EXISTS scheduled_innings INTEGER DEFAULT 9;
ALTER TABLE games ADD COLUMN IF NOT EXISTS actual_innings INTEGER;
ALTER TABLE games ADD COLUMN IF NOT EXISTS game_type VARCHAR(10) DEFAULT 'R';
ALTER TABLE games ADD COLUMN IF NOT EXISTS doubleheader INTEGER DEFAULT 0;

ALTER TABLE players ADD COLUMN IF NOT EXISTS milb_status VARCHAR(20);
ALTER TABLE players ADD COLUMN IF NOT EXISTS draft_year INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS draft_round INTEGER;
ALTER TABLE players ADD COLUMN IF NOT EXISTS signing_bonus NUMERIC;

-- New MiLB-specific tables
CREATE TABLE IF NOT EXISTS milb_affiliations (
  id SERIAL PRIMARY KEY,
  mlb_team_id INTEGER REFERENCES teams(id),
  milb_team_id INTEGER REFERENCES teams(id),
  affiliation_level VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milb_ballparks (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id),
  venue_name VARCHAR(255) NOT NULL,
  capacity INTEGER,
  elevation_feet INTEGER,
  park_factor_runs NUMERIC,
  park_factor_hr NUMERIC,
  surface_type VARCHAR(50),
  dimensions JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milb_prospect_rankings (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  ranking_source VARCHAR(50) NOT NULL,
  overall_rank INTEGER,
  org_rank INTEGER,
  position_rank INTEGER,
  grade VARCHAR(10),
  eta_year INTEGER,
  tools_grades JSONB,
  ranking_date DATE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milb_development_metrics (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  season INTEGER NOT NULL,
  level VARCHAR(20) NOT NULL,
  days_at_level INTEGER,
  promotion_velocity NUMERIC,
  performance_vs_age NUMERIC,
  league_adjusted_ops NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

-- ML Enhancement tables for MiLB
CREATE TABLE IF NOT EXISTS milb_weather_impact (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  temperature_impact NUMERIC,
  wind_impact NUMERIC,
  altitude_impact NUMERIC,
  humidity_impact NUMERIC,
  total_runs_adjustment NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milb_travel_metrics (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id),
  game_id INTEGER REFERENCES games(id),
  miles_traveled INTEGER,
  time_zones_crossed INTEGER,
  bus_trip BOOLEAN DEFAULT true,
  rest_days INTEGER,
  cumulative_miles_week INTEGER,
  fatigue_score NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_milb_affiliations_current ON milb_affiliations(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_milb_affiliations_mlb_team ON milb_affiliations(mlb_team_id);
CREATE INDEX IF NOT EXISTS idx_milb_prospect_rankings_player ON milb_prospect_rankings(player_id, ranking_date);
CREATE INDEX IF NOT EXISTS idx_milb_development_player_season ON milb_development_metrics(player_id, season);
CREATE INDEX IF NOT EXISTS idx_milb_weather_game ON milb_weather_impact(game_id);
CREATE INDEX IF NOT EXISTS idx_milb_travel_team_game ON milb_travel_metrics(team_id, game_id);
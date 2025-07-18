-- Minor League Baseball Schema Extensions
-- Run each command individually or wrap in a transaction

BEGIN;

-- Add parent_org_id column to teams
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='teams' AND column_name='parent_org_id') THEN
        ALTER TABLE teams ADD COLUMN parent_org_id INTEGER REFERENCES teams(id);
    END IF;
END $$;

-- Add league_level column to teams
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='teams' AND column_name='league_level') THEN
        ALTER TABLE teams ADD COLUMN league_level VARCHAR(20);
    END IF;
END $$;

-- Add milb_league_id column to teams
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='teams' AND column_name='milb_league_id') THEN
        ALTER TABLE teams ADD COLUMN milb_league_id INTEGER;
    END IF;
END $$;

-- Add milb_division column to teams
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='teams' AND column_name='milb_division') THEN
        ALTER TABLE teams ADD COLUMN milb_division VARCHAR(50);
    END IF;
END $$;

-- Add scheduled_innings column to games
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='games' AND column_name='scheduled_innings') THEN
        ALTER TABLE games ADD COLUMN scheduled_innings INTEGER DEFAULT 9;
    END IF;
END $$;

-- Add actual_innings column to games
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='games' AND column_name='actual_innings') THEN
        ALTER TABLE games ADD COLUMN actual_innings INTEGER;
    END IF;
END $$;

-- Add game_type column to games
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='games' AND column_name='game_type') THEN
        ALTER TABLE games ADD COLUMN game_type VARCHAR(10) DEFAULT 'R';
    END IF;
END $$;

-- Add doubleheader column to games
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='games' AND column_name='doubleheader') THEN
        ALTER TABLE games ADD COLUMN doubleheader INTEGER DEFAULT 0;
    END IF;
END $$;

-- Add milb_status column to players
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='players' AND column_name='milb_status') THEN
        ALTER TABLE players ADD COLUMN milb_status VARCHAR(20);
    END IF;
END $$;

-- Add draft_year column to players
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='players' AND column_name='draft_year') THEN
        ALTER TABLE players ADD COLUMN draft_year INTEGER;
    END IF;
END $$;

-- Add draft_round column to players
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='players' AND column_name='draft_round') THEN
        ALTER TABLE players ADD COLUMN draft_round INTEGER;
    END IF;
END $$;

-- Add signing_bonus column to players
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                   WHERE table_name='players' AND column_name='signing_bonus') THEN
        ALTER TABLE players ADD COLUMN signing_bonus NUMERIC;
    END IF;
END $$;

-- Create milb_affiliations table
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

-- Create milb_ballparks table
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

-- Create milb_prospect_rankings table
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

-- Create milb_development_metrics table
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

-- Create milb_weather_impact table
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

-- Create milb_travel_metrics table
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

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_milb_affiliations_current ON milb_affiliations(is_current) WHERE is_current = true;
CREATE INDEX IF NOT EXISTS idx_milb_affiliations_mlb_team ON milb_affiliations(mlb_team_id);
CREATE INDEX IF NOT EXISTS idx_milb_prospect_rankings_player ON milb_prospect_rankings(player_id, ranking_date);
CREATE INDEX IF NOT EXISTS idx_milb_development_player_season ON milb_development_metrics(player_id, season);
CREATE INDEX IF NOT EXISTS idx_milb_weather_game ON milb_weather_impact(game_id);
CREATE INDEX IF NOT EXISTS idx_milb_travel_team_game ON milb_travel_metrics(team_id, game_id);

COMMIT;
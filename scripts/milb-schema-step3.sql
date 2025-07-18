-- Step 3: Create new MiLB tables
CREATE TABLE IF NOT EXISTS milb_affiliations (
  id SERIAL PRIMARY KEY,
  mlb_team_id INTEGER,
  milb_team_id INTEGER,
  affiliation_level VARCHAR(20) NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milb_ballparks (
  id SERIAL PRIMARY KEY,
  team_id INTEGER,
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
  player_id INTEGER,
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
  player_id INTEGER,
  season INTEGER NOT NULL,
  level VARCHAR(20) NOT NULL,
  days_at_level INTEGER,
  promotion_velocity NUMERIC,
  performance_vs_age NUMERIC,
  league_adjusted_ops NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milb_weather_impact (
  id SERIAL PRIMARY KEY,
  game_id INTEGER,
  temperature_impact NUMERIC,
  wind_impact NUMERIC,
  altitude_impact NUMERIC,
  humidity_impact NUMERIC,
  total_runs_adjustment NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS milb_travel_metrics (
  id SERIAL PRIMARY KEY,
  team_id INTEGER,
  game_id INTEGER,
  miles_traveled INTEGER,
  time_zones_crossed INTEGER,
  bus_trip BOOLEAN DEFAULT true,
  rest_days INTEGER,
  cumulative_miles_week INTEGER,
  fatigue_score NUMERIC,
  created_at TIMESTAMP DEFAULT NOW()
);
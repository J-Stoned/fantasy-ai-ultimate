-- Create missing critical tables for ML training

-- Player stats table
CREATE TABLE IF NOT EXISTS player_stats (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  game_id INTEGER REFERENCES games(id),
  stat_type VARCHAR(50),
  stats JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id, game_id, stat_type)
);

-- Player injuries table
CREATE TABLE IF NOT EXISTS player_injuries (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  injury_type VARCHAR(100),
  status VARCHAR(50),
  description TEXT,
  source VARCHAR(255),
  reported_date TIMESTAMPTZ,
  return_date TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Weather data table
CREATE TABLE IF NOT EXISTS weather_data (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  temperature DECIMAL(5,2),
  feels_like DECIMAL(5,2),
  humidity INTEGER,
  wind_speed DECIMAL(5,2),
  wind_direction INTEGER,
  conditions VARCHAR(100),
  description TEXT,
  is_dome BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id)
);

-- Team stats table
CREATE TABLE IF NOT EXISTS team_stats (
  id SERIAL PRIMARY KEY,
  team_id INTEGER REFERENCES teams(id),
  season INTEGER,
  games_played INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  losses INTEGER DEFAULT 0,
  ties INTEGER DEFAULT 0,
  points_for INTEGER DEFAULT 0,
  points_against INTEGER DEFAULT 0,
  avg_points_for DECIMAL(5,2),
  avg_points_against DECIMAL(5,2),
  win_percentage DECIMAL(5,3),
  home_record VARCHAR(10),
  away_record VARCHAR(10),
  division_record VARCHAR(10),
  conference_record VARCHAR(10),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(team_id, season)
);

-- Player performance summary
CREATE TABLE IF NOT EXISTS player_performance (
  id SERIAL PRIMARY KEY,
  player_id INTEGER REFERENCES players(id),
  avg_fantasy_points DECIMAL(5,2),
  consistency_rating DECIMAL(5,2),
  trend_rating DECIMAL(5,2),
  games_analyzed INTEGER,
  last_updated TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(player_id)
);

-- Game events for play-by-play
CREATE TABLE IF NOT EXISTS game_events (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  event_type VARCHAR(50),
  quarter INTEGER,
  time_remaining VARCHAR(10),
  description TEXT,
  player_id INTEGER REFERENCES players(id),
  points_scored INTEGER DEFAULT 0,
  fantasy_impact DECIMAL(5,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Expert picks from YouTube/analysts
CREATE TABLE IF NOT EXISTS expert_picks (
  id SERIAL PRIMARY KEY,
  video_id VARCHAR(255),
  title TEXT,
  channel VARCHAR(255),
  description TEXT,
  published_at TIMESTAMPTZ,
  players_mentioned TEXT[],
  analysis_type VARCHAR(50),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_stats_player_id ON player_stats(player_id);
CREATE INDEX IF NOT EXISTS idx_player_stats_game_id ON player_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_player_injuries_player_id ON player_injuries(player_id);
CREATE INDEX IF NOT EXISTS idx_player_injuries_status ON player_injuries(status);
CREATE INDEX IF NOT EXISTS idx_weather_data_game_id ON weather_data(game_id);
CREATE INDEX IF NOT EXISTS idx_team_stats_team_id ON team_stats(team_id);
CREATE INDEX IF NOT EXISTS idx_game_events_game_id ON game_events(game_id);
CREATE INDEX IF NOT EXISTS idx_game_events_player_id ON game_events(player_id);
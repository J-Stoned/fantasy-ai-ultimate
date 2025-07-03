-- Part 2: Create new tables
-- Run this after part 1

-- Drop old tables with wrong types if they exist
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'player_game_logs' 
    AND column_name = 'player_id' 
    AND data_type = 'uuid'
  ) THEN
    DROP TABLE IF EXISTS player_game_logs CASCADE;
  END IF;
END $$;

-- Create platform mapping table
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

-- Create game logs table
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

-- Create season stats table
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
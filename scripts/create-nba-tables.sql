-- Create NBA Players table (similar to mlb_players)
CREATE TABLE IF NOT EXISTS nba_players (
  id SERIAL PRIMARY KEY,
  nba_player_id VARCHAR(50) UNIQUE NOT NULL, -- Format: 'nba_123456'
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(50),
  jersey_number INTEGER,
  current_team VARCHAR(255),
  height VARCHAR(20),
  weight INTEGER,
  birthdate DATE,
  college VARCHAR(255),
  draft_year INTEGER,
  draft_round INTEGER,
  draft_pick INTEGER,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create NBA Stats table (similar to mlb_stats)
CREATE TABLE IF NOT EXISTS nba_stats (
  id SERIAL PRIMARY KEY,
  nba_player_id VARCHAR(50) NOT NULL,
  game_id INTEGER NOT NULL,
  stat_type VARCHAR(50) NOT NULL,
  stat_value DECIMAL(10, 2) NOT NULL,
  fantasy_points DECIMAL(10, 2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  FOREIGN KEY (nba_player_id) REFERENCES nba_players(nba_player_id),
  FOREIGN KEY (game_id) REFERENCES games(id),
  UNIQUE(nba_player_id, game_id, stat_type)
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_nba_players_player_id ON nba_players(nba_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_players_name ON nba_players(player_name);
CREATE INDEX IF NOT EXISTS idx_nba_players_team ON nba_players(current_team);

CREATE INDEX IF NOT EXISTS idx_nba_stats_player_id ON nba_stats(nba_player_id);
CREATE INDEX IF NOT EXISTS idx_nba_stats_game_id ON nba_stats(game_id);
CREATE INDEX IF NOT EXISTS idx_nba_stats_type ON nba_stats(stat_type);
CREATE INDEX IF NOT EXISTS idx_nba_stats_composite ON nba_stats(nba_player_id, game_id);

-- Add triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_nba_players_updated_at 
  BEFORE UPDATE ON nba_players 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions (adjust as needed)
GRANT ALL ON nba_players TO postgres;
GRANT ALL ON nba_stats TO postgres;
GRANT ALL ON nba_players_id_seq TO postgres;
GRANT ALL ON nba_stats_id_seq TO postgres;
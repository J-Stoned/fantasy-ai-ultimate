-- 🏀 NBA TABLES (Following MLB Success Pattern)
DROP TABLE IF EXISTS nba_stats CASCADE;
DROP TABLE IF EXISTS nba_players CASCADE;

CREATE TABLE nba_players (
  id SERIAL PRIMARY KEY,
  nba_player_id VARCHAR(50) UNIQUE NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(50),
  jersey_number INTEGER,
  team VARCHAR(100),
  height VARCHAR(20),
  weight INTEGER,
  birth_date DATE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nba_stats (
  id SERIAL PRIMARY KEY,
  nba_player_id VARCHAR(50) NOT NULL,
  game_id INTEGER NOT NULL,
  stat_type VARCHAR(50) NOT NULL,
  stat_value NUMERIC NOT NULL,
  fantasy_points NUMERIC DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (nba_player_id) REFERENCES nba_players(nba_player_id),
  FOREIGN KEY (game_id) REFERENCES games(id),
  UNIQUE(nba_player_id, game_id, stat_type)
);

-- 🏈 NFL TABLES (Following MLB Success Pattern)
DROP TABLE IF EXISTS nfl_stats CASCADE;
DROP TABLE IF EXISTS nfl_players CASCADE;

CREATE TABLE nfl_players (
  id SERIAL PRIMARY KEY,
  nfl_player_id VARCHAR(50) UNIQUE NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(50),
  jersey_number INTEGER,
  team VARCHAR(100),
  height VARCHAR(20),
  weight INTEGER,
  college VARCHAR(100),
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE nfl_stats (
  id SERIAL PRIMARY KEY,
  nfl_player_id VARCHAR(50) NOT NULL,
  game_id INTEGER NOT NULL,
  stat_type VARCHAR(50) NOT NULL,
  stat_value NUMERIC NOT NULL,
  fantasy_points NUMERIC DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (nfl_player_id) REFERENCES nfl_players(nfl_player_id),
  FOREIGN KEY (game_id) REFERENCES games(id),
  UNIQUE(nfl_player_id, game_id, stat_type)
);

-- INDEXES FOR MAXIMUM PERFORMANCE
CREATE INDEX idx_nba_players_name ON nba_players(player_name);
CREATE INDEX idx_nba_players_team ON nba_players(team);
CREATE INDEX idx_nba_stats_player ON nba_stats(nba_player_id);
CREATE INDEX idx_nba_stats_game ON nba_stats(game_id);
CREATE INDEX idx_nba_stats_type ON nba_stats(stat_type);
CREATE INDEX idx_nba_stats_fantasy ON nba_stats(fantasy_points);

CREATE INDEX idx_nfl_players_name ON nfl_players(player_name);
CREATE INDEX idx_nfl_players_team ON nfl_players(team);
CREATE INDEX idx_nfl_stats_player ON nfl_stats(nfl_player_id);
CREATE INDEX idx_nfl_stats_game ON nfl_stats(game_id);
CREATE INDEX idx_nfl_stats_type ON nfl_stats(stat_type);
CREATE INDEX idx_nfl_stats_fantasy ON nfl_stats(fantasy_points);

-- VIEWS FOR EASY ANALYSIS
CREATE OR REPLACE VIEW nba_player_game_stats AS
SELECT 
  p.nba_player_id,
  p.player_name,
  p.position,
  p.team,
  g.id as game_id,
  g.start_time as game_date,
  g.home_team_id,
  g.away_team_id,
  s.stat_type,
  s.stat_value,
  s.fantasy_points
FROM nba_stats s
JOIN nba_players p ON s.nba_player_id = p.nba_player_id
JOIN games g ON s.game_id = g.id
WHERE g.sport = 'NBA';

CREATE OR REPLACE VIEW nfl_player_game_stats AS
SELECT 
  p.nfl_player_id,
  p.player_name,
  p.position,
  p.team,
  g.id as game_id,
  g.start_time as game_date,
  g.home_team_id,
  g.away_team_id,
  s.stat_type,
  s.stat_value,
  s.fantasy_points
FROM nfl_stats s
JOIN nfl_players p ON s.nfl_player_id = p.nfl_player_id
JOIN games g ON s.game_id = g.id
WHERE g.sport = 'NFL';
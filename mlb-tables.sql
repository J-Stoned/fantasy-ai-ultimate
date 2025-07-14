-- Drop tables if they exist (for clean setup)
DROP TABLE IF EXISTS mlb_stats CASCADE;
DROP TABLE IF EXISTS mlb_players CASCADE;

-- 1. Create MLB players table
CREATE TABLE mlb_players (
  id SERIAL PRIMARY KEY,
  mlb_player_id VARCHAR(50) UNIQUE NOT NULL,
  player_name VARCHAR(255) NOT NULL,
  position VARCHAR(50),
  jersey_number INTEGER,
  current_team VARCHAR(100),
  bat_side VARCHAR(10),
  pitch_hand VARCHAR(10),
  mlb_debut DATE,
  birth_date DATE,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 2. Create MLB stats table
CREATE TABLE mlb_stats (
  id SERIAL PRIMARY KEY,
  mlb_player_id VARCHAR(50) NOT NULL,
  game_id INTEGER NOT NULL,
  stat_type VARCHAR(50) NOT NULL,
  stat_value NUMERIC NOT NULL,
  fantasy_points NUMERIC DEFAULT 0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (mlb_player_id) REFERENCES mlb_players(mlb_player_id),
  FOREIGN KEY (game_id) REFERENCES games(id),
  UNIQUE(mlb_player_id, game_id, stat_type)
);

-- 3. Create indexes for performance
CREATE INDEX idx_mlb_players_name ON mlb_players(player_name);
CREATE INDEX idx_mlb_players_team ON mlb_players(current_team);
CREATE INDEX idx_mlb_stats_player ON mlb_stats(mlb_player_id);
CREATE INDEX idx_mlb_stats_game ON mlb_stats(game_id);
CREATE INDEX idx_mlb_stats_type ON mlb_stats(stat_type);
CREATE INDEX idx_mlb_stats_fantasy ON mlb_stats(fantasy_points);

-- 4. Create a view for easy querying
CREATE OR REPLACE VIEW mlb_player_game_stats AS
SELECT 
  p.mlb_player_id,
  p.player_name,
  p.position,
  p.current_team,
  g.id as game_id,
  g.external_id as game_external_id,
  g.start_time as game_date,
  g.home_team_id,
  g.away_team_id,
  s.stat_type,
  s.stat_value,
  s.fantasy_points
FROM mlb_stats s
JOIN mlb_players p ON s.mlb_player_id = p.mlb_player_id
JOIN games g ON s.game_id = g.id
WHERE g.sport = 'MLB';

-- 5. Create aggregate stats view
CREATE OR REPLACE VIEW mlb_player_season_stats AS
SELECT 
  p.mlb_player_id,
  p.player_name,
  p.position,
  p.current_team,
  COUNT(DISTINCT s.game_id) as games_played,
  
  -- Batting stats
  SUM(CASE WHEN s.stat_type = 'hits' THEN s.stat_value ELSE 0 END) as total_hits,
  SUM(CASE WHEN s.stat_type = 'home_runs' THEN s.stat_value ELSE 0 END) as total_home_runs,
  SUM(CASE WHEN s.stat_type = 'rbi' THEN s.stat_value ELSE 0 END) as total_rbi,
  SUM(CASE WHEN s.stat_type = 'runs' THEN s.stat_value ELSE 0 END) as total_runs,
  
  -- Pitching stats
  SUM(CASE WHEN s.stat_type = 'innings_pitched' THEN s.stat_value ELSE 0 END) as total_innings_pitched,
  SUM(CASE WHEN s.stat_type = 'strikeouts' THEN s.stat_value ELSE 0 END) as total_strikeouts,
  SUM(CASE WHEN s.stat_type = 'wins' THEN s.stat_value ELSE 0 END) as total_wins,
  
  -- Fantasy
  SUM(s.fantasy_points) as total_fantasy_points,
  AVG(s.fantasy_points) as avg_fantasy_points_per_game
  
FROM mlb_players p
JOIN mlb_stats s ON p.mlb_player_id = s.mlb_player_id
GROUP BY p.mlb_player_id, p.player_name, p.position, p.current_team;
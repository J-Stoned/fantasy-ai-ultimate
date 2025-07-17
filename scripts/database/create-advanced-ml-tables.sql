-- 🚀 ADVANCED ML TABLES FOR 70%+ ACCURACY
-- These tables implement concepts from the sports analytics masterclass

-- 1. Advanced player performance metrics
CREATE TABLE IF NOT EXISTS advanced_player_metrics (
  id SERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  game_id TEXT NOT NULL REFERENCES games(id),
  sport TEXT NOT NULL,
  
  -- Universal metrics
  fantasy_points_per_minute DECIMAL(5,3),
  usage_rate DECIMAL(4,3),
  efficiency_rating DECIMAL(5,2),
  
  -- Basketball specific
  true_shooting_pct DECIMAL(4,3),  -- TS% = PTS / (2 * (FGA + 0.44 * FTA))
  player_efficiency_rating DECIMAL(5,2),  -- PER
  box_plus_minus DECIMAL(5,2),  -- BPM
  
  -- Baseball specific  
  woba DECIMAL(4,3),  -- Weighted On-Base Average
  fip DECIMAL(4,2),   -- Fielding Independent Pitching
  war DECIMAL(4,2),   -- Wins Above Replacement
  
  -- Football specific
  epa DECIMAL(5,2),   -- Expected Points Added
  success_rate DECIMAL(4,3),  -- % of positive EPA plays
  yards_per_route_run DECIMAL(4,2),
  
  -- Hockey specific
  corsi_for_pct DECIMAL(4,3),  -- Shot attempt differential
  expected_goals DECIMAL(4,2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(player_id, game_id)
);

-- 2. Team synergy and matchup data
CREATE TABLE IF NOT EXISTS team_synergy_stats (
  id SERIAL PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  lineup_hash TEXT NOT NULL,  -- MD5 hash of sorted player IDs
  player_ids TEXT[] NOT NULL,  -- Array of player IDs in lineup
  sport TEXT NOT NULL,
  
  -- Performance metrics
  games_played INTEGER DEFAULT 0,
  minutes_played DECIMAL(6,1) DEFAULT 0,
  net_rating DECIMAL(5,2),  -- Points per 100 possessions differential
  offensive_rating DECIMAL(5,2),  -- Points scored per 100 possessions
  defensive_rating DECIMAL(5,2),  -- Points allowed per 100 possessions
  pace DECIMAL(5,2),  -- Possessions per game
  
  -- Advanced synergy metrics
  assist_ratio DECIMAL(4,3),  -- % of made shots that were assisted
  turnover_ratio DECIMAL(4,3),  -- Turnovers per 100 possessions
  rebounding_rate DECIMAL(4,3),  -- % of available rebounds secured
  
  -- Fantasy specific
  avg_fantasy_points DECIMAL(5,2),
  fantasy_point_variance DECIMAL(5,2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(team_id, lineup_hash)
);

-- 3. Situational performance tracking
CREATE TABLE IF NOT EXISTS situational_performance (
  id SERIAL PRIMARY KEY,
  player_id TEXT NOT NULL REFERENCES players(id),
  sport TEXT NOT NULL,
  situation_type TEXT NOT NULL,  -- 'clutch', 'blowout', 'primetime', 'playoffs', 'division', 'b2b'
  
  -- Sample size
  games_played INTEGER DEFAULT 0,
  total_minutes DECIMAL(6,1) DEFAULT 0,
  
  -- Performance metrics
  avg_fantasy_points DECIMAL(5,2),
  fantasy_points_std_dev DECIMAL(5,2),
  success_rate DECIMAL(4,3),  -- % of games meeting projection
  
  -- Sport-specific clutch metrics
  points_per_minute DECIMAL(4,3),
  usage_rate_change DECIMAL(4,3),  -- Change from normal usage
  efficiency_change DECIMAL(4,3),  -- Change from normal efficiency
  
  -- Betting performance
  games_over_projection INTEGER DEFAULT 0,
  games_under_projection INTEGER DEFAULT 0,
  avg_projection_diff DECIMAL(5,2),  -- Actual - Projected
  
  last_updated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(player_id, sport, situation_type)
);

-- 4. Market sentiment and betting trends
CREATE TABLE IF NOT EXISTS market_sentiment (
  id SERIAL PRIMARY KEY,
  game_id TEXT NOT NULL REFERENCES games(id),
  snapshot_time TIMESTAMP NOT NULL DEFAULT NOW(),
  
  -- Betting percentages
  public_bet_pct_home DECIMAL(4,3),  -- % of bets on home team
  public_money_pct_home DECIMAL(4,3),  -- % of money on home team
  sharp_money_indicator DECIMAL(3,2),  -- -1 to 1, negative = sharp on away
  
  -- Line movement
  opening_spread DECIMAL(4,1),
  current_spread DECIMAL(4,1),
  opening_total DECIMAL(5,1),
  current_total DECIMAL(5,1),
  line_movement_velocity DECIMAL(4,2),  -- Points per hour
  
  -- Advanced metrics
  reverse_line_movement BOOLEAN DEFAULT FALSE,  -- Line moves against public
  steam_move_detected BOOLEAN DEFAULT FALSE,  -- Sudden coordinated betting
  
  -- Market efficiency
  closing_line_value DECIMAL(4,3),  -- Expected value vs closing line
  
  -- JSON fields for complex data
  line_history JSONB,  -- Array of {time, spread, total}
  bet_distribution JSONB,  -- {spread: {home_pct, away_pct}, total: {over_pct, under_pct}}
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Schedule fatigue calculations
CREATE TABLE IF NOT EXISTS schedule_fatigue_metrics (
  id SERIAL PRIMARY KEY,
  team_id TEXT NOT NULL REFERENCES teams(id),
  game_id TEXT NOT NULL REFERENCES games(id),
  
  -- Travel metrics
  travel_miles INTEGER DEFAULT 0,
  timezone_change INTEGER DEFAULT 0,  -- -3 to +3
  altitude_change INTEGER DEFAULT 0,  -- Feet difference
  
  -- Rest metrics
  rest_days INTEGER NOT NULL,  -- Days since last game
  games_in_last_7_days INTEGER DEFAULT 0,
  games_in_last_14_days INTEGER DEFAULT 0,
  
  -- Cumulative fatigue
  cumulative_miles_7_days INTEGER DEFAULT 0,
  cumulative_miles_14_days INTEGER DEFAULT 0,
  back_to_back_games INTEGER DEFAULT 0,  -- In last 14 days
  
  -- Calculated scores (0-100, higher = more fatigued)
  travel_fatigue_score DECIMAL(3,1),
  schedule_fatigue_score DECIMAL(3,1),
  combined_fatigue_score DECIMAL(3,1),
  
  -- Performance impact
  historical_performance_impact DECIMAL(4,3),  -- % change in team performance
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(team_id, game_id)
);

-- Create indexes for performance
CREATE INDEX idx_advanced_metrics_player_game ON advanced_player_metrics(player_id, game_id);
CREATE INDEX idx_advanced_metrics_sport ON advanced_player_metrics(sport);
CREATE INDEX idx_synergy_team_lineup ON team_synergy_stats(team_id, lineup_hash);
CREATE INDEX idx_synergy_games_played ON team_synergy_stats(games_played DESC);
CREATE INDEX idx_situational_player_type ON situational_performance(player_id, situation_type);
CREATE INDEX idx_market_game_time ON market_sentiment(game_id, snapshot_time DESC);
CREATE INDEX idx_market_sharp ON market_sentiment(sharp_money_indicator) WHERE sharp_money_indicator IS NOT NULL;
CREATE INDEX idx_fatigue_team_game ON schedule_fatigue_metrics(team_id, game_id);
CREATE INDEX idx_fatigue_score ON schedule_fatigue_metrics(combined_fatigue_score DESC);

-- Add update triggers
CREATE OR REPLACE FUNCTION update_modified_time()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_advanced_metrics_modtime
    BEFORE UPDATE ON advanced_player_metrics
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_time();

CREATE TRIGGER update_synergy_modtime
    BEFORE UPDATE ON team_synergy_stats
    FOR EACH ROW
    EXECUTE FUNCTION update_modified_time();
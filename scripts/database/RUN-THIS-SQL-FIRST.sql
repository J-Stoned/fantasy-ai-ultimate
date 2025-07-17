-- 🚨 RUN THIS EXACT SQL IN SUPABASE SQL EDITOR
-- This is the CORRECT version that matches your existing schema

-- First, let's verify the existing table structure
SELECT 
    column_name,
    data_type,
    is_nullable
FROM information_schema.columns
WHERE table_name = 'players'
AND column_name IN ('id', 'external_id');

-- Should show:
-- id: bigint
-- external_id: text

-- Now create the ML tables with CORRECT data types
-- 1. Advanced player performance metrics
CREATE TABLE IF NOT EXISTS advanced_player_metrics (
  id SERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players(id),
  game_id BIGINT NOT NULL REFERENCES games(id),
  sport TEXT NOT NULL,
  
  -- Universal metrics
  fantasy_points_per_minute DECIMAL(5,3),
  usage_rate DECIMAL(4,3),
  efficiency_rating DECIMAL(5,2),
  
  -- Basketball specific
  true_shooting_pct DECIMAL(4,3),
  player_efficiency_rating DECIMAL(5,2),
  box_plus_minus DECIMAL(5,2),
  
  -- Baseball specific  
  woba DECIMAL(4,3),
  fip DECIMAL(4,2),
  war DECIMAL(4,2),
  
  -- Football specific
  epa DECIMAL(5,2),
  success_rate DECIMAL(4,3),
  yards_per_route_run DECIMAL(4,2),
  
  -- Hockey specific
  corsi_for_pct DECIMAL(4,3),
  expected_goals DECIMAL(4,2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(player_id, game_id)
);

-- 2. Team synergy and matchup data
CREATE TABLE IF NOT EXISTS team_synergy_stats (
  id SERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES teams(id),
  lineup_hash TEXT NOT NULL,
  player_ids BIGINT[] NOT NULL,
  sport TEXT NOT NULL,
  
  games_played INTEGER DEFAULT 0,
  minutes_played DECIMAL(6,1) DEFAULT 0,
  net_rating DECIMAL(5,2),
  offensive_rating DECIMAL(5,2),
  defensive_rating DECIMAL(5,2),
  pace DECIMAL(5,2),
  
  assist_ratio DECIMAL(4,3),
  turnover_ratio DECIMAL(4,3),
  rebounding_rate DECIMAL(4,3),
  
  avg_fantasy_points DECIMAL(5,2),
  fantasy_point_variance DECIMAL(5,2),
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(team_id, lineup_hash)
);

-- 3. Situational performance tracking
CREATE TABLE IF NOT EXISTS situational_performance (
  id SERIAL PRIMARY KEY,
  player_id BIGINT NOT NULL REFERENCES players(id),
  sport TEXT NOT NULL,
  situation_type TEXT NOT NULL,
  
  games_played INTEGER DEFAULT 0,
  total_minutes DECIMAL(6,1) DEFAULT 0,
  
  avg_fantasy_points DECIMAL(5,2),
  fantasy_points_std_dev DECIMAL(5,2),
  success_rate DECIMAL(4,3),
  
  points_per_minute DECIMAL(4,3),
  usage_rate_change DECIMAL(4,3),
  efficiency_change DECIMAL(4,3),
  
  games_over_projection INTEGER DEFAULT 0,
  games_under_projection INTEGER DEFAULT 0,
  avg_projection_diff DECIMAL(5,2),
  
  last_updated TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(player_id, sport, situation_type)
);

-- 4. Market sentiment and betting trends
CREATE TABLE IF NOT EXISTS market_sentiment (
  id SERIAL PRIMARY KEY,
  game_id BIGINT NOT NULL REFERENCES games(id),
  snapshot_time TIMESTAMP NOT NULL DEFAULT NOW(),
  
  public_bet_pct_home DECIMAL(4,3),
  public_money_pct_home DECIMAL(4,3),
  sharp_money_indicator DECIMAL(3,2),
  
  opening_spread DECIMAL(4,1),
  current_spread DECIMAL(4,1),
  opening_total DECIMAL(5,1),
  current_total DECIMAL(5,1),
  line_movement_velocity DECIMAL(4,2),
  
  reverse_line_movement BOOLEAN DEFAULT FALSE,
  steam_move_detected BOOLEAN DEFAULT FALSE,
  
  closing_line_value DECIMAL(4,3),
  
  line_history JSONB,
  bet_distribution JSONB,
  
  created_at TIMESTAMP DEFAULT NOW()
);

-- 5. Schedule fatigue calculations
CREATE TABLE IF NOT EXISTS schedule_fatigue_metrics (
  id SERIAL PRIMARY KEY,
  team_id BIGINT NOT NULL REFERENCES teams(id),
  game_id BIGINT NOT NULL REFERENCES games(id),
  
  travel_miles INTEGER DEFAULT 0,
  timezone_change INTEGER DEFAULT 0,
  altitude_change INTEGER DEFAULT 0,
  
  rest_days INTEGER NOT NULL,
  games_in_last_7_days INTEGER DEFAULT 0,
  games_in_last_14_days INTEGER DEFAULT 0,
  
  cumulative_miles_7_days INTEGER DEFAULT 0,
  cumulative_miles_14_days INTEGER DEFAULT 0,
  back_to_back_games INTEGER DEFAULT 0,
  
  travel_fatigue_score DECIMAL(3,1),
  schedule_fatigue_score DECIMAL(3,1),
  combined_fatigue_score DECIMAL(3,1),
  
  historical_performance_impact DECIMAL(4,3),
  
  created_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(team_id, game_id)
);

-- Create all indexes
CREATE INDEX IF NOT EXISTS idx_advanced_metrics_player_game ON advanced_player_metrics(player_id, game_id);
CREATE INDEX IF NOT EXISTS idx_advanced_metrics_sport ON advanced_player_metrics(sport);
CREATE INDEX IF NOT EXISTS idx_synergy_team_lineup ON team_synergy_stats(team_id, lineup_hash);
CREATE INDEX IF NOT EXISTS idx_synergy_games_played ON team_synergy_stats(games_played DESC);
CREATE INDEX IF NOT EXISTS idx_situational_player_type ON situational_performance(player_id, situation_type);
CREATE INDEX IF NOT EXISTS idx_market_game_time ON market_sentiment(game_id, snapshot_time DESC);
CREATE INDEX IF NOT EXISTS idx_market_sharp ON market_sentiment(sharp_money_indicator) WHERE sharp_money_indicator IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_fatigue_team_game ON schedule_fatigue_metrics(team_id, game_id);
CREATE INDEX IF NOT EXISTS idx_fatigue_score ON schedule_fatigue_metrics(combined_fatigue_score DESC);

-- Verify all tables were created successfully
SELECT 
    table_name,
    CASE 
        WHEN COUNT(*) > 0 THEN '✅ Created Successfully'
        ELSE '❌ Not Found'
    END as status
FROM information_schema.tables
WHERE table_schema = 'public'
AND table_name IN (
    'advanced_player_metrics',
    'team_synergy_stats',
    'situational_performance',
    'market_sentiment',
    'schedule_fatigue_metrics'
)
GROUP BY table_name
ORDER BY table_name;
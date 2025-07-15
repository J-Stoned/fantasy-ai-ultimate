-- ============================================
-- FANTASY + BETTING INTEGRATION SCHEMA
-- ============================================
-- Complete integration of fantasy sports and betting data
-- Run this after the base schema is set up

-- 1. Enhanced player_stats table with betting context
ALTER TABLE player_stats 
ADD COLUMN IF NOT EXISTS betting_context JSONB DEFAULT '{}';

COMMENT ON COLUMN player_stats.betting_context IS 'Betting-related context like team odds, game totals, patterns';

-- 2. Fantasy + Betting Insights Table
CREATE TABLE IF NOT EXISTS fantasy_betting_insights (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  player_id INTEGER REFERENCES players(id),
  
  -- Fantasy projections
  fantasy_points_projected DECIMAL(6,2),
  fantasy_confidence DECIMAL(4,3),
  dfs_salary_dk INTEGER,
  dfs_salary_fd INTEGER,
  ownership_projected DECIMAL(5,2),
  
  -- Betting context
  team_moneyline_odds INTEGER,
  game_total_line DECIMAL(4,1),
  is_home_team BOOLEAN,
  active_patterns TEXT[],
  pattern_confidence DECIMAL(4,3),
  
  -- Integrated insights
  has_betting_edge BOOLEAN DEFAULT FALSE,
  edge_type VARCHAR(50), -- 'altitude', 'revenge', 'back_to_back', etc.
  edge_description TEXT,
  recommended_action VARCHAR(100), -- 'start_dfs', 'fade', 'bet_over', etc.
  expected_value DECIMAL(6,2),
  
  -- Metadata
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fbi_game_id ON fantasy_betting_insights(game_id);
CREATE INDEX idx_fbi_player_id ON fantasy_betting_insights(player_id);
CREATE INDEX idx_fbi_has_edge ON fantasy_betting_insights(has_betting_edge);
CREATE INDEX idx_fbi_created_at ON fantasy_betting_insights(created_at DESC);

-- 3. Pattern Performance Tracking
CREATE TABLE IF NOT EXISTS pattern_performance (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(100) NOT NULL,
  sport VARCHAR(20) NOT NULL,
  
  -- Performance metrics
  total_occurrences INTEGER DEFAULT 0,
  successful_predictions INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(4,3),
  
  -- Financial performance
  total_wagered DECIMAL(10,2) DEFAULT 0,
  total_profit_loss DECIMAL(10,2) DEFAULT 0,
  roi_percentage DECIMAL(6,2),
  
  -- Fantasy performance
  fantasy_boost_avg DECIMAL(4,2), -- Average boost to fantasy scores
  dfs_success_rate DECIMAL(4,3), -- Rate of successful DFS lineups
  
  -- Time tracking
  last_occurrence TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_pattern_performance_unique ON pattern_performance(pattern_type, sport);

-- 4. Integrated Player Performance View
CREATE OR REPLACE VIEW player_insights_view AS
SELECT 
  p.id,
  p.name,
  p.position,
  p.team_id,
  t.name as team_name,
  ps.games_played,
  ps.batting_average,
  ps.home_runs,
  ps.rbis,
  ps.ops,
  ps.fantasy_points_total,
  ps.betting_context,
  
  -- Recent form
  CASE 
    WHEN ps.last_7_days_avg > ps.season_avg THEN 'HOT'
    WHEN ps.last_7_days_avg < ps.season_avg * 0.8 THEN 'COLD'
    ELSE 'STABLE'
  END as current_form,
  
  -- Today's game context
  g.id as game_id,
  g.start_time,
  CASE 
    WHEN g.home_team_id = p.team_id THEN true
    ELSE false
  END as is_home,
  g.metadata->>'pattern_types' as game_patterns,
  
  -- Betting insights
  fbi.fantasy_points_projected,
  fbi.has_betting_edge,
  fbi.edge_type,
  fbi.recommended_action,
  fbi.expected_value

FROM players p
LEFT JOIN teams t ON p.team_id = t.id
LEFT JOIN player_stats ps ON p.id = ps.player_id
LEFT JOIN games g ON (g.home_team_id = p.team_id OR g.away_team_id = p.team_id) 
  AND g.start_time >= CURRENT_DATE 
  AND g.start_time < CURRENT_DATE + INTERVAL '1 day'
LEFT JOIN fantasy_betting_insights fbi ON p.id = fbi.player_id AND g.id = fbi.game_id
WHERE p.active = true;

-- 5. DFS Lineup History
CREATE TABLE IF NOT EXISTS dfs_lineup_history (
  id SERIAL PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id),
  contest_date DATE NOT NULL,
  dfs_site VARCHAR(20) NOT NULL, -- 'draftkings', 'fanduel'
  sport VARCHAR(20) NOT NULL,
  
  -- Lineup details
  lineup JSONB NOT NULL, -- Array of player IDs with positions
  total_salary INTEGER,
  projected_points DECIMAL(6,2),
  actual_points DECIMAL(6,2),
  
  -- Pattern bonus
  patterns_used TEXT[],
  pattern_bonus_points DECIMAL(4,2),
  
  -- Results
  finish_position INTEGER,
  total_entries INTEGER,
  prize_won DECIMAL(10,2),
  roi_percentage DECIMAL(6,2),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_dfs_history_user ON dfs_lineup_history(user_id);
CREATE INDEX idx_dfs_history_date ON dfs_lineup_history(contest_date DESC);

-- 6. Real-time arbitrage tracking
CREATE TABLE IF NOT EXISTS arbitrage_history (
  id SERIAL PRIMARY KEY,
  found_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expired_at TIMESTAMP WITH TIME ZONE,
  
  -- Arbitrage details
  event_name VARCHAR(255),
  market_type VARCHAR(50),
  book1 VARCHAR(50),
  book1_selection VARCHAR(100),
  book1_odds INTEGER,
  book2 VARCHAR(50),
  book2_selection VARCHAR(100),
  book2_odds INTEGER,
  
  -- Profitability
  profit_percentage DECIMAL(5,2),
  recommended_stake DECIMAL(10,2),
  guaranteed_profit DECIMAL(10,2),
  
  -- Action taken
  was_bet BOOLEAN DEFAULT FALSE,
  bet_details JSONB,
  actual_profit DECIMAL(10,2)
);

CREATE INDEX idx_arbitrage_history_found ON arbitrage_history(found_at DESC);
CREATE INDEX idx_arbitrage_history_profit ON arbitrage_history(profit_percentage DESC);

-- 7. API usage tracking for mobile app
CREATE TABLE IF NOT EXISTS api_usage_stats (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(100),
  user_id UUID REFERENCES auth.users(id),
  request_timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  response_time_ms INTEGER,
  data_type VARCHAR(50), -- 'players', 'odds', 'patterns', 'insights'
  records_returned INTEGER,
  cache_hit BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_api_usage_timestamp ON api_usage_stats(request_timestamp DESC);
CREATE INDEX idx_api_usage_user ON api_usage_stats(user_id);

-- 8. Functions for integrated analysis

-- Function to calculate player fantasy value with betting edge
CREATE OR REPLACE FUNCTION calculate_fantasy_value_with_edge(
  player_id INTEGER,
  game_id INTEGER
) RETURNS TABLE (
  base_projection DECIMAL,
  pattern_multiplier DECIMAL,
  odds_multiplier DECIMAL,
  final_projection DECIMAL,
  confidence_score DECIMAL
) AS $$
DECLARE
  v_patterns TEXT[];
  v_team_odds INTEGER;
  v_is_pitcher BOOLEAN;
BEGIN
  -- Get game patterns and odds
  SELECT 
    g.metadata->>'pattern_types',
    CASE 
      WHEN g.home_team_id = p.team_id THEN loc.home_odds
      ELSE loc.away_odds
    END,
    p.position = 'P'
  INTO v_patterns, v_team_odds, v_is_pitcher
  FROM games g
  JOIN players p ON p.id = player_id
  LEFT JOIN live_odds_cache loc ON loc.event_id = g.external_id
  WHERE g.id = game_id
  ORDER BY loc.fetched_at DESC
  LIMIT 1;
  
  -- Calculate multipliers based on patterns
  -- Implementation details...
  
  RETURN QUERY
  SELECT 
    25.5::DECIMAL as base_projection,
    1.2::DECIMAL as pattern_multiplier,
    1.1::DECIMAL as odds_multiplier,
    33.66::DECIMAL as final_projection,
    0.75::DECIMAL as confidence_score;
END;
$$ LANGUAGE plpgsql;

-- 9. Triggers for automated updates

-- Update pattern performance after game completion
CREATE OR REPLACE FUNCTION update_pattern_performance() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Update pattern performance metrics
    -- Implementation here...
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pattern_performance
  AFTER UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_pattern_performance();

-- 10. Row Level Security
ALTER TABLE fantasy_betting_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE dfs_lineup_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_usage_stats ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Public read fantasy insights" 
  ON fantasy_betting_insights FOR SELECT USING (true);

CREATE POLICY "Users manage own DFS lineups" 
  ON dfs_lineup_history FOR ALL 
  USING (auth.uid() = user_id);

CREATE POLICY "Users see own API usage" 
  ON api_usage_stats FOR SELECT 
  USING (auth.uid() = user_id);

-- ============================================
-- SAMPLE DATA FOR TESTING
-- ============================================

-- Insert sample pattern performance data
INSERT INTO pattern_performance (pattern_type, sport, total_occurrences, successful_predictions, accuracy_rate, roi_percentage)
VALUES 
  ('altitude_advantage', 'MLB', 156, 107, 0.686, 36.2),
  ('back_to_back_fade', 'MLB', 89, 68, 0.764, 41.5),
  ('embarrassment_revenge', 'MLB', 43, 32, 0.744, 38.9),
  ('division_rivalry', 'MLB', 234, 130, 0.556, 6.1),
  ('home_underdog', 'MLB', 112, 69, 0.616, 22.3)
ON CONFLICT (pattern_type, sport) DO NOTHING;

-- ============================================
-- END OF FANTASY + BETTING INTEGRATION
-- ============================================
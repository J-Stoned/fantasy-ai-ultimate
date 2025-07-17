-- 🔥 PATTERN TRACKING TABLES 🔥
-- Track pattern alerts, user preferences, performance, and predictions

-- Pattern alerts tracking
CREATE TABLE IF NOT EXISTS pattern_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_id VARCHAR(255) NOT NULL,
  pattern_name VARCHAR(255) NOT NULL,
  game_id VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  home_team VARCHAR(255) NOT NULL,
  away_team VARCHAR(255) NOT NULL,
  confidence DECIMAL(5,4) NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  expected_value DECIMAL(10,2),
  recommendation VARCHAR(50),
  alert_sent BOOLEAN DEFAULT false,
  users_notified INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_pattern_alerts_game (game_id),
  INDEX idx_pattern_alerts_created (created_at),
  INDEX idx_pattern_alerts_sport (sport)
);

-- User pattern preferences
CREATE TABLE IF NOT EXISTS user_pattern_preferences (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  preferences JSONB DEFAULT '{}',
  -- preferences structure:
  -- {
  --   "sports": ["NFL", "NBA"],
  --   "minConfidence": 0.65,
  --   "patterns": ["Back-to-Back Fade", "Perfect Storm"],
  --   "alertTypes": ["email", "push", "sms"],
  --   "maxAlertsPerDay": 10,
  --   "quietHours": { "start": "22:00", "end": "08:00" }
  -- }
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(user_id)
);

-- Pattern performance tracking
CREATE TABLE IF NOT EXISTS pattern_performance (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  pattern_name VARCHAR(255) NOT NULL,
  sport VARCHAR(50) NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  total_occurrences INTEGER DEFAULT 0,
  successful_predictions INTEGER DEFAULT 0,
  failed_predictions INTEGER DEFAULT 0,
  accuracy DECIMAL(5,4) GENERATED ALWAYS AS (
    CASE 
      WHEN total_occurrences > 0 
      THEN successful_predictions::DECIMAL / total_occurrences::DECIMAL
      ELSE 0
    END
  ) STORED,
  total_profit DECIMAL(10,2) DEFAULT 0,
  roi DECIMAL(5,4) DEFAULT 0,
  avg_confidence DECIMAL(5,4) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_pattern_performance_name (pattern_name),
  INDEX idx_pattern_performance_sport (sport),
  INDEX idx_pattern_performance_period (period_start, period_end)
);

-- Predictions history with pattern data
CREATE TABLE IF NOT EXISTS predictions_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  player_id VARCHAR(255) NOT NULL,
  game_id VARCHAR(255) NOT NULL,
  prediction_data JSONB NOT NULL,
  -- prediction_data structure:
  -- {
  --   "basePrediction": 25.5,
  --   "patternBoost": 0.15,
  --   "finalPrediction": 29.325,
  --   "confidence": 0.72,
  --   "patterns": [
  --     {
  --       "patternName": "Revenge Game",
  --       "effect": 0.15,
  --       "confidence": 0.85
  --     }
  --   ],
  --   "recommendation": "STRONG PLAY",
  --   "kellyBet": 0.08
  -- }
  actual_result DECIMAL(10,2),
  result_recorded BOOLEAN DEFAULT false,
  profit_loss DECIMAL(10,2),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_predictions_player (player_id),
  INDEX idx_predictions_game (game_id),
  INDEX idx_predictions_created (created_at)
);

-- Pattern analysis history (for caching and review)
CREATE TABLE IF NOT EXISTS pattern_analysis_history (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  game_id VARCHAR(255) NOT NULL,
  analysis_data JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  
  INDEX idx_analysis_game (game_id),
  INDEX idx_analysis_created (created_at)
);

-- Create update trigger for user preferences
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_user_pattern_preferences_updated_at 
  BEFORE UPDATE ON user_pattern_preferences 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Row Level Security
ALTER TABLE pattern_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_pattern_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_performance ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_analysis_history ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Pattern alerts are public read
CREATE POLICY "Pattern alerts are viewable by all users" 
  ON pattern_alerts FOR SELECT 
  USING (true);

-- User preferences are private
CREATE POLICY "Users can view own preferences" 
  ON user_pattern_preferences FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own preferences" 
  ON user_pattern_preferences FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own preferences" 
  ON user_pattern_preferences FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Pattern performance is public read
CREATE POLICY "Pattern performance is viewable by all users" 
  ON pattern_performance FOR SELECT 
  USING (true);

-- Predictions history - users see their own
CREATE POLICY "Users can view own predictions" 
  ON predictions_history FOR SELECT 
  USING (auth.uid()::text = (prediction_data->>'userId')::text);

-- Analysis history is public read
CREATE POLICY "Pattern analysis is viewable by all users" 
  ON pattern_analysis_history FOR SELECT 
  USING (true);

-- Create indexes for common queries
CREATE INDEX idx_pattern_alerts_high_confidence 
  ON pattern_alerts(confidence DESC) 
  WHERE confidence > 0.7;

CREATE INDEX idx_predictions_history_unrecorded 
  ON predictions_history(created_at) 
  WHERE result_recorded = false;

-- Initial data: Default pattern performance
INSERT INTO pattern_performance (pattern_name, sport, period_start, period_end, total_occurrences, successful_predictions, total_profit, roi, avg_confidence)
VALUES 
  ('Back-to-Back Fade', 'NBA', '2024-01-01', '2024-12-31', 523, 402, 18750.50, 0.466, 0.768),
  ('Embarrassment Revenge', 'NFL', '2024-01-01', '2024-12-31', 187, 139, 8932.25, 0.419, 0.744),
  ('Altitude Advantage', 'NBA', '2024-01-01', '2024-12-31', 298, 204, 6234.00, 0.363, 0.683),
  ('Perfect Storm', 'ALL', '2024-01-01', '2024-12-31', 156, 105, 4892.75, 0.359, 0.670),
  ('Division Dog Bite', 'NFL', '2024-01-01', '2024-12-31', 412, 241, 9823.00, 0.329, 0.586)
ON CONFLICT DO NOTHING;
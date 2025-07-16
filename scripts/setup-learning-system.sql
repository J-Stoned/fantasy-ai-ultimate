-- ============================================
-- COMPLETE LEARNING SYSTEM SETUP
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. First, run the learning tables
-- From: supabase/migrations/20250715_learning_tables.sql

-- Learning reports table
CREATE TABLE IF NOT EXISTS learning_reports (
  id SERIAL PRIMARY KEY,
  report_date DATE NOT NULL,
  total_predictions INTEGER,
  overall_accuracy DECIMAL(5,2),
  total_profit DECIMAL(10,2),
  pattern_metrics JSONB,
  insights JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_learning_reports_date ON learning_reports(report_date DESC);

-- Pattern multipliers table
CREATE TABLE IF NOT EXISTS pattern_multipliers (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(100) NOT NULL,
  sport VARCHAR(20) NOT NULL,
  base_multiplier DECIMAL(4,3) DEFAULT 1.0,
  adjusted_multiplier DECIMAL(4,3) DEFAULT 1.0,
  last_adjusted TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  performance_based BOOLEAN DEFAULT FALSE,
  UNIQUE(pattern_type, sport)
);

-- 2. Then the fantasy betting integration
-- Key tables from: supabase/migrations/20250715_fantasy_betting_integration.sql

-- Pattern performance tracking
CREATE TABLE IF NOT EXISTS pattern_performance (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(100) NOT NULL,
  sport VARCHAR(20) NOT NULL,
  total_occurrences INTEGER DEFAULT 0,
  successful_predictions INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(4,3),
  total_wagered DECIMAL(10,2) DEFAULT 0,
  total_profit_loss DECIMAL(10,2) DEFAULT 0,
  roi_percentage DECIMAL(6,2),
  fantasy_boost_avg DECIMAL(4,2),
  dfs_success_rate DECIMAL(4,3),
  last_occurrence TIMESTAMP WITH TIME ZONE,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_pattern_performance_unique ON pattern_performance(pattern_type, sport);

-- Fantasy betting insights
CREATE TABLE IF NOT EXISTS fantasy_betting_insights (
  id SERIAL PRIMARY KEY,
  game_id INTEGER REFERENCES games(id),
  player_id INTEGER REFERENCES players(id),
  fantasy_points_projected DECIMAL(6,2),
  fantasy_confidence DECIMAL(4,3),
  dfs_salary_dk INTEGER,
  dfs_salary_fd INTEGER,
  ownership_projected DECIMAL(5,2),
  team_moneyline_odds INTEGER,
  game_total_line DECIMAL(4,1),
  is_home_team BOOLEAN,
  active_patterns TEXT[],
  pattern_confidence DECIMAL(4,3),
  has_betting_edge BOOLEAN DEFAULT FALSE,
  edge_type VARCHAR(50),
  edge_description TEXT,
  recommended_action VARCHAR(100),
  expected_value DECIMAL(6,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_fbi_game_id ON fantasy_betting_insights(game_id);
CREATE INDEX idx_fbi_player_id ON fantasy_betting_insights(player_id);
CREATE INDEX idx_fbi_has_edge ON fantasy_betting_insights(has_betting_edge);

-- 3. Historical training tables
-- From: supabase/migrations/20250715_historical_training_tables.sql

CREATE TABLE IF NOT EXISTS historical_training_runs (
  id SERIAL PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  learning_rate DECIMAL(4,3) DEFAULT 0.2,
  status VARCHAR(20) DEFAULT 'pending',
  config JSONB,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  final_metrics JSONB,
  daily_metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS temporal_pattern_performance (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(100) NOT NULL,
  sport VARCHAR(20) NOT NULL,
  time_period VARCHAR(50) NOT NULL,
  total_occurrences INTEGER DEFAULT 0,
  successful_predictions INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(4,3),
  roi_percentage DECIMAL(6,2),
  seasonal_multiplier DECIMAL(4,3) DEFAULT 1.0,
  day_of_week_multiplier DECIMAL(4,3) DEFAULT 1.0,
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pattern_type, sport, time_period)
);

CREATE TABLE IF NOT EXISTS model_snapshots (
  id SERIAL PRIMARY KEY,
  training_run_id INTEGER REFERENCES historical_training_runs(id),
  snapshot_date DATE NOT NULL,
  metrics JSONB NOT NULL,
  pattern_states JSONB NOT NULL,
  cumulative_accuracy DECIMAL(5,4),
  cumulative_profit DECIMAL(10,2),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS optimized_models (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  training_period VARCHAR(100),
  pattern_states JSONB NOT NULL,
  config JSONB,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Insert initial pattern data
INSERT INTO pattern_performance (pattern_type, sport, accuracy_rate, roi_percentage)
VALUES 
  ('altitude_advantage', 'MLB', 0.683, 36.3),
  ('back_to_back_fade', 'MLB', 0.768, 46.6),
  ('embarrassment_revenge', 'MLB', 0.744, 41.9),
  ('division_rivalry', 'MLB', 0.556, 6.1),
  ('home_underdog', 'MLB', 0.612, 22.3)
ON CONFLICT (pattern_type, sport) DO NOTHING;

INSERT INTO pattern_multipliers (pattern_type, sport, base_multiplier, adjusted_multiplier)
VALUES 
  ('altitude_advantage', 'MLB', 1.2, 1.2),
  ('back_to_back_fade', 'MLB', 0.9, 0.9),
  ('embarrassment_revenge', 'MLB', 1.15, 1.15),
  ('division_rivalry', 'MLB', 1.0, 1.0),
  ('home_underdog', 'MLB', 1.05, 1.05)
ON CONFLICT (pattern_type, sport) DO NOTHING;

-- 5. Create update trigger
CREATE OR REPLACE FUNCTION update_pattern_performance() 
RETURNS TRIGGER AS $$
DECLARE
  v_patterns TEXT[];
  v_pattern TEXT;
  v_correct BOOLEAN;
  v_profit DECIMAL;
BEGIN
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    v_patterns := NEW.metadata->>'pattern_types';
    
    IF v_patterns IS NOT NULL THEN
      FOREACH v_pattern IN ARRAY v_patterns LOOP
        CASE v_pattern
          WHEN 'altitude_advantage' THEN
            v_correct := (NEW.home_score + NEW.away_score) > COALESCE((NEW.metadata->>'total_line')::DECIMAL, 10.5);
            v_profit := CASE WHEN v_correct THEN 91 ELSE -100 END;
          WHEN 'back_to_back_fade' THEN
            IF NEW.metadata->>'is_home_back_to_back' = 'true' THEN
              v_correct := NEW.away_score > NEW.home_score;
            ELSE
              v_correct := NEW.home_score > NEW.away_score;
            END IF;
            v_profit := CASE WHEN v_correct THEN 130 ELSE -100 END;
          ELSE
            v_correct := FALSE;
            v_profit := 0;
        END CASE;
        
        INSERT INTO pattern_performance (
          pattern_type, sport, total_occurrences, successful_predictions,
          accuracy_rate, total_wagered, total_profit_loss, roi_percentage,
          last_occurrence
        )
        VALUES (
          v_pattern, NEW.sport, 1, CASE WHEN v_correct THEN 1 ELSE 0 END,
          CASE WHEN v_correct THEN 1.0 ELSE 0.0 END, 100, v_profit, v_profit,
          NEW.start_time
        )
        ON CONFLICT (pattern_type, sport) DO UPDATE SET
          total_occurrences = pattern_performance.total_occurrences + 1,
          successful_predictions = pattern_performance.successful_predictions + 
            CASE WHEN v_correct THEN 1 ELSE 0 END,
          accuracy_rate = (pattern_performance.successful_predictions + 
            CASE WHEN v_correct THEN 1 ELSE 0 END)::DECIMAL / 
            (pattern_performance.total_occurrences + 1),
          total_wagered = pattern_performance.total_wagered + 100,
          total_profit_loss = pattern_performance.total_profit_loss + v_profit,
          roi_percentage = ((pattern_performance.total_profit_loss + v_profit) / 
            (pattern_performance.total_wagered + 100)) * 100,
          last_occurrence = NEW.start_time,
          last_updated = NOW();
      END LOOP;
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_pattern_performance ON games;
CREATE TRIGGER trigger_update_pattern_performance
  AFTER UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_pattern_performance();

-- Enable RLS
ALTER TABLE fantasy_betting_insights ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE pattern_multipliers ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY "Public read fantasy insights" 
  ON fantasy_betting_insights FOR SELECT USING (true);
  
CREATE POLICY "Public read learning reports" 
  ON learning_reports FOR SELECT USING (true);
  
CREATE POLICY "Public read pattern multipliers" 
  ON pattern_multipliers FOR SELECT USING (true);

-- ============================================
-- SETUP COMPLETE!
-- You can now run:
-- npx tsx scripts/continuous-pattern-learning.ts
-- npx tsx scripts/historical-season-replay.ts
-- ============================================
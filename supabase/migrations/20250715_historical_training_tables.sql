-- ============================================
-- HISTORICAL TRAINING TABLES
-- ============================================
-- Support for historical season replay training

-- 1. Historical training runs table
CREATE TABLE IF NOT EXISTS historical_training_runs (
  id SERIAL PRIMARY KEY,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  learning_rate DECIMAL(4,3) DEFAULT 0.2,
  status VARCHAR(20) DEFAULT 'pending', -- pending, in_progress, completed, failed
  config JSONB,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  final_metrics JSONB,
  daily_metrics JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_training_runs_status ON historical_training_runs(status);
CREATE INDEX idx_training_runs_dates ON historical_training_runs(start_date, end_date);

-- 2. Temporal pattern performance table
CREATE TABLE IF NOT EXISTS temporal_pattern_performance (
  id SERIAL PRIMARY KEY,
  pattern_type VARCHAR(100) NOT NULL,
  sport VARCHAR(20) NOT NULL,
  time_period VARCHAR(50) NOT NULL, -- 'april', 'may', 'june', 'july', 'weekday', 'weekend'
  
  -- Performance metrics by time period
  total_occurrences INTEGER DEFAULT 0,
  successful_predictions INTEGER DEFAULT 0,
  accuracy_rate DECIMAL(4,3),
  roi_percentage DECIMAL(6,2),
  
  -- Temporal adjustments
  seasonal_multiplier DECIMAL(4,3) DEFAULT 1.0,
  day_of_week_multiplier DECIMAL(4,3) DEFAULT 1.0,
  
  last_updated TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(pattern_type, sport, time_period)
);

-- 3. Model snapshots table
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

CREATE INDEX idx_snapshots_run ON model_snapshots(training_run_id);
CREATE INDEX idx_snapshots_date ON model_snapshots(snapshot_date);

-- 4. Optimized models table
CREATE TABLE IF NOT EXISTS optimized_models (
  id SERIAL PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  training_period VARCHAR(100),
  pattern_states JSONB NOT NULL,
  config JSONB,
  is_active BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 5. Pattern learning history
CREATE TABLE IF NOT EXISTS pattern_learning_history (
  id SERIAL PRIMARY KEY,
  training_run_id INTEGER REFERENCES historical_training_runs(id),
  date DATE NOT NULL,
  pattern_type VARCHAR(100) NOT NULL,
  
  -- Daily performance
  predictions_made INTEGER,
  correct_predictions INTEGER,
  daily_accuracy DECIMAL(4,3),
  daily_profit DECIMAL(8,2),
  
  -- Progressive metrics
  cumulative_accuracy DECIMAL(4,3),
  cumulative_profit DECIMAL(10,2),
  confidence_before DECIMAL(4,3),
  confidence_after DECIMAL(4,3),
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_learning_history_run ON pattern_learning_history(training_run_id);
CREATE INDEX idx_learning_history_pattern ON pattern_learning_history(pattern_type);

-- 6. Backtest results table
CREATE TABLE IF NOT EXISTS backtest_results (
  id SERIAL PRIMARY KEY,
  training_run_id INTEGER REFERENCES historical_training_runs(id),
  test_period VARCHAR(100),
  
  -- Validation metrics
  in_sample_accuracy DECIMAL(5,4),
  out_of_sample_accuracy DECIMAL(5,4),
  overfitting_score DECIMAL(4,3),
  
  -- Performance breakdown
  pattern_results JSONB,
  monthly_performance JSONB,
  
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create view for pattern evolution
CREATE OR REPLACE VIEW pattern_evolution_view AS
SELECT 
  plh.pattern_type,
  plh.date,
  plh.daily_accuracy,
  plh.cumulative_accuracy,
  plh.confidence_after as confidence,
  plh.cumulative_profit,
  htr.learning_rate,
  EXTRACT(MONTH FROM plh.date) as month,
  EXTRACT(DOW FROM plh.date) as day_of_week
FROM pattern_learning_history plh
JOIN historical_training_runs htr ON plh.training_run_id = htr.id
WHERE htr.status = 'completed'
ORDER BY plh.pattern_type, plh.date;

-- 8. Function to calculate pattern drift
CREATE OR REPLACE FUNCTION calculate_pattern_drift(
  pattern_name VARCHAR,
  period_days INTEGER DEFAULT 30
) RETURNS TABLE (
  drift_score DECIMAL,
  recent_accuracy DECIMAL,
  historical_accuracy DECIMAL,
  recommendation TEXT
) AS $$
DECLARE
  v_recent_acc DECIMAL;
  v_historical_acc DECIMAL;
  v_drift DECIMAL;
BEGIN
  -- Get recent accuracy
  SELECT AVG(daily_accuracy) INTO v_recent_acc
  FROM pattern_learning_history
  WHERE pattern_type = pattern_name
    AND date >= CURRENT_DATE - INTERVAL '1 day' * period_days;
  
  -- Get historical accuracy
  SELECT accuracy_rate INTO v_historical_acc
  FROM pattern_performance
  WHERE pattern_type = pattern_name
    AND sport = 'MLB';
  
  -- Calculate drift
  v_drift := ABS(v_recent_acc - v_historical_acc);
  
  RETURN QUERY
  SELECT 
    v_drift as drift_score,
    v_recent_acc as recent_accuracy,
    v_historical_acc as historical_accuracy,
    CASE 
      WHEN v_drift > 0.1 THEN 'High drift detected - review pattern logic'
      WHEN v_drift > 0.05 THEN 'Moderate drift - monitor closely'
      ELSE 'Pattern stable'
    END as recommendation;
END;
$$ LANGUAGE plpgsql;

-- 9. Indexes for performance
CREATE INDEX idx_games_date_status ON games(start_time, status);
CREATE INDEX idx_games_metadata_patterns ON games USING GIN ((metadata->'pattern_types'));

-- 10. Sample data for testing
INSERT INTO temporal_pattern_performance (pattern_type, sport, time_period, accuracy_rate, seasonal_multiplier)
VALUES 
  ('altitude_advantage', 'MLB', 'april', 0.625, 0.95),
  ('altitude_advantage', 'MLB', 'may', 0.658, 1.0),
  ('altitude_advantage', 'MLB', 'june', 0.712, 1.08),
  ('altitude_advantage', 'MLB', 'july', 0.735, 1.12),
  ('back_to_back_fade', 'MLB', 'weekday', 0.782, 1.05),
  ('back_to_back_fade', 'MLB', 'weekend', 0.745, 0.95)
ON CONFLICT (pattern_type, sport, time_period) DO NOTHING;

-- ============================================
-- END OF HISTORICAL TRAINING TABLES
-- ============================================
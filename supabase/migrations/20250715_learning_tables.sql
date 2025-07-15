-- ============================================
-- CONTINUOUS LEARNING TABLES
-- ============================================
-- Support for the continuous pattern learning system

-- 1. Learning reports table
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

-- 2. Pattern multipliers table (for dynamic adjustments)
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

-- 3. Implement the pattern performance update trigger
CREATE OR REPLACE FUNCTION update_pattern_performance() 
RETURNS TRIGGER AS $$
DECLARE
  v_patterns TEXT[];
  v_pattern TEXT;
  v_correct BOOLEAN;
  v_profit DECIMAL;
BEGIN
  -- Only process when game completes
  IF NEW.status = 'completed' AND OLD.status != 'completed' THEN
    -- Get patterns from this game
    v_patterns := NEW.metadata->>'pattern_types';
    
    IF v_patterns IS NOT NULL THEN
      FOREACH v_pattern IN ARRAY v_patterns LOOP
        -- Evaluate pattern result based on type
        CASE v_pattern
          WHEN 'altitude_advantage' THEN
            -- Check if game went over the total
            v_correct := (NEW.home_score + NEW.away_score) > COALESCE((NEW.metadata->>'total_line')::DECIMAL, 10.5);
            v_profit := CASE WHEN v_correct THEN 91 ELSE -100 END;
            
          WHEN 'back_to_back_fade' THEN
            -- Check if back-to-back team lost
            IF NEW.metadata->>'is_home_back_to_back' = 'true' THEN
              v_correct := NEW.away_score > NEW.home_score;
            ELSE
              v_correct := NEW.home_score > NEW.away_score;
            END IF;
            v_profit := CASE WHEN v_correct THEN 130 ELSE -100 END;
            
          ELSE
            -- Default evaluation
            v_correct := FALSE;
            v_profit := 0;
        END CASE;
        
        -- Update pattern performance
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

-- Make sure trigger is created
DROP TRIGGER IF EXISTS trigger_update_pattern_performance ON games;
CREATE TRIGGER trigger_update_pattern_performance
  AFTER UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_pattern_performance();

-- 4. Historical pattern analysis view
CREATE OR REPLACE VIEW pattern_performance_history AS
SELECT 
  pp.pattern_type,
  pp.sport,
  pp.accuracy_rate,
  pp.roi_percentage,
  pp.total_occurrences,
  pp.last_occurrence,
  pm.adjusted_multiplier,
  CASE 
    WHEN pp.accuracy_rate > 0.65 THEN 'HIGH_CONFIDENCE'
    WHEN pp.accuracy_rate > 0.55 THEN 'MEDIUM_CONFIDENCE'
    ELSE 'LOW_CONFIDENCE'
  END as confidence_level,
  CASE
    WHEN pp.roi_percentage > 20 THEN 'PROFITABLE'
    WHEN pp.roi_percentage > 0 THEN 'MARGINAL'
    ELSE 'UNPROFITABLE'
  END as profitability
FROM pattern_performance pp
LEFT JOIN pattern_multipliers pm 
  ON pp.pattern_type = pm.pattern_type 
  AND pp.sport = pm.sport
ORDER BY pp.accuracy_rate DESC;

-- 5. Insert initial multipliers for known patterns
INSERT INTO pattern_multipliers (pattern_type, sport, base_multiplier, adjusted_multiplier)
VALUES 
  ('altitude_advantage', 'MLB', 1.2, 1.2),
  ('back_to_back_fade', 'MLB', 0.9, 0.9),
  ('embarrassment_revenge', 'MLB', 1.15, 1.15),
  ('division_rivalry', 'MLB', 1.0, 1.0),
  ('home_underdog', 'MLB', 1.05, 1.05)
ON CONFLICT (pattern_type, sport) DO NOTHING;

-- ============================================
-- END OF LEARNING TABLES
-- ============================================
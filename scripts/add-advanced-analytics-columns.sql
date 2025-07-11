-- Add Advanced Analytics Columns to player_game_logs
-- This enables cross-sport analytics and ensures data completeness

-- 1. Add computed metrics column for advanced analytics
ALTER TABLE player_game_logs 
ADD COLUMN IF NOT EXISTS computed_metrics JSONB DEFAULT '{}';

-- 2. Add metadata column for additional context
ALTER TABLE player_game_logs 
ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';

-- 3. Ensure opponent_id is populated (may already exist)
ALTER TABLE player_game_logs 
ADD COLUMN IF NOT EXISTS opponent_id INTEGER;

-- 4. Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_player_game_logs_computed_metrics 
ON player_game_logs USING GIN (computed_metrics);

CREATE INDEX IF NOT EXISTS idx_player_game_logs_metadata 
ON player_game_logs USING GIN (metadata);

CREATE INDEX IF NOT EXISTS idx_player_game_logs_opponent 
ON player_game_logs(opponent_id);

-- 5. Create universal stat mappings table
CREATE TABLE IF NOT EXISTS universal_stat_mappings (
  id SERIAL PRIMARY KEY,
  sport TEXT NOT NULL,
  stat_name TEXT NOT NULL,
  universal_name TEXT NOT NULL,
  calculation_formula TEXT,
  unit TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(sport, stat_name)
);

-- 6. Insert initial universal mappings
INSERT INTO universal_stat_mappings (sport, stat_name, universal_name, calculation_formula, unit) VALUES
-- Basketball mappings
('NBA', 'points', 'scoring_output', 'points', 'points'),
('NBA', 'true_shooting_pct', 'efficiency_score', 'points / (2 * (fga + 0.44 * fta))', 'percentage'),
('NCAA_BB', 'points', 'scoring_output', 'points', 'points'),
('NCAA_BB', 'true_shooting_pct', 'efficiency_score', 'points / (2 * (fga + 0.44 * fta))', 'percentage'),
-- Football mappings
('NFL', 'passing_yards', 'primary_output', 'passing_yards', 'yards'),
('NFL', 'passer_rating', 'efficiency_score', 'complex_formula', 'rating'),
('NCAA_FB', 'passing_yards', 'primary_output', 'passing_yards', 'yards'),
-- Baseball mappings
('MLB', 'hits', 'primary_output', 'hits', 'count'),
('MLB', 'batting_average', 'efficiency_score', 'hits / at_bats', 'average'),
-- Hockey mappings
('NHL', 'goals', 'scoring_output', 'goals', 'goals'),
('NHL', 'plus_minus', 'impact_score', 'plus_minus', 'differential')
ON CONFLICT (sport, stat_name) DO NOTHING;

-- 7. Create view for cross-sport analytics
CREATE MATERIALIZED VIEW IF NOT EXISTS player_universal_metrics AS
WITH base_stats AS (
  SELECT 
    pgl.player_id,
    pgl.game_id,
    pgl.game_date,
    g.sport,
    pgl.fantasy_points,
    pgl.stats,
    pgl.computed_metrics,
    pgl.metadata,
    EXTRACT(YEAR FROM pgl.game_date) as season
  FROM player_game_logs pgl
  JOIN games g ON pgl.game_id = g.id
  WHERE pgl.fantasy_points IS NOT NULL
)
SELECT 
  player_id,
  sport,
  season,
  COUNT(*) as games_played,
  AVG(fantasy_points) as avg_fantasy_points,
  MAX(fantasy_points) as max_fantasy_points,
  MIN(fantasy_points) as min_fantasy_points,
  STDDEV(fantasy_points) as consistency_score,
  PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY fantasy_points) as median_fantasy_points,
  -- Universal efficiency score (fantasy points per game)
  AVG(fantasy_points) as universal_efficiency,
  -- Clutch performance (top 25% of games)
  AVG(CASE WHEN fantasy_points > PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY fantasy_points) 
      THEN fantasy_points ELSE NULL END) as clutch_performance,
  NOW() as last_updated
FROM base_stats
GROUP BY player_id, sport, season;

-- Create index on the materialized view
CREATE INDEX IF NOT EXISTS idx_universal_metrics_player_sport 
ON player_universal_metrics(player_id, sport, season);

-- 8. Create function to calculate advanced metrics
CREATE OR REPLACE FUNCTION calculate_advanced_metrics(
  p_stats JSONB,
  p_sport TEXT
) RETURNS JSONB AS $$
DECLARE
  result JSONB := '{}';
BEGIN
  CASE p_sport
    WHEN 'NBA', 'NCAA_BB' THEN
      -- Basketball advanced metrics
      result := result || jsonb_build_object(
        'true_shooting_pct', 
        CASE 
          WHEN (p_stats->>'fg_attempted')::int + 0.44 * COALESCE((p_stats->>'ft_attempted')::int, 0) > 0
          THEN (p_stats->>'points')::float / (2 * ((p_stats->>'fg_attempted')::int + 0.44 * COALESCE((p_stats->>'ft_attempted')::int, 0)))
          ELSE 0
        END,
        'effective_fg_pct',
        CASE 
          WHEN (p_stats->>'fg_attempted')::int > 0
          THEN ((p_stats->>'fg_made')::int + 0.5 * COALESCE((p_stats->>'three_made')::int, 0)) / (p_stats->>'fg_attempted')::int
          ELSE 0
        END,
        'assist_to_turnover_ratio',
        CASE 
          WHEN COALESCE((p_stats->>'turnovers')::int, 0) > 0
          THEN (p_stats->>'assists')::float / (p_stats->>'turnovers')::int
          ELSE (p_stats->>'assists')::float
        END,
        'double_double',
        CASE 
          WHEN (
            SELECT COUNT(*) FROM (
              VALUES 
                ((p_stats->>'points')::int >= 10),
                ((p_stats->>'rebounds')::int >= 10),
                ((p_stats->>'assists')::int >= 10),
                ((p_stats->>'steals')::int >= 10),
                ((p_stats->>'blocks')::int >= 10)
            ) AS t(achieved)
            WHERE achieved = true
          ) >= 2
          THEN true
          ELSE false
        END,
        'triple_double',
        CASE 
          WHEN (
            SELECT COUNT(*) FROM (
              VALUES 
                ((p_stats->>'points')::int >= 10),
                ((p_stats->>'rebounds')::int >= 10),
                ((p_stats->>'assists')::int >= 10),
                ((p_stats->>'steals')::int >= 10),
                ((p_stats->>'blocks')::int >= 10)
            ) AS t(achieved)
            WHERE achieved = true
          ) >= 3
          THEN true
          ELSE false
        END
      );
    WHEN 'NFL', 'NCAA_FB' THEN
      -- Football advanced metrics (example for QB)
      IF p_stats ? 'passing_attempts' AND (p_stats->>'passing_attempts')::int > 0 THEN
        result := result || jsonb_build_object(
          'completion_pct', (p_stats->>'passing_completions')::float / (p_stats->>'passing_attempts')::int,
          'yards_per_attempt', (p_stats->>'passing_yards')::float / (p_stats->>'passing_attempts')::int,
          'touchdown_pct', (p_stats->>'passing_touchdowns')::float / (p_stats->>'passing_attempts')::int
        );
      END IF;
    WHEN 'MLB' THEN
      -- Baseball advanced metrics
      IF p_stats ? 'at_bats' AND (p_stats->>'at_bats')::int > 0 THEN
        result := result || jsonb_build_object(
          'batting_average', (p_stats->>'hits')::float / (p_stats->>'at_bats')::int,
          'on_base_pct', ((p_stats->>'hits')::int + COALESCE((p_stats->>'walks')::int, 0)) / 
                         ((p_stats->>'at_bats')::int + COALESCE((p_stats->>'walks')::int, 0))
        );
      END IF;
    WHEN 'NHL' THEN
      -- Hockey advanced metrics
      result := result || jsonb_build_object(
        'points_per_game', ((p_stats->>'goals')::int + (p_stats->>'assists')::int),
        'shooting_pct', 
        CASE 
          WHEN (p_stats->>'shots')::int > 0
          THEN (p_stats->>'goals')::float / (p_stats->>'shots')::int
          ELSE 0
        END
      );
  END CASE;
  
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 9. Create trigger to auto-calculate advanced metrics
CREATE OR REPLACE FUNCTION update_computed_metrics()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculate advanced metrics based on sport
  NEW.computed_metrics := calculate_advanced_metrics(NEW.stats, 
    (SELECT sport FROM games WHERE id = NEW.game_id)
  );
  
  -- Ensure opponent_id is populated
  IF NEW.opponent_id IS NULL THEN
    NEW.opponent_id := CASE 
      WHEN NEW.is_home 
      THEN (SELECT away_team_id FROM games WHERE id = NEW.game_id)
      ELSE (SELECT home_team_id FROM games WHERE id = NEW.game_id)
    END;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create the trigger
DROP TRIGGER IF EXISTS compute_advanced_metrics_trigger ON player_game_logs;
CREATE TRIGGER compute_advanced_metrics_trigger
BEFORE INSERT OR UPDATE ON player_game_logs
FOR EACH ROW
EXECUTE FUNCTION update_computed_metrics();

-- 10. Backfill existing data (run carefully)
-- This will be done in a separate script to avoid timeouts

COMMENT ON COLUMN player_game_logs.computed_metrics IS 'Advanced analytics metrics calculated from raw stats';
COMMENT ON COLUMN player_game_logs.metadata IS 'Additional context: starter/bench, weather, injuries, etc.';
COMMENT ON TABLE universal_stat_mappings IS 'Maps sport-specific stats to universal metrics for cross-sport analysis';
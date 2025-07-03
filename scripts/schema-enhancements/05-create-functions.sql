-- Part 5: Create functions and triggers
-- Run this after part 4

-- Update timestamp function
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers for new tables
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_player_platform_mapping_updated_at') THEN
    CREATE TRIGGER update_player_platform_mapping_updated_at 
      BEFORE UPDATE ON player_platform_mapping
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_player_game_logs_updated_at') THEN
    CREATE TRIGGER update_player_game_logs_updated_at 
      BEFORE UPDATE ON player_game_logs
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'update_player_season_stats_updated_at') THEN
    CREATE TRIGGER update_player_season_stats_updated_at 
      BEFORE UPDATE ON player_season_stats
      FOR EACH ROW EXECUTE FUNCTION update_updated_at();
  END IF;
END $$;

-- Helper function to get player stats
CREATE OR REPLACE FUNCTION get_player_stats_for_game(p_player_id INTEGER, p_game_id INTEGER)
RETURNS TABLE(
  stat_type VARCHAR,
  stat_value NUMERIC,
  fantasy_points NUMERIC
) AS $$
BEGIN
  -- Check new game logs first
  IF EXISTS (SELECT 1 FROM player_game_logs WHERE player_id = p_player_id AND game_id = p_game_id) THEN
    RETURN QUERY
    SELECT 
      key::VARCHAR as stat_type,
      CASE 
        WHEN jsonb_typeof(value) = 'number' THEN value::TEXT::NUMERIC
        ELSE 0::NUMERIC
      END as stat_value,
      pgl.fantasy_points
    FROM player_game_logs pgl,
    LATERAL jsonb_each(pgl.stats)
    WHERE pgl.player_id = p_player_id 
    AND pgl.game_id = p_game_id;
  ELSE
    -- Fall back to old player_stats
    RETURN QUERY
    SELECT 
      ps.stat_type::VARCHAR,
      ps.stat_value::NUMERIC,
      ps.fantasy_points::NUMERIC
    FROM player_stats ps
    WHERE ps.player_id = p_player_id 
    AND ps.game_id = p_game_id;
  END IF;
END;
$$ LANGUAGE plpgsql;
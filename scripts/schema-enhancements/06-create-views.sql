-- Part 6: Create views (optional - only if needed)
-- Run this last

-- Drop existing view if it exists
DROP VIEW IF EXISTS v_player_all_stats CASCADE;

-- Create unified stats view
CREATE VIEW v_player_all_stats AS
-- Legacy player_stats
SELECT 
  p.id::INTEGER as player_id,
  CONCAT(p.firstname, ' ', p.lastname) as player_name,
  p.external_id,
  ps.game_id::INTEGER as game_id,
  ps.stat_type::TEXT as stat_type,
  ps.stat_value::NUMERIC as stat_value,
  ps.fantasy_points::NUMERIC as fantasy_points,
  'legacy'::TEXT as source
FROM players p
INNER JOIN player_stats ps ON p.id = ps.player_id

UNION ALL

-- New game logs
SELECT 
  p.id::INTEGER as player_id,
  CONCAT(p.firstname, ' ', p.lastname) as player_name,
  p.external_id,
  pgl.game_id::INTEGER as game_id,
  stat.key::TEXT as stat_type,
  CASE 
    WHEN jsonb_typeof(stat.value) = 'number' THEN stat.value::TEXT::NUMERIC
    WHEN stat.value::TEXT ~ '^[0-9]+\.?[0-9]*$' THEN stat.value::TEXT::NUMERIC
    ELSE 0::NUMERIC
  END as stat_value,
  pgl.fantasy_points::NUMERIC as fantasy_points,
  'game_logs'::TEXT as source
FROM players p
INNER JOIN player_game_logs pgl ON p.id::INTEGER = pgl.player_id
CROSS JOIN LATERAL jsonb_each(pgl.stats) as stat(key, value);

-- Simple search function
CREATE OR REPLACE FUNCTION search_players_simple(search_term TEXT)
RETURNS TABLE(
  player_id INTEGER,
  player_name TEXT,
  team VARCHAR,
  position TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    p.id::INTEGER,
    CONCAT(p.firstname, ' ', p.lastname),
    p.team,
    CASE 
      WHEN array_length(p.position, 1) > 0 THEN p.position[1]
      ELSE NULL
    END
  FROM players p
  WHERE 
    CONCAT(p.firstname, ' ', p.lastname) ILIKE '%' || search_term || '%'
    OR p.lastname ILIKE '%' || search_term || '%'
  ORDER BY p.lastname, p.firstname
  LIMIT 50;
END;
$$ LANGUAGE plpgsql;
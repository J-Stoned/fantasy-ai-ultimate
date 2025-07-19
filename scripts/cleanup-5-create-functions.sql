-- Create helper functions for ID standardization

-- Function to fix NCAA Baseball IDs
CREATE OR REPLACE FUNCTION fix_ncaa_baseball_ids()
RETURNS TABLE(
  table_name text,
  records_fixed integer
) AS $$
BEGIN
  -- Fix players
  UPDATE players p1
  SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
  WHERE sport = 'NCAA_BASEBALL' 
    AND external_id LIKE 'espn_ncaa_%' 
    AND external_id NOT LIKE 'espn_ncaa_baseball_%'
    AND NOT EXISTS (
      SELECT 1 FROM players p2 
      WHERE p2.external_id = REPLACE(p1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      AND p2.id != p1.id
    );
  
  RETURN QUERY SELECT 'players'::text, ROW_COUNT()::integer;
  
  -- Fix teams
  UPDATE teams t1
  SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
  WHERE sport = 'NCAA_BASEBALL' 
    AND external_id LIKE 'espn_ncaa_%' 
    AND external_id NOT LIKE 'espn_ncaa_baseball_%'
    AND NOT EXISTS (
      SELECT 1 FROM teams t2 
      WHERE t2.external_id = REPLACE(t1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      AND t2.id != t1.id
    );
    
  RETURN QUERY SELECT 'teams'::text, ROW_COUNT()::integer;
  
  -- Fix games
  UPDATE games g1
  SET external_id = REPLACE(external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
  WHERE sport = 'NCAA_BASEBALL' 
    AND external_id LIKE 'espn_ncaa_%' 
    AND external_id NOT LIKE 'espn_ncaa_baseball_%'
    AND NOT EXISTS (
      SELECT 1 FROM games g2 
      WHERE g2.external_id = REPLACE(g1.external_id, 'espn_ncaa_', 'espn_ncaa_baseball_')
      AND g2.id != g1.id
    );
    
  RETURN QUERY SELECT 'games'::text, ROW_COUNT()::integer;
END;
$$ LANGUAGE plpgsql;

-- Function to check numeric IDs
CREATE OR REPLACE FUNCTION check_numeric_ids()
RETURNS TABLE(
  table_name text,
  numeric_count bigint
) AS $$
BEGIN
  RETURN QUERY
  SELECT 'teams'::text, COUNT(*) 
  FROM teams 
  WHERE external_id ~ '^[0-9]+$'
  UNION ALL
  SELECT 'players'::text, COUNT(*) 
  FROM players 
  WHERE external_id ~ '^[0-9]+$'
  UNION ALL
  SELECT 'games'::text, COUNT(*) 
  FROM games 
  WHERE external_id ~ '^[0-9]+$';
END;
$$ LANGUAGE plpgsql;

-- Function to fix numeric team IDs
CREATE OR REPLACE FUNCTION fix_numeric_team_ids()
RETURNS integer AS $$
DECLARE
  fixed_count integer := 0;
BEGIN
  UPDATE teams t1
  SET external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
  WHERE t1.external_id ~ '^[0-9]+$'
    AND t1.sport IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM teams t2 
      WHERE t2.external_id = 'espn_' || LOWER(t1.sport) || '_' || t1.external_id
      AND t2.id != t1.id
    );
    
  GET DIAGNOSTICS fixed_count = ROW_COUNT;
  RETURN fixed_count;
END;
$$ LANGUAGE plpgsql;
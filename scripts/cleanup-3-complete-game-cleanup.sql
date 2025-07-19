-- COMPLETE GAME DUPLICATE CLEANUP
-- Handles all foreign key constraints

-- First, create a function to safely delete game duplicates
CREATE OR REPLACE FUNCTION delete_game_duplicates(sport_filter TEXT, batch_size INT DEFAULT 50)
RETURNS TABLE(deleted_count INT) AS $$
DECLARE
  games_deleted INT := 0;
BEGIN
  -- Create temp table with games to delete
  CREATE TEMP TABLE games_to_delete AS
  WITH dup_groups AS (
    SELECT 
      home_team_id,
      away_team_id,
      DATE(start_time) as game_date,
      array_agg(id ORDER BY id) as game_ids,
      MIN(id) as keep_id
    FROM games
    WHERE sport = sport_filter
      AND home_team_id IS NOT NULL 
      AND away_team_id IS NOT NULL
    GROUP BY home_team_id, away_team_id, DATE(start_time)
    HAVING COUNT(*) > 1
    LIMIT batch_size
  )
  SELECT unnest(game_ids) as game_id
  FROM dup_groups
  WHERE unnest(game_ids) != keep_id;

  -- Delete from all referencing tables first
  DELETE FROM player_game_logs WHERE game_id IN (SELECT game_id FROM games_to_delete);
  DELETE FROM advanced_player_metrics WHERE game_id IN (SELECT game_id FROM games_to_delete);
  DELETE FROM betting_lines WHERE game_id IN (SELECT game_id FROM games_to_delete);
  DELETE FROM weather_data WHERE game_id IN (SELECT game_id FROM games_to_delete);
  
  -- Now delete the games
  DELETE FROM games WHERE id IN (SELECT game_id FROM games_to_delete);
  
  GET DIAGNOSTICS games_deleted = ROW_COUNT;
  
  DROP TABLE games_to_delete;
  
  RETURN QUERY SELECT games_deleted;
END;
$$ LANGUAGE plpgsql;

-- Now use the function to clean each sport
BEGIN;

-- Clean small sports first
SELECT 'Cleaning NBA duplicates...' as status;
SELECT * FROM delete_game_duplicates('NBA', 10);

SELECT 'Cleaning NHL duplicates...' as status;
SELECT * FROM delete_game_duplicates('NHL', 20);

SELECT 'Cleaning MILB duplicates...' as status;
SELECT * FROM delete_game_duplicates('MILB', 10);

-- Check progress
SELECT 'Progress after small sports:' as status;
SELECT sport, COUNT(*) as remaining_duplicates
FROM (
  SELECT sport, home_team_id, away_team_id, DATE(start_time)
  FROM games
  WHERE home_team_id IS NOT NULL AND away_team_id IS NOT NULL
  GROUP BY sport, home_team_id, away_team_id, DATE(start_time)
  HAVING COUNT(*) > 1
) t
GROUP BY sport
ORDER BY remaining_duplicates DESC;

COMMIT;

-- For larger sports, run these separately:
-- SELECT * FROM delete_game_duplicates('NCAA_HKY', 50);  -- Run ~7 times
-- SELECT * FROM delete_game_duplicates('MLB', 50);       -- Run ~21 times  
-- SELECT * FROM delete_game_duplicates('NCAA_BASEBALL', 50); -- Run ~27 times

-- When done, drop the function:
-- DROP FUNCTION delete_game_duplicates(TEXT, INT);
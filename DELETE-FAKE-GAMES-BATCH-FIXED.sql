-- 🎯 BATCH DELETE FAKE GAMES (Run multiple times)
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/pvekvqiqrrpugfmpgaup/sql/new
-- Each run deletes 1000 games to avoid timeouts

-- First, delete related data for a batch of fake games
WITH fake_game_batch AS (
  SELECT id::text as id 
  FROM games 
  WHERE external_id IS NULL 
  LIMIT 1000
)
DELETE FROM player_stats 
WHERE game_id IN (SELECT id FROM fake_game_batch);

WITH fake_game_batch AS (
  SELECT id::text as id 
  FROM games 
  WHERE external_id IS NULL 
  LIMIT 1000
)
DELETE FROM player_game_logs 
WHERE game_id IN (SELECT id FROM fake_game_batch);

WITH fake_game_batch AS (
  SELECT id::text as id 
  FROM games 
  WHERE external_id IS NULL 
  LIMIT 1000
)
DELETE FROM ml_predictions 
WHERE game_id IN (SELECT id FROM fake_game_batch);

-- Now delete the games themselves
WITH deleted AS (
  DELETE FROM games 
  WHERE id IN (
    SELECT id 
    FROM games 
    WHERE external_id IS NULL 
    LIMIT 1000
  )
  RETURNING *
)
SELECT 
  COUNT(*) as deleted_count,
  (SELECT COUNT(*) FROM games WHERE external_id IS NULL) as remaining_fake_games
FROM deleted;
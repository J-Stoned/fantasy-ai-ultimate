-- 🎯 SIMPLE BATCH DELETE - GAMES ONLY
-- Run this in Supabase SQL Editor multiple times
-- Each run deletes 1000 fake games

-- Delete 1000 fake games and show progress
WITH deleted AS (
  DELETE FROM games 
  WHERE external_id IS NULL
  LIMIT 1000
  RETURNING *
)
SELECT 
  COUNT(*) as deleted_in_this_batch,
  (SELECT COUNT(*) FROM games WHERE external_id IS NULL) as fake_games_remaining,
  (SELECT COUNT(*) FROM games WHERE external_id IS NOT NULL) as real_games_count,
  (SELECT COUNT(*) FROM games) as total_games_count
FROM deleted;
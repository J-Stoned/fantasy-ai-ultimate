-- 🚀 COMPREHENSIVE FAKE DATA CLEANUP SQL
-- Run this in Supabase SQL Editor: https://app.supabase.com/project/pvekvqiqrrpugfmpgaup/sql/new

-- Step 1: Check current status
SELECT 
  'Total Games' as metric,
  COUNT(*) as count 
FROM games
UNION ALL
SELECT 
  'Fake Games (no external_id)' as metric,
  COUNT(*) as count 
FROM games 
WHERE external_id IS NULL
UNION ALL
SELECT 
  'Total Players' as metric,
  COUNT(*) as count 
FROM players
UNION ALL
SELECT 
  'Fake Players (no external_id)' as metric,
  COUNT(*) as count 
FROM players 
WHERE external_id IS NULL;

-- Step 2: Delete related data first (to avoid foreign key issues)
-- Delete player_stats for fake games
DELETE FROM player_stats 
WHERE game_id IN (
  SELECT id FROM games WHERE external_id IS NULL
);

-- Delete player_game_logs for fake games
DELETE FROM player_game_logs 
WHERE game_id IN (
  SELECT id FROM games WHERE external_id IS NULL
);

-- Delete ml_predictions for fake games
DELETE FROM ml_predictions 
WHERE game_id IN (
  SELECT id FROM games WHERE external_id IS NULL
);

-- Delete news_articles that might reference fake games
DELETE FROM news_articles 
WHERE game_id IN (
  SELECT id FROM games WHERE external_id IS NULL
);

-- Step 3: Delete fake games
DELETE FROM games 
WHERE external_id IS NULL;

-- Step 4: Delete fake players and their related data
-- Delete player_stats for fake players
DELETE FROM player_stats 
WHERE player_id IN (
  SELECT id FROM players WHERE external_id IS NULL
);

-- Delete player_game_logs for fake players
DELETE FROM player_game_logs 
WHERE player_id IN (
  SELECT id FROM players WHERE external_id IS NULL
);

-- Delete player_injuries for fake players
DELETE FROM player_injuries 
WHERE player_id IN (
  SELECT id FROM players WHERE external_id IS NULL
);

-- Delete the fake players themselves
DELETE FROM players 
WHERE external_id IS NULL;

-- Step 5: Verify cleanup
SELECT 
  'Remaining Fake Games' as metric,
  COUNT(*) as count 
FROM games 
WHERE external_id IS NULL
UNION ALL
SELECT 
  'Remaining Fake Players' as metric,
  COUNT(*) as count 
FROM players 
WHERE external_id IS NULL
UNION ALL
SELECT 
  'Total Clean Games' as metric,
  COUNT(*) as count 
FROM games 
WHERE external_id IS NOT NULL
UNION ALL
SELECT 
  'Total Clean Players' as metric,
  COUNT(*) as count 
FROM players 
WHERE external_id IS NOT NULL;
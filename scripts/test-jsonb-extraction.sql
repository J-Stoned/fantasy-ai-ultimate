-- Test JSONB extraction to ensure it works before creating the view

-- 1. Test JSONB type detection
SELECT 
  '{"points": 25, "assists": 7, "rebounds": 10}'::jsonb as test_stats,
  jsonb_typeof('25'::jsonb) as number_type,
  jsonb_typeof('"25"'::jsonb) as string_type;

-- 2. Test extraction with type checking
WITH test_data AS (
  SELECT '{"points": 25, "assists": 7, "rebounds": 10, "name": "test"}'::jsonb as stats
)
SELECT 
  key,
  value,
  jsonb_typeof(value) as value_type,
  CASE 
    WHEN jsonb_typeof(value) = 'number' THEN value::TEXT::NUMERIC
    WHEN value::TEXT ~ '^[0-9]+\.?[0-9]*$' THEN value::TEXT::NUMERIC
    ELSE 0::NUMERIC
  END as numeric_value
FROM test_data, jsonb_each(stats);

-- 3. Test with actual player_stats structure
SELECT 
  stat_type,
  stat_value,
  pg_typeof(stat_value) as type
FROM player_stats
LIMIT 5;

-- 4. If player_game_logs exists with data, test extraction
SELECT 
  player_id,
  game_id,
  stats
FROM player_game_logs
LIMIT 1;
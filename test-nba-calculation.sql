-- Test NBA calculation with actual data
SELECT 
  'Test Calculation' as test,
  stats->>'points' as points_raw,
  stats->>'field_goals_attempted' as fga_raw,
  stats->>'field_goals_made' as fgm_raw,
  stats->>'free_throws_attempted' as fta_raw,
  stats->>'minutes_played' as minutes_raw,
  minutes_played as minutes_column,
  
  -- Manual calculation test
  CASE 
    WHEN (stats->>'field_goals_attempted')::float > 0 
    THEN (stats->>'field_goals_made')::float / (stats->>'field_goals_attempted')::float
    ELSE 0 
  END as manual_fg_pct,
  
  -- True shooting test
  CASE 
    WHEN ((stats->>'field_goals_attempted')::float + 0.44 * (stats->>'free_throws_attempted')::float) > 0
    THEN (stats->>'points')::float / (2 * ((stats->>'field_goals_attempted')::float + 0.44 * (stats->>'free_throws_attempted')::float))
    ELSE 0
  END as manual_true_shooting,
  
  computed_metrics->>'true_shooting_pct' as calculated_ts,
  computed_metrics->>'field_goal_pct' as calculated_fg
  
FROM player_game_logs pgl
JOIN games g ON pgl.game_id = g.id
WHERE g.sport = 'NBA'
AND stats->>'points' != '0'
AND computed_metrics != '{}'
LIMIT 5;
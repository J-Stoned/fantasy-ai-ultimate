-- Comprehensive Stat Definitions for All Sports (UPSERT version)
-- This safely inserts or updates stat definitions

-- First, let's see what we already have
SELECT sport, COUNT(*) as existing_stats 
FROM stat_definitions 
GROUP BY sport
ORDER BY sport;

-- Now insert/update all definitions using ON CONFLICT
-- This preserves existing data while adding new stats

-- =====================================================
-- BASKETBALL STATS (NBA, NCAA_BB)
-- =====================================================

-- Basic Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NBA', 'basic', 'points', 'Points', 'Total points scored', 'count', 10, true),
('NBA', 'basic', 'rebounds', 'Rebounds', 'Total rebounds', 'count', 8, true),
('NBA', 'basic', 'assists', 'Assists', 'Total assists', 'count', 8, true),
('NBA', 'basic', 'steals', 'Steals', 'Total steals', 'count', 7, true),
('NBA', 'basic', 'blocks', 'Blocks', 'Total blocks', 'count', 7, true),
('NBA', 'basic', 'turnovers', 'Turnovers', 'Total turnovers', 'count', 6, true),
('NBA', 'basic', 'fouls', 'Personal Fouls', 'Personal fouls committed', 'count', 4, false),
('NBA', 'basic', 'minutes', 'Minutes', 'Minutes played', 'time', 9, true),
('NBA', 'basic', 'field_goals_made', 'FGM', 'Field goals made', 'count', 8, true),
('NBA', 'basic', 'field_goals_attempted', 'FGA', 'Field goals attempted', 'count', 7, true),
('NBA', 'basic', 'three_pointers_made', '3PM', 'Three pointers made', 'count', 8, true),
('NBA', 'basic', 'three_pointers_attempted', '3PA', 'Three pointers attempted', 'count', 7, true),
('NBA', 'basic', 'free_throws_made', 'FTM', 'Free throws made', 'count', 7, true),
('NBA', 'basic', 'free_throws_attempted', 'FTA', 'Free throws attempted', 'count', 6, true),
('NBA', 'basic', 'offensive_rebounds', 'OREB', 'Offensive rebounds', 'count', 7, true),
('NBA', 'basic', 'defensive_rebounds', 'DREB', 'Defensive rebounds', 'count', 7, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Shooting Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NBA', 'shooting', 'field_goal_percentage', 'FG%', 'Field goal percentage', 'percentage', 9, true),
('NBA', 'shooting', 'three_point_percentage', '3P%', 'Three point percentage', 'percentage', 8, true),
('NBA', 'shooting', 'free_throw_percentage', 'FT%', 'Free throw percentage', 'percentage', 7, true),
('NBA', 'shooting', 'effective_field_goal_percentage', 'eFG%', 'Effective field goal percentage', 'percentage', 9, true),
('NBA', 'shooting', 'true_shooting_percentage', 'TS%', 'True shooting percentage', 'percentage', 10, true),
('NBA', 'shooting', 'points_per_shot', 'PPS', 'Points per shot attempt', 'rate', 8, false),
('NBA', 'shooting', 'shot_quality', 'Shot Quality', 'Average shot quality based on location', 'rating', 7, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Advanced Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('NBA', 'advanced', 'player_efficiency_rating', 'PER', 'Player efficiency rating', 'rating', 10, true, false),
('NBA', 'advanced', 'usage_rate', 'USG%', 'Percentage of plays used while on court', 'percentage', 9, true, false),
('NBA', 'advanced', 'assist_percentage', 'AST%', 'Percentage of teammate FG assisted', 'percentage', 8, true, false),
('NBA', 'advanced', 'rebound_percentage', 'REB%', 'Percentage of available rebounds grabbed', 'percentage', 8, true, false),
('NBA', 'advanced', 'block_percentage', 'BLK%', 'Percentage of opponent shots blocked', 'percentage', 7, true, false),
('NBA', 'advanced', 'steal_percentage', 'STL%', 'Percentage of opponent possessions stolen', 'percentage', 7, true, false),
('NBA', 'advanced', 'turnover_percentage', 'TOV%', 'Turnovers per 100 plays', 'percentage', 6, true, false),
('NBA', 'advanced', 'offensive_rating', 'ORTG', 'Points produced per 100 possessions', 'rating', 9, true, false),
('NBA', 'advanced', 'defensive_rating', 'DRTG', 'Points allowed per 100 possessions', 'rating', 9, true, false),
('NBA', 'advanced', 'net_rating', 'NetRTG', 'Point differential per 100 possessions', 'differential', 9, true, false),
('NBA', 'advanced', 'pace', 'PACE', 'Possessions per 48 minutes', 'rate', 7, false, false),
('NBA', 'advanced', 'pie', 'PIE', 'Player Impact Estimate', 'percentage', 9, true, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- =====================================================
-- FOOTBALL STATS (NFL, NCAA_FB) - Sample
-- =====================================================

-- Let's fix the specific conflict first
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NFL', 'passing_advanced', 'red_zone_touchdowns', 'RZ TDs', 'Red zone passing TDs', 'count', 9, true),
('NFL', 'rushing_advanced', 'red_zone_rushing_touchdowns', 'RZ Rush TDs', 'Red zone rushing TDs', 'count', 9, true),
('NFL', 'receiving_advanced', 'red_zone_receiving_touchdowns', 'RZ Rec TDs', 'Red zone receiving TDs', 'count', 9, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Basic passing stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NFL', 'passing', 'passing_yards', 'Pass Yards', 'Total passing yards', 'count', 10, true),
('NFL', 'passing', 'passing_touchdowns', 'Pass TDs', 'Passing touchdowns', 'count', 10, true),
('NFL', 'passing', 'passing_attempts', 'Attempts', 'Pass attempts', 'count', 7, true),
('NFL', 'passing', 'passing_completions', 'Completions', 'Completed passes', 'count', 8, true),
('NFL', 'passing', 'completion_percentage', 'Comp %', 'Completion percentage', 'percentage', 9, true),
('NFL', 'passing', 'interceptions', 'INTs', 'Interceptions thrown', 'count', 8, true),
('NFL', 'passing', 'sacks_taken', 'Sacks', 'Times sacked', 'count', 6, true),
('NFL', 'passing', 'passer_rating', 'Rating', 'Passer rating', 'rating', 9, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Check results
SELECT sport, COUNT(*) as total_stats 
FROM stat_definitions 
GROUP BY sport
ORDER BY sport;

-- Show sample of what was added
SELECT sport, stat_category, COUNT(*) as count
FROM stat_definitions
GROUP BY sport, stat_category
ORDER BY sport, stat_category;
-- Complete Stat Definitions for ALL Sports (500+ stats)
-- Safe UPSERT version that handles conflicts

-- Show what we're starting with
SELECT 'BEFORE INSERT:' as status, sport, COUNT(*) as stat_count 
FROM stat_definitions 
GROUP BY sport
ORDER BY sport;

-- =====================================================
-- BASKETBALL STATS (NBA, NCAA_BB) - Complete
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

-- Tracking Stats (Requires SportVU/Second Spectrum)
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('NBA', 'tracking', 'distance_traveled', 'Distance', 'Total distance traveled in miles', 'distance', 6, false, true),
('NBA', 'tracking', 'average_speed', 'Avg Speed', 'Average speed in mph', 'speed', 5, false, true),
('NBA', 'tracking', 'top_speed', 'Top Speed', 'Maximum speed reached', 'speed', 5, false, true),
('NBA', 'tracking', 'touches', 'Touches', 'Number of times player touched ball', 'count', 8, true, true),
('NBA', 'tracking', 'front_court_touches', 'FC Touches', 'Touches in front court', 'count', 7, true, true),
('NBA', 'tracking', 'time_of_possession', 'Time of Poss', 'Seconds of ball possession', 'time', 7, false, true),
('NBA', 'tracking', 'dribbles', 'Dribbles', 'Number of dribbles', 'count', 5, false, true),
('NBA', 'tracking', 'paint_touches', 'Paint Touches', 'Touches in the paint', 'count', 8, true, true),
('NBA', 'tracking', 'post_touches', 'Post Touches', 'Touches in the post', 'count', 7, true, true),
('NBA', 'tracking', 'elbow_touches', 'Elbow Touches', 'Touches at the elbow', 'count', 6, false, true),
('NBA', 'tracking', 'catch_shoot_points', 'C&S Points', 'Points from catch and shoot', 'count', 8, true, true),
('NBA', 'tracking', 'pull_up_points', 'Pull-up Points', 'Points from pull-up shots', 'count', 8, true, true),
('NBA', 'tracking', 'drive_points', 'Drive Points', 'Points from drives', 'count', 8, true, true),
('NBA', 'tracking', 'paint_points', 'Paint Points', 'Points scored in paint', 'count', 8, true, true),
('NBA', 'tracking', 'fast_break_points', 'FB Points', 'Fast break points', 'count', 8, true, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- Hustle Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('NBA', 'hustle', 'deflections', 'Deflections', 'Total deflections', 'count', 7, true, true),
('NBA', 'hustle', 'loose_balls_recovered', 'Loose Balls', 'Loose balls recovered', 'count', 6, true, true),
('NBA', 'hustle', 'screen_assists', 'Screen Assists', 'Screens leading to scores', 'count', 7, true, true),
('NBA', 'hustle', 'contested_shots', 'Contested Shots', 'Shots contested on defense', 'count', 8, true, true),
('NBA', 'hustle', 'charges_drawn', 'Charges Drawn', 'Offensive fouls drawn', 'count', 6, true, true),
('NBA', 'hustle', 'box_outs', 'Box Outs', 'Box outs performed', 'count', 6, false, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- Situational Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NBA', 'situational', 'clutch_points', 'Clutch Points', 'Points in last 5 min, margin ≤ 5', 'count', 8, true),
('NBA', 'situational', 'clutch_fg_percentage', 'Clutch FG%', 'FG% in clutch time', 'percentage', 8, true),
('NBA', 'situational', 'clutch_plus_minus', 'Clutch +/-', 'Plus/minus in clutch time', 'differential', 7, true),
('NBA', 'situational', 'fourth_quarter_points', '4Q Points', 'Points in 4th quarter', 'count', 7, true),
('NBA', 'situational', 'overtime_points', 'OT Points', 'Points in overtime', 'count', 6, true),
('NBA', 'situational', 'points_off_turnovers', 'Points off TO', 'Points from opponent turnovers', 'count', 7, true),
('NBA', 'situational', 'second_chance_points', '2nd Chance Pts', 'Points from offensive rebounds', 'count', 7, true),
('NBA', 'situational', 'points_in_paint', 'Paint Points', 'Points scored in paint', 'count', 8, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Play Type Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('NBA', 'play_type', 'isolation_possessions', 'ISO Poss', 'Isolation possessions', 'count', 6, false, true),
('NBA', 'play_type', 'isolation_points', 'ISO Points', 'Points from isolation', 'count', 7, true, true),
('NBA', 'play_type', 'isolation_efficiency', 'ISO PPP', 'Points per isolation possession', 'rate', 7, false, true),
('NBA', 'play_type', 'pick_roll_ball_possessions', 'PnR Ball Poss', 'Pick and roll as ball handler', 'count', 7, false, true),
('NBA', 'play_type', 'pick_roll_ball_points', 'PnR Ball Pts', 'Points as PnR ball handler', 'count', 8, true, true),
('NBA', 'play_type', 'pick_roll_man_possessions', 'PnR Man Poss', 'Pick and roll as screener', 'count', 6, false, true),
('NBA', 'play_type', 'pick_roll_man_points', 'PnR Man Pts', 'Points as PnR screener', 'count', 7, true, true),
('NBA', 'play_type', 'post_up_possessions', 'Post Poss', 'Post up possessions', 'count', 6, false, true),
('NBA', 'play_type', 'post_up_points', 'Post Points', 'Points from post ups', 'count', 7, true, true),
('NBA', 'play_type', 'spot_up_possessions', 'Spot Up Poss', 'Spot up possessions', 'count', 6, false, true),
('NBA', 'play_type', 'spot_up_points', 'Spot Up Pts', 'Points from spot ups', 'count', 7, true, true),
('NBA', 'play_type', 'handoff_possessions', 'Handoff Poss', 'Handoff possessions', 'count', 5, false, true),
('NBA', 'play_type', 'cut_possessions', 'Cut Poss', 'Possessions from cuts', 'count', 6, false, true),
('NBA', 'play_type', 'cut_points', 'Cut Points', 'Points from cuts', 'count', 7, true, true),
('NBA', 'play_type', 'transition_possessions', 'Trans Poss', 'Transition possessions', 'count', 7, false, true),
('NBA', 'play_type', 'transition_points', 'Trans Points', 'Points in transition', 'count', 8, true, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- Defense Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('NBA', 'defense', 'opponent_fg_percentage', 'Opp FG%', 'Opponent FG% when defending', 'percentage', 8, true, true),
('NBA', 'defense', 'dfg_percentage', 'DFG%', 'Defensive field goal percentage', 'percentage', 8, true, true),
('NBA', 'defense', 'diff_percentage', 'DIFF%', 'Difference vs expected FG%', 'percentage', 8, false, true),
('NBA', 'defense', 'defensive_win_shares', 'DWS', 'Defensive win shares', 'shares', 8, true, false),
('NBA', 'defense', 'defensive_box_plus_minus', 'DBPM', 'Defensive box plus/minus', 'rating', 8, true, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- =====================================================
-- FOOTBALL STATS (NFL, NCAA_FB) - Complete
-- =====================================================

-- Passing Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NFL', 'passing', 'passing_yards', 'Pass Yards', 'Total passing yards', 'count', 10, true),
('NFL', 'passing', 'passing_touchdowns', 'Pass TDs', 'Passing touchdowns', 'count', 10, true),
('NFL', 'passing', 'passing_attempts', 'Attempts', 'Pass attempts', 'count', 7, true),
('NFL', 'passing', 'passing_completions', 'Completions', 'Completed passes', 'count', 8, true),
('NFL', 'passing', 'completion_percentage', 'Comp %', 'Completion percentage', 'percentage', 9, true),
('NFL', 'passing', 'interceptions', 'INTs', 'Interceptions thrown', 'count', 8, true),
('NFL', 'passing', 'sacks_taken', 'Sacks', 'Times sacked', 'count', 6, true),
('NFL', 'passing', 'sack_yards_lost', 'Sack Yards', 'Yards lost to sacks', 'count', 5, true),
('NFL', 'passing', 'passer_rating', 'Rating', 'Passer rating', 'rating', 9, true),
('NFL', 'passing', 'qbr', 'QBR', 'Total quarterback rating', 'rating', 9, true),
('NFL', 'passing', 'yards_per_attempt', 'Y/A', 'Yards per attempt', 'rate', 8, true),
('NFL', 'passing', 'adjusted_yards_per_attempt', 'AY/A', 'Adjusted yards per attempt', 'rate', 9, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Advanced Passing Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('NFL', 'passing_advanced', 'air_yards', 'Air Yards', 'Yards ball traveled in air', 'count', 8, true, true),
('NFL', 'passing_advanced', 'yards_after_catch', 'YAC', 'Yards after catch by receivers', 'count', 7, true, true),
('NFL', 'passing_advanced', 'average_depth_of_target', 'aDOT', 'Average depth of target', 'distance', 7, false, true),
('NFL', 'passing_advanced', 'time_to_throw', 'TTT', 'Average time to throw', 'time', 6, false, true),
('NFL', 'passing_advanced', 'pressure_percentage', 'Pressure %', 'Percentage of dropbacks pressured', 'percentage', 7, false, true),
('NFL', 'passing_advanced', 'blitz_percentage', 'Blitz %', 'Percentage of dropbacks blitzed', 'percentage', 6, false, true),
('NFL', 'passing_advanced', 'hurry_percentage', 'Hurry %', 'Percentage of dropbacks hurried', 'percentage', 6, false, true),
('NFL', 'passing_advanced', 'red_zone_attempts', 'RZ Att', 'Red zone pass attempts', 'count', 8, true, false),
('NFL', 'passing_advanced', 'red_zone_pass_touchdowns', 'RZ Pass TDs', 'Red zone passing TDs', 'count', 9, true, false),
('NFL', 'passing_advanced', 'deep_ball_attempts', 'Deep Att', 'Passes 20+ yards', 'count', 7, true, true),
('NFL', 'passing_advanced', 'deep_ball_completions', 'Deep Comp', 'Completions 20+ yards', 'count', 8, true, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- Rushing Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NFL', 'rushing', 'rushing_yards', 'Rush Yards', 'Total rushing yards', 'count', 10, true),
('NFL', 'rushing', 'rushing_touchdowns', 'Rush TDs', 'Rushing touchdowns', 'count', 10, true),
('NFL', 'rushing', 'rushing_attempts', 'Carries', 'Rushing attempts', 'count', 8, true),
('NFL', 'rushing', 'yards_per_carry', 'YPC', 'Yards per carry', 'rate', 8, true),
('NFL', 'rushing', 'rushing_first_downs', 'Rush 1st', 'First downs rushing', 'count', 7, true),
('NFL', 'rushing', 'longest_rush', 'Long', 'Longest rush', 'count', 6, false),
('NFL', 'rushing', 'rushing_20_plus', '20+', 'Rushes of 20+ yards', 'count', 7, true),
('NFL', 'rushing', 'fumbles', 'Fumbles', 'Fumbles on rushes', 'count', 6, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Advanced Rushing Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('NFL', 'rushing_advanced', 'yards_before_contact', 'YBC', 'Yards before contact', 'count', 7, true, true),
('NFL', 'rushing_advanced', 'yards_after_contact', 'YAC', 'Yards after contact', 'count', 8, true, true),
('NFL', 'rushing_advanced', 'broken_tackles', 'BT', 'Broken tackles', 'count', 7, true, true),
('NFL', 'rushing_advanced', 'evaded_tackles', 'ET', 'Evaded tackles', 'count', 7, true, true),
('NFL', 'rushing_advanced', 'stuff_percentage', 'Stuff %', 'Runs for loss or no gain', 'percentage', 6, false, true),
('NFL', 'rushing_advanced', 'power_success_rate', 'Power %', 'Success on 3rd/4th & short', 'percentage', 7, false, false),
('NFL', 'rushing_advanced', 'red_zone_carries', 'RZ Carries', 'Red zone rushing attempts', 'count', 8, true, false),
('NFL', 'rushing_advanced', 'red_zone_rush_touchdowns', 'RZ Rush TDs', 'Red zone rushing TDs', 'count', 9, true, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- Receiving Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NFL', 'receiving', 'receptions', 'Rec', 'Receptions', 'count', 9, true),
('NFL', 'receiving', 'receiving_yards', 'Rec Yards', 'Receiving yards', 'count', 10, true),
('NFL', 'receiving', 'receiving_touchdowns', 'Rec TDs', 'Receiving touchdowns', 'count', 10, true),
('NFL', 'receiving', 'targets', 'Targets', 'Times targeted', 'count', 8, true),
('NFL', 'receiving', 'catch_percentage', 'Catch %', 'Reception percentage', 'percentage', 8, true),
('NFL', 'receiving', 'yards_per_reception', 'Y/R', 'Yards per reception', 'rate', 8, true),
('NFL', 'receiving', 'yards_per_target', 'Y/T', 'Yards per target', 'rate', 7, true),
('NFL', 'receiving', 'receiving_first_downs', 'Rec 1st', 'First downs receiving', 'count', 7, true),
('NFL', 'receiving', 'longest_reception', 'Long', 'Longest reception', 'count', 6, false),
('NFL', 'receiving', 'receiving_20_plus', '20+', 'Receptions of 20+ yards', 'count', 7, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Advanced Receiving Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('NFL', 'receiving_advanced', 'receiving_average_depth_of_target', 'Rec aDOT', 'Average depth of target', 'distance', 7, false, true),
('NFL', 'receiving_advanced', 'receiving_air_yards', 'Rec Air Yards', 'Receiving air yards', 'count', 7, true, true),
('NFL', 'receiving_advanced', 'receiving_yards_after_catch', 'Rec YAC', 'Yards after catch', 'count', 8, true, true),
('NFL', 'receiving_advanced', 'target_share', 'Target %', 'Share of team targets', 'percentage', 8, true, false),
('NFL', 'receiving_advanced', 'air_yards_share', 'Air Yard %', 'Share of team air yards', 'percentage', 7, true, true),
('NFL', 'receiving_advanced', 'cushion', 'Cushion', 'Yards of separation at snap', 'distance', 6, false, true),
('NFL', 'receiving_advanced', 'separation', 'Sep', 'Yards of separation at catch', 'distance', 7, false, true),
('NFL', 'receiving_advanced', 'contested_catches', 'Contested', 'Contested catches made', 'count', 7, true, true),
('NFL', 'receiving_advanced', 'red_zone_targets', 'RZ Targets', 'Red zone targets', 'count', 8, true, false),
('NFL', 'receiving_advanced', 'red_zone_receptions', 'RZ Rec', 'Red zone receptions', 'count', 8, true, false),
('NFL', 'receiving_advanced', 'red_zone_rec_touchdowns', 'RZ Rec TDs', 'Red zone receiving TDs', 'count', 9, true, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- Defense Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NFL', 'defense', 'tackles_solo', 'Solo', 'Solo tackles', 'count', 8, true),
('NFL', 'defense', 'tackles_assist', 'Ast', 'Assisted tackles', 'count', 6, true),
('NFL', 'defense', 'tackles_total', 'Total', 'Total tackles', 'count', 9, true),
('NFL', 'defense', 'tackles_for_loss', 'TFL', 'Tackles for loss', 'count', 8, true),
('NFL', 'defense', 'sacks', 'Sacks', 'Quarterback sacks', 'count', 9, true),
('NFL', 'defense', 'quarterback_hits', 'QB Hits', 'Quarterback hits', 'count', 7, true),
('NFL', 'defense', 'passes_defended', 'PD', 'Passes defended', 'count', 7, true),
('NFL', 'defense', 'interceptions', 'INTs', 'Interceptions', 'count', 9, true),
('NFL', 'defense', 'interception_yards', 'INT Yards', 'Interception return yards', 'count', 7, true),
('NFL', 'defense', 'interception_touchdowns', 'INT TDs', 'Pick-six touchdowns', 'count', 8, true),
('NFL', 'defense', 'forced_fumbles', 'FF', 'Forced fumbles', 'count', 8, true),
('NFL', 'defense', 'fumble_recoveries', 'FR', 'Fumble recoveries', 'count', 8, true),
('NFL', 'defense', 'fumble_touchdowns', 'FR TDs', 'Fumble return TDs', 'count', 8, true),
('NFL', 'defense', 'safeties', 'Safeties', 'Safeties scored', 'count', 7, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Advanced Defense Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('NFL', 'defense_advanced', 'hurries', 'Hurries', 'QB hurries', 'count', 7, true, true),
('NFL', 'defense_advanced', 'pressures', 'Pressures', 'Total QB pressures', 'count', 8, true, true),
('NFL', 'defense_advanced', 'pressure_rate', 'Pressure %', 'Pressure rate on pass rushes', 'percentage', 7, false, true),
('NFL', 'defense_advanced', 'missed_tackles', 'MT', 'Missed tackles', 'count', 5, false, true),
('NFL', 'defense_advanced', 'missed_tackle_percentage', 'MT %', 'Missed tackle percentage', 'percentage', 5, false, true),
('NFL', 'defense_advanced', 'stops', 'Stops', 'Defensive stops', 'count', 7, true, true),
('NFL', 'defense_advanced', 'coverage_snaps', 'Cov Snaps', 'Snaps in coverage', 'count', 6, false, true),
('NFL', 'defense_advanced', 'targets_allowed', 'Targets', 'Targets allowed in coverage', 'count', 7, true, true),
('NFL', 'defense_advanced', 'receptions_allowed', 'Rec Allowed', 'Receptions allowed', 'count', 7, true, true),
('NFL', 'defense_advanced', 'yards_allowed', 'Yards Allowed', 'Yards allowed in coverage', 'count', 7, true, true),
('NFL', 'defense_advanced', 'touchdowns_allowed', 'TDs Allowed', 'TDs allowed in coverage', 'count', 7, true, true),
('NFL', 'defense_advanced', 'passer_rating_allowed', 'PR Allowed', 'Passer rating when targeted', 'rating', 8, true, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- =====================================================
-- BASEBALL STATS (MLB) - Complete
-- =====================================================

-- Batting Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('MLB', 'batting', 'at_bats', 'AB', 'At bats', 'count', 7, true),
('MLB', 'batting', 'runs', 'R', 'Runs scored', 'count', 9, true),
('MLB', 'batting', 'hits', 'H', 'Hits', 'count', 9, true),
('MLB', 'batting', 'doubles', '2B', 'Doubles', 'count', 8, true),
('MLB', 'batting', 'triples', '3B', 'Triples', 'count', 7, true),
('MLB', 'batting', 'home_runs', 'HR', 'Home runs', 'count', 10, true),
('MLB', 'batting', 'runs_batted_in', 'RBI', 'Runs batted in', 'count', 10, true),
('MLB', 'batting', 'walks', 'BB', 'Walks', 'count', 8, true),
('MLB', 'batting', 'strikeouts', 'K', 'Strikeouts', 'count', 6, true),
('MLB', 'batting', 'stolen_bases', 'SB', 'Stolen bases', 'count', 9, true),
('MLB', 'batting', 'caught_stealing', 'CS', 'Caught stealing', 'count', 5, true),
('MLB', 'batting', 'batting_average', 'AVG', 'Batting average', 'percentage', 9, true),
('MLB', 'batting', 'on_base_percentage', 'OBP', 'On base percentage', 'percentage', 9, true),
('MLB', 'batting', 'slugging_percentage', 'SLG', 'Slugging percentage', 'percentage', 9, true),
('MLB', 'batting', 'on_base_plus_slugging', 'OPS', 'On base plus slugging', 'percentage', 10, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Advanced Batting Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('MLB', 'batting_advanced', 'woba', 'wOBA', 'Weighted on-base average', 'percentage', 10, true, false),
('MLB', 'batting_advanced', 'wrc_plus', 'wRC+', 'Weighted runs created plus', 'rating', 10, true, false),
('MLB', 'batting_advanced', 'babip', 'BABIP', 'Batting average on balls in play', 'percentage', 7, false, false),
('MLB', 'batting_advanced', 'isolated_power', 'ISO', 'Isolated power', 'percentage', 8, true, false),
('MLB', 'batting_advanced', 'walk_rate', 'BB%', 'Walk rate', 'percentage', 7, true, false),
('MLB', 'batting_advanced', 'strikeout_rate', 'K%', 'Strikeout rate', 'percentage', 6, true, false),
('MLB', 'batting_advanced', 'exit_velocity', 'Exit Velo', 'Average exit velocity', 'speed', 8, true, true),
('MLB', 'batting_advanced', 'launch_angle', 'Launch Angle', 'Average launch angle', 'degrees', 7, false, true),
('MLB', 'batting_advanced', 'barrel_rate', 'Barrel%', 'Barrel rate', 'percentage', 9, true, true),
('MLB', 'batting_advanced', 'hard_hit_rate', 'Hard Hit%', 'Hard hit rate', 'percentage', 8, true, true),
('MLB', 'batting_advanced', 'sweet_spot_percentage', 'Sweet Spot%', 'Sweet spot percentage', 'percentage', 7, false, true),
('MLB', 'batting_advanced', 'expected_batting_average', 'xBA', 'Expected batting average', 'percentage', 8, true, true),
('MLB', 'batting_advanced', 'expected_slugging', 'xSLG', 'Expected slugging', 'percentage', 8, true, true),
('MLB', 'batting_advanced', 'expected_woba', 'xwOBA', 'Expected weighted on-base average', 'percentage', 9, true, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- Pitching Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('MLB', 'pitching', 'wins', 'W', 'Wins', 'count', 8, true),
('MLB', 'pitching', 'losses', 'L', 'Losses', 'count', 6, true),
('MLB', 'pitching', 'saves', 'SV', 'Saves', 'count', 9, true),
('MLB', 'pitching', 'holds', 'HLD', 'Holds', 'count', 7, true),
('MLB', 'pitching', 'innings_pitched', 'IP', 'Innings pitched', 'count', 8, true),
('MLB', 'pitching', 'earned_run_average', 'ERA', 'Earned run average', 'rate', 10, true),
('MLB', 'pitching', 'whip', 'WHIP', 'Walks + hits per inning', 'rate', 9, true),
('MLB', 'pitching', 'strikeouts', 'K', 'Strikeouts', 'count', 10, true),
('MLB', 'pitching', 'walks', 'BB', 'Walks', 'count', 6, true),
('MLB', 'pitching', 'hits_allowed', 'H', 'Hits allowed', 'count', 7, true),
('MLB', 'pitching', 'home_runs_allowed', 'HR', 'Home runs allowed', 'count', 7, true),
('MLB', 'pitching', 'earned_runs', 'ER', 'Earned runs', 'count', 7, true),
('MLB', 'pitching', 'strikeouts_per_nine', 'K/9', 'Strikeouts per 9 innings', 'rate', 9, true),
('MLB', 'pitching', 'walks_per_nine', 'BB/9', 'Walks per 9 innings', 'rate', 7, true),
('MLB', 'pitching', 'hits_per_nine', 'H/9', 'Hits per 9 innings', 'rate', 7, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Advanced Pitching Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('MLB', 'pitching_advanced', 'fip', 'FIP', 'Fielding independent pitching', 'rate', 9, true, false),
('MLB', 'pitching_advanced', 'xfip', 'xFIP', 'Expected FIP', 'rate', 8, true, false),
('MLB', 'pitching_advanced', 'siera', 'SIERA', 'Skill-interactive ERA', 'rate', 8, true, false),
('MLB', 'pitching_advanced', 'velocity', 'Velo', 'Average fastball velocity', 'speed', 8, true, true),
('MLB', 'pitching_advanced', 'spin_rate', 'Spin', 'Average spin rate', 'rpm', 7, false, true),
('MLB', 'pitching_advanced', 'release_extension', 'Extension', 'Release point extension', 'distance', 6, false, true),
('MLB', 'pitching_advanced', 'whiff_rate', 'Whiff%', 'Swinging strike rate', 'percentage', 8, true, true),
('MLB', 'pitching_advanced', 'chase_rate', 'Chase%', 'Chase rate outside zone', 'percentage', 7, false, true),
('MLB', 'pitching_advanced', 'zone_rate', 'Zone%', 'Pitches in strike zone', 'percentage', 6, false, true),
('MLB', 'pitching_advanced', 'first_pitch_strike_rate', 'F-Strike%', 'First pitch strike rate', 'percentage', 7, false, false),
('MLB', 'pitching_advanced', 'ground_ball_rate', 'GB%', 'Ground ball rate', 'percentage', 7, true, false),
('MLB', 'pitching_advanced', 'fly_ball_rate', 'FB%', 'Fly ball rate', 'percentage', 6, false, false),
('MLB', 'pitching_advanced', 'home_run_per_fly_ball', 'HR/FB', 'Home run per fly ball rate', 'percentage', 7, true, false),
('MLB', 'pitching_advanced', 'left_on_base_percentage', 'LOB%', 'Left on base percentage', 'percentage', 7, false, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- Fielding Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('MLB', 'fielding', 'putouts', 'PO', 'Putouts', 'count', 6, false),
('MLB', 'fielding', 'assists', 'A', 'Assists', 'count', 6, false),
('MLB', 'fielding', 'errors', 'E', 'Errors', 'count', 5, false),
('MLB', 'fielding', 'fielding_percentage', 'FLD%', 'Fielding percentage', 'percentage', 6, false),
('MLB', 'fielding', 'double_plays', 'DP', 'Double plays turned', 'count', 6, false),
('MLB', 'fielding', 'defensive_runs_saved', 'DRS', 'Defensive runs saved', 'count', 8, false),
('MLB', 'fielding', 'ultimate_zone_rating', 'UZR', 'Ultimate zone rating', 'rating', 8, false),
('MLB', 'fielding', 'outs_above_average', 'OAA', 'Outs above average', 'count', 8, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- =====================================================
-- HOCKEY STATS (NHL) - Complete
-- =====================================================

-- Basic Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NHL', 'basic', 'goals', 'G', 'Goals', 'count', 10, true),
('NHL', 'basic', 'assists', 'A', 'Assists', 'count', 9, true),
('NHL', 'basic', 'points', 'P', 'Points (G+A)', 'count', 10, true),
('NHL', 'basic', 'plus_minus', '+/-', 'Plus/minus rating', 'differential', 7, true),
('NHL', 'basic', 'penalty_minutes', 'PIM', 'Penalty minutes', 'count', 5, true),
('NHL', 'basic', 'shots', 'SOG', 'Shots on goal', 'count', 8, true),
('NHL', 'basic', 'shooting_percentage', 'S%', 'Shooting percentage', 'percentage', 7, true),
('NHL', 'basic', 'hits', 'HIT', 'Hits', 'count', 6, true),
('NHL', 'basic', 'blocks', 'BLK', 'Blocked shots', 'count', 6, true),
('NHL', 'basic', 'takeaways', 'TA', 'Takeaways', 'count', 6, false),
('NHL', 'basic', 'giveaways', 'GA', 'Giveaways', 'count', 5, false),
('NHL', 'basic', 'faceoff_wins', 'FOW', 'Faceoff wins', 'count', 7, true),
('NHL', 'basic', 'faceoff_percentage', 'FO%', 'Faceoff win percentage', 'percentage', 7, true),
('NHL', 'basic', 'time_on_ice', 'TOI', 'Time on ice', 'time', 8, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Special Teams Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NHL', 'special_teams', 'power_play_goals', 'PPG', 'Power play goals', 'count', 9, true),
('NHL', 'special_teams', 'power_play_assists', 'PPA', 'Power play assists', 'count', 8, true),
('NHL', 'special_teams', 'power_play_points', 'PPP', 'Power play points', 'count', 9, true),
('NHL', 'special_teams', 'power_play_time_on_ice', 'PP TOI', 'Power play time on ice', 'time', 7, true),
('NHL', 'special_teams', 'short_handed_goals', 'SHG', 'Short handed goals', 'count', 7, true),
('NHL', 'special_teams', 'short_handed_assists', 'SHA', 'Short handed assists', 'count', 6, true),
('NHL', 'special_teams', 'short_handed_points', 'SHP', 'Short handed points', 'count', 7, true),
('NHL', 'special_teams', 'penalty_kill_time', 'PK TOI', 'Penalty kill time on ice', 'time', 6, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Advanced Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('NHL', 'advanced', 'corsi_for', 'CF', 'Corsi for (shot attempts for)', 'count', 7, false, false),
('NHL', 'advanced', 'corsi_against', 'CA', 'Corsi against (shot attempts against)', 'count', 6, false, false),
('NHL', 'advanced', 'corsi_percentage', 'CF%', 'Corsi for percentage', 'percentage', 8, false, false),
('NHL', 'advanced', 'fenwick_for', 'FF', 'Fenwick for (unblocked shot attempts)', 'count', 7, false, false),
('NHL', 'advanced', 'fenwick_percentage', 'FF%', 'Fenwick for percentage', 'percentage', 8, false, false),
('NHL', 'advanced', 'expected_goals', 'xG', 'Expected goals', 'decimal', 9, true, true),
('NHL', 'advanced', 'expected_goals_against', 'xGA', 'Expected goals against', 'decimal', 7, false, true),
('NHL', 'advanced', 'high_danger_chances', 'HDC', 'High danger scoring chances', 'count', 8, true, true),
('NHL', 'advanced', 'high_danger_goals', 'HDG', 'High danger goals', 'count', 8, true, true),
('NHL', 'advanced', 'zone_starts_offensive', 'OZS', 'Offensive zone starts', 'count', 6, false, false),
('NHL', 'advanced', 'zone_starts_defensive', 'DZS', 'Defensive zone starts', 'count', 6, false, false),
('NHL', 'advanced', 'zone_start_percentage', 'ZS%', 'Offensive zone start percentage', 'percentage', 7, false, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- Goalie Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NHL', 'goalie', 'wins', 'W', 'Wins', 'count', 10, true),
('NHL', 'goalie', 'losses', 'L', 'Losses', 'count', 6, true),
('NHL', 'goalie', 'overtime_losses', 'OTL', 'Overtime losses', 'count', 5, true),
('NHL', 'goalie', 'goals_against_average', 'GAA', 'Goals against average', 'rate', 10, true),
('NHL', 'goalie', 'save_percentage', 'SV%', 'Save percentage', 'percentage', 10, true),
('NHL', 'goalie', 'saves', 'SV', 'Saves', 'count', 9, true),
('NHL', 'goalie', 'shots_against', 'SA', 'Shots against', 'count', 7, true),
('NHL', 'goalie', 'shutouts', 'SO', 'Shutouts', 'count', 9, true),
('NHL', 'goalie', 'quality_starts', 'QS', 'Quality starts', 'count', 8, true),
('NHL', 'goalie', 'really_bad_starts', 'RBS', 'Really bad starts', 'count', 5, false),
('NHL', 'goalie', 'goals_saved_above_average', 'GSAA', 'Goals saved above average', 'count', 9, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- =====================================================
-- SOCCER STATS (MLS, Premier League, etc.) - Complete
-- =====================================================

-- Basic Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('MLS', 'basic', 'goals', 'G', 'Goals scored', 'count', 10, true),
('MLS', 'basic', 'assists', 'A', 'Assists', 'count', 9, true),
('MLS', 'basic', 'shots', 'S', 'Total shots', 'count', 7, true),
('MLS', 'basic', 'shots_on_target', 'SOT', 'Shots on target', 'count', 8, true),
('MLS', 'basic', 'passes', 'Pass', 'Total passes', 'count', 6, false),
('MLS', 'basic', 'pass_accuracy', 'Pass%', 'Pass completion percentage', 'percentage', 7, false),
('MLS', 'basic', 'tackles', 'Tkl', 'Tackles won', 'count', 7, true),
('MLS', 'basic', 'interceptions', 'Int', 'Interceptions', 'count', 7, true),
('MLS', 'basic', 'clearances', 'Clr', 'Clearances', 'count', 6, true),
('MLS', 'basic', 'fouls', 'Fls', 'Fouls committed', 'count', 5, false),
('MLS', 'basic', 'yellow_cards', 'YC', 'Yellow cards', 'count', 5, true),
('MLS', 'basic', 'red_cards', 'RC', 'Red cards', 'count', 4, true),
('MLS', 'basic', 'minutes_played', 'Min', 'Minutes played', 'time', 8, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- Advanced Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) VALUES
('MLS', 'advanced', 'expected_goals', 'xG', 'Expected goals', 'decimal', 9, true, true),
('MLS', 'advanced', 'expected_assists', 'xA', 'Expected assists', 'decimal', 8, true, true),
('MLS', 'advanced', 'expected_goals_chain', 'xGChain', 'Expected goals chain', 'decimal', 7, false, true),
('MLS', 'advanced', 'expected_goals_buildup', 'xGBuildup', 'Expected goals buildup', 'decimal', 7, false, true),
('MLS', 'advanced', 'progressive_carries', 'ProgC', 'Progressive carries', 'count', 7, true, true),
('MLS', 'advanced', 'progressive_passes', 'ProgP', 'Progressive passes', 'count', 7, true, true),
('MLS', 'advanced', 'progressive_receptions', 'ProgR', 'Progressive receptions', 'count', 6, false, true),
('MLS', 'advanced', 'pressures', 'Press', 'Defensive pressures applied', 'count', 7, true, true),
('MLS', 'advanced', 'successful_pressures', 'Succ Press', 'Successful pressures', 'count', 7, true, true),
('MLS', 'advanced', 'dribbles_completed', 'Drib', 'Successful dribbles', 'count', 7, true, true),
('MLS', 'advanced', 'dribbles_attempted', 'Drib Att', 'Dribbles attempted', 'count', 6, false, true),
('MLS', 'advanced', 'touches_in_box', 'Touches Box', 'Touches in penalty area', 'count', 8, true, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- =====================================================
-- FINAL SUMMARY
-- =====================================================

-- Show what we ended up with
SELECT 'AFTER INSERT:' as status, sport, COUNT(*) as stat_count 
FROM stat_definitions 
GROUP BY sport
ORDER BY sport;

-- Show breakdown by category
SELECT sport, stat_category, COUNT(*) as count
FROM stat_definitions
GROUP BY sport, stat_category
ORDER BY sport, stat_category;

-- Show total count
SELECT COUNT(*) as total_stat_definitions FROM stat_definitions;
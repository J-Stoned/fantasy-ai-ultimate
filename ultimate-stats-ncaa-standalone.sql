-- Standalone NCAA Stats Insert
-- This version doesn't depend on professional sports being present

-- =====================================================
-- NCAA BASKETBALL (NCAA_BB)
-- =====================================================

-- Basic NCAA Basketball Stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
-- Basic stats
('NCAA_BB', 'basic', 'points', 'Points', 'Total points scored', 'count', 10, true),
('NCAA_BB', 'basic', 'rebounds', 'Rebounds', 'Total rebounds', 'count', 8, true),
('NCAA_BB', 'basic', 'assists', 'Assists', 'Total assists', 'count', 8, true),
('NCAA_BB', 'basic', 'steals', 'Steals', 'Total steals', 'count', 7, true),
('NCAA_BB', 'basic', 'blocks', 'Blocks', 'Total blocks', 'count', 7, true),
('NCAA_BB', 'basic', 'turnovers', 'Turnovers', 'Total turnovers', 'count', 6, true),
('NCAA_BB', 'basic', 'fouls', 'Personal Fouls', 'Personal fouls committed', 'count', 4, false),
('NCAA_BB', 'basic', 'minutes', 'Minutes', 'Minutes played', 'time', 9, true),
('NCAA_BB', 'basic', 'field_goals_made', 'FGM', 'Field goals made', 'count', 8, true),
('NCAA_BB', 'basic', 'field_goals_attempted', 'FGA', 'Field goals attempted', 'count', 7, true),
('NCAA_BB', 'basic', 'three_pointers_made', '3PM', 'Three pointers made', 'count', 8, true),
('NCAA_BB', 'basic', 'three_pointers_attempted', '3PA', 'Three pointers attempted', 'count', 7, true),
('NCAA_BB', 'basic', 'free_throws_made', 'FTM', 'Free throws made', 'count', 7, true),
('NCAA_BB', 'basic', 'free_throws_attempted', 'FTA', 'Free throws attempted', 'count', 6, true),
-- Shooting stats
('NCAA_BB', 'shooting', 'field_goal_percentage', 'FG%', 'Field goal percentage', 'percentage', 9, true),
('NCAA_BB', 'shooting', 'three_point_percentage', '3P%', 'Three point percentage', 'percentage', 8, true),
('NCAA_BB', 'shooting', 'free_throw_percentage', 'FT%', 'Free throw percentage', 'percentage', 7, true),
('NCAA_BB', 'shooting', 'true_shooting_percentage', 'TS%', 'True shooting percentage', 'percentage', 10, true),
-- NCAA-specific
('NCAA_BB', 'ncaa_specific', 'strength_of_schedule', 'SOS', 'Strength of schedule rating', 'rating', 7, false),
('NCAA_BB', 'ncaa_specific', 'rpi_rank', 'RPI', 'Rating percentage index rank', 'rank', 6, false),
('NCAA_BB', 'ncaa_specific', 'net_ranking', 'NET', 'NCAA Evaluation Tool ranking', 'rank', 7, false),
('NCAA_BB', 'ncaa_specific', 'quad_1_wins', 'Q1 Wins', 'Quadrant 1 wins', 'count', 8, false),
('NCAA_BB', 'ncaa_specific', 'quad_1_losses', 'Q1 Losses', 'Quadrant 1 losses', 'count', 6, false),
('NCAA_BB', 'ncaa_specific', 'tournament_seed', 'Seed', 'Tournament seed', 'rank', 8, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- =====================================================
-- NCAA FOOTBALL (NCAA_FB)
-- =====================================================

INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
-- Passing
('NCAA_FB', 'passing', 'passing_yards', 'Pass Yards', 'Total passing yards', 'count', 10, true),
('NCAA_FB', 'passing', 'passing_touchdowns', 'Pass TDs', 'Passing touchdowns', 'count', 10, true),
('NCAA_FB', 'passing', 'passing_attempts', 'Attempts', 'Pass attempts', 'count', 7, true),
('NCAA_FB', 'passing', 'passing_completions', 'Completions', 'Completed passes', 'count', 8, true),
('NCAA_FB', 'passing', 'completion_percentage', 'Comp %', 'Completion percentage', 'percentage', 9, true),
('NCAA_FB', 'passing', 'interceptions', 'INTs', 'Interceptions thrown', 'count', 8, true),
('NCAA_FB', 'passing', 'passer_rating', 'Rating', 'Passer rating', 'rating', 9, true),
-- Rushing
('NCAA_FB', 'rushing', 'rushing_yards', 'Rush Yards', 'Total rushing yards', 'count', 10, true),
('NCAA_FB', 'rushing', 'rushing_touchdowns', 'Rush TDs', 'Rushing touchdowns', 'count', 10, true),
('NCAA_FB', 'rushing', 'rushing_attempts', 'Carries', 'Rushing attempts', 'count', 8, true),
('NCAA_FB', 'rushing', 'yards_per_carry', 'YPC', 'Yards per carry', 'rate', 8, true),
-- Receiving
('NCAA_FB', 'receiving', 'receptions', 'Rec', 'Receptions', 'count', 9, true),
('NCAA_FB', 'receiving', 'receiving_yards', 'Rec Yards', 'Receiving yards', 'count', 10, true),
('NCAA_FB', 'receiving', 'receiving_touchdowns', 'Rec TDs', 'Receiving touchdowns', 'count', 10, true),
('NCAA_FB', 'receiving', 'targets', 'Targets', 'Times targeted', 'count', 8, true),
-- Defense
('NCAA_FB', 'defense', 'tackles_total', 'Total', 'Total tackles', 'count', 9, true),
('NCAA_FB', 'defense', 'tackles_for_loss', 'TFL', 'Tackles for loss', 'count', 8, true),
('NCAA_FB', 'defense', 'sacks', 'Sacks', 'Quarterback sacks', 'count', 9, true),
('NCAA_FB', 'defense', 'interceptions', 'INTs', 'Interceptions', 'count', 9, true),
('NCAA_FB', 'defense', 'forced_fumbles', 'FF', 'Forced fumbles', 'count', 8, true),
('NCAA_FB', 'defense', 'fumble_recoveries', 'FR', 'Fumble recoveries', 'count', 8, true),
-- Special Teams
('NCAA_FB', 'special_teams', 'punt_return_yards', 'PR Yards', 'Punt return yards', 'count', 7, true),
('NCAA_FB', 'special_teams', 'punt_return_touchdowns', 'PR TDs', 'Punt return touchdowns', 'count', 8, true),
('NCAA_FB', 'special_teams', 'kick_return_yards', 'KR Yards', 'Kick return yards', 'count', 7, true),
('NCAA_FB', 'special_teams', 'kick_return_touchdowns', 'KR TDs', 'Kick return touchdowns', 'count', 8, true),
('NCAA_FB', 'special_teams', 'field_goals_made', 'FGM', 'Field goals made', 'count', 8, true),
('NCAA_FB', 'special_teams', 'field_goals_attempted', 'FGA', 'Field goals attempted', 'count', 6, true),
-- NCAA-specific
('NCAA_FB', 'ncaa_specific', 'cfp_ranking', 'CFP Rank', 'College Football Playoff ranking', 'rank', 8, false),
('NCAA_FB', 'ncaa_specific', 'ap_ranking', 'AP Rank', 'Associated Press ranking', 'rank', 8, false),
('NCAA_FB', 'ncaa_specific', 'strength_of_schedule', 'SOS', 'Strength of schedule rating', 'rating', 7, false),
-- Option offense
('NCAA_FB', 'option_offense', 'option_carries', 'Option Carries', 'Carries on option plays', 'count', 6, true),
('NCAA_FB', 'option_offense', 'option_yards', 'Option Yards', 'Yards on option plays', 'count', 7, true)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- =====================================================
-- NCAA BASEBALL (NCAA_BSB)
-- =====================================================

INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
-- Batting
('NCAA_BSB', 'batting', 'batting_average', 'AVG', 'Batting average', 'percentage', 9, true),
('NCAA_BSB', 'batting', 'home_runs', 'HR', 'Home runs', 'count', 10, true),
('NCAA_BSB', 'batting', 'runs_batted_in', 'RBI', 'Runs batted in', 'count', 10, true),
('NCAA_BSB', 'batting', 'runs', 'R', 'Runs scored', 'count', 9, true),
('NCAA_BSB', 'batting', 'hits', 'H', 'Hits', 'count', 9, true),
('NCAA_BSB', 'batting', 'stolen_bases', 'SB', 'Stolen bases', 'count', 9, true),
('NCAA_BSB', 'batting', 'on_base_percentage', 'OBP', 'On base percentage', 'percentage', 9, true),
('NCAA_BSB', 'batting', 'slugging_percentage', 'SLG', 'Slugging percentage', 'percentage', 9, true),
-- Pitching
('NCAA_BSB', 'pitching', 'wins', 'W', 'Wins', 'count', 8, true),
('NCAA_BSB', 'pitching', 'earned_run_average', 'ERA', 'Earned run average', 'rate', 10, true),
('NCAA_BSB', 'pitching', 'strikeouts', 'K', 'Strikeouts', 'count', 10, true),
('NCAA_BSB', 'pitching', 'whip', 'WHIP', 'Walks + hits per inning', 'rate', 9, true),
('NCAA_BSB', 'pitching', 'innings_pitched', 'IP', 'Innings pitched', 'count', 8, true),
-- NCAA-specific
('NCAA_BSB', 'ncaa_specific', 'rpi_rank', 'RPI', 'Rating percentage index rank', 'rank', 7, false),
('NCAA_BSB', 'ncaa_specific', 'cws_appearances', 'CWS', 'College World Series appearances', 'count', 8, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- =====================================================
-- NCAA HOCKEY (NCAA_HKY)
-- =====================================================

INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
-- Basic
('NCAA_HKY', 'basic', 'goals', 'G', 'Goals', 'count', 10, true),
('NCAA_HKY', 'basic', 'assists', 'A', 'Assists', 'count', 9, true),
('NCAA_HKY', 'basic', 'points', 'P', 'Points (G+A)', 'count', 10, true),
('NCAA_HKY', 'basic', 'plus_minus', '+/-', 'Plus/minus rating', 'differential', 7, true),
('NCAA_HKY', 'basic', 'penalty_minutes', 'PIM', 'Penalty minutes', 'count', 5, true),
('NCAA_HKY', 'basic', 'shots', 'SOG', 'Shots on goal', 'count', 8, true),
-- Goalie
('NCAA_HKY', 'goalie', 'wins', 'W', 'Wins', 'count', 10, true),
('NCAA_HKY', 'goalie', 'goals_against_average', 'GAA', 'Goals against average', 'rate', 10, true),
('NCAA_HKY', 'goalie', 'save_percentage', 'SV%', 'Save percentage', 'percentage', 10, true),
('NCAA_HKY', 'goalie', 'shutouts', 'SO', 'Shutouts', 'count', 9, true),
-- NCAA-specific
('NCAA_HKY', 'ncaa_specific', 'pairwise_ranking', 'PWR', 'PairWise Rankings', 'rank', 8, false),
('NCAA_HKY', 'ncaa_specific', 'frozen_four_appearances', 'Frozen Four', 'Frozen Four appearances', 'count', 8, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- =====================================================
-- NCAA SOCCER (NCAA_SOC)
-- =====================================================

INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
-- Basic
('NCAA_SOC', 'basic', 'goals', 'G', 'Goals scored', 'count', 10, true),
('NCAA_SOC', 'basic', 'assists', 'A', 'Assists', 'count', 9, true),
('NCAA_SOC', 'basic', 'shots', 'S', 'Total shots', 'count', 7, true),
('NCAA_SOC', 'basic', 'shots_on_target', 'SOT', 'Shots on target', 'count', 8, true),
('NCAA_SOC', 'basic', 'yellow_cards', 'YC', 'Yellow cards', 'count', 5, true),
('NCAA_SOC', 'basic', 'red_cards', 'RC', 'Red cards', 'count', 4, true),
-- NCAA-specific
('NCAA_SOC', 'ncaa_specific', 'rpi_rank', 'RPI', 'Rating percentage index rank', 'rank', 7, false),
('NCAA_SOC', 'ncaa_specific', 'college_cup_appearances', 'College Cup', 'College Cup appearances', 'count', 8, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- =====================================================
-- FINAL CHECK
-- =====================================================

-- Show what we added
SELECT 
  'NCAA Stats Added:' as status,
  sport, 
  COUNT(*) as stat_count 
FROM stat_definitions 
WHERE sport LIKE 'NCAA%'
GROUP BY sport
ORDER BY sport;

-- Grand total check
SELECT 
  'Total Stats After NCAA:' as status,
  COUNT(*) as total_stats
FROM stat_definitions;
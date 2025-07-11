-- NCAA Stats for Basketball and Football
-- This adds college-specific stats to complement the pro sports

-- =====================================================
-- NCAA BASKETBALL STATS (NCAA_BB)
-- =====================================================

-- Most NCAA basketball stats mirror NBA stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) 
SELECT 
  'NCAA_BB' as sport,
  stat_category,
  stat_name,
  display_name,
  description,
  unit,
  importance_score,
  fantasy_relevance
FROM stat_definitions
WHERE sport = 'NBA'
AND stat_category IN ('basic', 'shooting', 'advanced', 'situational', 'defense')
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- NCAA-specific basketball stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NCAA_BB', 'ncaa_specific', 'strength_of_schedule', 'SOS', 'Strength of schedule rating', 'rating', 7, false),
('NCAA_BB', 'ncaa_specific', 'rpi_rank', 'RPI', 'Rating percentage index rank', 'rank', 6, false),
('NCAA_BB', 'ncaa_specific', 'net_ranking', 'NET', 'NCAA Evaluation Tool ranking', 'rank', 7, false),
('NCAA_BB', 'ncaa_specific', 'quad_1_wins', 'Q1 Wins', 'Quadrant 1 wins', 'count', 8, false),
('NCAA_BB', 'ncaa_specific', 'quad_1_losses', 'Q1 Losses', 'Quadrant 1 losses', 'count', 6, false),
('NCAA_BB', 'ncaa_specific', 'conference_record', 'Conf Rec', 'Conference win-loss record', 'record', 7, false),
('NCAA_BB', 'ncaa_specific', 'tournament_seed', 'Seed', 'Tournament seed', 'rank', 8, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- =====================================================
-- NCAA FOOTBALL STATS (NCAA_FB)
-- =====================================================

-- Most NCAA football stats mirror NFL stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) 
SELECT 
  'NCAA_FB' as sport,
  stat_category,
  stat_name,
  display_name,
  description,
  unit,
  importance_score,
  fantasy_relevance,
  requires_tracking_data
FROM stat_definitions
WHERE sport = 'NFL'
AND stat_category IN ('passing', 'rushing', 'receiving', 'defense')
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- NCAA-specific football stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
-- Special Teams (more important in college)
('NCAA_FB', 'special_teams', 'punt_return_yards', 'PR Yards', 'Punt return yards', 'count', 7, true),
('NCAA_FB', 'special_teams', 'punt_return_touchdowns', 'PR TDs', 'Punt return touchdowns', 'count', 8, true),
('NCAA_FB', 'special_teams', 'kick_return_yards', 'KR Yards', 'Kick return yards', 'count', 7, true),
('NCAA_FB', 'special_teams', 'kick_return_touchdowns', 'KR TDs', 'Kick return touchdowns', 'count', 8, true),
('NCAA_FB', 'special_teams', 'field_goals_made', 'FGM', 'Field goals made', 'count', 8, true),
('NCAA_FB', 'special_teams', 'field_goals_attempted', 'FGA', 'Field goals attempted', 'count', 6, true),
('NCAA_FB', 'special_teams', 'field_goal_percentage', 'FG%', 'Field goal percentage', 'percentage', 7, true),
('NCAA_FB', 'special_teams', 'extra_points_made', 'XPM', 'Extra points made', 'count', 6, true),
('NCAA_FB', 'special_teams', 'punts', 'Punts', 'Number of punts', 'count', 5, false),
('NCAA_FB', 'special_teams', 'punt_average', 'Punt Avg', 'Average punt distance', 'distance', 6, false),

-- NCAA-specific metrics
('NCAA_FB', 'ncaa_specific', 'cfp_ranking', 'CFP Rank', 'College Football Playoff ranking', 'rank', 8, false),
('NCAA_FB', 'ncaa_specific', 'ap_ranking', 'AP Rank', 'Associated Press ranking', 'rank', 8, false),
('NCAA_FB', 'ncaa_specific', 'coaches_poll_ranking', 'Coaches Rank', 'Coaches Poll ranking', 'rank', 7, false),
('NCAA_FB', 'ncaa_specific', 'strength_of_schedule', 'SOS', 'Strength of schedule rating', 'rating', 7, false),
('NCAA_FB', 'ncaa_specific', 'fpi_rating', 'FPI', 'Football Power Index rating', 'rating', 7, false),
('NCAA_FB', 'ncaa_specific', 'sp_plus_rating', 'SP+', 'Bill Connelly SP+ rating', 'rating', 7, false),
('NCAA_FB', 'ncaa_specific', 'conference_wins', 'Conf Wins', 'Conference wins', 'count', 7, false),
('NCAA_FB', 'ncaa_specific', 'bowl_game_appearances', 'Bowl Apps', 'Bowl game appearances', 'count', 6, false),

-- Option/Triple Option specific stats (unique to college)
('NCAA_FB', 'option_offense', 'option_carries', 'Option Carries', 'Carries on option plays', 'count', 6, true),
('NCAA_FB', 'option_offense', 'option_yards', 'Option Yards', 'Yards on option plays', 'count', 7, true),
('NCAA_FB', 'option_offense', 'pitch_attempts', 'Pitches', 'Pitch attempts on option', 'count', 5, false),
('NCAA_FB', 'option_offense', 'keeper_yards', 'Keeper Yards', 'QB keeper yards', 'count', 7, true)
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

-- Most NCAA baseball stats mirror MLB stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) 
SELECT 
  'NCAA_BSB' as sport,
  stat_category,
  stat_name,
  display_name,
  description,
  unit,
  importance_score,
  fantasy_relevance,
  requires_tracking_data
FROM stat_definitions
WHERE sport = 'MLB'
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- NCAA-specific baseball stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NCAA_BSB', 'ncaa_specific', 'rpi_rank', 'RPI', 'Rating percentage index rank', 'rank', 7, false),
('NCAA_BSB', 'ncaa_specific', 'conference_record', 'Conf Rec', 'Conference win-loss record', 'record', 7, false),
('NCAA_BSB', 'ncaa_specific', 'regional_appearances', 'Regionals', 'Regional tournament appearances', 'count', 6, false),
('NCAA_BSB', 'ncaa_specific', 'cws_appearances', 'CWS', 'College World Series appearances', 'count', 8, false),
('NCAA_BSB', 'ncaa_specific', 'aluminum_bat_factor', 'BBCOR', 'Bat performance factor', 'rating', 5, false)
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

-- Most NCAA hockey stats mirror NHL stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) 
SELECT 
  'NCAA_HKY' as sport,
  stat_category,
  stat_name,
  display_name,
  description,
  unit,
  importance_score,
  fantasy_relevance,
  requires_tracking_data
FROM stat_definitions
WHERE sport = 'NHL'
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- NCAA-specific hockey stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NCAA_HKY', 'ncaa_specific', 'pairwise_ranking', 'PWR', 'PairWise Rankings', 'rank', 8, false),
('NCAA_HKY', 'ncaa_specific', 'conference_tournament_wins', 'Conf Tourney', 'Conference tournament wins', 'count', 7, false),
('NCAA_HKY', 'ncaa_specific', 'frozen_four_appearances', 'Frozen Four', 'Frozen Four appearances', 'count', 8, false),
('NCAA_HKY', 'ncaa_specific', 'hobey_baker_votes', 'Hobey Votes', 'Hobey Baker Award votes', 'count', 6, false)
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

-- Most NCAA soccer stats mirror MLS stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance, requires_tracking_data) 
SELECT 
  'NCAA_SOC' as sport,
  stat_category,
  stat_name,
  display_name,
  description,
  unit,
  importance_score,
  fantasy_relevance,
  requires_tracking_data
FROM stat_definitions
WHERE sport = 'MLS'
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance,
  requires_tracking_data = EXCLUDED.requires_tracking_data;

-- NCAA-specific soccer stats
INSERT INTO stat_definitions (sport, stat_category, stat_name, display_name, description, unit, importance_score, fantasy_relevance) VALUES
('NCAA_SOC', 'ncaa_specific', 'rpi_rank', 'RPI', 'Rating percentage index rank', 'rank', 7, false),
('NCAA_SOC', 'ncaa_specific', 'conference_championships', 'Conf Champs', 'Conference championships won', 'count', 7, false),
('NCAA_SOC', 'ncaa_specific', 'college_cup_appearances', 'College Cup', 'College Cup appearances', 'count', 8, false),
('NCAA_SOC', 'ncaa_specific', 'all_american_selections', 'All-American', 'All-American team selections', 'count', 7, false)
ON CONFLICT (sport, stat_name) DO UPDATE SET
  stat_category = EXCLUDED.stat_category,
  display_name = EXCLUDED.display_name,
  description = EXCLUDED.description,
  unit = EXCLUDED.unit,
  importance_score = EXCLUDED.importance_score,
  fantasy_relevance = EXCLUDED.fantasy_relevance;

-- =====================================================
-- FINAL SUMMARY INCLUDING NCAA
-- =====================================================

-- Show complete summary
SELECT sport, COUNT(*) as stat_count 
FROM stat_definitions 
GROUP BY sport
ORDER BY sport;

-- Show category breakdown
SELECT 
  CASE 
    WHEN sport LIKE 'NCAA%' THEN 'NCAA Sports'
    ELSE 'Professional Sports'
  END as league_type,
  sport,
  COUNT(*) as total_stats
FROM stat_definitions
GROUP BY league_type, sport
ORDER BY league_type, sport;

-- Grand total
SELECT 
  COUNT(*) as total_stat_definitions,
  COUNT(DISTINCT sport) as total_sports,
  COUNT(DISTINCT stat_category) as total_categories
FROM stat_definitions;
# Complete Micro-Analytics & Stats List for All Sports

## 🏀 Basketball (NBA, NCAA, WNBA)

### Basic Stats (Currently Capturing)
- points, rebounds, assists, steals, blocks, turnovers
- fg_made, fg_attempted, fg_percentage
- three_made, three_attempted, three_percentage  
- ft_made, ft_attempted, ft_percentage
- offensive_rebounds, defensive_rebounds
- fouls, minutes_played

### Advanced Metrics (Need to Add)
- **Shooting Zones**
  - points_in_paint
  - mid_range_made, mid_range_attempted
  - corner_three_made, corner_three_attempted
  - above_break_three_made, above_break_three_attempted
  - restricted_area_made, restricted_area_attempted
  
- **Hustle Stats**
  - deflections
  - loose_balls_recovered
  - charges_drawn
  - screen_assists
  - contested_shots
  - box_outs
  
- **Tracking Data**
  - distance_traveled
  - average_speed
  - touches
  - front_court_touches
  - time_of_possession
  - elbow_touches
  - post_touches
  - paint_touches
  
- **Play Types**
  - isolation_possessions, isolation_points
  - pick_roll_ball_handler_possessions, pick_roll_ball_handler_points
  - pick_roll_roll_man_possessions, pick_roll_roll_man_points
  - post_up_possessions, post_up_points
  - spot_up_possessions, spot_up_points
  - handoff_possessions, handoff_points
  - cut_possessions, cut_points
  - off_screen_possessions, off_screen_points
  - putback_possessions, putback_points
  - transition_possessions, transition_points
  
- **Defensive Metrics**
  - defensive_field_goals_attempted
  - defensive_field_goals_made
  - defensive_rating
  - contested_two_point_shots
  - contested_three_point_shots
  - blocks_recovered
  - opponent_points_off_turnovers
  
- **Clutch Stats** (last 5 min, margin ≤ 5)
  - clutch_points
  - clutch_fg_made, clutch_fg_attempted
  - clutch_plus_minus
  - clutch_turnovers
  
- **Advanced Calculations**
  - player_efficiency_rating (PER)
  - true_shooting_percentage
  - effective_field_goal_percentage
  - turnover_percentage
  - usage_percentage
  - assist_percentage
  - steal_percentage
  - block_percentage
  - offensive_rebound_percentage
  - defensive_rebound_percentage
  - box_plus_minus (BPM)
  - value_over_replacement_player (VORP)
  - player_impact_estimate (PIE)
  - net_rating

## 🏈 Football (NFL, NCAA)

### Passing Stats
- completions, attempts, yards, touchdowns, interceptions
- sacks_taken, sack_yards_lost
- times_hit
- longest_pass
- passes_20_plus, passes_40_plus
- rating, qbr
- air_yards_completed, air_yards_attempted
- yards_after_catch
- dropped_passes
- throw_aways
- spikes
- on_target_throws
- bad_throws
- pressure_percentage
- blitz_rate
- time_to_throw
- scrambles, scramble_yards

### Rushing Stats  
- carries, yards, touchdowns
- longest_rush
- yards_before_contact
- yards_after_contact
- broken_tackles
- runs_10_plus, runs_20_plus
- fumbles, fumbles_lost
- first_downs
- third_down_conversions
- red_zone_carries, red_zone_touchdowns
- goal_line_carries, goal_line_touchdowns
- stuffed_runs
- power_success_rate
- elusive_rating
- rush_attempts_inside_5, rush_attempts_inside_10

### Receiving Stats
- targets, receptions, yards, touchdowns
- drops, drop_percentage
- yards_after_catch
- air_yards
- longest_reception
- first_downs
- contested_catches
- broken_tackles
- red_zone_targets, red_zone_receptions
- average_separation
- catch_percentage
- target_share
- slot_receptions, slot_yards
- deep_targets, deep_receptions

### Defensive Stats
- tackles_solo, tackles_assist, tackles_total
- tackles_for_loss, tackle_yards_lost
- sacks, sack_yards
- quarterback_hits
- hurries, knockdowns
- forced_fumbles, fumble_recoveries
- interceptions, interception_yards, pick_sixes
- passes_defended
- targets_allowed, receptions_allowed
- yards_allowed, touchdowns_allowed
- passer_rating_allowed
- completion_percentage_allowed
- missed_tackles
- stops (plays that result in failure for offense)
- defensive_snaps
- coverage_snaps, pass_rush_snaps

### Special Teams
- field_goals_made, field_goals_attempted
- field_goal_percentage
- extra_points_made, extra_points_attempted
- field_goals_0_19, field_goals_20_29, field_goals_30_39, field_goals_40_49, field_goals_50_plus
- longest_field_goal
- punts, punt_yards, gross_punt_average
- punts_inside_20, touchbacks
- punt_return_yards, punt_return_touchdowns
- kick_return_yards, kick_return_touchdowns
- fair_catches
- blocked_kicks

### Advanced/Situational
- third_down_efficiency
- fourth_down_efficiency
- red_zone_efficiency
- two_minute_drill_stats
- time_of_possession
- plays_run
- penalties, penalty_yards
- expected_points_added (EPA)
- win_probability_added (WPA)
- completion_percentage_over_expected (CPOE)
- defense_adjusted_value_over_average (DVOA)
- success_rate

## ⚾ Baseball (MLB)

### Batting Stats
- at_bats, runs, hits, doubles, triples, home_runs, rbi
- walks, intentional_walks, strikeouts
- stolen_bases, caught_stealing
- hit_by_pitch, sacrifice_hits, sacrifice_flies
- ground_into_double_plays
- total_bases
- batting_average, on_base_percentage, slugging_percentage, ops
- left_on_base
- plate_appearances
- ground_balls, fly_balls, line_drives
- infield_hits
- bunt_singles
- reached_on_error

### Advanced Batting
- batting_average_on_balls_in_play (BABIP)
- isolated_power (ISO)
- weighted_on_base_average (wOBA)
- weighted_runs_created_plus (wRC+)
- wins_above_replacement (WAR)
- launch_angle_average
- exit_velocity_average
- hard_hit_percentage
- barrel_percentage
- sweet_spot_percentage
- chase_rate
- whiff_rate
- walk_rate, strikeout_rate
- expected_batting_average (xBA)
- expected_slugging (xSLG)
- expected_weighted_on_base_average (xwOBA)

### Pitching Stats
- innings_pitched, hits_allowed, runs_allowed, earned_runs
- walks_allowed, strikeouts, home_runs_allowed
- hit_batters, wild_pitches, balks
- wins, losses, saves, holds, blown_saves
- games_started, complete_games, shutouts
- quality_starts
- pitches_thrown, strikes_thrown
- balls, called_strikes, swinging_strikes
- foul_balls
- ground_balls_allowed, fly_balls_allowed, line_drives_allowed
- inherited_runners, inherited_runners_scored

### Advanced Pitching
- earned_run_average (ERA)
- walks_hits_per_inning_pitched (WHIP)
- fielding_independent_pitching (FIP)
- expected_fielding_independent_pitching (xFIP)
- skill_interactive_earned_run_average (SIERA)
- strikeouts_per_nine (K/9)
- walks_per_nine (BB/9)
- home_runs_per_nine (HR/9)
- strikeout_to_walk_ratio (K/BB)
- ground_ball_percentage
- fly_ball_percentage
- line_drive_percentage
- infield_fly_ball_percentage
- swinging_strike_percentage
- first_pitch_strike_percentage
- velocity_average, velocity_max
- spin_rate_average
- horizontal_break, vertical_break
- release_extension
- pitch_types (fastball%, curve%, slider%, changeup%, etc.)

### Fielding Stats
- putouts, assists, errors
- fielding_percentage
- double_plays_turned
- passed_balls (catchers)
- stolen_bases_allowed (catchers)
- caught_stealing_percentage (catchers)
- defensive_runs_saved (DRS)
- ultimate_zone_rating (UZR)
- outs_above_average (OAA)
- arm_strength (outfielders)
- range_rating

## 🏒 Hockey (NHL)

### Basic Stats
- goals, assists, points
- plus_minus
- penalty_minutes
- shots, shooting_percentage
- game_winning_goals
- power_play_goals, power_play_assists
- short_handed_goals, short_handed_assists
- overtime_goals
- empty_net_goals
- time_on_ice, shifts

### Advanced Stats
- corsi_for, corsi_against, corsi_percentage
- fenwick_for, fenwick_against, fenwick_percentage
- expected_goals_for (xGF), expected_goals_against (xGA)
- scoring_chances_for, scoring_chances_against
- high_danger_chances_for, high_danger_chances_against
- offensive_zone_starts, defensive_zone_starts, neutral_zone_starts
- zone_start_percentage
- faceoffs_won, faceoffs_lost, faceoff_percentage
- hits, blocks, takeaways, giveaways
- penalties_drawn, penalties_taken
- ice_time_even_strength, ice_time_power_play, ice_time_penalty_kill
- individual_corsi_for, individual_expected_goals
- primary_assists, secondary_assists
- rebounds_created, rush_attempts
- zone_entries, zone_exits
- controlled_entries, controlled_exits
- passes_completed, passes_attempted

### Goalie Stats
- wins, losses, overtime_losses
- saves, shots_against, save_percentage
- goals_against, goals_against_average
- shutouts
- even_strength_saves, power_play_saves, short_handed_saves
- quality_starts
- really_bad_starts
- goals_saved_above_average (GSAA)
- high_danger_save_percentage
- low_danger_save_percentage
- medium_danger_save_percentage
- rebound_control_percentage
- adjusted_goals_against_average

## ⚽ Soccer (MLS, EPL, International)

### Basic Stats
- goals, assists
- shots, shots_on_target
- passes_completed, passes_attempted, pass_accuracy
- key_passes, through_balls
- crosses_completed, crosses_attempted
- tackles_won, tackles_attempted
- interceptions, clearances, blocks
- fouls_committed, fouls_drawn
- yellow_cards, red_cards
- offsides
- minutes_played

### Advanced Stats
- expected_goals (xG), expected_assists (xA)
- non_penalty_expected_goals (npxG)
- expected_goals_chain (xGChain)
- expected_goals_buildup (xGBuildup)
- shot_creating_actions
- goal_creating_actions
- progressive_passes, progressive_carries
- passes_into_final_third
- passes_into_penalty_area
- crosses_into_penalty_area
- touches, touches_in_box
- take_ons_attempted, take_ons_succeeded
- times_tackled_in_possession
- dispossessed
- miscontrols
- ball_recoveries
- aerial_duels_won, aerial_duels_lost
- ground_duels_won, ground_duels_lost
- possession_won_final_third
- possession_won_middle_third
- possession_won_defensive_third

### Goalkeeper Stats
- saves, save_percentage
- goals_conceded
- clean_sheets
- penalties_saved, penalties_faced
- high_claims, catches, punches
- throws, goal_kicks
- average_distance_of_goal_kicks
- passes_launched, launched_pass_completion_rate
- sweeper_actions, average_distance_from_goal
- post_shot_expected_goals (PSxG)
- goals_prevented

### Team Context Stats
- team_possession_percentage_while_on_field
- team_pressing_success_rate
- team_build_up_disruption
- defensive_actions_per_game
- pressures_applied
- pressure_success_rate
- distance_covered
- sprints
- high_intensity_runs

## 🏐 Volleyball

- kills, kill_percentage
- attacks_attempted, attack_errors
- assists, assist_percentage
- service_aces, service_errors
- digs, dig_percentage
- blocks_solo, blocks_assist, total_blocks
- reception_errors, reception_percentage
- points_scored

## 🎾 Tennis

- aces, double_faults
- first_serve_percentage
- first_serve_points_won
- second_serve_points_won
- break_points_saved
- service_games_won
- return_points_won
- return_games_won
- total_points_won
- winners, unforced_errors
- net_points_won
- fastest_serve_speed
- average_first_serve_speed
- average_second_serve_speed

## 🏎️ Racing (F1, NASCAR)

- starting_position, finishing_position
- laps_completed, laps_led
- fastest_lap, fastest_lap_time
- pit_stops, average_pit_stop_time
- positions_gained_lost
- average_running_position
- driver_rating
- overtakes_completed
- times_overtaken
- safety_car_periods
- dnf_reason (if applicable)

## 🥊 Boxing/MMA

- punches_thrown, punches_landed
- punch_accuracy_percentage
- significant_strikes_landed
- significant_strikes_attempted
- head_strikes, body_strikes, leg_strikes
- takedowns_attempted, takedowns_landed
- takedown_accuracy
- submission_attempts
- guard_passes
- reversals
- knockdowns
- control_time
- distance_strikes, clinch_strikes, ground_strikes

## 🏌️ Golf

- strokes, score_to_par
- fairways_hit, fairways_percentage
- greens_in_regulation, gir_percentage
- putts_per_round
- putts_per_gir
- scrambling_percentage
- sand_save_percentage
- driving_distance_average
- driving_accuracy
- approach_shot_proximity
- strokes_gained_total
- strokes_gained_tee_to_green
- strokes_gained_putting
- strokes_gained_around_green
- strokes_gained_approach
- eagles, birdies, pars, bogeys, double_bogeys_or_worse
- front_nine_score, back_nine_score
- par_3_scoring, par_4_scoring, par_5_scoring

## Universal Metrics (All Sports)

- fantasy_points (calculated per platform rules)
- fantasy_points_per_minute
- game_score (sport-specific calculation)
- player_impact_rating
- consistency_score (std dev across games)
- clutch_performance_rating
- home_vs_away_differential
- rest_days_impact
- matchup_history_score
- trend_score (last 5 games)
- season_percentile_rank
- positional_rank
- usage_or_involvement_rate
- efficiency_rating
- durability_score
- momentum_score
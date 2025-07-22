/**
 * 📊 COMPREHENSIVE STATS MAPPING FOR ALL SPORTS
 * 
 * This file defines EVERY stat we need to capture from APIs
 * to ensure we're not missing ANY data for fantasy calculations
 */

// MLB BATTING STATS
export const MLB_BATTING_STATS = {
  // Basic stats
  games: 'G',
  at_bats: 'AB',
  runs: 'R',
  hits: 'H',
  doubles: '2B',
  triples: '3B',
  home_runs: 'HR',
  rbi: 'RBI',
  walks: 'BB',
  strikeouts: 'K',
  stolen_bases: 'SB',
  caught_stealing: 'CS',
  
  // Advanced stats
  batting_average: 'AVG',
  on_base_percentage: 'OBP',
  slugging: 'SLG',
  ops: 'OPS',
  total_bases: 'TB',
  hit_by_pitch: 'HBP',
  sacrifice_flies: 'SF',
  sacrifice_hits: 'SH',
  intentional_walks: 'IBB',
  ground_into_double_play: 'GIDP',
  
  // Fantasy-relevant
  multi_hit_games: 'multi_hit',
  batting_order: 'batting_order',
  plate_appearances: 'PA'
};

// MLB PITCHING STATS
export const MLB_PITCHING_STATS = {
  // Basic stats
  wins: 'W',
  losses: 'L',
  saves: 'SV',
  holds: 'HLD',
  blown_saves: 'BS',
  innings_pitched: 'IP',
  hits_allowed: 'H',
  runs_allowed: 'R',
  earned_runs: 'ER',
  home_runs_allowed: 'HR',
  walks_allowed: 'BB',
  strikeouts: 'K',
  
  // Advanced stats
  era: 'ERA',
  whip: 'WHIP',
  pitches_thrown: 'pitches',
  strikes_thrown: 'strikes',
  balls_thrown: 'balls',
  batters_faced: 'BF',
  
  // Fantasy-relevant
  quality_starts: 'QS',
  complete_games: 'CG',
  shutouts: 'SHO',
  no_hitters: 'NH',
  perfect_games: 'PG',
  ground_ball_rate: 'GB%',
  fly_ball_rate: 'FB%'
};

// NFL PASSING STATS
export const NFL_PASSING_STATS = {
  completions: 'completions',
  attempts: 'attempts',
  passing_yards: 'passing_yards',
  passing_touchdowns: 'passing_touchdowns',
  interceptions: 'interceptions',
  sacks_taken: 'sacks_taken',
  sack_yards: 'sack_yards',
  completion_percentage: 'completion_percentage',
  yards_per_attempt: 'yards_per_attempt',
  passer_rating: 'passer_rating',
  qbr: 'qbr',
  longest_pass: 'longest_pass',
  passes_20_plus: 'passes_20_plus',
  passes_40_plus: 'passes_40_plus'
};

// NFL RUSHING STATS
export const NFL_RUSHING_STATS = {
  rushing_attempts: 'rushing_attempts',
  rushing_yards: 'rushing_yards',
  rushing_touchdowns: 'rushing_touchdowns',
  yards_per_carry: 'yards_per_carry',
  longest_rush: 'longest_rush',
  rushes_10_plus: 'rushes_10_plus',
  rushes_20_plus: 'rushes_20_plus',
  fumbles: 'fumbles',
  fumbles_lost: 'fumbles_lost',
  first_downs: 'first_downs'
};

// NFL RECEIVING STATS
export const NFL_RECEIVING_STATS = {
  targets: 'targets',
  receptions: 'receptions',
  receiving_yards: 'receiving_yards',
  receiving_touchdowns: 'receiving_touchdowns',
  yards_per_reception: 'yards_per_reception',
  longest_reception: 'longest_reception',
  receptions_20_plus: 'receptions_20_plus',
  receptions_40_plus: 'receptions_40_plus',
  yards_after_catch: 'yards_after_catch',
  catch_percentage: 'catch_percentage',
  drops: 'drops'
};

// NFL DEFENSIVE STATS
export const NFL_DEFENSIVE_STATS = {
  tackles: 'tackles',
  solo_tackles: 'solo_tackles',
  tackle_assists: 'tackle_assists',
  sacks: 'sacks',
  tackles_for_loss: 'tackles_for_loss',
  quarterback_hits: 'quarterback_hits',
  passes_defended: 'passes_defended',
  interceptions: 'interceptions',
  interception_return_yards: 'interception_return_yards',
  interception_touchdowns: 'interception_touchdowns',
  forced_fumbles: 'forced_fumbles',
  fumble_recoveries: 'fumble_recoveries',
  fumble_return_touchdowns: 'fumble_return_touchdowns',
  safeties: 'safeties'
};

// NFL KICKING STATS
export const NFL_KICKING_STATS = {
  field_goal_attempts: 'field_goal_attempts',
  field_goals_made: 'field_goals_made',
  field_goal_percentage: 'field_goal_percentage',
  extra_point_attempts: 'extra_point_attempts',
  extra_points_made: 'extra_points_made',
  field_goals_0_19: 'field_goals_0_19',
  field_goals_20_29: 'field_goals_20_29',
  field_goals_30_39: 'field_goals_30_39',
  field_goals_40_49: 'field_goals_40_49',
  field_goals_50_plus: 'field_goals_50_plus',
  longest_field_goal: 'longest_field_goal'
};

// NBA STATS
export const NBA_STATS = {
  // Basic stats
  minutes: 'minutes',
  points: 'points',
  rebounds: 'rebounds',
  offensive_rebounds: 'offensive_rebounds',
  defensive_rebounds: 'defensive_rebounds',
  assists: 'assists',
  steals: 'steals',
  blocks: 'blocks',
  turnovers: 'turnovers',
  personal_fouls: 'personal_fouls',
  
  // Shooting stats
  field_goals_made: 'field_goals_made',
  field_goals_attempted: 'field_goals_attempted',
  field_goal_percentage: 'field_goal_percentage',
  three_pointers_made: 'three_pointers_made',
  three_pointers_attempted: 'three_pointers_attempted',
  three_point_percentage: 'three_point_percentage',
  free_throws_made: 'free_throws_made',
  free_throws_attempted: 'free_throws_attempted',
  free_throw_percentage: 'free_throw_percentage',
  
  // Advanced stats
  plus_minus: 'plus_minus',
  true_shooting_percentage: 'true_shooting_percentage',
  effective_field_goal_percentage: 'effective_field_goal_percentage',
  player_efficiency_rating: 'player_efficiency_rating',
  usage_rate: 'usage_rate',
  
  // Fantasy-relevant
  double_doubles: 'double_doubles',
  triple_doubles: 'triple_doubles',
  technical_fouls: 'technical_fouls',
  flagrant_fouls: 'flagrant_fouls'
};

// NHL SKATER STATS
export const NHL_SKATER_STATS = {
  // Basic stats
  goals: 'goals',
  assists: 'assists',
  points: 'points',
  plus_minus: 'plus_minus',
  penalty_minutes: 'penalty_minutes',
  shots: 'shots',
  shooting_percentage: 'shooting_percentage',
  
  // Ice time
  time_on_ice: 'time_on_ice',
  power_play_time_on_ice: 'power_play_time_on_ice',
  short_handed_time_on_ice: 'short_handed_time_on_ice',
  even_strength_time_on_ice: 'even_strength_time_on_ice',
  
  // Special teams
  power_play_goals: 'power_play_goals',
  power_play_assists: 'power_play_assists',
  power_play_points: 'power_play_points',
  short_handed_goals: 'short_handed_goals',
  short_handed_assists: 'short_handed_assists',
  short_handed_points: 'short_handed_points',
  
  // Other stats
  game_winning_goals: 'game_winning_goals',
  overtime_goals: 'overtime_goals',
  hits: 'hits',
  blocked_shots: 'blocked_shots',
  faceoff_wins: 'faceoff_wins',
  faceoff_losses: 'faceoff_losses',
  faceoff_percentage: 'faceoff_percentage',
  takeaways: 'takeaways',
  giveaways: 'giveaways'
};

// NHL GOALIE STATS
export const NHL_GOALIE_STATS = {
  // Basic stats
  wins: 'wins',
  losses: 'losses',
  overtime_losses: 'overtime_losses',
  saves: 'saves',
  shots_against: 'shots_against',
  goals_against: 'goals_against',
  save_percentage: 'save_percentage',
  goals_against_average: 'goals_against_average',
  
  // Game stats
  shutouts: 'shutouts',
  minutes_played: 'minutes_played',
  games_started: 'games_started',
  
  // Situational saves
  even_strength_saves: 'even_strength_saves',
  power_play_saves: 'power_play_saves',
  short_handed_saves: 'short_handed_saves',
  penalty_shot_saves: 'penalty_shot_saves',
  
  // Quality stats
  quality_starts: 'quality_starts',
  quality_start_percentage: 'quality_start_percentage',
  really_bad_starts: 'really_bad_starts',
  goals_saved_above_average: 'goals_saved_above_average'
};

// NCAA FOOTBALL STATS (similar to NFL but with some differences)
export const NCAA_FOOTBALL_STATS = {
  // Combine NFL stats but add
  punt_return_yards: 'punt_return_yards',
  punt_return_touchdowns: 'punt_return_touchdowns',
  kickoff_return_yards: 'kickoff_return_yards',
  kickoff_return_touchdowns: 'kickoff_return_touchdowns',
  all_purpose_yards: 'all_purpose_yards'
};

// NCAA BASKETBALL STATS (similar to NBA)
export const NCAA_BASKETBALL_STATS = {
  ...NBA_STATS,
  // Additional NCAA-specific
  games_started: 'games_started',
  disqualifications: 'disqualifications'
};

// MINOR LEAGUE BASEBALL STATS (same as MLB)
export const MILB_BATTING_STATS = MLB_BATTING_STATS;
export const MILB_PITCHING_STATS = MLB_PITCHING_STATS;

/**
 * FANTASY PLATFORM SCORING SYSTEMS
 * These define how each platform calculates fantasy points
 */

export const DRAFTKINGS_SCORING = {
  // MLB Batting
  mlb_batting: {
    single: 3,
    double: 5,
    triple: 8,
    home_run: 10,
    rbi: 2,
    run: 2,
    walk: 2,
    hit_by_pitch: 2,
    stolen_base: 5,
    caught_stealing: -2
  },
  
  // MLB Pitching
  mlb_pitching: {
    win: 4,
    earned_run: -2,
    strikeout: 2,
    innings_pitched: 2.25,
    hit: -0.6,
    walk: -0.6,
    hit_by_pitch: -0.6,
    complete_game: 2.5,
    complete_game_shutout: 2.5,
    no_hitter: 5
  },
  
  // NFL
  nfl: {
    passing_yard: 0.04,
    passing_touchdown: 4,
    interception: -1,
    rushing_yard: 0.1,
    rushing_touchdown: 6,
    reception: 1, // PPR
    receiving_yard: 0.1,
    receiving_touchdown: 6,
    return_touchdown: 6,
    fumble_lost: -1,
    two_point_conversion: 2
  },
  
  // NBA
  nba: {
    point: 1,
    three_pointer: 0.5,
    rebound: 1.25,
    assist: 1.5,
    steal: 2,
    block: 2,
    turnover: -0.5,
    double_double: 1.5,
    triple_double: 3
  },
  
  // NHL
  nhl: {
    goal: 3,
    assist: 2,
    shot: 0.5,
    blocked_shot: 0.5,
    short_handed_point: 1,
    shootout_goal: 0.2,
    hat_trick: 1.5,
    win: 3,
    save: 0.2,
    goal_against: -1,
    shutout: 2,
    overtime_loss: 1
  }
};

export const FANDUEL_SCORING = {
  // Similar structure but different values
  mlb_batting: {
    single: 3,
    double: 6,
    triple: 9,
    home_run: 12,
    rbi: 3.5,
    run: 3.2,
    walk: 3,
    hit_by_pitch: 3,
    stolen_base: 6,
    caught_stealing: -2
  }
  // ... etc for other sports
};

/**
 * STAT PARSER FUNCTIONS
 * These will parse API responses and extract ALL relevant stats
 */

export function parseMLBBattingStats(apiResponse: any): any {
  const stats = {};
  
  // Map API fields to our standard fields
  // This will vary based on which API we're using (ESPN vs MLB Stats API)
  
  // Example for MLB Stats API
  if (apiResponse.stats) {
    Object.keys(MLB_BATTING_STATS).forEach(key => {
      const apiKey = MLB_BATTING_STATS[key];
      stats[key] = apiResponse.stats[apiKey] || 0;
    });
  }
  
  return stats;
}

export function parseNFLStats(apiResponse: any, position: string): any {
  const stats = {};
  
  // Different positions have different stats
  if (position === 'QB') {
    Object.assign(stats, parseNFLPassingStats(apiResponse));
    Object.assign(stats, parseNFLRushingStats(apiResponse));
  } else if (position === 'RB') {
    Object.assign(stats, parseNFLRushingStats(apiResponse));
    Object.assign(stats, parseNFLReceivingStats(apiResponse));
  } else if (position === 'WR' || position === 'TE') {
    Object.assign(stats, parseNFLReceivingStats(apiResponse));
  } else if (position === 'K') {
    Object.assign(stats, parseNFLKickingStats(apiResponse));
  } else if (['LB', 'DB', 'DL'].includes(position)) {
    Object.assign(stats, parseNFLDefensiveStats(apiResponse));
  }
  
  return stats;
}

// Additional parsing functions for each sport/stat type...
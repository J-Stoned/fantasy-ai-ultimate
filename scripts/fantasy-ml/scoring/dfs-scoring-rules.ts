/**
 * 🎯 DFS SCORING RULES DATABASE
 * 
 * Comprehensive scoring rules for all major DFS platforms
 * Supporting NFL, NBA, MLB, NHL across DraftKings, FanDuel, and Yahoo
 * 
 * This is the foundation of our 10X scoring engine!
 */

export interface ScoringRule {
  stat: string;
  points: number;
  bonusThreshold?: number;
  bonusPoints?: number;
  isBonus?: boolean; // Flag to identify bonus-only rules
}

export interface PlatformScoring {
  [position: string]: ScoringRule[];
}

export interface SportScoring {
  draftkings: PlatformScoring;
  fanduel: PlatformScoring;
  yahoo: PlatformScoring;
  espn: PlatformScoring;
  cbs: PlatformScoring;
  sleeper: PlatformScoring;
}

/**
 * 🏈 NFL SCORING RULES
 */
export const NFL_SCORING: SportScoring = {
  draftkings: {
    QB: [
      { stat: 'passing_yards', points: 0.04 },  // 1 point per 25 yards
      { stat: 'passing_touchdowns', points: 4 },
      { stat: 'interceptions', points: -1 },
      { stat: 'rushing_yards', points: 0.1 },   // 1 point per 10 yards
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -1 },
      { stat: 'passing_yards', points: 0, bonusThreshold: 300, bonusPoints: 3, isBonus: true }, // 300+ yard bonus
      { stat: 'rushing_yards', points: 0, bonusThreshold: 100, bonusPoints: 3, isBonus: true }, // 100+ yard bonus
    ],
    RB: [
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'receptions', points: 1 },         // PPR
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -1 },
      { stat: 'rushing_yards', points: 0, bonusThreshold: 100, bonusPoints: 3, isBonus: true },
      { stat: 'receiving_yards', points: 0, bonusThreshold: 100, bonusPoints: 3, isBonus: true },
    ],
    WR: [
      { stat: 'receptions', points: 1 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -1 },
      { stat: 'receiving_yards', points: 0, bonusThreshold: 100, bonusPoints: 3, isBonus: true },
    ],
    TE: [
      { stat: 'receptions', points: 1 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -1 },
      { stat: 'receiving_yards', points: 0, bonusThreshold: 100, bonusPoints: 3, isBonus: true },
    ],
    DST: [
      { stat: 'sacks', points: 1 },
      { stat: 'interceptions', points: 2 },
      { stat: 'fumbles_recovered', points: 2 },
      { stat: 'defensive_touchdowns', points: 6 },
      { stat: 'safeties', points: 2 },
      { stat: 'blocked_kicks', points: 2 },
      // Points allowed bonuses (calculated separately)
      { stat: 'points_allowed_0', points: 10 },
      { stat: 'points_allowed_1_6', points: 7 },
      { stat: 'points_allowed_7_13', points: 4 },
      { stat: 'points_allowed_14_20', points: 1 },
      { stat: 'points_allowed_21_27', points: 0 },
      { stat: 'points_allowed_28_34', points: -1 },
      { stat: 'points_allowed_35_plus', points: -4 },
    ],
    K: [
      { stat: 'field_goals_made_0_39', points: 3 },
      { stat: 'field_goals_made_40_49', points: 4 },
      { stat: 'field_goals_made_50_plus', points: 5 },
      { stat: 'extra_points_made', points: 1 },
      { stat: 'field_goals_missed', points: -1 },
    ],
  },
  fanduel: {
    QB: [
      { stat: 'passing_yards', points: 0.04 },
      { stat: 'passing_touchdowns', points: 4 },
      { stat: 'interceptions', points: -1 },
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },      // FD is -2 for fumbles
    ],
    RB: [
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'receptions', points: 0.5 },       // Half PPR on FanDuel
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
    ],
    WR: [
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
    ],
    TE: [
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
    ],
    DST: [
      { stat: 'sacks', points: 1 },
      { stat: 'interceptions', points: 2 },
      { stat: 'fumbles_recovered', points: 2 },
      { stat: 'defensive_touchdowns', points: 6 },
      { stat: 'safeties', points: 2 },
      { stat: 'blocked_kicks', points: 2 },
      // Similar points allowed structure
    ],
    K: [
      { stat: 'field_goals_made_0_39', points: 3 },
      { stat: 'field_goals_made_40_49', points: 4 },
      { stat: 'field_goals_made_50_plus', points: 5 },
      { stat: 'extra_points_made', points: 1 },
    ],
  },
  yahoo: {
    // Yahoo uses similar scoring to FanDuel (half PPR)
    QB: [
      { stat: 'passing_yards', points: 0.04 },
      { stat: 'passing_touchdowns', points: 4 },
      { stat: 'interceptions', points: -1 },
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
    ],
    RB: [
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
    ],
    WR: [
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
    ],
    TE: [
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
    ],
    DST: [
      { stat: 'sacks', points: 1 },
      { stat: 'interceptions', points: 2 },
      { stat: 'fumbles_recovered', points: 2 },
      { stat: 'defensive_touchdowns', points: 6 },
      { stat: 'safeties', points: 2 },
    ],
    K: [
      { stat: 'field_goals_made_0_39', points: 3 },
      { stat: 'field_goals_made_40_49', points: 4 },
      { stat: 'field_goals_made_50_plus', points: 5 },
      { stat: 'extra_points_made', points: 1 },
    ],
  },
  espn: {
    // ESPN uses standard scoring with half-PPR
    QB: [
      { stat: 'passing_yards', points: 0.04 },
      { stat: 'passing_touchdowns', points: 4 },
      { stat: 'interceptions', points: -2 },
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
      { stat: 'passing_2pt_conversions', points: 2 },
      { stat: 'rushing_2pt_conversions', points: 2 },
    ],
    RB: [
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
      { stat: 'rushing_2pt_conversions', points: 2 },
      { stat: 'receiving_2pt_conversions', points: 2 },
    ],
    WR: [
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
      { stat: 'receiving_2pt_conversions', points: 2 },
      { stat: 'rushing_2pt_conversions', points: 2 },
    ],
    TE: [
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
      { stat: 'receiving_2pt_conversions', points: 2 },
    ],
    DST: [
      { stat: 'sacks', points: 1 },
      { stat: 'interceptions', points: 2 },
      { stat: 'fumbles_recovered', points: 2 },
      { stat: 'defensive_touchdowns', points: 6 },
      { stat: 'safeties', points: 2 },
      { stat: 'blocked_kicks', points: 2 },
      { stat: 'points_allowed_0', points: 10 },
      { stat: 'points_allowed_1_6', points: 7 },
      { stat: 'points_allowed_7_13', points: 4 },
      { stat: 'points_allowed_14_20', points: 1 },
      { stat: 'points_allowed_21_27', points: 0 },
      { stat: 'points_allowed_28_34', points: -1 },
      { stat: 'points_allowed_35_plus', points: -4 },
    ],
    K: [
      { stat: 'field_goals_made_0_39', points: 3 },
      { stat: 'field_goals_made_40_49', points: 4 },
      { stat: 'field_goals_made_50_plus', points: 5 },
      { stat: 'extra_points_made', points: 1 },
      { stat: 'field_goals_missed', points: -1 },
    ],
  },
  cbs: {
    // CBS uses standard scoring similar to ESPN
    QB: [
      { stat: 'passing_yards', points: 0.04 },
      { stat: 'passing_touchdowns', points: 4 },
      { stat: 'interceptions', points: -2 },
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
      { stat: 'passing_2pt_conversions', points: 2 },
    ],
    RB: [
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
      { stat: 'rushing_2pt_conversions', points: 2 },
    ],
    WR: [
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
      { stat: 'receiving_2pt_conversions', points: 2 },
    ],
    TE: [
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
      { stat: 'receiving_2pt_conversions', points: 2 },
    ],
    DST: [
      { stat: 'sacks', points: 1 },
      { stat: 'interceptions', points: 2 },
      { stat: 'fumbles_recovered', points: 2 },
      { stat: 'defensive_touchdowns', points: 6 },
      { stat: 'safeties', points: 2 },
      { stat: 'blocked_kicks', points: 2 },
      { stat: 'points_allowed_0', points: 10 },
      { stat: 'points_allowed_1_6', points: 7 },
      { stat: 'points_allowed_7_13', points: 4 },
      { stat: 'points_allowed_14_20', points: 1 },
      { stat: 'points_allowed_21_27', points: 0 },
      { stat: 'points_allowed_28_34', points: -1 },
      { stat: 'points_allowed_35_plus', points: -4 },
    ],
    K: [
      { stat: 'field_goals_made_0_39', points: 3 },
      { stat: 'field_goals_made_40_49', points: 4 },
      { stat: 'field_goals_made_50_plus', points: 5 },
      { stat: 'extra_points_made', points: 1 },
      { stat: 'field_goals_missed', points: -1 },
    ],
  },
  sleeper: {
    // Sleeper uses half-PPR by default, similar to Yahoo
    QB: [
      { stat: 'passing_yards', points: 0.04 },
      { stat: 'passing_touchdowns', points: 4 },
      { stat: 'interceptions', points: -1 },
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
    ],
    RB: [
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
    ],
    WR: [
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'rushing_yards', points: 0.1 },
      { stat: 'rushing_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
    ],
    TE: [
      { stat: 'receptions', points: 0.5 },
      { stat: 'receiving_yards', points: 0.1 },
      { stat: 'receiving_touchdowns', points: 6 },
      { stat: 'fumbles_lost', points: -2 },
    ],
    DST: [
      { stat: 'sacks', points: 1 },
      { stat: 'interceptions', points: 2 },
      { stat: 'fumbles_recovered', points: 2 },
      { stat: 'defensive_touchdowns', points: 6 },
      { stat: 'safeties', points: 2 },
      { stat: 'blocked_kicks', points: 2 },
      { stat: 'points_allowed_0', points: 10 },
      { stat: 'points_allowed_1_6', points: 7 },
      { stat: 'points_allowed_7_13', points: 4 },
      { stat: 'points_allowed_14_20', points: 1 },
      { stat: 'points_allowed_21_27', points: 0 },
      { stat: 'points_allowed_28_34', points: -1 },
      { stat: 'points_allowed_35_plus', points: -4 },
    ],
    K: [
      { stat: 'field_goals_made_0_39', points: 3 },
      { stat: 'field_goals_made_40_49', points: 4 },
      { stat: 'field_goals_made_50_plus', points: 5 },
      { stat: 'extra_points_made', points: 1 },
    ],
  },
};

/**
 * 🏀 NBA SCORING RULES
 */
export const NBA_SCORING: SportScoring = {
  draftkings: {
    ALL: [  // All positions use same scoring in NBA
      { stat: 'points', points: 1 },
      { stat: 'rebounds', points: 1.25 },
      { stat: 'assists', points: 1.5 },
      { stat: 'steals', points: 2 },
      { stat: 'blocks', points: 2 },
      { stat: 'turnovers', points: -0.5 },
      // Bonuses
      { stat: 'double_double', points: 1.5 },    // 10+ in two categories
      { stat: 'triple_double', points: 3 },       // 10+ in three categories
    ],
  },
  fanduel: {
    ALL: [
      { stat: 'points', points: 1 },
      { stat: 'rebounds', points: 1.2 },
      { stat: 'assists', points: 1.5 },
      { stat: 'steals', points: 3 },              // Higher on FD
      { stat: 'blocks', points: 3 },              // Higher on FD
      { stat: 'turnovers', points: -1 },          // Harsher on FD
    ],
  },
  yahoo: {
    ALL: [
      { stat: 'points', points: 1 },
      { stat: 'rebounds', points: 1.2 },
      { stat: 'assists', points: 1.5 },
      { stat: 'steals', points: 3 },
      { stat: 'blocks', points: 3 },
      { stat: 'turnovers', points: -1 },
    ],
  },
  espn: {
    ALL: [
      { stat: 'points', points: 1 },
      { stat: 'rebounds', points: 1.25 },
      { stat: 'assists', points: 1.5 },
      { stat: 'steals', points: 3 },
      { stat: 'blocks', points: 3 },
      { stat: 'turnovers', points: -1 },
      { stat: 'field_goals_made', points: 0 },
      { stat: 'field_goals_missed', points: -0.5 },
      { stat: 'free_throws_made', points: 0 },
      { stat: 'free_throws_missed', points: -0.5 },
    ],
  },
  cbs: {
    ALL: [
      { stat: 'points', points: 1 },
      { stat: 'rebounds', points: 1.25 },
      { stat: 'assists', points: 1.5 },
      { stat: 'steals', points: 2 },
      { stat: 'blocks', points: 2 },
      { stat: 'turnovers', points: -1 },
    ],
  },
  sleeper: {
    ALL: [
      { stat: 'points', points: 1 },
      { stat: 'rebounds', points: 1.2 },
      { stat: 'assists', points: 1.5 },
      { stat: 'steals', points: 3 },
      { stat: 'blocks', points: 3 },
      { stat: 'turnovers', points: -1 },
      { stat: 'three_pointers_made', points: 0.5 },
    ],
  },
};

/**
 * ⚾ MLB SCORING RULES
 */
export const MLB_SCORING: SportScoring = {
  draftkings: {
    HITTER: [
      { stat: 'singles', points: 3 },
      { stat: 'doubles', points: 5 },
      { stat: 'triples', points: 8 },
      { stat: 'home_runs', points: 10 },
      { stat: 'rbis', points: 2 },
      { stat: 'runs', points: 2 },
      { stat: 'walks', points: 2 },
      { stat: 'hit_by_pitch', points: 2 },
      { stat: 'stolen_bases', points: 5 },
      { stat: 'caught_stealing', points: -2 },
    ],
    PITCHER: [
      { stat: 'wins', points: 4 },
      { stat: 'earned_runs', points: -2 },
      { stat: 'innings_pitched', points: 2.25 }, // Per full inning
      { stat: 'strikeouts', points: 2 },
      { stat: 'hits_allowed', points: -0.6 },
      { stat: 'walks_allowed', points: -0.6 },
      { stat: 'hit_batters', points: -0.6 },
      { stat: 'complete_games', points: 2.5 },
      { stat: 'complete_game_shutouts', points: 2.5 },
      { stat: 'no_hitters', points: 5 },
    ],
  },
  fanduel: {
    HITTER: [
      { stat: 'singles', points: 3 },
      { stat: 'doubles', points: 6 },
      { stat: 'triples', points: 9 },
      { stat: 'home_runs', points: 12 },
      { stat: 'rbis', points: 3.5 },
      { stat: 'runs', points: 3.2 },
      { stat: 'walks', points: 3 },
      { stat: 'hit_by_pitch', points: 3 },
      { stat: 'stolen_bases', points: 6 },
      { stat: 'caught_stealing', points: -2 },
    ],
    PITCHER: [
      { stat: 'wins', points: 6 },
      { stat: 'quality_starts', points: 4 },
      { stat: 'earned_runs', points: -3 },
      { stat: 'innings_pitched', points: 3 },
      { stat: 'strikeouts', points: 3 },
      { stat: 'hits_allowed', points: -0.6 },
      { stat: 'walks_allowed', points: -0.6 },
      { stat: 'hit_batters', points: -0.6 },
    ],
  },
  yahoo: {
    HITTER: [
      { stat: 'singles', points: 2.5 },
      { stat: 'doubles', points: 5 },
      { stat: 'triples', points: 7.5 },
      { stat: 'home_runs', points: 10 },
      { stat: 'rbis', points: 2 },
      { stat: 'runs', points: 2 },
      { stat: 'walks', points: 2 },
      { stat: 'hit_by_pitch', points: 2 },
      { stat: 'stolen_bases', points: 4.2 },
      { stat: 'caught_stealing', points: -2 },
    ],
    PITCHER: [
      { stat: 'wins', points: 5 },
      { stat: 'losses', points: -5 },
      { stat: 'earned_runs', points: -2 },
      { stat: 'innings_pitched', points: 3 },
      { stat: 'strikeouts', points: 2 },
      { stat: 'hits_allowed', points: -1 },
      { stat: 'walks_allowed', points: -1 },
      { stat: 'hit_batters', points: -1 },
    ],
  },
  espn: {
    HITTER: [
      { stat: 'singles', points: 1 },
      { stat: 'doubles', points: 2 },
      { stat: 'triples', points: 3 },
      { stat: 'home_runs', points: 4 },
      { stat: 'rbis', points: 1 },
      { stat: 'runs', points: 1 },
      { stat: 'walks', points: 1 },
      { stat: 'hit_by_pitch', points: 1 },
      { stat: 'stolen_bases', points: 1 },
      { stat: 'caught_stealing', points: -1 },
    ],
    PITCHER: [
      { stat: 'wins', points: 5 },
      { stat: 'losses', points: -5 },
      { stat: 'saves', points: 5 },
      { stat: 'innings_pitched', points: 3 },
      { stat: 'strikeouts', points: 1 },
      { stat: 'hits_allowed', points: -1 },
      { stat: 'earned_runs', points: -2 },
      { stat: 'walks_allowed', points: -1 },
      { stat: 'home_runs_allowed', points: -2 },
    ],
  },
  cbs: {
    HITTER: [
      { stat: 'singles', points: 1 },
      { stat: 'doubles', points: 2 },
      { stat: 'triples', points: 3 },
      { stat: 'home_runs', points: 4 },
      { stat: 'rbis', points: 1 },
      { stat: 'runs', points: 1 },
      { stat: 'walks', points: 1 },
      { stat: 'hit_by_pitch', points: 1 },
      { stat: 'stolen_bases', points: 2 },
      { stat: 'caught_stealing', points: -1 },
    ],
    PITCHER: [
      { stat: 'wins', points: 5 },
      { stat: 'losses', points: -5 },
      { stat: 'saves', points: 5 },
      { stat: 'quality_starts', points: 3 },
      { stat: 'innings_pitched', points: 1 },
      { stat: 'strikeouts', points: 0.5 },
      { stat: 'earned_runs', points: -1 },
      { stat: 'walks_allowed', points: -0.5 },
      { stat: 'hits_allowed', points: -0.5 },
    ],
  },
  sleeper: {
    HITTER: [
      { stat: 'singles', points: 2.8 },
      { stat: 'doubles', points: 5.6 },
      { stat: 'triples', points: 8.4 },
      { stat: 'home_runs', points: 11.2 },
      { stat: 'rbis', points: 2 },
      { stat: 'runs', points: 2 },
      { stat: 'walks', points: 2 },
      { stat: 'hit_by_pitch', points: 2 },
      { stat: 'stolen_bases', points: 5 },
      { stat: 'caught_stealing', points: -1 },
    ],
    PITCHER: [
      { stat: 'wins', points: 4 },
      { stat: 'losses', points: -2 },
      { stat: 'saves', points: 6 },
      { stat: 'innings_pitched', points: 3 },
      { stat: 'strikeouts', points: 2 },
      { stat: 'earned_runs', points: -2 },
      { stat: 'hits_allowed', points: -0.6 },
      { stat: 'walks_allowed', points: -0.6 },
      { stat: 'hit_batters', points: -0.6 },
    ],
  },
};

/**
 * 🏒 NHL SCORING RULES
 */
export const NHL_SCORING: SportScoring = {
  draftkings: {
    SKATER: [
      { stat: 'goals', points: 3 },
      { stat: 'assists', points: 2 },
      { stat: 'shots', points: 0.5 },
      { stat: 'blocked_shots', points: 0.5 },
      { stat: 'shorthanded_points', points: 1 }, // Goals + assists while shorthanded
      { stat: 'shootout_goals', points: 0.2 },
      { stat: 'hat_trick', points: 1.5 },       // 3+ goals bonus
    ],
    GOALIE: [
      { stat: 'wins', points: 3 },
      { stat: 'saves', points: 0.2 },
      { stat: 'goals_against', points: -1 },
      { stat: 'shutouts', points: 2 },
      { stat: 'overtime_loss', points: 1 },
    ],
  },
  fanduel: {
    SKATER: [
      { stat: 'goals', points: 12 },            // Much higher on FD
      { stat: 'assists', points: 8 },           // Much higher on FD
      { stat: 'shots', points: 1.6 },
      { stat: 'blocked_shots', points: 1.6 },
      { stat: 'powerplay_points', points: 0.5 },
      { stat: 'shorthanded_goals', points: 2 },
      { stat: 'shorthanded_assists', points: 2 },
    ],
    GOALIE: [
      { stat: 'wins', points: 12 },
      { stat: 'saves', points: 0.6 },
      { stat: 'goals_against', points: -3 },
      { stat: 'shutouts', points: 8 },
    ],
  },
  yahoo: {
    SKATER: [
      { stat: 'goals', points: 6 },
      { stat: 'assists', points: 4 },
      { stat: 'plus_minus', points: 2 },        // Yahoo includes +/-
      { stat: 'penalty_minutes', points: 0.5 },
      { stat: 'powerplay_points', points: 0.5 },
      { stat: 'shorthanded_goals', points: 2 },
      { stat: 'game_winning_goals', points: 2 },
      { stat: 'shots', points: 0.9 },
      { stat: 'hits', points: 0.5 },
      { stat: 'blocked_shots', points: 1 },
    ],
    GOALIE: [
      { stat: 'wins', points: 5 },
      { stat: 'losses', points: -5 },
      { stat: 'saves', points: 0.2 },
      { stat: 'goals_against', points: -1 },
      { stat: 'shutouts', points: 5 },
    ],
  },
  espn: {
    SKATER: [
      { stat: 'goals', points: 6 },
      { stat: 'assists', points: 4 },
      { stat: 'shots', points: 0.9 },
      { stat: 'blocked_shots', points: 1 },
      { stat: 'plus_minus', points: 2 },
      { stat: 'powerplay_points', points: 0.5 },
      { stat: 'shorthanded_goals', points: 2 },
      { stat: 'penalty_minutes', points: 0.5 },
      { stat: 'hits', points: 0.5 },
    ],
    GOALIE: [
      { stat: 'wins', points: 5 },
      { stat: 'saves', points: 0.2 },
      { stat: 'goals_against', points: -1 },
      { stat: 'shutouts', points: 5 },
      { stat: 'overtime_wins', points: 1 },
    ],
  },
  cbs: {
    SKATER: [
      { stat: 'goals', points: 3 },
      { stat: 'assists', points: 2 },
      { stat: 'shots', points: 0.5 },
      { stat: 'blocked_shots', points: 0.5 },
      { stat: 'plus_minus', points: 1 },
      { stat: 'powerplay_goals', points: 1 },
      { stat: 'powerplay_assists', points: 0.5 },
      { stat: 'shorthanded_goals', points: 2 },
      { stat: 'shorthanded_assists', points: 1 },
    ],
    GOALIE: [
      { stat: 'wins', points: 4 },
      { stat: 'saves', points: 0.15 },
      { stat: 'goals_against', points: -1 },
      { stat: 'shutouts', points: 3 },
    ],
  },
  sleeper: {
    SKATER: [
      { stat: 'goals', points: 6 },
      { stat: 'assists', points: 4 },
      { stat: 'shots', points: 0.9 },
      { stat: 'blocked_shots', points: 1.5 },
      { stat: 'hits', points: 0.3 },
      { stat: 'powerplay_points', points: 0.5 },
      { stat: 'shorthanded_points', points: 1 },
      { stat: 'faceoff_wins', points: 0.1 },
      { stat: 'faceoff_losses', points: -0.1 },
    ],
    GOALIE: [
      { stat: 'wins', points: 5 },
      { stat: 'saves', points: 0.2 },
      { stat: 'goals_against', points: -1 },
      { stat: 'shutouts', points: 5 },
      { stat: 'shots_against', points: 0.1 },
    ],
  },
};

/**
 * 🎯 HELPER FUNCTIONS
 */
export function getScoringRules(
  sport: 'NFL' | 'NBA' | 'MLB' | 'NHL',
  platform: 'draftkings' | 'fanduel' | 'yahoo' | 'espn' | 'cbs' | 'sleeper',
  position: string
): ScoringRule[] {
  const sportRules = {
    NFL: NFL_SCORING,
    NBA: NBA_SCORING,
    MLB: MLB_SCORING,
    NHL: NHL_SCORING,
  }[sport];

  const platformRules = sportRules[platform];
  
  // Handle position mapping
  let rules: ScoringRule[] = [];
  
  if (sport === 'NBA') {
    // NBA uses same scoring for all positions
    rules = platformRules.ALL;
  } else if (sport === 'MLB') {
    // MLB has hitters vs pitchers
    const isHitter = !['P', 'SP', 'RP'].includes(position);
    rules = platformRules[isHitter ? 'HITTER' : 'PITCHER'];
  } else if (sport === 'NHL') {
    // NHL has skaters vs goalies
    const isGoalie = position === 'G';
    rules = platformRules[isGoalie ? 'GOALIE' : 'SKATER'];
  } else {
    // NFL has position-specific scoring
    rules = platformRules[position] || [];
  }
  
  return rules;
}

/**
 * 🔧 POSITION NORMALIZATION
 */
export function normalizePosition(position: string, sport: string): string {
  // Clean up position strings and map to standard positions
  const cleaned = position.toUpperCase().trim();
  
  if (sport === 'NFL') {
    // Map various NFL positions to standard ones
    if (['LB', 'MLB', 'ILB', 'OLB'].includes(cleaned)) return 'LB';
    if (['S', 'SS', 'FS', 'CB', 'DB'].includes(cleaned)) return 'DB';
    if (['DE', 'DT', 'NT', 'DL'].includes(cleaned)) return 'DL';
    if (['OL', 'OT', 'OG', 'C'].includes(cleaned)) return 'OL';
    // For fantasy purposes, we need main positions
    if (['QB', 'RB', 'WR', 'TE'].includes(cleaned)) return cleaned;
    if (['K', 'PK'].includes(cleaned)) return 'K'; // PK = Placekicker = Kicker
    if (['DST', 'DEF'].includes(cleaned)) return 'DST';
    return 'FLEX'; // Generic flex position
  }
  
  if (sport === 'NBA') {
    if (['PG', 'SG', 'G'].includes(cleaned)) return 'G';
    if (['SF', 'PF', 'F'].includes(cleaned)) return 'F';
    if (cleaned === 'C') return 'C';
    return 'UTIL'; // Utility position
  }
  
  if (sport === 'MLB') {
    if (['SP', 'RP', 'P'].includes(cleaned)) return 'P';
    if (['C', '1B', '2B', '3B', 'SS'].includes(cleaned)) return cleaned;
    if (['LF', 'CF', 'RF', 'OF'].includes(cleaned)) return 'OF';
    if (cleaned === 'DH') return 'DH';
    return 'UTIL';
  }
  
  if (sport === 'NHL') {
    if (['C', 'LW', 'RW', 'W', 'F'].includes(cleaned)) return 'F';
    if (cleaned === 'D') return 'D';
    if (cleaned === 'G') return 'G';
    return 'UTIL';
  }
  
  return cleaned;
}
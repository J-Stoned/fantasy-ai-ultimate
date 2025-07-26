/**
 * 🏈 NFL STATS ADAPTER
 * Elite developer NFL-specific data extraction and processing
 * 
 * Handles extraction of NFL stats from JSON fields in player_game_stats
 * Maps to DFS scoring (DraftKings, FanDuel, Yahoo, ESPN, CBS, Sleeper)
 * Provides position-specific stat breakdowns
 */

export interface NFLRawStats {
  passing_yards?: number;
  passing_tds?: number;
  passing_ints?: number;
  passing_attempts?: number;
  passing_completions?: number;
  passing_completion_percentage?: number;
  
  rushing_yards?: number;
  rushing_tds?: number;
  rushing_attempts?: number;
  rushing_yards_per_attempt?: number;
  
  receiving_yards?: number;
  receiving_tds?: number;
  receptions?: number;
  targets?: number;
  receiving_yards_per_reception?: number;
  catch_percentage?: number;
  
  fumbles?: number;
  fumbles_lost?: number;
  
  // Defense/Special Teams
  defensive_interceptions?: number;
  fumble_recoveries?: number;
  sacks?: number;
  defensive_tds?: number;
  kick_return_tds?: number;
  punt_return_tds?: number;
  
  // Kicking
  field_goals_made?: number;
  field_goals_attempted?: number;
  extra_points_made?: number;
  extra_points_attempted?: number;
  
  // Game context
  game_script?: 'positive' | 'negative' | 'neutral';
  red_zone_targets?: number;
  red_zone_carries?: number;
  snap_percentage?: number;
}

export interface NFLProcessedStats extends NFLRawStats {
  // Calculated fields
  fantasy_points_calculated?: number;
  dk_points_calculated?: number;
  fd_points_calculated?: number;
  yahoo_points_calculated?: number;
  
  // Advanced metrics
  air_yards?: number;
  yards_after_catch?: number;
  target_share?: number;
  carry_share?: number;
  goal_line_carries?: number;
  
  // Efficiency metrics
  yards_per_target?: number;
  yards_per_carry?: number;
  touchdown_rate?: number;
  
  // Position-specific breakdowns
  position_rank?: number;
  position_percentile?: number;
}

class NFLStatsAdapter {
  /**
   * Extract NFL stats from raw JSON data
   */
  extractStats(rawStats: any): NFLRawStats {
    if (!rawStats) return {};

    return {
      // Passing stats
      passing_yards: this.safeNumber(rawStats.passing_yards),
      passing_tds: this.safeNumber(rawStats.passing_tds) || this.safeNumber(rawStats.passing_touchdowns),
      passing_ints: this.safeNumber(rawStats.passing_ints) || this.safeNumber(rawStats.interceptions),
      passing_attempts: this.safeNumber(rawStats.passing_attempts) || this.safeNumber(rawStats.pass_attempts),
      passing_completions: this.safeNumber(rawStats.passing_completions) || this.safeNumber(rawStats.completions),
      passing_completion_percentage: this.safeNumber(rawStats.passing_completion_percentage) || this.safeNumber(rawStats.completion_percentage),
      
      // Rushing stats
      rushing_yards: this.safeNumber(rawStats.rushing_yards),
      rushing_tds: this.safeNumber(rawStats.rushing_tds) || this.safeNumber(rawStats.rushing_touchdowns),
      rushing_attempts: this.safeNumber(rawStats.rushing_attempts) || this.safeNumber(rawStats.carries),
      rushing_yards_per_attempt: this.safeNumber(rawStats.rushing_yards_per_attempt) || this.safeNumber(rawStats.yards_per_carry),
      
      // Receiving stats
      receiving_yards: this.safeNumber(rawStats.receiving_yards),
      receiving_tds: this.safeNumber(rawStats.receiving_tds) || this.safeNumber(rawStats.receiving_touchdowns),
      receptions: this.safeNumber(rawStats.receptions) || this.safeNumber(rawStats.catches),
      targets: this.safeNumber(rawStats.targets),
      receiving_yards_per_reception: this.safeNumber(rawStats.receiving_yards_per_reception) || this.safeNumber(rawStats.yards_per_reception),
      catch_percentage: this.safeNumber(rawStats.catch_percentage),
      
      // Turnovers
      fumbles: this.safeNumber(rawStats.fumbles),
      fumbles_lost: this.safeNumber(rawStats.fumbles_lost),
      
      // Defense/Special Teams
      defensive_interceptions: this.safeNumber(rawStats.defensive_interceptions) || this.safeNumber(rawStats.def_ints),
      fumble_recoveries: this.safeNumber(rawStats.fumble_recoveries) || this.safeNumber(rawStats.fumble_rec),
      sacks: this.safeNumber(rawStats.sacks),
      defensive_tds: this.safeNumber(rawStats.defensive_tds) || this.safeNumber(rawStats.def_tds),
      kick_return_tds: this.safeNumber(rawStats.kick_return_tds) || this.safeNumber(rawStats.kr_tds),
      punt_return_tds: this.safeNumber(rawStats.punt_return_tds) || this.safeNumber(rawStats.pr_tds),
      
      // Kicking
      field_goals_made: this.safeNumber(rawStats.field_goals_made) || this.safeNumber(rawStats.fg_made),
      field_goals_attempted: this.safeNumber(rawStats.field_goals_attempted) || this.safeNumber(rawStats.fg_att),
      extra_points_made: this.safeNumber(rawStats.extra_points_made) || this.safeNumber(rawStats.xp_made),
      extra_points_attempted: this.safeNumber(rawStats.extra_points_attempted) || this.safeNumber(rawStats.xp_att),
      
      // Context
      red_zone_targets: this.safeNumber(rawStats.red_zone_targets) || this.safeNumber(rawStats.rz_targets),
      red_zone_carries: this.safeNumber(rawStats.red_zone_carries) || this.safeNumber(rawStats.rz_carries),
      snap_percentage: this.safeNumber(rawStats.snap_percentage) || this.safeNumber(rawStats.snap_pct),
    };
  }

  /**
   * Process extracted stats with calculated fields and advanced metrics
   */
  processStats(stats: NFLRawStats, position?: string): NFLProcessedStats {
    const processed: NFLProcessedStats = { ...stats };

    // Calculate fantasy points using standard scoring
    processed.fantasy_points_calculated = this.calculateStandardFantasyPoints(stats);
    processed.dk_points_calculated = this.calculateDraftKingsPoints(stats);
    processed.fd_points_calculated = this.calculateFanDuelPoints(stats);
    processed.yahoo_points_calculated = this.calculateYahooPoints(stats);

    // Calculate derived metrics
    if (stats.targets && stats.receptions) {
      processed.catch_percentage = Math.round((stats.receptions / stats.targets) * 100);
    }

    if (stats.receiving_yards && stats.targets) {
      processed.yards_per_target = Number((stats.receiving_yards / stats.targets).toFixed(1));
    }

    if (stats.receiving_yards && stats.receptions) {
      processed.yards_per_carry = Number((stats.receiving_yards / stats.receptions).toFixed(1));
    }

    if (stats.rushing_yards && stats.rushing_attempts) {
      processed.yards_per_carry = Number((stats.rushing_yards / stats.rushing_attempts).toFixed(1));
    }

    // Position-specific processing
    if (position) {
      processed.position_rank = this.calculatePositionRank(stats, position);
      processed.position_percentile = this.calculatePositionPercentile(stats, position);
    }

    return processed;
  }

  /**
   * Calculate standard fantasy points (PPR)
   */
  private calculateStandardFantasyPoints(stats: NFLRawStats): number {
    let points = 0;

    // Passing
    if (stats.passing_yards) points += stats.passing_yards * 0.04; // 1 point per 25 yards
    if (stats.passing_tds) points += stats.passing_tds * 4; // 4 points per TD
    if (stats.passing_ints) points -= stats.passing_ints * 2; // -2 points per INT

    // Rushing
    if (stats.rushing_yards) points += stats.rushing_yards * 0.1; // 1 point per 10 yards
    if (stats.rushing_tds) points += stats.rushing_tds * 6; // 6 points per TD

    // Receiving
    if (stats.receiving_yards) points += stats.receiving_yards * 0.1; // 1 point per 10 yards
    if (stats.receiving_tds) points += stats.receiving_tds * 6; // 6 points per TD
    if (stats.receptions) points += stats.receptions * 1; // 1 point per reception (PPR)

    // Turnovers
    if (stats.fumbles_lost) points -= stats.fumbles_lost * 2; // -2 points per fumble lost

    return Math.round(points * 100) / 100; // Round to 2 decimal places
  }

  /**
   * Calculate DraftKings fantasy points
   */
  private calculateDraftKingsPoints(stats: NFLRawStats): number {
    let points = 0;

    // Passing (DK scoring)
    if (stats.passing_yards) points += stats.passing_yards * 0.04; // 1 point per 25 yards
    if (stats.passing_tds) points += stats.passing_tds * 4; // 4 points per TD
    if (stats.passing_ints) points -= stats.passing_ints * 1; // -1 point per INT (DK is less harsh)

    // Rushing
    if (stats.rushing_yards) points += stats.rushing_yards * 0.1; // 1 point per 10 yards
    if (stats.rushing_tds) points += stats.rushing_tds * 6; // 6 points per TD

    // Receiving
    if (stats.receiving_yards) points += stats.receiving_yards * 0.1; // 1 point per 10 yards
    if (stats.receiving_tds) points += stats.receiving_tds * 6; // 6 points per TD
    if (stats.receptions) points += stats.receptions * 1; // 1 point per reception

    // Turnovers
    if (stats.fumbles_lost) points -= stats.fumbles_lost * 1; // -1 point per fumble lost (DK is less harsh)

    // Bonuses (DK specific)
    if (stats.passing_yards && stats.passing_yards >= 300) points += 3; // 300+ yard bonus
    if (stats.rushing_yards && stats.rushing_yards >= 100) points += 3; // 100+ yard bonus
    if (stats.receiving_yards && stats.receiving_yards >= 100) points += 3; // 100+ yard bonus

    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate FanDuel fantasy points
   */
  private calculateFanDuelPoints(stats: NFLRawStats): number {
    let points = 0;

    // Passing (FD scoring)
    if (stats.passing_yards) points += stats.passing_yards * 0.04; // 1 point per 25 yards
    if (stats.passing_tds) points += stats.passing_tds * 4; // 4 points per TD
    if (stats.passing_ints) points -= stats.passing_ints * 2; // -2 points per INT

    // Rushing
    if (stats.rushing_yards) points += stats.rushing_yards * 0.1; // 1 point per 10 yards
    if (stats.rushing_tds) points += stats.rushing_tds * 6; // 6 points per TD

    // Receiving (FD is 0.5 PPR)
    if (stats.receiving_yards) points += stats.receiving_yards * 0.1; // 1 point per 10 yards
    if (stats.receiving_tds) points += stats.receiving_tds * 6; // 6 points per TD
    if (stats.receptions) points += stats.receptions * 0.5; // 0.5 points per reception

    // Turnovers
    if (stats.fumbles_lost) points -= stats.fumbles_lost * 2; // -2 points per fumble lost

    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate Yahoo fantasy points
   */
  private calculateYahooPoints(stats: NFLRawStats): number {
    // Yahoo uses standard scoring similar to our base calculation
    return this.calculateStandardFantasyPoints(stats);
  }

  /**
   * Get position-specific stats breakdown
   */
  getPositionStats(stats: NFLProcessedStats, position: string): any {
    switch (position.toUpperCase()) {
      case 'QB':
        return {
          primary_stats: {
            passing_yards: stats.passing_yards,
            passing_tds: stats.passing_tds,
            passing_ints: stats.passing_ints,
            completion_percentage: stats.passing_completion_percentage
          },
          secondary_stats: {
            rushing_yards: stats.rushing_yards,
            rushing_tds: stats.rushing_tds
          },
          efficiency: {
            yards_per_attempt: stats.passing_yards && stats.passing_attempts ? 
              (stats.passing_yards / stats.passing_attempts).toFixed(1) : null
          }
        };

      case 'RB':
        return {
          primary_stats: {
            rushing_yards: stats.rushing_yards,
            rushing_tds: stats.rushing_tds,
            rushing_attempts: stats.rushing_attempts,
            yards_per_carry: stats.yards_per_carry
          },
          secondary_stats: {
            receptions: stats.receptions,
            receiving_yards: stats.receiving_yards,
            receiving_tds: stats.receiving_tds,
            targets: stats.targets
          }
        };

      case 'WR':
      case 'TE':
        return {
          primary_stats: {
            receptions: stats.receptions,
            receiving_yards: stats.receiving_yards,
            receiving_tds: stats.receiving_tds,
            targets: stats.targets
          },
          efficiency: {
            yards_per_reception: stats.receiving_yards_per_reception,
            catch_percentage: stats.catch_percentage,
            yards_per_target: stats.yards_per_target
          }
        };

      default:
        return {
          all_stats: stats
        };
    }
  }

  /**
   * Calculate position rank (simplified - would need league data for accuracy)
   */
  private calculatePositionRank(stats: NFLRawStats, position: string): number {
    // This is a simplified calculation - in production you'd compare against all players
    const fantasyPoints = this.calculateStandardFantasyPoints(stats);
    
    // Rough position tiers based on weekly performance
    const positionTiers = {
      'QB': [30, 25, 20, 15, 10], // Top tier, QB1, QB2, etc.
      'RB': [25, 20, 15, 12, 8],
      'WR': [22, 18, 14, 10, 6],
      'TE': [18, 15, 12, 8, 4]
    };

    const tiers = positionTiers[position as keyof typeof positionTiers];
    if (!tiers) return 999;

    for (let i = 0; i < tiers.length; i++) {
      if (fantasyPoints >= tiers[i]) {
        return i + 1;
      }
    }

    return tiers.length + 1;
  }

  /**
   * Calculate position percentile (simplified)
   */
  private calculatePositionPercentile(stats: NFLRawStats, position: string): number {
    const rank = this.calculatePositionRank(stats, position);
    // Convert rank to percentile (simplified)
    return Math.max(0, Math.min(100, 100 - (rank - 1) * 5));
  }

  /**
   * Safely convert value to number
   */
  private safeNumber(value: any): number | undefined {
    if (value === null || value === undefined || value === '') return undefined;
    const num = Number(value);
    return isNaN(num) ? undefined : num;
  }

  /**
   * Get DFS platform scoring rules
   */
  getDFSScoringRules() {
    return {
      DraftKings: {
        passing_yards: 0.04,
        passing_tds: 4,
        passing_ints: -1,
        rushing_yards: 0.1,
        rushing_tds: 6,
        receiving_yards: 0.1,
        receiving_tds: 6,
        receptions: 1,
        fumbles_lost: -1,
        bonuses: {
          passing_300_yards: 3,
          rushing_100_yards: 3,
          receiving_100_yards: 3
        }
      },
      FanDuel: {
        passing_yards: 0.04,
        passing_tds: 4,
        passing_ints: -2,
        rushing_yards: 0.1,
        rushing_tds: 6,
        receiving_yards: 0.1,
        receiving_tds: 6,
        receptions: 0.5, // Half PPR
        fumbles_lost: -2
      },
      Yahoo: {
        passing_yards: 0.04,
        passing_tds: 4,
        passing_ints: -2,
        rushing_yards: 0.1,
        rushing_tds: 6,
        receiving_yards: 0.1,
        receiving_tds: 6,
        receptions: 1, // Full PPR
        fumbles_lost: -2
      }
    };
  }
}

// Export singleton instance
export const nflStatsAdapter = new NFLStatsAdapter();
export default nflStatsAdapter;
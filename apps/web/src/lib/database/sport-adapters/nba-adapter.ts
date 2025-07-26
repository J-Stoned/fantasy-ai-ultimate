/**
 * 🏀 NBA STATS ADAPTER
 * Elite developer NBA-specific data extraction and processing
 * 
 * Handles extraction of NBA stats from JSON fields in player_game_stats
 * Maps to DFS scoring (DraftKings, FanDuel, Yahoo, ESPN, CBS, Sleeper)
 * Provides position-specific stat breakdowns
 */

export interface NBARawStats {
  points?: number;
  rebounds?: number;
  assists?: number;
  steals?: number;
  blocks?: number;
  turnovers?: number;
  
  // Shooting stats
  field_goals_made?: number;
  field_goals_attempted?: number;
  field_goal_percentage?: number;
  three_pointers_made?: number;
  three_pointers_attempted?: number;
  three_point_percentage?: number;
  free_throws_made?: number;
  free_throws_attempted?: number;
  free_throw_percentage?: number;
  
  // Rebounds breakdown
  offensive_rebounds?: number;
  defensive_rebounds?: number;
  
  // Advanced stats
  minutes?: number;
  plus_minus?: number;
  usage_rate?: number;
  true_shooting_percentage?: number;
  effective_field_goal_percentage?: number;
  
  // Game context
  started?: boolean;
  double_double?: boolean;
  triple_double?: boolean;
  quadruple_double?: boolean;
}

export interface NBAProcessedStats extends NBARawStats {
  // Calculated fields
  fantasy_points_calculated?: number;
  dk_points_calculated?: number;
  fd_points_calculated?: number;
  yahoo_points_calculated?: number;
  
  // Efficiency metrics
  points_per_minute?: number;
  rebounds_per_minute?: number;
  assists_per_minute?: number;
  shooting_efficiency?: number;
  
  // Position-specific metrics
  position_rank?: number;
  position_percentile?: number;
  
  // Performance categories
  scoring_grade?: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  rebounding_grade?: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  playmaking_grade?: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
}

class NBAStatsAdapter {
  /**
   * Extract NBA stats from raw JSON data
   */
  extractStats(rawStats: any): NBARawStats {
    if (!rawStats) return {};

    return {
      // Basic counting stats
      points: this.safeNumber(rawStats.points) || this.safeNumber(rawStats.pts),
      rebounds: this.safeNumber(rawStats.rebounds) || this.safeNumber(rawStats.reb) || this.safeNumber(rawStats.total_rebounds),
      assists: this.safeNumber(rawStats.assists) || this.safeNumber(rawStats.ast),
      steals: this.safeNumber(rawStats.steals) || this.safeNumber(rawStats.stl),
      blocks: this.safeNumber(rawStats.blocks) || this.safeNumber(rawStats.blk),
      turnovers: this.safeNumber(rawStats.turnovers) || this.safeNumber(rawStats.tov) || this.safeNumber(rawStats.to),
      
      // Shooting stats
      field_goals_made: this.safeNumber(rawStats.field_goals_made) || this.safeNumber(rawStats.fgm) || this.safeNumber(rawStats.fg_made),
      field_goals_attempted: this.safeNumber(rawStats.field_goals_attempted) || this.safeNumber(rawStats.fga) || this.safeNumber(rawStats.fg_att),
      field_goal_percentage: this.safeNumber(rawStats.field_goal_percentage) || this.safeNumber(rawStats.fg_pct),
      three_pointers_made: this.safeNumber(rawStats.three_pointers_made) || this.safeNumber(rawStats.fg3m) || this.safeNumber(rawStats.three_pm),
      three_pointers_attempted: this.safeNumber(rawStats.three_pointers_attempted) || this.safeNumber(rawStats.fg3a) || this.safeNumber(rawStats.three_pa),
      three_point_percentage: this.safeNumber(rawStats.three_point_percentage) || this.safeNumber(rawStats.fg3_pct),
      free_throws_made: this.safeNumber(rawStats.free_throws_made) || this.safeNumber(rawStats.ftm) || this.safeNumber(rawStats.ft_made),
      free_throws_attempted: this.safeNumber(rawStats.free_throws_attempted) || this.safeNumber(rawStats.fta) || this.safeNumber(rawStats.ft_att),
      free_throw_percentage: this.safeNumber(rawStats.free_throw_percentage) || this.safeNumber(rawStats.ft_pct),
      
      // Rebounds breakdown
      offensive_rebounds: this.safeNumber(rawStats.offensive_rebounds) || this.safeNumber(rawStats.oreb),
      defensive_rebounds: this.safeNumber(rawStats.defensive_rebounds) || this.safeNumber(rawStats.dreb),
      
      // Game context
      minutes: this.safeNumber(rawStats.minutes) || this.safeNumber(rawStats.min),
      plus_minus: this.safeNumber(rawStats.plus_minus) || this.safeNumber(rawStats.pm),
      started: this.safeBoolean(rawStats.started) || this.safeBoolean(rawStats.is_starter),
      
      // Special achievements
      double_double: this.safeBoolean(rawStats.double_double),
      triple_double: this.safeBoolean(rawStats.triple_double),
      quadruple_double: this.safeBoolean(rawStats.quadruple_double),
    };
  }

  /**
   * Process extracted stats with calculated fields and advanced metrics
   */
  processStats(stats: NBARawStats, position?: string): NBAProcessedStats {
    const processed: NBAProcessedStats = { ...stats };

    // Calculate fantasy points using different scoring systems
    processed.fantasy_points_calculated = this.calculateStandardFantasyPoints(stats);
    processed.dk_points_calculated = this.calculateDraftKingsPoints(stats);
    processed.fd_points_calculated = this.calculateFanDuelPoints(stats);
    processed.yahoo_points_calculated = this.calculateYahooPoints(stats);

    // Calculate efficiency metrics
    if (stats.minutes && stats.minutes > 0) {
      processed.points_per_minute = Number((stats.points! / stats.minutes).toFixed(2));
      processed.rebounds_per_minute = Number((stats.rebounds! / stats.minutes).toFixed(2));
      processed.assists_per_minute = Number((stats.assists! / stats.minutes).toFixed(2));
    }

    // Calculate shooting efficiency
    if (stats.field_goals_attempted && stats.field_goals_attempted > 0) {
      const efg = stats.field_goals_made! + (0.5 * (stats.three_pointers_made || 0));
      processed.effective_field_goal_percentage = Number((efg / stats.field_goals_attempted * 100).toFixed(1));
    }

    // Calculate performance grades
    processed.scoring_grade = this.calculateScoringGrade(stats.points);
    processed.rebounding_grade = this.calculateReboundingGrade(stats.rebounds, position);
    processed.playmaking_grade = this.calculatePlaymakingGrade(stats.assists, stats.turnovers);

    // Position-specific processing
    if (position) {
      processed.position_rank = this.calculatePositionRank(stats, position);
      processed.position_percentile = this.calculatePositionPercentile(stats, position);
    }

    return processed;
  }

  /**
   * Calculate standard NBA fantasy points
   */
  private calculateStandardFantasyPoints(stats: NBARawStats): number {
    let points = 0;

    // Standard NBA fantasy scoring
    if (stats.points) points += stats.points * 1; // 1 point per point
    if (stats.rebounds) points += stats.rebounds * 1.2; // 1.2 points per rebound
    if (stats.assists) points += stats.assists * 1.5; // 1.5 points per assist
    if (stats.steals) points += stats.steals * 3; // 3 points per steal
    if (stats.blocks) points += stats.blocks * 3; // 3 points per block
    if (stats.turnovers) points -= stats.turnovers * 1; // -1 point per turnover

    // Bonuses
    if (stats.double_double) points += 1.5;
    if (stats.triple_double) points += 3;
    if (stats.quadruple_double) points += 10;

    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate DraftKings fantasy points
   */
  private calculateDraftKingsPoints(stats: NBARawStats): number {
    let points = 0;

    // DraftKings NBA scoring
    if (stats.points) points += stats.points * 1; // 1 point per point
    if (stats.three_pointers_made) points += stats.three_pointers_made * 0.5; // 0.5 bonus per 3PM
    if (stats.rebounds) points += stats.rebounds * 1.25; // 1.25 points per rebound
    if (stats.assists) points += stats.assists * 1.5; // 1.5 points per assist
    if (stats.steals) points += stats.steals * 2; // 2 points per steal
    if (stats.blocks) points += stats.blocks * 2; // 2 points per block
    if (stats.turnovers) points -= stats.turnovers * 0.5; // -0.5 point per turnover

    // Bonuses
    if (stats.double_double) points += 1.5;
    if (stats.triple_double) points += 3;

    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate FanDuel fantasy points
   */
  private calculateFanDuelPoints(stats: NBARawStats): number {
    let points = 0;

    // FanDuel NBA scoring
    if (stats.points) points += stats.points * 1; // 1 point per point
    if (stats.rebounds) points += stats.rebounds * 1.2; // 1.2 points per rebound
    if (stats.assists) points += stats.assists * 1.5; // 1.5 points per assist
    if (stats.steals) points += stats.steals * 3; // 3 points per steal
    if (stats.blocks) points += stats.blocks * 3; // 3 points per block
    if (stats.turnovers) points -= stats.turnovers * 1; // -1 point per turnover

    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate Yahoo fantasy points
   */
  private calculateYahooPoints(stats: NBARawStats): number {
    // Yahoo uses similar scoring to standard
    return this.calculateStandardFantasyPoints(stats);
  }

  /**
   * Get position-specific stats breakdown
   */
  getPositionStats(stats: NBAProcessedStats, position: string): any {
    switch (position.toUpperCase()) {
      case 'PG':
        return {
          primary_stats: {
            assists: stats.assists,
            points: stats.points,
            steals: stats.steals,
            turnovers: stats.turnovers
          },
          secondary_stats: {
            rebounds: stats.rebounds,
            three_pointers_made: stats.three_pointers_made,
            field_goal_percentage: stats.field_goal_percentage
          },
          efficiency: {
            assist_to_turnover_ratio: stats.assists && stats.turnovers ? 
              (stats.assists / stats.turnovers).toFixed(1) : null,
            points_per_minute: stats.points_per_minute
          }
        };

      case 'SG':
        return {
          primary_stats: {
            points: stats.points,
            three_pointers_made: stats.three_pointers_made,
            field_goal_percentage: stats.field_goal_percentage,
            steals: stats.steals
          },
          secondary_stats: {
            assists: stats.assists,
            rebounds: stats.rebounds,
            free_throw_percentage: stats.free_throw_percentage
          },
          efficiency: {
            effective_field_goal_percentage: stats.effective_field_goal_percentage,
            points_per_minute: stats.points_per_minute
          }
        };

      case 'SF':
        return {
          primary_stats: {
            points: stats.points,
            rebounds: stats.rebounds,
            assists: stats.assists,
            three_pointers_made: stats.three_pointers_made
          },
          secondary_stats: {
            steals: stats.steals,
            blocks: stats.blocks,
            field_goal_percentage: stats.field_goal_percentage
          },
          versatility: {
            double_double: stats.double_double,
            triple_double: stats.triple_double
          }
        };

      case 'PF':
        return {
          primary_stats: {
            points: stats.points,
            rebounds: stats.rebounds,
            blocks: stats.blocks,
            field_goal_percentage: stats.field_goal_percentage
          },
          secondary_stats: {
            assists: stats.assists,
            steals: stats.steals,
            three_pointers_made: stats.three_pointers_made
          },
          efficiency: {
            rebounds_per_minute: stats.rebounds_per_minute,
            double_double: stats.double_double
          }
        };

      case 'C':
        return {
          primary_stats: {
            points: stats.points,
            rebounds: stats.rebounds,
            blocks: stats.blocks,
            field_goal_percentage: stats.field_goal_percentage
          },
          secondary_stats: {
            assists: stats.assists,
            steals: stats.steals,
            free_throw_percentage: stats.free_throw_percentage
          },
          paint_presence: {
            offensive_rebounds: stats.offensive_rebounds,
            defensive_rebounds: stats.defensive_rebounds,
            double_double: stats.double_double
          }
        };

      default:
        return {
          all_stats: stats
        };
    }
  }

  /**
   * Calculate scoring grade based on points
   */
  private calculateScoringGrade(points?: number): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
    if (!points) return 'F';
    if (points >= 35) return 'A+';
    if (points >= 30) return 'A';
    if (points >= 25) return 'B+';
    if (points >= 20) return 'B';
    if (points >= 15) return 'C+';
    if (points >= 10) return 'C';
    if (points >= 5) return 'D';
    return 'F';
  }

  /**
   * Calculate rebounding grade based on rebounds and position
   */
  private calculateReboundingGrade(rebounds?: number, position?: string): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
    if (!rebounds) return 'F';
    
    // Position-adjusted thresholds
    const thresholds = {
      'PG': { A: 8, B: 6, C: 4, D: 2 },
      'SG': { A: 10, B: 7, C: 5, D: 3 },
      'SF': { A: 12, B: 9, C: 6, D: 4 },
      'PF': { A: 15, B: 12, C: 8, D: 5 },
      'C': { A: 18, B: 14, C: 10, D: 6 }
    };

    const posThresholds = thresholds[position as keyof typeof thresholds] || thresholds['SF'];
    
    if (rebounds >= posThresholds.A + 3) return 'A+';
    if (rebounds >= posThresholds.A) return 'A';
    if (rebounds >= posThresholds.B + 2) return 'B+';
    if (rebounds >= posThresholds.B) return 'B';
    if (rebounds >= posThresholds.C + 1) return 'C+';
    if (rebounds >= posThresholds.C) return 'C';
    if (rebounds >= posThresholds.D) return 'D';
    return 'F';
  }

  /**
   * Calculate playmaking grade based on assists and turnovers
   */
  private calculatePlaymakingGrade(assists?: number, turnovers?: number): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
    if (!assists) return 'F';
    
    const ratio = turnovers ? assists / turnovers : assists;
    
    if (assists >= 12 && ratio >= 3) return 'A+';
    if (assists >= 10 && ratio >= 2.5) return 'A';
    if (assists >= 8 && ratio >= 2) return 'B+';
    if (assists >= 6 && ratio >= 1.5) return 'B';
    if (assists >= 4 && ratio >= 1) return 'C+';
    if (assists >= 2) return 'C';
    if (assists >= 1) return 'D';
    return 'F';
  }

  /**
   * Calculate position rank (simplified)
   */
  private calculatePositionRank(stats: NBARawStats, position: string): number {
    const fantasyPoints = this.calculateStandardFantasyPoints(stats);
    
    // Position-based performance tiers
    const positionTiers = {
      'PG': [50, 40, 30, 25, 20],
      'SG': [45, 35, 28, 22, 18],
      'SF': [50, 40, 32, 25, 20],
      'PF': [55, 45, 35, 28, 22],
      'C': [60, 50, 40, 30, 24]
    };

    const tiers = positionTiers[position as keyof typeof positionTiers] || positionTiers['SF'];
    
    for (let i = 0; i < tiers.length; i++) {
      if (fantasyPoints >= tiers[i]) {
        return i + 1;
      }
    }

    return tiers.length + 1;
  }

  /**
   * Calculate position percentile
   */
  private calculatePositionPercentile(stats: NBARawStats, position: string): number {
    const rank = this.calculatePositionRank(stats, position);
    return Math.max(0, Math.min(100, 100 - (rank - 1) * 8));
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
   * Safely convert value to boolean
   */
  private safeBoolean(value: any): boolean | undefined {
    if (value === null || value === undefined) return undefined;
    if (typeof value === 'boolean') return value;
    if (typeof value === 'string') return value.toLowerCase() === 'true';
    if (typeof value === 'number') return value === 1;
    return undefined;
  }

  /**
   * Get DFS platform scoring rules
   */
  getDFSScoringRules() {
    return {
      DraftKings: {
        points: 1,
        three_pointers_made: 0.5,
        rebounds: 1.25,
        assists: 1.5,
        steals: 2,
        blocks: 2,
        turnovers: -0.5,
        bonuses: {
          double_double: 1.5,
          triple_double: 3
        }
      },
      FanDuel: {
        points: 1,
        rebounds: 1.2,
        assists: 1.5,
        steals: 3,
        blocks: 3,
        turnovers: -1
      },
      Yahoo: {
        points: 1,
        rebounds: 1.2,
        assists: 1.5,
        steals: 3,
        blocks: 3,
        turnovers: -1,
        bonuses: {
          double_double: 1.5,
          triple_double: 3
        }
      }
    };
  }
}

// Export singleton instance
export const nbaStatsAdapter = new NBAStatsAdapter();
export default nbaStatsAdapter;
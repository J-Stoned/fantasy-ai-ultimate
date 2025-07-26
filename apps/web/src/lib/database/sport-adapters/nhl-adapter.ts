/**
 * 🏒 NHL STATS ADAPTER
 * Elite developer NHL-specific data extraction and processing
 * 
 * Handles extraction of NHL stats from JSON fields in player_game_stats
 * Maps to DFS scoring (DraftKings, FanDuel, Yahoo, ESPN, CBS, Sleeper)
 * Provides position-specific stat breakdowns for skaters and goalies
 */

export interface NHLSkaterStats {
  // Scoring stats
  goals?: number;
  assists?: number;
  points?: number;
  
  // Shooting stats
  shots?: number;
  shooting_percentage?: number;
  
  // Ice time
  time_on_ice?: number;
  time_on_ice_seconds?: number;
  average_time_on_ice?: number;
  
  // Special teams
  power_play_goals?: number;
  power_play_assists?: number;
  power_play_points?: number;
  power_play_time_on_ice?: number;
  short_handed_goals?: number;
  short_handed_assists?: number;
  short_handed_points?: number;
  short_handed_time_on_ice?: number;
  
  // Physical stats
  hits?: number;
  blocked_shots?: number;
  penalty_minutes?: number;
  faceoffs_won?: number;
  faceoffs_lost?: number;
  faceoff_percentage?: number;
  
  // Advanced stats
  plus_minus?: number;
  takeaways?: number;
  giveaways?: number;
  
  // Game context
  shifts?: number;
  games_played?: number;
  started?: boolean;
}

export interface NHLGoalieStats {
  // Basic goalie stats
  saves?: number;
  shots_against?: number;
  goals_against?: number;
  save_percentage?: number;
  goals_against_average?: number;
  
  // Game results
  wins?: number;
  losses?: number;
  overtime_losses?: number;
  shutouts?: number;
  
  // Time stats
  time_on_ice?: number;
  time_on_ice_seconds?: number;
  
  // Advanced stats
  quality_starts?: number;
  really_bad_starts?: number;
  
  // Special situations
  power_play_saves?: number;
  power_play_shots_against?: number;
  short_handed_saves?: number;
  short_handed_shots_against?: number;
  even_strength_saves?: number;
  even_strength_shots_against?: number;
  
  // Game context
  games_played?: number;
  games_started?: number;
  decision?: 'W' | 'L' | 'OTL' | 'ND';
}

export interface NHLRawStats extends NHLSkaterStats, NHLGoalieStats {
  // Player type
  player_type?: 'skater' | 'goalie';
  position?: string;
  
  // Team context
  team?: string;
  opponent?: string;
  game_date?: string;
  is_home?: boolean;
  
  // Performance indicators
  star_of_game?: 1 | 2 | 3;
  game_winning_goal?: boolean;
  overtime_goal?: boolean;
  penalty_shot_goals?: number;
  penalty_shot_attempts?: number;
}

export interface NHLProcessedStats extends NHLRawStats {
  // Calculated fields
  fantasy_points_calculated?: number;
  dk_points_calculated?: number;
  fd_points_calculated?: number;
  yahoo_points_calculated?: number;
  
  // Advanced metrics
  offensive_rating?: number;
  defensive_rating?: number;
  overall_rating?: number;
  
  // Efficiency metrics
  points_per_60?: number;
  shots_per_60?: number;
  hits_per_60?: number;
  corsi_for_percentage?: number;
  
  // Position-specific breakdowns
  position_rank?: number;
  position_percentile?: number;
  
  // Performance grades
  offensive_grade?: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  defensive_grade?: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  goaltending_grade?: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
}

class NHLStatsAdapter {
  /**
   * Extract NHL stats from raw JSON data
   */
  extractStats(rawStats: any): NHLRawStats {
    if (!rawStats) return {};

    return {
      // Determine player type
      player_type: this.determinePlayerType(rawStats),
      position: rawStats.position,
      team: rawStats.team,
      opponent: rawStats.opponent,
      game_date: rawStats.game_date,
      is_home: this.safeBoolean(rawStats.is_home),
      started: this.safeBoolean(rawStats.started),
      
      // Basic scoring stats
      goals: this.safeNumber(rawStats.goals) || this.safeNumber(rawStats.g),
      assists: this.safeNumber(rawStats.assists) || this.safeNumber(rawStats.a),
      points: this.safeNumber(rawStats.points) || this.safeNumber(rawStats.pts),
      
      // Shooting stats
      shots: this.safeNumber(rawStats.shots) || this.safeNumber(rawStats.sog),
      shooting_percentage: this.safeNumber(rawStats.shooting_percentage) || this.safeNumber(rawStats.sh_pct),
      
      // Ice time (convert to seconds if needed)
      time_on_ice: this.safeNumber(rawStats.time_on_ice) || this.safeNumber(rawStats.toi),
      time_on_ice_seconds: this.safeNumber(rawStats.time_on_ice_seconds) || this.convertTimeToSeconds(rawStats.time_on_ice),
      
      // Special teams
      power_play_goals: this.safeNumber(rawStats.power_play_goals) || this.safeNumber(rawStats.ppg),
      power_play_assists: this.safeNumber(rawStats.power_play_assists) || this.safeNumber(rawStats.ppa),
      power_play_points: this.safeNumber(rawStats.power_play_points) || this.safeNumber(rawStats.ppp),
      power_play_time_on_ice: this.safeNumber(rawStats.power_play_time_on_ice) || this.safeNumber(rawStats.pp_toi),
      short_handed_goals: this.safeNumber(rawStats.short_handed_goals) || this.safeNumber(rawStats.shg),
      short_handed_assists: this.safeNumber(rawStats.short_handed_assists) || this.safeNumber(rawStats.sha),
      short_handed_points: this.safeNumber(rawStats.short_handed_points) || this.safeNumber(rawStats.shp),
      short_handed_time_on_ice: this.safeNumber(rawStats.short_handed_time_on_ice) || this.safeNumber(rawStats.sh_toi),
      
      // Physical stats
      hits: this.safeNumber(rawStats.hits),
      blocked_shots: this.safeNumber(rawStats.blocked_shots) || this.safeNumber(rawStats.bs),
      penalty_minutes: this.safeNumber(rawStats.penalty_minutes) || this.safeNumber(rawStats.pim),
      
      // Faceoffs
      faceoffs_won: this.safeNumber(rawStats.faceoffs_won) || this.safeNumber(rawStats.fo_won),
      faceoffs_lost: this.safeNumber(rawStats.faceoffs_lost) || this.safeNumber(rawStats.fo_lost),
      faceoff_percentage: this.safeNumber(rawStats.faceoff_percentage) || this.safeNumber(rawStats.fo_pct),
      
      // Other skater stats
      plus_minus: this.safeNumber(rawStats.plus_minus) || this.safeNumber(rawStats.pm),
      takeaways: this.safeNumber(rawStats.takeaways) || this.safeNumber(rawStats.tk),
      giveaways: this.safeNumber(rawStats.giveaways) || this.safeNumber(rawStats.gv),
      shifts: this.safeNumber(rawStats.shifts),
      
      // Goalie stats
      saves: this.safeNumber(rawStats.saves) || this.safeNumber(rawStats.sv),
      shots_against: this.safeNumber(rawStats.shots_against) || this.safeNumber(rawStats.sa),
      goals_against: this.safeNumber(rawStats.goals_against) || this.safeNumber(rawStats.ga),
      save_percentage: this.safeNumber(rawStats.save_percentage) || this.safeNumber(rawStats.sv_pct),
      goals_against_average: this.safeNumber(rawStats.goals_against_average) || this.safeNumber(rawStats.gaa),
      
      // Goalie results
      wins: this.safeNumber(rawStats.wins) || this.safeNumber(rawStats.w),
      losses: this.safeNumber(rawStats.losses) || this.safeNumber(rawStats.l),
      overtime_losses: this.safeNumber(rawStats.overtime_losses) || this.safeNumber(rawStats.otl),
      shutouts: this.safeNumber(rawStats.shutouts) || this.safeNumber(rawStats.so),
      
      // Special achievements
      star_of_game: rawStats.star_of_game,
      game_winning_goal: this.safeBoolean(rawStats.game_winning_goal) || this.safeBoolean(rawStats.gwg),
      overtime_goal: this.safeBoolean(rawStats.overtime_goal) || this.safeBoolean(rawStats.otg),
      penalty_shot_goals: this.safeNumber(rawStats.penalty_shot_goals) || this.safeNumber(rawStats.ps_goals),
      penalty_shot_attempts: this.safeNumber(rawStats.penalty_shot_attempts) || this.safeNumber(rawStats.ps_attempts),
    };
  }

  /**
   * Process extracted stats with calculated fields and advanced metrics
   */
  processStats(stats: NHLRawStats, position?: string): NHLProcessedStats {
    const processed: NHLProcessedStats = { ...stats };

    // Calculate fantasy points for different platforms
    processed.fantasy_points_calculated = this.calculateStandardFantasyPoints(stats);
    processed.dk_points_calculated = this.calculateDraftKingsPoints(stats);
    processed.fd_points_calculated = this.calculateFanDuelPoints(stats);
    processed.yahoo_points_calculated = this.calculateYahooPoints(stats);

    // Calculate derived stats
    if (!stats.points && stats.goals && stats.assists) {
      processed.points = stats.goals + stats.assists;
    }

    if (!stats.faceoff_percentage && stats.faceoffs_won && stats.faceoffs_lost) {
      const totalFaceoffs = stats.faceoffs_won + stats.faceoffs_lost;
      processed.faceoff_percentage = Number((stats.faceoffs_won / totalFaceoffs * 100).toFixed(1));
    }

    if (!stats.save_percentage && stats.saves && stats.shots_against) {
      processed.save_percentage = Number((stats.saves / stats.shots_against * 100).toFixed(1));
    }

    // Calculate per-60 stats if time on ice is available
    if (stats.time_on_ice_seconds && stats.time_on_ice_seconds > 0) {
      const minutes = stats.time_on_ice_seconds / 60;
      processed.points_per_60 = stats.points ? Number((stats.points / minutes * 60).toFixed(2)) : undefined;
      processed.shots_per_60 = stats.shots ? Number((stats.shots / minutes * 60).toFixed(2)) : undefined;
      processed.hits_per_60 = stats.hits ? Number((stats.hits / minutes * 60).toFixed(2)) : undefined;
    }

    // Calculate performance grades
    if (stats.player_type === 'skater' || !stats.player_type) {
      processed.offensive_grade = this.calculateOffensiveGrade(stats);
      processed.defensive_grade = this.calculateDefensiveGrade(stats);
    }
    
    if (stats.player_type === 'goalie') {
      processed.goaltending_grade = this.calculateGoaltendingGrade(stats);
    }

    // Position-specific processing
    if (position) {
      processed.position_rank = this.calculatePositionRank(stats, position);
      processed.position_percentile = this.calculatePositionPercentile(stats, position);
    }

    return processed;
  }

  /**
   * Determine if player is a skater or goalie
   */
  private determinePlayerType(rawStats: any): 'skater' | 'goalie' {
    // Check for goalie-specific stats
    const hasGoalieStats = rawStats.saves || rawStats.shots_against || rawStats.goals_against || rawStats.sv_pct || rawStats.gaa;
    
    // Check position
    const position = rawStats.position?.toUpperCase();
    if (position === 'G' || position === 'GK' || position === 'GOALIE') {
      return 'goalie';
    }
    
    if (hasGoalieStats) return 'goalie';
    return 'skater';
  }

  /**
   * Convert time string (MM:SS) to seconds
   */
  private convertTimeToSeconds(timeString: any): number | undefined {
    if (!timeString || typeof timeString !== 'string') return undefined;
    
    const parts = timeString.split(':');
    if (parts.length !== 2) return undefined;
    
    const minutes = parseInt(parts[0]);
    const seconds = parseInt(parts[1]);
    
    if (isNaN(minutes) || isNaN(seconds)) return undefined;
    
    return minutes * 60 + seconds;
  }

  /**
   * Calculate standard NHL fantasy points
   */
  private calculateStandardFantasyPoints(stats: NHLRawStats): number {
    let points = 0;

    if (stats.player_type === 'skater' || !stats.player_type) {
      // Skater scoring
      if (stats.goals) points += stats.goals * 3; // 3 points per goal
      if (stats.assists) points += stats.assists * 2; // 2 points per assist
      if (stats.power_play_points) points += stats.power_play_points * 0.5; // 0.5 bonus for PP points
      if (stats.short_handed_points) points += stats.short_handed_points * 1; // 1 bonus for SH points
      if (stats.shots) points += stats.shots * 0.5; // 0.5 points per shot
      if (stats.hits) points += stats.hits * 0.1; // 0.1 points per hit
      if (stats.blocked_shots) points += stats.blocked_shots * 0.5; // 0.5 points per blocked shot
      if (stats.penalty_minutes) points -= stats.penalty_minutes * 0.25; // -0.25 per penalty minute
      
      // Special bonuses
      if (stats.game_winning_goal) points += 1;
      if (stats.overtime_goal) points += 2;
      if (stats.star_of_game) {
        if (stats.star_of_game === 1) points += 3;
        else if (stats.star_of_game === 2) points += 2;
        else if (stats.star_of_game === 3) points += 1;
      }
    }

    if (stats.player_type === 'goalie') {
      // Goalie scoring
      if (stats.wins) points += stats.wins * 4; // 4 points per win
      if (stats.saves) points += stats.saves * 0.2; // 0.2 points per save
      if (stats.goals_against) points -= stats.goals_against * 1; // -1 point per goal against
      if (stats.shutouts) points += stats.shutouts * 5; // 5 points per shutout
      
      // Save percentage bonuses
      if (stats.save_percentage) {
        if (stats.save_percentage >= 95) points += 3;
        else if (stats.save_percentage >= 92) points += 2;
        else if (stats.save_percentage >= 90) points += 1;
      }
    }

    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate DraftKings fantasy points
   */
  private calculateDraftKingsPoints(stats: NHLRawStats): number {
    let points = 0;

    if (stats.player_type === 'skater' || !stats.player_type) {
      // DraftKings skater scoring
      if (stats.goals) points += stats.goals * 8; // 8 points per goal
      if (stats.assists) points += stats.assists * 5; // 5 points per assist
      if (stats.shots) points += stats.shots * 1.5; // 1.5 points per shot
      if (stats.blocked_shots) points += stats.blocked_shots * 1; // 1 point per blocked shot
      if (stats.power_play_points) points += stats.power_play_points * 0.5; // 0.5 bonus for PP points
      if (stats.short_handed_points) points += stats.short_handed_points * 2; // 2 bonus for SH points
      
      // Bonuses
      if (stats.goals && stats.goals >= 3) points += 1.5; // Hat trick bonus
      if (stats.game_winning_goal) points += 1.5;
      if (stats.overtime_goal) points += 2.5;
    }

    if (stats.player_type === 'goalie') {
      // DraftKings goalie scoring
      if (stats.wins) points += stats.wins * 12; // 12 points per win
      if (stats.saves) points += stats.saves * 0.7; // 0.7 points per save
      if (stats.goals_against) points -= stats.goals_against * 3.5; // -3.5 per goal against
      if (stats.shutouts) points += stats.shutouts * 8; // 8 points per shutout
    }

    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate FanDuel fantasy points
   */
  private calculateFanDuelPoints(stats: NHLRawStats): number {
    let points = 0;

    if (stats.player_type === 'skater' || !stats.player_type) {
      // FanDuel skater scoring
      if (stats.goals) points += stats.goals * 12; // 12 points per goal
      if (stats.assists) points += stats.assists * 8; // 8 points per assist
      if (stats.shots) points += stats.shots * 1.6; // 1.6 points per shot
      if (stats.blocked_shots) points += stats.blocked_shots * 1.2; // 1.2 points per blocked shot
      if (stats.power_play_points) points += stats.power_play_points * 0.8; // 0.8 bonus for PP points
      if (stats.short_handed_points) points += stats.short_handed_points * 2; // 2 bonus for SH points
    }

    if (stats.player_type === 'goalie') {
      // FanDuel goalie scoring
      if (stats.wins) points += stats.wins * 12; // 12 points per win
      if (stats.saves) points += stats.saves * 0.8; // 0.8 points per save
      if (stats.goals_against) points -= stats.goals_against * 3; // -3 per goal against
      if (stats.shutouts) points += stats.shutouts * 8; // 8 points per shutout
    }

    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate Yahoo fantasy points
   */
  private calculateYahooPoints(stats: NHLRawStats): number {
    // Yahoo uses similar scoring to standard
    return this.calculateStandardFantasyPoints(stats);
  }

  /**
   * Get position-specific stats breakdown
   */
  getPositionStats(stats: NHLProcessedStats, position: string): any {
    const pos = position.toUpperCase();
    
    if (pos === 'G' || pos === 'GK' || pos === 'GOALIE') {
      return {
        goalie_stats: {
          save_percentage: stats.save_percentage,
          goals_against_average: stats.goals_against_average,
          saves: stats.saves,
          shots_against: stats.shots_against
        },
        results: {
          wins: stats.wins,
          losses: stats.losses,
          overtime_losses: stats.overtime_losses,
          shutouts: stats.shutouts
        },
        workload: {
          time_on_ice: stats.time_on_ice,
          games_started: stats.games_started
        }
      };
    } else {
      return {
        scoring_stats: {
          goals: stats.goals,
          assists: stats.assists,
          points: stats.points,
          shots: stats.shots
        },
        special_teams: {
          power_play_goals: stats.power_play_goals,
          power_play_assists: stats.power_play_assists,
          short_handed_goals: stats.short_handed_goals,
          short_handed_assists: stats.short_handed_assists
        },
        physical_stats: {
          hits: stats.hits,
          blocked_shots: stats.blocked_shots,
          penalty_minutes: stats.penalty_minutes
        },
        advanced_stats: {
          plus_minus: stats.plus_minus,
          time_on_ice: stats.time_on_ice,
          faceoff_percentage: pos === 'C' ? stats.faceoff_percentage : undefined
        }
      };
    }
  }

  /**
   * Calculate offensive performance grade
   */
  private calculateOffensiveGrade(stats: NHLRawStats): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
    const points = (stats.goals || 0) + (stats.assists || 0);
    
    if (points >= 4) return 'A+';
    if (points >= 3) return 'A';
    if (points >= 2) return 'B+';
    if (points >= 1) return 'B';
    if (stats.shots && stats.shots >= 4) return 'C+';
    if (stats.shots && stats.shots >= 2) return 'C';
    if (stats.shots && stats.shots >= 1) return 'D';
    return 'F';
  }

  /**
   * Calculate defensive performance grade
   */
  private calculateDefensiveGrade(stats: NHLRawStats): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
    let score = 0;
    
    if (stats.blocked_shots) {
      if (stats.blocked_shots >= 4) score += 25;
      else if (stats.blocked_shots >= 3) score += 20;
      else if (stats.blocked_shots >= 2) score += 15;
      else if (stats.blocked_shots >= 1) score += 10;
    }
    
    if (stats.hits) {
      if (stats.hits >= 6) score += 25;
      else if (stats.hits >= 4) score += 20;
      else if (stats.hits >= 2) score += 15;
      else if (stats.hits >= 1) score += 10;
    }
    
    if (stats.plus_minus) {
      if (stats.plus_minus >= 3) score += 25;
      else if (stats.plus_minus >= 1) score += 15;
      else if (stats.plus_minus >= 0) score += 10;
      else if (stats.plus_minus >= -1) score += 5;
    } else {
      score += 10; // Neutral if no +/- data
    }
    
    if (stats.takeaways) {
      score += Math.min(stats.takeaways * 5, 25);
    }
    
    // Convert score to grade
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C+';
    if (score >= 40) return 'C';
    if (score >= 25) return 'D';
    return 'F';
  }

  /**
   * Calculate goaltending performance grade
   */
  private calculateGoaltendingGrade(stats: NHLRawStats): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
    let score = 0;
    
    // Save percentage component
    if (stats.save_percentage) {
      if (stats.save_percentage >= 96) score += 35;
      else if (stats.save_percentage >= 94) score += 30;
      else if (stats.save_percentage >= 92) score += 25;
      else if (stats.save_percentage >= 90) score += 20;
      else if (stats.save_percentage >= 88) score += 15;
      else if (stats.save_percentage >= 85) score += 10;
      else score += 5;
    }
    
    // Goals against component
    if (stats.goals_against !== undefined) {
      if (stats.goals_against === 0) score += 35; // Shutout
      else if (stats.goals_against <= 1) score += 30;
      else if (stats.goals_against <= 2) score += 25;
      else if (stats.goals_against <= 3) score += 20;
      else if (stats.goals_against <= 4) score += 15;
      else if (stats.goals_against <= 5) score += 10;
      else score += 5;
    }
    
    // Result component
    if (stats.wins) score += 30;
    else if (stats.overtime_losses) score += 15;
    else if (stats.losses) score += 5;
    
    // Convert score to grade
    if (score >= 90) return 'A+';
    if (score >= 80) return 'A';
    if (score >= 70) return 'B+';
    if (score >= 60) return 'B';
    if (score >= 50) return 'C+';
    if (score >= 40) return 'C';
    if (score >= 25) return 'D';
    return 'F';
  }

  /**
   * Calculate position rank (simplified)
   */
  private calculatePositionRank(stats: NHLRawStats, position: string): number {
    const fantasyPoints = this.calculateStandardFantasyPoints(stats);
    
    // Position-based performance tiers
    const positionTiers = {
      'C': [20, 15, 12, 8, 5],
      'LW': [18, 14, 10, 7, 4],
      'RW': [18, 14, 10, 7, 4],
      'D': [15, 12, 8, 5, 3],
      'G': [25, 20, 15, 10, 5]
    };

    const tiers = positionTiers[position as keyof typeof positionTiers] || positionTiers['C'];
    
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
  private calculatePositionPercentile(stats: NHLRawStats, position: string): number {
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
        skater: {
          goal: 8,
          assist: 5,
          shot: 1.5,
          blocked_shot: 1,
          power_play_point: 0.5,
          short_handed_point: 2,
          hat_trick_bonus: 1.5,
          game_winning_goal: 1.5,
          overtime_goal: 2.5
        },
        goalie: {
          win: 12,
          save: 0.7,
          goal_against: -3.5,
          shutout: 8
        }
      },
      FanDuel: {
        skater: {
          goal: 12,
          assist: 8,
          shot: 1.6,
          blocked_shot: 1.2,
          power_play_point: 0.8,
          short_handed_point: 2
        },
        goalie: {
          win: 12,
          save: 0.8,
          goal_against: -3,
          shutout: 8
        }
      }
    };
  }
}

// Export singleton instance
export const nhlStatsAdapter = new NHLStatsAdapter();
export default nhlStatsAdapter;
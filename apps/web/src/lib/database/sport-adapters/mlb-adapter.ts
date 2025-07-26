/**
 * ⚾ MLB STATS ADAPTER
 * Elite developer MLB-specific data extraction and processing
 * 
 * Handles extraction of MLB stats from JSON fields in player_game_stats
 * Maps to DFS scoring (DraftKings, FanDuel, Yahoo, ESPN, CBS, Sleeper)
 * Provides position-specific stat breakdowns for hitters and pitchers
 */

export interface MLBHitterStats {
  // Batting stats
  at_bats?: number;
  hits?: number;
  runs?: number;
  rbis?: number;
  doubles?: number;
  triples?: number;
  home_runs?: number;
  walks?: number;
  strikeouts?: number;
  stolen_bases?: number;
  caught_stealing?: number;
  hit_by_pitch?: number;
  sacrifice_flies?: number;
  sacrifice_hits?: number;
  
  // Calculated averages
  batting_average?: number;
  on_base_percentage?: number;
  slugging_percentage?: number;
  ops?: number;
  
  // Advanced stats
  woba?: number;
  wrc_plus?: number;
  babip?: number;
  iso?: number;
  
  // Game situation
  plate_appearances?: number;
  total_bases?: number;
  left_on_base?: number;
  grounded_into_double_plays?: number;
}

export interface MLBPitcherStats {
  // Pitching stats
  innings_pitched?: number;
  hits_allowed?: number;
  runs_allowed?: number;
  earned_runs?: number;
  walks_allowed?: number;
  strikeouts?: number;
  home_runs_allowed?: number;
  hit_batters?: number;
  wild_pitches?: number;
  balks?: number;
  
  // Game result
  wins?: number;
  losses?: number;
  saves?: number;
  holds?: number;
  blown_saves?: number;
  quality_starts?: number;
  complete_games?: number;
  shutouts?: number;
  
  // Calculated stats
  era?: number;
  whip?: number;
  k_per_9?: number;
  bb_per_9?: number;
  hr_per_9?: number;
  
  // Advanced stats
  fip?: number;
  xfip?: number;
  sierra?: number;
  
  // Pitch counts
  pitches?: number;
  strikes?: number;
  balls?: number;
  first_pitch_strikes?: number;
}

export interface MLBRawStats extends MLBHitterStats, MLBPitcherStats {
  // Player type
  player_type?: 'hitter' | 'pitcher';
  
  // Position-specific
  position?: string;
  started?: boolean;
  games_played?: number;
  
  // Fielding (for hitters)
  fielding_errors?: number;
  putouts?: number;
  assists?: number;
  chances?: number;
  fielding_percentage?: number;
}

export interface MLBProcessedStats extends MLBRawStats {
  // Calculated fields
  fantasy_points_calculated?: number;
  dk_points_calculated?: number;
  fd_points_calculated?: number;
  yahoo_points_calculated?: number;
  
  // Advanced metrics
  offensive_value?: number;
  pitching_value?: number;
  overall_rating?: number;
  
  // Position-specific breakdowns
  position_rank?: number;
  position_percentile?: number;
  
  // Performance grades
  hitting_grade?: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  pitching_grade?: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
  fielding_grade?: 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F';
}

class MLBStatsAdapter {
  /**
   * Extract MLB stats from raw JSON data
   */
  extractStats(rawStats: any): MLBRawStats {
    if (!rawStats) return {};

    return {
      // Determine player type
      player_type: this.determinePlayerType(rawStats),
      position: rawStats.position,
      started: this.safeBoolean(rawStats.started),
      games_played: this.safeNumber(rawStats.games_played) || this.safeNumber(rawStats.g),
      
      // Hitting stats
      at_bats: this.safeNumber(rawStats.at_bats) || this.safeNumber(rawStats.ab),
      hits: this.safeNumber(rawStats.hits) || this.safeNumber(rawStats.h),
      runs: this.safeNumber(rawStats.runs) || this.safeNumber(rawStats.r),
      rbis: this.safeNumber(rawStats.rbis) || this.safeNumber(rawStats.rbi),
      doubles: this.safeNumber(rawStats.doubles) || this.safeNumber(rawStats['2b']),
      triples: this.safeNumber(rawStats.triples) || this.safeNumber(rawStats['3b']),
      home_runs: this.safeNumber(rawStats.home_runs) || this.safeNumber(rawStats.hr),
      walks: this.safeNumber(rawStats.walks) || this.safeNumber(rawStats.bb),
      strikeouts: this.safeNumber(rawStats.strikeouts) || this.safeNumber(rawStats.so) || this.safeNumber(rawStats.k),
      stolen_bases: this.safeNumber(rawStats.stolen_bases) || this.safeNumber(rawStats.sb),
      caught_stealing: this.safeNumber(rawStats.caught_stealing) || this.safeNumber(rawStats.cs),
      hit_by_pitch: this.safeNumber(rawStats.hit_by_pitch) || this.safeNumber(rawStats.hbp),
      sacrifice_flies: this.safeNumber(rawStats.sacrifice_flies) || this.safeNumber(rawStats.sf),
      sacrifice_hits: this.safeNumber(rawStats.sacrifice_hits) || this.safeNumber(rawStats.sh),
      
      // Calculated batting stats
      batting_average: this.safeNumber(rawStats.batting_average) || this.safeNumber(rawStats.avg),
      on_base_percentage: this.safeNumber(rawStats.on_base_percentage) || this.safeNumber(rawStats.obp),
      slugging_percentage: this.safeNumber(rawStats.slugging_percentage) || this.safeNumber(rawStats.slg),
      ops: this.safeNumber(rawStats.ops),
      
      // Pitching stats
      innings_pitched: this.safeNumber(rawStats.innings_pitched) || this.safeNumber(rawStats.ip),
      hits_allowed: this.safeNumber(rawStats.hits_allowed) || this.safeNumber(rawStats.h_allowed),
      runs_allowed: this.safeNumber(rawStats.runs_allowed) || this.safeNumber(rawStats.r_allowed),
      earned_runs: this.safeNumber(rawStats.earned_runs) || this.safeNumber(rawStats.er),
      walks_allowed: this.safeNumber(rawStats.walks_allowed) || this.safeNumber(rawStats.bb_allowed),
      home_runs_allowed: this.safeNumber(rawStats.home_runs_allowed) || this.safeNumber(rawStats.hr_allowed),
      hit_batters: this.safeNumber(rawStats.hit_batters) || this.safeNumber(rawStats.hbp_allowed),
      wild_pitches: this.safeNumber(rawStats.wild_pitches) || this.safeNumber(rawStats.wp),
      balks: this.safeNumber(rawStats.balks),
      
      // Pitching results
      wins: this.safeNumber(rawStats.wins) || this.safeNumber(rawStats.w),
      losses: this.safeNumber(rawStats.losses) || this.safeNumber(rawStats.l),
      saves: this.safeNumber(rawStats.saves) || this.safeNumber(rawStats.sv),
      holds: this.safeNumber(rawStats.holds) || this.safeNumber(rawStats.hld),
      blown_saves: this.safeNumber(rawStats.blown_saves) || this.safeNumber(rawStats.bs),
      quality_starts: this.safeNumber(rawStats.quality_starts) || this.safeNumber(rawStats.qs),
      complete_games: this.safeNumber(rawStats.complete_games) || this.safeNumber(rawStats.cg),
      shutouts: this.safeNumber(rawStats.shutouts) || this.safeNumber(rawStats.sho),
      
      // Calculated pitching stats
      era: this.safeNumber(rawStats.era),
      whip: this.safeNumber(rawStats.whip),
      
      // Pitch counts
      pitches: this.safeNumber(rawStats.pitches) || this.safeNumber(rawStats.pitch_count),
      strikes: this.safeNumber(rawStats.strikes),
      balls: this.safeNumber(rawStats.balls),
      
      // Fielding stats
      fielding_errors: this.safeNumber(rawStats.fielding_errors) || this.safeNumber(rawStats.e),
      putouts: this.safeNumber(rawStats.putouts) || this.safeNumber(rawStats.po),
      assists: this.safeNumber(rawStats.assists) || this.safeNumber(rawStats.a),
      fielding_percentage: this.safeNumber(rawStats.fielding_percentage) || this.safeNumber(rawStats.fpct),
    };
  }

  /**
   * Process extracted stats with calculated fields and advanced metrics
   */
  processStats(stats: MLBRawStats, position?: string): MLBProcessedStats {
    const processed: MLBProcessedStats = { ...stats };

    // Calculate fantasy points for different platforms
    processed.fantasy_points_calculated = this.calculateStandardFantasyPoints(stats);
    processed.dk_points_calculated = this.calculateDraftKingsPoints(stats);
    processed.fd_points_calculated = this.calculateFanDuelPoints(stats);
    processed.yahoo_points_calculated = this.calculateYahooPoints(stats);

    // Calculate derived batting stats
    if (stats.at_bats && stats.at_bats > 0) {
      if (!stats.batting_average && stats.hits) {
        processed.batting_average = Number((stats.hits / stats.at_bats).toFixed(3));
      }
      
      if (stats.doubles && stats.triples && stats.home_runs) {
        const totalBases = stats.hits! + stats.doubles + (stats.triples * 2) + (stats.home_runs * 3);
        processed.slugging_percentage = Number((totalBases / stats.at_bats).toFixed(3));
        processed.total_bases = totalBases;
      }
    }

    // Calculate plate appearances
    if (stats.at_bats && stats.walks && stats.hit_by_pitch && stats.sacrifice_flies) {
      processed.plate_appearances = stats.at_bats + stats.walks + stats.hit_by_pitch + (stats.sacrifice_flies || 0);
    }

    // Calculate pitching rates
    if (stats.innings_pitched && stats.innings_pitched > 0) {
      if (stats.strikeouts) {
        processed.k_per_9 = Number((stats.strikeouts / stats.innings_pitched * 9).toFixed(2));
      }
      if (stats.walks_allowed) {
        processed.bb_per_9 = Number((stats.walks_allowed / stats.innings_pitched * 9).toFixed(2));
      }
      if (stats.home_runs_allowed) {
        processed.hr_per_9 = Number((stats.home_runs_allowed / stats.innings_pitched * 9).toFixed(2));
      }
    }

    // Calculate performance grades
    if (stats.player_type === 'hitter' || !stats.player_type) {
      processed.hitting_grade = this.calculateHittingGrade(stats);
    }
    if (stats.player_type === 'pitcher' || !stats.player_type) {
      processed.pitching_grade = this.calculatePitchingGrade(stats);
    }
    processed.fielding_grade = this.calculateFieldingGrade(stats);

    // Position-specific processing
    if (position) {
      processed.position_rank = this.calculatePositionRank(stats, position);
      processed.position_percentile = this.calculatePositionPercentile(stats, position);
    }

    return processed;
  }

  /**
   * Determine if player is primarily a hitter or pitcher
   */
  private determinePlayerType(rawStats: any): 'hitter' | 'pitcher' {
    // Check if pitching stats exist
    const hasPitchingStats = rawStats.innings_pitched || rawStats.ip || rawStats.era || rawStats.strikeouts > 10;
    // Check if hitting stats exist
    const hasHittingStats = rawStats.at_bats || rawStats.ab || rawStats.hits || rawStats.h;
    
    if (hasPitchingStats && !hasHittingStats) return 'pitcher';
    if (hasHittingStats && !hasPitchingStats) return 'hitter';
    
    // If both or neither, determine by position
    const position = rawStats.position?.toUpperCase();
    if (position === 'P' || position === 'SP' || position === 'RP' || position === 'CP') {
      return 'pitcher';
    }
    
    return 'hitter';
  }

  /**
   * Calculate standard MLB fantasy points
   */
  private calculateStandardFantasyPoints(stats: MLBRawStats): number {
    let points = 0;

    if (stats.player_type === 'hitter' || !stats.player_type) {
      // Hitting scoring
      if (stats.runs) points += stats.runs * 1; // 1 point per run
      if (stats.rbis) points += stats.rbis * 1; // 1 point per RBI
      if (stats.hits) points += stats.hits * 1; // 1 point per hit
      if (stats.doubles) points += stats.doubles * 1; // 1 additional point for double
      if (stats.triples) points += stats.triples * 2; // 2 additional points for triple
      if (stats.home_runs) points += stats.home_runs * 2; // 2 additional points for HR
      if (stats.walks) points += stats.walks * 0.5; // 0.5 points per walk
      if (stats.stolen_bases) points += stats.stolen_bases * 2; // 2 points per stolen base
      if (stats.caught_stealing) points -= stats.caught_stealing * 1; // -1 per caught stealing
    }

    if (stats.player_type === 'pitcher' || !stats.player_type) {
      // Pitching scoring
      if (stats.wins) points += stats.wins * 4; // 4 points per win
      if (stats.losses) points -= stats.losses * 2; // -2 points per loss
      if (stats.saves) points += stats.saves * 5; // 5 points per save
      if (stats.holds) points += stats.holds * 2; // 2 points per hold
      if (stats.strikeouts) points += stats.strikeouts * 1; // 1 point per strikeout
      if (stats.innings_pitched) points += stats.innings_pitched * 1; // 1 point per inning
      if (stats.hits_allowed) points -= stats.hits_allowed * 0.5; // -0.5 per hit allowed
      if (stats.walks_allowed) points -= stats.walks_allowed * 0.5; // -0.5 per walk allowed
      if (stats.earned_runs) points -= stats.earned_runs * 2; // -2 points per earned run
      if (stats.quality_starts) points += stats.quality_starts * 3; // 3 points per quality start
    }

    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate DraftKings fantasy points
   */
  private calculateDraftKingsPoints(stats: MLBRawStats): number {
    let points = 0;

    if (stats.player_type === 'hitter' || !stats.player_type) {
      // DraftKings hitting scoring
      if (stats.hits) points += stats.hits * 3; // 3 points per hit
      if (stats.doubles) points += stats.doubles * 2; // 2 additional points for double
      if (stats.triples) points += stats.triples * 5; // 5 additional points for triple
      if (stats.home_runs) points += stats.home_runs * 5; // 5 additional points for HR
      if (stats.runs) points += stats.runs * 2; // 2 points per run
      if (stats.rbis) points += stats.rbis * 2; // 2 points per RBI
      if (stats.walks) points += stats.walks * 2; // 2 points per walk
      if (stats.stolen_bases) points += stats.stolen_bases * 5; // 5 points per stolen base
      if (stats.hit_by_pitch) points += stats.hit_by_pitch * 2; // 2 points per HBP
    }

    if (stats.player_type === 'pitcher' || !stats.player_type) {
      // DraftKings pitching scoring
      if (stats.innings_pitched) points += stats.innings_pitched * 2.25; // 2.25 points per inning
      if (stats.strikeouts) points += stats.strikeouts * 2; // 2 points per strikeout
      if (stats.wins) points += stats.wins * 4; // 4 points per win
      if (stats.earned_runs) points -= stats.earned_runs * 2; // -2 points per earned run
      if (stats.hits_allowed) points -= stats.hits_allowed * 0.6; // -0.6 per hit allowed
      if (stats.walks_allowed) points -= stats.walks_allowed * 0.6; // -0.6 per walk allowed
      if (stats.hit_batters) points -= stats.hit_batters * 0.6; // -0.6 per HBP
      
      // Bonuses
      if (stats.complete_games) points += stats.complete_games * 2.5; // 2.5 bonus per CG
      if (stats.shutouts) points += stats.shutouts * 2.5; // 2.5 bonus per shutout
      if (stats.saves) points += stats.saves * 4.5; // 4.5 points per save
    }

    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate FanDuel fantasy points
   */
  private calculateFanDuelPoints(stats: MLBRawStats): number {
    let points = 0;

    if (stats.player_type === 'hitter' || !stats.player_type) {
      // FanDuel hitting scoring (similar to standard)
      if (stats.runs) points += stats.runs * 3.2; // 3.2 points per run
      if (stats.rbis) points += stats.rbis * 3.5; // 3.5 points per RBI
      if (stats.hits) points += stats.hits * 3; // 3 points per hit
      if (stats.doubles) points += stats.doubles * 1.5; // 1.5 additional for double
      if (stats.triples) points += stats.triples * 3; // 3 additional for triple
      if (stats.home_runs) points += stats.home_runs * 3.5; // 3.5 additional for HR
      if (stats.walks) points += stats.walks * 3; // 3 points per walk
      if (stats.stolen_bases) points += stats.stolen_bases * 6; // 6 points per stolen base
    }

    if (stats.player_type === 'pitcher' || !stats.player_type) {
      // FanDuel pitching scoring
      if (stats.innings_pitched) points += stats.innings_pitched * 3; // 3 points per inning
      if (stats.strikeouts) points += stats.strikeouts * 3; // 3 points per strikeout
      if (stats.wins) points += stats.wins * 6; // 6 points per win
      if (stats.quality_starts) points += stats.quality_starts * 4; // 4 points per QS
      if (stats.earned_runs) points -= stats.earned_runs * 3; // -3 points per earned run
      if (stats.hits_allowed) points -= stats.hits_allowed * 0.6; // -0.6 per hit allowed
      if (stats.walks_allowed) points -= stats.walks_allowed * 0.6; // -0.6 per walk allowed
      if (stats.saves) points += stats.saves * 6; // 6 points per save
    }

    return Math.round(points * 100) / 100;
  }

  /**
   * Calculate Yahoo fantasy points
   */
  private calculateYahooPoints(stats: MLBRawStats): number {
    // Yahoo uses similar scoring to standard
    return this.calculateStandardFantasyPoints(stats);
  }

  /**
   * Get position-specific stats breakdown
   */
  getPositionStats(stats: MLBProcessedStats, position: string): any {
    const pos = position.toUpperCase();
    
    if (pos === 'P' || pos === 'SP' || pos === 'RP' || pos === 'CP') {
      return {
        primary_stats: {
          innings_pitched: stats.innings_pitched,
          strikeouts: stats.strikeouts,
          era: stats.era,
          whip: stats.whip
        },
        results: {
          wins: stats.wins,
          losses: stats.losses,
          saves: stats.saves,
          holds: stats.holds,
          quality_starts: stats.quality_starts
        },
        efficiency: {
          k_per_9: stats.k_per_9,
          bb_per_9: stats.bb_per_9,
          hr_per_9: stats.hr_per_9
        }
      };
    } else {
      return {
        offensive_stats: {
          batting_average: stats.batting_average,
          home_runs: stats.home_runs,
          rbis: stats.rbis,
          runs: stats.runs,
          stolen_bases: stats.stolen_bases
        },
        power_stats: {
          slugging_percentage: stats.slugging_percentage,
          ops: stats.ops,
          doubles: stats.doubles,
          triples: stats.triples
        },
        plate_discipline: {
          walks: stats.walks,
          strikeouts: stats.strikeouts,
          on_base_percentage: stats.on_base_percentage
        }
      };
    }
  }

  /**
   * Calculate hitting performance grade
   */
  private calculateHittingGrade(stats: MLBRawStats): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
    let score = 0;
    
    // Batting average component
    if (stats.batting_average) {
      if (stats.batting_average >= 0.350) score += 25;
      else if (stats.batting_average >= 0.300) score += 20;
      else if (stats.batting_average >= 0.250) score += 15;
      else if (stats.batting_average >= 0.200) score += 10;
      else score += 5;
    }
    
    // Power component
    if (stats.home_runs) {
      if (stats.home_runs >= 3) score += 25;
      else if (stats.home_runs >= 2) score += 20;
      else if (stats.home_runs >= 1) score += 15;
      else score += 10;
    }
    
    // Production component (RBIs + Runs)
    const production = (stats.rbis || 0) + (stats.runs || 0);
    if (production >= 8) score += 25;
    else if (production >= 6) score += 20;
    else if (production >= 4) score += 15;
    else if (production >= 2) score += 10;
    else score += 5;
    
    // On-base component
    if (stats.on_base_percentage) {
      if (stats.on_base_percentage >= 0.400) score += 25;
      else if (stats.on_base_percentage >= 0.350) score += 20;
      else if (stats.on_base_percentage >= 0.300) score += 15;
      else if (stats.on_base_percentage >= 0.250) score += 10;
      else score += 5;
    }
    
    // Convert score to grade
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C+';
    if (score >= 50) return 'C';
    if (score >= 30) return 'D';
    return 'F';
  }

  /**
   * Calculate pitching performance grade
   */
  private calculatePitchingGrade(stats: MLBRawStats): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
    let score = 0;
    
    // ERA component
    if (stats.era) {
      if (stats.era <= 2.00) score += 25;
      else if (stats.era <= 3.00) score += 20;
      else if (stats.era <= 4.00) score += 15;
      else if (stats.era <= 5.00) score += 10;
      else score += 5;
    }
    
    // Strikeouts component
    if (stats.strikeouts) {
      if (stats.strikeouts >= 10) score += 25;
      else if (stats.strikeouts >= 8) score += 20;
      else if (stats.strikeouts >= 6) score += 15;
      else if (stats.strikeouts >= 4) score += 10;
      else score += 5;
    }
    
    // WHIP component
    if (stats.whip) {
      if (stats.whip <= 1.00) score += 25;
      else if (stats.whip <= 1.20) score += 20;
      else if (stats.whip <= 1.40) score += 15;
      else if (stats.whip <= 1.60) score += 10;
      else score += 5;
    }
    
    // Innings pitched component
    if (stats.innings_pitched) {
      if (stats.innings_pitched >= 7) score += 25;
      else if (stats.innings_pitched >= 6) score += 20;
      else if (stats.innings_pitched >= 5) score += 15;
      else if (stats.innings_pitched >= 3) score += 10;
      else score += 5;
    }
    
    // Convert score to grade
    if (score >= 90) return 'A+';
    if (score >= 85) return 'A';
    if (score >= 80) return 'B+';
    if (score >= 70) return 'B';
    if (score >= 60) return 'C+';
    if (score >= 50) return 'C';
    if (score >= 30) return 'D';
    return 'F';
  }

  /**
   * Calculate fielding performance grade
   */
  private calculateFieldingGrade(stats: MLBRawStats): 'A+' | 'A' | 'B+' | 'B' | 'C+' | 'C' | 'D' | 'F' {
    if (!stats.fielding_percentage) return 'C'; // Default if no fielding data
    
    if (stats.fielding_percentage >= 1.000) return 'A+';
    if (stats.fielding_percentage >= 0.990) return 'A';
    if (stats.fielding_percentage >= 0.980) return 'B+';
    if (stats.fielding_percentage >= 0.970) return 'B';
    if (stats.fielding_percentage >= 0.950) return 'C+';
    if (stats.fielding_percentage >= 0.900) return 'C';
    if (stats.fielding_percentage >= 0.850) return 'D';
    return 'F';
  }

  /**
   * Calculate position rank (simplified)
   */
  private calculatePositionRank(stats: MLBRawStats, position: string): number {
    const fantasyPoints = this.calculateStandardFantasyPoints(stats);
    
    // Position-based performance tiers
    const positionTiers = {
      'P': [25, 20, 15, 10, 5],
      'C': [20, 15, 12, 8, 5],
      '1B': [25, 20, 15, 12, 8],
      '2B': [20, 15, 12, 8, 5],
      '3B': [25, 20, 15, 12, 8],
      'SS': [22, 18, 14, 10, 6],
      'OF': [25, 20, 15, 12, 8]
    };

    const tiers = positionTiers[position as keyof typeof positionTiers] || positionTiers['OF'];
    
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
  private calculatePositionPercentile(stats: MLBRawStats, position: string): number {
    const rank = this.calculatePositionRank(stats, position);
    return Math.max(0, Math.min(100, 100 - (rank - 1) * 10));
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
        hitting: {
          single: 3,
          double: 5,
          triple: 8,
          home_run: 10,
          rbi: 2,
          run: 2,
          walk: 2,
          hit_by_pitch: 2,
          stolen_base: 5
        },
        pitching: {
          innings_pitched: 2.25,
          strikeout: 2,
          win: 4,
          earned_run: -2,
          hit_allowed: -0.6,
          walk_allowed: -0.6,
          hit_batter: -0.6,
          complete_game_bonus: 2.5,
          shutout_bonus: 2.5,
          save: 4.5
        }
      },
      FanDuel: {
        hitting: {
          single: 3,
          double: 6,
          triple: 9,
          home_run: 12,
          rbi: 3.5,
          run: 3.2,
          walk: 3,
          stolen_base: 6
        },
        pitching: {
          innings_pitched: 3,
          strikeout: 3,
          win: 6,
          quality_start: 4,
          earned_run: -3,
          hit_allowed: -0.6,
          walk_allowed: -0.6,
          save: 6
        }
      }
    };
  }
}

// Export singleton instance
export const mlbStatsAdapter = new MLBStatsAdapter();
export default mlbStatsAdapter;
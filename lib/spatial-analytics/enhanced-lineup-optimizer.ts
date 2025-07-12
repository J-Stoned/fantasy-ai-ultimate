/**
 * Enhanced Fantasy Lineup Optimizer with Spatial Analytics
 * Integrates Dr. Thorne's spatial methodologies into lineup decisions
 */

import { createClient } from '@/lib/supabase/server';
import { xgModel } from './xg-model';
import { basketballPitchControl, soccerPitchControl, footballPitchControl } from './pitch-control';
import { movementAnalyzer } from './movement-patterns';

export interface SpatialPlayerProjection {
  player_id: string;
  name: string;
  position: string[];
  team: string;
  
  // Traditional projections
  base_projection: number;
  salary: number;
  
  // Spatial enhancements
  xg_contribution: number;
  space_creation_value: number;
  movement_efficiency: number;
  defensive_disruption: number;
  
  // Pattern synergies
  spatial_synergies: Array<{
    with_player: string;
    synergy_score: number;
    pattern_type: string;
  }>;
  
  // Total enhanced projection
  enhanced_projection: number;
  confidence_interval: [number, number];
}

export interface SpatialLineupOptimization {
  lineup: SpatialPlayerProjection[];
  
  // Traditional metrics
  total_projection: number;
  total_salary: number;
  
  // Spatial metrics
  team_spacing_score: number;
  offensive_synergy: number;
  defensive_coverage: number;
  
  // Insights
  key_advantages: string[];
  spatial_edges: Array<{
    description: string;
    impact: number;
  }>;
}

export class EnhancedLineupOptimizer {
  private supabase = createClient();
  
  /**
   * Optimize lineup with spatial analytics
   */
  async optimizeWithSpatialAnalytics(options: {
    sport: 'basketball' | 'soccer' | 'football';
    format: 'season_long' | 'dfs';
    salary_cap?: number;
    game_ids?: string[];
    existing_lineup?: string[]; // Player IDs already selected
    position_requirements?: Record<string, number>;
  }): Promise<SpatialLineupOptimization> {
    
    // Get available players with their tracking data
    const players = await this.getPlayersWithSpatialData(options);
    
    // Calculate spatial projections for each player
    const spatialProjections = await Promise.all(
      players.map(player => this.calculateSpatialProjection(player, options))
    );
    
    // Calculate player synergies
    const projectionsWithSynergies = await this.calculateSpatialSynergies(
      spatialProjections,
      options
    );
    
    // Build optimal lineup considering spatial factors
    const optimalLineup = await this.buildSpatiallyOptimalLineup(
      projectionsWithSynergies,
      options
    );
    
    return optimalLineup;
  }
  
  /**
   * Get players with their spatial/tracking data
   */
  private async getPlayersWithSpatialData(options: any) {
    let query = this.supabase
      .from('players')
      .select(`
        id,
        name,
        position,
        team,
        player_stats!inner(
          fantasy_points,
          stat_value
        ),
        player_game_logs!inner(
          tracking_data,
          computed_metrics
        )
      `)
      .eq('sport', options.sport);
    
    if (options.game_ids?.length) {
      query = query.in('player_game_logs.game_id', options.game_ids);
    }
    
    const { data: players, error } = await query.limit(200);
    
    if (error) throw error;
    return players || [];
  }
  
  /**
   * Calculate enhanced projection using spatial analytics
   */
  private async calculateSpatialProjection(
    player: any,
    options: any
  ): Promise<SpatialPlayerProjection> {
    
    // Get base projection from traditional stats
    const baseProjection = this.calculateBaseProjection(player);
    
    // Calculate xG contribution (for applicable sports)
    let xgContribution = 0;
    if (options.sport === 'soccer' || options.sport === 'basketball') {
      const playerXG = await xgModel.getPlayerXGPerformance(player.id);
      if (playerXG) {
        xgContribution = playerXG.xg_difference * 2; // Points for exceeding xG
      }
    }
    
    // Get movement patterns and space creation value
    let spaceCreationValue = 0;
    let movementEfficiency = 0;
    let defensiveDisruption = 0;
    
    try {
      const recentGames = player.player_game_logs
        ?.map((log: any) => log.game_id)
        ?.slice(0, 5) || [];
        
      if (recentGames.length > 0) {
        const movementProfile = await movementAnalyzer.analyzePlayerMovement(
          player.id,
          recentGames,
          options.sport
        );
        
        spaceCreationValue = movementProfile.off_ball_value * 0.5;
        movementEfficiency = (movementProfile.total_distance / movementProfile.avg_speed) * 0.1;
        
        // Calculate defensive impact from movement patterns
        defensiveDisruption = movementProfile.movement_patterns
          .filter(p => p.pattern_type === 'press' || p.pattern_type === 'screen')
          .reduce((sum, p) => sum + p.success_rate * p.frequency, 0) * 0.3;
      }
    } catch (err) {
      // If no tracking data, use defaults
      console.log(`No tracking data for ${player.name}, using defaults`);
    }
    
    // Calculate enhanced projection
    const spatialBonus = xgContribution + spaceCreationValue + movementEfficiency + defensiveDisruption;
    const enhancedProjection = baseProjection + spatialBonus;
    
    // Simple confidence interval
    const confidence = 0.15; // 15% variance
    const confidenceInterval: [number, number] = [
      enhancedProjection * (1 - confidence),
      enhancedProjection * (1 + confidence)
    ];
    
    return {
      player_id: player.id,
      name: player.name,
      position: player.position,
      team: player.team,
      base_projection: baseProjection,
      salary: player.salary || this.estimateSalary(baseProjection),
      xg_contribution: xgContribution,
      space_creation_value: spaceCreationValue,
      movement_efficiency: movementEfficiency,
      defensive_disruption: defensiveDisruption,
      spatial_synergies: [], // Will be filled in next step
      enhanced_projection: enhancedProjection,
      confidence_interval: confidenceInterval,
    };
  }
  
  /**
   * Calculate spatial synergies between players
   */
  private async calculateSpatialSynergies(
    projections: SpatialPlayerProjection[],
    options: any
  ): Promise<SpatialPlayerProjection[]> {
    
    // For each player, calculate compatibility with potential teammates
    for (let i = 0; i < projections.length; i++) {
      const player1 = projections[i];
      const synergies: typeof player1.spatial_synergies = [];
      
      // Get players from same team
      const teammates = projections.filter(
        p => p.team === player1.team && p.player_id !== player1.player_id
      );
      
      for (const teammate of teammates) {
        try {
          // Use movement analyzer to check compatibility
          const compatibility = await movementAnalyzer.comparePlayerCompatibility(
            player1.player_id,
            teammate.player_id,
            [] // Would pass actual game IDs
          );
          
          if (compatibility.compatibility_score > 0.7) {
            synergies.push({
              with_player: teammate.player_id,
              synergy_score: compatibility.compatibility_score,
              pattern_type: compatibility.complementary_patterns[0] || 'spacing',
            });
          }
        } catch (err) {
          // Default synergy based on positions
          const positionSynergy = this.calculatePositionSynergy(
            player1.position,
            teammate.position
          );
          
          if (positionSynergy > 0.5) {
            synergies.push({
              with_player: teammate.player_id,
              synergy_score: positionSynergy,
              pattern_type: 'position_based',
            });
          }
        }
      }
      
      player1.spatial_synergies = synergies
        .sort((a, b) => b.synergy_score - a.synergy_score)
        .slice(0, 3); // Top 3 synergies
    }
    
    return projections;
  }
  
  /**
   * Build optimal lineup considering spatial factors
   */
  private async buildSpatiallyOptimalLineup(
    projections: SpatialPlayerProjection[],
    options: any
  ): Promise<SpatialLineupOptimization> {
    
    const positionRequirements = options.position_requirements || 
      this.getDefaultPositionRequirements(options.sport);
    
    // Sort players by value (projection / salary)
    const playersByValue = [...projections].sort((a, b) => {
      const valueA = a.enhanced_projection / (a.salary || 1);
      const valueB = b.enhanced_projection / (b.salary || 1);
      return valueB - valueA;
    });
    
    const lineup: SpatialPlayerProjection[] = [];
    let remainingSalary = options.salary_cap || Infinity;
    const positionsFilled: Record<string, number> = {};
    
    // Greedy algorithm with spatial considerations
    for (const player of playersByValue) {
      // Check salary constraint
      if (player.salary > remainingSalary) continue;
      
      // Check position constraint
      const canFillPosition = player.position.some(pos => {
        const filled = positionsFilled[pos] || 0;
        const required = positionRequirements[pos] || 0;
        return filled < required;
      });
      
      if (!canFillPosition) continue;
      
      // Check spatial synergy with existing lineup
      const synergyBonus = this.calculateLineupSynergyBonus(player, lineup);
      
      // Add player if synergy is positive or neutral
      if (synergyBonus >= -0.1) {
        lineup.push(player);
        remainingSalary -= player.salary;
        
        // Update positions filled
        const posToFill = player.position.find(pos => 
          (positionsFilled[pos] || 0) < (positionRequirements[pos] || 0)
        );
        if (posToFill) {
          positionsFilled[posToFill] = (positionsFilled[posToFill] || 0) + 1;
        }
      }
      
      // Check if lineup is complete
      const isComplete = Object.entries(positionRequirements).every(
        ([pos, req]) => (positionsFilled[pos] || 0) >= req
      );
      
      if (isComplete) break;
    }
    
    // Calculate lineup metrics
    const totalProjection = lineup.reduce((sum, p) => sum + p.enhanced_projection, 0);
    const totalSalary = lineup.reduce((sum, p) => sum + p.salary, 0);
    
    // Calculate spatial metrics
    const teamSpacingScore = this.calculateTeamSpacing(lineup);
    const offensiveSynergy = this.calculateOffensiveSynergy(lineup);
    const defensiveCoverage = this.calculateDefensiveCoverage(lineup);
    
    // Identify key advantages
    const keyAdvantages = this.identifyKeyAdvantages(lineup);
    const spatialEdges = this.identifySpatialEdges(lineup);
    
    return {
      lineup,
      total_projection: totalProjection,
      total_salary: totalSalary,
      team_spacing_score: teamSpacingScore,
      offensive_synergy: offensiveSynergy,
      defensive_coverage: defensiveCoverage,
      key_advantages: keyAdvantages,
      spatial_edges: spatialEdges,
    };
  }
  
  /**
   * Helper: Calculate base projection from traditional stats
   */
  private calculateBaseProjection(player: any): number {
    const recentStats = player.player_stats?.[0];
    if (!recentStats) return 0;
    
    // Use fantasy points if available
    if (recentStats.fantasy_points) {
      return recentStats.fantasy_points;
    }
    
    // Otherwise estimate from stat values
    const stats = recentStats.stat_value || {};
    let projection = 0;
    
    // Basketball scoring
    if (stats.points) projection += stats.points;
    if (stats.rebounds) projection += stats.rebounds * 1.2;
    if (stats.assists) projection += stats.assists * 1.5;
    if (stats.steals) projection += stats.steals * 3;
    if (stats.blocks) projection += stats.blocks * 3;
    if (stats.turnovers) projection -= stats.turnovers * 1;
    
    // Add other sport calculations as needed
    
    return projection;
  }
  
  /**
   * Helper: Estimate salary based on projection
   */
  private estimateSalary(projection: number): number {
    // Simple linear estimation
    return Math.round(3000 + projection * 200);
  }
  
  /**
   * Helper: Calculate position-based synergy
   */
  private calculatePositionSynergy(pos1: string[], pos2: string[]): number {
    const synergies: Record<string, Record<string, number>> = {
      'PG': { 'SG': 0.8, 'SF': 0.7, 'PF': 0.6, 'C': 0.9 },
      'SG': { 'PG': 0.8, 'SF': 0.7, 'PF': 0.6, 'C': 0.7 },
      'SF': { 'PG': 0.7, 'SG': 0.7, 'PF': 0.8, 'C': 0.7 },
      'PF': { 'PG': 0.6, 'SG': 0.6, 'SF': 0.8, 'C': 0.9 },
      'C': { 'PG': 0.9, 'SG': 0.7, 'SF': 0.7, 'PF': 0.9 },
    };
    
    let maxSynergy = 0;
    for (const p1 of pos1) {
      for (const p2 of pos2) {
        const synergy = synergies[p1]?.[p2] || 0.5;
        maxSynergy = Math.max(maxSynergy, synergy);
      }
    }
    
    return maxSynergy;
  }
  
  /**
   * Helper: Get default position requirements by sport
   */
  private getDefaultPositionRequirements(sport: string): Record<string, number> {
    const requirements: Record<string, Record<string, number>> = {
      'basketball': { 'PG': 1, 'SG': 1, 'SF': 1, 'PF': 1, 'C': 1, 'G': 1, 'F': 1, 'UTIL': 1 },
      'football': { 'QB': 1, 'RB': 2, 'WR': 3, 'TE': 1, 'FLEX': 1, 'DST': 1 },
      'soccer': { 'GK': 1, 'DEF': 4, 'MID': 4, 'FWD': 2 },
    };
    
    return requirements[sport] || {};
  }
  
  /**
   * Helper: Calculate synergy bonus for adding player to lineup
   */
  private calculateLineupSynergyBonus(
    player: SpatialPlayerProjection,
    lineup: SpatialPlayerProjection[]
  ): number {
    let totalBonus = 0;
    
    for (const teammate of lineup) {
      // Check if they have calculated synergy
      const synergy = player.spatial_synergies.find(
        s => s.with_player === teammate.player_id
      );
      
      if (synergy) {
        totalBonus += synergy.synergy_score * 0.1;
      }
    }
    
    return totalBonus;
  }
  
  /**
   * Helper: Calculate team spacing score
   */
  private calculateTeamSpacing(lineup: SpatialPlayerProjection[]): number {
    // Higher space creation values = better spacing
    const avgSpaceCreation = lineup.reduce(
      (sum, p) => sum + p.space_creation_value,
      0
    ) / lineup.length;
    
    return Math.min(avgSpaceCreation / 5, 1); // Normalize to 0-1
  }
  
  /**
   * Helper: Calculate offensive synergy
   */
  private calculateOffensiveSynergy(lineup: SpatialPlayerProjection[]): number {
    let totalSynergy = 0;
    let pairCount = 0;
    
    for (let i = 0; i < lineup.length; i++) {
      for (let j = i + 1; j < lineup.length; j++) {
        const synergy = lineup[i].spatial_synergies.find(
          s => s.with_player === lineup[j].player_id
        );
        
        if (synergy) {
          totalSynergy += synergy.synergy_score;
          pairCount++;
        }
      }
    }
    
    return pairCount > 0 ? totalSynergy / pairCount : 0.5;
  }
  
  /**
   * Helper: Calculate defensive coverage
   */
  private calculateDefensiveCoverage(lineup: SpatialPlayerProjection[]): number {
    const avgDefensiveDisruption = lineup.reduce(
      (sum, p) => sum + p.defensive_disruption,
      0
    ) / lineup.length;
    
    return Math.min(avgDefensiveDisruption / 3, 1); // Normalize to 0-1
  }
  
  /**
   * Helper: Identify key advantages
   */
  private identifyKeyAdvantages(lineup: SpatialPlayerProjection[]): string[] {
    const advantages: string[] = [];
    
    // Check for high xG performers
    const highXG = lineup.filter(p => p.xg_contribution > 2);
    if (highXG.length > 0) {
      advantages.push(`${highXG.length} elite finishers exceeding xG`);
    }
    
    // Check for space creators
    const spaceCreators = lineup.filter(p => p.space_creation_value > 3);
    if (spaceCreators.length > 0) {
      advantages.push(`${spaceCreators.length} elite space creators`);
    }
    
    // Check for strong synergies
    const strongSynergies = lineup.filter(
      p => p.spatial_synergies.some(s => s.synergy_score > 0.8)
    );
    if (strongSynergies.length > 2) {
      advantages.push('Multiple high-synergy player combinations');
    }
    
    return advantages;
  }
  
  /**
   * Helper: Identify spatial edges
   */
  private identifySpatialEdges(lineup: SpatialPlayerProjection[]): Array<{
    description: string;
    impact: number;
  }> {
    const edges: Array<{ description: string; impact: number }> = [];
    
    // Calculate total spatial bonus
    const totalSpatialBonus = lineup.reduce(
      (sum, p) => sum + (p.enhanced_projection - p.base_projection),
      0
    );
    
    if (totalSpatialBonus > 10) {
      edges.push({
        description: 'Significant spatial value advantage',
        impact: totalSpatialBonus,
      });
    }
    
    // Check for pattern combinations
    const screenAndCut = lineup.some(p1 => 
      p1.spatial_synergies.some(s => s.pattern_type === 'screen_and_cut')
    );
    
    if (screenAndCut) {
      edges.push({
        description: 'Screen-and-cut synergy activated',
        impact: 3.5,
      });
    }
    
    return edges;
  }
}

// Export singleton instance
export const enhancedOptimizer = new EnhancedLineupOptimizer();
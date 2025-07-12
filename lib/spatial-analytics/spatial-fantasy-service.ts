/**
 * Spatial Fantasy Service
 * Central service for integrating spatial analytics into fantasy projections
 */

import { createClient } from '@/lib/supabase/server';
import { xgModel } from './xg-model';
import { basketballPitchControl, soccerPitchControl, footballPitchControl } from './pitch-control';
import { movementAnalyzer } from './movement-patterns';
import { enhancedOptimizer } from './enhanced-lineup-optimizer';

export interface SpatialFantasyProjection {
  player_id: string;
  player_name: string;
  
  // Base fantasy projection
  traditional_projection: number;
  
  // Spatial components
  spatial_components: {
    expected_goals_bonus: number;
    space_creation_bonus: number;
    movement_efficiency_bonus: number;
    defensive_impact_bonus: number;
    synergy_bonus: number;
  };
  
  // Enhanced projection
  spatial_projection: number;
  projection_range: [number, number];
  
  // Insights
  key_advantages: string[];
  matchup_edges: string[];
  recommended_stacks: Array<{
    partner_id: string;
    partner_name: string;
    stack_bonus: number;
    reason: string;
  }>;
}

export interface TeamSpatialAnalysis {
  team_id: string;
  team_name: string;
  
  // Team-level metrics
  avg_pitch_control: number;
  offensive_efficiency: number;
  defensive_structure: number;
  
  // Player insights
  space_creators: string[];
  space_exploiters: string[];
  defensive_anchors: string[];
  
  // Matchup analysis
  vs_opponent: {
    spatial_advantages: string[];
    spatial_weaknesses: string[];
    exploit_zones: Array<{ x: number; y: number; control_diff: number }>;
  };
}

export class SpatialFantasyService {
  private supabase = createClient();
  
  /**
   * Get enhanced fantasy projection for a player
   */
  async getEnhancedPlayerProjection(
    playerId: string,
    options?: {
      opponent_id?: string;
      game_id?: string;
      include_synergies?: boolean;
    }
  ): Promise<SpatialFantasyProjection> {
    
    // Get player data
    const { data: player, error: playerError } = await this.supabase
      .from('players')
      .select(`
        *,
        player_stats(
          fantasy_points,
          stat_value
        ),
        player_game_logs(
          tracking_data,
          computed_metrics,
          stats
        )
      `)
      .eq('id', playerId)
      .single();
    
    if (playerError || !player) {
      throw new Error(`Player ${playerId} not found`);
    }
    
    // Calculate traditional projection
    const traditionalProjection = this.calculateTraditionalProjection(player);
    
    // Calculate spatial components
    const spatialComponents = await this.calculateSpatialComponents(
      player,
      options
    );
    
    // Calculate total spatial bonus
    const spatialBonus = Object.values(spatialComponents).reduce(
      (sum, val) => sum + val,
      0
    );
    
    const spatialProjection = traditionalProjection + spatialBonus;
    
    // Calculate projection range (confidence interval)
    const variance = spatialProjection * 0.15; // 15% variance
    const projectionRange: [number, number] = [
      spatialProjection - variance,
      spatialProjection + variance
    ];
    
    // Generate insights
    const keyAdvantages = this.identifyPlayerAdvantages(player, spatialComponents);
    const matchupEdges = await this.identifyMatchupEdges(player, options);
    const recommendedStacks = await this.findRecommendedStacks(player, options);
    
    return {
      player_id: playerId,
      player_name: player.name,
      traditional_projection: traditionalProjection,
      spatial_components: spatialComponents,
      spatial_projection: spatialProjection,
      projection_range: projectionRange,
      key_advantages: keyAdvantages,
      matchup_edges: matchupEdges,
      recommended_stacks: recommendedStacks,
    };
  }
  
  /**
   * Analyze team spatial dynamics
   */
  async analyzeTeamSpatialDynamics(
    teamId: string,
    opponentId?: string
  ): Promise<TeamSpatialAnalysis> {
    
    // Get team data
    const { data: team, error: teamError } = await this.supabase
      .from('teams')
      .select('*')
      .eq('id', teamId)
      .single();
    
    if (teamError || !team) {
      throw new Error(`Team ${teamId} not found`);
    }
    
    // Get recent games for analysis
    const { data: recentGames } = await this.supabase
      .from('games')
      .select('id')
      .or(`home_team_id.eq.${teamId},away_team_id.eq.${teamId}`)
      .order('game_date', { ascending: false })
      .limit(5);
    
    const gameIds = recentGames?.map(g => g.id) || [];
    
    // Calculate team-level spatial metrics
    const pitchControlMetrics = await this.calculateTeamPitchControl(teamId, gameIds);
    
    // Identify key players by role
    const spaceCreators = await this.identifySpaceCreators(teamId);
    const spaceExploiters = await this.identifySpaceExploiters(teamId);
    const defensiveAnchors = await this.identifyDefensiveAnchors(teamId);
    
    // Matchup analysis if opponent provided
    let vsOpponent = {
      spatial_advantages: [] as string[],
      spatial_weaknesses: [] as string[],
      exploit_zones: [] as Array<{ x: number; y: number; control_diff: number }>,
    };
    
    if (opponentId) {
      vsOpponent = await this.analyzeMatchupDynamics(teamId, opponentId);
    }
    
    return {
      team_id: teamId,
      team_name: team.name,
      avg_pitch_control: pitchControlMetrics.avg_control,
      offensive_efficiency: pitchControlMetrics.offensive_efficiency,
      defensive_structure: pitchControlMetrics.defensive_structure,
      space_creators: spaceCreators,
      space_exploiters: spaceExploiters,
      defensive_anchors: defensiveAnchors,
      vs_opponent: vsOpponent,
    };
  }
  
  /**
   * Generate optimal DFS lineup with spatial analytics
   */
  async generateSpatialDFSLineup(options: {
    sport: 'basketball' | 'soccer' | 'football';
    slate_games: string[];
    salary_cap: number;
    contest_type: 'cash' | 'gpp';
  }) {
    return enhancedOptimizer.optimizeWithSpatialAnalytics({
      sport: options.sport,
      format: 'dfs',
      salary_cap: options.salary_cap,
      game_ids: options.slate_games,
    });
  }
  
  /**
   * Real-time spatial updates during games
   */
  async getRealTimeSpatialUpdate(
    gameId: string,
    timestamp: number
  ): Promise<{
    pitch_control: any;
    key_events: Array<{
      time: number;
      type: string;
      spatial_impact: number;
      description: string;
    }>;
    momentum_shift: number;
  }> {
    
    // Get current pitch control
    const pitchControl = await basketballPitchControl.getRealTimePitchControl(
      gameId,
      timestamp
    );
    
    // Analyze recent events for spatial impact
    const keyEvents = await this.analyzeSpatialEvents(gameId, timestamp - 120, timestamp);
    
    // Calculate momentum based on control changes
    const momentumShift = await this.calculateMomentumShift(gameId, timestamp);
    
    return {
      pitch_control: pitchControl,
      key_events: keyEvents,
      momentum_shift: momentumShift,
    };
  }
  
  /**
   * Helper: Calculate traditional projection
   */
  private calculateTraditionalProjection(player: any): number {
    const recentStats = player.player_stats?.[0];
    if (!recentStats?.fantasy_points) {
      return 20; // Default projection
    }
    
    // Simple average of recent games
    const recentGames = player.player_game_logs?.slice(0, 5) || [];
    if (recentGames.length === 0) {
      return recentStats.fantasy_points;
    }
    
    const avgPoints = recentGames.reduce(
      (sum: number, game: any) => sum + (game.stats?.fantasy_points || 0),
      0
    ) / recentGames.length;
    
    return avgPoints;
  }
  
  /**
   * Helper: Calculate spatial components
   */
  private async calculateSpatialComponents(
    player: any,
    options?: any
  ): Promise<any> {
    
    const components = {
      expected_goals_bonus: 0,
      space_creation_bonus: 0,
      movement_efficiency_bonus: 0,
      defensive_impact_bonus: 0,
      synergy_bonus: 0,
    };
    
    // xG bonus (for applicable sports)
    if (player.sport === 'basketball' || player.sport === 'soccer') {
      const xgPerformance = await xgModel.getPlayerXGPerformance(player.id);
      if (xgPerformance) {
        components.expected_goals_bonus = xgPerformance.xg_difference * 2;
      }
    }
    
    // Movement pattern bonuses
    try {
      const recentGames = player.player_game_logs
        ?.map((log: any) => log.game_id)
        ?.slice(0, 5) || [];
      
      if (recentGames.length > 0) {
        const movement = await movementAnalyzer.analyzePlayerMovement(
          player.id,
          recentGames,
          player.sport
        );
        
        components.space_creation_bonus = movement.off_ball_value * 0.5;
        components.movement_efficiency_bonus = 
          (movement.avg_speed > 5 ? 2 : 0) + 
          (movement.acceleration_bursts > 10 ? 1 : 0);
        
        // Defensive bonus from patterns
        const defensivePatterns = movement.movement_patterns.filter(
          p => p.pattern_type === 'press' || p.pattern_type === 'drop_back'
        );
        components.defensive_impact_bonus = defensivePatterns.length * 0.5;
      }
    } catch (err) {
      // Default values if no tracking data
    }
    
    return components;
  }
  
  /**
   * Helper: Identify player advantages
   */
  private identifyPlayerAdvantages(
    player: any,
    spatialComponents: any
  ): string[] {
    const advantages: string[] = [];
    
    if (spatialComponents.expected_goals_bonus > 2) {
      advantages.push('Elite finisher exceeding xG');
    }
    
    if (spatialComponents.space_creation_bonus > 3) {
      advantages.push('Elite space creator');
    }
    
    if (spatialComponents.movement_efficiency_bonus > 2) {
      advantages.push('High-efficiency mover');
    }
    
    if (spatialComponents.defensive_impact_bonus > 1) {
      advantages.push('Strong defensive presence');
    }
    
    return advantages;
  }
  
  /**
   * Helper: Identify matchup edges
   */
  private async identifyMatchupEdges(
    player: any,
    options?: any
  ): Promise<string[]> {
    const edges: string[] = [];
    
    if (!options?.opponent_id) return edges;
    
    // Would analyze opponent's defensive weaknesses
    // and match against player's strengths
    
    // Placeholder edges
    if (player.position.includes('PG')) {
      edges.push('Opponent weak defending pick-and-roll');
    }
    
    if (player.sport === 'soccer' && player.position.includes('FWD')) {
      edges.push('Opponent high defensive line vulnerable to pace');
    }
    
    return edges;
  }
  
  /**
   * Helper: Find recommended stacking partners
   */
  private async findRecommendedStacks(
    player: any,
    options?: any
  ): Promise<any[]> {
    const stacks: any[] = [];
    
    // Get teammates
    const { data: teammates } = await this.supabase
      .from('players')
      .select('id, name, position')
      .eq('team', player.team)
      .neq('id', player.id)
      .limit(10);
    
    if (!teammates) return stacks;
    
    // Simple position-based stacking
    for (const teammate of teammates) {
      let stackBonus = 0;
      let reason = '';
      
      // Basketball stacks
      if (player.sport === 'basketball') {
        if (player.position.includes('PG') && teammate.position.includes('C')) {
          stackBonus = 3;
          reason = 'Pick-and-roll combination';
        } else if (
          player.position.includes('SG') && 
          teammate.position.includes('SF')
        ) {
          stackBonus = 2;
          reason = 'Wing synergy';
        }
      }
      
      // Soccer stacks
      if (player.sport === 'soccer') {
        if (
          player.position.includes('MID') && 
          teammate.position.includes('FWD')
        ) {
          stackBonus = 2.5;
          reason = 'Creator-finisher combination';
        }
      }
      
      if (stackBonus > 0) {
        stacks.push({
          partner_id: teammate.id,
          partner_name: teammate.name,
          stack_bonus: stackBonus,
          reason: reason,
        });
      }
    }
    
    return stacks.sort((a, b) => b.stack_bonus - a.stack_bonus).slice(0, 3);
  }
  
  /**
   * Helper: Calculate team pitch control metrics
   */
  private async calculateTeamPitchControl(
    teamId: string,
    gameIds: string[]
  ): Promise<any> {
    // Placeholder implementation
    // Would aggregate pitch control data across games
    
    return {
      avg_control: 0.52, // 52% average control
      offensive_efficiency: 0.65,
      defensive_structure: 0.71,
    };
  }
  
  /**
   * Helper: Identify space creators
   */
  private async identifySpaceCreators(teamId: string): Promise<string[]> {
    const { data: players } = await this.supabase
      .from('players')
      .select('id, name')
      .eq('team', teamId)
      .limit(20);
    
    // Would analyze movement patterns to identify creators
    // For now, return top players
    return players?.slice(0, 3).map(p => p.name) || [];
  }
  
  /**
   * Helper: Identify space exploiters
   */
  private async identifySpaceExploiters(teamId: string): Promise<string[]> {
    const { data: players } = await this.supabase
      .from('players')
      .select('id, name, position')
      .eq('team', teamId)
      .in('position', ['FWD', 'WR', 'SG'])
      .limit(10);
    
    return players?.slice(0, 3).map(p => p.name) || [];
  }
  
  /**
   * Helper: Identify defensive anchors
   */
  private async identifyDefensiveAnchors(teamId: string): Promise<string[]> {
    const { data: players } = await this.supabase
      .from('players')
      .select('id, name, position')
      .eq('team', teamId)
      .in('position', ['C', 'DEF', 'LB'])
      .limit(10);
    
    return players?.slice(0, 2).map(p => p.name) || [];
  }
  
  /**
   * Helper: Analyze matchup dynamics
   */
  private async analyzeMatchupDynamics(
    teamId: string,
    opponentId: string
  ): Promise<any> {
    // Placeholder analysis
    return {
      spatial_advantages: [
        'Superior pace in transition',
        'Better spacing in half-court',
      ],
      spatial_weaknesses: [
        'Vulnerable to opponent\'s press',
      ],
      exploit_zones: [
        { x: 75, y: 25, control_diff: 0.15 },
        { x: 20, y: 10, control_diff: 0.12 },
      ],
    };
  }
  
  /**
   * Helper: Analyze spatial events
   */
  private async analyzeSpatialEvents(
    gameId: string,
    startTime: number,
    endTime: number
  ): Promise<any[]> {
    // Would analyze play-by-play for spatial impact
    return [
      {
        time: startTime + 30,
        type: 'screen_assist',
        spatial_impact: 2.5,
        description: 'Screen created open three-pointer',
      },
      {
        time: startTime + 75,
        type: 'defensive_rotation',
        spatial_impact: -1.8,
        description: 'Late rotation led to open lane',
      },
    ];
  }
  
  /**
   * Helper: Calculate momentum shift
   */
  private async calculateMomentumShift(
    gameId: string,
    timestamp: number
  ): Promise<number> {
    // Would compare pitch control over time
    // Positive = home team gaining momentum
    return 0.15; // 15% shift toward home team
  }
}

// Export singleton instance
export const spatialFantasyService = new SpatialFantasyService();
import { createClient } from '@supabase/supabase-js';
import { logger } from '../../logging/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface WaiverPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  ownership: number;
  trendScore: number;
  projectedPoints: number;
  recentPerformance: number[];
  injuryStatus?: string;
  news?: string;
  faabValue: number;
  breakoutProbability: number;
  scheduleStrength: number;
  ros_rank?: number;
  opportunityScore: number;
  talentScore: number;
  situationScore: number;
  targetShare: number;
  snapShare: number;
  redZoneTargets: number;
  momementumScore: number;
}

export interface WaiverRecommendation {
  player: WaiverPlayer;
  priority: number;
  recommendedBid: number;
  reasoning: string[];
  confidence: 'Low' | 'Medium' | 'High' | 'Very High';
  urgency: 'Watch' | 'Consider' | 'Target' | 'Must Add';
}

export class WaiverRecommendationEngine {
  
  /**
   * Get comprehensive waiver recommendations based on league context
   */
  async getWaiverRecommendations(
    leagueId: string,
    userId: string,
    options: {
      positions?: string[];
      maxRecommendations?: number;
      budget?: number;
      strategy?: 'conservative' | 'balanced' | 'aggressive';
    } = {}
  ): Promise<WaiverRecommendation[]> {
    
    const {
      positions = ['QB', 'RB', 'WR', 'TE'],
      maxRecommendations = 20,
      budget = 100,
      strategy = 'balanced'
    } = options;

    try {
      // Get available players
      const availablePlayers = await this.getAvailablePlayers(leagueId, positions);
      
      // Get user roster context
      const rosterContext = await this.getUserRosterContext(leagueId, userId);
      
      // Get league settings
      const leagueSettings = await this.getLeagueSettings(leagueId);
      
      // Score and rank players
      const scoredPlayers = await Promise.all(
        availablePlayers.map(player => this.scorePlayer(player, rosterContext, leagueSettings))
      );

      // Generate recommendations
      const recommendations = scoredPlayers
        .sort((a, b) => b.overallScore - a.overallScore)
        .slice(0, maxRecommendations)
        .map((scored, index) => this.createRecommendation(scored, index + 1, budget, strategy));

      return recommendations;

    } catch (error) {
      logger.error('Error generating waiver recommendations:', { error: error });
      throw error;
    }
  }

  /**
   * Get available players not rostered in league
   */
  private async getAvailablePlayers(leagueId: string, positions: string[]): Promise<WaiverPlayer[]> {
    const { data: players, error } = await supabase
      .from('fantasy_players')
      .select(`
        id,
        name,
        position,
        team,
        projected_points,
        injury_status,
        recent_news,
        ownership_percentage,
        trend_score,
        breakout_probability,
        schedule_strength,
        ros_ranking,
        target_share,
        snap_share,
        red_zone_targets,
        opportunity_score,
        talent_score,
        situation_score
      `)
      .in('position', positions)
      .not('id', 'in', `(
        SELECT player_id FROM league_rosters 
        WHERE league_id = '${leagueId}'
      `)
      .gt('ownership_percentage', 1) // At least 1% owned
      .order('trend_score', { ascending: false })
      .limit(100);

    if (error) throw error;

    // Get recent performance data
    const playerIds = players?.map(p => p.id) || [];
    const recentStats = await this.getRecentPerformance(playerIds);

    return players?.map(player => ({
      id: player.id,
      name: player.name,
      position: player.position,
      team: player.team,
      ownership: player.ownership_percentage || 0,
      trendScore: player.trend_score || 50,
      projectedPoints: player.projected_points || 0,
      recentPerformance: recentStats[player.id] || [0, 0, 0, 0],
      injuryStatus: player.injury_status,
      news: player.recent_news,
      faabValue: this.calculateFAABValue(player),
      breakoutProbability: player.breakout_probability || 0,
      scheduleStrength: player.schedule_strength || 50,
      ros_rank: player.ros_ranking,
      opportunityScore: player.opportunity_score || 50,
      talentScore: player.talent_score || 50,
      situationScore: player.situation_score || 50,
      targetShare: player.target_share || 0,
      snapShare: player.snap_share || 0,
      redZoneTargets: player.red_zone_targets || 0,
      momementumScore: this.calculateMomentumScore(player)
    })) || [];
  }

  /**
   * Get recent performance data for players
   */
  private async getRecentPerformance(playerIds: string[]): Promise<{ [playerId: string]: number[] }> {
    const { data: stats, error } = await supabase
      .from('player_game_stats')
      .select('player_id, fantasy_points, week')
      .in('player_id', playerIds)
      .gte('week', new Date().getWeek() - 4) // Last 4 weeks
      .order('week', { ascending: false });

    if (error) return {};

    const performanceMap: { [playerId: string]: number[] } = {};
    
    stats?.forEach(stat => {
      if (!performanceMap[stat.player_id]) {
        performanceMap[stat.player_id] = [];
      }
      performanceMap[stat.player_id].push(stat.fantasy_points || 0);
    });

    // Pad with zeros if less than 4 weeks
    Object.keys(performanceMap).forEach(playerId => {
      while (performanceMap[playerId].length < 4) {
        performanceMap[playerId].push(0);
      }
    });

    return performanceMap;
  }

  /**
   * Get user's roster context for recommendations
   */
  private async getUserRosterContext(leagueId: string, userId: string) {
    const { data: roster, error } = await supabase
      .from('league_rosters')
      .select(`
        position,
        fantasy_players!inner(
          name,
          position,
          projected_points,
          injury_status
        )
      `)
      .eq('league_id', leagueId)
      .eq('user_id', userId);

    if (error) throw error;

    const positionCounts = roster?.reduce((acc, player) => {
      const pos = player.fantasy_players.position;
      acc[pos] = (acc[pos] || 0) + 1;
      return acc;
    }, {} as { [position: string]: number }) || {};

    const injuredPlayers = roster?.filter(player => 
      player.fantasy_players.injury_status && 
      player.fantasy_players.injury_status !== 'Healthy'
    ) || [];

    return {
      positionCounts,
      injuredPlayers,
      totalRosterSize: roster?.length || 0
    };
  }

  /**
   * Get league settings for context
   */
  private async getLeagueSettings(leagueId: string) {
    const { data: league, error } = await supabase
      .from('fantasy_leagues')
      .select('settings')
      .eq('id', leagueId)
      .single();

    if (error) throw error;

    return league?.settings || {
      rosterSize: 16,
      startingLineup: { QB: 1, RB: 2, WR: 2, TE: 1, FLEX: 1, K: 1, DST: 1 },
      faabBudget: 100,
      scoringType: 'PPR'
    };
  }

  /**
   * Score a player based on multiple factors
   */
  private async scorePlayer(
    player: WaiverPlayer, 
    rosterContext: any, 
    leagueSettings: any
  ): Promise<any> {
    
    const scores = {
      // Opportunity Score (0-100)
      opportunity: this.calculateOpportunityScore(player),
      
      // Talent Score (0-100)  
      talent: this.calculateTalentScore(player),
      
      // Positional Need Score (0-100)
      need: this.calculatePositionalNeed(player.position, rosterContext, leagueSettings),
      
      // Upside Score (0-100)
      upside: this.calculateUpsideScore(player),
      
      // Schedule Score (0-100)
      schedule: player.scheduleStrength,
      
      // Health Score (0-100)
      health: this.calculateHealthScore(player),
      
      // Value Score (0-100)
      value: this.calculateValueScore(player)
    };

    // Weight the scores
    const weights = {
      opportunity: 0.25,
      talent: 0.20,
      need: 0.15,
      upside: 0.15,
      schedule: 0.10,
      health: 0.10,
      value: 0.05
    };

    const overallScore = Object.entries(scores).reduce((total, [key, score]) => {
      return total + (score * weights[key as keyof typeof weights]);
    }, 0);

    return {
      ...player,
      scores,
      overallScore,
      reasoning: this.generateReasoning(player, scores)
    };
  }

  /**
   * Calculate opportunity score based on usage trends
   */
  private calculateOpportunityScore(player: WaiverPlayer): number {
    let score = 50; // Base score

    // Target/snap share
    score += (player.targetShare / 100) * 30;
    score += (player.snapShare / 100) * 20;
    
    // Red zone usage
    if (player.redZoneTargets > 2) score += 15;
    else if (player.redZoneTargets > 0) score += 5;
    
    // Trend momentum
    score += (player.trendScore - 50) * 0.3;

    return Math.min(100, Math.max(0, score));
  }

  /**
   * Calculate talent score
   */
  private calculateTalentScore(player: WaiverPlayer): number {
    return player.talentScore || 50;
  }

  /**
   * Calculate positional need score
   */
  private calculatePositionalNeed(
    position: string, 
    rosterContext: any, 
    leagueSettings: any
  ): number {
    const currentCount = rosterContext.positionCounts[position] || 0;
    const idealCount = this.getIdealPositionCount(position, leagueSettings);
    
    if (currentCount < idealCount) return 90;
    if (currentCount === idealCount) return 60;
    return 30;
  }

  /**
   * Calculate upside score
   */
  private calculateUpsideScore(player: WaiverPlayer): number {
    let score = player.breakoutProbability;
    
    // Age factor (younger = more upside)
    // This would need player age data
    
    // Recent performance trend
    const recentAvg = player.recentPerformance.reduce((a, b) => a + b, 0) / 4;
    if (recentAvg > player.projectedPoints) score += 20;
    
    return Math.min(100, score);
  }

  /**
   * Calculate health score
   */
  private calculateHealthScore(player: WaiverPlayer): number {
    if (!player.injuryStatus || player.injuryStatus === 'Healthy') return 100;
    if (player.injuryStatus === 'Questionable') return 70;
    if (player.injuryStatus === 'Doubtful') return 30;
    return 10; // Out
  }

  /**
   * Calculate value score (points per dollar of ownership)
   */
  private calculateValueScore(player: WaiverPlayer): number {
    const valueRatio = player.projectedPoints / Math.max(1, player.ownership);
    return Math.min(100, valueRatio * 10);
  }

  /**
   * Calculate FAAB value recommendation
   */
  private calculateFAABValue(player: any): number {
    const baseValue = Math.min(50, player.projected_points || 0);
    const trendMultiplier = (player.trend_score || 50) / 50;
    const ownershipDiscount = Math.max(0.5, 1 - (player.ownership_percentage || 0) / 100);
    
    return Math.round(baseValue * trendMultiplier * ownershipDiscount);
  }

  /**
   * Calculate momentum score
   */
  private calculateMomentumScore(player: any): number {
    // This would analyze recent trends in targets, snaps, etc.
    return player.trend_score || 50;
  }

  /**
   * Generate reasoning for recommendation
   */
  private generateReasoning(player: WaiverPlayer, scores: any): string[] {
    const reasons: string[] = [];

    if (scores.opportunity > 75) {
      reasons.push(`High opportunity score (${scores.opportunity.toFixed(0)}) with ${player.targetShare.toFixed(1)}% target share`);
    }

    if (scores.upside > 70) {
      reasons.push(`Strong breakout potential (${player.breakoutProbability}% probability)`);
    }

    if (scores.need > 80) {
      reasons.push(`Fills important positional need on your roster`);
    }

    if (player.scheduleStrength > 70) {
      reasons.push(`Favorable remaining schedule strength`);
    }

    if (player.ownership < 20) {
      reasons.push(`Low ownership (${player.ownership.toFixed(1)}%) - potential league winner`);
    }

    if (reasons.length === 0) {
      reasons.push(`Solid depth option with ${player.projectedPoints.toFixed(1)} projected points`);
    }

    return reasons;
  }

  /**
   * Create final recommendation
   */
  private createRecommendation(
    scoredPlayer: any,
    priority: number,
    budget: number,
    strategy: string
  ): WaiverRecommendation {
    
    const strategyMultipliers = {
      conservative: 0.7,
      balanced: 1.0,
      aggressive: 1.3
    };

    const basebid = scoredPlayer.faabValue;
    const adjustedBid = Math.round(basebid * strategyMultipliers[strategy as keyof typeof strategyMultipliers]);
    const recommendedBid = Math.min(budget * 0.4, adjustedBid); // Max 40% of budget

    let confidence: 'Low' | 'Medium' | 'High' | 'Very High' = 'Low';
    if (scoredPlayer.overallScore > 85) confidence = 'Very High';
    else if (scoredPlayer.overallScore > 70) confidence = 'High';
    else if (scoredPlayer.overallScore > 55) confidence = 'Medium';

    let urgency: 'Watch' | 'Consider' | 'Target' | 'Must Add' = 'Watch';
    if (scoredPlayer.overallScore > 80) urgency = 'Must Add';
    else if (scoredPlayer.overallScore > 65) urgency = 'Target';
    else if (scoredPlayer.overallScore > 50) urgency = 'Consider';

    return {
      player: scoredPlayer,
      priority,
      recommendedBid,
      reasoning: scoredPlayer.reasoning,
      confidence,
      urgency
    };
  }

  /**
   * Get ideal position count for roster construction
   */
  private getIdealPositionCount(position: string, leagueSettings: any): number {
    const lineup = leagueSettings.startingLineup;
    const flexCount = lineup.FLEX || 0;
    
    switch (position) {
      case 'QB': return (lineup.QB || 1) + 1; // +1 backup
      case 'RB': return (lineup.RB || 2) + flexCount + 1; // Can play flex
      case 'WR': return (lineup.WR || 2) + flexCount + 1; // Can play flex  
      case 'TE': return (lineup.TE || 1) + Math.min(1, flexCount) + 1; // Limited flex eligibility
      case 'K': return lineup.K || 1;
      case 'DST': return lineup.DST || 1;
      default: return 1;
    }
  }

  /**
   * Get trending players specifically
   */
  async getTrendingPlayers(options: {
    positions?: string[];
    trendThreshold?: number;
    limit?: number;
  } = {}): Promise<WaiverPlayer[]> {
    
    const { positions = ['QB', 'RB', 'WR', 'TE'], trendThreshold = 60, limit = 50 } = options;

    const { data: players, error } = await supabase
      .from('fantasy_players')
      .select('*')
      .in('position', positions)
      .gte('trend_score', trendThreshold)
      .order('trend_score', { ascending: false })
      .limit(limit);

    if (error) throw error;

    return players?.map(player => ({
      id: player.id,
      name: player.name,
      position: player.position,
      team: player.team,
      ownership: player.ownership_percentage || 0,
      trendScore: player.trend_score || 50,
      projectedPoints: player.projected_points || 0,
      recentPerformance: [0, 0, 0, 0], // Would load actual data
      faabValue: this.calculateFAABValue(player),
      breakoutProbability: player.breakout_probability || 0,
      scheduleStrength: player.schedule_strength || 50,
      opportunityScore: player.opportunity_score || 50,
      talentScore: player.talent_score || 50,
      situationScore: player.situation_score || 50,
      targetShare: player.target_share || 0,
      snapShare: player.snap_share || 0,
      redZoneTargets: player.red_zone_targets || 0,
      momementumScore: this.calculateMomentumScore(player)
    })) || [];
  }
}

// Extend Date prototype for week calculation
declare global {
  interface Date {
    getWeek(): number;
  }
}

Date.prototype.getWeek = function() {
  const date = new Date(this.getTime());
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + 3 - (date.getDay() + 6) % 7);
  const week1 = new Date(date.getFullYear(), 0, 4);
  return 1 + Math.round(((date.getTime() - week1.getTime()) / 86400000 - 3 + (week1.getDay() + 6) % 7) / 7);
};

export const waiverRecommendationEngine = new WaiverRecommendationEngine();
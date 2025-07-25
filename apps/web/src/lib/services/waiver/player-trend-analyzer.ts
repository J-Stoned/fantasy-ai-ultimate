import { createClient } from '@supabase/supabase-js';
import { logger } from '../../logging/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface TrendAnalysis {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  
  // Trend Metrics
  trendScore: number; // 0-100 overall trend score
  momentumScore: number; // Short-term momentum
  velocityScore: number; // Rate of change
  
  // Usage Trends
  targetTrend: TrendData;
  snapTrend: TrendData;
  touchTrend: TrendData;
  redZoneTrend: TrendData;
  
  // Performance Trends
  pointsTrend: TrendData;
  yardsTrend: TrendData;
  touchdownTrend: TrendData;
  
  // Context
  injuryContext: InjuryContext[];
  depthChartMovement: DepthChartChange[];
  gameScriptImpact: GameScriptAnalysis;
  
  // Projections
  shortTermProjection: number; // Next 2 weeks
  mediumTermProjection: number; // Next 4 weeks  
  seasonProjection: number; // Rest of season
  
  // Confidence & Risk
  confidenceLevel: number; // 0-100
  riskFactors: string[];
  opportunityFactors: string[];
  
  // Market Data
  ownershipTrend: TrendData;
  addDropTrend: TrendData;
  buzzScore: number; // Social/expert mentions
  
  lastUpdated: Date;
}

export interface TrendData {
  current: number;
  weekAgo: number;
  twoWeeksAgo: number;
  fourWeeksAgo: number;
  trend: 'increasing' | 'decreasing' | 'stable';
  changePercent: number;
  significance: 'high' | 'medium' | 'low';
}

export interface InjuryContext {
  playerId: string;
  playerName: string;
  injuryType: string;
  severity: 'minor' | 'moderate' | 'major';
  impactOnTarget: number; // How much it helps our target player
  timelineWeeks: number;
}

export interface DepthChartChange {
  week: number;
  oldPosition: number;
  newPosition: number;
  reason: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface GameScriptAnalysis {
  favorableGameScripts: number; // Percentage of games with favorable script
  averageGameScript: number; // Team's average game script
  scriptTrend: 'improving' | 'declining' | 'stable';
  upcomingGameScripts: number[]; // Next 4 weeks projected scripts
}

export class PlayerTrendAnalyzer {
  
  /**
   * Analyze trends for a specific player
   */
  async analyzePlayerTrends(playerId: string): Promise<TrendAnalysis> {
    try {
      // Get player basic info
      const playerInfo = await this.getPlayerInfo(playerId);
      
      // Get usage trends
      const usageTrends = await this.getUsageTrends(playerId);
      
      // Get performance trends  
      const performanceTrends = await this.getPerformanceTrends(playerId);
      
      // Get contextual data
      const context = await this.getContextualData(playerId);
      
      // Get market trends
      const marketTrends = await this.getMarketTrends(playerId);
      
      // Calculate composite scores
      const scores = this.calculateCompositeScores(usageTrends, performanceTrends, context);
      
      // Generate projections
      const projections = this.generateProjections(usageTrends, performanceTrends, context);
      
      // Assess risk and opportunity
      const riskAssessment = this.assessRiskAndOpportunity(context, usageTrends);

      return {
        playerId,
        playerName: playerInfo.name,
        position: playerInfo.position,
        team: playerInfo.team,
        
        trendScore: scores.overall,
        momentumScore: scores.momentum,
        velocityScore: scores.velocity,
        
        targetTrend: usageTrends.targets,
        snapTrend: usageTrends.snaps,
        touchTrend: usageTrends.touches,
        redZoneTrend: usageTrends.redZone,
        
        pointsTrend: performanceTrends.points,
        yardsTrend: performanceTrends.yards,
        touchdownTrend: performanceTrends.touchdowns,
        
        injuryContext: context.injuries,
        depthChartMovement: context.depthChart,
        gameScriptImpact: context.gameScript,
        
        shortTermProjection: projections.shortTerm,
        mediumTermProjection: projections.mediumTerm,
        seasonProjection: projections.season,
        
        confidenceLevel: scores.confidence,
        riskFactors: riskAssessment.risks,
        opportunityFactors: riskAssessment.opportunities,
        
        ownershipTrend: marketTrends.ownership,
        addDropTrend: marketTrends.addDrop,
        buzzScore: marketTrends.buzz,
        
        lastUpdated: new Date()
      };

    } catch (error) {
      logger.error('Error analyzing player trends:', { error: error });
      throw error;
    }
  }

  /**
   * Get trending players by various criteria
   */
  async getTrendingPlayers(options: {
    positions?: string[];
    trendDirection?: 'up' | 'down' | 'both';
    timeframe?: 'week' | 'month' | 'season';
    minOwnership?: number;
    maxOwnership?: number;
    limit?: number;
  } = {}): Promise<TrendAnalysis[]> {
    
    const {
      positions = ['QB', 'RB', 'WR', 'TE'],
      trendDirection = 'up',
      timeframe = 'month',
      minOwnership = 0,
      maxOwnership = 100,
      limit = 50
    } = options;

    // Get candidate players
    const { data: players, error } = await supabase
      .from('fantasy_players')
      .select('id')
      .in('position', positions)
      .gte('ownership_percentage', minOwnership)
      .lte('ownership_percentage', maxOwnership);

    if (error) throw error;

    // Analyze trends for each player
    const analyses = await Promise.all(
      (players || []).map(player => this.analyzePlayerTrends(player.id))
    );

    // Filter by trend direction
    const filtered = analyses.filter(analysis => {
      if (trendDirection === 'up') return analysis.trendScore > 60;
      if (trendDirection === 'down') return analysis.trendScore < 40;
      return true; // both
    });

    // Sort by trend score and limit
    return filtered
      .sort((a, b) => b.trendScore - a.trendScore)
      .slice(0, limit);
  }

  /**
   * Get player basic information
   */
  private async getPlayerInfo(playerId: string): Promise<any> {
    const { data: player, error } = await supabase
      .from('fantasy_players')
      .select('name, position, team')
      .eq('id', playerId)
      .single();

    if (error) throw error;
    return player;
  }

  /**
   * Get usage trend data
   */
  private async getUsageTrends(playerId: string): Promise<any> {
    const { data: stats, error } = await supabase
      .from('player_game_stats')
      .select(`
        week,
        targets,
        carries,
        snaps,
        snap_percentage,
        red_zone_targets,
        red_zone_carries
      `)
      .eq('player_id', playerId)
      .gte('week', new Date().getWeek() - 8)
      .order('week', { ascending: false });

    if (error) throw error;

    const recentStats = stats?.slice(0, 4) || []; // Last 4 weeks
    
    return {
      targets: this.calculateTrendData(recentStats.map(s => s.targets || 0)),
      snaps: this.calculateTrendData(recentStats.map(s => s.snap_percentage || 0)),
      touches: this.calculateTrendData(recentStats.map(s => (s.targets || 0) + (s.carries || 0))),
      redZone: this.calculateTrendData(recentStats.map(s => (s.red_zone_targets || 0) + (s.red_zone_carries || 0)))
    };
  }

  /**
   * Get performance trend data
   */
  private async getPerformanceTrends(playerId: string): Promise<any> {
    const { data: stats, error } = await supabase
      .from('player_game_stats')
      .select(`
        week,
        fantasy_points,
        receiving_yards,
        rushing_yards,
        passing_yards,
        touchdowns
      `)
      .eq('player_id', playerId)
      .gte('week', new Date().getWeek() - 8)
      .order('week', { ascending: false });

    if (error) throw error;

    const recentStats = stats?.slice(0, 4) || [];
    
    return {
      points: this.calculateTrendData(recentStats.map(s => s.fantasy_points || 0)),
      yards: this.calculateTrendData(recentStats.map(s => 
        (s.receiving_yards || 0) + (s.rushing_yards || 0) + (s.passing_yards || 0)
      )),
      touchdowns: this.calculateTrendData(recentStats.map(s => s.touchdowns || 0))
    };
  }

  /**
   * Get contextual data (injuries, depth chart, game script)
   */
  private async getContextualData(playerId: string): Promise<any> {
    // Get player's team
    const { data: player } = await supabase
      .from('fantasy_players')
      .select('team')
      .eq('id', playerId)
      .single();

    const team = player?.team;

    // Get injury context
    const injuries = await this.getInjuryContext(team);
    
    // Get depth chart changes
    const depthChart = await this.getDepthChartChanges(playerId);
    
    // Get game script analysis
    const gameScript = await this.getGameScriptAnalysis(team);

    return {
      injuries,
      depthChart,
      gameScript
    };
  }

  /**
   * Get market trend data
   */
  private async getMarketTrends(playerId: string): Promise<any> {
    const { data: trends, error } = await supabase
      .from('player_ownership_history')
      .select(`
        week,
        ownership_percentage,
        add_percentage,
        drop_percentage
      `)
      .eq('player_id', playerId)
      .gte('week', new Date().getWeek() - 4)
      .order('week', { ascending: false });

    if (error) {
      // Return default values if no data
      return {
        ownership: this.createDefaultTrendData(),
        addDrop: this.createDefaultTrendData(),
        buzz: 50
      };
    }

    const recent = trends?.slice(0, 4) || [];
    
    return {
      ownership: this.calculateTrendData(recent.map(t => t.ownership_percentage || 0)),
      addDrop: this.calculateTrendData(recent.map(t => (t.add_percentage || 0) - (t.drop_percentage || 0))),
      buzz: await this.calculateBuzzScore(playerId)
    };
  }

  /**
   * Calculate trend data from array of values
   */
  private calculateTrendData(values: number[]): TrendData {
    if (values.length < 2) {
      return this.createDefaultTrendData();
    }

    const [current, weekAgo, twoWeeksAgo, fourWeeksAgo] = values;
    
    // Calculate trend direction
    let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
    const changePercent = weekAgo > 0 ? ((current - weekAgo) / weekAgo) * 100 : 0;
    
    if (Math.abs(changePercent) < 10) {
      trend = 'stable';
    } else if (changePercent > 0) {
      trend = 'increasing';
    } else {
      trend = 'decreasing';
    }

    // Calculate significance
    let significance: 'high' | 'medium' | 'low' = 'low';
    if (Math.abs(changePercent) > 30) significance = 'high';
    else if (Math.abs(changePercent) > 15) significance = 'medium';

    return {
      current: current || 0,
      weekAgo: weekAgo || 0,
      twoWeeksAgo: twoWeeksAgo || 0,
      fourWeeksAgo: fourWeeksAgo || 0,
      trend,
      changePercent,
      significance
    };
  }

  /**
   * Create default trend data
   */
  private createDefaultTrendData(): TrendData {
    return {
      current: 0,
      weekAgo: 0,
      twoWeeksAgo: 0,
      fourWeeksAgo: 0,
      trend: 'stable',
      changePercent: 0,
      significance: 'low'
    };
  }

  /**
   * Calculate composite trend scores
   */
  private calculateCompositeScores(usageTrends: any, performanceTrends: any, context: any): any {
    // Overall trend score (0-100)
    let overall = 50; // Base score
    
    // Usage trend impact (40% weight)
    const usageScore = this.calculateUsageScore(usageTrends);
    overall += (usageScore - 50) * 0.4;
    
    // Performance trend impact (30% weight)
    const performanceScore = this.calculatePerformanceScore(performanceTrends);
    overall += (performanceScore - 50) * 0.3;
    
    // Context impact (30% weight)
    const contextScore = this.calculateContextScore(context);
    overall += (contextScore - 50) * 0.3;
    
    // Momentum score (recent velocity)
    const momentum = this.calculateMomentumScore(usageTrends, performanceTrends);
    
    // Velocity score (rate of change)
    const velocity = this.calculateVelocityScore(usageTrends, performanceTrends);
    
    // Confidence level
    const confidence = this.calculateConfidenceScore(usageTrends, performanceTrends);

    return {
      overall: Math.max(0, Math.min(100, overall)),
      momentum: Math.max(0, Math.min(100, momentum)),
      velocity: Math.max(0, Math.min(100, velocity)),
      confidence: Math.max(0, Math.min(100, confidence))
    };
  }

  /**
   * Calculate usage score from usage trends
   */
  private calculateUsageScore(usageTrends: any): number {
    let score = 50;
    
    // Target trend
    if (usageTrends.targets.trend === 'increasing') {
      score += usageTrends.targets.significance === 'high' ? 20 : 
               usageTrends.targets.significance === 'medium' ? 10 : 5;
    } else if (usageTrends.targets.trend === 'decreasing') {
      score -= usageTrends.targets.significance === 'high' ? 20 :
               usageTrends.targets.significance === 'medium' ? 10 : 5;
    }
    
    // Snap trend
    if (usageTrends.snaps.trend === 'increasing') {
      score += usageTrends.snaps.significance === 'high' ? 15 :
               usageTrends.snaps.significance === 'medium' ? 8 : 3;
    } else if (usageTrends.snaps.trend === 'decreasing') {
      score -= usageTrends.snaps.significance === 'high' ? 15 :
               usageTrends.snaps.significance === 'medium' ? 8 : 3;
    }
    
    // Red zone trend  
    if (usageTrends.redZone.trend === 'increasing') {
      score += 10;
    } else if (usageTrends.redZone.trend === 'decreasing') {
      score -= 10;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(performanceTrends: any): number {
    let score = 50;
    
    // Fantasy points trend
    if (performanceTrends.points.trend === 'increasing') {
      score += performanceTrends.points.significance === 'high' ? 25 :
               performanceTrends.points.significance === 'medium' ? 15 : 8;
    } else if (performanceTrends.points.trend === 'decreasing') {
      score -= performanceTrends.points.significance === 'high' ? 25 :
               performanceTrends.points.significance === 'medium' ? 15 : 8;
    }
    
    // Yards trend
    if (performanceTrends.yards.trend === 'increasing') {
      score += 10;
    } else if (performanceTrends.yards.trend === 'decreasing') {
      score -= 10;
    }
    
    // Touchdown trend
    if (performanceTrends.touchdowns.trend === 'increasing') {
      score += 15;
    } else if (performanceTrends.touchdowns.trend === 'decreasing') {
      score -= 15;
    }

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate context score
   */
  private calculateContextScore(context: any): number {
    let score = 50;
    
    // Injury context (positive if injuries to competitors)
    context.injuries.forEach((injury: InjuryContext) => {
      score += injury.impactOnTarget * 0.3;
    });
    
    // Depth chart movement
    context.depthChart.forEach((change: DepthChartChange) => {
      if (change.impact === 'positive') score += 15;
      else if (change.impact === 'negative') score -= 15;
    });
    
    // Game script
    if (context.gameScript.scriptTrend === 'improving') score += 10;
    else if (context.gameScript.scriptTrend === 'declining') score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /**
   * Calculate momentum score (short-term acceleration)
   */
  private calculateMomentumScore(usageTrends: any, performanceTrends: any): number {
    let momentum = 50;
    
    // Recent week-over-week changes
    const targetMomentum = usageTrends.targets.changePercent;
    const pointsMomentum = performanceTrends.points.changePercent;
    
    momentum += (targetMomentum * 0.3) + (pointsMomentum * 0.7);
    
    return momentum;
  }

  /**
   * Calculate velocity score (rate of change)
   */
  private calculateVelocityScore(usageTrends: any, performanceTrends: any): number {
    // Average rate of change across all metrics
    const velocities = [
      Math.abs(usageTrends.targets.changePercent),
      Math.abs(usageTrends.snaps.changePercent),
      Math.abs(performanceTrends.points.changePercent)
    ];
    
    const avgVelocity = velocities.reduce((a, b) => a + b, 0) / velocities.length;
    return Math.min(100, avgVelocity);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidenceScore(usageTrends: any, performanceTrends: any): number {
    let confidence = 50;
    
    // More data points = higher confidence
    const dataQuality = this.assessDataQuality(usageTrends, performanceTrends);
    confidence += dataQuality;
    
    // Consistent trends = higher confidence
    const consistency = this.assessTrendConsistency(usageTrends, performanceTrends);
    confidence += consistency;
    
    return confidence;
  }

  /**
   * Assess data quality for confidence calculation
   */
  private assessDataQuality(usageTrends: any, performanceTrends: any): number {
    // Check if we have complete data
    const hasTargetData = usageTrends.targets.current > 0;
    const hasPointsData = performanceTrends.points.current > 0;
    const hasSnapData = usageTrends.snaps.current > 0;
    
    let quality = 0;
    if (hasTargetData) quality += 15;
    if (hasPointsData) quality += 15;
    if (hasSnapData) quality += 10;
    
    return quality;
  }

  /**
   * Assess trend consistency
   */
  private assessTrendConsistency(usageTrends: any, performanceTrends: any): number {
    const trends = [
      usageTrends.targets.trend,
      usageTrends.snaps.trend,
      performanceTrends.points.trend
    ];
    
    // Count consistent positive/negative trends
    const increasing = trends.filter(t => t === 'increasing').length;
    const decreasing = trends.filter(t => t === 'decreasing').length;
    
    const consistency = Math.max(increasing, decreasing) / trends.length;
    return consistency * 25; // 0-25 points for consistency
  }

  /**
   * Generate projections based on trends
   */
  private generateProjections(usageTrends: any, performanceTrends: any, context: any): any {
    const baseProjection = performanceTrends.points.current || 0;
    
    // Short-term (2 weeks) - heavily weight recent trends
    const shortTerm = baseProjection * (1 + (usageTrends.targets.changePercent / 100) * 0.3);
    
    // Medium-term (4 weeks) - moderate trend impact
    const mediumTerm = baseProjection * (1 + (usageTrends.targets.changePercent / 100) * 0.2);
    
    // Season projection - consider all factors
    const seasonMultiplier = this.calculateSeasonMultiplier(usageTrends, context);
    const season = baseProjection * seasonMultiplier;

    return {
      shortTerm: Math.max(0, shortTerm),
      mediumTerm: Math.max(0, mediumTerm),
      season: Math.max(0, season)
    };
  }

  /**
   * Calculate season projection multiplier
   */
  private calculateSeasonMultiplier(usageTrends: any, context: any): number {
    let multiplier = 1.0;
    
    // Usage trend impact
    if (usageTrends.targets.trend === 'increasing') multiplier += 0.15;
    else if (usageTrends.targets.trend === 'decreasing') multiplier -= 0.15;
    
    // Context impact
    context.injuries.forEach((injury: InjuryContext) => {
      multiplier += (injury.impactOnTarget / 100) * 0.1;
    });
    
    return Math.max(0.5, Math.min(2.0, multiplier));
  }

  /**
   * Assess risk and opportunity factors
   */
  private assessRiskAndOpportunity(context: any, usageTrends: any): any {
    const risks: string[] = [];
    const opportunities: string[] = [];
    
    // Usage-based risks/opportunities
    if (usageTrends.targets.trend === 'decreasing' && usageTrends.targets.significance === 'high') {
      risks.push('Significant decline in target share over recent weeks');
    }
    
    if (usageTrends.snaps.trend === 'increasing' && usageTrends.snaps.significance === 'high') {
      opportunities.push('Increasing snap share indicates growing role');
    }
    
    // Injury-based factors
    context.injuries.forEach((injury: InjuryContext) => {
      if (injury.impactOnTarget > 50) {
        opportunities.push(`${injury.playerName} injury creates opportunity`);
      }
    });
    
    // Depth chart factors
    context.depthChart.forEach((change: DepthChartChange) => {
      if (change.impact === 'positive') {
        opportunities.push('Positive depth chart movement');
      } else if (change.impact === 'negative') {
        risks.push('Negative depth chart movement');
      }
    });

    return { risks, opportunities };
  }

  /**
   * Get injury context for team
   */
  private async getInjuryContext(team: string): Promise<InjuryContext[]> {
    // This would query injury reports and analyze impact
    // Placeholder implementation
    return [];
  }

  /**
   * Get depth chart changes for player
   */
  private async getDepthChartChanges(playerId: string): Promise<DepthChartChange[]> {
    // This would track depth chart position changes
    // Placeholder implementation
    return [];
  }

  /**
   * Get game script analysis for team
   */
  private async getGameScriptAnalysis(team: string): Promise<GameScriptAnalysis> {
    // This would analyze team's game scripts and trends
    // Placeholder implementation
    return {
      favorableGameScripts: 50,
      averageGameScript: 0,
      scriptTrend: 'stable',
      upcomingGameScripts: [0, 0, 0, 0]
    };
  }

  /**
   * Calculate buzz score from social/expert mentions
   */
  private async calculateBuzzScore(playerId: string): Promise<number> {
    // This would aggregate social media mentions, expert recommendations, etc.
    // Placeholder implementation
    return Math.floor(Math.random() * 100);
  }
}

export const playerTrendAnalyzer = new PlayerTrendAnalyzer();
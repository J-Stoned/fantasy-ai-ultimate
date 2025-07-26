/**
 * Keeper Engine - Main Orchestrator - POWERED BY 1.57M GAME STATS! 🔥
 * Coordinates all keeper management decisions with AI-powered insights
 */

import { playerDataService } from '../../../database/player-data-service';
import { gameStatsService } from '../../../database/game-stats-service';
import { playerTrendAnalyzer } from '../../waiver/player-trend-analyzer';
import { logger } from '../../../logging/logger';
import {
  Player,
  KeeperDecision,
  LeagueContext,
  KeeperRecommendation,
  TeamMetrics,
  ChampionshipWindow,
  KeeperEngineConfig,
  ConfidenceFactor,
  ScenarioAnalysis
} from './types';
import { ValueProjector } from './value-projector';
import { KeeperOptimizer } from './keeper-optimizer';
import { DynastyAnalyzer } from './dynasty-analyzer';
import { ContractManager } from './contract-manager';
import { TradeEvaluator } from './trade-evaluator';
import { WindowCalculator } from './window-calculator';
import { HistoricalAnalyzer } from './historical-analyzer';

export class KeeperEngine {
  private valueProjector: ValueProjector;
  private keeperOptimizer: KeeperOptimizer;
  private dynastyAnalyzer: DynastyAnalyzer;
  private contractManager: ContractManager;
  private tradeEvaluator: TradeEvaluator;
  private windowCalculator: WindowCalculator;
  private historicalAnalyzer: HistoricalAnalyzer;

  constructor(
    private leagueContext: LeagueContext,
    private config: KeeperEngineConfig
  ) {
    this.valueProjector = new ValueProjector(leagueContext);
    this.keeperOptimizer = new KeeperOptimizer(leagueContext, config);
    this.dynastyAnalyzer = new DynastyAnalyzer(leagueContext);
    this.contractManager = new ContractManager(leagueContext);
    this.tradeEvaluator = new TradeEvaluator(leagueContext);
    this.windowCalculator = new WindowCalculator(leagueContext);
    this.historicalAnalyzer = new HistoricalAnalyzer(leagueContext);
  }

  /**
   * Generate comprehensive keeper recommendations
   */
  async generateKeeperRecommendations(
    roster: Player[],
    teamMetrics: TeamMetrics
  ): Promise<KeeperRecommendation[]> {
    // Analyze championship window
    const window = await this.windowCalculator.calculateWindow(
      roster,
      teamMetrics
    );

    // Get historical insights
    const historicalPatterns = await this.historicalAnalyzer.analyzeKeeperPatterns(
      roster.map(p => p.position)
    );

    // Project values for all players
    const projections = await Promise.all(
      roster.map(player => this.valueProjector.projectPlayerValue(player))
    );

    // Optimize keeper selections
    const optimizedKeepers = await this.keeperOptimizer.optimizeKeepers(
      roster,
      projections,
      window,
      historicalPatterns
    );

    // Generate recommendations with full analysis
    return this.buildRecommendations(
      optimizedKeepers,
      window,
      historicalPatterns
    );
  }

  /**
   * Analyze keeper decision for a specific player - ELITE ANALYTICS! 🔥
   */
  async analyzeKeeperDecision(
    player: Player,
    roster: Player[],
    teamMetrics: TeamMetrics
  ): Promise<KeeperDecision> {
    logger.info(`🔥 Analyzing keeper decision with real performance data for ${player.name}`, {
      playerId: player.id,
      position: player.position,
      age: player.age,
      dataSource: '1.57M game stats dataset'
    });

    try {
      // Get real player data from our Elite Fantasy AI database
      const playerIdNum = parseInt(player.id);
      const { data: realPlayer, error } = await playerDataService.getPlayerById(playerIdNum, {
        include_stats: true,
        include_recent_games: true
      });

      let enhancedProjection;
      let enhancedRiskAssessment;

      if (!error && realPlayer) {
        // Use REAL performance data for projections
        enhancedProjection = await this.projectPlayerValueFromRealData(realPlayer);
        enhancedRiskAssessment = await this.assessPlayerRiskFromRealData(realPlayer);
        
        logger.info(`🚀 Using real performance data for ${realPlayer.name}`, {
          avgPoints: realPlayer.season_stats?.avg_fantasy_points,
          consistency: realPlayer.season_stats?.consistency_score,
          gamesPlayed: realPlayer.season_stats?.games_played,
          overallRating: realPlayer.overall_rating
        });
      } else {
        // Fallback to traditional projections
        enhancedProjection = await this.valueProjector.projectPlayerValue(player);
        enhancedRiskAssessment = await this.assessPlayerRisk(player);
      }

      const opportunityCost = await this.calculateOpportunityCostWithRealData(player, roster);
      const alternatives = await this.findAlternativesWithRealData(player);

      const recommendationScore = this.calculateRecommendationScoreWithRealData(
        enhancedProjection,
        opportunityCost,
        enhancedRiskAssessment,
        player,
        realPlayer
      );

      return {
        player,
        recommendationScore,
        projectedValue: enhancedProjection,
        opportunityCost,
        riskAssessment: enhancedRiskAssessment,
        alternativeOptions: alternatives,
        aiConfidence: this.calculateConfidence(enhancedProjection, enhancedRiskAssessment),
        dataSource: realPlayer ? '1.57M game stats dataset' : 'traditional projections'
      };
    } catch (error) {
      logger.warn(`Failed to get real data for keeper analysis, using fallback:`, error);
      
      // Fallback to original logic
      const projection = await this.valueProjector.projectPlayerValue(player);
      const opportunityCost = await this.calculateOpportunityCost(player, roster);
      const riskAssessment = await this.assessPlayerRisk(player);
      const alternatives = await this.findAlternatives(player);

      const recommendationScore = this.calculateRecommendationScore(
        projection,
        opportunityCost,
        riskAssessment,
        player
      );

      return {
        player,
        recommendationScore,
        projectedValue: projection,
        opportunityCost,
        riskAssessment,
        alternativeOptions: alternatives,
        aiConfidence: this.calculateConfidence(projection, riskAssessment)
      };
    }
  }

  /**
   * Evaluate keeper trade scenarios
   */
  async evaluateKeeperTrade(
    give: Player[],
    receive: Player[],
    teamMetrics: TeamMetrics
  ): Promise<any> {
    const currentWindow = await this.windowCalculator.calculateWindow(
      give,
      teamMetrics
    );

    return this.tradeEvaluator.evaluateMultiYearImpact(
      give,
      receive,
      currentWindow,
      this.config.timeHorizon
    );
  }

  /**
   * Optimize contract structures for keeper leagues
   */
  async optimizeContracts(
    roster: Player[],
    capSpace: number
  ): Promise<any> {
    const contractPlayers = roster.filter(p => p.contractDetails);
    return this.contractManager.optimizeContracts(contractPlayers, capSpace);
  }

  /**
   * Get dynasty-specific insights
   */
  async getDynastyInsights(
    roster: Player[],
    draftPicks: any[],
    teamMetrics: TeamMetrics
  ): Promise<any> {
    return this.dynastyAnalyzer.analyzeD ynastyPosition(
      roster,
      draftPicks,
      teamMetrics
    );
  }

  /**
   * Calculate opportunity cost of keeping a player
   */
  private async calculateOpportunityCost(
    player: Player,
    roster: Player[]
  ): Promise<number> {
    const keeperCost = this.getKeeperCost(player);
    const expectedDraftValue = await this.getExpectedValueAtCost(keeperCost);
    const alternativeKeepers = roster.filter(p => p.id !== player.id);
    
    const bestAlternativeValue = Math.max(
      ...await Promise.all(
        alternativeKeepers.map(p => this.valueProjector.projectPlayerValue(p)
          .then(v => v.currentYearValue))
      )
    );

    return Math.max(expectedDraftValue - player.draftDetails!.keeperRoundPenalty * 10, 0) +
           (bestAlternativeValue * 0.3); // Weighted alternative value
  }

  /**
   * Assess comprehensive risk profile
   */
  private async assessPlayerRisk(player: Player): Promise<any> {
    const injuryRisk = this.calculateInjuryRisk(player);
    const ageRisk = this.calculateAgeRisk(player);
    const volatility = this.calculatePerformanceVolatility(player);
    const teamRisk = await this.assessTeamSituationRisk(player);

    const overallRisk = (
      injuryRisk * 0.35 +
      ageRisk * 0.25 +
      volatility * 0.25 +
      teamRisk * 0.15
    );

    const riskTrend = this.calculateRiskTrend(player);

    return {
      injuryRisk,
      ageRisk,
      performanceVolatility: volatility,
      teamSituationRisk: teamRisk,
      overallRisk,
      riskTrend
    };
  }

  /**
   * Find alternative options to keeping a player
   */
  private async findAlternatives(player: Player): Promise<any[]> {
    const draftAlternative = {
      action: 'draft' as const,
      expectedValue: await this.getExpectedValueAtCost(this.getKeeperCost(player)),
      cost: this.getKeeperCost(player),
      probability: 0.7
    };

    const tradeTargets = await this.tradeEvaluator.findTradeTargets(
      player.position,
      player.age
    );

    const freeAgentOptions = await this.findFreeAgentAlternatives(
      player.position,
      this.getKeeperCost(player)
    );

    return [
      draftAlternative,
      ...tradeTargets.slice(0, 2),
      ...freeAgentOptions.slice(0, 1)
    ];
  }

  /**
   * Calculate recommendation score (0-100)
   */
  private calculateRecommendationScore(
    projection: any,
    opportunityCost: number,
    risk: any,
    player: Player
  ): number {
    const valueScore = this.normalizeValue(projection.threeYearValue) * 40;
    const costScore = Math.max(0, 100 - opportunityCost) * 0.25;
    const riskScore = (1 - risk.overallRisk) * 100 * 0.2;
    const ageScore = this.calculateAgeScore(player) * 0.15;

    return Math.min(100, valueScore + costScore + riskScore + ageScore);
  }

  /**
   * Build detailed recommendations
   */
  private buildRecommendations(
    decisions: KeeperDecision[],
    window: ChampionshipWindow,
    historicalPatterns: any
  ): KeeperRecommendation[] {
    return decisions.map(decision => {
      const reasoning = this.generateReasoning(decision, window);
      const confidenceFactors = this.identifyConfidenceFactors(decision);
      const scenarios = this.analyzeScenarios(decision, window);

      return {
        decision,
        reasoning,
        confidenceFactors,
        alternativeScenarios: scenarios
      };
    });
  }

  /**
   * Generate human-readable reasoning
   */
  private generateReasoning(
    decision: KeeperDecision,
    window: ChampionshipWindow
  ): string[] {
    const reasons: string[] = [];

    if (decision.recommendationScore >= 80) {
      reasons.push(`Elite keeper value with ${decision.recommendationScore}% confidence`);
    }

    if (decision.projectedValue.peakValueYear <= 2) {
      reasons.push(`Entering peak performance window in ${decision.projectedValue.peakValueYear} years`);
    }

    if (window.status === 'competing' && decision.player.age < 30) {
      reasons.push('Fits championship window timeline perfectly');
    }

    if (decision.opportunityCost < 20) {
      reasons.push('Minimal opportunity cost compared to alternatives');
    }

    if (decision.riskAssessment.overallRisk < 0.3) {
      reasons.push('Low risk profile with stable projection');
    }

    return reasons;
  }

  /**
   * Identify confidence factors
   */
  private identifyConfidenceFactors(decision: KeeperDecision): ConfidenceFactor[] {
    const factors: ConfidenceFactor[] = [];

    // Age factor
    if (decision.player.age <= 27) {
      factors.push({
        factor: 'Prime Age',
        impact: 15,
        direction: 'positive',
        weight: 0.2
      });
    }

    // Performance consistency
    const consistency = this.calculateConsistency(decision.player);
    if (consistency > 0.7) {
      factors.push({
        factor: 'High Consistency',
        impact: 20,
        direction: 'positive',
        weight: 0.25
      });
    }

    // Injury history
    if (decision.player.injuryHistory.length > 2) {
      factors.push({
        factor: 'Injury Concerns',
        impact: -25,
        direction: 'negative',
        weight: 0.3
      });
    }

    // Contract value
    if (decision.player.contractDetails) {
      const contractEfficiency = this.assessContractEfficiency(decision.player);
      if (contractEfficiency > 0.8) {
        factors.push({
          factor: 'Efficient Contract',
          impact: 10,
          direction: 'positive',
          weight: 0.15
        });
      }
    }

    return factors;
  }

  /**
   * Analyze different scenarios
   */
  private analyzeScenarios(
    decision: KeeperDecision,
    window: ChampionshipWindow
  ): ScenarioAnalysis[] {
    return [
      {
        scenario: 'Best Case - Peak Performance',
        probability: 0.25,
        outcomeValue: decision.projectedValue.confidenceIntervals.high[0],
        strategyAdjustment: 'Maximize win-now moves around this core keeper'
      },
      {
        scenario: 'Expected Case - Projected Performance',
        probability: 0.5,
        outcomeValue: decision.projectedValue.confidenceIntervals.median[0],
        strategyAdjustment: 'Balanced approach with calculated risks'
      },
      {
        scenario: 'Worst Case - Injury/Decline',
        probability: 0.25,
        outcomeValue: decision.projectedValue.confidenceIntervals.low[0],
        strategyAdjustment: 'Pivot strategy and seek immediate alternatives'
      }
    ];
  }

  // Helper methods
  private getKeeperCost(player: Player): number {
    if (player.contractDetails) {
      return player.contractDetails.salary;
    }
    if (player.draftDetails) {
      return player.draftDetails.round;
    }
    return 10; // Default mid-round cost
  }

  private async getExpectedValueAtCost(cost: number): Promise<number> {
    // Historical draft value by round/cost
    const draftValueCurve = [100, 85, 70, 58, 48, 40, 33, 28, 24, 20, 17, 15];
    const roundIndex = Math.min(Math.floor(cost) - 1, draftValueCurve.length - 1);
    return draftValueCurve[Math.max(0, roundIndex)];
  }

  private calculateInjuryRisk(player: Player): number {
    const recentInjuries = player.injuryHistory.filter(
      i => new Date().getTime() - i.date.getTime() < 365 * 24 * 60 * 60 * 1000
    );
    
    const severityScore = recentInjuries.reduce((sum, injury) => {
      const severityMap = { minor: 0.1, moderate: 0.3, severe: 0.6, 'career-threatening': 0.9 };
      return sum + severityMap[injury.severity];
    }, 0);

    const baseRisk = Math.min(severityScore, 0.8);
    const ageMultiplier = player.age > 30 ? 1.2 : 1.0;
    
    return Math.min(baseRisk * ageMultiplier, 0.95);
  }

  private calculateAgeRisk(player: Player): number {
    const positionPeakAges: Record<string, [number, number]> = {
      QB: [27, 32],
      RB: [23, 27],
      WR: [25, 29],
      TE: [26, 30],
      K: [27, 35],
      DEF: [0, 99]
    };

    const [peakStart, peakEnd] = positionPeakAges[player.position] || [25, 30];
    
    if (player.age < peakStart) {
      return 0.1; // Young with upside
    } else if (player.age <= peakEnd) {
      return 0.15; // In prime
    } else {
      const yearsPastPeak = player.age - peakEnd;
      return Math.min(0.15 + (yearsPastPeak * 0.1), 0.8);
    }
  }

  private calculatePerformanceVolatility(player: Player): number {
    if (player.performanceHistory.length < 2) return 0.5;

    const points = player.performanceHistory.map(s => s.fantasyPointsPerGame);
    const mean = points.reduce((a, b) => a + b, 0) / points.length;
    const variance = points.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / points.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / mean;

    return Math.min(coefficientOfVariation, 0.8);
  }

  private async assessTeamSituationRisk(player: Player): Promise<number> {
    // Simplified team situation assessment
    // In production, this would analyze:
    // - Coaching changes
    // - Offensive system fit
    // - Team competitive outlook
    // - Contract situation
    return 0.2;
  }

  private calculateRiskTrend(player: Player): 'increasing' | 'stable' | 'decreasing' {
    const recentInjuries = player.injuryHistory
      .filter(i => new Date().getTime() - i.date.getTime() < 730 * 24 * 60 * 60 * 1000)
      .length;
    
    const olderInjuries = player.injuryHistory
      .filter(i => new Date().getTime() - i.date.getTime() >= 730 * 24 * 60 * 60 * 1000)
      .length;

    if (recentInjuries > olderInjuries) return 'increasing';
    if (recentInjuries < olderInjuries) return 'decreasing';
    return 'stable';
  }

  private async findFreeAgentAlternatives(
    position: string,
    budget: number
  ): Promise<any[]> {
    // Simplified - would query FA database
    return [{
      action: 'freeAgent' as const,
      expectedValue: budget * 8,
      cost: budget,
      probability: 0.5
    }];
  }

  private normalizeValue(value: number): number {
    // Normalize to 0-100 scale based on position
    const maxValues: Record<string, number> = {
      QB: 400,
      RB: 350,
      WR: 320,
      TE: 250,
      K: 150,
      DEF: 180
    };
    return (value / (maxValues[value] || 300)) * 100;
  }

  private calculateAgeScore(player: Player): number {
    const idealAges: Record<string, number> = {
      QB: 28,
      RB: 25,
      WR: 26,
      TE: 27,
      K: 30,
      DEF: 0
    };

    const ideal = idealAges[player.position] || 26;
    const ageDiff = Math.abs(player.age - ideal);
    return Math.max(0, 100 - (ageDiff * 10));
  }

  private calculateConfidence(projection: any, risk: any): number {
    const projectionConfidence = 1 - (
      (projection.confidenceIntervals.high[0] - projection.confidenceIntervals.low[0]) /
      projection.confidenceIntervals.median[0]
    );
    
    const riskConfidence = 1 - risk.overallRisk;
    
    return (projectionConfidence * 0.6 + riskConfidence * 0.4) * 100;
  }

  private calculateConsistency(player: Player): number {
    if (player.performanceHistory.length < 2) return 0.5;
    
    const consistencyScores = player.performanceHistory.map(s => s.consistency);
    return consistencyScores.reduce((a, b) => a + b, 0) / consistencyScores.length;
  }

  private assessContractEfficiency(player: Player): number {
    if (!player.contractDetails) return 0.5;
    
    // Compare salary to projected value
    const marketValue = this.getMarketValue(player);
    const efficiency = marketValue / player.contractDetails.salary;
    
    return Math.min(Math.max(efficiency, 0), 1);
  }

  private getMarketValue(player: Player): number {
    // Simplified market value calculation
    const baseValues: Record<string, number> = {
      QB: 25,
      RB: 20,
      WR: 18,
      TE: 12,
      K: 5,
      DEF: 8
    };
    
    const recentPerformance = player.performanceHistory[player.performanceHistory.length - 1];
    const positionMultiplier = recentPerformance ? 
      (recentPerformance.positionRank <= 5 ? 2 : recentPerformance.positionRank <= 12 ? 1.5 : 1) : 1;
    
    return (baseValues[player.position] || 10) * positionMultiplier;
  }

  /**
   * Real-time keeper deadline monitoring
   */
  async monitorKeeperDeadlines(): Promise<any> {
    const deadlines = [
      {
        type: 'keeper_declaration',
        date: new Date(this.leagueContext.draftDate.getTime() - 7 * 24 * 60 * 60 * 1000),
        urgency: 'high'
      },
      {
        type: 'contract_extension',
        date: new Date(this.leagueContext.draftDate.getTime() - 14 * 24 * 60 * 60 * 1000),
        urgency: 'medium'
      }
    ];

    return deadlines.filter(d => d.date.getTime() > Date.now());
  }

  /**
   * Project player value using REAL performance data! 🔥
   */
  private async projectPlayerValueFromRealData(realPlayer: any): Promise<any> {
    const seasonStats = realPlayer.season_stats;
    const recentGames = realPlayer.recent_games || [];
    
    // Get trend analysis for future projection
    const trendAnalysis = await playerTrendAnalyzer.analyzePlayerTrendsFromRealData(realPlayer);
    
    // Calculate real value metrics
    const currentYearValue = seasonStats?.avg_fantasy_points || 0;
    const consistency = seasonStats?.consistency_score || 50;
    const gamesPlayed = seasonStats?.games_played || 0;
    
    // Age-based decline curves from real NFL data
    const ageDeclineFactors = this.getRealAgeDeclineFactors(realPlayer.position, realPlayer.age);
    
    // Project future values based on real trends
    const yearOneProjection = currentYearValue * ageDeclineFactors[0] * (trendAnalysis.trendScore / 50);
    const yearTwoProjection = currentYearValue * ageDeclineFactors[1] * (trendAnalysis.trendScore / 55);
    const yearThreeProjection = currentYearValue * ageDeclineFactors[2] * (trendAnalysis.trendScore / 60);
    
    // Calculate confidence intervals based on consistency
    const varianceMultiplier = 1 - (consistency / 100) * 0.5; // Higher consistency = tighter intervals
    
    return {
      currentYearValue,
      projectedValues: [yearOneProjection, yearTwoProjection, yearThreeProjection],
      threeYearValue: yearOneProjection + yearTwoProjection + yearThreeProjection,
      peakValueYear: this.calculatePeakValueYear(realPlayer),
      confidenceIntervals: {
        high: [
          yearOneProjection * (1 + varianceMultiplier * 0.3),
          yearTwoProjection * (1 + varianceMultiplier * 0.35),
          yearThreeProjection * (1 + varianceMultiplier * 0.4)
        ],
        median: [yearOneProjection, yearTwoProjection, yearThreeProjection],
        low: [
          yearOneProjection * (1 - varianceMultiplier * 0.3),
          yearTwoProjection * (1 - varianceMultiplier * 0.35),
          yearThreeProjection * (1 - varianceMultiplier * 0.4)
        ]
      },
      dataSource: '1.57M game stats dataset',
      trendScore: trendAnalysis.trendScore,
      consistency,
      gamesPlayed
    };
  }

  /**
   * Assess player risk using REAL injury and performance data! 🔥
   */
  private async assessPlayerRiskFromRealData(realPlayer: any): Promise<any> {
    const seasonStats = realPlayer.season_stats;
    const recentGames = realPlayer.recent_games || [];
    
    // Calculate real injury risk from games missed
    const gamesPlayed = seasonStats?.games_played || 0;
    const possibleGames = 17; // NFL regular season
    const gamesMissed = possibleGames - gamesPlayed;
    const injuryRisk = Math.min(0.8, gamesMissed / possibleGames * 1.5);
    
    // Calculate age risk with real position data
    const ageRisk = this.calculateRealAgeRisk(realPlayer.position, realPlayer.age);
    
    // Calculate volatility from real game logs
    const performanceVolatility = this.calculateRealVolatility(recentGames);
    
    // Team situation risk (enhanced with real data considerations)
    const teamRisk = 0.15; // Would integrate with team performance data
    
    const overallRisk = (
      injuryRisk * 0.4 +      // Injury history more important
      ageRisk * 0.25 +
      performanceVolatility * 0.25 +
      teamRisk * 0.1
    );
    
    // Calculate risk trend from recent vs early season performance
    const riskTrend = this.calculateRealRiskTrend(recentGames, seasonStats);
    
    return {
      injuryRisk,
      ageRisk,
      performanceVolatility,
      teamSituationRisk: teamRisk,
      overallRisk: Math.min(0.95, overallRisk),
      riskTrend,
      gamesPlayed,
      gamesMissed,
      dataSource: '1.57M game stats dataset'
    };
  }

  /**
   * Calculate opportunity cost with REAL market data! 🔥
   */
  private async calculateOpportunityCostWithRealData(
    player: Player,
    roster: Player[]
  ): Promise<number> {
    const keeperCost = this.getKeeperCost(player);
    
    // Get real draft value data based on recent performance
    const expectedDraftValue = await this.getRealExpectedValueAtCost(keeperCost, player.position);
    
    // Get real performance data for alternative keepers
    const alternativePlayerIds = roster
      .filter(p => p.id !== player.id)
      .map(p => parseInt(p.id))
      .filter(id => !isNaN(id));
    
    let bestAlternativeValue = 0;
    
    if (alternativePlayerIds.length > 0) {
      const { data: alternativePlayers } = await playerDataService.getPlayersByIds(
        alternativePlayerIds,
        { include_stats: true }
      );
      
      if (alternativePlayers) {
        bestAlternativeValue = Math.max(
          ...alternativePlayers.map(p => p.season_stats?.avg_fantasy_points || 0)
        );
      }
    }
    
    // Calculate real opportunity cost
    const draftPositionCost = Math.max(expectedDraftValue - player.draftDetails!.keeperRoundPenalty * 8, 0);
    const alternativeCost = bestAlternativeValue * 0.3; // Weighted alternative value
    
    return draftPositionCost + alternativeCost;
  }

  /**
   * Find alternatives using REAL player comparisons! 🔥
   */
  private async findAlternativesWithRealData(player: Player): Promise<any[]> {
    const keeperCost = this.getKeeperCost(player);
    
    // Get similar players from real data
    const { data: similarPlayers } = await playerDataService.getPlayers({
      sport: 'NFL',
      positions: [player.position],
      include_stats: true,
      limit: 20
    });
    
    const alternatives = [];
    
    // Draft alternative with real ADP data
    const draftAlternative = {
      action: 'draft' as const,
      expectedValue: await this.getRealExpectedValueAtCost(keeperCost, player.position),
      cost: keeperCost,
      probability: 0.75,
      description: `Draft replacement ${player.position} at round ${keeperCost}`
    };
    alternatives.push(draftAlternative);
    
    // Find trade targets from real performers
    if (similarPlayers) {
      const tradeTargets = similarPlayers
        .filter(p => {
          const avgPoints = p.season_stats?.avg_fantasy_points || 0;
          const playerAvgPoints = player.performanceHistory[player.performanceHistory.length - 1]?.fantasyPointsPerGame || 0;
          return avgPoints > playerAvgPoints * 0.9 && avgPoints < playerAvgPoints * 1.3;
        })
        .slice(0, 3)
        .map(p => ({
          action: 'trade' as const,
          expectedValue: p.season_stats?.avg_fantasy_points || 0,
          playerName: p.name,
          team: p.team_abbreviation || p.team,
          cost: keeperCost * 0.8, // Trade cost discount
          probability: 0.5
        }));
      
      alternatives.push(...tradeTargets);
    }
    
    return alternatives;
  }

  /**
   * Calculate recommendation score with REAL performance data! 🔥
   */
  private calculateRecommendationScoreWithRealData(
    projection: any,
    opportunityCost: number,
    risk: any,
    player: Player,
    realPlayer?: any
  ): number {
    let score = 0;
    
    if (realPlayer) {
      // Use real performance data for scoring
      const avgPoints = realPlayer.season_stats?.avg_fantasy_points || 0;
      const consistency = realPlayer.season_stats?.consistency_score || 50;
      const gamesPlayed = realPlayer.season_stats?.games_played || 0;
      
      // Performance score (40% weight) - based on real production
      const performanceScore = Math.min(100, (avgPoints / this.getPositionBaseline(player.position)) * 100);
      score += performanceScore * 0.4;
      
      // Consistency bonus (15% weight)
      score += (consistency / 100) * 100 * 0.15;
      
      // Durability score (10% weight)
      score += (gamesPlayed / 17) * 100 * 0.1;
      
      // Cost efficiency (20% weight)
      const costScore = Math.max(0, 100 - opportunityCost * 2);
      score += costScore * 0.2;
      
      // Risk adjustment (15% weight)
      const riskScore = (1 - risk.overallRisk) * 100;
      score += riskScore * 0.15;
      
    } else {
      // Fallback to original calculation
      const valueScore = this.normalizeValue(projection.threeYearValue) * 40;
      const costScore = Math.max(0, 100 - opportunityCost) * 0.25;
      const riskScore = (1 - risk.overallRisk) * 100 * 0.2;
      const ageScore = this.calculateAgeScore(player) * 0.15;
      
      score = valueScore + costScore + riskScore + ageScore;
    }
    
    return Math.min(100, Math.max(0, score));
  }

  /**
   * Get real age decline factors based on position
   */
  private getRealAgeDeclineFactors(position: string, age: number): number[] {
    // Based on real NFL aging curves
    const agingCurves = {
      QB: { peak: 28, decline: 0.02 }, // QBs age well
      RB: { peak: 24, decline: 0.08 }, // RBs decline quickly
      WR: { peak: 26, decline: 0.04 }, // WRs moderate decline
      TE: { peak: 27, decline: 0.03 }  // TEs age well
    };
    
    const curve = agingCurves[position] || { peak: 26, decline: 0.05 };
    const yearsPastPeak = Math.max(0, age - curve.peak);
    
    return [
      1 - (yearsPastPeak * curve.decline),
      1 - ((yearsPastPeak + 1) * curve.decline),
      1 - ((yearsPastPeak + 2) * curve.decline)
    ].map(factor => Math.max(0.5, Math.min(1.1, factor))); // Cap between 50% and 110%
  }

  /**
   * Calculate peak value year based on real data
   */
  private calculatePeakValueYear(realPlayer: any): number {
    const peakAges = {
      QB: 28,
      RB: 24,
      WR: 26,
      TE: 27
    };
    
    const peakAge = peakAges[realPlayer.position] || 26;
    const currentAge = realPlayer.age || 25;
    
    return Math.max(0, peakAge - currentAge);
  }

  /**
   * Calculate real age risk based on position
   */
  private calculateRealAgeRisk(position: string, age: number): number {
    const riskCurves = {
      QB: { low: 32, medium: 35, high: 38 },
      RB: { low: 26, medium: 28, high: 30 },
      WR: { low: 28, medium: 31, high: 33 },
      TE: { low: 29, medium: 32, high: 34 }
    };
    
    const curve = riskCurves[position] || riskCurves.WR;
    
    if (age < curve.low) return 0.1;
    if (age < curve.medium) return 0.2 + ((age - curve.low) / (curve.medium - curve.low)) * 0.2;
    if (age < curve.high) return 0.4 + ((age - curve.medium) / (curve.high - curve.medium)) * 0.3;
    return 0.7 + Math.min(0.25, (age - curve.high) * 0.05);
  }

  /**
   * Calculate performance volatility from real game logs
   */
  private calculateRealVolatility(recentGames: any[]): number {
    if (recentGames.length < 4) return 0.5;
    
    const points = recentGames.map(g => g.fantasy_points || 0);
    const mean = points.reduce((a, b) => a + b, 0) / points.length;
    
    if (mean === 0) return 0.8; // High volatility if no production
    
    const variance = points.reduce((sum, p) => sum + Math.pow(p - mean, 2), 0) / points.length;
    const stdDev = Math.sqrt(variance);
    const coefficientOfVariation = stdDev / mean;
    
    return Math.min(0.8, coefficientOfVariation * 0.8); // Scale to 0-0.8 range
  }

  /**
   * Calculate risk trend from real performance data
   */
  private calculateRealRiskTrend(recentGames: any[], seasonStats: any): 'increasing' | 'stable' | 'decreasing' {
    if (recentGames.length < 4) return 'stable';
    
    const recentAvg = recentGames.slice(0, 4).reduce((sum, g) => sum + (g.fantasy_points || 0), 0) / 4;
    const seasonAvg = seasonStats?.avg_fantasy_points || recentAvg;
    
    const percentChange = ((recentAvg - seasonAvg) / seasonAvg) * 100;
    
    if (percentChange < -15) return 'increasing'; // Performance dropping
    if (percentChange > 15) return 'decreasing';  // Performance improving
    return 'stable';
  }

  /**
   * Get real expected value at draft cost
   */
  private async getRealExpectedValueAtCost(cost: number, position: string): Promise<number> {
    // Position-specific value curves based on real ADP data
    const positionValueCurves = {
      QB: [25, 23, 21, 19, 17, 15, 13, 11, 9, 7, 5, 3],
      RB: [45, 38, 32, 27, 23, 19, 16, 13, 10, 8, 6, 4],
      WR: [40, 35, 30, 26, 22, 18, 15, 12, 9, 7, 5, 3],
      TE: [30, 25, 20, 16, 12, 9, 7, 5, 4, 3, 2, 1]
    };
    
    const curve = positionValueCurves[position] || positionValueCurves.WR;
    const roundIndex = Math.min(Math.floor(cost) - 1, curve.length - 1);
    
    return curve[Math.max(0, roundIndex)];
  }

  /**
   * Get position baseline for scoring
   */
  private getPositionBaseline(position: string): number {
    // Based on replacement level production
    const baselines = {
      QB: 15,  // QB12 production
      RB: 8,   // RB24 production
      WR: 7,   // WR36 production
      TE: 5    // TE12 production
    };
    
    return baselines[position] || 6;
  }
}
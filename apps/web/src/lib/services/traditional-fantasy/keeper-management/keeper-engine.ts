/**
 * Keeper Engine - Main Orchestrator
 * Coordinates all keeper management decisions with AI-powered insights
 */

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
   * Analyze keeper decision for a specific player
   */
  async analyzeKeeperDecision(
    player: Player,
    roster: Player[],
    teamMetrics: TeamMetrics
  ): Promise<KeeperDecision> {
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
}
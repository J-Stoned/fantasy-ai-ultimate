/**
 * Keeper Optimizer - AI-Powered Optimal Keeper Selection
 * Uses machine learning patterns and multi-objective optimization
 */

import {
  Player,
  KeeperDecision,
  ValueProjection,
  LeagueContext,
  ChampionshipWindow,
  KeeperEngineConfig,
  RiskProfile,
  AlternativeOption
} from './types';

export class KeeperOptimizer {
  private readonly POSITION_SCARCITY: Record<string, number> = {
    RB: 1.3,
    WR: 1.0,
    QB: 0.8,
    TE: 1.1,
    K: 0.5,
    DEF: 0.6
  };

  constructor(
    private leagueContext: LeagueContext,
    private config: KeeperEngineConfig
  ) {}

  /**
   * Optimize keeper selections using AI
   */
  async optimizeKeepers(
    roster: Player[],
    projections: ValueProjection[],
    window: ChampionshipWindow,
    historicalPatterns: any
  ): Promise<KeeperDecision[]> {
    // Create decision matrix
    const decisions = await this.createDecisionMatrix(
      roster,
      projections,
      window
    );

    // Apply multi-objective optimization
    const optimized = this.multiObjectiveOptimization(
      decisions,
      window,
      historicalPatterns
    );

    // Select optimal keepers within constraints
    return this.selectOptimalKeepers(optimized);
  }

  /**
   * Create comprehensive decision matrix
   */
  private async createDecisionMatrix(
    roster: Player[],
    projections: ValueProjection[],
    window: ChampionshipWindow
  ): Promise<KeeperDecision[]> {
    const decisions: KeeperDecision[] = [];

    for (let i = 0; i < roster.length; i++) {
      const player = roster[i];
      const projection = projections[i];
      
      const decision = await this.evaluatePlayer(
        player,
        projection,
        window,
        roster
      );
      
      decisions.push(decision);
    }

    return decisions;
  }

  /**
   * Evaluate individual player keeper value
   */
  private async evaluatePlayer(
    player: Player,
    projection: ValueProjection,
    window: ChampionshipWindow,
    roster: Player[]
  ): Promise<KeeperDecision> {
    const keeperValue = this.calculateKeeperValue(player, projection, window);
    const opportunityCost = this.calculateOpportunityCost(player, projection, roster);
    const risk = this.assessRisk(player, projection);
    const alternatives = await this.findAlternatives(player, projection);
    const score = this.calculateDecisionScore(keeperValue, opportunityCost, risk, window);

    return {
      player,
      recommendationScore: score,
      projectedValue: projection,
      opportunityCost,
      riskAssessment: risk,
      alternativeOptions: alternatives,
      aiConfidence: this.calculateConfidence(projection, risk, window)
    };
  }

  /**
   * Calculate keeper-specific value
   */
  private calculateKeeperValue(
    player: Player,
    projection: ValueProjection,
    window: ChampionshipWindow
  ): number {
    // Base value from projections
    const baseValue = this.getWindowAdjustedValue(projection, window);
    
    // Position scarcity adjustment
    const scarcityMultiplier = this.POSITION_SCARCITY[player.position] || 1.0;
    
    // Keeper cost efficiency
    const costEfficiency = this.calculateCostEfficiency(player);
    
    // Age value (younger players more valuable in keeper)
    const ageValue = this.calculateAgeValue(player);
    
    // Contract/draft position value
    const positionalValue = this.calculatePositionalValue(player);
    
    return (
      baseValue * scarcityMultiplier * costEfficiency +
      ageValue * 20 +
      positionalValue * 15
    );
  }

  /**
   * Multi-objective optimization using Pareto efficiency
   */
  private multiObjectiveOptimization(
    decisions: KeeperDecision[],
    window: ChampionshipWindow,
    historicalPatterns: any
  ): KeeperDecision[] {
    // Define objectives
    const objectives = [
      (d: KeeperDecision) => d.projectedValue.threeYearValue, // Maximize value
      (d: KeeperDecision) => -d.opportunityCost, // Minimize opportunity cost
      (d: KeeperDecision) => -d.riskAssessment.overallRisk, // Minimize risk
      (d: KeeperDecision) => this.getWindowFit(d, window), // Maximize window fit
      (d: KeeperDecision) => this.getPositionalBalance(d, decisions) // Balance positions
    ];

    // Weight objectives based on config and window
    const weights = this.calculateObjectiveWeights(window);

    // Calculate weighted scores
    const scoredDecisions = decisions.map(decision => {
      const scores = objectives.map((obj, i) => obj(decision) * weights[i]);
      const totalScore = scores.reduce((a, b) => a + b, 0);
      
      return {
        decision,
        score: totalScore,
        paretoRank: 0 // Will calculate next
      };
    });

    // Calculate Pareto ranks
    this.calculateParetoRanks(scoredDecisions, objectives);

    // Apply historical pattern adjustments
    this.applyHistoricalAdjustments(scoredDecisions, historicalPatterns);

    // Sort by final score
    scoredDecisions.sort((a, b) => b.score - a.score);

    return scoredDecisions.map(s => s.decision);
  }

  /**
   * Select optimal keepers within league constraints
   */
  private selectOptimalKeepers(decisions: KeeperDecision[]): KeeperDecision[] {
    const selected: KeeperDecision[] = [];
    const positionCounts: Record<string, number> = {};
    let totalSalary = 0;

    for (const decision of decisions) {
      // Check if we can keep more players
      if (selected.length >= this.leagueContext.keeperRules.maxKeepers) {
        break;
      }

      // Check position limits
      const position = decision.player.position;
      const currentCount = positionCounts[position] || 0;
      const limit = this.leagueContext.keeperRules.positionLimits?.[position];
      
      if (limit && currentCount >= limit) {
        continue;
      }

      // Check salary cap (if applicable)
      if (this.leagueContext.salaryCap) {
        const playerSalary = decision.player.contractDetails?.salary || 0;
        if (totalSalary + playerSalary > this.leagueContext.salaryCap * 0.6) {
          continue; // Don't use more than 60% of cap on keepers
        }
      }

      // Check minimum score threshold
      if (decision.recommendationScore < 50) {
        continue;
      }

      // Add to selected
      selected.push(decision);
      positionCounts[position] = currentCount + 1;
      totalSalary += decision.player.contractDetails?.salary || 0;
    }

    return selected;
  }

  /**
   * Calculate opportunity cost
   */
  private calculateOpportunityCost(
    player: Player,
    projection: ValueProjection,
    roster: Player[]
  ): number {
    const keeperCost = this.getKeeperCost(player);
    const expectedDraftValue = this.getExpectedDraftValue(keeperCost);
    
    // Cost of not keeping other players
    const alternativeCost = this.calculateAlternativeCost(player, roster);
    
    // Cost of draft pick or salary
    const resourceCost = this.calculateResourceCost(player);
    
    return (
      (expectedDraftValue - projection.currentYearValue) * 0.5 +
      alternativeCost * 0.3 +
      resourceCost * 0.2
    );
  }

  /**
   * Comprehensive risk assessment
   */
  private assessRisk(
    player: Player,
    projection: ValueProjection
  ): RiskProfile {
    const injuryRisk = this.calculateInjuryRisk(player);
    const ageRisk = this.calculateAgeRisk(player);
    const volatility = this.calculateVolatility(projection);
    const teamRisk = this.calculateTeamRisk(player);
    
    const overallRisk = (
      injuryRisk * 0.35 +
      ageRisk * 0.25 +
      volatility * 0.25 +
      teamRisk * 0.15
    );

    const riskTrend = this.analyzeRiskTrend(player, projection);

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
   * Find alternative options
   */
  private async findAlternatives(
    player: Player,
    projection: ValueProjection
  ): Promise<AlternativeOption[]> {
    const alternatives: AlternativeOption[] = [];

    // Draft alternative
    const draftRound = this.getKeeperCost(player);
    alternatives.push({
      action: 'draft',
      expectedValue: this.getExpectedDraftValue(draftRound),
      cost: draftRound,
      probability: 0.7
    });

    // Trade alternative
    if (player.age <= 30 && projection.threeYearValue > 200) {
      alternatives.push({
        action: 'trade',
        expectedValue: projection.currentYearValue * 1.2,
        cost: 0,
        probability: 0.5
      });
    }

    // Free agent alternative
    alternatives.push({
      action: 'freeAgent',
      expectedValue: this.getPositionReplacement(player.position),
      cost: this.getMarketPrice(player.position),
      probability: 0.6
    });

    return alternatives;
  }

  /**
   * Calculate AI confidence
   */
  private calculateConfidence(
    projection: ValueProjection,
    risk: RiskProfile,
    window: ChampionshipWindow
  ): number {
    // Projection confidence
    const projectionSpread = 
      (projection.confidenceIntervals.high[0] - projection.confidenceIntervals.low[0]) /
      projection.confidenceIntervals.median[0];
    const projectionConfidence = Math.max(0, 1 - projectionSpread);

    // Risk confidence
    const riskConfidence = 1 - risk.overallRisk;

    // Window alignment confidence
    const windowConfidence = window.status === 'competing' ? 0.9 : 0.7;

    // Historical data confidence
    const dataConfidence = this.calculateDataConfidence();

    return (
      projectionConfidence * 0.3 +
      riskConfidence * 0.3 +
      windowConfidence * 0.2 +
      dataConfidence * 0.2
    ) * 100;
  }

  /**
   * Get window-adjusted value
   */
  private getWindowAdjustedValue(
    projection: ValueProjection,
    window: ChampionshipWindow
  ): number {
    switch (window.status) {
      case 'competing':
        // Heavily weight current year
        return projection.currentYearValue * 0.6 + 
               projection.threeYearValue * 0.4;
      
      case 'fringe':
        // Balance current and future
        return projection.currentYearValue * 0.3 + 
               projection.threeYearValue * 0.7;
      
      case 'rebuilding':
        // Focus on future value
        return projection.threeYearValue * 0.4 + 
               projection.fiveYearValue * 0.6;
      
      case 'retooling':
        // Slight future bias
        return projection.currentYearValue * 0.4 + 
               projection.threeYearValue * 0.6;
      
      default:
        return projection.threeYearValue;
    }
  }

  /**
   * Calculate cost efficiency
   */
  private calculateCostEfficiency(player: Player): number {
    if (player.contractDetails) {
      const marketValue = this.getMarketValue(player);
      return Math.min(2, marketValue / player.contractDetails.salary);
    }
    
    if (player.draftDetails) {
      const roundValue = this.getExpectedDraftValue(player.draftDetails.round);
      const keeperRound = player.draftDetails.round + 
                          player.draftDetails.keeperRoundPenalty * 
                          player.draftDetails.timesKept;
      const keeperValue = this.getExpectedDraftValue(keeperRound);
      return Math.max(0.5, roundValue / keeperValue);
    }
    
    return 1.0;
  }

  /**
   * Calculate age-based keeper value
   */
  private calculateAgeValue(player: Player): number {
    const peakAges: Record<string, number> = {
      QB: 28,
      RB: 25,
      WR: 26,
      TE: 27,
      K: 30,
      DEF: 0
    };

    const peak = peakAges[player.position] || 26;
    const ageDiff = Math.abs(player.age - peak);
    
    if (player.age < peak) {
      // Younger players have keeper premium
      return Math.max(0, 100 - ageDiff * 5);
    } else {
      // Older players lose value faster
      return Math.max(0, 100 - ageDiff * 15);
    }
  }

  /**
   * Calculate positional value for keeper
   */
  private calculatePositionalValue(player: Player): number {
    if (!player.draftDetails) return 50;
    
    const round = player.draftDetails.round;
    const timesKept = player.draftDetails.timesKept;
    
    // Late round keepers are more valuable
    const roundValue = Math.max(0, (13 - round) * 8);
    
    // Penalty for being kept multiple times
    const keeperPenalty = timesKept * 10;
    
    return Math.max(0, roundValue - keeperPenalty);
  }

  /**
   * Calculate objective weights based on window
   */
  private calculateObjectiveWeights(window: ChampionshipWindow): number[] {
    const baseWeights = [
      0.3, // Value
      0.2, // Opportunity cost
      0.2, // Risk
      0.2, // Window fit
      0.1  // Position balance
    ];

    // Adjust based on window and config
    if (window.status === 'competing') {
      baseWeights[0] = 0.4; // More value focus
      baseWeights[2] = 0.1; // Less risk aversion
    } else if (window.status === 'rebuilding') {
      baseWeights[3] = 0.3; // More window fit
      baseWeights[2] = 0.25; // More risk consideration
    }

    // Apply aggressiveness
    const aggression = this.config.aggressiveness;
    baseWeights[2] *= (1 - aggression * 0.5); // Less risk weight if aggressive
    baseWeights[0] *= (1 + aggression * 0.3); // More value weight if aggressive

    // Normalize
    const sum = baseWeights.reduce((a, b) => a + b, 0);
    return baseWeights.map(w => w / sum);
  }

  /**
   * Get window fit score
   */
  private getWindowFit(
    decision: KeeperDecision,
    window: ChampionshipWindow
  ): number {
    const player = decision.player;
    const projection = decision.projectedValue;

    if (window.status === 'competing') {
      // Want peak performance now
      if (projection.peakValueYear <= 1 && player.age <= 32) {
        return 100;
      }
      return Math.max(0, 80 - projection.peakValueYear * 20);
    } else if (window.status === 'rebuilding') {
      // Want future value
      if (player.age <= 25 && projection.peakValueYear >= 2) {
        return 100;
      }
      return Math.max(0, 100 - player.age * 3);
    }

    // Balanced approach for other statuses
    return 70 - Math.abs(projection.peakValueYear - 2) * 15;
  }

  /**
   * Get positional balance score
   */
  private getPositionalBalance(
    decision: KeeperDecision,
    allDecisions: KeeperDecision[]
  ): number {
    const position = decision.player.position;
    const samePositionCount = allDecisions.filter(
      d => d.player.position === position && 
           d.recommendationScore >= 60
    ).length;

    // Penalize too many of same position
    const idealCounts: Record<string, number> = {
      QB: 1,
      RB: 2,
      WR: 3,
      TE: 1,
      K: 0,
      DEF: 0
    };

    const ideal = idealCounts[position] || 1;
    const diff = Math.abs(samePositionCount - ideal);
    
    return Math.max(0, 100 - diff * 30);
  }

  /**
   * Calculate Pareto ranks for multi-objective optimization
   */
  private calculateParetoRanks(
    scoredDecisions: any[],
    objectives: ((d: KeeperDecision) => number)[]
  ): void {
    for (let i = 0; i < scoredDecisions.length; i++) {
      let rank = 0;
      const decision1 = scoredDecisions[i].decision;
      
      for (let j = 0; j < scoredDecisions.length; j++) {
        if (i === j) continue;
        
        const decision2 = scoredDecisions[j].decision;
        let dominates = true;
        
        // Check if decision2 dominates decision1
        for (const objective of objectives) {
          if (objective(decision1) > objective(decision2)) {
            dominates = false;
            break;
          }
        }
        
        if (dominates) {
          rank++;
        }
      }
      
      scoredDecisions[i].paretoRank = rank;
    }
  }

  /**
   * Apply historical pattern adjustments
   */
  private applyHistoricalAdjustments(
    scoredDecisions: any[],
    historicalPatterns: any
  ): void {
    for (const scored of scoredDecisions) {
      const position = scored.decision.player.position;
      const age = scored.decision.player.age;
      
      // Check historical success rates
      const historicalSuccess = this.getHistoricalSuccess(position, age, historicalPatterns);
      
      // Adjust score based on historical patterns
      if (historicalSuccess > 0.7) {
        scored.score *= 1.1; // Boost successful patterns
      } else if (historicalSuccess < 0.3) {
        scored.score *= 0.9; // Penalize unsuccessful patterns
      }
      
      // Check for market inefficiencies
      const inefficiency = this.detectInefficiency(scored.decision, historicalPatterns);
      if (inefficiency > 0) {
        scored.score *= (1 + inefficiency * 0.2); // Exploit inefficiencies
      }
    }
  }

  // Helper methods
  private getKeeperCost(player: Player): number {
    if (player.draftDetails) {
      return player.draftDetails.round + 
             player.draftDetails.keeperRoundPenalty * 
             player.draftDetails.timesKept;
    }
    return 8; // Default mid-round
  }

  private getExpectedDraftValue(round: number): number {
    const values = [100, 85, 70, 58, 48, 40, 33, 28, 24, 20, 17, 15, 12, 10, 8, 5];
    return values[Math.min(round - 1, values.length - 1)] || 5;
  }

  private calculateAlternativeCost(player: Player, roster: Player[]): number {
    const alternatives = roster
      .filter(p => p.id !== player.id && p.position === player.position)
      .sort((a, b) => {
        const aValue = a.performanceHistory[a.performanceHistory.length - 1]?.fantasyPoints || 0;
        const bValue = b.performanceHistory[b.performanceHistory.length - 1]?.fantasyPoints || 0;
        return bValue - aValue;
      });
    
    if (alternatives.length === 0) return 0;
    
    const bestAlternative = alternatives[0];
    const alternativeValue = bestAlternative.performanceHistory[
      bestAlternative.performanceHistory.length - 1
    ]?.fantasyPoints || 0;
    
    return Math.max(0, alternativeValue * 0.3);
  }

  private calculateResourceCost(player: Player): number {
    if (player.contractDetails) {
      return (player.contractDetails.salary / this.leagueContext.salaryCap!) * 100;
    }
    if (player.draftDetails) {
      return this.getKeeperCost(player) * 5;
    }
    return 20;
  }

  private calculateInjuryRisk(player: Player): number {
    const recentInjuries = player.injuryHistory.filter(
      i => Date.now() - i.date.getTime() < 365 * 24 * 60 * 60 * 1000
    );
    
    const injuryScore = recentInjuries.reduce((sum, injury) => {
      const severityMap = {
        minor: 0.1,
        moderate: 0.25,
        severe: 0.5,
        'career-threatening': 0.8
      };
      return sum + severityMap[injury.severity] * (1 + injury.recurringRisk);
    }, 0);
    
    return Math.min(injuryScore, 0.9);
  }

  private calculateAgeRisk(player: Player): number {
    const riskByPosition: Record<string, number[]> = {
      QB: [0.1, 0.1, 0.15, 0.3, 0.6],
      RB: [0.1, 0.2, 0.5, 0.8, 0.95],
      WR: [0.1, 0.15, 0.3, 0.6, 0.85],
      TE: [0.1, 0.15, 0.25, 0.5, 0.8],
      K: [0.05, 0.05, 0.1, 0.2, 0.4],
      DEF: [0, 0, 0, 0, 0]
    };
    
    const ageBracket = Math.floor((player.age - 20) / 3);
    const risks = riskByPosition[player.position] || [0.2, 0.3, 0.4, 0.6, 0.8];
    
    return risks[Math.min(ageBracket, risks.length - 1)] || 0.5;
  }

  private calculateVolatility(projection: ValueProjection): number {
    const spread = projection.confidenceIntervals.high
      .map((high, i) => high - projection.confidenceIntervals.low[i])
      .reduce((a, b) => a + b, 0) / projection.confidenceIntervals.high.length;
    
    const median = projection.confidenceIntervals.median
      .reduce((a, b) => a + b, 0) / projection.confidenceIntervals.median.length;
    
    return Math.min(spread / median, 0.8);
  }

  private calculateTeamRisk(player: Player): number {
    // Simplified - would analyze:
    // - Team stability
    // - Coaching changes
    // - System fit
    // - Contract situation
    return 0.2;
  }

  private analyzeRiskTrend(
    player: Player,
    projection: ValueProjection
  ): 'increasing' | 'stable' | 'decreasing' {
    const currentRisk = this.calculateInjuryRisk(player) + this.calculateAgeRisk(player);
    const futureRisk = currentRisk * (1 + player.age / 100);
    
    if (futureRisk > currentRisk * 1.1) return 'increasing';
    if (futureRisk < currentRisk * 0.9) return 'decreasing';
    return 'stable';
  }

  private calculateDecisionScore(
    keeperValue: number,
    opportunityCost: number,
    risk: RiskProfile,
    window: ChampionshipWindow
  ): number {
    const valueScore = Math.min(100, keeperValue / 3);
    const costScore = Math.max(0, 100 - opportunityCost);
    const riskScore = (1 - risk.overallRisk) * 100;
    
    // Weight based on window
    let weights = { value: 0.4, cost: 0.3, risk: 0.3 };
    
    if (window.status === 'competing') {
      weights = { value: 0.5, cost: 0.3, risk: 0.2 };
    } else if (window.status === 'rebuilding') {
      weights = { value: 0.3, cost: 0.25, risk: 0.45 };
    }
    
    return (
      valueScore * weights.value +
      costScore * weights.cost +
      riskScore * weights.risk
    );
  }

  private getPositionReplacement(position: string): number {
    const replacementLevel: Record<string, number> = {
      QB: 180,
      RB: 100,
      WR: 90,
      TE: 60,
      K: 80,
      DEF: 70
    };
    return replacementLevel[position] || 80;
  }

  private getMarketPrice(position: string): number {
    const marketPrices: Record<string, number> = {
      QB: 15,
      RB: 25,
      WR: 20,
      TE: 10,
      K: 1,
      DEF: 2
    };
    return marketPrices[position] || 10;
  }

  private getMarketValue(player: Player): number {
    const baseValue = this.getMarketPrice(player.position);
    const performance = player.performanceHistory[
      player.performanceHistory.length - 1
    ];
    
    if (!performance) return baseValue;
    
    const rankMultiplier = performance.positionRank <= 5 ? 3 :
                          performance.positionRank <= 12 ? 2 : 1;
    
    return baseValue * rankMultiplier;
  }

  private calculateDataConfidence(): number {
    // Based on data quality and quantity
    return 0.85; // Placeholder
  }

  private getHistoricalSuccess(
    position: string,
    age: number,
    patterns: any
  ): number {
    // Simplified - would check historical keeper success rates
    const baseRates: Record<string, number> = {
      QB: 0.65,
      RB: 0.45,
      WR: 0.55,
      TE: 0.50,
      K: 0.70,
      DEF: 0.40
    };
    
    const ageModifier = age <= 27 ? 1.1 : age >= 32 ? 0.8 : 1.0;
    return (baseRates[position] || 0.5) * ageModifier;
  }

  private detectInefficiency(
    decision: KeeperDecision,
    patterns: any
  ): number {
    // Detect market inefficiencies
    const player = decision.player;
    
    // Late round gems
    if (player.draftDetails && player.draftDetails.round >= 10 &&
        decision.projectedValue.currentYearValue > 150) {
      return 0.3;
    }
    
    // Undervalued positions
    if (player.position === 'TE' && decision.recommendationScore > 70) {
      return 0.2;
    }
    
    return 0;
  }

  /**
   * Machine learning pattern recognition
   */
  async applyMLPatterns(
    decisions: KeeperDecision[],
    historicalData: any[]
  ): Promise<KeeperDecision[]> {
    // Identify successful keeper patterns
    const patterns = this.extractPatterns(historicalData);
    
    // Apply pattern matching
    for (const decision of decisions) {
      const patternScore = this.matchPatterns(decision, patterns);
      decision.recommendationScore *= (1 + patternScore * 0.2);
      decision.aiConfidence *= (1 + patternScore * 0.1);
    }
    
    return decisions;
  }

  private extractPatterns(historicalData: any[]): any[] {
    // Extract successful keeper patterns
    // This would use actual ML in production
    return [
      { type: 'young-rb', ageMax: 25, positionRank: 20, successRate: 0.75 },
      { type: 'elite-qb', ageRange: [26, 32], positionRank: 5, successRate: 0.85 },
      { type: 'breakout-wr', age: 24, previousRank: 30, successRate: 0.65 }
    ];
  }

  private matchPatterns(decision: KeeperDecision, patterns: any[]): number {
    let bestMatch = 0;
    
    for (const pattern of patterns) {
      const match = this.calculatePatternMatch(decision.player, pattern);
      bestMatch = Math.max(bestMatch, match * pattern.successRate);
    }
    
    return bestMatch;
  }

  private calculatePatternMatch(player: Player, pattern: any): number {
    let match = 1.0;
    
    if (pattern.ageMax && player.age > pattern.ageMax) {
      return 0;
    }
    
    if (pattern.ageRange) {
      const [min, max] = pattern.ageRange;
      if (player.age < min || player.age > max) {
        return 0;
      }
    }
    
    if (pattern.positionRank) {
      const recentPerf = player.performanceHistory[
        player.performanceHistory.length - 1
      ];
      if (!recentPerf || recentPerf.positionRank > pattern.positionRank) {
        match *= 0.5;
      }
    }
    
    return match;
  }
}
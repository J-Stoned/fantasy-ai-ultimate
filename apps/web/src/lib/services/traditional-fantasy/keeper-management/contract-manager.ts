/**
 * Contract Manager - Salary Cap and Contract Management
 * Handles contract optimization, restructuring, and cap strategies
 */

import {
  Player,
  ContractDetails,
  ContractOptimization,
  LeagueContext
} from './types';

export class ContractManager {
  private readonly POSITION_MARKET_VALUES: Record<string, number> = {
    QB: 30,
    RB: 25,
    WR: 22,
    TE: 12,
    K: 3,
    DEF: 5
  };

  private readonly INFLATION_RATE = 0.05; // 5% yearly

  constructor(private leagueContext: LeagueContext) {}

  /**
   * Optimize multiple contracts for cap efficiency
   */
  async optimizeContracts(
    players: Player[],
    availableCap: number
  ): Promise<{
    optimizations: ContractOptimization[];
    totalSavings: number;
    projectedCap: number[];
    recommendations: string[];
  }> {
    const optimizations: ContractOptimization[] = [];
    let totalSavings = 0;

    // Analyze each contract
    for (const player of players) {
      if (player.contractDetails) {
        const optimization = await this.optimizeContract(player, availableCap);
        optimizations.push(optimization);
        totalSavings += optimization.capSavings[0];
      }
    }

    // Project future cap situation
    const projectedCap = this.projectCapSpace(players, optimizations, 3);

    // Generate recommendations
    const recommendations = this.generateCapRecommendations(
      players,
      availableCap,
      projectedCap
    );

    return {
      optimizations,
      totalSavings,
      projectedCap,
      recommendations
    };
  }

  /**
   * Optimize individual contract
   */
  private async optimizeContract(
    player: Player,
    availableCap: number
  ): Promise<ContractOptimization> {
    const current = player.contractDetails!;
    const marketValue = this.calculateMarketValue(player);
    
    // Determine optimization strategy
    const strategy = this.determineStrategy(current, marketValue, player);
    
    // Create optimized structure
    const optimized = this.createOptimizedStructure(
      current,
      strategy,
      player
    );
    
    // Calculate savings
    const capSavings = this.calculateCapSavings(current, optimized);
    
    // Design incentives
    const incentives = this.designIncentives(player, optimized);
    
    // Risk mitigation strategies
    const riskMitigation = this.createRiskMitigation(player, optimized);

    return {
      currentStructure: current,
      optimizedStructure: optimized,
      capSavings,
      performanceIncentives: incentives,
      riskMitigation
    };
  }

  /**
   * Calculate player market value
   */
  private calculateMarketValue(player: Player): number {
    const baseValue = this.POSITION_MARKET_VALUES[player.position] || 10;
    
    // Performance multiplier
    const recentPerf = player.performanceHistory[
      player.performanceHistory.length - 1
    ];
    let perfMultiplier = 1.0;
    
    if (recentPerf) {
      if (recentPerf.positionRank <= 3) perfMultiplier = 2.0;
      else if (recentPerf.positionRank <= 6) perfMultiplier = 1.5;
      else if (recentPerf.positionRank <= 12) perfMultiplier = 1.2;
      else if (recentPerf.positionRank <= 24) perfMultiplier = 0.9;
      else perfMultiplier = 0.7;
    }
    
    // Age adjustment
    const ageMultiplier = this.getAgeMultiplier(player);
    
    // Injury adjustment
    const injuryMultiplier = this.getInjuryMultiplier(player);
    
    // Apply inflation
    const yearsIntoContract = player.contractDetails ? 
      (3 - player.contractDetails.yearsRemaining) : 0;
    const inflationMultiplier = Math.pow(1 + this.INFLATION_RATE, yearsIntoContract);
    
    return baseValue * perfMultiplier * ageMultiplier * injuryMultiplier * inflationMultiplier;
  }

  /**
   * Determine optimization strategy
   */
  private determineStrategy(
    current: ContractDetails,
    marketValue: number,
    player: Player
  ): 'restructure' | 'extend' | 'release' | 'hold' {
    const valueRatio = marketValue / current.salary;
    
    // Player is underpaid - try to extend
    if (valueRatio > 1.3 && current.yearsRemaining <= 1) {
      return 'extend';
    }
    
    // Player is overpaid significantly
    if (valueRatio < 0.6) {
      // Check dead money implications
      if (current.deadMoneyIfCut < current.salary * 0.4) {
        return 'release';
      } else {
        return 'restructure';
      }
    }
    
    // Contract is inefficient but player valuable
    if (valueRatio < 0.85 && current.restructurable) {
      return 'restructure';
    }
    
    return 'hold';
  }

  /**
   * Create optimized contract structure
   */
  private createOptimizedStructure(
    current: ContractDetails,
    strategy: string,
    player: Player
  ): ContractDetails {
    switch (strategy) {
      case 'restructure':
        return this.restructureContract(current, player);
      
      case 'extend':
        return this.extendContract(current, player);
      
      case 'release':
        return this.createReleaseStructure(current);
      
      default:
        return { ...current }; // Hold
    }
  }

  /**
   * Restructure contract for cap relief
   */
  private restructureContract(
    current: ContractDetails,
    player: Player
  ): ContractDetails {
    const restructured = { ...current };
    
    // Convert salary to bonus (spread over remaining years)
    const convertAmount = current.salary * 0.4;
    const spreadYears = Math.max(current.yearsRemaining, 2);
    
    restructured.salary = current.salary - convertAmount;
    restructured.guaranteedMoney = current.guaranteedMoney + (convertAmount * 0.8);
    restructured.deadMoneyIfCut = current.deadMoneyIfCut + (convertAmount / spreadYears);
    
    // Add void years if beneficial
    if (player.age < 30 && current.yearsRemaining === 1) {
      restructured.yearsRemaining = 3;
    }
    
    return restructured;
  }

  /**
   * Extend contract
   */
  private extendContract(
    current: ContractDetails,
    player: Player
  ): ContractDetails {
    const marketValue = this.calculateMarketValue(player);
    const extensionYears = this.determineExtensionLength(player);
    
    return {
      salary: marketValue * 0.9, // Slight discount for security
      yearsRemaining: extensionYears,
      guaranteedMoney: marketValue * extensionYears * 0.6,
      restructurable: true,
      deadMoneyIfCut: marketValue * 0.3,
      extensionEligible: false,
      franchiseTagEligible: false,
      contractType: 'extension'
    };
  }

  /**
   * Create release structure
   */
  private createReleaseStructure(current: ContractDetails): ContractDetails {
    return {
      salary: 0,
      yearsRemaining: 0,
      guaranteedMoney: 0,
      restructurable: false,
      deadMoneyIfCut: current.deadMoneyIfCut,
      extensionEligible: false,
      franchiseTagEligible: false,
      contractType: current.contractType
    };
  }

  /**
   * Calculate cap savings
   */
  private calculateCapSavings(
    current: ContractDetails,
    optimized: ContractDetails
  ): number[] {
    const savings: number[] = [];
    const years = Math.max(current.yearsRemaining, optimized.yearsRemaining);
    
    for (let year = 0; year < years; year++) {
      let currentYearCost = year < current.yearsRemaining ? current.salary : 0;
      let optimizedYearCost = year < optimized.yearsRemaining ? optimized.salary : 0;
      
      // Account for dead money in release scenarios
      if (optimized.yearsRemaining === 0 && year === 0) {
        optimizedYearCost = current.deadMoneyIfCut;
      }
      
      savings.push(currentYearCost - optimizedYearCost);
    }
    
    return savings;
  }

  /**
   * Design performance incentives
   */
  private designIncentives(
    player: Player,
    contract: ContractDetails
  ): any[] {
    const incentives: any[] = [];
    const baseIncentiveValue = contract.salary * 0.2;
    
    // Position-specific incentives
    switch (player.position) {
      case 'QB':
        incentives.push({
          type: 'passing_yards',
          threshold: 4000,
          value: baseIncentiveValue * 0.3
        });
        incentives.push({
          type: 'touchdown_passes',
          threshold: 30,
          value: baseIncentiveValue * 0.3
        });
        incentives.push({
          type: 'playoff_appearance',
          value: baseIncentiveValue * 0.4
        });
        break;
      
      case 'RB':
        incentives.push({
          type: 'rushing_yards',
          threshold: 1000,
          value: baseIncentiveValue * 0.4
        });
        incentives.push({
          type: 'total_touchdowns',
          threshold: 10,
          value: baseIncentiveValue * 0.3
        });
        incentives.push({
          type: 'games_played',
          threshold: 14,
          value: baseIncentiveValue * 0.3
        });
        break;
      
      case 'WR':
        incentives.push({
          type: 'receiving_yards',
          threshold: 1000,
          value: baseIncentiveValue * 0.4
        });
        incentives.push({
          type: 'receptions',
          threshold: 80,
          value: baseIncentiveValue * 0.3
        });
        incentives.push({
          type: 'pro_bowl',
          value: baseIncentiveValue * 0.3
        });
        break;
      
      default:
        incentives.push({
          type: 'games_played',
          threshold: 14,
          value: baseIncentiveValue * 0.5
        });
        incentives.push({
          type: 'performance_bonus',
          value: baseIncentiveValue * 0.5
        });
    }
    
    return incentives;
  }

  /**
   * Create risk mitigation strategies
   */
  private createRiskMitigation(
    player: Player,
    contract: ContractDetails
  ): string[] {
    const strategies: string[] = [];
    
    // Injury protection
    if (player.injuryHistory.length > 2) {
      strategies.push('Include injury protection clauses');
      strategies.push('Add per-game roster bonuses instead of guaranteed money');
    }
    
    // Age-related decline
    if (player.age > 30) {
      strategies.push('Front-load guaranteed money');
      strategies.push('Include team-friendly outs after year 2');
    }
    
    // Performance decline protection
    strategies.push('Include performance benchmarks for guarantees');
    
    // Cap flexibility
    if (contract.salary > 20) {
      strategies.push('Structure for future restructure flexibility');
      strategies.push('Include void years for cap management');
    }
    
    return strategies;
  }

  /**
   * Project future cap space
   */
  private projectCapSpace(
    players: Player[],
    optimizations: ContractOptimization[],
    years: number
  ): number[] {
    const projections: number[] = [];
    const currentCap = this.leagueContext.salaryCap || 200;
    
    for (let year = 0; year < years; year++) {
      let projectedCap = currentCap * Math.pow(1 + this.INFLATION_RATE, year);
      let commitments = 0;
      
      // Calculate commitments
      for (let i = 0; i < players.length; i++) {
        const player = players[i];
        const optimization = optimizations[i];
        
        if (optimization && optimization.optimizedStructure.yearsRemaining > year) {
          commitments += optimization.optimizedStructure.salary;
        } else if (player.contractDetails && player.contractDetails.yearsRemaining > year) {
          commitments += player.contractDetails.salary;
        }
      }
      
      projections.push(projectedCap - commitments);
    }
    
    return projections;
  }

  /**
   * Generate cap management recommendations
   */
  private generateCapRecommendations(
    players: Player[],
    currentCap: number,
    projectedCap: number[]
  ): string[] {
    const recommendations: string[] = [];
    
    // Current cap situation
    const capPercentUsed = (this.getTotalSalaries(players) / currentCap) * 100;
    
    if (capPercentUsed > 90) {
      recommendations.push('Critical: Immediate cap relief needed');
      recommendations.push('Consider restructuring top contracts');
    } else if (capPercentUsed > 80) {
      recommendations.push('Warning: Limited cap flexibility');
      recommendations.push('Avoid long-term commitments');
    }
    
    // Future cap situation
    if (projectedCap[0] < currentCap * 0.1) {
      recommendations.push('Future cap crunch detected');
      recommendations.push('Front-load contracts now while space available');
    }
    
    // Contract efficiency
    const inefficientContracts = players.filter(p => {
      if (!p.contractDetails) return false;
      const value = this.calculateMarketValue(p);
      return p.contractDetails.salary > value * 1.3;
    });
    
    if (inefficientContracts.length > 0) {
      recommendations.push(`${inefficientContracts.length} contracts are above market value`);
      recommendations.push('Target these for restructure or release');
    }
    
    // Extension opportunities
    const extensionCandidates = players.filter(p => 
      p.contractDetails && 
      p.contractDetails.yearsRemaining === 1 &&
      p.contractDetails.extensionEligible
    );
    
    if (extensionCandidates.length > 0) {
      recommendations.push(`${extensionCandidates.length} players eligible for extensions`);
      recommendations.push('Lock up core players before free agency');
    }
    
    return recommendations;
  }

  /**
   * Franchise tag analysis
   */
  async analyzeFranchiseTag(
    player: Player,
    capSpace: number
  ): Promise<{
    tagCost: number;
    recommendation: string;
    alternatives: string[];
  }> {
    const tagCost = this.calculateFranchiseTagCost(player);
    const marketValue = this.calculateMarketValue(player);
    const canAfford = tagCost <= capSpace * 0.15; // Don't use more than 15% on tag
    
    let recommendation = '';
    const alternatives: string[] = [];
    
    if (tagCost < marketValue * 3) {
      // Tag is good value for 1 year
      if (canAfford) {
        recommendation = 'Tag recommended - below long-term market value';
      } else {
        recommendation = 'Tag too expensive relative to cap situation';
      }
    } else {
      recommendation = 'Tag not recommended - explore long-term deal';
      alternatives.push(`Offer ${Math.round(marketValue)} per year for 3-4 years`);
    }
    
    // Always provide alternatives
    alternatives.push('Let player test free agency and compete');
    alternatives.push('Trade player before free agency for assets');
    
    if (player.age > 29) {
      alternatives.push('Consider younger replacement in draft');
    }
    
    return {
      tagCost,
      recommendation,
      alternatives
    };
  }

  /**
   * Dead money analysis
   */
  analyzeDeadMoney(players: Player[]): {
    current: number;
    future: number[];
    recommendations: string[];
  } {
    let currentDeadMoney = 0;
    const futureDeadMoney = [0, 0, 0];
    
    for (const player of players) {
      if (player.contractDetails && player.contractDetails.deadMoneyIfCut > 0) {
        // Would need to track actual cuts
        // For now, analyze potential dead money
        if (player.contractDetails.salary > this.calculateMarketValue(player) * 1.5) {
          // Likely cut candidate
          currentDeadMoney += player.contractDetails.deadMoneyIfCut;
        }
      }
    }
    
    const recommendations: string[] = [];
    
    if (currentDeadMoney > this.leagueContext.salaryCap! * 0.1) {
      recommendations.push('High dead money burden limiting flexibility');
      recommendations.push('Avoid additional restructures that create dead money');
    }
    
    return {
      current: currentDeadMoney,
      future: futureDeadMoney,
      recommendations
    };
  }

  // Helper methods
  private getAgeMultiplier(player: Player): number {
    if (player.age <= 25) return 1.1;
    if (player.age <= 28) return 1.0;
    if (player.age <= 31) return 0.85;
    return 0.7;
  }

  private getInjuryMultiplier(player: Player): number {
    const recentInjuries = player.injuryHistory.filter(
      i => Date.now() - i.date.getTime() < 365 * 24 * 60 * 60 * 1000
    ).length;
    
    if (recentInjuries === 0) return 1.0;
    if (recentInjuries === 1) return 0.9;
    if (recentInjuries === 2) return 0.75;
    return 0.6;
  }

  private determineExtensionLength(player: Player): number {
    if (player.position === 'QB' && player.age <= 30) return 4;
    if (player.position === 'RB' && player.age <= 26) return 3;
    if (player.age <= 28) return 3;
    return 2;
  }

  private getTotalSalaries(players: Player[]): number {
    return players.reduce((sum, p) => 
      sum + (p.contractDetails?.salary || 0), 0
    );
  }

  private calculateFranchiseTagCost(player: Player): number {
    // Simplified - would use actual league tag calculations
    const positionTags: Record<string, number> = {
      QB: 45,
      RB: 16,
      WR: 19,
      TE: 12,
      K: 5,
      DEF: 15
    };
    
    return positionTags[player.position] || 15;
  }

  /**
   * Contract negotiation simulator
   */
  async simulateNegotiation(
    player: Player,
    initialOffer: ContractDetails,
    maxBudget: number
  ): Promise<{
    finalDeal: ContractDetails | null;
    negotiationRounds: number;
    playerDemands: ContractDetails;
    meetingPoint: boolean;
  }> {
    const marketValue = this.calculateMarketValue(player);
    const playerLeverage = this.calculatePlayerLeverage(player);
    
    // Player's initial demands
    const playerDemands: ContractDetails = {
      salary: marketValue * (1 + playerLeverage * 0.3),
      yearsRemaining: player.age < 28 ? 4 : 3,
      guaranteedMoney: marketValue * 2,
      restructurable: false,
      deadMoneyIfCut: 0,
      extensionEligible: false,
      franchiseTagEligible: false,
      contractType: 'extension'
    };
    
    // Negotiate
    let currentOffer = { ...initialOffer };
    let rounds = 0;
    const maxRounds = 5;
    
    while (rounds < maxRounds) {
      rounds++;
      
      // Check if deal is close enough
      if (this.isAcceptableDeal(currentOffer, playerDemands, player)) {
        return {
          finalDeal: currentOffer,
          negotiationRounds: rounds,
          playerDemands,
          meetingPoint: true
        };
      }
      
      // Make counteroffer
      currentOffer = this.makeCounteroffer(
        currentOffer,
        playerDemands,
        maxBudget,
        rounds
      );
      
      // Check budget constraint
      if (currentOffer.salary > maxBudget) {
        break;
      }
    }
    
    return {
      finalDeal: null,
      negotiationRounds: rounds,
      playerDemands,
      meetingPoint: false
    };
  }

  private calculatePlayerLeverage(player: Player): number {
    let leverage = 0.5;
    
    // Performance leverage
    const recentPerf = player.performanceHistory[
      player.performanceHistory.length - 1
    ];
    if (recentPerf && recentPerf.positionRank <= 5) {
      leverage += 0.3;
    }
    
    // Age leverage
    if (player.age <= 26) leverage += 0.2;
    
    // Market scarcity
    if (player.position === 'QB' || player.position === 'RB') {
      leverage += 0.1;
    }
    
    return Math.min(1, leverage);
  }

  private isAcceptableDeal(
    offer: ContractDetails,
    demands: ContractDetails,
    player: Player
  ): boolean {
    const salaryRatio = offer.salary / demands.salary;
    const guaranteeRatio = offer.guaranteedMoney / demands.guaranteedMoney;
    
    // More flexible for older players
    const flexibility = player.age > 30 ? 0.85 : 0.92;
    
    return salaryRatio >= flexibility && guaranteeRatio >= flexibility * 0.9;
  }

  private makeCounteroffer(
    current: ContractDetails,
    demands: ContractDetails,
    maxBudget: number,
    round: number
  ): ContractDetails {
    const gap = demands.salary - current.salary;
    const movePercent = 0.3 - (round * 0.05); // Less movement each round
    
    return {
      ...current,
      salary: Math.min(maxBudget, current.salary + gap * movePercent),
      guaranteedMoney: current.guaranteedMoney + 
        (demands.guaranteedMoney - current.guaranteedMoney) * movePercent * 0.8
    };
  }
}
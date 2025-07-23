/**
 * Trade Evaluator - Multi-Year Trade Impact Analysis
 * Evaluates trades considering keeper implications and dynasty value
 */

import {
  Player,
  DynastyAsset,
  ChampionshipWindow,
  TradeSuggestion,
  LeagueContext,
  ValueProjection,
  DraftPickValue
} from './types';

export class TradeEvaluator {
  private readonly TRADE_CALCULATOR_VERSION = '2.0';
  private readonly POSITION_WEIGHTS: Record<string, number> = {
    QB: 1.0,
    RB: 1.2,
    WR: 1.1,
    TE: 0.9,
    K: 0.3,
    DEF: 0.4
  };

  constructor(private leagueContext: LeagueContext) {}

  /**
   * Evaluate multi-year trade impact
   */
  async evaluateMultiYearImpact(
    give: Player[],
    receive: Player[],
    currentWindow: ChampionshipWindow,
    yearsToProject: number
  ): Promise<{
    immediateImpact: number;
    longTermImpact: number;
    windowAlignment: number;
    recommendation: string;
    yearByYearAnalysis: any[];
    riskAnalysis: any;
  }> {
    // Calculate immediate impact
    const immediateImpact = await this.calculateImmediateImpact(give, receive);
    
    // Calculate long-term impact
    const longTermImpact = await this.calculateLongTermImpact(
      give,
      receive,
      yearsToProject
    );
    
    // Analyze window alignment
    const windowAlignment = this.analyzeWindowAlignment(
      give,
      receive,
      currentWindow
    );
    
    // Year-by-year breakdown
    const yearByYearAnalysis = await this.analyzeYearByYear(
      give,
      receive,
      yearsToProject
    );
    
    // Risk analysis
    const riskAnalysis = this.analyzeTradeRisk(give, receive);
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(
      immediateImpact,
      longTermImpact,
      windowAlignment,
      currentWindow,
      riskAnalysis
    );

    return {
      immediateImpact,
      longTermImpact,
      windowAlignment,
      recommendation,
      yearByYearAnalysis,
      riskAnalysis
    };
  }

  /**
   * Find optimal trade targets
   */
  async findTradeTargets(
    position: string,
    ageRange: number,
    maxTargets: number = 5
  ): Promise<any[]> {
    // In production, this would query a player database
    // For now, return template targets
    const targets = [];
    
    const ageMin = Math.max(21, ageRange - 3);
    const ageMax = Math.min(35, ageRange + 3);
    
    // Generate realistic trade targets
    const targetProfiles = this.getTargetProfiles(position, ageMin, ageMax);
    
    for (const profile of targetProfiles.slice(0, maxTargets)) {
      targets.push({
        action: 'trade' as const,
        expectedValue: profile.value,
        cost: profile.cost,
        probability: profile.probability,
        description: profile.description
      });
    }
    
    return targets;
  }

  /**
   * Calculate immediate impact of trade
   */
  private async calculateImmediateImpact(
    give: Player[],
    receive: Player[]
  ): Promise<number> {
    let giveValue = 0;
    let receiveValue = 0;
    
    // Calculate give side value
    for (const player of give) {
      const value = this.calculatePlayerTradeValue(player, 0);
      giveValue += value * this.POSITION_WEIGHTS[player.position];
    }
    
    // Calculate receive side value
    for (const player of receive) {
      const value = this.calculatePlayerTradeValue(player, 0);
      receiveValue += value * this.POSITION_WEIGHTS[player.position];
    }
    
    // Return net gain/loss
    return receiveValue - giveValue;
  }

  /**
   * Calculate long-term impact
   */
  private async calculateLongTermImpact(
    give: Player[],
    receive: Player[],
    years: number
  ): Promise<number> {
    let giveFutureValue = 0;
    let receiveFutureValue = 0;
    
    // Project future values
    for (let year = 1; year <= years; year++) {
      for (const player of give) {
        giveFutureValue += this.calculatePlayerTradeValue(player, year) * 
                          Math.pow(0.9, year); // Discount future value
      }
      
      for (const player of receive) {
        receiveFutureValue += this.calculatePlayerTradeValue(player, year) * 
                             Math.pow(0.9, year);
      }
    }
    
    return receiveFutureValue - giveFutureValue;
  }

  /**
   * Analyze how trade fits championship window
   */
  private analyzeWindowAlignment(
    give: Player[],
    receive: Player[],
    window: ChampionshipWindow
  ): number {
    let alignment = 0;
    
    const giveAvgAge = this.calculateAverageAge(give);
    const receiveAvgAge = this.calculateAverageAge(receive);
    const ageDiff = receiveAvgAge - giveAvgAge;
    
    switch (window.status) {
      case 'competing':
        // Want to get older/better players
        if (ageDiff > 0 && ageDiff < 5) {
          alignment = 80 + (5 - ageDiff) * 4;
        } else if (ageDiff <= 0) {
          alignment = 90; // Getting younger while competing is great
        } else {
          alignment = 60 - ageDiff * 2;
        }
        break;
      
      case 'rebuilding':
        // Want to get younger
        if (ageDiff < -2) {
          alignment = 90 - Math.abs(ageDiff);
        } else if (ageDiff >= 0) {
          alignment = 30; // Getting older while rebuilding is bad
        } else {
          alignment = 70;
        }
        break;
      
      case 'fringe':
      case 'retooling':
        // Flexible, slight preference for youth
        if (Math.abs(ageDiff) < 3) {
          alignment = 80;
        } else {
          alignment = 70 - Math.abs(ageDiff) * 2;
        }
        break;
    }
    
    return Math.max(0, Math.min(100, alignment));
  }

  /**
   * Year-by-year trade analysis
   */
  private async analyzeYearByYear(
    give: Player[],
    receive: Player[],
    years: number
  ): Promise<any[]> {
    const analysis = [];
    
    for (let year = 0; year < years; year++) {
      const giveValue = give.reduce((sum, player) => 
        sum + this.calculatePlayerTradeValue(player, year), 0
      );
      
      const receiveValue = receive.reduce((sum, player) => 
        sum + this.calculatePlayerTradeValue(player, year), 0
      );
      
      const netValue = receiveValue - giveValue;
      const winProbabilityImpact = this.calculateWinProbabilityImpact(netValue);
      
      analysis.push({
        year,
        giveValue,
        receiveValue,
        netValue,
        winProbabilityImpact,
        interpretation: this.interpretYearImpact(netValue, year)
      });
    }
    
    return analysis;
  }

  /**
   * Analyze trade risk
   */
  private analyzeTradeRisk(
    give: Player[],
    receive: Player[]
  ): any {
    const giveRisk = this.calculateSideRisk(give);
    const receiveRisk = this.calculateSideRisk(receive);
    
    const concentrationRisk = this.calculateConcentrationRisk(give, receive);
    const injuryRisk = this.calculateInjuryRisk(give, receive);
    const ageRisk = this.calculateAgeRisk(give, receive);
    
    const overallRisk = (
      Math.abs(receiveRisk - giveRisk) * 0.3 +
      concentrationRisk * 0.3 +
      injuryRisk * 0.2 +
      ageRisk * 0.2
    );
    
    return {
      giveRisk,
      receiveRisk,
      concentrationRisk,
      injuryRisk,
      ageRisk,
      overallRisk,
      riskLevel: this.categorizeRisk(overallRisk),
      mitigationStrategies: this.suggestRiskMitigation(overallRisk, give, receive)
    };
  }

  /**
   * Generate trade recommendation
   */
  private generateRecommendation(
    immediateImpact: number,
    longTermImpact: number,
    windowAlignment: number,
    window: ChampionshipWindow,
    riskAnalysis: any
  ): string {
    const totalImpact = immediateImpact + longTermImpact * 0.7;
    const riskAdjustedImpact = totalImpact * (1 - riskAnalysis.overallRisk * 0.3);
    
    // Strong accept
    if (riskAdjustedImpact > 20 && windowAlignment > 70) {
      return `STRONG ACCEPT - Excellent value (+${Math.round(totalImpact)} points) with ${windowAlignment}% window alignment`;
    }
    
    // Accept
    if (riskAdjustedImpact > 10 && windowAlignment > 60) {
      return `ACCEPT - Good value (+${Math.round(totalImpact)} points) that fits your ${window.status} strategy`;
    }
    
    // Consider
    if (riskAdjustedImpact > 0 || windowAlignment > 80) {
      return `CONSIDER - Marginal value (+${Math.round(totalImpact)} points) but ${windowAlignment > 80 ? 'great' : 'decent'} fit for your window`;
    }
    
    // Decline
    if (riskAdjustedImpact < -10) {
      return `DECLINE - Poor value (${Math.round(totalImpact)} points) with ${riskAnalysis.riskLevel} risk`;
    }
    
    // Strong decline
    return `STRONG DECLINE - Terrible value (${Math.round(totalImpact)} points) that hurts your ${window.status} timeline`;
  }

  /**
   * Calculate player trade value by year
   */
  private calculatePlayerTradeValue(player: Player, yearOffset: number): number {
    const currentAge = player.age + yearOffset;
    const recentPerf = player.performanceHistory[
      player.performanceHistory.length - 1
    ];
    
    if (!recentPerf) return 30;
    
    // Base value from performance
    let value = 0;
    if (recentPerf.positionRank <= 3) value = 100;
    else if (recentPerf.positionRank <= 6) value = 85;
    else if (recentPerf.positionRank <= 12) value = 70;
    else if (recentPerf.positionRank <= 24) value = 50;
    else if (recentPerf.positionRank <= 36) value = 30;
    else value = 15;
    
    // Age adjustments
    value *= this.getAgeMultiplier(player.position, currentAge);
    
    // Injury adjustments
    const injuryFactor = Math.max(0.6, 1 - player.injuryHistory.length * 0.1);
    value *= injuryFactor;
    
    // Contract adjustments (if applicable)
    if (player.contractDetails) {
      const contractEfficiency = this.calculateContractEfficiency(player);
      value *= contractEfficiency;
    }
    
    return Math.max(5, value);
  }

  /**
   * Get age multiplier by position
   */
  private getAgeMultiplier(position: string, age: number): number {
    const curves: Record<string, (age: number) => number> = {
      QB: (age) => {
        if (age < 25) return 0.8;
        if (age <= 32) return 1.0;
        if (age <= 35) return 0.85;
        return 0.6;
      },
      RB: (age) => {
        if (age < 22) return 0.85;
        if (age <= 26) return 1.0;
        if (age <= 28) return 0.75;
        if (age <= 30) return 0.5;
        return 0.3;
      },
      WR: (age) => {
        if (age < 23) return 0.8;
        if (age <= 28) return 1.0;
        if (age <= 31) return 0.85;
        return 0.6;
      },
      TE: (age) => {
        if (age < 24) return 0.75;
        if (age <= 29) return 1.0;
        if (age <= 32) return 0.85;
        return 0.6;
      }
    };
    
    const curve = curves[position] || curves.WR;
    return curve(age);
  }

  /**
   * Calculate average age
   */
  private calculateAverageAge(players: Player[]): number {
    if (players.length === 0) return 26;
    const totalAge = players.reduce((sum, p) => sum + p.age, 0);
    return totalAge / players.length;
  }

  /**
   * Calculate win probability impact
   */
  private calculateWinProbabilityImpact(netValue: number): number {
    // Rough estimate: 10 points = 1% win probability
    return netValue / 10;
  }

  /**
   * Interpret year impact
   */
  private interpretYearImpact(netValue: number, year: number): string {
    const yearLabel = year === 0 ? 'Immediate' : `Year ${year}`;
    
    if (netValue > 20) {
      return `${yearLabel}: Significant upgrade (+${Math.round(netValue)} value)`;
    } else if (netValue > 5) {
      return `${yearLabel}: Moderate upgrade (+${Math.round(netValue)} value)`;
    } else if (netValue > -5) {
      return `${yearLabel}: Neutral impact (${Math.round(netValue)} value)`;
    } else if (netValue > -20) {
      return `${yearLabel}: Moderate downgrade (${Math.round(netValue)} value)`;
    } else {
      return `${yearLabel}: Significant downgrade (${Math.round(netValue)} value)`;
    }
  }

  /**
   * Calculate risk for one side of trade
   */
  private calculateSideRisk(players: Player[]): number {
    if (players.length === 0) return 0;
    
    let totalRisk = 0;
    
    for (const player of players) {
      let playerRisk = 0;
      
      // Age risk
      if (player.age > 30) playerRisk += 0.2;
      if (player.age > 32) playerRisk += 0.2;
      
      // Injury risk
      playerRisk += Math.min(0.4, player.injuryHistory.length * 0.1);
      
      // Position risk
      if (player.position === 'RB') playerRisk += 0.15;
      
      totalRisk += playerRisk;
    }
    
    return totalRisk / players.length;
  }

  /**
   * Calculate concentration risk
   */
  private calculateConcentrationRisk(
    give: Player[],
    receive: Player[]
  ): number {
    // Risk of putting too many eggs in one basket
    const givePositions = new Set(give.map(p => p.position));
    const receivePositions = new Set(receive.map(p => p.position));
    
    // Getting multiple players at same position increases risk
    const positionConcentration = receive.filter(p => 
      receive.filter(p2 => p2.position === p.position).length > 1
    ).length / Math.max(1, receive.length);
    
    // Giving up position diversity increases risk
    const diversityLoss = givePositions.size - receivePositions.size;
    
    return Math.min(1, positionConcentration * 0.5 + Math.max(0, diversityLoss * 0.2));
  }

  /**
   * Calculate injury risk differential
   */
  private calculateInjuryRisk(
    give: Player[],
    receive: Player[]
  ): number {
    const giveInjuries = give.reduce((sum, p) => sum + p.injuryHistory.length, 0);
    const receiveInjuries = receive.reduce((sum, p) => sum + p.injuryHistory.length, 0);
    
    const injuryDiff = receiveInjuries - giveInjuries;
    
    return Math.min(1, Math.max(0, injuryDiff * 0.15));
  }

  /**
   * Calculate age risk
   */
  private calculateAgeRisk(
    give: Player[],
    receive: Player[]
  ): number {
    const giveAvgAge = this.calculateAverageAge(give);
    const receiveAvgAge = this.calculateAverageAge(receive);
    
    // Getting significantly older is risky
    if (receiveAvgAge > giveAvgAge + 3) {
      return Math.min(1, (receiveAvgAge - giveAvgAge - 3) * 0.2);
    }
    
    return 0;
  }

  /**
   * Categorize risk level
   */
  private categorizeRisk(risk: number): string {
    if (risk < 0.2) return 'Low';
    if (risk < 0.4) return 'Moderate';
    if (risk < 0.6) return 'High';
    return 'Very High';
  }

  /**
   * Suggest risk mitigation
   */
  private suggestRiskMitigation(
    risk: number,
    give: Player[],
    receive: Player[]
  ): string[] {
    const strategies: string[] = [];
    
    if (risk > 0.4) {
      strategies.push('Consider requesting additional draft picks as insurance');
    }
    
    const receiveAvgAge = this.calculateAverageAge(receive);
    if (receiveAvgAge > 29) {
      strategies.push('Target younger players to reduce age risk');
    }
    
    const injuryPlayers = receive.filter(p => p.injuryHistory.length > 2);
    if (injuryPlayers.length > 0) {
      strategies.push('Request injury clauses or conditional picks');
    }
    
    if (receive.filter(p => p.position === 'RB').length > 1) {
      strategies.push('Diversify by targeting different positions');
    }
    
    return strategies;
  }

  /**
   * Get target profiles for position
   */
  private getTargetProfiles(
    position: string,
    ageMin: number,
    ageMax: number
  ): any[] {
    const profiles = [];
    
    // Elite target
    profiles.push({
      value: 90,
      cost: 100,
      probability: 0.3,
      description: `Elite ${position} (age ${ageMin + 2}-${ageMax - 2})`
    });
    
    // Good starter
    profiles.push({
      value: 70,
      cost: 75,
      probability: 0.5,
      description: `Quality starter ${position} (age ${ageMin}-${ageMax})`
    });
    
    // Upside play
    profiles.push({
      value: 60,
      cost: 45,
      probability: 0.6,
      description: `High-upside ${position} (age ${ageMin}-${ageMin + 3})`
    });
    
    // Veteran
    if (ageMax > 30) {
      profiles.push({
        value: 55,
        cost: 35,
        probability: 0.7,
        description: `Proven veteran ${position} (age ${Math.max(28, ageMax - 4)}-${ageMax})`
      });
    }
    
    return profiles;
  }

  /**
   * Calculate contract efficiency
   */
  private calculateContractEfficiency(player: Player): number {
    if (!player.contractDetails) return 1.0;
    
    // Simplified - would compare to market value
    const yearsLeft = player.contractDetails.yearsRemaining;
    if (yearsLeft === 0) return 0.8; // Expiring contracts less valuable
    if (yearsLeft > 3) return 0.9; // Very long contracts slightly less flexible
    
    return 1.0;
  }

  /**
   * Dynasty-specific trade evaluation
   */
  async evaluateDynastyTrade(
    give: (Player | DraftPickValue)[],
    receive: (Player | DraftPickValue)[],
    teamStrategy: 'win-now' | 'balanced' | 'rebuild'
  ): Promise<any> {
    // Separate players and picks
    const givePlayers = give.filter(a => 'position' in a) as Player[];
    const givePicks = give.filter(a => !('position' in a)) as DraftPickValue[];
    const receivePlayers = receive.filter(a => 'position' in a) as Player[];
    const receivePicks = receive.filter(a => !('position' in a)) as DraftPickValue[];
    
    // Calculate values
    const givePlayerValue = await this.calculateDynastyPlayerValue(givePlayers, teamStrategy);
    const givePickValue = this.calculateDynastyPickValue(givePicks, teamStrategy);
    const receivePlayerValue = await this.calculateDynastyPlayerValue(receivePlayers, teamStrategy);
    const receivePickValue = this.calculateDynastyPickValue(receivePicks, teamStrategy);
    
    const totalGive = givePlayerValue + givePickValue;
    const totalReceive = receivePlayerValue + receivePickValue;
    const netValue = totalReceive - totalGive;
    
    // Strategy alignment
    const strategyFit = this.evaluateStrategyFit(
      givePlayers,
      givePicks,
      receivePlayers,
      receivePicks,
      teamStrategy
    );
    
    // Generate recommendation
    let recommendation = '';
    if (netValue > 15 && strategyFit > 70) {
      recommendation = 'ACCEPT - Strong value and strategy fit';
    } else if (netValue > 0 || strategyFit > 80) {
      recommendation = 'LEAN ACCEPT - Positive value or great fit';
    } else if (netValue > -10 && strategyFit > 60) {
      recommendation = 'CONSIDER - Close to fair value';
    } else {
      recommendation = 'DECLINE - Poor value for your strategy';
    }
    
    return {
      giveValue: totalGive,
      receiveValue: totalReceive,
      netValue,
      strategyFit,
      recommendation,
      breakdown: {
        givePlayers: givePlayerValue,
        givePicks: givePickValue,
        receivePlayers: receivePlayerValue,
        receivePicks: receivePickValue
      }
    };
  }

  /**
   * Calculate dynasty player value
   */
  private async calculateDynastyPlayerValue(
    players: Player[],
    strategy: string
  ): Promise<number> {
    let totalValue = 0;
    
    for (const player of players) {
      const baseValue = this.calculatePlayerTradeValue(player, 0);
      let strategyMultiplier = 1.0;
      
      if (strategy === 'win-now') {
        // Value current production
        if (player.age >= 27 && player.age <= 31) {
          strategyMultiplier = 1.2;
        } else if (player.age < 25) {
          strategyMultiplier = 0.8;
        }
      } else if (strategy === 'rebuild') {
        // Value youth
        if (player.age <= 24) {
          strategyMultiplier = 1.4;
        } else if (player.age >= 28) {
          strategyMultiplier = 0.7;
        }
      }
      
      totalValue += baseValue * strategyMultiplier;
    }
    
    return totalValue;
  }

  /**
   * Calculate dynasty pick value
   */
  private calculateDynastyPickValue(
    picks: DraftPickValue[],
    strategy: string
  ): number {
    let totalValue = 0;
    
    for (const pick of picks) {
      const baseValue = this.getPickValue(pick);
      let strategyMultiplier = 1.0;
      
      if (strategy === 'win-now') {
        strategyMultiplier = 0.8; // Picks less valuable for win-now
      } else if (strategy === 'rebuild') {
        strategyMultiplier = 1.3; // Picks more valuable for rebuilding
        if (pick.round === 1) {
          strategyMultiplier = 1.5; // First rounders especially valuable
        }
      }
      
      totalValue += baseValue * strategyMultiplier;
    }
    
    return totalValue;
  }

  /**
   * Get base pick value
   */
  private getPickValue(pick: DraftPickValue): number {
    const roundValues = [50, 30, 18, 10, 6, 4, 2];
    const baseValue = roundValues[pick.round - 1] || 1;
    
    // Discount future years
    const yearDiscount = Math.pow(0.9, pick.year - new Date().getFullYear());
    
    return baseValue * yearDiscount;
  }

  /**
   * Evaluate strategy fit
   */
  private evaluateStrategyFit(
    givePlayers: Player[],
    givePicks: DraftPickValue[],
    receivePlayers: Player[],
    receivePicks: DraftPickValue[],
    strategy: string
  ): number {
    let fit = 50; // Base fit
    
    if (strategy === 'win-now') {
      // Giving picks for players is good
      if (givePicks.length > receivePicks.length && 
          receivePlayers.length > givePlayers.length) {
        fit += 30;
      }
      
      // Getting older productive players is good
      const receiveAvgAge = this.calculateAverageAge(receivePlayers);
      if (receiveAvgAge >= 26 && receiveAvgAge <= 30) {
        fit += 20;
      }
    } else if (strategy === 'rebuild') {
      // Giving players for picks is good
      if (receivePicks.length > givePicks.length && 
          givePlayers.length > receivePlayers.length) {
        fit += 30;
      }
      
      // Getting younger players is good
      const receiveAvgAge = this.calculateAverageAge(receivePlayers);
      if (receiveAvgAge <= 24) {
        fit += 25;
      }
      
      // First round picks are especially good
      const firstRounders = receivePicks.filter(p => p.round === 1).length;
      fit += firstRounders * 10;
    }
    
    return Math.min(100, fit);
  }

  /**
   * Power rankings impact analysis
   */
  async analyzePowerRankingsImpact(
    give: Player[],
    receive: Player[],
    currentRank: number,
    leagueSize: number
  ): Promise<{
    projectedRank: number;
    rankChange: number;
    playoffProbability: number;
    championshipProbability: number;
  }> {
    const netValue = await this.calculateImmediateImpact(give, receive);
    
    // Rough estimate: 30 points = 1 rank improvement
    const rankChange = Math.round(netValue / 30);
    const projectedRank = Math.max(1, Math.min(leagueSize, currentRank - rankChange));
    
    // Calculate playoff probability (top 6 make playoffs in 12-team)
    const playoffTeams = Math.ceil(leagueSize / 2);
    let playoffProbability = 0;
    
    if (projectedRank <= playoffTeams - 2) {
      playoffProbability = 0.95;
    } else if (projectedRank <= playoffTeams) {
      playoffProbability = 0.80;
    } else if (projectedRank <= playoffTeams + 1) {
      playoffProbability = 0.60;
    } else if (projectedRank <= playoffTeams + 2) {
      playoffProbability = 0.40;
    } else {
      playoffProbability = 0.20;
    }
    
    // Championship probability
    const championshipProbability = projectedRank <= 3 ? 
      (0.3 / projectedRank) : (0.1 / projectedRank);
    
    return {
      projectedRank,
      rankChange,
      playoffProbability,
      championshipProbability: Math.min(0.35, championshipProbability)
    };
  }
}
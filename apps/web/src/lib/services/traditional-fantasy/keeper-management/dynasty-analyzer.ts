/**
 * Dynasty Analyzer - Dynasty League Strategies and Analysis
 * Handles rookie picks, rebuilding strategies, and long-term planning
 */

import {
  Player,
  DynastyAsset,
  ChampionshipWindow,
  TeamStrategy,
  TradeSuggestion,
  LeagueContext,
  TeamMetrics,
  DraftPickValue,
  DraftApproach,
  KeeperApproach
} from './types';

export class DynastyAnalyzer {
  private readonly ROOKIE_HIT_RATES: Record<string, number[]> = {
    // [1st round, 2nd round, 3rd+ round]
    RB: [0.55, 0.30, 0.15],
    WR: [0.50, 0.35, 0.20],
    QB: [0.45, 0.25, 0.10],
    TE: [0.40, 0.20, 0.10]
  };

  constructor(private leagueContext: LeagueContext) {}

  /**
   * Analyze complete dynasty position
   */
  async analyzeDynastyPosition(
    roster: Player[],
    draftPicks: DraftPickValue[],
    teamMetrics: TeamMetrics
  ): Promise<{
    window: ChampionshipWindow;
    strategy: TeamStrategy;
    assetValuation: DynastyAsset[];
    recommendations: string[];
  }> {
    // Evaluate all assets
    const assets = await this.evaluateAllAssets(roster, draftPicks);
    
    // Calculate championship window
    const window = await this.calculateChampionshipWindow(
      assets,
      teamMetrics
    );
    
    // Determine optimal strategy
    const strategy = this.determineStrategy(window, assets, teamMetrics);
    
    // Generate specific recommendations
    const recommendations = this.generateRecommendations(
      window,
      strategy,
      assets
    );

    return {
      window,
      strategy,
      assetValuation: assets,
      recommendations
    };
  }

  /**
   * Evaluate all dynasty assets
   */
  private async evaluateAllAssets(
    roster: Player[],
    draftPicks: DraftPickValue[]
  ): Promise<DynastyAsset[]> {
    const assets: DynastyAsset[] = [];

    // Evaluate players
    for (const player of roster) {
      const asset = await this.evaluatePlayerAsset(player);
      assets.push(asset);
    }

    // Evaluate draft picks
    for (const pick of draftPicks) {
      const asset = this.evaluateDraftPickAsset(pick);
      assets.push(asset);
    }

    return assets;
  }

  /**
   * Evaluate player as dynasty asset
   */
  private async evaluatePlayerAsset(player: Player): Promise<DynastyAsset> {
    const currentValue = this.calculateCurrentValue(player);
    const futureValues = await this.projectFutureValues(player);
    const liquidity = this.calculateLiquidity(player);
    const demand = this.calculateDemandScore(player);

    return {
      type: 'player',
      currentValue,
      futureValue: futureValues,
      liquidity,
      demandScore: demand
    };
  }

  /**
   * Evaluate draft pick asset
   */
  private evaluateDraftPickAsset(pick: DraftPickValue): Promise<DynastyAsset> {
    const currentValue = this.calculatePickValue(pick);
    const futureValues = [currentValue]; // Picks don't appreciate
    const liquidity = 0.9; // Picks are highly liquid
    const demand = this.calculatePickDemand(pick);

    return {
      type: 'pick',
      currentValue,
      futureValue: futureValues,
      liquidity,
      demandScore: demand
    };
  }

  /**
   * Calculate championship window
   */
  private async calculateChampionshipWindow(
    assets: DynastyAsset[],
    teamMetrics: TeamMetrics
  ): Promise<ChampionshipWindow> {
    // Analyze team competitive status
    const status = this.determineCompetitiveStatus(assets, teamMetrics);
    
    // Find peak competitive year
    const peakYear = this.findPeakYear(assets, teamMetrics);
    
    // Calculate window duration
    const duration = this.calculateWindowDuration(assets, status);
    
    // Project championship probability by year
    const probabilities = this.projectChampionshipProbabilities(
      assets,
      teamMetrics,
      5
    );
    
    // Determine recommended strategy
    const strategy = this.determineStrategy(
      { status, peakYear, windowDuration: duration, championshipProbability: probabilities, recommendedStrategy: null as any },
      assets,
      teamMetrics
    );

    return {
      status,
      peakYear,
      windowDuration: duration,
      championshipProbability: probabilities,
      recommendedStrategy: strategy
    };
  }

  /**
   * Determine competitive status
   */
  private determineCompetitiveStatus(
    assets: DynastyAsset[],
    teamMetrics: TeamMetrics
  ): 'competing' | 'fringe' | 'rebuilding' | 'retooling' {
    const currentValue = teamMetrics.currentRosterValue;
    const futureValue = teamMetrics.futureRosterValue[0];
    const valueRatio = futureValue / currentValue;
    
    // Count quality assets
    const eliteAssets = assets.filter(a => a.currentValue > 80).length;
    const youngAssets = assets.filter(a => 
      a.type === 'player' && (a as any).age < 25 && a.currentValue > 50
    ).length;
    
    // Competitive balance score
    const balance = teamMetrics.competitiveBalance;
    
    if (balance > 0.7 && eliteAssets >= 5) {
      return 'competing';
    } else if (balance > 0.5 && eliteAssets >= 3) {
      return 'fringe';
    } else if (valueRatio > 1.2 && youngAssets >= 4) {
      return 'rebuilding';
    } else {
      return 'retooling';
    }
  }

  /**
   * Determine optimal strategy
   */
  private determineStrategy(
    window: ChampionshipWindow,
    assets: DynastyAsset[],
    teamMetrics: TeamMetrics
  ): TeamStrategy {
    const approach = this.selectApproach(window.status);
    const targets = this.identifyTargetPositions(assets, window);
    const trades = this.generateTradeSuggestions(assets, window, teamMetrics);
    const draftStrategy = this.determineDraftStrategy(window, assets);
    const keeperStrategy = this.determineKeeperStrategy(window, assets);

    return {
      approach,
      targetPositions: targets,
      tradeTargets: trades,
      draftStrategy,
      keeperStrategy
    };
  }

  /**
   * Generate dynasty recommendations
   */
  private generateRecommendations(
    window: ChampionshipWindow,
    strategy: TeamStrategy,
    assets: DynastyAsset[]
  ): string[] {
    const recommendations: string[] = [];

    // Window-specific recommendations
    switch (window.status) {
      case 'competing':
        recommendations.push('Target proven veterans for immediate impact');
        recommendations.push('Trade future picks for win-now players');
        recommendations.push('Focus on players aged 26-30 at skill positions');
        break;
      
      case 'fringe':
        recommendations.push('Make calculated risks on high-upside players');
        recommendations.push('Balance current competitiveness with future flexibility');
        recommendations.push('Target buy-low veterans with 2-3 years left');
        break;
      
      case 'rebuilding':
        recommendations.push('Accumulate draft picks, especially 1st rounders');
        recommendations.push('Trade aging veterans for young talent + picks');
        recommendations.push('Focus on players under 24 years old');
        break;
      
      case 'retooling':
        recommendations.push('Identify core keepers and build around them');
        recommendations.push('Trade lateral moves to get younger');
        recommendations.push('Maintain flexibility for quick pivot');
        break;
    }

    // Asset-specific recommendations
    const pickCount = assets.filter(a => a.type === 'pick').length;
    if (pickCount < 3) {
      recommendations.push('Acquire more draft capital for flexibility');
    }

    // Position-specific needs
    for (const position of strategy.targetPositions) {
      recommendations.push(`Target ${position} through ${strategy.approach} approach`);
    }

    return recommendations;
  }

  /**
   * Calculate current player value
   */
  private calculateCurrentValue(player: Player): number {
    const recentPerf = player.performanceHistory[
      player.performanceHistory.length - 1
    ];
    
    if (!recentPerf) return 30;
    
    // Base value on position rank
    let value = 0;
    if (recentPerf.positionRank <= 3) value = 95;
    else if (recentPerf.positionRank <= 6) value = 85;
    else if (recentPerf.positionRank <= 12) value = 70;
    else if (recentPerf.positionRank <= 24) value = 50;
    else if (recentPerf.positionRank <= 36) value = 30;
    else value = 15;
    
    // Age adjustments for dynasty
    if (player.age <= 23) value *= 1.3;
    else if (player.age <= 25) value *= 1.15;
    else if (player.age >= 30) value *= 0.85;
    else if (player.age >= 32) value *= 0.7;
    
    return Math.min(100, value);
  }

  /**
   * Project future values
   */
  private async projectFutureValues(player: Player): Promise<number[]> {
    const values: number[] = [];
    const currentValue = this.calculateCurrentValue(player);
    
    for (let year = 0; year < 5; year++) {
      const age = player.age + year;
      let value = currentValue;
      
      // Apply aging curve
      if (player.position === 'RB') {
        if (age > 27) value *= Math.pow(0.85, age - 27);
      } else if (player.position === 'WR' || player.position === 'TE') {
        if (age > 30) value *= Math.pow(0.9, age - 30);
      } else if (player.position === 'QB') {
        if (age > 33) value *= Math.pow(0.92, age - 33);
      }
      
      // Development curve for young players
      if (player.age < 24) {
        const developmentYears = Math.min(3, 24 - player.age);
        if (year < developmentYears) {
          value *= 1 + (0.15 * (developmentYears - year));
        }
      }
      
      values.push(Math.max(10, Math.min(100, value)));
    }
    
    return values;
  }

  /**
   * Calculate asset liquidity (how easy to trade)
   */
  private calculateLiquidity(player: Player): number {
    let liquidity = 0.5; // Base liquidity
    
    // Age factors
    if (player.age >= 22 && player.age <= 28) liquidity += 0.2;
    else if (player.age > 30) liquidity -= 0.2;
    
    // Performance factors
    const recentPerf = player.performanceHistory[
      player.performanceHistory.length - 1
    ];
    if (recentPerf) {
      if (recentPerf.positionRank <= 12) liquidity += 0.2;
      else if (recentPerf.positionRank > 36) liquidity -= 0.1;
    }
    
    // Position factors
    if (player.position === 'RB' || player.position === 'WR') liquidity += 0.1;
    else if (player.position === 'K' || player.position === 'DEF') liquidity -= 0.3;
    
    // Contract factors
    if (player.contractDetails) {
      if (player.contractDetails.yearsRemaining === 1) liquidity -= 0.1;
      if (player.contractDetails.salary > 20) liquidity -= 0.1;
    }
    
    return Math.max(0.1, Math.min(0.95, liquidity));
  }

  /**
   * Calculate demand score
   */
  private calculateDemandScore(player: Player): number {
    let demand = 50; // Base demand
    
    // Youth premium
    if (player.age <= 24) demand += 20;
    else if (player.age <= 26) demand += 10;
    else if (player.age >= 30) demand -= 15;
    
    // Position scarcity
    const scarcityBonus: Record<string, number> = {
      RB: 15,
      WR: 10,
      QB: 5,
      TE: 8,
      K: -20,
      DEF: -15
    };
    demand += scarcityBonus[player.position] || 0;
    
    // Performance
    const recentPerf = player.performanceHistory[
      player.performanceHistory.length - 1
    ];
    if (recentPerf) {
      if (recentPerf.positionRank <= 5) demand += 25;
      else if (recentPerf.positionRank <= 12) demand += 15;
      else if (recentPerf.positionRank > 36) demand -= 20;
    }
    
    // Breakout potential
    if (player.age <= 23 && player.yearsInLeague <= 2) {
      demand += 15; // Sophomore/junior breakout candidates
    }
    
    return Math.max(0, Math.min(100, demand));
  }

  /**
   * Calculate draft pick value
   */
  private calculatePickValue(pick: DraftPickValue): number {
    const roundMultipliers = [100, 60, 35, 20, 12, 8, 5];
    const baseValue = roundMultipliers[pick.round - 1] || 3;
    
    // Adjust for year (future picks worth less)
    const yearDiscount = Math.pow(0.9, pick.year - new Date().getFullYear());
    
    return baseValue * yearDiscount;
  }

  /**
   * Calculate pick demand
   */
  private calculatePickDemand(pick: DraftPickValue): number {
    let demand = 70; // Picks generally in demand
    
    // Round adjustments
    if (pick.round === 1) demand += 20;
    else if (pick.round === 2) demand += 5;
    else if (pick.round >= 4) demand -= 30;
    
    // Current year picks more valuable
    if (pick.year === new Date().getFullYear()) demand += 10;
    
    // Draft class strength adjustment (would need external data)
    // For now, assume average class
    
    return Math.max(20, Math.min(95, demand));
  }

  /**
   * Find peak competitive year
   */
  private findPeakYear(assets: DynastyAsset[], teamMetrics: TeamMetrics): number {
    const projectedValues = teamMetrics.futureRosterValue;
    let maxValue = 0;
    let peakYear = 0;
    
    for (let i = 0; i < Math.min(5, projectedValues.length); i++) {
      if (projectedValues[i] > maxValue) {
        maxValue = projectedValues[i];
        peakYear = i;
      }
    }
    
    return peakYear;
  }

  /**
   * Calculate window duration
   */
  private calculateWindowDuration(
    assets: DynastyAsset[],
    status: string
  ): number {
    if (status === 'competing') {
      // Count years of competitive viability
      const coreAssets = assets.filter(a => a.currentValue > 70);
      const avgAge = this.getAverageAge(coreAssets);
      
      if (avgAge < 27) return 4;
      else if (avgAge < 29) return 3;
      else return 2;
    } else if (status === 'rebuilding') {
      // Time to competitiveness
      const youngAssets = assets.filter(a => 
        a.type === 'player' && a.futureValue[2] > a.currentValue
      );
      
      if (youngAssets.length >= 5) return 2;
      else if (youngAssets.length >= 3) return 3;
      else return 4;
    }
    
    return 3; // Default
  }

  /**
   * Project championship probabilities
   */
  private projectChampionshipProbabilities(
    assets: DynastyAsset[],
    teamMetrics: TeamMetrics,
    years: number
  ): number[] {
    const probabilities: number[] = [];
    const leagueSize = 12; // Assumed
    const baseProb = 1 / leagueSize;
    
    for (let year = 0; year < years; year++) {
      const projectedValue = teamMetrics.futureRosterValue[year] || 
                            teamMetrics.currentRosterValue;
      
      // Simple model: top 25% of value = 2x chance, top 50% = 1.5x chance
      let multiplier = 1;
      if (projectedValue > 80) multiplier = 2.5;
      else if (projectedValue > 70) multiplier = 2;
      else if (projectedValue > 60) multiplier = 1.5;
      else if (projectedValue < 40) multiplier = 0.5;
      
      probabilities.push(Math.min(0.35, baseProb * multiplier));
    }
    
    return probabilities;
  }

  /**
   * Generate trade suggestions
   */
  private generateTradeSuggestions(
    assets: DynastyAsset[],
    window: ChampionshipWindow,
    teamMetrics: TeamMetrics
  ): TradeSuggestion[] {
    const suggestions: TradeSuggestion[] = [];

    if (window.status === 'competing') {
      // Trade future for now
      suggestions.push({
        give: assets.filter(a => a.type === 'pick').slice(0, 2),
        receive: [this.createTargetAsset('Elite RB/WR', 85)],
        netValueGain: -10, // Pay premium for win-now
        windowImpact: 15,
        riskAdjustedValue: 75
      });
    } else if (window.status === 'rebuilding') {
      // Trade veterans for picks
      const veterans = assets.filter(a => 
        a.type === 'player' && a.currentValue > 60 && 
        a.futureValue[2] < a.currentValue
      );
      
      if (veterans.length > 0) {
        suggestions.push({
          give: [veterans[0]],
          receive: [
            this.createPickAsset(1, new Date().getFullYear() + 1),
            this.createPickAsset(2, new Date().getFullYear())
          ],
          netValueGain: 5,
          windowImpact: -5,
          riskAdjustedValue: 80
        });
      }
    }

    return suggestions.slice(0, 3); // Top 3 suggestions
  }

  /**
   * Identify target positions
   */
  private identifyTargetPositions(
    assets: DynastyAsset[],
    window: ChampionshipWindow
  ): string[] {
    const positions = ['QB', 'RB', 'WR', 'TE'];
    const needs: string[] = [];
    
    // This would analyze roster composition
    // For now, return generic needs based on window
    if (window.status === 'competing') {
      needs.push('RB'); // RBs for win-now
    } else if (window.status === 'rebuilding') {
      needs.push('WR', 'QB'); // Build around pass catchers
    }
    
    return needs;
  }

  /**
   * Determine draft strategy
   */
  private determineDraftStrategy(
    window: ChampionshipWindow,
    assets: DynastyAsset[]
  ): DraftApproach {
    const approach: DraftApproach = {
      philosophy: '',
      targetRounds: [],
      avoidPositions: [],
      targetArchetypes: []
    };

    switch (window.status) {
      case 'competing':
        approach.philosophy = 'Draft for immediate impact and depth';
        approach.targetRounds = [3, 4, 5]; // Mid-round contributors
        approach.avoidPositions = ['QB']; // Don't draft backups
        approach.targetArchetypes = ['proven veterans', 'system fits'];
        break;
      
      case 'rebuilding':
        approach.philosophy = 'Draft best player available with upside';
        approach.targetRounds = [1, 2]; // Early picks
        approach.avoidPositions = ['K', 'DEF'];
        approach.targetArchetypes = ['high ceiling rookies', 'athletic profiles'];
        break;
      
      default:
        approach.philosophy = 'Balanced approach targeting value';
        approach.targetRounds = [2, 3, 4];
        approach.avoidPositions = [];
        approach.targetArchetypes = ['value picks', 'roster balance'];
    }

    return approach;
  }

  /**
   * Determine keeper strategy
   */
  private determineKeeperStrategy(
    window: ChampionshipWindow,
    assets: DynastyAsset[]
  ): KeeperApproach {
    const approach: KeeperApproach = {
      philosophy: '',
      priorityPositions: [],
      ageTargets: [],
      contractStrategy: ''
    };

    switch (window.status) {
      case 'competing':
        approach.philosophy = 'Keep proven producers regardless of age';
        approach.priorityPositions = ['RB', 'WR', 'QB'];
        approach.ageTargets = [25, 32];
        approach.contractStrategy = 'Extend core players aggressively';
        break;
      
      case 'rebuilding':
        approach.philosophy = 'Keep only young players with upside';
        approach.priorityPositions = ['WR', 'QB', 'TE'];
        approach.ageTargets = [21, 25];
        approach.contractStrategy = 'Maintain cap flexibility';
        break;
      
      default:
        approach.philosophy = 'Balance current value with future potential';
        approach.priorityPositions = ['WR', 'RB', 'QB'];
        approach.ageTargets = [23, 28];
        approach.contractStrategy = 'Strategic extensions for core players';
    }

    return approach;
  }

  // Helper methods
  private selectApproach(status: string): 'win-now' | 'balanced' | 'rebuild' {
    switch (status) {
      case 'competing': return 'win-now';
      case 'rebuilding': return 'rebuild';
      default: return 'balanced';
    }
  }

  private getAverageAge(assets: DynastyAsset[]): number {
    const players = assets.filter(a => a.type === 'player');
    if (players.length === 0) return 26;
    
    // This is simplified - would need player age data
    return 27; // Placeholder
  }

  private createTargetAsset(description: string, value: number): DynastyAsset {
    return {
      type: 'player',
      currentValue: value,
      futureValue: [value, value * 0.9, value * 0.8],
      liquidity: 0.8,
      demandScore: 80
    };
  }

  private createPickAsset(round: number, year: number): DynastyAsset {
    const pick: DraftPickValue = {
      year,
      round,
      expectedValue: this.calculatePickValue({ year, round } as DraftPickValue),
      positionProbability: this.getPositionProbabilities(round),
      bustRate: this.getBustRate(round),
      starRate: this.getStarRate(round)
    };
    
    return this.evaluateDraftPickAsset(pick);
  }

  private getPositionProbabilities(round: number): Record<string, number> {
    if (round === 1) {
      return { RB: 0.4, WR: 0.35, QB: 0.15, TE: 0.1 };
    } else if (round === 2) {
      return { RB: 0.3, WR: 0.45, QB: 0.15, TE: 0.1 };
    } else {
      return { RB: 0.25, WR: 0.5, QB: 0.15, TE: 0.1 };
    }
  }

  private getBustRate(round: number): number {
    const rates = [0.25, 0.4, 0.55, 0.7, 0.8, 0.85];
    return rates[Math.min(round - 1, rates.length - 1)];
  }

  private getStarRate(round: number): number {
    const rates = [0.3, 0.15, 0.08, 0.04, 0.02, 0.01];
    return rates[Math.min(round - 1, rates.length - 1)];
  }

  /**
   * Evaluate rookie prospects
   */
  async evaluateRookieProspect(
    measurables: any,
    collegeStats: any,
    draftCapital: any
  ): Promise<{
    projectedValue: number;
    confidence: number;
    comparisonPlayers: string[];
  }> {
    // Simplified rookie evaluation
    // In production, this would use ML models
    
    const athleticScore = this.calculateAthleticScore(measurables);
    const productionScore = this.calculateProductionScore(collegeStats);
    const capitalScore = this.calculateCapitalScore(draftCapital);
    
    const projectedValue = (
      athleticScore * 0.3 +
      productionScore * 0.4 +
      capitalScore * 0.3
    );
    
    const confidence = this.calculateRookieConfidence(
      measurables,
      collegeStats,
      draftCapital
    );
    
    const comparisons = this.findComparablePlayers(
      measurables,
      collegeStats
    );
    
    return {
      projectedValue,
      confidence,
      comparisonPlayers: comparisons
    };
  }

  private calculateAthleticScore(measurables: any): number {
    // Placeholder - would use actual measurables
    return 75;
  }

  private calculateProductionScore(stats: any): number {
    // Placeholder - would analyze college production
    return 70;
  }

  private calculateCapitalScore(capital: any): number {
    // Based on draft position
    if (capital.round === 1 && capital.pick <= 5) return 90;
    if (capital.round === 1) return 80;
    if (capital.round === 2) return 65;
    if (capital.round === 3) return 50;
    return 30;
  }

  private calculateRookieConfidence(measurables: any, stats: any, capital: any): number {
    // Simplified confidence calculation
    return 0.7;
  }

  private findComparablePlayers(measurables: any, stats: any): string[] {
    // Would query historical database
    return ['Player A', 'Player B', 'Player C'];
  }

  /**
   * Dynasty trade calculator
   */
  async calculateTradeValue(
    give: (Player | DraftPickValue)[],
    receive: (Player | DraftPickValue)[],
    teamContext: ChampionshipWindow
  ): Promise<{
    giveValue: number;
    receiveValue: number;
    netValue: number;
    fairness: number;
    recommendation: string;
  }> {
    let giveValue = 0;
    let receiveValue = 0;
    
    // Calculate give side
    for (const asset of give) {
      if ('position' in asset) {
        // Player
        const playerAsset = await this.evaluatePlayerAsset(asset as Player);
        giveValue += this.adjustValueForWindow(playerAsset, teamContext);
      } else {
        // Pick
        const pickAsset = this.evaluateDraftPickAsset(asset as DraftPickValue);
        giveValue += pickAsset.currentValue;
      }
    }
    
    // Calculate receive side
    for (const asset of receive) {
      if ('position' in asset) {
        const playerAsset = await this.evaluatePlayerAsset(asset as Player);
        receiveValue += this.adjustValueForWindow(playerAsset, teamContext);
      } else {
        const pickAsset = this.evaluateDraftPickAsset(asset as DraftPickValue);
        receiveValue += pickAsset.currentValue;
      }
    }
    
    const netValue = receiveValue - giveValue;
    const fairness = Math.min(giveValue, receiveValue) / Math.max(giveValue, receiveValue);
    
    let recommendation = '';
    if (fairness > 0.9) {
      recommendation = 'Fair trade for both sides';
    } else if (netValue > 0) {
      recommendation = `Good trade - you gain ${Math.round(netValue)} value`;
    } else {
      recommendation = `Questionable trade - you lose ${Math.round(-netValue)} value`;
    }
    
    // Adjust recommendation based on team context
    if (teamContext.status === 'competing' && receiveValue > giveValue * 0.8) {
      recommendation += '. Acceptable overpay for competing window.';
    } else if (teamContext.status === 'rebuilding' && netValue > 0) {
      recommendation += '. Good value accumulation for rebuild.';
    }
    
    return {
      giveValue,
      receiveValue,
      netValue,
      fairness,
      recommendation
    };
  }

  private adjustValueForWindow(
    asset: DynastyAsset,
    window: ChampionshipWindow
  ): number {
    if (window.status === 'competing') {
      // Current value matters more
      return asset.currentValue * 0.8 + asset.futureValue[0] * 0.2;
    } else if (window.status === 'rebuilding') {
      // Future value matters more
      return asset.currentValue * 0.3 + 
             asset.futureValue[1] * 0.3 + 
             asset.futureValue[2] * 0.4;
    }
    
    // Balanced
    return asset.currentValue * 0.5 + asset.futureValue[1] * 0.5;
  }
}
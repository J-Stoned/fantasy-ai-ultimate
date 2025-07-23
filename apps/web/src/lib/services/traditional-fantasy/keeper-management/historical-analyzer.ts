/**
 * Historical Analyzer - Past Performance and Pattern Analysis
 * Tracks keeper success rates and identifies market inefficiencies
 */

import {
  Player,
  HistoricalKeeperData,
  MarketInefficiency,
  LeagueContext
} from './types';

export class HistoricalAnalyzer {
  private keeperHistory: Map<string, HistoricalKeeperData[]>;
  private leaguePatterns: Map<string, any>;
  private inefficiencies: MarketInefficiency[];

  constructor(private leagueContext: LeagueContext) {
    this.keeperHistory = new Map();
    this.leaguePatterns = new Map();
    this.inefficiencies = [];
  }

  /**
   * Analyze historical keeper patterns
   */
  async analyzeKeeperPatterns(
    positions: string[]
  ): Promise<{
    successRates: Record<string, number>;
    optimalAgeRanges: Record<string, [number, number]>;
    valueAppreciation: Record<string, number>;
    commonMistakes: string[];
    inefficiencies: MarketInefficiency[];
  }> {
    // Load historical data
    await this.loadHistoricalData();
    
    // Calculate success rates by position
    const successRates = this.calculateSuccessRates(positions);
    
    // Find optimal age ranges
    const optimalAgeRanges = this.findOptimalAgeRanges();
    
    // Analyze value appreciation
    const valueAppreciation = this.analyzeValueAppreciation();
    
    // Identify common mistakes
    const commonMistakes = this.identifyCommonMistakes();
    
    // Find market inefficiencies
    const inefficiencies = await this.findMarketInefficiencies();

    return {
      successRates,
      optimalAgeRanges,
      valueAppreciation,
      commonMistakes,
      inefficiencies
    };
  }

  /**
   * Track keeper performance
   */
  async trackKeeperPerformance(
    player: Player,
    keeperCost: number,
    actualValue: number,
    year: number
  ): Promise<void> {
    const wasSuccessful = actualValue > keeperCost * 1.2; // 20% return threshold
    const leagueAverage = await this.getLeagueAverageValue(player.position, year);
    
    const data: HistoricalKeeperData = {
      playerId: player.id,
      yearKept: year,
      cost: keeperCost,
      actualValue,
      wasSuccessful,
      leagueAverage
    };
    
    // Store in history
    if (!this.keeperHistory.has(player.id)) {
      this.keeperHistory.set(player.id, []);
    }
    this.keeperHistory.get(player.id)!.push(data);
    
    // Update patterns
    this.updateLeaguePatterns(player, data);
  }

  /**
   * Analyze keeper value trends
   */
  async analyzeValueTrends(
    position: string,
    ageRange: [number, number]
  ): Promise<{
    trendDirection: 'up' | 'down' | 'stable';
    avgAppreciation: number;
    volatility: number;
    bestKeeperProfiles: any[];
  }> {
    const relevantData = this.filterHistoricalData(position, ageRange);
    
    // Calculate trend
    const trend = this.calculateTrend(relevantData);
    
    // Calculate average appreciation
    const avgAppreciation = this.calculateAverageAppreciation(relevantData);
    
    // Calculate volatility
    const volatility = this.calculateVolatility(relevantData);
    
    // Identify best profiles
    const bestProfiles = this.identifyBestKeeperProfiles(relevantData);
    
    return {
      trendDirection: trend,
      avgAppreciation,
      volatility,
      bestKeeperProfiles: bestProfiles
    };
  }

  /**
   * Load historical data
   */
  private async loadHistoricalData(): Promise<void> {
    // In production, this would load from database
    // For now, generate realistic sample data
    this.generateSampleHistoricalData();
  }

  /**
   * Generate sample historical data
   */
  private generateSampleHistoricalData(): void {
    // Success rates by position and age
    this.leaguePatterns.set('QB_success', {
      '22-25': 0.65,
      '26-29': 0.75,
      '30-33': 0.70,
      '34+': 0.45
    });
    
    this.leaguePatterns.set('RB_success', {
      '21-23': 0.70,
      '24-26': 0.68,
      '27-29': 0.45,
      '30+': 0.25
    });
    
    this.leaguePatterns.set('WR_success', {
      '22-24': 0.62,
      '25-27': 0.72,
      '28-30': 0.65,
      '31+': 0.48
    });
    
    this.leaguePatterns.set('TE_success', {
      '23-25': 0.58,
      '26-28': 0.68,
      '29-31': 0.62,
      '32+': 0.40
    });
    
    // Common keeper mistakes
    this.leaguePatterns.set('common_mistakes', [
      'Overvaluing past performance in RBs over 28',
      'Undervaluing second-year WRs',
      'Keeping based on name value rather than projections',
      'Ignoring injury history in keeper decisions',
      'Not considering opportunity cost of keeper slots'
    ]);
  }

  /**
   * Calculate success rates
   */
  private calculateSuccessRates(
    positions: string[]
  ): Record<string, number> {
    const rates: Record<string, number> = {};
    
    for (const position of positions) {
      const pattern = this.leaguePatterns.get(`${position}_success`);
      if (pattern) {
        // Average across all age ranges
        const values = Object.values(pattern) as number[];
        rates[position] = values.reduce((a, b) => a + b, 0) / values.length;
      } else {
        rates[position] = 0.6; // Default
      }
    }
    
    return rates;
  }

  /**
   * Find optimal age ranges
   */
  private findOptimalAgeRanges(): Record<string, [number, number]> {
    const optimal: Record<string, [number, number]> = {
      QB: [26, 31],
      RB: [23, 26],
      WR: [24, 28],
      TE: [25, 29],
      K: [26, 34],
      DEF: [0, 99]
    };
    
    // Adjust based on league patterns
    for (const [position, range] of Object.entries(optimal)) {
      const pattern = this.leaguePatterns.get(`${position}_success`);
      if (pattern) {
        // Find age range with highest success rate
        let maxRate = 0;
        let bestRange = '';
        
        for (const [ageRange, rate] of Object.entries(pattern)) {
          if (rate > maxRate) {
            maxRate = rate;
            bestRange = ageRange;
          }
        }
        
        // Parse age range
        if (bestRange.includes('-')) {
          const [min, max] = bestRange.split('-').map(s => parseInt(s));
          optimal[position] = [min, max];
        }
      }
    }
    
    return optimal;
  }

  /**
   * Analyze value appreciation
   */
  private analyzeValueAppreciation(): Record<string, number> {
    // Average yearly appreciation by position
    return {
      QB: 0.08,  // 8% average appreciation
      RB: -0.05, // 5% depreciation (due to age curve)
      WR: 0.12,  // 12% appreciation (longer peak)
      TE: 0.10,  // 10% appreciation
      K: 0.02,   // 2% appreciation
      DEF: 0.00  // No appreciation
    };
  }

  /**
   * Identify common mistakes
   */
  private identifyCommonMistakes(): string[] {
    return this.leaguePatterns.get('common_mistakes') || [
      'Generic mistake 1',
      'Generic mistake 2'
    ];
  }

  /**
   * Find market inefficiencies
   */
  private async findMarketInefficiencies(): Promise<MarketInefficiency[]> {
    const inefficiencies: MarketInefficiency[] = [];
    
    // RB age bias
    inefficiencies.push({
      type: 'undervalued',
      position: 'RB',
      ageRange: [21, 23],
      inefficiencyScore: 0.25,
      exploitationStrategy: 'Target young RBs in rounds 8-12 as keepers'
    });
    
    // WR breakout window
    inefficiencies.push({
      type: 'undervalued',
      position: 'WR',
      ageRange: [23, 25],
      inefficiencyScore: 0.30,
      exploitationStrategy: 'Keep second and third year WRs showing improvement'
    });
    
    // Veteran QB value
    inefficiencies.push({
      type: 'overvalued',
      position: 'QB',
      ageRange: [33, 40],
      inefficiencyScore: 0.20,
      exploitationStrategy: 'Trade aging QBs while name value remains high'
    });
    
    // TE development curve
    inefficiencies.push({
      type: 'undervalued',
      position: 'TE',
      ageRange: [24, 26],
      inefficiencyScore: 0.22,
      exploitationStrategy: 'Patient approach with young TEs pays off'
    });
    
    this.inefficiencies = inefficiencies;
    return inefficiencies;
  }

  /**
   * Update league patterns
   */
  private updateLeaguePatterns(
    player: Player,
    data: HistoricalKeeperData
  ): void {
    const key = `${player.position}_${this.getAgeRange(player.age)}`;
    
    if (!this.leaguePatterns.has(key)) {
      this.leaguePatterns.set(key, {
        totalKeepers: 0,
        successfulKeepers: 0,
        avgReturn: 0
      });
    }
    
    const pattern = this.leaguePatterns.get(key)!;
    pattern.totalKeepers++;
    if (data.wasSuccessful) {
      pattern.successfulKeepers++;
    }
    
    // Update average return
    const returnRate = (data.actualValue - data.cost) / data.cost;
    pattern.avgReturn = (
      (pattern.avgReturn * (pattern.totalKeepers - 1) + returnRate) /
      pattern.totalKeepers
    );
  }

  /**
   * Get age range bucket
   */
  private getAgeRange(age: number): string {
    if (age <= 23) return '21-23';
    if (age <= 26) return '24-26';
    if (age <= 29) return '27-29';
    if (age <= 32) return '30-32';
    return '33+';
  }

  /**
   * Get league average value
   */
  private async getLeagueAverageValue(
    position: string,
    year: number
  ): Promise<number> {
    // Simplified - would query actual league data
    const baseValues: Record<string, number> = {
      QB: 200,
      RB: 150,
      WR: 140,
      TE: 100,
      K: 80,
      DEF: 90
    };
    
    // Apply year adjustment
    const yearAdjustment = 1 + (year - 2024) * 0.05;
    
    return (baseValues[position] || 100) * yearAdjustment;
  }

  /**
   * Filter historical data
   */
  private filterHistoricalData(
    position: string,
    ageRange: [number, number]
  ): HistoricalKeeperData[] {
    const filtered: HistoricalKeeperData[] = [];
    
    // In production, would filter actual data
    // For now, return empty array
    return filtered;
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(
    data: HistoricalKeeperData[]
  ): 'up' | 'down' | 'stable' {
    if (data.length < 3) return 'stable';
    
    // Simple trend calculation
    const firstHalf = data.slice(0, Math.floor(data.length / 2));
    const secondHalf = data.slice(Math.floor(data.length / 2));
    
    const firstAvg = firstHalf.reduce((sum, d) => sum + d.actualValue, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, d) => sum + d.actualValue, 0) / secondHalf.length;
    
    const change = (secondAvg - firstAvg) / firstAvg;
    
    if (change > 0.1) return 'up';
    if (change < -0.1) return 'down';
    return 'stable';
  }

  /**
   * Calculate average appreciation
   */
  private calculateAverageAppreciation(
    data: HistoricalKeeperData[]
  ): number {
    if (data.length === 0) return 0;
    
    const appreciations = data.map(d => 
      (d.actualValue - d.cost) / d.cost
    );
    
    return appreciations.reduce((a, b) => a + b, 0) / appreciations.length;
  }

  /**
   * Calculate volatility
   */
  private calculateVolatility(
    data: HistoricalKeeperData[]
  ): number {
    if (data.length < 2) return 0.5;
    
    const returns = data.map(d => (d.actualValue - d.cost) / d.cost);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    const variance = returns.reduce((sum, r) => 
      sum + Math.pow(r - mean, 2), 0
    ) / returns.length;
    
    return Math.sqrt(variance);
  }

  /**
   * Identify best keeper profiles
   */
  private identifyBestKeeperProfiles(
    data: HistoricalKeeperData[]
  ): any[] {
    // Group by success
    const successful = data.filter(d => d.wasSuccessful);
    
    // Find common characteristics
    const profiles = [
      {
        type: 'high_return',
        description: 'Players who returned 50%+ value',
        frequency: successful.filter(d => 
          (d.actualValue - d.cost) / d.cost > 0.5
        ).length / Math.max(1, successful.length),
        characteristics: ['Late round picks', 'Young age', 'Opportunity increase']
      },
      {
        type: 'consistent',
        description: 'Players who met expectations',
        frequency: successful.filter(d => 
          Math.abs(d.actualValue - d.leagueAverage) < 20
        ).length / Math.max(1, successful.length),
        characteristics: ['Proven production', 'Stable situation', 'Prime age']
      }
    ];
    
    return profiles;
  }

  /**
   * Analyze league tendencies
   */
  async analyzeLeagueTendencies(): Promise<{
    overvaluedPositions: string[];
    undervaluedPositions: string[];
    optimalKeeperCount: number;
    commonStrategies: string[];
  }> {
    // Analyze position values
    const positionValues = this.analyzePositionValues();
    
    // Find over/undervalued
    const overvalued = Object.entries(positionValues)
      .filter(([_, value]) => value < 0.9)
      .map(([pos]) => pos);
    
    const undervalued = Object.entries(positionValues)
      .filter(([_, value]) => value > 1.1)
      .map(([pos]) => pos);
    
    // Determine optimal keeper count
    const optimalCount = this.calculateOptimalKeeperCount();
    
    // Identify common strategies
    const strategies = this.identifyCommonStrategies();
    
    return {
      overvaluedPositions: overvalued,
      undervaluedPositions: undervalued,
      optimalKeeperCount: optimalCount,
      commonStrategies: strategies
    };
  }

  /**
   * Analyze position values
   */
  private analyzePositionValues(): Record<string, number> {
    // Value relative to market (1.0 = fair value)
    return {
      QB: 0.95,  // Slightly overvalued
      RB: 1.15,  // Undervalued due to age concerns
      WR: 1.05,  // Fairly valued
      TE: 1.20,  // Undervalued breakouts
      K: 0.80,   // Overvalued
      DEF: 0.75  // Overvalued
    };
  }

  /**
   * Calculate optimal keeper count
   */
  private calculateOptimalKeeperCount(): number {
    // Based on league rules and historical success
    const maxKeepers = this.leagueContext.keeperRules.maxKeepers;
    
    // Historical data suggests 60-70% of max is optimal
    return Math.ceil(maxKeepers * 0.65);
  }

  /**
   * Identify common strategies
   */
  private identifyCommonStrategies(): string[] {
    return [
      'Youth Movement - Keep players under 26 exclusively',
      'Stars and Scrubs - Keep only elite players and late round values',
      'Positional Focus - Heavy keeper investment in RB/WR',
      'Value Hunting - Focus on round value vs ADP',
      'Win Now - Keep productive veterans regardless of age'
    ];
  }

  /**
   * Generate keeper report card
   */
  async generateKeeperReportCard(
    playerId: string
  ): Promise<{
    historicalSuccess: number;
    valueGenerated: number;
    timesKept: number;
    bestYear: number;
    worstYear: number;
    recommendation: string;
  }> {
    const history = this.keeperHistory.get(playerId) || [];
    
    if (history.length === 0) {
      return {
        historicalSuccess: 0.5,
        valueGenerated: 0,
        timesKept: 0,
        bestYear: 0,
        worstYear: 0,
        recommendation: 'No historical data - proceed with caution'
      };
    }
    
    const successRate = history.filter(h => h.wasSuccessful).length / history.length;
    const totalValue = history.reduce((sum, h) => sum + (h.actualValue - h.cost), 0);
    const bestYear = Math.max(...history.map(h => h.actualValue));
    const worstYear = Math.min(...history.map(h => h.actualValue));
    
    let recommendation = '';
    if (successRate > 0.7) {
      recommendation = 'Proven keeper success - strong hold';
    } else if (successRate > 0.5) {
      recommendation = 'Mixed results - consider alternatives';
    } else {
      recommendation = 'Poor keeper history - avoid unless value exceptional';
    }
    
    return {
      historicalSuccess: successRate,
      valueGenerated: totalValue,
      timesKept: history.length,
      bestYear,
      worstYear,
      recommendation
    };
  }

  /**
   * Predict keeper success
   */
  async predictKeeperSuccess(
    player: Player,
    keeperCost: number
  ): Promise<{
    successProbability: number;
    expectedReturn: number;
    confidence: number;
    similarPlayers: any[];
  }> {
    // Find similar historical keepers
    const similar = await this.findSimilarKeepers(player, keeperCost);
    
    if (similar.length === 0) {
      // Use position/age defaults
      const positionSuccess = this.getPositionSuccessRate(player.position, player.age);
      return {
        successProbability: positionSuccess,
        expectedReturn: positionSuccess > 0.6 ? 0.2 : -0.1,
        confidence: 0.5,
        similarPlayers: []
      };
    }
    
    // Calculate based on similar players
    const successRate = similar.filter(s => s.wasSuccessful).length / similar.length;
    const avgReturn = similar.reduce((sum, s) => 
      sum + (s.actualValue - s.cost) / s.cost, 0
    ) / similar.length;
    
    const confidence = Math.min(0.9, 0.5 + similar.length * 0.05);
    
    return {
      successProbability: successRate,
      expectedReturn: avgReturn,
      confidence,
      similarPlayers: similar.slice(0, 5)
    };
  }

  /**
   * Find similar historical keepers
   */
  private async findSimilarKeepers(
    player: Player,
    keeperCost: number
  ): Promise<any[]> {
    // In production, would search historical database
    // For now, return empty array
    return [];
  }

  /**
   * Get position success rate
   */
  private getPositionSuccessRate(
    position: string,
    age: number
  ): number {
    const ageRange = this.getAgeRange(age);
    const pattern = this.leaguePatterns.get(`${position}_success`);
    
    if (pattern && pattern[ageRange]) {
      return pattern[ageRange];
    }
    
    // Default rates
    const defaults: Record<string, number> = {
      QB: 0.65,
      RB: 0.55,
      WR: 0.60,
      TE: 0.58,
      K: 0.70,
      DEF: 0.50
    };
    
    return defaults[position] || 0.6;
  }
}
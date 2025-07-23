/**
 * Value Projector - Multi-Year Player Value Projections
 * Uses aging curves, historical data, and Monte Carlo simulations
 */

import {
  Player,
  ValueProjection,
  LeagueContext,
  AgingCurve,
  SeasonPerformance
} from './types';

export class ValueProjector {
  private agingCurves: Map<string, AgingCurve>;
  private readonly SIMULATION_RUNS = 1000;
  private readonly MAX_PROJECTION_YEARS = 5;

  constructor(private leagueContext: LeagueContext) {
    this.agingCurves = this.initializeAgingCurves();
  }

  /**
   * Project player value over multiple years
   */
  async projectPlayerValue(player: Player): Promise<ValueProjection> {
    const baseProjection = this.calculateBaseProjection(player);
    const agingAdjustments = this.applyAgingCurve(player, baseProjection);
    const simulations = this.runMonteCarloSimulations(player, agingAdjustments);
    
    return this.compileProjections(simulations, player);
  }

  /**
   * Initialize position-specific aging curves
   */
  private initializeAgingCurves(): Map<string, AgingCurve> {
    const curves = new Map<string, AgingCurve>();
    
    curves.set('QB', {
      position: 'QB',
      peakAgeRange: [27, 32],
      declineRate: 0.03, // 3% per year after peak
      cliffAge: 36,
      exceptionProbability: 0.15 // Brady, Brees types
    });
    
    curves.set('RB', {
      position: 'RB',
      peakAgeRange: [23, 27],
      declineRate: 0.12, // Steep decline
      cliffAge: 30,
      exceptionProbability: 0.05 // Frank Gore types rare
    });
    
    curves.set('WR', {
      position: 'WR',
      peakAgeRange: [25, 29],
      declineRate: 0.07,
      cliffAge: 32,
      exceptionProbability: 0.10
    });
    
    curves.set('TE', {
      position: 'TE',
      peakAgeRange: [26, 30],
      declineRate: 0.06,
      cliffAge: 33,
      exceptionProbability: 0.12
    });
    
    curves.set('K', {
      position: 'K',
      peakAgeRange: [27, 35],
      declineRate: 0.02,
      cliffAge: 40,
      exceptionProbability: 0.20
    });
    
    curves.set('DEF', {
      position: 'DEF',
      peakAgeRange: [0, 99],
      declineRate: 0,
      cliffAge: 99,
      exceptionProbability: 0
    });
    
    return curves;
  }

  /**
   * Calculate base projection from historical performance
   */
  private calculateBaseProjection(player: Player): number[] {
    const projections: number[] = [];
    const recentPerformance = this.getWeightedRecentPerformance(player);
    const trendFactor = this.calculateTrendFactor(player);
    
    for (let year = 0; year < this.MAX_PROJECTION_YEARS; year++) {
      const baseValue = recentPerformance * Math.pow(trendFactor, year);
      projections.push(baseValue);
    }
    
    return projections;
  }

  /**
   * Apply aging curve adjustments
   */
  private applyAgingCurve(player: Player, baseProjections: number[]): number[] {
    const curve = this.agingCurves.get(player.position) || this.getDefaultCurve();
    const adjustedProjections: number[] = [];
    
    for (let year = 0; year < baseProjections.length; year++) {
      const projectedAge = player.age + year;
      const ageMultiplier = this.calculateAgeMultiplier(projectedAge, curve);
      adjustedProjections.push(baseProjections[year] * ageMultiplier);
    }
    
    return adjustedProjections;
  }

  /**
   * Run Monte Carlo simulations for confidence intervals
   */
  private runMonteCarloSimulations(
    player: Player,
    baseProjections: number[]
  ): number[][] {
    const simulations: number[][] = [];
    
    for (let run = 0; run < this.SIMULATION_RUNS; run++) {
      const simulation: number[] = [];
      
      for (let year = 0; year < baseProjections.length; year++) {
        const variability = this.getProjectionVariability(player, year);
        const randomFactor = this.generateRandomFactor(variability);
        const injuryFactor = this.simulateInjuryImpact(player, year);
        
        const projectedValue = baseProjections[year] * randomFactor * injuryFactor;
        simulation.push(Math.max(0, projectedValue));
      }
      
      simulations.push(simulation);
    }
    
    return simulations;
  }

  /**
   * Compile simulations into confidence intervals
   */
  private compileProjections(
    simulations: number[][],
    player: Player
  ): ValueProjection {
    const yearlyValues: number[][] = [];
    
    // Transpose simulations to group by year
    for (let year = 0; year < this.MAX_PROJECTION_YEARS; year++) {
      yearlyValues.push(simulations.map(sim => sim[year]));
    }
    
    // Calculate percentiles for each year
    const confidenceIntervals = {
      low: yearlyValues.map(values => this.getPercentile(values, 20)),
      median: yearlyValues.map(values => this.getPercentile(values, 50)),
      high: yearlyValues.map(values => this.getPercentile(values, 80))
    };
    
    // Calculate key metrics
    const currentYearValue = confidenceIntervals.median[0];
    const threeYearValue = confidenceIntervals.median.slice(0, 3).reduce((a, b) => a + b, 0);
    const fiveYearValue = confidenceIntervals.median.reduce((a, b) => a + b, 0);
    
    // Estimate career remaining value
    const careerYears = this.estimateCareerLength(player);
    const careerRemainingValue = this.projectCareerValue(
      player,
      confidenceIntervals.median,
      careerYears
    );
    
    // Find peak and decline years
    const peakValueYear = this.findPeakYear(confidenceIntervals.median);
    const declineStartYear = this.findDeclineStart(confidenceIntervals.median, player);
    
    return {
      currentYearValue,
      threeYearValue,
      fiveYearValue,
      careerRemainingValue,
      peakValueYear,
      declineStartYear,
      confidenceIntervals
    };
  }

  /**
   * Get weighted recent performance
   */
  private getWeightedRecentPerformance(player: Player): number {
    if (player.performanceHistory.length === 0) {
      return this.getPositionAverage(player.position);
    }
    
    const weights = [0.5, 0.3, 0.2]; // Most recent year weighted highest
    let weightedSum = 0;
    let totalWeight = 0;
    
    for (let i = 0; i < Math.min(3, player.performanceHistory.length); i++) {
      const performance = player.performanceHistory[
        player.performanceHistory.length - 1 - i
      ];
      const weight = weights[i] || 0.1;
      weightedSum += performance.fantasyPoints * weight;
      totalWeight += weight;
    }
    
    return weightedSum / totalWeight;
  }

  /**
   * Calculate performance trend
   */
  private calculateTrendFactor(player: Player): number {
    if (player.performanceHistory.length < 2) {
      return 1.0; // Neutral trend
    }
    
    const recentYears = player.performanceHistory.slice(-3);
    const trend = this.calculateLinearRegression(
      recentYears.map(p => p.fantasyPoints)
    );
    
    // Convert trend to multiplier (cap between 0.9 and 1.1)
    return Math.max(0.9, Math.min(1.1, 1 + trend / 100));
  }

  /**
   * Calculate age-based performance multiplier
   */
  private calculateAgeMultiplier(age: number, curve: AgingCurve): number {
    const [peakStart, peakEnd] = curve.peakAgeRange;
    
    if (age < peakStart) {
      // Pre-peak: gradual improvement
      const yearsToPeak = peakStart - age;
      return 1 - (yearsToPeak * 0.02); // 2% improvement per year
    } else if (age <= peakEnd) {
      // Peak years
      return 1.0;
    } else if (age < curve.cliffAge) {
      // Post-peak decline
      const yearsPastPeak = age - peakEnd;
      return Math.max(0.5, 1 - (yearsPastPeak * curve.declineRate));
    } else {
      // Cliff decline
      const yearsPastCliff = age - curve.cliffAge;
      return Math.max(0.2, 0.5 - (yearsPastCliff * 0.15));
    }
  }

  /**
   * Get projection variability by year
   */
  private getProjectionVariability(player: Player, yearOut: number): number {
    const baseVariability = this.getPositionVariability(player.position);
    const ageVariability = player.age > 30 ? 0.1 : 0.05;
    const yearVariability = yearOut * 0.05; // Uncertainty increases with time
    
    return baseVariability + ageVariability + yearVariability;
  }

  /**
   * Generate random factor for Monte Carlo
   */
  private generateRandomFactor(variability: number): number {
    // Box-Muller transform for normal distribution
    const u1 = Math.random();
    const u2 = Math.random();
    const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    
    // Convert to factor with given variability
    return 1 + (z0 * variability);
  }

  /**
   * Simulate injury impact
   */
  private simulateInjuryImpact(player: Player, yearOut: number): number {
    const baseInjuryRate = this.getPositionInjuryRate(player.position);
    const ageModifier = Math.max(1, (player.age + yearOut - 25) / 10);
    const historyModifier = player.injuryHistory.length > 2 ? 1.5 : 1.0;
    
    const injuryProbability = Math.min(
      0.5,
      baseInjuryRate * ageModifier * historyModifier
    );
    
    if (Math.random() < injuryProbability) {
      // Injury occurred - reduce value by 20-60%
      return 0.4 + Math.random() * 0.4;
    }
    
    return 1.0;
  }

  /**
   * Get percentile from array
   */
  private getPercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.floor((percentile / 100) * sorted.length);
    return sorted[index];
  }

  /**
   * Estimate remaining career length
   */
  private estimateCareerLength(player: Player): number {
    const curve = this.agingCurves.get(player.position)!;
    const typicalCareerLength: Record<string, number> = {
      QB: 15,
      RB: 8,
      WR: 11,
      TE: 12,
      K: 18,
      DEF: 0
    };
    
    const typical = typicalCareerLength[player.position] || 10;
    const remaining = Math.max(1, typical - player.yearsInLeague);
    
    // Adjust for performance and injuries
    const performanceModifier = this.getPerformanceModifier(player);
    const injuryModifier = player.injuryHistory.length > 3 ? 0.8 : 1.0;
    
    return Math.round(remaining * performanceModifier * injuryModifier);
  }

  /**
   * Project career value beyond 5 years
   */
  private projectCareerValue(
    player: Player,
    fiveYearProjections: number[],
    careerYears: number
  ): number {
    let totalValue = fiveYearProjections.reduce((a, b) => a + b, 0);
    
    if (careerYears > 5) {
      const lastYearValue = fiveYearProjections[4];
      const curve = this.agingCurves.get(player.position)!;
      
      for (let year = 5; year < careerYears; year++) {
        const age = player.age + year;
        const declineMultiplier = age >= curve.cliffAge ? 0.7 : 0.85;
        const yearValue = lastYearValue * Math.pow(declineMultiplier, year - 4);
        totalValue += Math.max(0, yearValue);
      }
    }
    
    return totalValue;
  }

  /**
   * Find peak value year
   */
  private findPeakYear(projections: number[]): number {
    let maxValue = 0;
    let peakYear = 0;
    
    for (let i = 0; i < projections.length; i++) {
      if (projections[i] > maxValue) {
        maxValue = projections[i];
        peakYear = i;
      }
    }
    
    return peakYear;
  }

  /**
   * Find when decline starts
   */
  private findDeclineStart(projections: number[], player: Player): number {
    const curve = this.agingCurves.get(player.position)!;
    const [, peakEnd] = curve.peakAgeRange;
    
    // First check age-based decline
    const ageDeclineYear = Math.max(0, peakEnd - player.age);
    
    // Then check projection-based decline
    for (let i = 1; i < projections.length; i++) {
      if (projections[i] < projections[i - 1] * 0.95) {
        return i;
      }
    }
    
    return Math.max(ageDeclineYear, projections.length);
  }

  // Helper methods
  private getDefaultCurve(): AgingCurve {
    return {
      position: 'DEFAULT',
      peakAgeRange: [25, 29],
      declineRate: 0.08,
      cliffAge: 32,
      exceptionProbability: 0.1
    };
  }

  private getPositionAverage(position: string): number {
    const averages: Record<string, number> = {
      QB: 250,
      RB: 180,
      WR: 160,
      TE: 120,
      K: 110,
      DEF: 100
    };
    return averages[position] || 150;
  }

  private getPositionVariability(position: string): number {
    const variability: Record<string, number> = {
      QB: 0.15,
      RB: 0.25,
      WR: 0.20,
      TE: 0.18,
      K: 0.12,
      DEF: 0.22
    };
    return variability[position] || 0.2;
  }

  private getPositionInjuryRate(position: string): number {
    const rates: Record<string, number> = {
      QB: 0.12,
      RB: 0.35,
      WR: 0.18,
      TE: 0.15,
      K: 0.05,
      DEF: 0
    };
    return rates[position] || 0.15;
  }

  private calculateLinearRegression(values: number[]): number {
    const n = values.length;
    const sumX = values.reduce((sum, _, i) => sum + i, 0);
    const sumY = values.reduce((sum, val) => sum + val, 0);
    const sumXY = values.reduce((sum, val, i) => sum + i * val, 0);
    const sumX2 = values.reduce((sum, _, i) => sum + i * i, 0);
    
    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    return slope;
  }

  private getPerformanceModifier(player: Player): number {
    if (player.performanceHistory.length === 0) return 1.0;
    
    const recentPerformance = player.performanceHistory[
      player.performanceHistory.length - 1
    ];
    
    if (recentPerformance.positionRank <= 5) return 1.2;
    if (recentPerformance.positionRank <= 12) return 1.1;
    if (recentPerformance.positionRank <= 24) return 1.0;
    return 0.9;
  }

  /**
   * Special handling for unique player archetypes
   */
  async projectUniqueArchetype(
    player: Player,
    archetype: 'late-bloomer' | 'injury-prone' | 'system-dependent'
  ): Promise<ValueProjection> {
    const baseProjection = await this.projectPlayerValue(player);
    
    switch (archetype) {
      case 'late-bloomer':
        // Adjust peak years later
        return this.adjustForLateBloomer(baseProjection, player);
      
      case 'injury-prone':
        // Increase variability and downside
        return this.adjustForInjuryProne(baseProjection, player);
      
      case 'system-dependent':
        // Add team situation variability
        return this.adjustForSystemDependence(baseProjection, player);
      
      default:
        return baseProjection;
    }
  }

  private adjustForLateBloomer(
    projection: ValueProjection,
    player: Player
  ): ValueProjection {
    // Shift peak 2 years later
    const adjusted = { ...projection };
    adjusted.peakValueYear = Math.min(4, projection.peakValueYear + 2);
    adjusted.declineStartYear = Math.min(5, projection.declineStartYear + 2);
    
    // Increase early year values
    adjusted.confidenceIntervals.median[0] *= 1.15;
    adjusted.confidenceIntervals.median[1] *= 1.25;
    
    return adjusted;
  }

  private adjustForInjuryProne(
    projection: ValueProjection,
    player: Player
  ): ValueProjection {
    const adjusted = { ...projection };
    
    // Widen confidence intervals
    for (let i = 0; i < 5; i++) {
      adjusted.confidenceIntervals.low[i] *= 0.7;
      adjusted.confidenceIntervals.high[i] *= 0.9;
    }
    
    // Reduce overall values
    adjusted.currentYearValue *= 0.85;
    adjusted.threeYearValue *= 0.8;
    adjusted.fiveYearValue *= 0.75;
    
    return adjusted;
  }

  private adjustForSystemDependence(
    projection: ValueProjection,
    player: Player
  ): ValueProjection {
    const adjusted = { ...projection };
    
    // Add team-based variability
    const teamFactor = Math.random() * 0.3 + 0.85; // 0.85-1.15
    
    for (let i = 0; i < 5; i++) {
      adjusted.confidenceIntervals.median[i] *= teamFactor;
      adjusted.confidenceIntervals.low[i] *= (teamFactor * 0.8);
      adjusted.confidenceIntervals.high[i] *= (teamFactor * 1.2);
    }
    
    return adjusted;
  }
}
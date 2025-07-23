/**
 * Window Calculator - Championship Window Analysis
 * Determines competitive timeline and optimal strategies
 */

import {
  Player,
  ChampionshipWindow,
  TeamMetrics,
  LeagueContext,
  TeamStrategy,
  DraftApproach,
  KeeperApproach
} from './types';

export class WindowCalculator {
  private readonly WINDOW_THRESHOLDS = {
    competing: { minValue: 75, minElitePlayers: 4, maxAge: 29 },
    fringe: { minValue: 65, minElitePlayers: 2, maxAge: 30 },
    rebuilding: { maxValue: 55, maxAge: 27 },
    retooling: { minValue: 55, maxValue: 75 }
  };

  constructor(private leagueContext: LeagueContext) {}

  /**
   * Calculate championship window
   */
  async calculateWindow(
    roster: Player[],
    teamMetrics: TeamMetrics
  ): Promise<ChampionshipWindow> {
    // Determine competitive status
    const status = this.determineStatus(roster, teamMetrics);
    
    // Find peak competitive year
    const peakYear = this.findPeakYear(roster, teamMetrics);
    
    // Calculate window duration
    const duration = this.calculateDuration(roster, status);
    
    // Project championship probabilities
    const probabilities = this.projectProbabilities(
      roster,
      teamMetrics,
      duration
    );
    
    // Determine recommended strategy
    const strategy = this.determineStrategy(status, roster, teamMetrics);

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
  private determineStatus(
    roster: Player[],
    teamMetrics: TeamMetrics
  ): 'competing' | 'fringe' | 'rebuilding' | 'retooling' {
    const currentValue = teamMetrics.currentRosterValue;
    const elitePlayers = this.countElitePlayers(roster);
    const avgAge = this.calculateAverageAge(roster);
    const youngTalent = this.countYoungTalent(roster);
    const depthScore = this.calculateDepthScore(roster);
    
    // Competing: High value, multiple elite players, good age
    if (currentValue >= this.WINDOW_THRESHOLDS.competing.minValue &&
        elitePlayers >= this.WINDOW_THRESHOLDS.competing.minElitePlayers &&
        avgAge <= this.WINDOW_THRESHOLDS.competing.maxAge &&
        depthScore > 0.7) {
      return 'competing';
    }
    
    // Fringe: Decent value, some elite players
    if (currentValue >= this.WINDOW_THRESHOLDS.fringe.minValue &&
        elitePlayers >= this.WINDOW_THRESHOLDS.fringe.minElitePlayers) {
      return 'fringe';
    }
    
    // Rebuilding: Low value or old roster with young talent
    if ((currentValue <= this.WINDOW_THRESHOLDS.rebuilding.maxValue ||
         avgAge > 30) && youngTalent >= 3) {
      return 'rebuilding';
    }
    
    // Retooling: Everything else
    return 'retooling';
  }

  /**
   * Find peak competitive year
   */
  private findPeakYear(
    roster: Player[],
    teamMetrics: TeamMetrics
  ): number {
    const projectedValues = teamMetrics.futureRosterValue;
    let maxValue = teamMetrics.currentRosterValue;
    let peakYear = 0;
    
    // Look at next 5 years
    for (let i = 0; i < Math.min(5, projectedValues.length); i++) {
      if (projectedValues[i] > maxValue) {
        maxValue = projectedValues[i];
        peakYear = i + 1;
      }
    }
    
    // Adjust based on player peaks
    const playerPeaks = this.analyzePlayerPeaks(roster);
    const avgPeak = playerPeaks.reduce((sum, peak) => sum + peak, 0) / playerPeaks.length;
    
    // Weight between projection and player analysis
    return Math.round((peakYear * 0.7) + (avgPeak * 0.3));
  }

  /**
   * Calculate window duration
   */
  private calculateDuration(
    roster: Player[],
    status: string
  ): number {
    const corePlayers = this.identifyCorePlayers(roster);
    const avgCoreAge = this.calculateAverageAge(corePlayers);
    
    if (status === 'competing') {
      // Based on core player ages
      if (avgCoreAge <= 26) return 4;
      if (avgCoreAge <= 28) return 3;
      if (avgCoreAge <= 30) return 2;
      return 1;
    } else if (status === 'rebuilding') {
      // Time to competitiveness
      const youngStars = roster.filter(p => 
        p.age <= 24 && this.isHighPotential(p)
      ).length;
      
      if (youngStars >= 4) return 2;
      if (youngStars >= 2) return 3;
      return 4;
    }
    
    // Default for fringe/retooling
    return 2;
  }

  /**
   * Project championship probabilities
   */
  private projectProbabilities(
    roster: Player[],
    teamMetrics: TeamMetrics,
    years: number
  ): number[] {
    const probabilities: number[] = [];
    const baseProb = 1 / 12; // Assume 12-team league
    
    for (let year = 0; year < years; year++) {
      const projectedValue = teamMetrics.futureRosterValue[year] || 
                            teamMetrics.currentRosterValue;
      const ageAdjustment = this.calculateAgeAdjustment(roster, year);
      const depthFactor = this.calculateDepthScore(roster);
      
      // Value-based multiplier
      let valueMultiplier = 1;
      if (projectedValue >= 85) valueMultiplier = 3;
      else if (projectedValue >= 75) valueMultiplier = 2.2;
      else if (projectedValue >= 65) valueMultiplier = 1.5;
      else if (projectedValue < 50) valueMultiplier = 0.5;
      
      // Calculate probability
      const probability = baseProb * valueMultiplier * ageAdjustment * 
                         (0.7 + depthFactor * 0.3);
      
      probabilities.push(Math.min(0.35, probability));
    }
    
    return probabilities;
  }

  /**
   * Determine recommended strategy
   */
  private determineStrategy(
    status: string,
    roster: Player[],
    teamMetrics: TeamMetrics
  ): TeamStrategy {
    const approach = this.selectApproach(status);
    const targetPositions = this.identifyNeeds(roster);
    const draftStrategy = this.createDraftStrategy(status, roster);
    const keeperStrategy = this.createKeeperStrategy(status, roster);
    const tradeTargets = this.identifyTradeTargets(status, roster, teamMetrics);

    return {
      approach,
      targetPositions,
      tradeTargets,
      draftStrategy,
      keeperStrategy
    };
  }

  /**
   * Count elite players
   */
  private countElitePlayers(roster: Player[]): number {
    return roster.filter(player => {
      const recentPerf = player.performanceHistory[
        player.performanceHistory.length - 1
      ];
      return recentPerf && recentPerf.positionRank <= 6;
    }).length;
  }

  /**
   * Calculate average age of roster
   */
  private calculateAverageAge(players: Player[]): number {
    if (players.length === 0) return 27;
    const totalAge = players.reduce((sum, p) => sum + p.age, 0);
    return totalAge / players.length;
  }

  /**
   * Count young talent
   */
  private countYoungTalent(roster: Player[]): number {
    return roster.filter(player => {
      if (player.age > 25) return false;
      
      const recentPerf = player.performanceHistory[
        player.performanceHistory.length - 1
      ];
      
      // Young player who's shown promise
      return recentPerf && (recentPerf.positionRank <= 24 || 
                           player.yearsInLeague <= 2);
    }).length;
  }

  /**
   * Calculate roster depth score
   */
  private calculateDepthScore(roster: Player[]): number {
    const positionDepth: Record<string, number> = {};
    const idealDepth: Record<string, number> = {
      QB: 2,
      RB: 5,
      WR: 6,
      TE: 2,
      K: 1,
      DEF: 1
    };
    
    // Count quality players by position
    for (const player of roster) {
      const recentPerf = player.performanceHistory[
        player.performanceHistory.length - 1
      ];
      
      if (recentPerf && recentPerf.positionRank <= 36) {
        positionDepth[player.position] = (positionDepth[player.position] || 0) + 1;
      }
    }
    
    // Calculate depth score
    let totalScore = 0;
    let positions = 0;
    
    for (const [position, ideal] of Object.entries(idealDepth)) {
      const actual = positionDepth[position] || 0;
      const score = Math.min(1, actual / ideal);
      totalScore += score;
      positions++;
    }
    
    return totalScore / positions;
  }

  /**
   * Analyze when players will peak
   */
  private analyzePlayerPeaks(roster: Player[]): number[] {
    const peaks: number[] = [];
    
    for (const player of roster) {
      const yearsToPeak = this.calculateYearsToPeak(player);
      peaks.push(yearsToPeak);
    }
    
    return peaks;
  }

  /**
   * Calculate years until player peaks
   */
  private calculateYearsToPeak(player: Player): number {
    const peakAges: Record<string, number> = {
      QB: 28,
      RB: 25,
      WR: 26,
      TE: 27,
      K: 30,
      DEF: 0
    };
    
    const peakAge = peakAges[player.position] || 26;
    const yearsToPeak = Math.max(0, peakAge - player.age);
    
    // Adjust for current performance
    const recentPerf = player.performanceHistory[
      player.performanceHistory.length - 1
    ];
    
    if (recentPerf && recentPerf.positionRank <= 5) {
      // Already elite, might be at peak
      return 0;
    }
    
    return yearsToPeak;
  }

  /**
   * Identify core players
   */
  private identifyCorePlayers(roster: Player[]): Player[] {
    return roster.filter(player => {
      const recentPerf = player.performanceHistory[
        player.performanceHistory.length - 1
      ];
      
      // Top 12 at position or young with high potential
      return (recentPerf && recentPerf.positionRank <= 12) ||
             (player.age <= 25 && this.isHighPotential(player));
    }).slice(0, 8); // Top 8 players
  }

  /**
   * Check if player has high potential
   */
  private isHighPotential(player: Player): boolean {
    // Young player showing improvement
    if (player.performanceHistory.length < 2) return player.age <= 23;
    
    const recent = player.performanceHistory[player.performanceHistory.length - 1];
    const previous = player.performanceHistory[player.performanceHistory.length - 2];
    
    return recent.fantasyPoints > previous.fantasyPoints * 1.2 &&
           recent.positionRank <= 30;
  }

  /**
   * Calculate age adjustment for probabilities
   */
  private calculateAgeAdjustment(roster: Player[], yearsOut: number): number {
    const corePlayers = this.identifyCorePlayers(roster);
    const projectedAvgAge = this.calculateAverageAge(corePlayers) + yearsOut;
    
    if (projectedAvgAge <= 27) return 1.1;
    if (projectedAvgAge <= 29) return 1.0;
    if (projectedAvgAge <= 31) return 0.85;
    return 0.7;
  }

  /**
   * Select approach based on status
   */
  private selectApproach(status: string): 'win-now' | 'balanced' | 'rebuild' {
    switch (status) {
      case 'competing': return 'win-now';
      case 'rebuilding': return 'rebuild';
      default: return 'balanced';
    }
  }

  /**
   * Identify position needs
   */
  private identifyNeeds(roster: Player[]): string[] {
    const needs: string[] = [];
    const positionCounts: Record<string, number> = {};
    const positionQuality: Record<string, number[]> = {};
    
    // Count and assess quality by position
    for (const player of roster) {
      positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
      
      const recentPerf = player.performanceHistory[
        player.performanceHistory.length - 1
      ];
      
      if (recentPerf) {
        if (!positionQuality[player.position]) {
          positionQuality[player.position] = [];
        }
        positionQuality[player.position].push(recentPerf.positionRank);
      }
    }
    
    // Check each position
    const requirements: Record<string, { min: number; qualityThreshold: number }> = {
      QB: { min: 1, qualityThreshold: 15 },
      RB: { min: 3, qualityThreshold: 24 },
      WR: { min: 4, qualityThreshold: 30 },
      TE: { min: 1, qualityThreshold: 12 }
    };
    
    for (const [position, req] of Object.entries(requirements)) {
      const count = positionCounts[position] || 0;
      const quality = positionQuality[position] || [];
      const hasQuality = quality.some(rank => rank <= req.qualityThreshold);
      
      if (count < req.min || !hasQuality) {
        needs.push(position);
      }
    }
    
    return needs;
  }

  /**
   * Create draft strategy
   */
  private createDraftStrategy(
    status: string,
    roster: Player[]
  ): DraftApproach {
    const needs = this.identifyNeeds(roster);
    
    switch (status) {
      case 'competing':
        return {
          philosophy: 'Draft for immediate impact and depth',
          targetRounds: [2, 3, 4], // Mid rounds for depth
          avoidPositions: ['QB'], // Don't waste picks on backups
          targetArchetypes: ['proven veterans', 'handcuffs', 'situational specialists']
        };
      
      case 'rebuilding':
        return {
          philosophy: 'Best player available with focus on youth',
          targetRounds: [1, 2], // Focus on early picks
          avoidPositions: ['K', 'DEF'],
          targetArchetypes: ['high ceiling rookies', 'second-year breakouts']
        };
      
      case 'fringe':
        return {
          philosophy: 'Target high-upside players who could push you over',
          targetRounds: [1, 2, 3],
          avoidPositions: [],
          targetArchetypes: ['breakout candidates', 'situation upgrades']
        };
      
      default: // retooling
        return {
          philosophy: 'Balanced approach with value focus',
          targetRounds: [2, 3, 4, 5],
          avoidPositions: [],
          targetArchetypes: ['value picks', 'roster balance']
        };
    }
  }

  /**
   * Create keeper strategy
   */
  private createKeeperStrategy(
    status: string,
    roster: Player[]
  ): KeeperApproach {
    const avgAge = this.calculateAverageAge(roster);
    
    switch (status) {
      case 'competing':
        return {
          philosophy: 'Keep proven producers regardless of age',
          priorityPositions: ['RB', 'WR', 'QB'],
          ageTargets: [24, 31],
          contractStrategy: 'Pay to keep elite talent'
        };
      
      case 'rebuilding':
        return {
          philosophy: 'Only keep young players with upside',
          priorityPositions: ['WR', 'QB', 'TE'], // Longer careers
          ageTargets: [21, 25],
          contractStrategy: 'Maintain flexibility for future'
        };
      
      case 'fringe':
        return {
          philosophy: 'Keep core players, seek value in others',
          priorityPositions: ['RB', 'WR', 'TE'],
          ageTargets: [23, 28],
          contractStrategy: 'Strategic overpays for difference makers'
        };
      
      default: // retooling
        return {
          philosophy: 'Flexible approach based on value',
          priorityPositions: ['WR', 'RB', 'QB'],
          ageTargets: [22, 27],
          contractStrategy: 'Value-based decisions'
        };
    }
  }

  /**
   * Identify trade targets
   */
  private identifyTradeTargets(
    status: string,
    roster: Player[],
    teamMetrics: TeamMetrics
  ): any[] {
    const suggestions: any[] = [];
    
    if (status === 'competing') {
      // Trade future for now
      suggestions.push({
        give: [{ type: 'pick', round: 1, year: new Date().getFullYear() + 1 }],
        receive: [{ type: 'player', position: 'RB', age: 28, value: 85 }],
        netValueGain: -5,
        windowImpact: 20,
        riskAdjustedValue: 80
      });
    } else if (status === 'rebuilding') {
      // Trade veterans for youth/picks
      const veterans = roster.filter(p => p.age >= 28);
      if (veterans.length > 0) {
        suggestions.push({
          give: [{ type: 'player', value: 70 }],
          receive: [
            { type: 'pick', round: 1 },
            { type: 'player', age: 23, value: 50 }
          ],
          netValueGain: 10,
          windowImpact: -10,
          riskAdjustedValue: 75
        });
      }
    }
    
    return suggestions;
  }

  /**
   * Advanced window analysis
   */
  async analyzeWindowTransition(
    roster: Player[],
    teamMetrics: TeamMetrics,
    proposedMoves: any[]
  ): Promise<{
    currentWindow: ChampionshipWindow;
    projectedWindow: ChampionshipWindow;
    transitionRisk: number;
    recommendation: string;
  }> {
    // Get current window
    const currentWindow = await this.calculateWindow(roster, teamMetrics);
    
    // Simulate roster after moves
    const projectedRoster = this.simulateRosterMoves(roster, proposedMoves);
    const projectedMetrics = this.projectMetricsAfterMoves(teamMetrics, proposedMoves);
    
    // Calculate new window
    const projectedWindow = await this.calculateWindow(
      projectedRoster,
      projectedMetrics
    );
    
    // Assess transition risk
    const transitionRisk = this.calculateTransitionRisk(
      currentWindow,
      projectedWindow,
      proposedMoves
    );
    
    // Generate recommendation
    const recommendation = this.generateTransitionRecommendation(
      currentWindow,
      projectedWindow,
      transitionRisk
    );
    
    return {
      currentWindow,
      projectedWindow,
      transitionRisk,
      recommendation
    };
  }

  /**
   * Simulate roster after moves
   */
  private simulateRosterMoves(roster: Player[], moves: any[]): Player[] {
    // Simplified simulation
    // In production, would actually process adds/drops
    return [...roster];
  }

  /**
   * Project metrics after moves
   */
  private projectMetricsAfterMoves(
    metrics: TeamMetrics,
    moves: any[]
  ): TeamMetrics {
    // Simplified projection
    // Would calculate actual impact
    return { ...metrics };
  }

  /**
   * Calculate transition risk
   */
  private calculateTransitionRisk(
    current: ChampionshipWindow,
    projected: ChampionshipWindow,
    moves: any[]
  ): number {
    let risk = 0;
    
    // Status change risk
    if (current.status !== projected.status) {
      risk += 0.3;
    }
    
    // Probability drop risk
    const probDrop = current.championshipProbability[0] - 
                     projected.championshipProbability[0];
    if (probDrop > 0.1) {
      risk += probDrop * 2;
    }
    
    // Move quantity risk
    risk += moves.length * 0.05;
    
    return Math.min(1, risk);
  }

  /**
   * Generate transition recommendation
   */
  private generateTransitionRecommendation(
    current: ChampionshipWindow,
    projected: ChampionshipWindow,
    risk: number
  ): string {
    if (risk < 0.3 && projected.championshipProbability[0] > 
        current.championshipProbability[0]) {
      return 'RECOMMENDED - Low risk improvement to championship odds';
    }
    
    if (risk < 0.5 && current.status === 'fringe' && 
        projected.status === 'competing') {
      return 'RECOMMENDED - Successfully pushes team into contention';
    }
    
    if (risk > 0.7) {
      return 'RISKY - High transition risk may backfire';
    }
    
    if (current.status === 'competing' && 
        projected.status !== 'competing') {
      return 'NOT RECOMMENDED - Removes team from contention';
    }
    
    return 'NEUTRAL - Marginal impact on championship window';
  }

  /**
   * Monte Carlo simulation for window probabilities
   */
  async runMonteCarloSimulation(
    roster: Player[],
    teamMetrics: TeamMetrics,
    seasons: number = 5,
    simulations: number = 1000
  ): Promise<{
    avgFinish: number[];
    playoffRate: number[];
    championshipRate: number[];
    confidence: number;
  }> {
    const results = {
      avgFinish: new Array(seasons).fill(0),
      playoffRate: new Array(seasons).fill(0),
      championshipRate: new Array(seasons).fill(0)
    };
    
    for (let sim = 0; sim < simulations; sim++) {
      const simResults = await this.simulateSeason(roster, teamMetrics, seasons);
      
      for (let season = 0; season < seasons; season++) {
        results.avgFinish[season] += simResults.finishes[season];
        if (simResults.madePlayoffs[season]) {
          results.playoffRate[season]++;
        }
        if (simResults.wonChampionship[season]) {
          results.championshipRate[season]++;
        }
      }
    }
    
    // Average out results
    for (let season = 0; season < seasons; season++) {
      results.avgFinish[season] /= simulations;
      results.playoffRate[season] /= simulations;
      results.championshipRate[season] /= simulations;
    }
    
    // Calculate confidence based on result variance
    const confidence = this.calculateSimulationConfidence(results, simulations);
    
    return { ...results, confidence };
  }

  /**
   * Simulate a season
   */
  private async simulateSeason(
    roster: Player[],
    teamMetrics: TeamMetrics,
    seasons: number
  ): Promise<any> {
    const finishes: number[] = [];
    const madePlayoffs: boolean[] = [];
    const wonChampionship: boolean[] = [];
    
    for (let season = 0; season < seasons; season++) {
      // Simple simulation based on team value
      const value = teamMetrics.futureRosterValue[season] || 
                   teamMetrics.currentRosterValue;
      
      // Random performance with value influence
      const performance = value + (Math.random() - 0.5) * 40;
      const finish = Math.floor(13 - (performance / 10));
      
      finishes.push(Math.max(1, Math.min(12, finish)));
      madePlayoffs.push(finish <= 6);
      wonChampionship.push(finish === 1 && Math.random() < 0.3);
    }
    
    return { finishes, madePlayoffs, wonChampionship };
  }

  /**
   * Calculate simulation confidence
   */
  private calculateSimulationConfidence(
    results: any,
    simulations: number
  ): number {
    // Higher confidence with more simulations and consistent results
    const baseConfidence = Math.min(0.95, simulations / 2000);
    
    // Reduce confidence if results are highly variable
    const variance = this.calculateResultVariance(results);
    const varianceP enalty = Math.min(0.2, variance);
    
    return baseConfidence - variancePenalty;
  }

  /**
   * Calculate result variance
   */
  private calculateResultVariance(results: any): number {
    // Simplified variance calculation
    let totalVariance = 0;
    
    for (let i = 1; i < results.avgFinish.length; i++) {
      const change = Math.abs(results.avgFinish[i] - results.avgFinish[i-1]);
      totalVariance += change / 12; // Normalize by league size
    }
    
    return totalVariance / results.avgFinish.length;
  }
}
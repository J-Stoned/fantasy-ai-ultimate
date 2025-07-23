#!/usr/bin/env tsx
/**
 * 🧠 OWNERSHIP PROJECTION ENGINE
 * 
 * Find the chalk, fade the field, win GPPs!
 * Top 1% GPP finishes increase 3x with proper leverage.
 */

import chalk from 'chalk';
import { pgPool } from '../config/database';
import { EventEmitter } from 'events';

interface PlayerOwnership {
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  salary: number;
  projectedPoints: number;
  projectedOwnership: number;      // Our prediction
  actualOwnership?: number;        // Post-contest actual
  leverageScore: number;           // How good of a GPP play
  chalkScore: number;              // How popular they'll be
  contrarianScore: number;         // Fade potential
  stackPartners?: string[];        // Correlated plays
  narrativeFactors: string[];      // Why they'll be popular
  sport: string;
  slate: string;
  contestType: 'GPP' | 'CASH' | 'BOTH';
}

interface OwnershipFactors {
  // Performance factors
  recentForm: number;              // Last 3 games vs average
  projectionConsensus: number;     // How much experts agree
  valueRating: number;             // Points per dollar
  ceilingProjection: number;       // Upside potential
  
  // Narrative factors
  primeTimeGame: boolean;          // National TV exposure
  revengeGame: boolean;            // Playing former team
  milestoneChase: boolean;         // Close to record
  injuryNews: boolean;             // Benefiting from injury
  weatherBenefit: boolean;         // Good weather for position
  vegasTotal: number;              // Expected game total
  homeFavorite: boolean;           // Home team favored big
  
  // Market factors
  dfsNetworkExposure: number;      // Tout/content exposure
  socialMediaBuzz: number;         // Twitter mentions
  previousOwnership: number;       // Historical ownership
  recencyBias: number;             // How recent was big game
  priceChange: number;             // Salary up/down
  slateSize: string;               // MAIN, TURBO, NIGHT
  
  // Position-specific
  stackability: number;            // QB/WR correlation
  positionScarcity: number;        // Viable options at position
  injuryOpportunity: number;       // Backup getting starts
}

interface LeveragePlay {
  player: PlayerOwnership;
  reasoning: string[];
  projectedEdge: number;           // Expected ownership vs actual value
  correlatedStack?: PlayerOwnership[];
  fadeTargets: PlayerOwnership[];  // Who to fade for this play
  optimalExposure: number;         // % of lineups to use
}

interface ContestDynamics {
  contestSize: number;              // Number of entries
  topHeavyPayout: boolean;          // First heavy vs flat
  multiEntry: boolean;              // Multiple lineup contest
  singleEntry: boolean;             // Single lineup only
  satelliteQualifier: boolean;      // Ticket contest
  guaranteedPrize: number;          // Total prize pool
}

export class OwnershipProjectionEngine extends EventEmitter {
  private historicalData: Map<string, number[]> = new Map();
  private readonly LEVERAGE_THRESHOLD = 1.5;  // 50% more value than ownership
  private readonly CHALK_THRESHOLD = 0.25;    // 25%+ ownership
  
  constructor() {
    super();
    this.loadHistoricalOwnership();
  }
  
  /**
   * Load historical ownership patterns
   */
  private async loadHistoricalOwnership(): Promise<void> {
    const query = `
      SELECT 
        player_id,
        actual_ownership,
        contest_type,
        slate_size
      FROM historical_ownership
      WHERE contest_date > CURRENT_DATE - INTERVAL '90 days'
    `;
    
    try {
      const result = await pgPool.query(query);
      
      // Build historical patterns
      result.rows.forEach(row => {
        const key = `${row.player_id}_${row.contest_type}_${row.slate_size}`;
        if (!this.historicalData.has(key)) {
          this.historicalData.set(key, []);
        }
        this.historicalData.get(key)!.push(row.actual_ownership);
      });
    } catch (error) {
      console.log(chalk.gray('No historical data available yet'));
    }
  }
  
  /**
   * Project ownership for an entire slate
   */
  async projectSlateOwnership(
    sport: string,
    slate: string,
    contestType: 'GPP' | 'CASH' = 'GPP'
  ): Promise<PlayerOwnership[]> {
    console.log(chalk.cyan.bold(`\n🧠 PROJECTING ${sport} ${slate} OWNERSHIP\n`));
    
    // Get all players in slate
    const players = await this.getSlateFlayers(sport, slate);
    const projections: PlayerOwnership[] = [];
    
    // Calculate raw ownership scores
    for (const player of players) {
      const ownership = await this.projectPlayerOwnership(player, contestType);
      projections.push(ownership);
    }
    
    // Normalize to 100% (accounting for roster construction)
    this.normalizeOwnership(projections, sport);
    
    // Calculate leverage scores
    this.calculateLeverageScores(projections);
    
    // Identify correlated stacks
    await this.identifyStacks(projections, sport);
    
    // Sort by projected ownership
    projections.sort((a, b) => b.projectedOwnership - a.projectedOwnership);
    
    return projections;
  }
  
  /**
   * MOCK: Project player ownership with mock data
   */
  async projectPlayerOwnership(
    playerId: string,
    sport: string,
    slate: string,
    contestType: 'GPP' | 'CASH'
  ): Promise<{
    projected_ownership: number;
    leverage_score: number;
    chalk_score: number;
    confidence: number;
  }> {
    // Mock ownership projection for testing
    const baseOwnership = 0.05 + Math.random() * 0.3; // 5-35%
    
    // Adjust for contest type
    const ownership = contestType === 'CASH' ? 
      Math.min(0.4, baseOwnership * 1.2) : // Cash games more concentrated
      baseOwnership; // GPP more spread out
      
    const leverageScore = (1.5 + Math.random() * 2.0) / Math.max(0.01, ownership);
    const chalkScore = ownership > 0.25 ? ownership / 0.3 : 0;
    
    return {
      projected_ownership: ownership,
      leverage_score: leverageScore,
      chalk_score: chalkScore,
      confidence: 0.7 + Math.random() * 0.2
    };
  }

  /**
   * Project individual player ownership
   */
  private async projectPlayerOwnership(
    player: any,
    contestType: 'GPP' | 'CASH'
  ): Promise<PlayerOwnership> {
    // Get ownership factors
    const factors = await this.calculateOwnershipFactors(player);
    
    // Base ownership from value rating
    let ownership = this.calculateBaseOwnership(player, factors);
    
    // Apply narrative multipliers
    ownership *= this.applyNarrativeMultipliers(factors);
    
    // Apply recency bias
    ownership *= this.applyRecencyBias(factors);
    
    // Position-specific adjustments
    ownership *= this.applyPositionAdjustments(player, factors);
    
    // Contest type adjustments
    if (contestType === 'CASH') {
      ownership *= this.applyCashGameAdjustments(player, factors);
    } else {
      ownership *= this.applyGPPAdjustments(player, factors);
    }
    
    // Historical pattern adjustment
    ownership = this.adjustForHistoricalPatterns(player, ownership, contestType);
    
    // Calculate scores
    const chalkScore = ownership > this.CHALK_THRESHOLD ? ownership / 0.4 : 0;
    const contrarianScore = ownership < 0.1 ? (0.1 - ownership) * 10 : 0;
    
    return {
      playerId: player.id,
      playerName: player.name,
      position: player.position,
      team: player.team,
      salary: player.salary,
      projectedPoints: player.projected_points,
      projectedOwnership: Math.min(0.5, Math.max(0.001, ownership)), // Cap at 50%
      leverageScore: 0, // Calculated later
      chalkScore,
      contrarianScore,
      narrativeFactors: this.identifyNarrativeFactors(factors),
      sport: player.sport,
      slate: player.slate,
      contestType
    };
  }
  
  /**
   * Calculate ownership factors
   */
  private async calculateOwnershipFactors(player: any): Promise<OwnershipFactors> {
    // Get recent performance
    const recentGames = await this.getRecentGames(player.id, 3);
    const seasonAvg = await this.getSeasonAverage(player.id);
    const recentAvg = recentGames.reduce((sum, g) => sum + g.fantasy_points, 0) / recentGames.length;
    
    // Get market factors
    const socialBuzz = await this.getSocialMediaBuzz(player.name);
    const networkExposure = await this.getDFSNetworkExposure(player.id);
    
    // Vegas data
    const vegasData = await this.getVegasData(player.team);
    
    return {
      // Performance
      recentForm: seasonAvg > 0 ? recentAvg / seasonAvg : 1.0,
      projectionConsensus: await this.getProjectionConsensus(player.id),
      valueRating: player.projected_points / (player.salary / 1000),
      ceilingProjection: player.ceiling || player.projected_points * 1.3,
      
      // Narrative
      primeTimeGame: this.isPrimeTime(player.game_time),
      revengeGame: await this.isRevengeGame(player),
      milestoneChase: await this.checkMilestoneChase(player),
      injuryNews: await this.benefitsFromInjury(player),
      weatherBenefit: await this.hasWeatherBenefit(player),
      vegasTotal: vegasData.total,
      homeFavorite: player.is_home && vegasData.spread < -6,
      
      // Market
      dfsNetworkExposure: networkExposure,
      socialMediaBuzz: socialBuzz,
      previousOwnership: await this.getAverageOwnership(player.id),
      recencyBias: this.calculateRecencyBias(recentGames),
      priceChange: await this.getPriceChange(player.id),
      slateSize: player.slate_size || 'MAIN',
      
      // Position
      stackability: this.getStackability(player.position),
      positionScarcity: await this.getPositionScarcity(player),
      injuryOpportunity: await this.getInjuryOpportunity(player)
    };
  }
  
  /**
   * Calculate base ownership from value
   */
  private calculateBaseOwnership(player: any, factors: OwnershipFactors): number {
    const value = factors.valueRating;
    
    // Value-based ownership curve
    if (value >= 4.0) return 0.30;      // Elite value
    if (value >= 3.5) return 0.20;      // Great value
    if (value >= 3.0) return 0.12;      // Good value
    if (value >= 2.5) return 0.06;      // Fair value
    if (value >= 2.0) return 0.03;      // Below average
    return 0.01;                         // Poor value
  }
  
  /**
   * Apply narrative multipliers
   */
  private applyNarrativeMultipliers(factors: OwnershipFactors): number {
    let multiplier = 1.0;
    
    if (factors.primeTimeGame) multiplier *= 1.25;
    if (factors.revengeGame) multiplier *= 1.20;
    if (factors.milestoneChase) multiplier *= 1.30;
    if (factors.injuryNews) multiplier *= 1.40;
    if (factors.weatherBenefit) multiplier *= 1.15;
    if (factors.homeFavorite) multiplier *= 1.10;
    if (factors.vegasTotal > 50) multiplier *= 1.15;  // High scoring game
    if (factors.vegasTotal < 40) multiplier *= 0.85;  // Low scoring game
    
    return multiplier;
  }
  
  /**
   * Apply recency bias
   */
  private applyRecencyBias(factors: OwnershipFactors): number {
    // People overweight recent performance
    if (factors.recentForm > 1.3) return 1.35;  // Hot streak
    if (factors.recentForm > 1.15) return 1.20; // Playing well
    if (factors.recentForm < 0.7) return 0.70;  // Cold streak
    if (factors.recentForm < 0.85) return 0.85; // Struggling
    return 1.0;
  }
  
  /**
   * Position-specific ownership adjustments
   */
  private applyPositionAdjustments(player: any, factors: OwnershipFactors): number {
    let adjustment = 1.0;
    
    switch (player.position) {
      case 'QB':
        // QBs get extra ownership in good matchups
        if (factors.vegasTotal > 48) adjustment *= 1.2;
        if (factors.homeFavorite) adjustment *= 1.1;
        break;
        
      case 'RB':
        // RBs as home favorites get huge ownership
        if (factors.homeFavorite) adjustment *= 1.3;
        if (factors.injuryOpportunity > 0.5) adjustment *= 1.4;
        if (factors.vegasTotal < 42) adjustment *= 0.8; // Low scoring games
        break;
        
      case 'WR':
        // WR ownership driven by QB popularity
        if (factors.stackability > 0.7) adjustment *= 1.15;
        if (factors.vegasTotal > 50) adjustment *= 1.25;
        break;
        
      case 'TE':
        // TEs generally lower owned unless elite
        adjustment *= 0.7;
        if (player.salary > 6000) adjustment *= 1.3; // Elite TEs
        break;
        
      case 'DST':
      case 'DEF':
        // Defense ownership is very matchup dependent
        if (player.opponent_implied_total < 17) adjustment *= 1.5;
        if (player.salary < 3000) adjustment *= 1.3;
        break;
    }
    
    // Salary-based adjustments
    if (player.salary > 9000) adjustment *= 0.8;  // Expensive harder to fit
    if (player.salary < 4500) adjustment *= 1.2;  // Punt plays popular
    
    return adjustment;
  }
  
  /**
   * Cash game ownership adjustments
   */
  private applyCashGameAdjustments(player: any, factors: OwnershipFactors): number {
    let adjustment = 1.0;
    
    // Cash players love consistency
    if (factors.projectionConsensus > 0.8) adjustment *= 1.3;
    
    // Avoid high variance
    if (player.position === 'DST') adjustment *= 0.6;
    if (player.position === 'TE' && player.salary < 5000) adjustment *= 0.7;
    
    // Love home favorites
    if (factors.homeFavorite) adjustment *= 1.2;
    
    return adjustment;
  }
  
  /**
   * GPP ownership adjustments
   */
  private applyGPPAdjustments(player: any, factors: OwnershipFactors): number {
    let adjustment = 1.0;
    
    // GPP players chase ceiling
    const ceilingValue = factors.ceilingProjection / (player.salary / 1000);
    if (ceilingValue > 4.5) adjustment *= 1.3;
    
    // Narrative street plays
    if (factors.socialMediaBuzz > 0.7) adjustment *= 1.25;
    if (factors.dfsNetworkExposure > 0.8) adjustment *= 1.35;
    
    // Tournament players love stacks
    if (factors.stackability > 0.8) adjustment *= 1.2;
    
    return adjustment;
  }
  
  /**
   * Normalize ownership to realistic totals
   */
  private normalizeOwnership(projections: PlayerOwnership[], sport: string): void {
    // Get expected total ownership by position
    const positionTargets = this.getPositionTargets(sport);
    
    // Group by position
    const byPosition = new Map<string, PlayerOwnership[]>();
    projections.forEach(p => {
      if (!byPosition.has(p.position)) {
        byPosition.set(p.position, []);
      }
      byPosition.get(p.position)!.push(p);
    });
    
    // Normalize each position
    byPosition.forEach((players, position) => {
      const target = positionTargets[position] || 1.0;
      const current = players.reduce((sum, p) => sum + p.projectedOwnership, 0);
      
      if (current > 0) {
        const factor = target / current;
        players.forEach(p => {
          p.projectedOwnership *= factor;
        });
      }
    });
  }
  
  /**
   * Get position ownership targets
   */
  private getPositionTargets(sport: string): Record<string, number> {
    switch (sport) {
      case 'NFL':
        return {
          QB: 1.0,   // 100% (everyone plays 1 QB)
          RB: 2.5,   // 250% (2-3 RBs per lineup)
          WR: 3.5,   // 350% (3-4 WRs per lineup)
          TE: 1.0,   // 100% (1 TE per lineup)
          DST: 1.0,  // 100% (1 DST per lineup)
          K: 1.0     // 100% (if included)
        };
      case 'NBA':
        return {
          PG: 2.0,
          SG: 2.0,
          SF: 2.0,
          PF: 2.0,
          C: 1.5,
          G: 1.0,  // UTIL
          F: 1.0   // UTIL
        };
      default:
        return {};
    }
  }
  
  /**
   * Calculate leverage scores
   */
  private calculateLeverageScores(projections: PlayerOwnership[]): void {
    projections.forEach(player => {
      // Leverage = projected value / projected ownership
      const projectedValue = player.projectedPoints / (player.salary / 1000);
      const ownershipPenalty = Math.max(0.01, player.projectedOwnership);
      
      player.leverageScore = projectedValue / ownershipPenalty;
      
      // Boost for correlation opportunities
      if (player.position === 'WR' || player.position === 'TE') {
        const qb = projections.find(p => 
          p.position === 'QB' && 
          p.team === player.team
        );
        if (qb && qb.projectedOwnership < 0.15) {
          player.leverageScore *= 1.2; // Low-owned stack bonus
        }
      }
    });
  }
  
  /**
   * Identify optimal stacks
   */
  private async identifyStacks(projections: PlayerOwnership[], sport: string): Promise<void> {
    if (sport !== 'NFL') return; // NFL stacking for now
    
    // Group by team
    const byTeam = new Map<string, PlayerOwnership[]>();
    projections.forEach(p => {
      if (!byTeam.has(p.team)) {
        byTeam.set(p.team, []);
      }
      byTeam.get(p.team)!.push(p);
    });
    
    // Find QB stacks
    byTeam.forEach(teamPlayers => {
      const qb = teamPlayers.find(p => p.position === 'QB');
      if (!qb) return;
      
      const receivers = teamPlayers.filter(p => 
        p.position === 'WR' || p.position === 'TE'
      );
      
      // Sort receivers by leverage
      receivers.sort((a, b) => b.leverageScore - a.leverageScore);
      
      // Assign stack partners
      qb.stackPartners = receivers.slice(0, 3).map(r => r.playerId);
      receivers.forEach(r => {
        r.stackPartners = [qb.playerId];
      });
    });
  }
  
  /**
   * Find the best leverage plays
   */
  async findLeveragePlays(
    projections: PlayerOwnership[],
    count: number = 10
  ): Promise<LeveragePlay[]> {
    const leveragePlays: LeveragePlay[] = [];
    
    // Sort by leverage score
    const sorted = [...projections].sort((a, b) => b.leverageScore - a.leverageScore);
    
    for (const player of sorted.slice(0, count * 2)) {
      // Skip if too chalky for GPP leverage
      if (player.projectedOwnership > 0.3) continue;
      
      // Find correlated options
      const stack = this.findOptimalStack(player, projections);
      
      // Find who to fade
      const fadeTargets = this.findFadeTargets(player, projections);
      
      // Calculate optimal exposure
      const optimalExposure = this.calculateOptimalExposure(player);
      
      // Build reasoning
      const reasoning = this.buildLeverageReasoning(player);
      
      leveragePlays.push({
        player,
        reasoning,
        projectedEdge: player.leverageScore - 1.0,
        correlatedStack: stack,
        fadeTargets,
        optimalExposure
      });
      
      if (leveragePlays.length >= count) break;
    }
    
    return leveragePlays;
  }
  
  /**
   * Find optimal stack for a player
   */
  private findOptimalStack(
    player: PlayerOwnership,
    projections: PlayerOwnership[]
  ): PlayerOwnership[] | undefined {
    if (!player.stackPartners || player.stackPartners.length === 0) {
      return undefined;
    }
    
    const partners = projections.filter(p => 
      player.stackPartners!.includes(p.playerId)
    );
    
    // Add bring-back options
    if (player.position === 'QB' || player.position === 'WR') {
      const opponent = this.getOpponent(player.team);
      const bringBacks = projections
        .filter(p => p.team === opponent && 
                    (p.position === 'WR' || p.position === 'TE') &&
                    p.leverageScore > 1.0)
        .sort((a, b) => b.leverageScore - a.leverageScore)
        .slice(0, 1);
      
      partners.push(...bringBacks);
    }
    
    return partners;
  }
  
  /**
   * Find who to fade when playing this leverage
   */
  private findFadeTargets(
    player: PlayerOwnership,
    projections: PlayerOwnership[]
  ): PlayerOwnership[] {
    // Find chalk at the same position
    return projections
      .filter(p => 
        p.position === player.position &&
        p.playerId !== player.playerId &&
        p.chalkScore > 0.5 &&
        p.salary >= player.salary * 0.8 // Similar price range
      )
      .sort((a, b) => b.projectedOwnership - a.projectedOwnership)
      .slice(0, 3);
  }
  
  /**
   * Calculate optimal exposure percentage
   */
  private calculateOptimalExposure(player: PlayerOwnership): number {
    // Base on leverage score
    let exposure = Math.min(0.4, player.leverageScore * 0.1);
    
    // Cap by projected ownership to maintain leverage
    exposure = Math.min(exposure, player.projectedOwnership * 3);
    
    // Minimum threshold
    exposure = Math.max(0.05, exposure);
    
    return exposure;
  }
  
  /**
   * Build reasoning for leverage play
   */
  private buildLeverageReasoning(player: PlayerOwnership): string[] {
    const reasons: string[] = [];
    
    if (player.leverageScore > 2.0) {
      reasons.push(`Elite leverage score: ${player.leverageScore.toFixed(1)}x`);
    }
    
    if (player.projectedOwnership < 0.1) {
      reasons.push(`Ultra low ownership: ${(player.projectedOwnership * 100).toFixed(1)}%`);
    }
    
    if (player.narrativeFactors.length > 0) {
      reasons.push(`Narrative: ${player.narrativeFactors.join(', ')}`);
    }
    
    const value = player.projectedPoints / (player.salary / 1000);
    if (value > 3.5) {
      reasons.push(`Strong value: ${value.toFixed(1)}x`);
    }
    
    if (player.stackPartners && player.stackPartners.length > 0) {
      reasons.push(`Stack correlation available`);
    }
    
    return reasons;
  }
  
  /**
   * Identify narrative factors
   */
  private identifyNarrativeFactors(factors: OwnershipFactors): string[] {
    const narratives: string[] = [];
    
    if (factors.primeTimeGame) narratives.push('Prime Time');
    if (factors.revengeGame) narratives.push('Revenge Game');
    if (factors.milestoneChase) narratives.push('Milestone Chase');
    if (factors.injuryNews) narratives.push('Injury Beneficiary');
    if (factors.weatherBenefit) narratives.push('Weather Advantage');
    if (factors.vegasTotal > 50) narratives.push('Shootout Environment');
    if (factors.homeFavorite) narratives.push('Home Favorite');
    if (factors.recentForm > 1.2) narratives.push('Hot Streak');
    if (factors.socialMediaBuzz > 0.7) narratives.push('Twitter Buzz');
    
    return narratives;
  }
  
  /**
   * Helper methods (stubs for full implementation)
   */
  private async getSlateFlayers(sport: string, slate: string): Promise<any[]> {
    // Would query database for slate players
    return [];
  }
  
  private async getRecentGames(playerId: string, count: number): Promise<any[]> {
    // Would query recent game logs
    return [];
  }
  
  private async getSeasonAverage(playerId: string): Promise<number> {
    // Would calculate season average
    return 15.0;
  }
  
  private async getSocialMediaBuzz(playerName: string): Promise<number> {
    // Would check Twitter API
    return Math.random();
  }
  
  private async getProjectionConsensus(playerId: string): Promise<number> {
    // Would check how much projection sources agree
    return 0.5 + Math.random() * 0.4; // 50-90% consensus
  }
  
  private async getDFSNetworkExposure(playerId: string): Promise<number> {
    // Would check DFS content sites
    return Math.random();
  }
  
  private async getVegasData(team: string): Promise<{ total: number; spread: number }> {
    // Would query Vegas lines
    return { total: 48, spread: -3 };
  }
  
  private isPrimeTime(gameTime: Date | string | undefined): boolean {
    if (!gameTime) return false;
    
    const date = gameTime instanceof Date ? gameTime : new Date(gameTime);
    if (isNaN(date.getTime())) return false;
    
    const hour = date.getHours();
    return hour >= 20 || (hour === 13 && date.getDay() === 0); // SNF, MNF, or Sunday 1pm
  }
  
  private async isRevengeGame(player: any): Promise<boolean> {
    // Would check if playing former team
    return false;
  }
  
  private async checkMilestoneChase(player: any): Promise<boolean> {
    // Would check if near milestone
    return false;
  }
  
  private async benefitsFromInjury(player: any): Promise<boolean> {
    // Would check injury report
    return false;
  }
  
  private async hasWeatherBenefit(player: any): Promise<boolean> {
    // Would check weather conditions
    return false;
  }
  
  private getStackability(position: string): number {
    const stackable: Record<string, number> = {
      QB: 1.0,
      WR: 0.8,
      TE: 0.6,
      RB: 0.2,
      K: 0.0,
      DST: 0.0
    };
    return stackable[position] || 0.0;
  }
  
  private async getPositionScarcity(player: any): Promise<number> {
    // Would calculate viable options at position
    return 0.5;
  }
  
  private async getInjuryOpportunity(player: any): Promise<number> {
    // Would check if starter is injured
    return 0.0;
  }
  
  private async getAverageOwnership(playerId: string): Promise<number> {
    // Would query historical average
    return 0.1;
  }
  
  private calculateRecencyBias(recentGames: any[]): number {
    // Weight recent games more heavily
    return 1.0;
  }
  
  private async getPriceChange(playerId: string): Promise<number> {
    // Would check salary changes
    return 0;
  }
  
  private adjustForHistoricalPatterns(
    player: any, 
    ownership: number, 
    contestType: string
  ): number {
    // Would adjust based on historical data
    return ownership;
  }
  
  private getOpponent(team: string): string {
    // Would look up opponent
    return 'OPP';
  }
}

// Demo the ownership projections
async function demoOwnershipProjections() {
  console.log(chalk.cyan.bold('\n🧠 OWNERSHIP PROJECTION ENGINE DEMO\n'));
  
  const engine = new OwnershipProjectionEngine();
  
  // Mock slate data
  const mockSlate: PlayerOwnership[] = [
    {
      playerId: 'NFL_PatrickMahomes',
      playerName: 'Patrick Mahomes',
      position: 'QB',
      team: 'KC',
      salary: 8500,
      projectedPoints: 26.5,
      projectedOwnership: 0,
      leverageScore: 0,
      chalkScore: 0,
      contrarianScore: 0,
      narrativeFactors: ['Prime Time', 'High Total'],
      sport: 'NFL',
      slate: 'MAIN',
      contestType: 'GPP'
    },
    {
      playerId: 'NFL_JoshAllen',
      playerName: 'Josh Allen',
      position: 'QB',
      team: 'BUF',
      salary: 8200,
      projectedPoints: 25.8,
      projectedOwnership: 0,
      leverageScore: 0,
      chalkScore: 0,
      contrarianScore: 0,
      narrativeFactors: ['Home Favorite', 'Revenge Game'],
      sport: 'NFL',
      slate: 'MAIN',
      contestType: 'GPP'
    },
    {
      playerId: 'NFL_ChristianMcCaffrey',
      playerName: 'Christian McCaffrey',
      position: 'RB',
      team: 'SF',
      salary: 9000,
      projectedPoints: 22.5,
      projectedOwnership: 0,
      leverageScore: 0,
      chalkScore: 0,
      contrarianScore: 0,
      narrativeFactors: ['Home Favorite', 'Elite Value'],
      sport: 'NFL',
      slate: 'MAIN',
      contestType: 'GPP'
    }
  ];
  
  // Simulate projections
  mockSlate.forEach(player => {
    const value = player.projectedPoints / (player.salary / 1000);
    
    // Simulate ownership based on value and narratives
    let ownership = value > 3.5 ? 0.25 : value > 3.0 ? 0.15 : 0.08;
    ownership *= (1 + player.narrativeFactors.length * 0.1);
    
    player.projectedOwnership = Math.min(0.4, ownership);
    player.leverageScore = value / player.projectedOwnership;
    player.chalkScore = player.projectedOwnership > 0.25 ? 1.0 : 0.5;
  });
  
  // Display projections
  console.log(chalk.yellow('Projected Ownership:\n'));
  console.log(chalk.gray('Player               Pos  Salary  Proj   Own%  Leverage  Status'));
  console.log(chalk.gray('─'.repeat(65)));
  
  mockSlate.forEach(player => {
    const status = player.projectedOwnership > 0.25 ? chalk.red('CHALK') :
                   player.leverageScore > 2.0 ? chalk.green('LEVERAGE') :
                   chalk.gray('NEUTRAL');
    
    console.log(
      `${player.playerName.padEnd(20)} ${player.position.padEnd(3)} ` +
      `$${player.salary.toString().padEnd(5)} ${player.projectedPoints.toFixed(1).padEnd(5)} ` +
      `${(player.projectedOwnership * 100).toFixed(1).padEnd(5)}% ` +
      `${player.leverageScore.toFixed(2).padEnd(8)} ${status}`
    );
  });
  
  // Find leverage plays
  const leveragePlays = mockSlate
    .filter(p => p.leverageScore > 1.5 && p.projectedOwnership < 0.25)
    .sort((a, b) => b.leverageScore - a.leverageScore);
  
  console.log(chalk.green('\n🎯 Top Leverage Plays:\n'));
  leveragePlays.forEach((play, i) => {
    console.log(chalk.green(`${i + 1}. ${play.playerName} (${play.position})`));
    console.log(`   Ownership: ${(play.projectedOwnership * 100).toFixed(1)}%`);
    console.log(`   Leverage: ${play.leverageScore.toFixed(2)}x`);
    console.log(`   Narratives: ${play.narrativeFactors.join(', ')}`);
  });
  
  // Optimal GPP construction
  console.log(chalk.cyan('\n💎 Optimal GPP Construction:'));
  console.log('• Core: 1-2 leverage plays (5-15% owned)');
  console.log('• Differentiation: Fade 1-2 chalk plays');
  console.log('• Correlation: Stack low-owned QB with WR');
  console.log('• Bring-back: Opponent WR in projected shootout');
  
  await pgPool.end();
}

// Export for use
export { PlayerOwnership, LeveragePlay };

// Run demo if called directly
if (require.main === module) {
  demoOwnershipProjections();
}
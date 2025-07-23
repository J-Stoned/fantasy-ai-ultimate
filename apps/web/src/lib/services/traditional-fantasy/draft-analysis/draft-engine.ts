// Main Draft Analysis Engine Orchestrator

import {
  LeagueSettings,
  Player,
  PlayerProjection,
  DraftState,
  DraftRecommendation,
  DraftAnalysis,
  PositionScarcity,
  PlayerValue,
  DraftPerformance,
  PlayerMap,
  ProjectionMap,
  ValueMap,
  DraftEvent,
  MockDraftSettings,
  TradeProposal,
  TradeAnalysis,
  AuctionState,
  AuctionStrategy
} from './types';
import { PlayerValuator } from './player-valuator';
import { ScarcityModel } from './scarcity-model';
import { RecommendationEngine } from './recommendation-engine';
import { DraftTracker } from './draft-tracker';

export class DraftEngine {
  private playerValuator: PlayerValuator;
  private scarcityModel: ScarcityModel;
  private recommendationEngine: RecommendationEngine;
  private draftTracker: DraftTracker;
  private performanceMetrics: DraftPerformance;
  private analysisCache: Map<string, DraftAnalysis> = new Map();

  // Real-time metrics
  private recommendationStartTime = 0;
  private totalRecommendations = 0;
  private accurateRecommendations = 0;

  constructor(
    private players: PlayerMap,
    private projections: ProjectionMap,
    private leagueSettings: LeagueSettings,
    draftOrder: string[],
    myTeamId: string
  ) {
    // Initialize components
    this.playerValuator = new PlayerValuator(players, projections, leagueSettings);
    this.scarcityModel = new ScarcityModel(players, projections, leagueSettings);
    this.recommendationEngine = new RecommendationEngine(
      players,
      projections,
      this.playerValuator,
      this.scarcityModel
    );
    this.draftTracker = new DraftTracker(players, leagueSettings, draftOrder, myTeamId);

    // Initialize performance metrics
    this.performanceMetrics = {
      avgResponseTime: 0,
      peakConcurrentDrafts: 1,
      recommendationAccuracy: 0,
      userSatisfactionScore: 0
    };

    // Setup event listeners
    this.setupEventListeners();

    // Calculate initial player values
    this.initializePlayerValues();
  }

  /**
   * Initialize player values using ML valuation
   */
  private initializePlayerValues(): void {
    console.log('Calculating player values using ML model...');
    const startTime = Date.now();
    
    this.playerValuator.calculateVORP();
    
    const duration = Date.now() - startTime;
    console.log(`Player valuation complete in ${duration}ms`);
  }

  /**
   * Setup event listeners for draft tracking
   */
  private setupEventListeners(): void {
    this.draftTracker.on('pick', (event: DraftEvent) => {
      // Update scarcity model
      const pick = event.data;
      this.scarcityModel.recordPick(pick.playerId);

      // Clear recommendation cache
      this.recommendationEngine.clearCache();

      // Track recommendation accuracy
      this.trackRecommendationAccuracy(pick);
    });

    this.draftTracker.on('complete', () => {
      // Generate final analysis
      this.generateFinalAnalysis();
    });
  }

  /**
   * Get real-time recommendations for current pick
   */
  public getRecommendations(count: number = 5): DraftRecommendation[] {
    this.recommendationStartTime = Date.now();

    const draftState = this.draftTracker.getState();
    const recommendations = this.recommendationEngine.getRecommendations(
      draftState,
      count
    );

    // Track performance
    const responseTime = Date.now() - this.recommendationStartTime;
    this.updatePerformanceMetrics(responseTime);

    return recommendations;
  }

  /**
   * Make a pick
   */
  public makePick(playerId: string): boolean {
    const success = this.draftTracker.makePick(playerId);
    
    if (success) {
      // Invalidate analysis cache
      this.analysisCache.clear();
    }

    return success;
  }

  /**
   * Get current draft state
   */
  public getDraftState(): DraftState {
    return this.draftTracker.getState();
  }

  /**
   * Get position scarcity analysis
   */
  public getPositionScarcity(): Map<string, PositionScarcity> {
    const draftState = this.draftTracker.getState();
    return this.scarcityModel.getPositionScarcity(draftState, true);
  }

  /**
   * Get player value
   */
  public getPlayerValue(playerId: string): PlayerValue | null {
    const draftState = this.draftTracker.getState();
    const draftedPlayers = new Set(draftState.picks.map(p => p.playerId));
    
    return this.playerValuator.getPlayerValue(
      playerId,
      draftedPlayers,
      draftState.currentRound
    );
  }

  /**
   * Get team analysis
   */
  public getTeamAnalysis(teamId: string): DraftAnalysis | null {
    const cacheKey = `${teamId}-${this.draftTracker.getState().currentPick}`;
    const cached = this.analysisCache.get(cacheKey);
    if (cached) return cached;

    const draftState = this.draftTracker.getState();
    const team = draftState.teams.get(teamId);
    if (!team) return null;

    const analysis = this.analyzeTeam(team, draftState);
    this.analysisCache.set(cacheKey, analysis);

    return analysis;
  }

  /**
   * Analyze team draft performance
   */
  private analyzeTeam(team: TeamState, draftState: DraftState): DraftAnalysis {
    const picks = draftState.picks.filter(p => p.teamId === team.teamId);
    const roster = team.roster.map(id => this.players.get(id)!);

    // Calculate projected points
    const projectedPoints = roster.reduce((sum, player) => {
      const projection = this.projections.get(player.id);
      return sum + (projection?.projectedPoints || 0);
    }, 0);

    // Calculate team strength relative to others
    const allTeamPoints = Array.from(draftState.teams.values()).map(t => {
      return t.roster.reduce((sum, id) => {
        const proj = this.projections.get(id);
        return sum + (proj?.projectedPoints || 0);
      }, 0);
    });
    allTeamPoints.sort((a, b) => b - a);
    const projectedFinish = allTeamPoints.indexOf(projectedPoints) + 1;

    // Grade calculation
    const avgValueScore = picks.reduce((sum, p) => sum + p.valueScore, 0) / picks.length;
    const grade = this.calculateGrade(avgValueScore);

    // Analyze strengths and weaknesses
    const { strengths, weaknesses } = this.analyzeRosterBalance(team, draftState);

    // Find best and worst picks
    const sortedPicks = [...picks].sort((a, b) => b.valueScore - a.valueScore);
    const bestPicks = sortedPicks.slice(0, 3).map(pick => 
      this.analyzePickValue(pick, draftState)
    );
    const worstPicks = sortedPicks.slice(-3).map(pick => 
      this.analyzePickValue(pick, draftState)
    );

    // Find missed opportunities
    const missedOpportunities = this.findMissedOpportunities(picks, draftState);

    // Identify trade targets
    const tradeTargets = this.identifyTradeTargets(team, draftState);

    return {
      overallGrade: grade,
      teamStrength: (projectedPoints / allTeamPoints[0]) * 100,
      projectedFinish,
      strengths,
      weaknesses,
      bestPicks,
      worstPicks,
      missedOpportunities,
      tradeTargets
    };
  }

  /**
   * Calculate letter grade
   */
  private calculateGrade(avgValueScore: number): string {
    if (avgValueScore >= 90) return 'A+';
    if (avgValueScore >= 85) return 'A';
    if (avgValueScore >= 80) return 'A-';
    if (avgValueScore >= 75) return 'B+';
    if (avgValueScore >= 70) return 'B';
    if (avgValueScore >= 65) return 'B-';
    if (avgValueScore >= 60) return 'C+';
    if (avgValueScore >= 55) return 'C';
    if (avgValueScore >= 50) return 'C-';
    if (avgValueScore >= 45) return 'D+';
    if (avgValueScore >= 40) return 'D';
    return 'F';
  }

  /**
   * Analyze roster balance
   */
  private analyzeRosterBalance(
    team: TeamState,
    draftState: DraftState
  ): { strengths: string[]; weaknesses: string[] } {
    const strengths: string[] = [];
    const weaknesses: string[] = [];

    // Analyze by position
    for (const need of team.needs) {
      if (need.currentCount >= need.targetCount && need.qualityScore > 85) {
        strengths.push(`Strong ${need.position} depth with high quality`);
      } else if (need.currentCount < need.targetCount) {
        weaknesses.push(`Need more ${need.position}s (${need.currentCount}/${need.targetCount})`);
      } else if (need.qualityScore < 75) {
        weaknesses.push(`Low quality at ${need.position} position`);
      }
    }

    // Check for roster construction patterns
    const rbCount = team.roster.filter(id => {
      const p = this.players.get(id);
      return p?.position === 'RB';
    }).length;

    const wrCount = team.roster.filter(id => {
      const p = this.players.get(id);
      return p?.position === 'WR';
    }).length;

    if (rbCount >= 4) strengths.push('Deep RB corps for flex play');
    if (wrCount >= 5) strengths.push('Strong WR depth for matchup flexibility');

    return { strengths, weaknesses };
  }

  /**
   * Analyze individual pick value
   */
  private analyzePickValue(
    pick: DraftPick,
    draftState: DraftState
  ): PickAnalysis {
    const player = this.players.get(pick.playerId)!;
    const playerValue = this.getPlayerValue(pick.playerId)!;

    // Find who was available
    const availableAtPick = Array.from(this.players.values())
      .filter(p => {
        const pickedBefore = draftState.picks
          .slice(0, pick.pickNumber - 1)
          .some(prev => prev.playerId === p.id);
        return !pickedBefore && p.id !== pick.playerId;
      })
      .slice(0, 5);

    return {
      pick,
      expectedValue: playerValue.adp || playerValue.overallRank,
      actualValue: pick.pickNumber,
      alternativesAvailable: availableAtPick
    };
  }

  /**
   * Find missed opportunities
   */
  private findMissedOpportunities(
    picks: DraftPick[],
    draftState: DraftState
  ): MissedOpportunity[] {
    const opportunities: MissedOpportunity[] = [];

    for (const pick of picks) {
      // Find better players that were available
      const betterAvailable = this.findBetterAvailablePlayers(
        pick,
        draftState
      );

      if (betterAvailable.length > 0) {
        const best = betterAvailable[0];
        const valueLost = best.value - pick.valueScore;

        opportunities.push({
          round: pick.round,
          playerId: best.playerId,
          pickedInstead: pick.playerId,
          valueLost,
          reason: `${best.playerName} provided ${valueLost.toFixed(1)} more value`
        });
      }
    }

    return opportunities.slice(0, 5); // Top 5 missed opportunities
  }

  /**
   * Find better players that were available
   */
  private findBetterAvailablePlayers(
    pick: DraftPick,
    draftState: DraftState
  ): { playerId: string; playerName: string; value: number }[] {
    const pickedBefore = new Set(
      draftState.picks
        .slice(0, pick.pickNumber - 1)
        .map(p => p.playerId)
    );

    const available = Array.from(this.players.values())
      .filter(p => !pickedBefore.has(p.id) && p.id !== pick.playerId)
      .map(player => {
        const value = this.getPlayerValue(player.id);
        return {
          playerId: player.id,
          playerName: player.name,
          value: value?.vorp || 0
        };
      })
      .filter(p => p.value > pick.valueScore)
      .sort((a, b) => b.value - a.value);

    return available.slice(0, 3);
  }

  /**
   * Identify trade targets
   */
  private identifyTradeTargets(
    team: TeamState,
    draftState: DraftState
  ): TradeTarget[] {
    const targets: TradeTarget[] = [];

    // Find positions of need
    const needs = team.needs
      .filter(n => n.priority > 0.6)
      .sort((a, b) => b.priority - a.priority);

    for (const need of needs.slice(0, 2)) {
      // Find teams with surplus at this position
      const teamsWithSurplus = this.findTeamsWithSurplus(
        need.position,
        draftState
      );

      // Find tradeable players
      for (const targetTeamId of teamsWithSurplus) {
        const targetTeam = draftState.teams.get(targetTeamId);
        if (!targetTeam) continue;

        const tradeablePlayers = this.findTradeablePlayers(
          targetTeam,
          need.position
        );

        for (const player of tradeablePlayers) {
          const fairOffers = this.calculateFairOffers(
            player,
            team,
            targetTeam
          );

          if (fairOffers.length > 0) {
            targets.push({
              playerId: player.id,
              targetTeams: [targetTeamId],
              fairOffers,
              reason: `Address ${need.position} need`
            });
          }
        }
      }
    }

    return targets.slice(0, 5);
  }

  /**
   * Find teams with surplus at position
   */
  private findTeamsWithSurplus(
    position: string,
    draftState: DraftState
  ): string[] {
    const teams: string[] = [];

    for (const [teamId, team] of draftState.teams) {
      const positionCount = team.roster.filter(id => {
        const p = this.players.get(id);
        return p?.position === position;
      }).length;

      const requirement = draftState.leagueSettings.rosterRequirements[position];
      if (requirement && positionCount > requirement.min + 1) {
        teams.push(teamId);
      }
    }

    return teams;
  }

  /**
   * Find tradeable players on team
   */
  private findTradeablePlayers(
    team: TeamState,
    position: string
  ): Player[] {
    return team.roster
      .map(id => this.players.get(id)!)
      .filter(p => p.position === position)
      .sort((a, b) => {
        const aProj = this.projections.get(a.id)?.projectedPoints || 0;
        const bProj = this.projections.get(b.id)?.projectedPoints || 0;
        return bProj - aProj;
      })
      .slice(1); // Don't trade best player at position
  }

  /**
   * Calculate fair trade offers
   */
  private calculateFairOffers(
    targetPlayer: Player,
    myTeam: TeamState,
    theirTeam: TeamState
  ): Player[][] {
    const offers: Player[][] = [];
    const targetValue = this.getPlayerValue(targetPlayer.id)?.tradeValue || 0;

    // Find combinations of my players that match value
    const myTradeable = myTeam.roster
      .map(id => this.players.get(id)!)
      .filter(p => {
        // Don't trade only player at position
        const samePosition = myTeam.roster.filter(rid => {
          const rp = this.players.get(rid);
          return rp?.position === p.position;
        }).length;
        return samePosition > 1;
      });

    // Simple 1-for-1 trades
    for (const player of myTradeable) {
      const playerValue = this.getPlayerValue(player.id)?.tradeValue || 0;
      if (Math.abs(playerValue - targetValue) < 10) {
        offers.push([player]);
      }
    }

    // 2-for-1 trades if needed
    if (offers.length === 0) {
      for (let i = 0; i < myTradeable.length - 1; i++) {
        for (let j = i + 1; j < myTradeable.length; j++) {
          const combined = 
            (this.getPlayerValue(myTradeable[i].id)?.tradeValue || 0) +
            (this.getPlayerValue(myTradeable[j].id)?.tradeValue || 0);
          
          if (Math.abs(combined - targetValue) < 15) {
            offers.push([myTradeable[i], myTradeable[j]]);
          }
        }
      }
    }

    return offers.slice(0, 3);
  }

  /**
   * Track recommendation accuracy
   */
  private trackRecommendationAccuracy(pick: any): void {
    this.totalRecommendations++;

    // Check if pick was in top 3 recommendations
    const lastRecommendations = this.getRecommendations(3);
    const wasRecommended = lastRecommendations.some(
      rec => rec.playerId === pick.playerId
    );

    if (wasRecommended) {
      this.accurateRecommendations++;
    }

    this.performanceMetrics.recommendationAccuracy = 
      this.accurateRecommendations / this.totalRecommendations;
  }

  /**
   * Update performance metrics
   */
  private updatePerformanceMetrics(responseTime: number): void {
    // Update average response time
    const currentAvg = this.performanceMetrics.avgResponseTime;
    const count = this.totalRecommendations;
    
    this.performanceMetrics.avgResponseTime = 
      (currentAvg * (count - 1) + responseTime) / count;
  }

  /**
   * Generate final draft analysis
   */
  private generateFinalAnalysis(): void {
    console.log('Draft complete! Generating final analysis...');
    
    const draftState = this.draftTracker.getState();
    
    // Analyze all teams
    for (const teamId of draftState.teams.keys()) {
      const analysis = this.getTeamAnalysis(teamId);
      console.log(`Team ${teamId} Analysis:`, analysis);
    }

    // Log performance metrics
    console.log('Performance Metrics:', this.performanceMetrics);
  }

  /**
   * Pause/resume draft
   */
  public togglePause(): void {
    this.draftTracker.togglePause();
  }

  /**
   * Export draft results
   */
  public exportDraft(): string {
    return this.draftTracker.exportDraft();
  }

  /**
   * Get performance metrics
   */
  public getPerformanceMetrics(): DraftPerformance {
    return { ...this.performanceMetrics };
  }

  /**
   * Get supply/demand curves for visualization
   */
  public getSupplyDemandCurves(position: string): {
    supply: ReturnType<ScarcityModel['getSupplyCurve']>;
    demand: ReturnType<ScarcityModel['getDemandCurve']>;
  } {
    return {
      supply: this.scarcityModel.getSupplyCurve(position),
      demand: this.scarcityModel.getDemandCurve(position)
    };
  }

  /**
   * Predict positional runs
   */
  public predictPositionalRun(position: string): {
    probability: number;
    expectedPicks: number;
    expectedEnd: number;
  } {
    const draftState = this.draftTracker.getState();
    const runProb = this.scarcityModel.calculateRunProbability(position, draftState);
    const expectedEnd = this.scarcityModel.predictRunEnd(position, draftState);

    return {
      ...runProb,
      expectedEnd
    };
  }
}

// Type definitions for internal use
interface PickAnalysis {
  pick: DraftPick;
  expectedValue: number;
  actualValue: number;
  alternativesAvailable: Player[];
}

interface MissedOpportunity {
  round: number;
  playerId: string;
  pickedInstead: string;
  valueLost: number;
  reason: string;
}

interface TradeTarget {
  playerId: string;
  targetTeams: string[];
  fairOffers: Player[][];
  reason: string;
}
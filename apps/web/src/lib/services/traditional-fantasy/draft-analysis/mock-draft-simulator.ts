// Mock Draft Simulator with AI Opponents

import {
  MockDraftSettings,
  AIPersonality,
  DraftState,
  Player,
  PlayerValue,
  DraftRecommendation,
  LeagueSettings,
  PlayerMap,
  ProjectionMap
} from './types';
import { DraftEngine } from './draft-engine';
import { RecommendationEngine } from './recommendation-engine';
import { PlayerValuator } from './player-valuator';
import { ScarcityModel } from './scarcity-model';

export class MockDraftSimulator {
  private draftEngine: DraftEngine;
  private aiStrategies: Map<string, AIStrategy>;
  private simulationSpeed: number;
  private isRunning = false;
  private simulationTimer: NodeJS.Timeout | null = null;

  constructor(
    private players: PlayerMap,
    private projections: ProjectionMap,
    private leagueSettings: LeagueSettings,
    private mockSettings: MockDraftSettings,
    myTeamId: string
  ) {
    // Generate draft order with AI teams
    const draftOrder = this.generateDraftOrder(myTeamId);

    // Initialize draft engine
    this.draftEngine = new DraftEngine(
      players,
      projections,
      leagueSettings,
      draftOrder,
      myTeamId
    );

    // Initialize AI strategies
    this.aiStrategies = this.initializeAIStrategies(draftOrder, myTeamId);

    // Set simulation speed
    this.simulationSpeed = this.getSimulationSpeed(mockSettings.speed);
  }

  /**
   * Generate draft order with AI teams
   */
  private generateDraftOrder(myTeamId: string): string[] {
    const order: string[] = [];
    const myPosition = Math.floor(Math.random() * this.leagueSettings.teamCount);

    for (let i = 0; i < this.leagueSettings.teamCount; i++) {
      if (i === myPosition) {
        order.push(myTeamId);
      } else {
        order.push(`ai-team-${i}`);
      }
    }

    return order;
  }

  /**
   * Initialize AI strategies for each team
   */
  private initializeAIStrategies(
    draftOrder: string[],
    myTeamId: string
  ): Map<string, AIStrategy> {
    const strategies = new Map<string, AIStrategy>();

    draftOrder.forEach((teamId, index) => {
      if (teamId === myTeamId) return;

      const personality = this.mockSettings.aiPersonalities?.[index] || 
        this.generateRandomPersonality();

      strategies.set(teamId, new AIStrategy(
        personality,
        this.mockSettings.aiDifficulty,
        this.players,
        this.projections,
        this.leagueSettings
      ));
    });

    return strategies;
  }

  /**
   * Generate random AI personality
   */
  private generateRandomPersonality(): AIPersonality {
    const styles: AIPersonality['style'][] = [
      'aggressive', 'conservative', 'balanced', 'contrarian', 'homer'
    ];

    return {
      teamId: '',
      style: styles[Math.floor(Math.random() * styles.length)],
      riskTolerance: Math.random(),
      positionPreference: this.generatePositionPreference(),
      teamPreference: this.generateTeamPreference()
    };
  }

  /**
   * Generate position preferences
   */
  private generatePositionPreference(): string[] {
    const positions = ['QB', 'RB', 'WR', 'TE'];
    const shuffled = [...positions].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, 2);
  }

  /**
   * Generate team preferences
   */
  private generateTeamPreference(): string[] {
    // Mock team list - would use real teams in production
    const teams = ['KC', 'BUF', 'SF', 'PHI', 'DAL', 'MIA'];
    return teams.slice(0, 2);
  }

  /**
   * Get simulation speed in milliseconds
   */
  private getSimulationSpeed(speed: MockDraftSettings['speed']): number {
    switch (speed) {
      case 'instant': return 100;
      case 'fast': return 1000;
      case 'realistic': return 5000;
      default: return 1000;
    }
  }

  /**
   * Start mock draft simulation
   */
  public start(): void {
    if (this.isRunning) return;

    this.isRunning = true;
    this.runSimulation();
  }

  /**
   * Stop mock draft simulation
   */
  public stop(): void {
    this.isRunning = false;
    if (this.simulationTimer) {
      clearTimeout(this.simulationTimer);
      this.simulationTimer = null;
    }
  }

  /**
   * Run simulation loop
   */
  private runSimulation(): void {
    if (!this.isRunning) return;

    const draftState = this.draftEngine.getDraftState();
    const currentTeamId = this.getCurrentTeamId(draftState);

    // Check if it's an AI team's turn
    if (this.aiStrategies.has(currentTeamId)) {
      this.makeAIPick(currentTeamId);
      
      // Schedule next pick
      this.simulationTimer = setTimeout(() => {
        this.runSimulation();
      }, this.simulationSpeed);
    }
  }

  /**
   * Get current team ID from draft state
   */
  private getCurrentTeamId(draftState: DraftState): string {
    const pickInRound = ((draftState.currentPick - 1) % draftState.draftOrder.length);
    return draftState.draftOrder[pickInRound];
  }

  /**
   * Make AI pick
   */
  private makeAIPick(teamId: string): void {
    const strategy = this.aiStrategies.get(teamId);
    if (!strategy) return;

    const draftState = this.draftEngine.getDraftState();
    const playerId = strategy.selectPlayer(draftState);

    if (playerId) {
      this.draftEngine.makePick(playerId);
    }
  }

  /**
   * Get recommendations for user
   */
  public getRecommendations(count: number = 5): DraftRecommendation[] {
    return this.draftEngine.getRecommendations(count);
  }

  /**
   * Make user pick
   */
  public makeUserPick(playerId: string): boolean {
    const success = this.draftEngine.makePick(playerId);
    
    if (success && this.isRunning) {
      // Resume simulation after user pick
      setTimeout(() => this.runSimulation(), this.simulationSpeed);
    }

    return success;
  }

  /**
   * Get current draft state
   */
  public getDraftState(): DraftState {
    return this.draftEngine.getDraftState();
  }

  /**
   * Simulate remaining picks instantly
   */
  public simulateToEnd(): void {
    const originalSpeed = this.simulationSpeed;
    this.simulationSpeed = 0;

    while (this.draftEngine.getDraftState().picks.length < 
           this.leagueSettings.teamCount * this.leagueSettings.rosterSize) {
      const draftState = this.draftEngine.getDraftState();
      const currentTeamId = this.getCurrentTeamId(draftState);

      if (this.aiStrategies.has(currentTeamId)) {
        this.makeAIPick(currentTeamId);
      } else {
        // Auto-pick for user
        const recommendations = this.draftEngine.getRecommendations(1);
        if (recommendations.length > 0) {
          this.draftEngine.makePick(recommendations[0].playerId);
        }
      }
    }

    this.simulationSpeed = originalSpeed;
  }

  /**
   * Export mock draft results
   */
  public exportResults(): any {
    return {
      settings: this.mockSettings,
      results: this.draftEngine.exportDraft(),
      analysis: this.generateMockDraftAnalysis()
    };
  }

  /**
   * Generate mock draft analysis
   */
  private generateMockDraftAnalysis(): any {
    const draftState = this.draftEngine.getDraftState();
    const analysis: any = {};

    // Analyze each team
    for (const teamId of draftState.teams.keys()) {
      analysis[teamId] = this.draftEngine.getTeamAnalysis(teamId);
    }

    return analysis;
  }
}

/**
 * AI Strategy implementation for mock draft opponents
 */
class AIStrategy {
  private valuationCache: Map<string, number> = new Map();
  private pickHistory: string[] = [];

  constructor(
    private personality: AIPersonality,
    private difficulty: MockDraftSettings['aiDifficulty'],
    private players: PlayerMap,
    private projections: ProjectionMap,
    private leagueSettings: LeagueSettings
  ) {}

  /**
   * Select player based on AI strategy
   */
  public selectPlayer(draftState: DraftState): string | null {
    const availablePlayers = this.getAvailablePlayers(draftState);
    if (availablePlayers.length === 0) return null;

    // Score all available players
    const scoredPlayers = availablePlayers.map(player => ({
      player,
      score: this.scorePlayer(player, draftState)
    }));

    // Sort by score
    scoredPlayers.sort((a, b) => b.score - a.score);

    // Apply difficulty-based selection
    const selectedIndex = this.applyDifficultyVariance(scoredPlayers.length);
    const selected = scoredPlayers[selectedIndex];

    if (selected) {
      this.pickHistory.push(selected.player.id);
      return selected.player.id;
    }

    return null;
  }

  /**
   * Get available players
   */
  private getAvailablePlayers(draftState: DraftState): Player[] {
    const drafted = new Set(draftState.picks.map(p => p.playerId));
    return Array.from(this.players.values())
      .filter(p => !drafted.has(p.id));
  }

  /**
   * Score player based on AI personality
   */
  private scorePlayer(player: Player, draftState: DraftState): number {
    let score = this.getBaseScore(player);

    // Apply personality modifiers
    switch (this.personality.style) {
      case 'aggressive':
        score = this.applyAggressiveModifiers(player, score);
        break;
      case 'conservative':
        score = this.applyConservativeModifiers(player, score, draftState);
        break;
      case 'contrarian':
        score = this.applyContrarianModifiers(player, score, draftState);
        break;
      case 'homer':
        score = this.applyHomerModifiers(player, score);
        break;
    }

    // Apply position preference
    if (this.personality.positionPreference?.includes(player.position)) {
      score *= 1.15;
    }

    // Apply team preference
    if (this.personality.teamPreference?.includes(player.team)) {
      score *= 1.1;
    }

    // Apply risk tolerance
    const projection = this.projections.get(player.id);
    if (projection) {
      if (this.personality.riskTolerance > 0.7 && projection.upside > 0.7) {
        score *= 1.1; // Favor high upside
      } else if (this.personality.riskTolerance < 0.3 && projection.consistency > 0.8) {
        score *= 1.1; // Favor consistency
      }
    }

    return score;
  }

  /**
   * Get base score for player
   */
  private getBaseScore(player: Player): number {
    const cached = this.valuationCache.get(player.id);
    if (cached) return cached;

    const projection = this.projections.get(player.id);
    if (!projection) return 0;

    // Simple scoring based on projections
    let score = projection.projectedPoints;

    // Position scarcity adjustment
    const positionMultiplier: Record<string, number> = {
      QB: 0.9,
      RB: 1.1,
      WR: 1.0,
      TE: 0.85,
      K: 0.3,
      DST: 0.35
    };

    score *= positionMultiplier[player.position] || 1.0;

    this.valuationCache.set(player.id, score);
    return score;
  }

  /**
   * Apply aggressive strategy modifiers
   */
  private applyAggressiveModifiers(player: Player, baseScore: number): number {
    let score = baseScore;

    // Favor high-upside players
    const projection = this.projections.get(player.id);
    if (projection && projection.upside > 0.7) {
      score *= 1.2;
    }

    // Reach for favorites
    if (Math.random() < 0.3) {
      score *= 1.15;
    }

    return score;
  }

  /**
   * Apply conservative strategy modifiers
   */
  private applyConservativeModifiers(
    player: Player,
    baseScore: number,
    draftState: DraftState
  ): number {
    let score = baseScore;

    // Favor consistent players
    const projection = this.projections.get(player.id);
    if (projection && projection.consistency > 0.7) {
      score *= 1.15;
    }

    // Avoid injury-prone players
    if (player.injuryStatus && player.injuryStatus !== 'healthy') {
      score *= 0.7;
    }

    // Follow ADP more closely
    const currentPick = draftState.currentPick;
    const expectedPick = this.getExpectedDraftPosition(player);
    if (currentPick < expectedPick) {
      score *= 0.9; // Avoid reaching
    }

    return score;
  }

  /**
   * Apply contrarian strategy modifiers
   */
  private applyContrarianModifiers(
    player: Player,
    baseScore: number,
    draftState: DraftState
  ): number {
    let score = baseScore;

    // Check recent picks
    const recentPicks = draftState.picks.slice(-5);
    const recentPositions = recentPicks.map(p => {
      const picked = this.players.get(p.playerId);
      return picked?.position;
    });

    // Favor positions not recently picked
    if (!recentPositions.includes(player.position)) {
      score *= 1.2;
    }

    // Random contrarian picks
    if (Math.random() < 0.2) {
      score *= 0.8; // Sometimes pick unexpected players
    }

    return score;
  }

  /**
   * Apply homer strategy modifiers
   */
  private applyHomerModifiers(player: Player, baseScore: number): number {
    let score = baseScore;

    // Heavy bias toward favorite teams
    if (this.personality.teamPreference?.includes(player.team)) {
      score *= 1.3;
    }

    // Slight bias against rival teams (mock data)
    const rivalTeams = ['NYJ', 'NE', 'MIA']; // Example rivals
    if (rivalTeams.includes(player.team)) {
      score *= 0.85;
    }

    return score;
  }

  /**
   * Get expected draft position (mock ADP)
   */
  private getExpectedDraftPosition(player: Player): number {
    // Simplified - would use real ADP data
    const positionADP: Record<string, number> = {
      QB: 50,
      RB: 25,
      WR: 30,
      TE: 70,
      K: 150,
      DST: 140
    };

    const baseADP = positionADP[player.position] || 100;
    
    // Add variance based on projected points
    const projection = this.projections.get(player.id);
    if (projection) {
      const variance = (100 - projection.projectedPoints) / 2;
      return Math.max(1, baseADP + variance);
    }

    return baseADP;
  }

  /**
   * Apply difficulty-based variance to selection
   */
  private applyDifficultyVariance(playerCount: number): number {
    switch (this.difficulty) {
      case 'easy':
        // Pick from top 5-10
        return Math.floor(Math.random() * Math.min(10, playerCount));
      
      case 'medium':
        // Pick from top 3-5
        return Math.floor(Math.random() * Math.min(5, playerCount));
      
      case 'hard':
        // Pick from top 1-3
        return Math.floor(Math.random() * Math.min(3, playerCount));
      
      case 'expert':
        // Almost always pick the best
        return Math.random() < 0.9 ? 0 : 1;
      
      default:
        return 0;
    }
  }
}
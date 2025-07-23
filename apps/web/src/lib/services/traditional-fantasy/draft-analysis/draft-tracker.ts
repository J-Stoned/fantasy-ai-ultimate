// Real-Time Draft State Management

import {
  DraftState,
  DraftPick,
  TeamState,
  Player,
  DraftEvent,
  LeagueSettings,
  DraftStrategy,
  PositionNeed,
  PlayerMap
} from './types';

export class DraftTracker {
  private draftState: DraftState;
  private eventHistory: DraftEvent[] = [];
  private listeners: Map<string, Set<DraftEventListener>> = new Map();
  private pickTimer: NodeJS.Timeout | null = null;
  private autoPickEnabled = true;

  constructor(
    private players: PlayerMap,
    leagueSettings: LeagueSettings,
    draftOrder: string[],
    myTeamId: string
  ) {
    this.draftState = this.initializeDraftState(
      leagueSettings,
      draftOrder,
      myTeamId
    );
  }

  /**
   * Initialize draft state
   */
  private initializeDraftState(
    leagueSettings: LeagueSettings,
    draftOrder: string[],
    myTeamId: string
  ): DraftState {
    const teams = new Map<string, TeamState>();
    const availablePlayers = new Set(this.players.keys());

    // Initialize teams
    draftOrder.forEach((teamId, index) => {
      teams.set(teamId, {
        teamId,
        teamName: `Team ${index + 1}`,
        roster: [],
        needs: this.initializeTeamNeeds(leagueSettings),
        draftStrategy: this.detectDraftStrategy(teamId),
        budget: leagueSettings.draftType === 'auction' ? 200 : undefined
      });
    });

    return {
      draftId: `draft-${Date.now()}`,
      leagueSettings,
      currentPick: 1,
      currentRound: 1,
      draftOrder,
      picks: [],
      availablePlayers,
      teams,
      myTeamId,
      startTime: new Date(),
      timePerPick: 90, // 90 seconds default
      isPaused: false
    };
  }

  /**
   * Initialize team needs based on roster requirements
   */
  private initializeTeamNeeds(leagueSettings: LeagueSettings): PositionNeed[] {
    const needs: PositionNeed[] = [];

    for (const [position, requirements] of Object.entries(
      leagueSettings.rosterRequirements
    )) {
      needs.push({
        position,
        priority: 1.0, // Start with high priority for empty rosters
        currentCount: 0,
        targetCount: requirements.min,
        qualityScore: 0
      });
    }

    return needs;
  }

  /**
   * Detect draft strategy (simplified - would use ML in production)
   */
  private detectDraftStrategy(teamId: string): DraftStrategy {
    // Default balanced strategy
    return {
      type: 'balanced',
      targetPositions: {
        rounds: {},
        priority: ['RB', 'WR', 'QB', 'TE']
      },
      avoidList: [],
      targetList: []
    };
  }

  /**
   * Get current draft state
   */
  public getState(): DraftState {
    return { ...this.draftState };
  }

  /**
   * Make a pick
   */
  public makePick(playerId: string, teamId?: string): boolean {
    if (this.draftState.isPaused) return false;

    const currentTeamId = teamId || this.getCurrentTeamId();
    
    // Validate pick
    if (!this.validatePick(playerId, currentTeamId)) {
      return false;
    }

    // Stop pick timer
    this.stopPickTimer();

    // Record pick
    const pick: DraftPick = {
      pickNumber: this.draftState.currentPick,
      round: this.draftState.currentRound,
      teamId: currentTeamId,
      playerId,
      timestamp: new Date(),
      valueScore: this.calculateValueScore(playerId),
      reachScore: this.calculateReachScore(playerId)
    };

    // Update state
    this.draftState.picks.push(pick);
    this.draftState.availablePlayers.delete(playerId);

    // Update team roster
    const team = this.draftState.teams.get(currentTeamId);
    if (team) {
      team.roster.push(playerId);
      this.updateTeamNeeds(team);
    }

    // Emit event
    this.emitEvent({
      type: 'pick',
      timestamp: new Date(),
      data: pick
    });

    // Advance draft
    this.advanceDraft();

    return true;
  }

  /**
   * Validate pick is legal
   */
  private validatePick(playerId: string, teamId: string): boolean {
    // Check if player is available
    if (!this.draftState.availablePlayers.has(playerId)) {
      console.error('Player not available:', playerId);
      return false;
    }

    // Check if it's team's turn
    const currentTeamId = this.getCurrentTeamId();
    if (teamId !== currentTeamId) {
      console.error('Not team\'s turn:', teamId, 'current:', currentTeamId);
      return false;
    }

    // Check roster limits
    const team = this.draftState.teams.get(teamId);
    if (!team) return false;

    const player = this.players.get(playerId);
    if (!player) return false;

    const positionCount = team.roster.filter(id => {
      const p = this.players.get(id);
      return p?.position === player.position;
    }).length;

    const requirements = this.draftState.leagueSettings.rosterRequirements[player.position];
    if (requirements && positionCount >= requirements.max) {
      console.error('Position limit reached:', player.position);
      return false;
    }

    return true;
  }

  /**
   * Calculate value score for pick
   */
  private calculateValueScore(playerId: string): number {
    // Simplified - would use PlayerValuator in production
    const pickNumber = this.draftState.currentPick;
    const player = this.players.get(playerId);
    
    // Mock ADP data
    const adp = this.getMockADP(player);
    
    if (pickNumber > adp) {
      return Math.min(100, 50 + (pickNumber - adp) * 2);
    } else {
      return Math.max(0, 50 - (adp - pickNumber));
    }
  }

  /**
   * Calculate reach score
   */
  private calculateReachScore(playerId: string): number {
    const pickNumber = this.draftState.currentPick;
    const player = this.players.get(playerId);
    const adp = this.getMockADP(player);

    if (pickNumber < adp) {
      return Math.min(1, (adp - pickNumber) / adp);
    }
    return 0;
  }

  /**
   * Get mock ADP (would use real data in production)
   */
  private getMockADP(player?: Player): number {
    if (!player) return 100;

    const positionADP: Record<string, number[]> = {
      QB: [15, 25, 35, 45, 55, 65, 75, 85],
      RB: [3, 7, 12, 18, 24, 30, 36, 42],
      WR: [5, 10, 16, 22, 28, 34, 40, 46],
      TE: [20, 40, 60, 80, 100, 120, 140, 160]
    };

    const adps = positionADP[player.position] || [100];
    return adps[Math.floor(Math.random() * adps.length)];
  }

  /**
   * Update team needs after pick
   */
  private updateTeamNeeds(team: TeamState): void {
    const roster = team.roster.map(id => this.players.get(id)!);
    
    // Recalculate position counts and quality
    const positionData = new Map<string, { count: number; quality: number[] }>();

    for (const player of roster) {
      const data = positionData.get(player.position) || { count: 0, quality: [] };
      data.count++;
      // Mock quality score
      data.quality.push(80 + Math.random() * 20);
      positionData.set(player.position, data);
    }

    // Update needs
    team.needs = team.needs.map(need => {
      const data = positionData.get(need.position);
      const count = data?.count || 0;
      const avgQuality = data?.quality.length 
        ? data.quality.reduce((a, b) => a + b, 0) / data.quality.length 
        : 0;

      // Recalculate priority
      let priority = 0;
      if (count === 0) {
        priority = 1.0;
      } else if (count < need.targetCount) {
        priority = 0.8 - (count / need.targetCount) * 0.3;
      } else {
        priority = avgQuality < 85 ? 0.3 : 0.1;
      }

      return {
        ...need,
        currentCount: count,
        qualityScore: avgQuality,
        priority
      };
    });
  }

  /**
   * Advance to next pick
   */
  private advanceDraft(): void {
    const totalTeams = this.draftState.draftOrder.length;
    const picksPerRound = totalTeams;

    this.draftState.currentPick++;

    // Check if round is complete
    if (this.draftState.currentPick > this.draftState.currentRound * picksPerRound) {
      this.draftState.currentRound++;
      
      // Snake draft - reverse order each round
      if (this.draftState.leagueSettings.draftType === 'snake') {
        if (this.draftState.currentRound % 2 === 0) {
          this.draftState.draftOrder.reverse();
        }
      }
    }

    // Check if draft is complete
    const totalPicks = totalTeams * this.draftState.leagueSettings.rosterSize;
    if (this.draftState.currentPick > totalPicks) {
      this.completeDraft();
      return;
    }

    // Start pick timer for next pick
    this.startPickTimer();

    // Auto-pick for CPU teams
    const currentTeamId = this.getCurrentTeamId();
    if (currentTeamId !== this.draftState.myTeamId && this.autoPickEnabled) {
      setTimeout(() => this.makeAutoPick(currentTeamId), 2000);
    }
  }

  /**
   * Get current team ID
   */
  private getCurrentTeamId(): string {
    const teamsCount = this.draftState.draftOrder.length;
    const pickInRound = ((this.draftState.currentPick - 1) % teamsCount);
    
    return this.draftState.draftOrder[pickInRound];
  }

  /**
   * Make automatic pick for CPU team
   */
  private makeAutoPick(teamId: string): void {
    // Simple auto-pick logic - would use RecommendationEngine in production
    const team = this.draftState.teams.get(teamId);
    if (!team) return;

    // Find highest need position
    const highestNeed = team.needs.reduce((prev, current) => 
      current.priority > prev.priority ? current : prev
    );

    // Get best available at position
    const availablePlayers = Array.from(this.draftState.availablePlayers)
      .map(id => this.players.get(id)!)
      .filter(p => p.position === highestNeed.position);

    if (availablePlayers.length > 0) {
      // Pick random from top 3
      const topPlayers = availablePlayers.slice(0, 3);
      const pick = topPlayers[Math.floor(Math.random() * topPlayers.length)];
      this.makePick(pick.id, teamId);
    } else {
      // Pick best available overall
      const anyPlayer = Array.from(this.draftState.availablePlayers)[0];
      if (anyPlayer) {
        this.makePick(anyPlayer, teamId);
      }
    }
  }

  /**
   * Start pick timer
   */
  private startPickTimer(): void {
    if (!this.draftState.timePerPick) return;

    this.pickTimer = setTimeout(() => {
      const currentTeamId = this.getCurrentTeamId();
      if (currentTeamId === this.draftState.myTeamId) {
        // Auto-pick for user if time expires
        this.makeAutoPick(currentTeamId);
      }
    }, this.draftState.timePerPick * 1000);
  }

  /**
   * Stop pick timer
   */
  private stopPickTimer(): void {
    if (this.pickTimer) {
      clearTimeout(this.pickTimer);
      this.pickTimer = null;
    }
  }

  /**
   * Complete the draft
   */
  private completeDraft(): void {
    this.stopPickTimer();
    
    this.emitEvent({
      type: 'complete',
      timestamp: new Date(),
      data: {
        draftId: this.draftState.draftId,
        duration: Date.now() - this.draftState.startTime.getTime()
      }
    });
  }

  /**
   * Pause/resume draft
   */
  public togglePause(): void {
    this.draftState.isPaused = !this.draftState.isPaused;
    
    if (this.draftState.isPaused) {
      this.stopPickTimer();
    } else {
      this.startPickTimer();
    }

    this.emitEvent({
      type: this.draftState.isPaused ? 'pause' : 'resume',
      timestamp: new Date(),
      data: { isPaused: this.draftState.isPaused }
    });
  }

  /**
   * Subscribe to draft events
   */
  public on(event: string, listener: DraftEventListener): void {
    const listeners = this.listeners.get(event) || new Set();
    listeners.add(listener);
    this.listeners.set(event, listeners);
  }

  /**
   * Unsubscribe from events
   */
  public off(event: string, listener: DraftEventListener): void {
    const listeners = this.listeners.get(event);
    if (listeners) {
      listeners.delete(listener);
    }
  }

  /**
   * Emit event to listeners
   */
  private emitEvent(event: DraftEvent): void {
    this.eventHistory.push(event);

    const listeners = this.listeners.get(event.type) || new Set();
    const allListeners = this.listeners.get('*') || new Set();

    for (const listener of listeners) {
      listener(event);
    }

    for (const listener of allListeners) {
      listener(event);
    }
  }

  /**
   * Get pick history
   */
  public getPickHistory(): DraftPick[] {
    return [...this.draftState.picks];
  }

  /**
   * Get event history
   */
  public getEventHistory(): DraftEvent[] {
    return [...this.eventHistory];
  }

  /**
   * Undo last pick (commissioner mode)
   */
  public undoLastPick(): boolean {
    if (this.draftState.picks.length === 0) return false;

    const lastPick = this.draftState.picks.pop()!;
    
    // Restore player to available pool
    this.draftState.availablePlayers.add(lastPick.playerId);

    // Remove from team roster
    const team = this.draftState.teams.get(lastPick.teamId);
    if (team) {
      team.roster = team.roster.filter(id => id !== lastPick.playerId);
      this.updateTeamNeeds(team);
    }

    // Revert pick counter
    this.draftState.currentPick--;
    if (this.draftState.currentPick < (this.draftState.currentRound - 1) * this.draftState.draftOrder.length + 1) {
      this.draftState.currentRound--;
    }

    return true;
  }

  /**
   * Set auto-pick enabled
   */
  public setAutoPickEnabled(enabled: boolean): void {
    this.autoPickEnabled = enabled;
  }

  /**
   * Get remaining time for current pick
   */
  public getRemainingTime(): number {
    // Implementation would track actual timer
    return this.draftState.timePerPick || 0;
  }

  /**
   * Export draft results
   */
  public exportDraft(): string {
    const results = {
      leagueSettings: this.draftState.leagueSettings,
      draftOrder: this.draftState.draftOrder,
      picks: this.draftState.picks.map(pick => ({
        ...pick,
        player: this.players.get(pick.playerId)
      })),
      teams: Array.from(this.draftState.teams.values()).map(team => ({
        ...team,
        roster: team.roster.map(id => this.players.get(id))
      }))
    };

    return JSON.stringify(results, null, 2);
  }
}

type DraftEventListener = (event: DraftEvent) => void;
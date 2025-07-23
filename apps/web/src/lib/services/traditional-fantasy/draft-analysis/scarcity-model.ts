// Position Scarcity Modeling with Supply/Demand Curves

import {
  Position,
  PositionScarcity,
  Player,
  PlayerProjection,
  LeagueSettings,
  DraftState,
  PlayerMap,
  ProjectionMap
} from './types';

export class ScarcityModel {
  private scarcityCache: Map<Position, PositionScarcity> = new Map();
  private historicalDraftData: Map<Position, number[]> = new Map();
  private readonly SCARCITY_UPDATE_THRESHOLD = 5; // Update after N picks
  private picksSinceUpdate = 0;

  constructor(
    private players: PlayerMap,
    private projections: ProjectionMap,
    private leagueSettings: LeagueSettings
  ) {
    this.initializeHistoricalData();
    this.calculateInitialScarcity();
  }

  /**
   * Get current scarcity for all positions
   */
  public getPositionScarcity(
    draftState: DraftState,
    forceUpdate = false
  ): Map<Position, PositionScarcity> {
    if (forceUpdate || this.picksSinceUpdate >= this.SCARCITY_UPDATE_THRESHOLD) {
      this.updateScarcity(draftState);
      this.picksSinceUpdate = 0;
    }

    return new Map(this.scarcityCache);
  }

  /**
   * Get scarcity for specific position
   */
  public getScarcityForPosition(
    position: Position,
    draftState: DraftState
  ): PositionScarcity | null {
    const scarcity = this.getPositionScarcity(draftState);
    return scarcity.get(position) || null;
  }

  /**
   * Calculate probability of positional run
   */
  public calculateRunProbability(
    position: Position,
    draftState: DraftState
  ): { probability: number; expectedPicks: number } {
    const recentPicks = draftState.picks.slice(-10);
    const positionPicks = recentPicks.filter(pick => {
      const player = this.players.get(pick.playerId);
      return player?.position === position;
    });

    // Base probability from historical data
    const historicalRate = this.getHistoricalDraftRate(position, draftState.currentRound);
    
    // Adjust based on recent activity
    const recentRate = positionPicks.length / recentPicks.length;
    const momentum = recentRate - historicalRate;

    // Calculate run probability
    let probability = historicalRate;
    if (momentum > 0.1) {
      probability += momentum * 0.5; // Positive momentum increases probability
    }

    // Adjust for scarcity
    const scarcity = this.scarcityCache.get(position);
    if (scarcity && scarcity.scarcityIndex > 0.7) {
      probability *= 1.3; // High scarcity increases run probability
    }

    // Cap probability
    probability = Math.min(0.9, Math.max(0.1, probability));

    // Expected picks in next 10
    const expectedPicks = Math.round(probability * 10);

    return { probability, expectedPicks };
  }

  /**
   * Initialize with historical draft data
   */
  private initializeHistoricalData(): void {
    // Simulated historical data - in production, load from database
    const nflHistorical = {
      QB: [0.08, 0.12, 0.15, 0.18, 0.12, 0.08, 0.06, 0.05],
      RB: [0.35, 0.30, 0.25, 0.20, 0.15, 0.12, 0.10, 0.08],
      WR: [0.25, 0.35, 0.35, 0.30, 0.25, 0.20, 0.15, 0.12],
      TE: [0.05, 0.08, 0.12, 0.15, 0.12, 0.10, 0.08, 0.06],
      K: [0.00, 0.00, 0.00, 0.02, 0.05, 0.15, 0.25, 0.30],
      DST: [0.00, 0.00, 0.02, 0.05, 0.10, 0.20, 0.25, 0.25]
    };

    // Store by round
    for (const [position, rates] of Object.entries(nflHistorical)) {
      this.historicalDraftData.set(position, rates);
    }
  }

  /**
   * Calculate initial scarcity for all positions
   */
  private calculateInitialScarcity(): void {
    const positions = this.getUniquePositions();

    for (const position of positions) {
      const scarcity = this.calculatePositionScarcity(
        position,
        new Set() // No drafted players initially
      );
      this.scarcityCache.set(position, scarcity);
    }
  }

  /**
   * Update scarcity based on current draft state
   */
  private updateScarcity(draftState: DraftState): void {
    const draftedPlayerIds = new Set(
      draftState.picks.map(pick => pick.playerId)
    );

    const positions = this.getUniquePositions();

    for (const position of positions) {
      const scarcity = this.calculatePositionScarcity(
        position,
        draftedPlayerIds
      );
      
      // Add run probability
      const runProb = this.calculateRunProbability(position, draftState);
      scarcity.projectedRun = runProb;

      this.scarcityCache.set(position, scarcity);
    }
  }

  /**
   * Calculate scarcity metrics for a position
   */
  private calculatePositionScarcity(
    position: Position,
    draftedPlayers: Set<string>
  ): PositionScarcity {
    // Get all undrafted players at position
    const availablePlayers = Array.from(this.players.values())
      .filter(p => p.position === position && !draftedPlayers.has(p.id));

    // Get projections and sort by points
    const projectedPoints = availablePlayers
      .map(p => this.projections.get(p.id)?.projectedPoints || 0)
      .sort((a, b) => b - a);

    // Calculate starter requirements
    const starterReq = this.calculateStarterRequirement(position);
    const totalNeeded = starterReq.total;
    const remainingNeeded = starterReq.remaining;

    // Identify starters and backups
    const remainingStarters = Math.min(
      projectedPoints.filter(pts => pts > 0).length,
      remainingNeeded
    );
    const remainingBackups = Math.max(
      0,
      availablePlayers.length - remainingStarters
    );

    // Calculate replacement level
    const replacementIndex = Math.min(
      remainingStarters + Math.floor(remainingBackups * 0.3),
      projectedPoints.length - 1
    );
    const replacementLevel = projectedPoints[replacementIndex] || 0;

    // Calculate drop-off to next tier
    const tierSize = Math.ceil(remainingStarters / 5); // 5 tiers
    const currentTierEnd = Math.min(tierSize, projectedPoints.length - 1);
    const nextTierStart = Math.min(tierSize + 1, projectedPoints.length - 1);
    const dropOffPoints = currentTierEnd < projectedPoints.length - 1
      ? projectedPoints[currentTierEnd] - projectedPoints[nextTierStart]
      : 0;

    // Calculate supply/demand ratio
    const demand = remainingNeeded;
    const supply = remainingStarters;
    const supplyDemandRatio = supply / Math.max(1, demand);

    // Calculate scarcity index (0-1, higher = more scarce)
    const scarcityFactors = [
      1 - supplyDemandRatio, // Lower ratio = higher scarcity
      dropOffPoints / 10, // Normalized drop-off
      1 - (remainingStarters / totalNeeded), // Depletion rate
      this.calculatePositionalImportance(position) // Position importance
    ];

    const scarcityIndex = Math.min(
      1,
      scarcityFactors.reduce((a, b) => a + b, 0) / scarcityFactors.length
    );

    return {
      position,
      scarcityIndex,
      remainingStarters,
      remainingBackups,
      dropOffPoints,
      replacementLevel,
      supplyDemandRatio,
      projectedRun: {
        probability: 0,
        expectedPicks: 0
      }
    };
  }

  /**
   * Calculate starter requirements for position
   */
  private calculateStarterRequirement(position: Position): {
    total: number;
    remaining: number;
  } {
    const teamCount = this.leagueSettings.teamCount;
    const requirements = this.leagueSettings.rosterRequirements[position] || { min: 0, max: 0 };

    let total = requirements.min * teamCount;

    // Add flex considerations
    if (['RB', 'WR', 'TE'].includes(position)) {
      const flexReq = this.leagueSettings.rosterRequirements['FLEX'];
      if (flexReq) {
        const flexShare = position === 'RB' ? 0.4 : position === 'WR' ? 0.5 : 0.1;
        total += flexReq.min * teamCount * flexShare;
      }
    }

    // For now, assume all positions need to be filled
    // In production, calculate based on drafted players
    const remaining = total;

    return { total: Math.ceil(total), remaining: Math.ceil(remaining) };
  }

  /**
   * Get positional importance weight
   */
  private calculatePositionalImportance(position: Position): number {
    const importanceMap: Record<string, number> = {
      // NFL
      QB: 0.9,
      RB: 0.85,
      WR: 0.75,
      TE: 0.6,
      K: 0.2,
      DST: 0.25,
      // NBA
      PG: 0.85,
      SG: 0.8,
      SF: 0.8,
      PF: 0.75,
      C: 0.7,
      // Add other sports
    };

    return importanceMap[position] || 0.5;
  }

  /**
   * Get historical draft rate for position/round
   */
  private getHistoricalDraftRate(position: Position, round: number): number {
    const historical = this.historicalDraftData.get(position);
    if (!historical) return 0.1;

    const roundIndex = Math.min(round - 1, historical.length - 1);
    return historical[roundIndex] || 0.1;
  }

  /**
   * Get unique positions from player pool
   */
  private getUniquePositions(): Set<Position> {
    const positions = new Set<Position>();
    for (const player of this.players.values()) {
      positions.add(player.position);
    }
    return positions;
  }

  /**
   * Track pick for scarcity updates
   */
  public recordPick(playerId: string): void {
    this.picksSinceUpdate++;
  }

  /**
   * Get supply curve data for visualization
   */
  public getSupplyCurve(position: Position): {
    rank: number;
    projectedPoints: number;
    tier: number;
  }[] {
    const players = Array.from(this.players.values())
      .filter(p => p.position === position);

    const curve = players
      .map(player => {
        const projection = this.projections.get(player.id);
        if (!projection) return null;

        return {
          rank: 0, // Will be set after sorting
          projectedPoints: projection.projectedPoints,
          tier: 0 // Will be calculated
        };
      })
      .filter(p => p !== null) as { rank: number; projectedPoints: number; tier: number }[];

    // Sort and assign ranks
    curve.sort((a, b) => b.projectedPoints - a.projectedPoints);
    curve.forEach((point, index) => {
      point.rank = index + 1;
      point.tier = Math.ceil((index + 1) / Math.ceil(curve.length / 5));
    });

    return curve;
  }

  /**
   * Get demand curve based on league settings
   */
  public getDemandCurve(position: Position): {
    pick: number;
    cumulativeDemand: number;
    expectedValue: number;
  }[] {
    const totalPicks = this.leagueSettings.teamCount * this.leagueSettings.rosterSize;
    const historical = this.historicalDraftData.get(position) || [];
    
    const curve: {
      pick: number;
      cumulativeDemand: number;
      expectedValue: number;
    }[] = [];

    let cumulativeDemand = 0;
    const picksPerRound = this.leagueSettings.teamCount;

    for (let pick = 1; pick <= totalPicks; pick++) {
      const round = Math.ceil(pick / picksPerRound);
      const roundIndex = Math.min(round - 1, historical.length - 1);
      const draftRate = historical[roundIndex] || 0.05;

      cumulativeDemand += draftRate;

      // Expected value decreases as draft progresses
      const expectedValue = 100 * Math.pow(0.95, round - 1);

      curve.push({
        pick,
        cumulativeDemand: Math.min(cumulativeDemand, 1),
        expectedValue
      });
    }

    return curve;
  }

  /**
   * Predict when position run will end
   */
  public predictRunEnd(
    position: Position,
    draftState: DraftState
  ): number {
    const runProb = this.calculateRunProbability(position, draftState);
    
    if (runProb.probability < 0.3) {
      return 0; // No run detected
    }

    // Estimate based on remaining quality
    const scarcity = this.scarcityCache.get(position);
    if (!scarcity) return 3;

    // Run typically ends when:
    // 1. Scarcity drops below threshold
    // 2. Tier break occurs
    // 3. Historical patterns suggest it
    const factors = [
      scarcity.dropOffPoints > 5 ? 2 : 5, // Tier break coming
      scarcity.remainingStarters < 10 ? 3 : 6, // Limited supply
      Math.ceil(5 / runProb.probability) // Historical tendency
    ];

    return Math.min(...factors);
  }
}
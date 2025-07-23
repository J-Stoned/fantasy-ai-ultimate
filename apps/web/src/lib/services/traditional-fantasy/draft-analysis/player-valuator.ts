// ML-Based Player Valuation System with VORP Calculations

import { 
  Player, 
  PlayerProjection, 
  PlayerValue, 
  LeagueSettings,
  Position,
  Sport,
  PlayerMap,
  ProjectionMap,
  ValueMap
} from './types';

export class PlayerValuator {
  private readonly POSITION_WEIGHTS: Record<string, number> = {
    // NFL positions
    QB: 1.0,
    RB: 0.85,
    WR: 0.75,
    TE: 0.65,
    K: 0.3,
    DST: 0.35,
    // NBA positions
    PG: 0.9,
    SG: 0.85,
    SF: 0.85,
    PF: 0.8,
    C: 0.75,
    // Add other sports as needed
  };

  private readonly CONSISTENCY_WEIGHT = 0.25;
  private readonly UPSIDE_WEIGHT = 0.15;
  private readonly AGE_CURVE_PEAK: Record<Sport, number> = {
    NFL: 26,
    NBA: 27,
    MLB: 28,
    NHL: 26
  };

  private playerCache: ValueMap = new Map();
  private replacementLevels: Map<Position, number> = new Map();
  private positionDepth: Map<Position, number[]> = new Map();

  constructor(
    private players: PlayerMap,
    private projections: ProjectionMap,
    private leagueSettings: LeagueSettings
  ) {
    this.calculateReplacementLevels();
  }

  /**
   * Calculate Value Over Replacement Player (VORP) for all players
   */
  public calculateVORP(): ValueMap {
    const values: ValueMap = new Map();

    // Group players by position
    const playersByPosition = this.groupPlayersByPosition();

    // Calculate VORP for each position
    for (const [position, positionPlayers] of playersByPosition) {
      const replacementLevel = this.replacementLevels.get(position) || 0;
      const positionValues = this.calculatePositionVORP(
        positionPlayers,
        replacementLevel,
        position
      );

      positionValues.forEach((value, playerId) => {
        values.set(playerId, value);
      });
    }

    // Apply cross-position adjustments
    this.applyCrossPositionAdjustments(values);

    // Calculate VBD (Value Based Drafting) scores
    this.calculateVBD(values);

    // Assign tiers using clustering
    this.assignTiers(values);

    // Calculate additional value metrics
    this.calculateAdditionalMetrics(values);

    this.playerCache = values;
    return values;
  }

  /**
   * Get real-time player value with context
   */
  public getPlayerValue(
    playerId: string,
    draftedPlayers: Set<string>,
    currentRound: number
  ): PlayerValue | null {
    const baseValue = this.playerCache.get(playerId);
    if (!baseValue) return null;

    // Adjust value based on scarcity
    const adjustedValue = this.adjustForScarcity(
      baseValue,
      draftedPlayers,
      currentRound
    );

    // Apply positional runs adjustment
    const runAdjusted = this.adjustForPositionalRuns(
      adjustedValue,
      draftedPlayers
    );

    return runAdjusted;
  }

  /**
   * Calculate replacement levels for each position
   */
  private calculateReplacementLevels(): void {
    const playersByPosition = this.groupPlayersByPosition();

    for (const [position, players] of playersByPosition) {
      const projectedPoints = players
        .map(p => this.projections.get(p.id)?.projectedPoints || 0)
        .sort((a, b) => b - a);

      // Calculate how many players at this position will be starters
      const starterCount = this.calculateStarterCount(position);
      const replacementIndex = Math.floor(starterCount * 1.5); // 50% more than starters

      const replacementLevel = projectedPoints[replacementIndex] || 0;
      this.replacementLevels.set(position, replacementLevel);

      // Store position depth for later analysis
      this.positionDepth.set(position, projectedPoints);
    }
  }

  /**
   * Calculate starter count for a position
   */
  private calculateStarterCount(position: Position): number {
    const teamCount = this.leagueSettings.teamCount;
    const requirements = this.leagueSettings.rosterRequirements[position];
    
    if (!requirements) return 0;

    // Account for flex positions
    let starterCount = requirements.min * teamCount;
    
    // Add flex considerations
    if (position === 'RB' || position === 'WR' || position === 'TE') {
      const flexRequirements = this.leagueSettings.rosterRequirements['FLEX'];
      if (flexRequirements) {
        // Estimate flex usage by position
        const flexShare = position === 'RB' ? 0.4 : position === 'WR' ? 0.5 : 0.1;
        starterCount += flexRequirements.min * teamCount * flexShare;
      }
    }

    return Math.ceil(starterCount);
  }

  /**
   * Group players by position
   */
  private groupPlayersByPosition(): Map<Position, Player[]> {
    const grouped = new Map<Position, Player[]>();

    for (const player of this.players.values()) {
      const positionPlayers = grouped.get(player.position) || [];
      positionPlayers.push(player);
      grouped.set(player.position, positionPlayers);
    }

    return grouped;
  }

  /**
   * Calculate VORP for players at a specific position
   */
  private calculatePositionVORP(
    players: Player[],
    replacementLevel: number,
    position: Position
  ): ValueMap {
    const values = new Map<string, PlayerValue>();

    // Sort by projected points
    const sortedPlayers = players.sort((a, b) => {
      const aProj = this.projections.get(a.id)?.projectedPoints || 0;
      const bProj = this.projections.get(b.id)?.projectedPoints || 0;
      return bProj - aProj;
    });

    sortedPlayers.forEach((player, index) => {
      const projection = this.projections.get(player.id);
      if (!projection) return;

      const vorp = projection.projectedPoints - replacementLevel;
      const positionWeight = this.POSITION_WEIGHTS[position] || 0.5;

      // Apply ML-based adjustments
      const ageAdjustment = this.calculateAgeAdjustment(player);
      const consistencyBonus = projection.consistency * this.CONSISTENCY_WEIGHT;
      const upsideBonus = projection.upside * this.UPSIDE_WEIGHT;

      const adjustedVORP = vorp * positionWeight * ageAdjustment * 
        (1 + consistencyBonus + upsideBonus);

      values.set(player.id, {
        playerId: player.id,
        adp: 0, // Will be set from external data
        ecr: 0, // Will be set from external data
        vorp: adjustedVORP,
        vbd: 0, // Calculated later
        tier: 0, // Assigned later
        positionRank: index + 1,
        overallRank: 0, // Calculated later
        tradeValue: 0 // Calculated later
      });
    });

    return values;
  }

  /**
   * Calculate age-based adjustment
   */
  private calculateAgeAdjustment(player: Player): number {
    if (!player.age) return 1.0;

    const peak = this.AGE_CURVE_PEAK[player.sport];
    const ageDiff = Math.abs(player.age - peak);

    // Smooth age curve
    if (player.age < peak) {
      // Young players have upside
      return 1.0 + (0.02 * (peak - player.age));
    } else {
      // Older players decline
      return Math.max(0.7, 1.0 - (0.05 * ageDiff));
    }
  }

  /**
   * Apply cross-position adjustments for positional value
   */
  private applyCrossPositionAdjustments(values: ValueMap): void {
    // Get all values sorted by VORP
    const allValues = Array.from(values.values()).sort((a, b) => b.vorp - a.vorp);

    // Normalize VORP scores across positions
    const maxVORP = allValues[0]?.vorp || 1;
    const minVORP = allValues[allValues.length - 1]?.vorp || 0;
    const range = maxVORP - minVORP;

    allValues.forEach((value, index) => {
      // Normalize VORP to 0-100 scale
      const normalizedVORP = ((value.vorp - minVORP) / range) * 100;
      
      // Update overall rank
      value.overallRank = index + 1;
      value.vorp = normalizedVORP;

      values.set(value.playerId, value);
    });
  }

  /**
   * Calculate Value Based Drafting (VBD) scores
   */
  private calculateVBD(values: ValueMap): void {
    // VBD baseline is the last starter at each position
    const vbdBaselines = new Map<Position, number>();

    // Calculate baselines
    for (const [position, depths] of this.positionDepth) {
      const starterCount = this.calculateStarterCount(position);
      const baseline = depths[starterCount - 1] || 0;
      vbdBaselines.set(position, baseline);
    }

    // Calculate VBD for each player
    for (const value of values.values()) {
      const player = this.players.get(value.playerId);
      if (!player) continue;

      const projection = this.projections.get(value.playerId);
      if (!projection) continue;

      const baseline = vbdBaselines.get(player.position) || 0;
      value.vbd = projection.projectedPoints - baseline;

      values.set(value.playerId, value);
    }
  }

  /**
   * Assign tiers using K-means clustering
   */
  private assignTiers(values: ValueMap): void {
    const playersByPosition = new Map<Position, PlayerValue[]>();

    // Group by position
    for (const value of values.values()) {
      const player = this.players.get(value.playerId);
      if (!player) continue;

      const positionValues = playersByPosition.get(player.position) || [];
      positionValues.push(value);
      playersByPosition.set(player.position, positionValues);
    }

    // Assign tiers for each position
    for (const [position, positionValues] of playersByPosition) {
      const sorted = positionValues.sort((a, b) => b.vorp - a.vorp);
      const tiers = this.kMeansClustering(sorted.map(v => v.vorp), 6);

      sorted.forEach((value, index) => {
        value.tier = tiers[index];
        values.set(value.playerId, value);
      });
    }
  }

  /**
   * Simple K-means clustering for tier assignment
   */
  private kMeansClustering(values: number[], k: number): number[] {
    if (values.length <= k) {
      return values.map((_, i) => i + 1);
    }

    // Initialize centroids
    const centroids: number[] = [];
    const step = values.length / k;
    for (let i = 0; i < k; i++) {
      centroids.push(values[Math.floor(i * step)]);
    }

    // Assign to clusters
    const assignments = new Array(values.length);
    let changed = true;
    let iterations = 0;

    while (changed && iterations < 100) {
      changed = false;
      
      // Assign each value to nearest centroid
      for (let i = 0; i < values.length; i++) {
        let minDist = Infinity;
        let bestCluster = 0;

        for (let j = 0; j < k; j++) {
          const dist = Math.abs(values[i] - centroids[j]);
          if (dist < minDist) {
            minDist = dist;
            bestCluster = j;
          }
        }

        if (assignments[i] !== bestCluster) {
          changed = true;
          assignments[i] = bestCluster;
        }
      }

      // Update centroids
      if (changed) {
        const clusterSums = new Array(k).fill(0);
        const clusterCounts = new Array(k).fill(0);

        for (let i = 0; i < values.length; i++) {
          clusterSums[assignments[i]] += values[i];
          clusterCounts[assignments[i]]++;
        }

        for (let i = 0; i < k; i++) {
          if (clusterCounts[i] > 0) {
            centroids[i] = clusterSums[i] / clusterCounts[i];
          }
        }
      }

      iterations++;
    }

    // Convert cluster assignments to tier numbers (1-based)
    return assignments.map(a => a + 1);
  }

  /**
   * Calculate additional metrics
   */
  private calculateAdditionalMetrics(values: ValueMap): void {
    for (const value of values.values()) {
      const projection = this.projections.get(value.playerId);
      if (!projection) continue;

      // Auction value (simplified - would use historical data in production)
      const maxBudget = 200;
      const budgetPerTeam = maxBudget / this.leagueSettings.rosterSize;
      value.auctionValue = Math.max(1, Math.round(
        (value.vorp / 100) * budgetPerTeam * 2
      ));

      // Keeper value (based on expected improvement)
      const player = this.players.get(value.playerId);
      if (player?.age && player.age < 25) {
        value.keeperValue = value.vorp * 1.2;
      } else {
        value.keeperValue = value.vorp * 0.9;
      }

      // Dynasty value (long-term projection)
      if (player?.age) {
        const yearsToDecline = Math.max(0, 
          this.AGE_CURVE_PEAK[player.sport] - player.age + 2
        );
        value.dynastyValue = value.vorp * (1 + yearsToDecline * 0.1);
      }

      // Trade value (combination of current and future value)
      value.tradeValue = (value.vorp + (value.keeperValue || value.vorp)) / 2;

      values.set(value.playerId, value);
    }
  }

  /**
   * Adjust value based on current draft scarcity
   */
  private adjustForScarcity(
    baseValue: PlayerValue,
    draftedPlayers: Set<string>,
    currentRound: number
  ): PlayerValue {
    const player = this.players.get(baseValue.playerId);
    if (!player) return baseValue;

    // Calculate remaining quality at position
    const positionValues = Array.from(this.playerCache.values())
      .filter(v => {
        const p = this.players.get(v.playerId);
        return p?.position === player.position && !draftedPlayers.has(v.playerId);
      })
      .sort((a, b) => b.vorp - a.vorp);

    const remainingElite = positionValues.filter(v => v.tier <= 2).length;
    const dropToNextTier = this.calculateDropToNextTier(
      baseValue,
      positionValues
    );

    // Adjust value based on scarcity
    const adjustedValue = { ...baseValue };
    
    if (remainingElite <= 3) {
      adjustedValue.vorp *= 1.15; // Premium for scarce elite players
    }

    if (dropToNextTier > 10) {
      adjustedValue.vorp *= 1.1; // Tier break premium
    }

    // Round-based adjustment
    const expectedRound = Math.ceil(baseValue.overallRank / this.leagueSettings.teamCount);
    if (currentRound > expectedRound) {
      adjustedValue.vorp *= 1.05; // Value pick bonus
    }

    return adjustedValue;
  }

  /**
   * Calculate points drop to next tier
   */
  private calculateDropToNextTier(
    value: PlayerValue,
    remainingAtPosition: PlayerValue[]
  ): number {
    const currentTier = value.tier;
    const nextTierPlayer = remainingAtPosition.find(v => v.tier > currentTier);

    if (!nextTierPlayer) return 0;

    const currentProj = this.projections.get(value.playerId);
    const nextProj = this.projections.get(nextTierPlayer.playerId);

    if (!currentProj || !nextProj) return 0;

    return currentProj.projectedPoints - nextProj.projectedPoints;
  }

  /**
   * Adjust for positional runs
   */
  private adjustForPositionalRuns(
    value: PlayerValue,
    draftedPlayers: Set<string>
  ): PlayerValue {
    const player = this.players.get(value.playerId);
    if (!player) return value;

    // Check recent picks for position runs
    const recentPicks = Array.from(draftedPlayers).slice(-10);
    const recentPositionPicks = recentPicks.filter(id => {
      const p = this.players.get(id);
      return p?.position === player.position;
    }).length;

    const adjustedValue = { ...value };

    // If position run detected, increase value of remaining players
    if (recentPositionPicks >= 3) {
      adjustedValue.vorp *= 1.08;
    }

    return adjustedValue;
  }

  /**
   * Get position depth chart
   */
  public getPositionDepth(position: Position): number[] {
    return this.positionDepth.get(position) || [];
  }

  /**
   * Get replacement level for position
   */
  public getReplacementLevel(position: Position): number {
    return this.replacementLevels.get(position) || 0;
  }
}
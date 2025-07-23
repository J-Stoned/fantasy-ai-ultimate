// AI-Powered Recommendation Engine with Context-Aware Suggestions

import {
  DraftRecommendation,
  RecommendationReason,
  AlternativePick,
  RecommendationStrategy,
  DraftState,
  Player,
  PlayerValue,
  PositionScarcity,
  TeamState,
  PositionNeed,
  PlayerMap,
  ProjectionMap,
  ValueMap
} from './types';
import { PlayerValuator } from './player-valuator';
import { ScarcityModel } from './scarcity-model';

export class RecommendationEngine {
  private readonly NEED_WEIGHT = 0.3;
  private readonly VALUE_WEIGHT = 0.35;
  private readonly SCARCITY_WEIGHT = 0.25;
  private readonly STRATEGY_WEIGHT = 0.1;

  private recommendationCache = new Map<string, DraftRecommendation[]>();
  private teamTendencies = new Map<string, TeamTendency>();

  constructor(
    private players: PlayerMap,
    private projections: ProjectionMap,
    private valuator: PlayerValuator,
    private scarcityModel: ScarcityModel
  ) {}

  /**
   * Get AI-powered recommendations for current pick
   */
  public getRecommendations(
    draftState: DraftState,
    count: number = 5
  ): DraftRecommendation[] {
    const cacheKey = this.getCacheKey(draftState);
    const cached = this.recommendationCache.get(cacheKey);
    if (cached) return cached;

    // Get current team state
    const myTeam = draftState.teams.get(draftState.myTeamId);
    if (!myTeam) return [];

    // Analyze team needs
    const needs = this.analyzeTeamNeeds(myTeam, draftState);

    // Get available players with values
    const availableValues = this.getAvailablePlayerValues(draftState);

    // Get position scarcity
    const scarcityMap = this.scarcityModel.getPositionScarcity(draftState);

    // Detect opponent tendencies
    this.updateTeamTendencies(draftState);

    // Score all available players
    const scoredPlayers = availableValues.map(playerValue => {
      const player = this.players.get(playerValue.playerId)!;
      const projection = this.projections.get(playerValue.playerId)!;
      
      return {
        playerValue,
        player,
        projection,
        score: this.scorePlayer(
          player,
          playerValue,
          needs,
          scarcityMap,
          myTeam,
          draftState
        )
      };
    });

    // Sort by score and get top recommendations
    scoredPlayers.sort((a, b) => b.score.total - a.score.total);
    const topPicks = scoredPlayers.slice(0, count);

    // Build recommendations
    const recommendations = topPicks.map(pick => 
      this.buildRecommendation(
        pick,
        scoredPlayers,
        needs,
        scarcityMap,
        draftState
      )
    );

    this.recommendationCache.set(cacheKey, recommendations);
    return recommendations;
  }

  /**
   * Analyze team needs based on roster construction
   */
  private analyzeTeamNeeds(
    team: TeamState,
    draftState: DraftState
  ): Map<string, PositionNeed> {
    const needs = new Map<string, PositionNeed>();
    const roster = team.roster.map(id => this.players.get(id)!);

    // Count current positions
    const positionCounts = new Map<string, number>();
    const positionQuality = new Map<string, number[]>();

    for (const player of roster) {
      const count = positionCounts.get(player.position) || 0;
      positionCounts.set(player.position, count + 1);

      const quality = positionQuality.get(player.position) || [];
      const projection = this.projections.get(player.id);
      if (projection) {
        quality.push(projection.projectedPoints);
      }
      positionQuality.set(player.position, quality);
    }

    // Calculate needs for each position
    for (const [position, requirements] of Object.entries(
      draftState.leagueSettings.rosterRequirements
    )) {
      const current = positionCounts.get(position) || 0;
      const quality = positionQuality.get(position) || [];
      const avgQuality = quality.length > 0 
        ? quality.reduce((a, b) => a + b, 0) / quality.length 
        : 0;

      // Calculate priority based on multiple factors
      let priority = 0;

      // Empty positions get highest priority
      if (current === 0 && requirements.min > 0) {
        priority = 1.0;
      } else if (current < requirements.min) {
        priority = 0.8 + (0.2 * (1 - current / requirements.min));
      } else if (current < requirements.max) {
        // Consider quality for filled positions
        const replacementLevel = this.valuator.getReplacementLevel(position);
        if (avgQuality < replacementLevel * 1.2) {
          priority = 0.4 + (0.2 * (1 - avgQuality / (replacementLevel * 1.2)));
        } else {
          priority = 0.2; // Low priority for quality positions
        }
      }

      // Adjust for position importance
      const importance = this.getPositionImportance(position);
      priority *= importance;

      needs.set(position, {
        position,
        priority,
        currentCount: current,
        targetCount: requirements.min,
        qualityScore: avgQuality
      });
    }

    return needs;
  }

  /**
   * Score a player based on multiple factors
   */
  private scorePlayer(
    player: Player,
    value: PlayerValue,
    needs: Map<string, PositionNeed>,
    scarcityMap: Map<string, PositionScarcity>,
    team: TeamState,
    draftState: DraftState
  ): ScoringResult {
    const scores = {
      need: this.scoreNeed(player, needs),
      value: this.scoreValue(value, draftState),
      scarcity: this.scoreScarcity(player, scarcityMap),
      strategy: this.scoreStrategy(player, team, draftState),
      synergy: this.scoreSynergy(player, team),
      risk: this.scoreRisk(player)
    };

    const total = 
      scores.need * this.NEED_WEIGHT +
      scores.value * this.VALUE_WEIGHT +
      scores.scarcity * this.SCARCITY_WEIGHT +
      scores.strategy * this.STRATEGY_WEIGHT +
      scores.synergy * 0.05 +
      scores.risk * 0.05;

    return { ...scores, total };
  }

  /**
   * Score based on team need
   */
  private scoreNeed(player: Player, needs: Map<string, PositionNeed>): number {
    const need = needs.get(player.position);
    if (!need) return 0;

    // Higher priority = higher score
    return need.priority * 100;
  }

  /**
   * Score based on player value
   */
  private scoreValue(value: PlayerValue, draftState: DraftState): number {
    const currentPick = draftState.currentPick;
    const expectedPick = value.adp || value.overallRank;

    // Calculate value relative to current pick
    let valueScore = 50; // Base score

    if (currentPick > expectedPick) {
      // Getting player later than expected (value pick)
      const picksDiff = currentPick - expectedPick;
      valueScore += Math.min(30, picksDiff * 2);
    } else if (currentPick < expectedPick) {
      // Reaching for player
      const picksDiff = expectedPick - currentPick;
      valueScore -= Math.min(20, picksDiff);
    }

    // Bonus for tier breaks
    if (value.tier <= 2) {
      valueScore += 15;
    } else if (value.tier <= 3) {
      valueScore += 10;
    }

    // VORP contribution
    valueScore += value.vorp * 0.3;

    return Math.max(0, Math.min(100, valueScore));
  }

  /**
   * Score based on position scarcity
   */
  private scoreScarcity(
    player: Player,
    scarcityMap: Map<string, PositionScarcity>
  ): number {
    const scarcity = scarcityMap.get(player.position);
    if (!scarcity) return 50;

    let score = 50;

    // High scarcity increases score
    score += scarcity.scarcityIndex * 30;

    // Tier drops increase urgency
    if (scarcity.dropOffPoints > 10) {
      score += 15;
    } else if (scarcity.dropOffPoints > 5) {
      score += 10;
    }

    // Position run probability
    if (scarcity.projectedRun.probability > 0.5) {
      score += 10;
    }

    return Math.min(100, score);
  }

  /**
   * Score based on draft strategy
   */
  private scoreStrategy(
    player: Player,
    team: TeamState,
    draftState: DraftState
  ): number {
    const strategy = team.draftStrategy;
    let score = 50;

    // Check if player fits strategy
    switch (strategy.type) {
      case 'zero_rb':
        if (player.position === 'RB' && draftState.currentRound <= 3) {
          score -= 30;
        } else if (player.position === 'WR' && draftState.currentRound <= 3) {
          score += 20;
        }
        break;

      case 'hero_rb':
        if (player.position === 'RB') {
          const rbCount = team.roster.filter(id => {
            const p = this.players.get(id);
            return p?.position === 'RB';
          }).length;
          if (rbCount === 0) score += 20;
          else if (rbCount >= 1) score -= 20;
        }
        break;

      case 'robust_rb':
        if (player.position === 'RB' && draftState.currentRound <= 4) {
          score += 20;
        }
        break;
    }

    // Stack building
    if (strategy.stackTargets) {
      if (player.position === 'QB' && player.name === strategy.stackTargets.quarterback) {
        score += 15;
      } else if (
        player.position === 'WR' && 
        strategy.stackTargets.receivers.includes(player.name)
      ) {
        score += 10;
      }
    }

    // Avoid/target lists
    if (strategy.avoidList.includes(player.id)) {
      score = 0;
    } else if (strategy.targetList.includes(player.id)) {
      score += 25;
    }

    return score;
  }

  /**
   * Score team synergy (stacking, handcuffs, etc.)
   */
  private scoreSynergy(player: Player, team: TeamState): number {
    let score = 50;
    const roster = team.roster.map(id => this.players.get(id)!);

    // QB-WR/TE stack
    if (player.position === 'WR' || player.position === 'TE') {
      const teamQB = roster.find(p => p.position === 'QB' && p.team === player.team);
      if (teamQB) score += 15;
    }

    // RB handcuff
    if (player.position === 'RB') {
      const teamRB1 = roster.find(p => 
        p.position === 'RB' && 
        p.team === player.team &&
        p.id !== player.id
      );
      if (teamRB1) {
        // Simple handcuff detection - in production, use depth chart data
        score += 10;
      }
    }

    return score;
  }

  /**
   * Score risk factors
   */
  private scoreRisk(player: Player): number {
    let score = 75; // Start neutral

    // Injury risk
    if (player.injuryStatus && player.injuryStatus !== 'healthy') {
      score -= 25;
    }

    // Age risk
    if (player.age) {
      if (player.age > 30) score -= 10;
      else if (player.age < 23) score -= 5; // Rookie risk
    }

    // Experience boost
    if (player.experience && player.experience >= 3) {
      score += 5;
    }

    return Math.max(0, score);
  }

  /**
   * Build detailed recommendation
   */
  private buildRecommendation(
    pick: ScoredPlayer,
    allScored: ScoredPlayer[],
    needs: Map<string, PositionNeed>,
    scarcityMap: Map<string, PositionScarcity>,
    draftState: DraftState
  ): DraftRecommendation {
    const { player, playerValue, score } = pick;

    // Build reasons
    const reasons: RecommendationReason[] = [];

    // Value reason
    if (score.value > 70) {
      reasons.push({
        type: 'value',
        description: `Excellent value - projected ${Math.round(
          draftState.currentPick - (playerValue.adp || playerValue.overallRank)
        )} picks later than ADP`,
        impact: 0.8,
        weight: 0.35
      });
    }

    // Need reason
    const need = needs.get(player.position);
    if (need && need.priority > 0.7) {
      reasons.push({
        type: 'need',
        description: `High team need at ${player.position}`,
        impact: need.priority,
        weight: 0.3
      });
    }

    // Scarcity reason
    const scarcity = scarcityMap.get(player.position);
    if (scarcity && scarcity.scarcityIndex > 0.6) {
      reasons.push({
        type: 'scarcity',
        description: `Position scarcity - only ${scarcity.remainingStarters} quality ${player.position}s left`,
        impact: scarcity.scarcityIndex,
        weight: 0.25
      });
    }

    // Tier break reason
    if (scarcity && scarcity.dropOffPoints > 8) {
      reasons.push({
        type: 'tier_break',
        description: `Last player in tier - ${scarcity.dropOffPoints.toFixed(1)} point drop to next`,
        impact: 0.7,
        weight: 0.2
      });
    }

    // Get alternatives
    const alternatives = this.getAlternativePicks(
      pick,
      allScored.filter(s => s.player.id !== player.id).slice(0, 3)
    );

    // Determine strategy
    const strategy = this.determineStrategy(score, needs, player);

    // Calculate confidence
    const confidence = this.calculateConfidence(score, reasons);

    return {
      playerId: player.id,
      score: score.total,
      reasons,
      alternativePicks: alternatives,
      confidenceLevel: confidence,
      strategy
    };
  }

  /**
   * Get alternative pick suggestions
   */
  private getAlternativePicks(
    mainPick: ScoredPlayer,
    alternatives: ScoredPlayer[]
  ): AlternativePick[] {
    return alternatives.map(alt => {
      const tradeOff = this.describeTradeOff(mainPick, alt);
      
      return {
        playerId: alt.player.id,
        score: alt.score.total,
        tradeOff
      };
    });
  }

  /**
   * Describe trade-off between two players
   */
  private describeTradeOff(main: ScoredPlayer, alt: ScoredPlayer): string {
    const mainPos = main.player.position;
    const altPos = alt.player.position;

    if (mainPos !== altPos) {
      return `Different position (${altPos}) - addresses different need`;
    }

    if (main.score.value > alt.score.value) {
      return 'Lower value but may fit team need better';
    }

    if (main.score.scarcity > alt.score.scarcity) {
      return 'Less scarce position but higher upside';
    }

    return 'Similar player with different risk/reward profile';
  }

  /**
   * Determine recommendation strategy
   */
  private determineStrategy(
    score: ScoringResult,
    needs: Map<string, PositionNeed>,
    player: Player
  ): RecommendationStrategy {
    // Best player available
    if (score.value > 80 && score.total > 85) {
      return 'best_player_available';
    }

    // Position scarcity
    if (score.scarcity > 75) {
      return 'position_scarcity';
    }

    // High need
    const need = needs.get(player.position);
    if (need && need.priority > 0.8) {
      return 'balanced_roster';
    }

    // Upside/floor based on projection
    const projection = this.projections.get(player.id);
    if (projection) {
      if (projection.upside > 0.7) return 'upside_chase';
      if (projection.consistency > 0.8) return 'safe_floor';
    }

    return 'balanced_roster';
  }

  /**
   * Calculate confidence level
   */
  private calculateConfidence(
    score: ScoringResult,
    reasons: RecommendationReason[]
  ): number {
    let confidence = score.total / 100;

    // Adjust based on reason alignment
    const avgImpact = reasons.reduce((sum, r) => sum + r.impact, 0) / reasons.length;
    confidence = confidence * 0.7 + avgImpact * 0.3;

    // Penalty for low scores in any category
    const minScore = Math.min(
      score.need,
      score.value,
      score.scarcity,
      score.strategy
    );
    
    if (minScore < 30) {
      confidence *= 0.8;
    }

    return Math.min(1, Math.max(0, confidence));
  }

  /**
   * Update team tendency tracking
   */
  private updateTeamTendencies(draftState: DraftState): void {
    for (const [teamId, team] of draftState.teams) {
      if (teamId === draftState.myTeamId) continue;

      const picks = draftState.picks.filter(p => p.teamId === teamId);
      if (picks.length < 3) continue;

      const tendency = this.analyzeTeamTendency(picks, draftState);
      this.teamTendencies.set(teamId, tendency);
    }
  }

  /**
   * Analyze team drafting tendency
   */
  private analyzeTeamTendency(
    picks: any[],
    draftState: DraftState
  ): TeamTendency {
    const positions = picks.map(p => {
      const player = this.players.get(p.playerId);
      return player?.position;
    }).filter(p => p);

    // Position preference
    const positionCounts = new Map<string, number>();
    positions.forEach(pos => {
      if (pos) {
        positionCounts.set(pos, (positionCounts.get(pos) || 0) + 1);
      }
    });

    // Risk tolerance (reaching vs value)
    const reachCount = picks.filter(p => p.reachScore > 0.5).length;
    const riskTolerance = reachCount / picks.length;

    return {
      preferredPositions: Array.from(positionCounts.keys()),
      riskTolerance,
      avgReachScore: picks.reduce((sum, p) => sum + p.reachScore, 0) / picks.length
    };
  }

  /**
   * Get position importance
   */
  private getPositionImportance(position: string): number {
    const importance: Record<string, number> = {
      QB: 0.9,
      RB: 0.85,
      WR: 0.8,
      TE: 0.6,
      K: 0.2,
      DST: 0.25
    };
    return importance[position] || 0.5;
  }

  /**
   * Get available players with values
   */
  private getAvailablePlayerValues(draftState: DraftState): PlayerValue[] {
    const drafted = new Set(draftState.picks.map(p => p.playerId));
    const values: PlayerValue[] = [];

    for (const player of this.players.values()) {
      if (!drafted.has(player.id)) {
        const value = this.valuator.getPlayerValue(
          player.id,
          drafted,
          draftState.currentRound
        );
        if (value) {
          values.push(value);
        }
      }
    }

    return values;
  }

  /**
   * Generate cache key
   */
  private getCacheKey(draftState: DraftState): string {
    return `${draftState.draftId}-${draftState.currentPick}-${draftState.myTeamId}`;
  }

  /**
   * Clear recommendation cache
   */
  public clearCache(): void {
    this.recommendationCache.clear();
  }
}

// Helper interfaces
interface ScoringResult {
  need: number;
  value: number;
  scarcity: number;
  strategy: number;
  synergy: number;
  risk: number;
  total: number;
}

interface ScoredPlayer {
  player: Player;
  playerValue: PlayerValue;
  projection: any;
  score: ScoringResult;
}

interface TeamTendency {
  preferredPositions: string[];
  riskTolerance: number;
  avgReachScore: number;
}
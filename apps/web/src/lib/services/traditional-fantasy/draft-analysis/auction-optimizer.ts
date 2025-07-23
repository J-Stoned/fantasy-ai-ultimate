// Auction Draft Budget Optimization Strategy

import {
  AuctionState,
  AuctionStrategy,
  AuctionBid,
  Player,
  PlayerValue,
  TeamState,
  LeagueSettings,
  PlayerMap,
  ProjectionMap,
  ValueMap
} from './types';
import { PlayerValuator } from './player-valuator';
import { ScarcityModel } from './scarcity-model';

export class AuctionOptimizer {
  private readonly DEFAULT_BUDGET = 200;
  private readonly MIN_BID = 1;
  private readonly ROSTER_BUFFER = 1; // $1 per remaining roster spot

  private inflationTracker: InflationTracker;
  private budgetAllocator: BudgetAllocator;
  private nominationStrategy: NominationStrategy;
  private biddingStrategy: BiddingStrategy;

  constructor(
    private players: PlayerMap,
    private projections: ProjectionMap,
    private valuator: PlayerValuator,
    private scarcityModel: ScarcityModel,
    private leagueSettings: LeagueSettings
  ) {
    this.inflationTracker = new InflationTracker();
    this.budgetAllocator = new BudgetAllocator(leagueSettings);
    this.nominationStrategy = new NominationStrategy(players, projections);
    this.biddingStrategy = new BiddingStrategy();
  }

  /**
   * Get optimal auction strategy
   */
  public getAuctionStrategy(
    auctionState: AuctionState,
    myTeamId: string
  ): AuctionStrategy {
    const myTeam = auctionState.teams.get(myTeamId);
    if (!myTeam) throw new Error('Team not found');

    // Update inflation rate
    this.inflationTracker.updateInflation(auctionState);

    // Calculate optimal budget allocation
    const targetSpend = this.calculateOptimalBudgetAllocation(
      myTeam,
      auctionState
    );

    // Generate max bids for all players
    const maxBids = this.calculateMaxBids(
      myTeam,
      auctionState,
      targetSpend
    );

    // Determine nomination priority
    const nomineePriority = this.nominationStrategy.getPriorityList(
      auctionState,
      myTeam,
      maxBids
    );

    // Determine budget pacing strategy
    const budgetPacing = this.determineBudgetPacing(
      myTeam,
      auctionState
    );

    return {
      targetSpend,
      maxBid: maxBids,
      nomineePriority,
      budgetPacing
    };
  }

  /**
   * Get bid recommendation for current nominee
   */
  public getBidRecommendation(
    playerId: string,
    currentBid: number,
    auctionState: AuctionState,
    myTeamId: string
  ): {
    shouldBid: boolean;
    recommendedBid: number;
    maxBid: number;
    reasoning: string[];
  } {
    const myTeam = auctionState.teams.get(myTeamId);
    if (!myTeam) throw new Error('Team not found');

    const player = this.players.get(playerId);
    const playerValue = this.valuator.getPlayerValue(playerId, new Set(), 1);
    
    if (!player || !playerValue) {
      return {
        shouldBid: false,
        recommendedBid: 0,
        maxBid: 0,
        reasoning: ['Player data not found']
      };
    }

    // Calculate player's auction value with inflation
    const inflationRate = this.inflationTracker.getCurrentInflation();
    const baseValue = playerValue.auctionValue || 1;
    const inflatedValue = Math.round(baseValue * (1 + inflationRate));

    // Calculate max bid based on budget and needs
    const maxBid = this.calculateMaxBidForPlayer(
      player,
      playerValue,
      myTeam,
      auctionState
    );

    // Determine if we should bid
    const { shouldBid, reasoning } = this.evaluateBidOpportunity(
      player,
      currentBid,
      inflatedValue,
      maxBid,
      myTeam,
      auctionState
    );

    // Calculate recommended bid
    const recommendedBid = shouldBid 
      ? Math.min(currentBid + 1, maxBid)
      : 0;

    return {
      shouldBid,
      recommendedBid,
      maxBid,
      reasoning
    };
  }

  /**
   * Calculate optimal budget allocation by position
   */
  private calculateOptimalBudgetAllocation(
    team: TeamState,
    auctionState: AuctionState
  ): Record<string, { min: number; max: number; target: number }> {
    const remainingBudget = auctionState.teamBudgets.get(team.teamId) || this.DEFAULT_BUDGET;
    const remainingSpots = this.calculateRemainingRosterSpots(team);

    // Base allocation percentages by position
    const baseAllocation: Record<string, number> = {
      QB: 0.08,
      RB: 0.35,
      WR: 0.35,
      TE: 0.07,
      K: 0.02,
      DST: 0.03,
      BENCH: 0.10
    };

    // Adjust for filled positions
    const filledValue = this.calculateFilledPositionValue(team);
    const adjustedBudget = remainingBudget + filledValue;

    const allocation: Record<string, { min: number; max: number; target: number }> = {};

    for (const [position, percentage] of Object.entries(baseAllocation)) {
      const positionBudget = adjustedBudget * percentage;
      const currentSpend = this.getPositionSpend(team, position, auctionState);
      const remainingPositionBudget = Math.max(0, positionBudget - currentSpend);

      // Calculate min/max based on remaining needs
      const positionNeeds = this.getPositionNeeds(team, position);
      const minPerPlayer = position === 'BENCH' ? this.MIN_BID : 3;
      
      allocation[position] = {
        min: positionNeeds * minPerPlayer,
        max: remainingPositionBudget,
        target: remainingPositionBudget / Math.max(1, positionNeeds)
      };
    }

    return allocation;
  }

  /**
   * Calculate max bids for all available players
   */
  private calculateMaxBids(
    team: TeamState,
    auctionState: AuctionState,
    targetSpend: Record<string, { min: number; max: number; target: number }>
  ): Map<string, number> {
    const maxBids = new Map<string, number>();
    const availableBudget = auctionState.teamBudgets.get(team.teamId) || this.DEFAULT_BUDGET;
    const remainingSpots = this.calculateRemainingRosterSpots(team);
    const reserveBudget = (remainingSpots - 1) * this.ROSTER_BUFFER;
    const spendableBudget = Math.max(1, availableBudget - reserveBudget);

    // Get all available players
    const availablePlayers = this.getAvailablePlayers(auctionState);

    for (const player of availablePlayers) {
      const playerValue = this.valuator.getPlayerValue(player.id, new Set(), 1);
      if (!playerValue) continue;

      // Base max bid on position allocation
      const positionTarget = targetSpend[player.position];
      if (!positionTarget) continue;

      // Calculate max bid based on multiple factors
      let maxBid = Math.min(
        positionTarget.target,
        spendableBudget,
        playerValue.auctionValue || 1
      );

      // Adjust for player tier
      if (playerValue.tier <= 2) {
        maxBid *= 1.2; // Premium for elite players
      }

      // Adjust for team need
      const needMultiplier = this.calculateNeedMultiplier(player.position, team);
      maxBid *= needMultiplier;

      // Apply inflation
      const inflationRate = this.inflationTracker.getCurrentInflation();
      maxBid *= (1 + inflationRate);

      // Ensure we don't exceed budget constraints
      maxBid = Math.min(maxBid, spendableBudget);
      maxBid = Math.max(this.MIN_BID, Math.round(maxBid));

      maxBids.set(player.id, maxBid);
    }

    return maxBids;
  }

  /**
   * Calculate max bid for specific player
   */
  private calculateMaxBidForPlayer(
    player: Player,
    playerValue: PlayerValue,
    team: TeamState,
    auctionState: AuctionState
  ): number {
    const budget = auctionState.teamBudgets.get(team.teamId) || this.DEFAULT_BUDGET;
    const remainingSpots = this.calculateRemainingRosterSpots(team);
    const reserveBudget = (remainingSpots - 1) * this.ROSTER_BUFFER;
    const maxSpendable = Math.max(1, budget - reserveBudget);

    // Base value with inflation
    const inflationRate = this.inflationTracker.getCurrentInflation();
    let maxBid = (playerValue.auctionValue || 1) * (1 + inflationRate);

    // Adjust for scarcity
    const scarcity = this.scarcityModel.getScarcityForPosition(
      player.position,
      auctionState
    );
    if (scarcity && scarcity.scarcityIndex > 0.7) {
      maxBid *= 1.15;
    }

    // Adjust for team need
    const needMultiplier = this.calculateNeedMultiplier(player.position, team);
    maxBid *= needMultiplier;

    // Cap at available budget
    return Math.min(Math.round(maxBid), maxSpendable);
  }

  /**
   * Evaluate if we should bid on current player
   */
  private evaluateBidOpportunity(
    player: Player,
    currentBid: number,
    inflatedValue: number,
    maxBid: number,
    team: TeamState,
    auctionState: AuctionState
  ): { shouldBid: boolean; reasoning: string[] } {
    const reasoning: string[] = [];

    // Don't bid if over max
    if (currentBid >= maxBid) {
      reasoning.push(`Current bid ($${currentBid}) exceeds max bid ($${maxBid})`);
      return { shouldBid: false, reasoning };
    }

    // Check if it's a value
    const valueThreshold = inflatedValue * 0.85;
    if (currentBid < valueThreshold) {
      reasoning.push(`Good value: $${currentBid} < $${valueThreshold.toFixed(0)} threshold`);
      return { shouldBid: true, reasoning };
    }

    // Check position need
    const need = team.needs.find(n => n.position === player.position);
    if (need && need.priority > 0.7) {
      reasoning.push(`High need at ${player.position} (priority: ${need.priority.toFixed(2)})`);
      return { shouldBid: true, reasoning };
    }

    // Check for elite players
    const playerValue = this.valuator.getPlayerValue(player.id, new Set(), 1);
    if (playerValue && playerValue.tier <= 2) {
      reasoning.push(`Elite player (Tier ${playerValue.tier})`);
      return { shouldBid: true, reasoning };
    }

    // Default to not bidding if no compelling reason
    reasoning.push('No compelling reason to bid at this price');
    return { shouldBid: false, reasoning };
  }

  /**
   * Determine budget pacing strategy
   */
  private determineBudgetPacing(
    team: TeamState,
    auctionState: AuctionState
  ): 'aggressive' | 'balanced' | 'conservative' {
    const budget = auctionState.teamBudgets.get(team.teamId) || this.DEFAULT_BUDGET;
    const totalBudget = this.DEFAULT_BUDGET;
    const percentSpent = 1 - (budget / totalBudget);

    const filledSpots = team.roster.length;
    const totalSpots = this.leagueSettings.rosterSize;
    const percentFilled = filledSpots / totalSpots;

    // If we've spent less than we've filled, we're being conservative
    if (percentSpent < percentFilled - 0.1) {
      return 'aggressive'; // Need to spend more
    }

    // If we've spent more than we've filled, we're being aggressive
    if (percentSpent > percentFilled + 0.1) {
      return 'conservative'; // Need to slow down
    }

    return 'balanced';
  }

  /**
   * Calculate remaining roster spots
   */
  private calculateRemainingRosterSpots(team: TeamState): number {
    return this.leagueSettings.rosterSize - team.roster.length;
  }

  /**
   * Calculate value of already filled positions
   */
  private calculateFilledPositionValue(team: TeamState): number {
    return team.roster.reduce((total, playerId) => {
      const value = this.valuator.getPlayerValue(playerId, new Set(), 1);
      return total + (value?.auctionValue || 1);
    }, 0);
  }

  /**
   * Get current spend by position
   */
  private getPositionSpend(
    team: TeamState,
    position: string,
    auctionState: AuctionState
  ): number {
    // In a real implementation, track actual auction prices
    // For now, estimate based on player values
    return team.roster
      .filter(id => {
        const player = this.players.get(id);
        return player?.position === position;
      })
      .reduce((total, id) => {
        const value = this.valuator.getPlayerValue(id, new Set(), 1);
        return total + (value?.auctionValue || 1);
      }, 0);
  }

  /**
   * Get remaining position needs
   */
  private getPositionNeeds(team: TeamState, position: string): number {
    const requirements = this.leagueSettings.rosterRequirements[position];
    if (!requirements) return 0;

    const current = team.roster.filter(id => {
      const player = this.players.get(id);
      return player?.position === position;
    }).length;

    return Math.max(0, requirements.min - current);
  }

  /**
   * Calculate need multiplier for position
   */
  private calculateNeedMultiplier(position: string, team: TeamState): number {
    const need = team.needs.find(n => n.position === position);
    if (!need) return 1.0;

    if (need.priority > 0.8) return 1.3;
    if (need.priority > 0.6) return 1.15;
    if (need.priority > 0.4) return 1.0;
    return 0.85;
  }

  /**
   * Get available players
   */
  private getAvailablePlayers(auctionState: AuctionState): Player[] {
    const drafted = new Set(auctionState.picks.map(p => p.playerId));
    return Array.from(this.players.values())
      .filter(p => !drafted.has(p.id));
  }
}

/**
 * Track and calculate auction inflation
 */
class InflationTracker {
  private expectedSpend = 0;
  private actualSpend = 0;

  public updateInflation(auctionState: AuctionState): void {
    // Reset counters
    this.expectedSpend = 0;
    this.actualSpend = 0;

    // Calculate expected vs actual spend
    for (const bid of auctionState.bidHistory) {
      const playerValue = this.getPlayerExpectedValue(bid.playerId);
      this.expectedSpend += playerValue;
      this.actualSpend += bid.amount;
    }
  }

  public getCurrentInflation(): number {
    if (this.expectedSpend === 0) return 0;
    return (this.actualSpend - this.expectedSpend) / this.expectedSpend;
  }

  private getPlayerExpectedValue(playerId: string): number {
    // In production, use historical auction values
    // For now, return a mock value
    return Math.floor(Math.random() * 50) + 1;
  }
}

/**
 * Allocate budget across positions optimally
 */
class BudgetAllocator {
  constructor(private leagueSettings: LeagueSettings) {}

  public allocateBudget(
    totalBudget: number,
    teamNeeds: any[]
  ): Record<string, number> {
    // Implement optimal budget allocation algorithm
    // This is simplified for the example
    const allocation: Record<string, number> = {
      QB: totalBudget * 0.08,
      RB: totalBudget * 0.35,
      WR: totalBudget * 0.35,
      TE: totalBudget * 0.07,
      K: totalBudget * 0.02,
      DST: totalBudget * 0.03,
      BENCH: totalBudget * 0.10
    };

    return allocation;
  }
}

/**
 * Determine optimal player nomination strategy
 */
class NominationStrategy {
  constructor(
    private players: PlayerMap,
    private projections: ProjectionMap
  ) {}

  public getPriorityList(
    auctionState: AuctionState,
    myTeam: TeamState,
    maxBids: Map<string, number>
  ): string[] {
    const availablePlayers = this.getAvailablePlayers(auctionState);
    const nominations: { playerId: string; score: number }[] = [];

    for (const player of availablePlayers) {
      const score = this.scoreNomination(player, myTeam, maxBids, auctionState);
      nominations.push({ playerId: player.id, score });
    }

    // Sort by nomination score
    nominations.sort((a, b) => b.score - a.score);

    return nominations.map(n => n.playerId);
  }

  private scoreNomination(
    player: Player,
    myTeam: TeamState,
    maxBids: Map<string, number>,
    auctionState: AuctionState
  ): number {
    let score = 0;

    // Nominate players we don't want but others will overpay for
    const myMaxBid = maxBids.get(player.id) || 0;
    const projection = this.projections.get(player.id);
    
    if (!projection) return 0;

    // High-value players we don't need
    if (projection.projectedPoints > 200 && myMaxBid < 20) {
      score += 100;
    }

    // Players at positions we're already strong
    const need = myTeam.needs.find(n => n.position === player.position);
    if (need && need.priority < 0.3) {
      score += 50;
    }

    // Popular players that will drain budgets
    if (player.team && ['KC', 'BUF', 'SF'].includes(player.team)) {
      score += 30;
    }

    // Early round: nominate expensive players
    const percentComplete = auctionState.picks.length / 
      (auctionState.teams.size * auctionState.leagueSettings.rosterSize);
    
    if (percentComplete < 0.3) {
      score += projection.projectedPoints / 5;
    }

    return score;
  }

  private getAvailablePlayers(auctionState: AuctionState): Player[] {
    const drafted = new Set(auctionState.picks.map(p => p.playerId));
    return Array.from(this.players.values())
      .filter(p => !drafted.has(p.id));
  }
}

/**
 * Smart bidding strategy
 */
class BiddingStrategy {
  public shouldBid(
    currentBid: number,
    maxBid: number,
    playersRemaining: number,
    budgetRemaining: number
  ): boolean {
    // Don't bid over max
    if (currentBid >= maxBid) return false;

    // Be more aggressive early
    if (playersRemaining > 100 && currentBid < maxBid * 0.8) {
      return true;
    }

    // Be conservative late
    if (playersRemaining < 50 && currentBid > maxBid * 0.9) {
      return false;
    }

    return currentBid < maxBid;
  }
}
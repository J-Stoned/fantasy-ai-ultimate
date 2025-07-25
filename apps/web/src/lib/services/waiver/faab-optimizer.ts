import { createClient } from '@supabase/supabase-js';
import { logger } from '../../logging/logger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface WaiverClaim {
  playerId: string;
  playerName?: string;
  position?: string;
  priority: number;
  currentBid: number;
  projectedValue: number;
  successProbability?: number;
  competitorBids?: number[];
}

export interface OptimizedBid {
  playerId: string;
  optimalBid: number;
  successProbability: number;
  expectedValue: number;
  reasoning: string[];
}

export interface BidOptimizationResult {
  [playerId: string]: OptimizedBid;
}

export type BiddingStrategy = 'conservative' | 'balanced' | 'aggressive';

export class FAABOptimizer {
  
  /**
   * Optimize FAAB bids for maximum expected value
   */
  async optimizeBids(
    claims: WaiverClaim[],
    budget: number,
    strategy: BiddingStrategy = 'balanced',
    leagueId?: string
  ): Promise<BidOptimizationResult> {
    
    try {
      // Get market data for each player
      const marketData = await this.getMarketData(claims.map(c => c.playerId), leagueId);
      
      // Calculate optimal bids for each claim
      const optimizedBids: BidOptimizationResult = {};
      
      for (const claim of claims) {
        const market = marketData[claim.playerId];
        const optimized = await this.calculateOptimalBid(
          claim,
          market,
          budget,
          strategy
        );
        
        optimizedBids[claim.playerId] = optimized;
      }

      // Apply portfolio optimization to ensure budget constraint
      return this.applyPortfolioOptimization(optimizedBids, claims, budget);

    } catch (error) {
      logger.error('Error optimizing FAAB bids:', { error: error });
      throw error;
    }
  }

  /**
   * Get market data for players
   */
  private async getMarketData(playerIds: string[], leagueId?: string): Promise<{ [playerId: string]: any }> {
    
    // Get historical FAAB bid data
    const { data: bidHistory, error: bidError } = await supabase
      .from('waiver_bids')
      .select(`
        player_id,
        bid_amount,
        won,
        league_type,
        week
      `)
      .in('player_id', playerIds)
      .gte('week', new Date().getWeek() - 8) // Last 8 weeks
      .order('week', { ascending: false });

    if (bidError) logger.error('Error fetching bid history:', { error: bidError });

    // Get player ownership and trend data
    const { data: playerData, error: playerError } = await supabase
      .from('fantasy_players')
      .select(`
        id,
        ownership_percentage,
        trend_score,
        add_percentage,
        drop_percentage,
        projected_points
      `)
      .in('id', playerIds);

    if (playerError) logger.error('Error fetching player data:', { error: playerError });

    // Process market data
    const marketData: { [playerId: string]: any } = {};
    
    playerIds.forEach(playerId => {
      const playerBids = bidHistory?.filter(bid => bid.player_id === playerId) || [];
      const player = playerData?.find(p => p.id === playerId);
      
      marketData[playerId] = {
        averageBid: this.calculateAverageBid(playerBids),
        winningBids: playerBids.filter(bid => bid.won).map(bid => bid.bid_amount),
        losingBids: playerBids.filter(bid => !bid.won).map(bid => bid.bid_amount),
        ownershipPercentage: player?.ownership_percentage || 0,
        addPercentage: player?.add_percentage || 0,
        trendScore: player?.trend_score || 50,
        projectedPoints: player?.projected_points || 0,
        bidDistribution: this.calculateBidDistribution(playerBids),
        demandScore: this.calculateDemandScore(player)
      };
    });

    return marketData;
  }

  /**
   * Calculate optimal bid for a single player
   */
  private async calculateOptimalBid(
    claim: WaiverClaim,
    marketData: any,
    budget: number,
    strategy: BiddingStrategy
  ): Promise<OptimizedBid> {
    
    const { playerId } = claim;
    
    // Base bid calculation using historical data
    const baseBid = this.calculateBaseBid(marketData, strategy);
    
    // Adjust for competition level
    const competitionAdjustment = this.calculateCompetitionAdjustment(marketData);
    
    // Adjust for player value
    const valueAdjustment = this.calculateValueAdjustment(claim, marketData);
    
    // Adjust for urgency (priority)
    const urgencyAdjustment = this.calculateUrgencyAdjustment(claim.priority, strategy);
    
    // Combine adjustments
    let optimalBid = Math.round(baseBid * competitionAdjustment * valueAdjustment * urgencyAdjustment);
    
    // Apply strategy-specific caps
    const strategyCap = this.getStrategyCap(budget, strategy);
    optimalBid = Math.min(optimalBid, strategyCap);
    
    // Calculate success probability
    const successProbability = this.calculateSuccessProbability(optimalBid, marketData);
    
    // Calculate expected value
    const expectedValue = successProbability * claim.projectedValue * (optimalBid / 100);
    
    // Generate reasoning
    const reasoning = this.generateBidReasoning(
      claim,
      marketData,
      optimalBid,
      successProbability,
      strategy
    );

    return {
      playerId,
      optimalBid,
      successProbability,
      expectedValue,
      reasoning
    };
  }

  /**
   * Calculate base bid from market data
   */
  private calculateBaseBid(marketData: any, strategy: BiddingStrategy): number {
    const { averageBid, winningBids } = marketData;
    
    if (winningBids.length === 0) {
      // No historical data, use ownership-based estimation
      return Math.max(1, Math.min(25, marketData.ownershipPercentage / 2));
    }

    const recentWinningBids = winningBids.slice(0, 5); // Last 5 winning bids
    const averageWinningBid = recentWinningBids.reduce((a, b) => a + b, 0) / recentWinningBids.length;

    // Strategy adjustments
    const strategyMultipliers = {
      conservative: 0.85,
      balanced: 1.0,
      aggressive: 1.15
    };

    return Math.round(averageWinningBid * strategyMultipliers[strategy]);
  }

  /**
   * Calculate competition adjustment multiplier
   */
  private calculateCompetitionAdjustment(marketData: any): number {
    const { addPercentage, demandScore } = marketData;
    
    // High add percentage indicates more competition
    let adjustment = 1.0;
    
    if (addPercentage > 30) adjustment += 0.3; // High competition
    else if (addPercentage > 15) adjustment += 0.15; // Medium competition
    else if (addPercentage < 5) adjustment -= 0.15; // Low competition
    
    // Factor in overall demand
    adjustment += (demandScore - 50) / 200; // -0.25 to +0.25
    
    return Math.max(0.5, Math.min(2.0, adjustment));
  }

  /**
   * Calculate value adjustment multiplier
   */
  private calculateValueAdjustment(claim: WaiverClaim, marketData: any): number {
    const projectedValue = claim.projectedValue || marketData.projectedPoints;
    const marketPrice = marketData.averageBid;
    
    if (marketPrice === 0) return 1.0;
    
    const valueRatio = projectedValue / marketPrice;
    
    // If player offers good value, bid more aggressively
    if (valueRatio > 2.0) return 1.3; // Excellent value
    if (valueRatio > 1.5) return 1.15; // Good value
    if (valueRatio < 0.7) return 0.85; // Poor value
    if (valueRatio < 0.5) return 0.7; // Very poor value
    
    return 1.0; // Fair value
  }

  /**
   * Calculate urgency adjustment based on priority
   */
  private calculateUrgencyAdjustment(priority: number, strategy: BiddingStrategy): number {
    // Higher priority (lower number) = more urgency
    const baseUrgency = Math.max(0.8, 1.5 - (priority * 0.1));
    
    const strategyMultipliers = {
      conservative: 0.9,
      balanced: 1.0,
      aggressive: 1.1
    };

    return baseUrgency * strategyMultipliers[strategy];
  }

  /**
   * Get strategy-specific budget cap
   */
  private getStrategyCap(budget: number, strategy: BiddingStrategy): number {
    const caps = {
      conservative: budget * 0.15, // Max 15% on any player
      balanced: budget * 0.25, // Max 25% on any player
      aggressive: budget * 0.4 // Max 40% on any player
    };

    return Math.round(caps[strategy]);
  }

  /**
   * Calculate success probability for a given bid
   */
  private calculateSuccessProbability(bid: number, marketData: any): number {
    const { winningBids, losingBids } = marketData;
    
    if (winningBids.length === 0 && losingBids.length === 0) {
      // No data available, estimate based on ownership
      const ownership = marketData.ownershipPercentage || 0;
      if (ownership < 10) return 0.8; // Low competition
      if (ownership < 25) return 0.6; // Medium competition
      return 0.4; // High competition
    }

    const allBids = [...winningBids, ...losingBids];
    const winCount = winningBids.filter(wb => bid >= wb).length;
    const loseCount = losingBids.filter(lb => bid <= lb).length;
    
    const totalRelevantBids = winCount + loseCount;
    
    if (totalRelevantBids === 0) {
      // Bid is outside historical range
      if (bid > Math.max(...allBids)) return 0.9;
      if (bid < Math.min(...allBids)) return 0.1;
    }

    return Math.max(0.05, Math.min(0.95, winCount / totalRelevantBids));
  }

  /**
   * Apply portfolio optimization to ensure budget constraints
   */
  private applyPortfolioOptimization(
    optimizedBids: BidOptimizationResult,
    claims: WaiverClaim[],
    budget: number
  ): BidOptimizationResult {
    
    const totalOptimalBids = Object.values(optimizedBids).reduce((sum, bid) => sum + bid.optimalBid, 0);
    
    if (totalOptimalBids <= budget) {
      return optimizedBids; // No adjustment needed
    }

    // Scale down bids proportionally, prioritizing by expected value
    const sortedClaims = claims.sort((a, b) => {
      const aExpected = optimizedBids[a.playerId]?.expectedValue || 0;
      const bExpected = optimizedBids[b.playerId]?.expectedValue || 0;
      return bExpected - aExpected;
    });

    let remainingBudget = budget;
    const adjustedBids = { ...optimizedBids };

    // Allocate budget by priority/expected value
    for (const claim of sortedClaims) {
      const originalBid = optimizedBids[claim.playerId];
      if (!originalBid) continue;

      const maxAffordable = Math.min(originalBid.optimalBid, remainingBudget);
      
      adjustedBids[claim.playerId] = {
        ...originalBid,
        optimalBid: maxAffordable,
        reasoning: [
          ...originalBid.reasoning,
          maxAffordable < originalBid.optimalBid ? 
            `Reduced from $${originalBid.optimalBid} due to budget constraints` : ''
        ].filter(Boolean)
      };

      remainingBudget -= maxAffordable;
      
      if (remainingBudget <= 0) break;
    }

    return adjustedBids;
  }

  /**
   * Calculate average bid from historical data
   */
  private calculateAverageBid(bids: any[]): number {
    if (bids.length === 0) return 0;
    return bids.reduce((sum, bid) => sum + bid.bid_amount, 0) / bids.length;
  }

  /**
   * Calculate bid distribution for probability modeling
   */
  private calculateBidDistribution(bids: any[]): { [range: string]: number } {
    const distribution = {
      '$1-5': 0,
      '$6-10': 0,
      '$11-20': 0,
      '$21-35': 0,
      '$36+': 0
    };

    bids.forEach(bid => {
      const amount = bid.bid_amount;
      if (amount <= 5) distribution['$1-5']++;
      else if (amount <= 10) distribution['$6-10']++;
      else if (amount <= 20) distribution['$11-20']++;
      else if (amount <= 35) distribution['$21-35']++;
      else distribution['$36+']++;
    });

    return distribution;
  }

  /**
   * Calculate demand score for a player
   */
  private calculateDemandScore(player: any): number {
    if (!player) return 50;
    
    let score = 50;
    
    // High add percentage = high demand
    score += (player.add_percentage || 0) * 2;
    
    // High trend score = increasing demand
    score += (player.trend_score - 50) * 0.5;
    
    // Low ownership with high projections = undervalued
    const valueRatio = (player.projected_points || 0) / Math.max(1, player.ownership_percentage || 1);
    score += Math.min(25, valueRatio * 5);
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Generate reasoning for bid recommendation
   */
  private generateBidReasoning(
    claim: WaiverClaim,
    marketData: any,
    optimalBid: number,
    successProbability: number,
    strategy: BiddingStrategy
  ): string[] {
    const reasoning: string[] = [];
    
    // Market analysis
    if (marketData.averageBid > 0) {
      const comparison = optimalBid / marketData.averageBid;
      if (comparison > 1.2) {
        reasoning.push(`Aggressive bid vs. ${marketData.averageBid.toFixed(0)} average market price`);
      } else if (comparison < 0.8) {
        reasoning.push(`Conservative bid vs. ${marketData.averageBid.toFixed(0)} average market price`);
      } else {
        reasoning.push(`Market-rate bid based on ${marketData.averageBid.toFixed(0)} average price`);
      }
    }

    // Success probability
    if (successProbability > 0.8) {
      reasoning.push(`High success probability (${(successProbability * 100).toFixed(0)}%)`);
    } else if (successProbability < 0.4) {
      reasoning.push(`Lower success probability (${(successProbability * 100).toFixed(0)}%) due to competition`);
    }

    // Competition analysis
    if (marketData.addPercentage > 25) {
      reasoning.push(`High competition (${marketData.addPercentage.toFixed(0)}% add rate)`);
    } else if (marketData.addPercentage < 10) {
      reasoning.push(`Low competition (${marketData.addPercentage.toFixed(0)}% add rate)`);
    }

    // Priority consideration
    if (claim.priority <= 2) {
      reasoning.push(`High priority target - increased bid recommended`);
    }

    // Strategy explanation
    const strategyExplanation = {
      conservative: 'Conservative strategy - preserving budget for future needs',
      balanced: 'Balanced strategy - competitive but sustainable bidding',
      aggressive: 'Aggressive strategy - prioritizing immediate impact'
    };
    
    reasoning.push(strategyExplanation[strategy]);

    return reasoning;
  }

  /**
   * Get bid recommendations for a specific budget percentage strategy
   */
  async getBidRecommendationsByBudget(
    totalBudget: number,
    highPriorityPlayers: string[],
    mediumPriorityPlayers: string[],
    lowPriorityPlayers: string[]
  ): Promise<{ allocation: { [category: string]: number }, recommendations: string[] }> {
    
    const allocation = {
      highPriority: totalBudget * 0.5, // 50% for must-haves
      mediumPriority: totalBudget * 0.3, // 30% for solid adds
      lowPriority: totalBudget * 0.15, // 15% for depth/upside
      emergency: totalBudget * 0.05 // 5% emergency fund
    };

    const recommendations = [
      `Allocate $${allocation.highPriority} (50%) for ${highPriorityPlayers.length} high-priority targets`,
      `Reserve $${allocation.mediumPriority} (30%) for ${mediumPriorityPlayers.length} medium-priority adds`,
      `Use $${allocation.lowPriority} (15%) for ${lowPriorityPlayers.length} depth/upside plays`,
      `Keep $${allocation.emergency} (5%) for emergency situations`,
      `Avoid bidding more than 25% of budget on any single player`,
      `Consider saving 30-40% of budget for playoff-critical adds`
    ];

    return { allocation, recommendations };
  }
}

export const faabOptimizer = new FAABOptimizer();
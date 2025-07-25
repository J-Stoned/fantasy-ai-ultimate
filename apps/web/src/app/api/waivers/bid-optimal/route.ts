import { NextRequest, NextResponse } from 'next/server';
import { faabOptimizer } from '../../../../lib/services/waiver/faab-optimizer';
import { logger } from '../../../../lib/logging/logger';

/**
 * POST /api/waivers/bid-optimal
 * Calculate optimal FAAB bids for waiver claims
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { claims, budget, strategy = 'balanced', leagueId } = body;

    if (!claims || !Array.isArray(claims) || claims.length === 0) {
      return NextResponse.json(
        { error: 'Claims array is required' },
        { status: 400 }
      );
    }

    if (!budget || budget <= 0) {
      return NextResponse.json(
        { error: 'Valid budget is required' },
        { status: 400 }
      );
    }

    // Transform claims to the expected format
    const formattedClaims = claims.map(claim => ({
      playerId: claim.playerId,
      playerName: claim.playerName,
      position: claim.position,
      priority: claim.priority,
      currentBid: claim.currentBid || 1,
      projectedValue: claim.projectedValue || 10,
      successProbability: claim.successProbability,
      competitorBids: claim.competitorBids || []
    }));

    // Get optimal bids
    const optimizedBids = await faabOptimizer.optimizeBids(
      formattedClaims,
      budget,
      strategy,
      leagueId
    );

    // Add summary statistics
    const totalOptimalBids = Object.values(optimizedBids).reduce(
      (sum, bid) => sum + bid.optimalBid, 0
    );

    const averageSuccessRate = Object.values(optimizedBids).reduce(
      (sum, bid) => sum + bid.successProbability, 0
    ) / Object.keys(optimizedBids).length;

    const totalExpectedValue = Object.values(optimizedBids).reduce(
      (sum, bid) => sum + bid.expectedValue, 0
    );

    const response = {
      optimizedBids,
      summary: {
        totalBudget: budget,
        totalOptimalBids,
        remainingBudget: budget - totalOptimalBids,
        budgetUtilization: (totalOptimalBids / budget) * 100,
        averageSuccessRate: averageSuccessRate * 100,
        totalExpectedValue,
        strategy,
        claimsOptimized: Object.keys(optimizedBids).length
      },
      recommendations: [
        totalOptimalBids > budget * 0.9 
          ? 'High budget utilization - consider reducing some bids'
          : totalOptimalBids < budget * 0.3
          ? 'Low budget utilization - consider more aggressive bidding'
          : 'Good budget allocation balance',
        
        averageSuccessRate < 0.4
          ? 'Low success probability - consider increasing bids on high-priority targets'
          : averageSuccessRate > 0.8
          ? 'Very high success probability - you may be overbidding'
          : 'Reasonable success probability across claims',
          
        strategy === 'conservative'
          ? 'Conservative strategy - preserving budget for future opportunities'
          : strategy === 'aggressive'
          ? 'Aggressive strategy - maximizing immediate impact'
          : 'Balanced strategy - sustainable competitive bidding'
      ]
    };

    return NextResponse.json(response);

  } catch (error) {
    logger.error('Error optimizing FAAB bids:', { error: error });
    return NextResponse.json(
      { error: 'Failed to optimize FAAB bids' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/waivers/bid-optimal/recommendations
 * Get general FAAB bidding recommendations
 */
export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const budget = parseInt(searchParams.get('budget') || '100');
    const week = parseInt(searchParams.get('week') || '12');
    const strategy = searchParams.get('strategy') || 'balanced';

    // Calculate budget allocation recommendations
    const recommendations = await faabOptimizer.getBidRecommendationsByBudget(
      budget,
      ['player1', 'player2'], // High priority
      ['player3', 'player4', 'player5'], // Medium priority  
      ['player6', 'player7'] // Low priority
    );

    // Add week-specific advice
    const weekSpecificAdvice = [];
    
    if (week <= 6) {
      weekSpecificAdvice.push('Early season: Be aggressive on breakout candidates');
      weekSpecificAdvice.push('Focus on high-upside players with unclear roles');
    } else if (week <= 10) {
      weekSpecificAdvice.push('Mid-season: Target consistent contributors');
      weekSpecificAdvice.push('Consider bye week coverage needs');
    } else if (week <= 14) {
      weekSpecificAdvice.push('Late season: Prioritize playoff-relevant players');
      weekSpecificAdvice.push('Save budget for injury replacements');
    } else {
      weekSpecificAdvice.push('Playoff time: All-in on must-have adds');
      weekSpecificAdvice.push('Spend remaining budget on potential league winners');
    }

    // Strategy-specific tips
    const strategyTips = {
      conservative: [
        'Bid 5-15% of budget on most targets',
        'Never exceed 25% on any single player',
        'Save 40% of budget for second half of season',
        'Focus on consistent floor over ceiling'
      ],
      balanced: [
        'Bid 10-25% on high-priority targets',
        'Use 15-30% for must-have league winners',
        'Maintain 25-35% emergency fund',
        'Balance floor and ceiling considerations'
      ],
      aggressive: [
        'Bid 20-40% on potential league winners',
        'Don\'t hesitate to spend big early',
        'Use 60-70% of budget in first half',
        'Prioritize ceiling over floor'
      ]
    };

    const response = {
      budgetAllocation: recommendations.allocation,
      generalRecommendations: recommendations.recommendations,
      weekSpecificAdvice,
      strategyTips: strategyTips[strategy as keyof typeof strategyTips] || strategyTips.balanced,
      marketInsights: [
        'Average winning bid across all leagues: $12-18',
        'Breakout candidates typically go for $15-30',
        'Handcuff RBs average $8-15 in competitive leagues',
        'Late-season pickups often require $20+ due to urgency'
      ],
      commonMistakes: [
        'Bidding $1 on players you actually want',
        'Saving too much budget for "the perfect add"',
        'Not accounting for league-specific bidding patterns',
        'Ignoring positional scarcity when bidding',
        'Bidding same amount regardless of priority level'
      ]
    };

    return NextResponse.json(response, {
      headers: {
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=7200'
      }
    });

  } catch (error) {
    logger.error('Error getting bid recommendations:', { error: error });
    return NextResponse.json(
      { error: 'Failed to get bid recommendations' },
      { status: 500 }
    );
  }
}
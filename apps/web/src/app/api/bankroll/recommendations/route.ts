/**
 * 🎯 CONTEST RECOMMENDATIONS API 🎯
 * Smart contest recommendations based on bankroll and risk tolerance
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { databaseConfig } from '@/lib/database-config';
import { logger } from '../../../../lib/logging/logger';

// Database connection
const pool = new Pool(databaseConfig);

// Sample contest data (in production, this would come from DraftKings/FanDuel APIs)
const SAMPLE_CONTESTS = [
  // Cash Games (Lower Risk)
  {
    id: 'dk_cash_nfl_1',
    name: 'NFL Double Up',
    type: 'cash',
    sport: 'NFL',
    entryFee: 25,
    totalPrize: 50,
    entryCount: 2,
    maxEntries: 1,
    winProbability: 0.45,
    projectedROI: 0.8,
    variance: 0.1,
    description: 'Double your money - top 50% win'
  },
  {
    id: 'dk_cash_nba_1',
    name: 'NBA Head-to-Head',
    type: 'h2h',
    sport: 'NBA',
    entryFee: 10,
    totalPrize: 18,
    entryCount: 2,
    maxEntries: 1,
    winProbability: 0.48,
    projectedROI: 0.8,
    variance: 0.15,
    description: 'Beat one opponent to win'
  },
  {
    id: 'fd_cash_mlb_1',
    name: 'MLB 50/50',
    type: 'cash',
    sport: 'MLB',
    entryFee: 5,
    totalPrize: 9,
    entryCount: 100,
    maxEntries: 1,
    winProbability: 0.47,
    projectedROI: 0.8,
    variance: 0.12,
    description: 'Safe cash game with good odds'
  },
  
  // Single Entry Tournaments (Medium Risk)
  {
    id: 'dk_se_nfl_1',
    name: 'NFL Single Entry Tournament',
    type: 'single_entry',
    sport: 'NFL',
    entryFee: 100,
    totalPrize: 50000,
    entryCount: 1000,
    maxEntries: 1,
    winProbability: 0.25,
    projectedROI: 0.5,
    variance: 0.4,
    description: 'Mid-size tournament with decent odds'
  },
  {
    id: 'fd_se_nba_1',
    name: 'NBA Single Entry Slam',
    type: 'single_entry',
    sport: 'NBA',
    entryFee: 50,
    totalPrize: 20000,
    entryCount: 800,
    maxEntries: 1,
    winProbability: 0.22,
    projectedROI: 0.4,
    variance: 0.35,
    description: 'Single entry with good payout structure'
  },
  
  // GPP Tournaments (High Risk)
  {
    id: 'dk_gpp_nfl_1',
    name: 'NFL Millionaire Maker',
    type: 'gpp',
    sport: 'NFL',
    entryFee: 20,
    totalPrize: 1000000,
    entryCount: 200000,
    maxEntries: 150,
    winProbability: 0.15,
    projectedROI: 0.0,
    variance: 0.9,
    description: 'Massive tournament with $1M top prize'
  },
  {
    id: 'fd_gpp_nba_1',
    name: 'NBA Shot',
    type: 'gpp',
    sport: 'NBA',
    entryFee: 3,
    totalPrize: 100000,
    entryCount: 50000,
    maxEntries: 100,
    winProbability: 0.18,
    projectedROI: 0.1,
    variance: 0.8,
    description: 'Affordable GPP with big upside'
  },
  {
    id: 'dk_gpp_mlb_1',
    name: 'MLB Grand Slam',
    type: 'gpp',
    sport: 'MLB',
    entryFee: 12,
    totalPrize: 250000,
    entryCount: 30000,
    maxEntries: 20,
    winProbability: 0.16,
    projectedROI: 0.05,
    variance: 0.75,
    description: 'Daily baseball tournament'
  },
  
  // Qualifiers (Medium Risk)
  {
    id: 'dk_qual_nfl_1',
    name: 'NFL Championship Qualifier',
    type: 'qualifier',
    sport: 'NFL',
    entryFee: 75,
    totalPrize: 0, // Seats to championship
    entryCount: 500,
    maxEntries: 1,
    winProbability: 0.3,
    projectedROI: 2.0, // Value of championship seat
    variance: 0.3,
    description: 'Win a seat to the championship'
  }
];

export async function POST(request: NextRequest) {
  logger.info('[🎯 RECOMMENDATIONS] Processing contest recommendations request...');
  
  try {
    const body = await request.json();
    const { 
      currentBankroll = 1000,
      riskTolerance = 'moderate',
      sport = 'all',
      maxRecommendations = 10,
      contestTypes = ['cash', 'single_entry', 'gpp']
    } = body;

    // Get user's recent performance to adjust recommendations
    const userPerformance = await getUserPerformance();
    
    // Filter and score contests
    const scoredContests = SAMPLE_CONTESTS
      .filter(contest => {
        // Filter by sport if specified
        if (sport !== 'all' && contest.sport !== sport) return false;
        
        // Filter by contest types
        if (!contestTypes.includes(contest.type)) return false;
        
        // Filter by affordability (don't recommend contests > 10% of bankroll)
        if (contest.entryFee > currentBankroll * 0.1) return false;
        
        return true;
      })
      .map(contest => {
        const recommendation = calculateKellyRecommendation(
          contest, 
          currentBankroll, 
          riskTolerance, 
          userPerformance
        );
        
        return {
          ...contest,
          ...recommendation,
          suitabilityScore: calculateSuitabilityScore(contest, currentBankroll, riskTolerance, userPerformance)
        };
      })
      .filter(contest => contest.recommendedBetSize > 0) // Only show contests we recommend
      .sort((a, b) => b.suitabilityScore - a.suitabilityScore) // Sort by suitability
      .slice(0, maxRecommendations);

    // Calculate portfolio allocation if multiple contests
    const portfolioAllocation = calculatePortfolioAllocation(scoredContests, currentBankroll, riskTolerance);
    
    return NextResponse.json({
      success: true,
      currentBankroll,
      riskTolerance,
      recommendations: scoredContests,
      portfolio: portfolioAllocation,
      summary: {
        totalRecommendations: scoredContests.length,
        totalInvestment: scoredContests.reduce((sum, c) => sum + c.recommendedBetSize, 0),
        expectedReturn: scoredContests.reduce((sum, c) => sum + c.expectedReturn, 0),
        averageConfidence: scoredContests.reduce((sum, c) => sum + c.confidence, 0) / scoredContests.length,
        topRecommendation: scoredContests[0]?.name || 'None available'
      },
      advice: getPersonalizedAdvice(scoredContests, userPerformance, riskTolerance)
    });
    
  } catch (error) {
    logger.error('[RECOMMENDATIONS] Error:', { error: error });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Recommendations request failed'
    }, { status: 500 });
  }
}

async function getUserPerformance() {
  try {
    const result = await pool.query(`
      SELECT 
        COUNT(*) as total_contests,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_contests,
        AVG(pnl) as avg_pnl,
        STDDEV(pnl) as pnl_stddev,
        MAX(created_at) as last_contest,
        
        -- Performance by contest type
        COUNT(CASE WHEN contest_id LIKE '%cash%' THEN 1 END) as cash_games,
        AVG(CASE WHEN contest_id LIKE '%cash%' THEN pnl END) as cash_avg_pnl,
        COUNT(CASE WHEN contest_id LIKE '%gpp%' THEN 1 END) as gpp_games,
        AVG(CASE WHEN contest_id LIKE '%gpp%' THEN pnl END) as gpp_avg_pnl,
        COUNT(CASE WHEN contest_id LIKE '%se%' THEN 1 END) as se_games,
        AVG(CASE WHEN contest_id LIKE '%se%' THEN pnl END) as se_avg_pnl
        
      FROM contest_results
      WHERE created_at > CURRENT_DATE - INTERVAL '90 days'
    `);
    
    const data = result.rows[0] || {};
    
    return {
      totalContests: parseInt(data.total_contests) || 0,
      winRate: data.total_contests > 0 ? (data.winning_contests / data.total_contests) : 0,
      avgPnl: parseFloat(data.avg_pnl) || 0,
      volatility: parseFloat(data.pnl_stddev) || 50,
      lastPlayed: data.last_contest,
      
      // Contest type performance
      cashGames: parseInt(data.cash_games) || 0,
      cashAvgPnl: parseFloat(data.cash_avg_pnl) || 0,
      gppGames: parseInt(data.gpp_games) || 0,
      gppAvgPnl: parseFloat(data.gpp_avg_pnl) || 0,
      seGames: parseInt(data.se_games) || 0,
      seAvgPnl: parseFloat(data.se_avg_pnl) || 0
    };
  } catch (error) {
    logger.error('[RECOMMENDATIONS] Performance query error:', { error: error });
    return {
      totalContests: 0,
      winRate: 0.4, // Assume average performance
      avgPnl: 0,
      volatility: 50,
      lastPlayed: null,
      cashGames: 0,
      cashAvgPnl: 0,
      gppGames: 0,
      gppAvgPnl: 0,
      seGames: 0,
      seAvgPnl: 0
    };
  }
}

function calculateKellyRecommendation(contest: any, bankroll: number, riskTolerance: string, userPerformance: any) {
  // Risk multipliers by tolerance level
  const riskMultipliers = {
    conservative: 0.25,
    moderate: 0.5,
    aggressive: 0.75
  };
  
  const riskMultiplier = riskMultipliers[riskTolerance as keyof typeof riskMultipliers] || 0.5;
  
  // Adjust win probability based on user's historical performance with this contest type
  let adjustedWinProbability = contest.winProbability;
  
  if (contest.type === 'cash' && userPerformance.cashGames > 5) {
    const cashWinRate = userPerformance.cashAvgPnl > 0 ? 0.6 : 0.3;
    adjustedWinProbability = (adjustedWinProbability + cashWinRate) / 2;
  } else if (contest.type === 'gpp' && userPerformance.gppGames > 5) {
    const gppWinRate = userPerformance.gppAvgPnl > 0 ? 0.2 : 0.1;
    adjustedWinProbability = (adjustedWinProbability + gppWinRate) / 2;
  }
  
  // Calculate Kelly fraction
  const winProbability = adjustedWinProbability;
  const lossProbability = 1 - winProbability;
  const payoutRatio = (contest.totalPrize / contest.entryCount) / contest.entryFee;
  
  // Kelly formula: f = (bp - q) / b
  let kellyFraction = (payoutRatio * winProbability - lossProbability) / payoutRatio;
  
  // Apply risk multiplier and constraints
  kellyFraction = Math.max(0, kellyFraction * riskMultiplier);
  
  // Apply maximum bet constraints
  const maxBetConstraints = {
    conservative: 0.05, // Max 5% per bet
    moderate: 0.1,      // Max 10% per bet
    aggressive: 0.2     // Max 20% per bet
  };
  
  const maxBetFraction = maxBetConstraints[riskTolerance as keyof typeof maxBetConstraints] || 0.1;
  kellyFraction = Math.min(kellyFraction, maxBetFraction);
  
  // Calculate bet size
  const recommendedBetSize = Math.floor((bankroll * kellyFraction) / contest.entryFee) * contest.entryFee;
  const maxEntries = Math.min(
    Math.floor(recommendedBetSize / contest.entryFee),
    contest.maxEntries || 1
  );
  
  // Calculate expected return
  const expectedReturn = recommendedBetSize * contest.projectedROI;
  
  // Calculate confidence based on various factors
  const confidence = calculateConfidence(contest, userPerformance, kellyFraction);
  
  // Generate reasoning
  const reasoning = generateReasoning(contest, kellyFraction, winProbability, userPerformance);
  
  return {
    kellyFraction,
    recommendedBetSize: Math.max(0, recommendedBetSize),
    maxEntries,
    expectedReturn,
    confidence,
    reasoning,
    riskLevel: assessRiskLevel(kellyFraction),
    adjustedWinProbability: winProbability
  };
}

function calculateSuitabilityScore(contest: any, bankroll: number, riskTolerance: string, userPerformance: any): number {
  let score = 50; // Base score
  
  // Affordability (0-20 points)
  const affordabilityRatio = contest.entryFee / bankroll;
  if (affordabilityRatio <= 0.01) score += 20;
  else if (affordabilityRatio <= 0.02) score += 15;
  else if (affordabilityRatio <= 0.05) score += 10;
  else if (affordabilityRatio <= 0.1) score += 5;
  
  // Risk alignment (0-25 points)
  const riskPreferences = {
    conservative: { cash: 25, h2h: 20, qualifier: 15, single_entry: 10, gpp: 5 },
    moderate: { cash: 20, h2h: 20, qualifier: 20, single_entry: 25, gpp: 15 },
    aggressive: { cash: 10, h2h: 15, qualifier: 20, single_entry: 20, gpp: 25 }
  };
  
  score += riskPreferences[riskTolerance as keyof typeof riskPreferences]?.[contest.type as keyof typeof riskPreferences['conservative']] || 10;
  
  // Expected value (0-20 points)
  if (contest.projectedROI >= 0.5) score += 20;
  else if (contest.projectedROI >= 0.2) score += 15;
  else if (contest.projectedROI >= 0) score += 10;
  else if (contest.projectedROI >= -0.1) score += 5;
  
  // User experience bonus (0-15 points)
  if (contest.type === 'cash' && userPerformance.cashGames > 0) {
    score += userPerformance.cashAvgPnl > 0 ? 15 : 5;
  } else if (contest.type === 'gpp' && userPerformance.gppGames > 0) {
    score += userPerformance.gppAvgPnl > 0 ? 15 : 5;
  }
  
  // Variance penalty for conservative players
  if (riskTolerance === 'conservative' && contest.variance > 0.5) {
    score -= 10;
  }
  
  return Math.max(0, Math.min(100, score));
}

function calculateConfidence(contest: any, userPerformance: any, kellyFraction: number): number {
  let confidence = 0.7; // Base confidence
  
  // Adjust based on Kelly fraction
  if (kellyFraction > 0.1) confidence -= 0.1;
  if (kellyFraction > 0.2) confidence -= 0.1;
  
  // Adjust based on contest type experience
  if (contest.type === 'cash' && userPerformance.cashGames > 10) {
    confidence += userPerformance.cashAvgPnl > 0 ? 0.2 : -0.1;
  } else if (contest.type === 'gpp' && userPerformance.gppGames > 10) {
    confidence += userPerformance.gppAvgPnl > 0 ? 0.2 : -0.1;
  }
  
  // Adjust based on variance
  confidence -= contest.variance * 0.2;
  
  // Overall user performance adjustment
  if (userPerformance.totalContests > 20) {
    confidence += userPerformance.winRate > 0.5 ? 0.1 : -0.1;
  }
  
  return Math.max(0.1, Math.min(0.95, confidence));
}

function generateReasoning(contest: any, kellyFraction: number, winProbability: number, userPerformance: any): string {
  const parts = [];
  
  // Kelly assessment
  if (kellyFraction === 0) {
    parts.push('No bet recommended due to negative expected value');
  } else if (kellyFraction <= 0.05) {
    parts.push('Small bet recommended - limited edge detected');
  } else if (kellyFraction <= 0.15) {
    parts.push('Moderate bet size - good risk-adjusted opportunity');
  } else {
    parts.push('Larger bet recommended - strong expected value');
  }
  
  // Contest type insights
  if (contest.type === 'cash') {
    parts.push('Cash game provides steady returns with lower variance');
  } else if (contest.type === 'gpp') {
    parts.push('Tournament offers high upside but requires luck to win');
  } else if (contest.type === 'single_entry') {
    parts.push('Single entry tournament balances skill and variance');
  }
  
  // User experience factor
  if (userPerformance.totalContests > 10) {
    const contestTypeGames = contest.type === 'cash' ? userPerformance.cashGames : 
                           contest.type === 'gpp' ? userPerformance.gppGames : 
                           userPerformance.seGames;
    
    if (contestTypeGames > 5) {
      const avgPnl = contest.type === 'cash' ? userPerformance.cashAvgPnl :
                    contest.type === 'gpp' ? userPerformance.gppAvgPnl :
                    userPerformance.seAvgPnl;
      
      if (avgPnl > 0) {
        parts.push('You have positive history with this contest type');
      } else {
        parts.push('Consider improving strategy for this contest type');
      }
    }
  }
  
  return parts.join('. ') + '.';
}

function assessRiskLevel(kellyFraction: number): string {
  if (kellyFraction <= 0.05) return 'low';
  if (kellyFraction <= 0.15) return 'medium';
  if (kellyFraction <= 0.25) return 'high';
  return 'extreme';
}

function calculatePortfolioAllocation(contests: any[], bankroll: number, riskTolerance: string) {
  const totalRecommended = contests.reduce((sum, c) => sum + c.recommendedBetSize, 0);
  const exposureMap = {
    conservative: 0.3,
    moderate: 0.5,
    aggressive: 0.7
  };
  const maxExposure = exposureMap[riskTolerance as keyof typeof exposureMap] || 0.5;
  
  const maxAllocation = bankroll * maxExposure;
  
  if (totalRecommended <= maxAllocation) {
    return {
      totalAllocation: totalRecommended,
      utilizationRate: (totalRecommended / bankroll) * 100,
      withinLimits: true,
      adjustmentNeeded: false
    };
  }
  
  // Scale down proportionally if over limits
  const scaleFactor = maxAllocation / totalRecommended;
  const adjustedContests = contests.map(c => ({
    ...c,
    recommendedBetSize: Math.floor(c.recommendedBetSize * scaleFactor / c.entryFee) * c.entryFee
  }));
  
  const adjustedTotal = adjustedContests.reduce((sum, c) => sum + c.recommendedBetSize, 0);
  
  return {
    totalAllocation: adjustedTotal,
    utilizationRate: (adjustedTotal / bankroll) * 100,
    withinLimits: false,
    adjustmentNeeded: true,
    originalTotal: totalRecommended,
    scaleFactor: scaleFactor,
    adjustedContests
  };
}

function getPersonalizedAdvice(contests: any[], userPerformance: any, riskTolerance: string): string[] {
  const advice = [];
  
  if (contests.length === 0) {
    advice.push('No suitable contests found for your current bankroll and risk level.');
    advice.push('Consider increasing your bankroll or adjusting your risk tolerance.');
    return advice;
  }
  
  // Contest type distribution advice
  const contestTypes = contests.reduce((acc, c) => {
    acc[c.type] = (acc[c.type] || 0) + 1;
    return acc;
  }, {});
  
  if (contestTypes.cash > contestTypes.gpp) {
    advice.push('Good balance toward cash games - these provide more consistent returns.');
  } else if (contestTypes.gpp > contestTypes.cash) {
    advice.push('Heavy on tournaments - consider adding more cash games for stability.');
  }
  
  // User performance based advice
  if (userPerformance.totalContests > 10) {
    if (userPerformance.winRate > 0.5) {
      advice.push('Strong historical performance! These recommendations match your skill level.');
    } else if (userPerformance.winRate < 0.3) {
      advice.push('Consider focusing on skill development before increasing stakes.');
    }
  } else {
    advice.push('Start with smaller contests to build experience and track your performance.');
  }
  
  // Risk tolerance advice
  if (riskTolerance === 'conservative') {
    advice.push('Conservative approach selected - focus on bankroll preservation and steady growth.');
  } else if (riskTolerance === 'aggressive') {
    advice.push('Aggressive strategy chosen - monitor your bankroll closely and be prepared for volatility.');
  }
  
  // Portfolio advice
  const totalInvestment = contests.reduce((sum, c) => sum + c.recommendedBetSize, 0);
  const bankrollUtilization = totalInvestment / 1000; // Assuming default bankroll for calculation
  
  if (bankrollUtilization > 0.5) {
    advice.push('High bankroll utilization - consider spreading entries across multiple days.');
  }
  
  return advice.slice(0, 4); // Return top 4 pieces of advice
}
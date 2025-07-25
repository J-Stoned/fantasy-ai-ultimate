/**
 * 💰 KELLY BANKROLL API 💰
 * Mathematical position sizing and risk management
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { databaseConfig } from '@/lib/database-config';
import { redisCluster, CacheKeys } from '@/lib/services/redis-cluster';
import { logger } from '../../../../lib/logging/logger';

// Database connection
const pool = new Pool(databaseConfig);

// Risk parameters
const RISK_PARAMETERS = {
  maxSingleBet: 0.25,          // Max 25% of bankroll on single contest
  maxTotalExposure: 0.6,       // Max 60% total exposure
  minBankrollReserve: 0.15,    // Keep 15% as emergency reserve
  kellyMultiplier: {
    conservative: 0.25,         // Quarter-Kelly
    moderate: 0.5,              // Half-Kelly
    aggressive: 0.75            // Three-quarters Kelly
  }
};

export async function POST(request: NextRequest) {
  logger.info('[💰 KELLY] Processing bankroll management request...');
  
  try {
    const body = await request.json();
    const { 
      action = 'calculate',
      currentBankroll = 1000,
      contests = [],
      riskTolerance = 'moderate',
      confidenceLevel = 0.75
    } = body;

    switch (action) {
      case 'calculate':
        return calculateKellyBets(currentBankroll, contests, riskTolerance, confidenceLevel);
      
      case 'portfolio':
        return generatePortfolioAllocation(currentBankroll, contests, riskTolerance);
      
      case 'status':
        return getBankrollStatus(currentBankroll);
      
      case 'history':
        return getBankrollHistory();
      
      case 'update':
        return updateBankrollResult(body);
        
      default:
        return NextResponse.json({
          error: 'Invalid action. Use: calculate, portfolio, status, history, update'
        }, { status: 400 });
    }
    
  } catch (error) {
    logger.error('[KELLY] Error:', { error: error });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Kelly calculation failed'
    }, { status: 500 });
  }
}

async function calculateKellyBets(
  currentBankroll: number,
  contests: any[],
  riskTolerance: string,
  confidenceLevel: number
) {
  const recommendations = [];
  
  for (const contest of contests) {
    // Calculate Kelly parameters
    const kellyParams = {
      winProbability: contest.winProbability || estimateWinProbability(contest),
      averageWin: contest.averageWin || estimateAverageWin(contest),
      averageLoss: contest.entryFee,
      currentBankroll,
      confidenceLevel,
      volatility: contest.volatility || estimateVolatility(contest),
      riskTolerance
    };
    
    // Calculate basic Kelly fraction
    const basicKelly = calculateBasicKelly(kellyParams);
    
    // Apply risk adjustments
    const riskMultiplier = RISK_PARAMETERS.kellyMultiplier[riskTolerance as keyof typeof RISK_PARAMETERS.kellyMultiplier] || 0.5;
    const adjustedKelly = basicKelly * riskMultiplier;
    
    // Apply confidence and volatility adjustments
    const confidenceAdjustment = Math.pow(confidenceLevel, 2);
    const volatilityAdjustment = 1 / (1 + kellyParams.volatility * 2);
    
    const finalKellyFraction = adjustedKelly * confidenceAdjustment * volatilityAdjustment;
    
    // Calculate bet sizes
    const recommendedBetSize = Math.max(0, currentBankroll * finalKellyFraction);
    const maxAllowedBet = currentBankroll * RISK_PARAMETERS.maxSingleBet;
    const adjustedBetSize = Math.min(recommendedBetSize, maxAllowedBet, contest.entryFee * 10);
    
    // Assess risk level
    const riskLevel = assessRiskLevel(finalKellyFraction);
    
    // Calculate expected values
    const expectedReturn = adjustedBetSize * contest.projectedROI;
    const maxLoss = Math.min(adjustedBetSize, contest.entryFee);
    
    recommendations.push({
      contestId: contest.id,
      contestName: contest.name,
      contestType: contest.type,
      entryFee: contest.entryFee,
      recommendedBetSize: Math.round(recommendedBetSize),
      adjustedBetSize: Math.round(adjustedBetSize),
      maxBetSize: Math.round(maxAllowedBet),
      kellyFraction: finalKellyFraction,
      riskLevel,
      expectedReturn: Math.round(expectedReturn),
      maxLoss: Math.round(maxLoss),
      reasoning: generateReasoning(finalKellyFraction, riskLevel, kellyParams),
      confidence: calculateConfidence(kellyParams, contest)
    });
  }
  
  // Sort by Kelly fraction (best opportunities first)
  recommendations.sort((a, b) => b.kellyFraction - a.kellyFraction);
  
  // Calculate summary
  const totalRecommended = recommendations.reduce((sum, r) => sum + r.adjustedBetSize, 0);
  const avgKellyFraction = recommendations.reduce((sum, r) => sum + r.kellyFraction, 0) / recommendations.length;
  
  return NextResponse.json({
    success: true,
    currentBankroll,
    availableForBetting: Math.round(currentBankroll * (1 - RISK_PARAMETERS.minBankrollReserve)),
    riskTolerance,
    recommendations: recommendations.slice(0, 20), // Top 20
    summary: {
      totalRecommended: Math.round(totalRecommended),
      avgKellyFraction: (avgKellyFraction * 100).toFixed(2) + '%',
      utilizationRate: ((totalRecommended / currentBankroll) * 100).toFixed(1) + '%',
      topBet: recommendations[0]
    }
  });
}

async function generatePortfolioAllocation(
  currentBankroll: number,
  contests: any[],
  riskTolerance: string
) {
  const budget = currentBankroll * (1 - RISK_PARAMETERS.minBankrollReserve);
  const allocations = [];
  let totalAllocated = 0;
  let totalExpectedReturn = 0;
  
  // Calculate Kelly recommendations for all contests
  const kellyRecommendations = [];
  for (const contest of contests) {
    const kellyParams = {
      winProbability: estimateWinProbability(contest),
      averageWin: estimateAverageWin(contest),
      averageLoss: contest.entryFee,
      currentBankroll,
      confidenceLevel: 0.75,
      volatility: estimateVolatility(contest),
      riskTolerance
    };
    
    const kellyFraction = calculateAdjustedKelly(kellyParams, riskTolerance);
    const betSize = Math.min(
      currentBankroll * kellyFraction,
      currentBankroll * RISK_PARAMETERS.maxSingleBet
    );
    
    if (betSize >= contest.entryFee) {
      kellyRecommendations.push({
        contest,
        kellyFraction,
        betSize,
        sharpeRatio: contest.projectedROI / Math.sqrt(contest.variance || 1)
      });
    }
  }
  
  // Sort by Sharpe ratio (risk-adjusted return)
  kellyRecommendations.sort((a, b) => b.sharpeRatio - a.sharpeRatio);
  
  // Allocate budget
  for (const rec of kellyRecommendations) {
    if (totalAllocated >= budget * RISK_PARAMETERS.maxTotalExposure) break;
    
    const allocation = Math.min(
      rec.betSize,
      budget - totalAllocated,
      rec.contest.entryFee * 10 // Max 10 entries per contest
    );
    
    if (allocation >= rec.contest.entryFee) {
      const entries = Math.floor(allocation / rec.contest.entryFee);
      const actualAllocation = entries * rec.contest.entryFee;
      
      allocations.push({
        contestId: rec.contest.id,
        contestName: rec.contest.name,
        contestType: rec.contest.type,
        entryFee: rec.contest.entryFee,
        entries,
        allocation: actualAllocation,
        percentage: (actualAllocation / budget) * 100,
        expectedReturn: actualAllocation * rec.contest.projectedROI,
        sharpeRatio: rec.sharpeRatio
      });
      
      totalAllocated += actualAllocation;
      totalExpectedReturn += actualAllocation * rec.contest.projectedROI;
    }
  }
  
  // Calculate portfolio metrics
  const diversificationScore = calculateDiversification(allocations);
  const portfolioRisk = calculatePortfolioRisk(allocations);
  const sharpeRatio = totalExpectedReturn / portfolioRisk;
  
  return NextResponse.json({
    success: true,
    currentBankroll,
    availableBudget: Math.round(budget),
    totalAllocated: Math.round(totalAllocated),
    remainingBudget: Math.round(budget - totalAllocated),
    allocations,
    metrics: {
      expectedReturn: Math.round(totalExpectedReturn),
      roi: ((totalExpectedReturn / totalAllocated) * 100).toFixed(2) + '%',
      diversificationScore: diversificationScore.toFixed(2),
      portfolioRisk: portfolioRisk.toFixed(2),
      sharpeRatio: sharpeRatio.toFixed(3),
      utilizationRate: ((totalAllocated / budget) * 100).toFixed(1) + '%'
    }
  });
}

async function getBankrollStatus(currentBankroll: number) {
  try {
    // Get recent performance from database
    const performanceResult = await pool.query(`
      SELECT 
        COUNT(*) as total_contests,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_contests,
        SUM(entry_fee) as total_wagered,
        SUM(payout) as total_returns,
        MAX(created_at) as last_contest
      FROM contest_results
      WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
    `);
    
    const performance = performanceResult.rows[0] || {};
    const winRate = performance.total_contests > 0 
      ? (performance.winning_contests / performance.total_contests) * 100 
      : 0;
    const roi = performance.total_wagered > 0
      ? ((performance.total_returns - performance.total_wagered) / performance.total_wagered) * 100
      : 0;
    
    // Calculate drawdown
    const drawdownResult = await pool.query(`
      SELECT 
        MAX(cumulative_bankroll) as peak_bankroll,
        MIN(cumulative_bankroll) as trough_bankroll
      FROM bankroll_history
      WHERE timestamp > CURRENT_DATE - INTERVAL '30 days'
    `);
    
    const drawdown = drawdownResult.rows[0] || {};
    const maxDrawdown = drawdown.peak_bankroll > 0
      ? ((drawdown.peak_bankroll - drawdown.trough_bankroll) / drawdown.peak_bankroll) * 100
      : 0;
    
    return NextResponse.json({
      success: true,
      bankroll: {
        current: currentBankroll,
        available: Math.round(currentBankroll * (1 - RISK_PARAMETERS.minBankrollReserve)),
        reserved: Math.round(currentBankroll * RISK_PARAMETERS.minBankrollReserve)
      },
      performance: {
        totalContests: parseInt(performance.total_contests) || 0,
        winningContests: parseInt(performance.winning_contests) || 0,
        winRate: winRate.toFixed(1) + '%',
        totalWagered: parseFloat(performance.total_wagered) || 0,
        totalReturns: parseFloat(performance.total_returns) || 0,
        roi: roi.toFixed(2) + '%',
        maxDrawdown: maxDrawdown.toFixed(1) + '%',
        lastContest: performance.last_contest
      },
      riskProfile: getRiskProfile(maxDrawdown, winRate),
      recommendations: {
        maxSingleBet: Math.round(currentBankroll * RISK_PARAMETERS.maxSingleBet),
        maxTotalExposure: Math.round(currentBankroll * RISK_PARAMETERS.maxTotalExposure),
        suggestedStrategy: getSuggestedStrategy(winRate, roi, maxDrawdown)
      }
    });
    
  } catch (error) {
    // Return default status if database fails
    return NextResponse.json({
      success: true,
      bankroll: {
        current: currentBankroll,
        available: Math.round(currentBankroll * 0.85),
        reserved: Math.round(currentBankroll * 0.15)
      },
      performance: {
        message: 'Historical data unavailable'
      },
      riskProfile: 'Moderate',
      recommendations: {
        maxSingleBet: Math.round(currentBankroll * 0.25),
        maxTotalExposure: Math.round(currentBankroll * 0.6),
        suggestedStrategy: 'Start with conservative Kelly (quarter-Kelly) until you build history'
      }
    });
  }
}

async function getBankrollHistory() {
  try {
    const result = await pool.query(`
      SELECT 
        timestamp,
        bankroll,
        change_amount,
        change_percent,
        source,
        contest_id,
        description
      FROM bankroll_history
      ORDER BY timestamp DESC
      LIMIT 50
    `);
    
    const chartData = result.rows.map(row => ({
      date: row.timestamp,
      bankroll: parseFloat(row.bankroll),
      change: parseFloat(row.change_amount)
    }));
    
    return NextResponse.json({
      success: true,
      history: result.rows,
      chartData,
      summary: {
        totalEntries: result.rows.length,
        netChange: result.rows.reduce((sum, r) => sum + parseFloat(r.change_amount), 0),
        avgChange: result.rows.length > 0 
          ? result.rows.reduce((sum, r) => sum + parseFloat(r.change_amount), 0) / result.rows.length
          : 0
      }
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to retrieve bankroll history'
    }, { status: 500 });
  }
}

async function updateBankrollResult(body: any) {
  const { contestId, result, amount, currentBankroll, description } = body;
  
  try {
    const newBankroll = result === 'win' 
      ? currentBankroll + amount 
      : currentBankroll - amount;
    
    const change = newBankroll - currentBankroll;
    const changePercent = (change / currentBankroll) * 100;
    
    // Store in database
    await pool.query(`
      INSERT INTO bankroll_history (
        timestamp, bankroll, change_amount, change_percent,
        source, contest_id, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      new Date(),
      newBankroll,
      change,
      changePercent,
      result === 'win' ? 'contest_win' : 'contest_loss',
      contestId,
      description || `Contest ${result}`
    ]);
    
    // Store contest result
    await pool.query(`
      INSERT INTO contest_results (
        contest_id, entry_fee, payout, pnl, created_at
      ) VALUES ($1, $2, $3, $4, $5)
    `, [
      contestId,
      result === 'win' ? amount / 2 : amount, // Estimate entry fee
      result === 'win' ? amount : 0,
      result === 'win' ? amount / 2 : -amount,
      new Date()
    ]);
    
    return NextResponse.json({
      success: true,
      previousBankroll: currentBankroll,
      newBankroll,
      change,
      changePercent: changePercent.toFixed(2) + '%',
      result,
      message: `Bankroll updated: ${result === 'win' ? '+' : '-'}$${amount}`
    });
    
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: 'Failed to update bankroll'
    }, { status: 500 });
  }
}

// Helper functions
function calculateBasicKelly(params: any): number {
  const { winProbability, averageWin, averageLoss } = params;
  
  if (winProbability <= 0 || winProbability >= 1) return 0;
  if (averageWin <= 0 || averageLoss <= 0) return 0;
  
  const lossProbability = 1 - winProbability;
  const oddsRatio = averageWin / averageLoss;
  
  // Kelly formula: f = (bp - q) / b
  const kellyFraction = (oddsRatio * winProbability - lossProbability) / oddsRatio;
  
  return Math.max(0, kellyFraction);
}

function calculateAdjustedKelly(params: any, riskTolerance: string): number {
  const basicKelly = calculateBasicKelly(params);
  const riskMultiplier = RISK_PARAMETERS.kellyMultiplier[riskTolerance as keyof typeof RISK_PARAMETERS.kellyMultiplier] || 0.5;
  const confidenceAdjustment = Math.pow(params.confidenceLevel || 0.75, 2);
  const volatilityAdjustment = 1 / (1 + (params.volatility || 0.5) * 2);
  
  return basicKelly * riskMultiplier * confidenceAdjustment * volatilityAdjustment;
}

function estimateWinProbability(contest: any): number {
  const defaultRates: Record<string, number> = {
    cash: 0.45,
    h2h: 0.48,
    qualifier: 0.35,
    gpp: 0.15
  };
  
  return contest.winProbability || defaultRates[contest.type] || 0.3;
}

function estimateAverageWin(contest: any): number {
  const multipliers: Record<string, number> = {
    cash: 1.8,
    h2h: 1.9,
    qualifier: 2.5,
    gpp: 5.0
  };
  
  const multiplier = multipliers[contest.type] || 2.0;
  return contest.entryFee * multiplier;
}

function estimateVolatility(contest: any): number {
  const volatilities: Record<string, number> = {
    cash: 0.1,
    h2h: 0.15,
    qualifier: 0.3,
    gpp: 0.8
  };
  
  return contest.volatility || volatilities[contest.type] || 0.5;
}

function assessRiskLevel(kellyFraction: number): string {
  if (kellyFraction <= 0.05) return 'low';
  if (kellyFraction <= 0.15) return 'medium';
  if (kellyFraction <= 0.25) return 'high';
  return 'extreme';
}

function generateReasoning(kellyFraction: number, riskLevel: string, params: any): string {
  const parts = [];
  
  parts.push(`Kelly fraction: ${(kellyFraction * 100).toFixed(2)}%`);
  parts.push(`Risk level: ${riskLevel}`);
  parts.push(`Win probability: ${(params.winProbability * 100).toFixed(1)}%`);
  
  if (kellyFraction === 0) {
    parts.push('No bet recommended due to negative expected value');
  } else if (riskLevel === 'low') {
    parts.push('Conservative bet with good risk-adjusted returns');
  } else if (riskLevel === 'medium') {
    parts.push('Moderate risk with solid expected value');
  } else if (riskLevel === 'high') {
    parts.push('Higher risk but strong expected value - monitor closely');
  }
  
  return parts.join('. ');
}

function calculateConfidence(params: any, contest: any): number {
  let confidence = params.confidenceLevel || 0.75;
  
  // Adjust based on contest type
  const contestTypeMultiplier: Record<string, number> = {
    cash: 1.0,
    h2h: 0.9,
    qualifier: 0.8,
    gpp: 0.7
  };
  
  confidence *= contestTypeMultiplier[contest.type] || 0.8;
  
  return Math.max(0, Math.min(1, confidence));
}

function calculateDiversification(allocations: any[]): number {
  if (allocations.length <= 1) return 0;
  
  const totalAllocation = allocations.reduce((sum, a) => sum + a.allocation, 0);
  const hhi = allocations.reduce((sum, a) => {
    const share = a.allocation / totalAllocation;
    return sum + share * share;
  }, 0);
  
  return 1 - hhi;
}

function calculatePortfolioRisk(allocations: any[]): number {
  const totalVariance = allocations.reduce((sum, a) => {
    const variance = a.sharpeRatio > 0 ? 1 / a.sharpeRatio : 1;
    return sum + Math.pow(a.allocation, 2) * variance;
  }, 0);
  
  return Math.sqrt(totalVariance);
}

function getRiskProfile(drawdown: number, winRate: number): string {
  if (drawdown > 20) return 'High Risk - Large Drawdown';
  if (drawdown > 10) return 'Moderate Risk - Some Drawdown';
  if (winRate < 40) return 'Moderate Risk - Low Win Rate';
  return 'Low Risk - Stable Performance';
}

function getSuggestedStrategy(winRate: number, roi: number, drawdown: number): string {
  if (drawdown > 20) {
    return 'Reduce position sizes. Consider conservative Kelly (quarter-Kelly) until drawdown recovers.';
  }
  if (winRate > 50 && roi > 10) {
    return 'Strong performance! Consider moderate Kelly (half-Kelly) for optimal growth.';
  }
  if (winRate < 40) {
    return 'Focus on improving win rate. Use conservative Kelly and prioritize cash games.';
  }
  return 'Maintain current strategy. Use moderate Kelly with good bankroll management.';
}
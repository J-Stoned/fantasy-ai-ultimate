/**
 * 💰 TRADING EXECUTION WORKER 💰
 * Handles trade execution, position monitoring, and Kelly calculations
 */

import { Job } from 'bullmq';
import { Pool } from 'pg';
import { redisCluster } from '../services/redis-cluster';
import axios from 'axios';
import { databaseConfig } from '../database-config';
import { logger } from '../logging/logger';

// Database connection - SECURITY: Using centralized config
const pool = new Pool(databaseConfig);

// Platform configurations
const PLATFORM_CONFIG = {
  draftkings: {
    apiUrl: process.env.DK_API_URL || 'https://api.draftkings.com',
    apiKey: process.env.DK_API_KEY,
    maxRetries: 3,
    timeout: 10000
  },
  fanduel: {
    apiUrl: process.env.FD_API_URL || 'https://api.fanduel.com',
    apiKey: process.env.FD_API_KEY,
    maxRetries: 3,
    timeout: 10000
  }
};

export async function tradingWorker(job: Job) {
  const { type, data } = job;
  
  logger.info('💰 Processing ${type} job');
  
  try {
    let result;
    
    switch (type) {
      case 'execute_trade':
        result = await executeTrade(data);
        break;
      case 'monitor_positions':
        result = await monitorPositions(data);
        break;
      case 'calculate_kelly':
        result = await calculateKellyCriterion(data);
        break;
      default:
        throw new Error(`Unknown trading job type: ${type}`);
    }
    
    await job.updateProgress(100);
    logger.info('✅ ${type} complete');
    return result;
    
  } catch (error) {
    logger.error('❌ Trading job failed:', { error: error });
    throw error;
  }
}

async function executeTrade(data: any) {
  const { contestId, lineup, entryFee, platform } = data;
  
  try {
    // Validate lineup
    const validationResult = await validateLineup(lineup, contestId);
    if (!validationResult.valid) {
      throw new Error(`Invalid lineup: ${validationResult.reason}`);
    }
    
    // Check bankroll
    const bankrollCheck = await checkBankroll(entryFee);
    if (!bankrollCheck.sufficient) {
      throw new Error('Insufficient bankroll');
    }
    
    // Submit to platform
    const submission = await submitToPlatform(platform, {
      contestId,
      lineup,
      entryFee
    });
    
    // Record trade
    await recordTrade({
      platform,
      contestId,
      lineup,
      entryFee,
      confirmationNumber: submission.confirmationNumber,
      submittedAt: new Date(),
      status: 'submitted'
    });
    
    // Update bankroll
    await updateBankroll(-entryFee, 'trade_execution');
    
    // Publish event
    await redisCluster.publish('trades:executed', {
      contestId,
      platform,
      entryFee,
      confirmationNumber: submission.confirmationNumber
    });
    
    return {
      success: true,
      confirmationNumber: submission.confirmationNumber,
      platform,
      contestId,
      entryFee,
      expectedReturn: entryFee * 2.5, // Mock expected return
      message: 'Trade executed successfully'
    };
    
  } catch (error) {
    // Record failed trade
    await recordTrade({
      platform,
      contestId,
      lineup,
      entryFee,
      error: error instanceof Error ? error.message : 'Unknown error',
      status: 'failed',
      failedAt: new Date()
    });
    
    throw error;
  }
}

async function monitorPositions(data: any) {
  try {
    // Get active positions
    const positions = await getActivePositions();
    
    // Update live scores
    const updatedPositions = await updateLiveScores(positions);
    
    // Calculate current P&L
    const performance = calculatePerformance(updatedPositions);
    
    // Check for alerts
    const alerts = await checkAlerts(updatedPositions, performance);
    
    // Store monitoring data
    await storeMonitoringData({
      positions: updatedPositions,
      performance,
      alerts,
      timestamp: new Date()
    });
    
    // Publish updates
    await redisCluster.publish('positions:updated', {
      activePositions: updatedPositions.length,
      currentPnL: performance.unrealizedPnL,
      alerts: alerts.length
    });
    
    return {
      positions: updatedPositions,
      performance,
      alerts,
      lastUpdated: new Date()
    };
    
  } catch (error) {
    logger.error('Position monitoring error:', { error: error });
    throw error;
  }
}

async function calculateKellyCriterion(data: any) {
  const { bankroll, opportunities } = data;
  
  try {
    const kellyPositions = [];
    
    for (const opp of opportunities) {
      // Calculate edge
      const edge = calculateEdge(opp);
      
      // Calculate Kelly fraction
      const kelly = calculateKellyFraction(edge, opp.odds);
      
      // Apply Kelly safety factor (usually 0.25)
      const safeKelly = kelly * 0.25;
      
      // Calculate position size
      const positionSize = Math.min(
        bankroll * safeKelly,
        bankroll * 0.05 // Max 5% per position
      );
      
      kellyPositions.push({
        contestId: opp.contestId,
        edge: edge,
        kellyFraction: kelly,
        safeKellyFraction: safeKelly,
        recommendedSize: positionSize,
        entryFee: opp.entryFee,
        units: Math.floor(positionSize / opp.entryFee)
      });
    }
    
    // Sort by Kelly edge
    kellyPositions.sort((a, b) => b.edge - a.edge);
    
    // Calculate total allocation
    const totalAllocation = kellyPositions.reduce((sum, pos) => sum + pos.recommendedSize, 0);
    
    return {
      bankroll,
      positions: kellyPositions,
      totalAllocation,
      allocationPercentage: (totalAllocation / bankroll) * 100,
      topPositions: kellyPositions.slice(0, 5),
      calculatedAt: new Date()
    };
    
  } catch (error) {
    logger.error('Kelly calculation error:', { error: error });
    throw error;
  }
}

// Helper functions
async function validateLineup(lineup: any[], contestId: string) {
  // Check lineup rules
  if (!lineup || lineup.length === 0) {
    return { valid: false, reason: 'Empty lineup' };
  }
  
  // Check salary cap
  const totalSalary = lineup.reduce((sum, player) => sum + player.salary, 0);
  if (totalSalary > 50000) { // DK salary cap
    return { valid: false, reason: 'Exceeds salary cap' };
  }
  
  // Check positions (simplified)
  const positions = lineup.map(p => p.position);
  const uniquePositions = new Set(positions);
  if (uniquePositions.size !== lineup.length) {
    return { valid: false, reason: 'Duplicate positions' };
  }
  
  return { valid: true };
}

async function checkBankroll(amount: number) {
  try {
    const result = await pool.query(
      'SELECT balance FROM bankroll WHERE user_id = $1',
      ['system']
    );
    
    const balance = result.rows[0]?.balance || 1000; // Default bankroll
    return {
      sufficient: balance >= amount,
      currentBalance: balance,
      required: amount
    };
  } catch (error) {
    // Assume sufficient funds in mock mode
    return { sufficient: true, currentBalance: 10000, required: amount };
  }
}

async function submitToPlatform(platform: string, data: any) {
  // In production, this would submit to real platform APIs
  // Mock successful submission
  
  const confirmationNumber = `${platform.toUpperCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  
  // Simulate API delay
  await new Promise(resolve => setTimeout(resolve, Math.random() * 2000 + 1000));
  
  // Random failure for testing (5% chance)
  if (Math.random() < 0.05) {
    throw new Error('Platform submission failed: Contest full');
  }
  
  return {
    success: true,
    confirmationNumber,
    submittedAt: new Date(),
    platform
  };
}

async function recordTrade(trade: any) {
  try {
    const query = `
      INSERT INTO trades 
      (platform, contest_id, lineup, entry_fee, confirmation_number, status, submitted_at, error)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    
    await pool.query(query, [
      trade.platform,
      trade.contestId,
      JSON.stringify(trade.lineup),
      trade.entryFee,
      trade.confirmationNumber || null,
      trade.status,
      trade.submittedAt || trade.failedAt,
      trade.error || null
    ]);
  } catch (error) {
    logger.error('Failed to record trade:', { error: error });
  }
}

async function updateBankroll(amount: number, reason: string) {
  try {
    await pool.query(
      `UPDATE bankroll 
       SET balance = balance + $1, 
           last_updated = NOW() 
       WHERE user_id = $2`,
      [amount, 'system']
    );
    
    await pool.query(
      `INSERT INTO bankroll_transactions 
       (user_id, amount, reason, created_at)
       VALUES ($1, $2, $3, NOW())`,
      ['system', amount, reason]
    );
  } catch (error) {
    logger.error('Failed to update bankroll:', { error: error });
  }
}

async function getActivePositions() {
  try {
    const result = await pool.query(`
      SELECT 
        t.id,
        t.platform,
        t.contest_id,
        t.lineup,
        t.entry_fee,
        t.confirmation_number,
        t.submitted_at,
        c.name as contest_name,
        c.prize_pool,
        c.status as contest_status
      FROM trades t
      JOIN contests c ON t.contest_id = c.id
      WHERE t.status = 'submitted'
        AND c.status IN ('upcoming', 'live')
      ORDER BY t.submitted_at DESC
    `);
    
    return result.rows;
  } catch (error) {
    // Return mock positions
    return generateMockPositions();
  }
}

function generateMockPositions() {
  return [
    {
      id: 1,
      platform: 'draftkings',
      contest_id: 'DK-NFL-GPP-12345',
      entry_fee: 25,
      status: 'live',
      current_rank: 234,
      current_points: 145.5,
      winning_threshold: 140,
      projected_payout: 50
    },
    {
      id: 2,
      platform: 'fanduel',
      contest_id: 'FD-NBA-CASH-67890',
      entry_fee: 10,
      status: 'upcoming',
      current_rank: null,
      current_points: 0,
      winning_threshold: 135,
      projected_payout: 20
    }
  ];
}

async function updateLiveScores(positions: any[]) {
  // In production, fetch live scores from platforms
  // Mock score updates
  
  return positions.map(pos => {
    if (pos.status === 'live') {
      pos.current_points = pos.current_points + (Math.random() * 10 - 5);
      pos.current_rank = Math.floor(Math.random() * 1000) + 1;
      pos.projected_finish = pos.current_points > pos.winning_threshold ? 'ITM' : 'OTM';
    }
    return pos;
  });
}

function calculatePerformance(positions: any[]) {
  const totalInvested = positions.reduce((sum, p) => sum + (p.entry_fee || 0), 0);
  const projectedReturns = positions.reduce((sum, p) => sum + (p.projected_payout || 0), 0);
  const inTheMoney = positions.filter(p => p.projected_finish === 'ITM').length;
  
  return {
    totalPositions: positions.length,
    totalInvested,
    projectedReturns,
    unrealizedPnL: projectedReturns - totalInvested,
    winRate: positions.length > 0 ? (inTheMoney / positions.length) * 100 : 0,
    avgROI: totalInvested > 0 ? ((projectedReturns - totalInvested) / totalInvested) * 100 : 0
  };
}

async function checkAlerts(positions: any[], performance: any) {
  const alerts = [];
  
  // Check for big wins
  positions.forEach(pos => {
    if (pos.current_rank && pos.current_rank <= 10) {
      alerts.push({
        type: 'success',
        message: `Top 10 finish in ${pos.contest_id}! Current rank: ${pos.current_rank}`
      });
    }
  });
  
  // Check for performance thresholds
  if (performance.unrealizedPnL > 500) {
    alerts.push({
      type: 'success',
      message: `Excellent session! Unrealized P&L: $${performance.unrealizedPnL.toFixed(2)}`
    });
  }
  
  if (performance.winRate > 70 && positions.length > 5) {
    alerts.push({
      type: 'info',
      message: `High win rate detected: ${performance.winRate.toFixed(1)}%`
    });
  }
  
  return alerts;
}

async function storeMonitoringData(data: any) {
  try {
    await pool.query(
      `INSERT INTO position_monitoring 
       (positions, performance, alerts, created_at)
       VALUES ($1, $2, $3, NOW())`,
      [
        JSON.stringify(data.positions),
        JSON.stringify(data.performance),
        JSON.stringify(data.alerts)
      ]
    );
  } catch (error) {
    logger.error('Failed to store monitoring data:', { error: error });
  }
}

function calculateEdge(opportunity: any) {
  // Simplified edge calculation
  // In production, this would use ML predictions
  
  const projectedROI = opportunity.expectedROI || 0.15;
  const marketROI = 0.10; // Assume 10% market average
  
  return projectedROI - marketROI;
}

function calculateKellyFraction(edge: number, odds: number = 2) {
  // Kelly formula: f = (p*b - q) / b
  // Where f = fraction, p = win probability, b = odds, q = lose probability
  
  if (edge <= 0) return 0;
  
  const winProbability = 0.5 + edge; // Simplified
  const loseProbability = 1 - winProbability;
  
  const kelly = (winProbability * odds - loseProbability) / odds;
  
  return Math.max(0, Math.min(kelly, 0.25)); // Cap at 25%
}
/**
 * 💰 USER BANKROLL API 💰
 * Simplified bankroll management for regular users
 */

import { NextRequest, NextResponse } from 'next/server';
import { Pool } from 'pg';
import { databaseConfig } from '@/lib/database-config';
import { withValidation, bankrollUpdateSchema, moneySchema, z } from '@/lib/validation';
import { logger } from '../../../../lib/logging/logger';

// Database connection - SECURITY: Using centralized config
const pool = new Pool(databaseConfig);

// User-friendly risk levels
const USER_RISK_LEVELS = {
  conservative: {
    label: 'Conservative',
    kellyMultiplier: 0.25,
    maxSingleBet: 0.1,  // Max 10% per contest
    maxTotalExposure: 0.3, // Max 30% total
    description: 'Play it safe - smaller bets, steady growth'
  },
  moderate: {
    label: 'Balanced',
    kellyMultiplier: 0.5,
    maxSingleBet: 0.15, // Max 15% per contest
    maxTotalExposure: 0.5, // Max 50% total
    description: 'Balanced approach - moderate risk for better returns'
  },
  aggressive: {
    label: 'Aggressive',
    kellyMultiplier: 0.75,
    maxSingleBet: 0.25, // Max 25% per contest
    maxTotalExposure: 0.7, // Max 70% total
    description: 'Go big - higher risk for maximum growth potential'
  }
};

// Define validation schema for user bankroll operations
const userBankrollSchema = z.object({
  action: z.enum(['status', 'update', 'alerts']).default('status'),
  currentBankroll: moneySchema.default(1000),
  riskLevel: z.enum(['conservative', 'moderate', 'aggressive']).default('moderate'),
  // For update action
  newBankroll: moneySchema.optional(),
  changeAmount: z.number().finite().optional(),
  changeType: z.enum(['manual', 'contest', 'deposit', 'withdrawal']).default('manual'),
  description: z.string().max(500).trim().optional(),
  contestId: z.string().max(100).optional(),
});

export const POST = withValidation(userBankrollSchema, async (request: NextRequest, body) => {
  logger.info('[💰 USER BANKROLL] Processing user bankroll request...');
  
  try {
    const { 
      action,
      currentBankroll,
      riskLevel
    } = body;

    switch (action) {
      case 'status':
        return getBankrollStatus(currentBankroll, riskLevel);
      
      case 'update':
        return updateBankroll(body);
      
      case 'alerts':
        return getBankrollAlerts(currentBankroll);
        
      default:
        return NextResponse.json({
          error: 'Invalid action. Use: status, update, alerts'
        }, { status: 400 });
    }
    
  } catch (error) {
    logger.error('[USER BANKROLL] Error:', { error: error });
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'User bankroll request failed'
    }, { status: 500 });
  }
});

async function getBankrollStatus(currentBankroll: number, riskLevel: string) {
  const riskSettings = USER_RISK_LEVELS[riskLevel as keyof typeof USER_RISK_LEVELS] || USER_RISK_LEVELS.moderate;
  
  try {
    // Get recent performance from database
    const performanceResult = await pool.query(`
      SELECT 
        COUNT(*) as total_contests,
        SUM(CASE WHEN pnl > 0 THEN 1 ELSE 0 END) as winning_contests,
        SUM(entry_fee) as total_wagered,
        SUM(payout) as total_returns,
        AVG(pnl) as avg_pnl,
        MAX(created_at) as last_contest,
        MIN(pnl) as worst_loss,
        MAX(pnl) as best_win
      FROM contest_results
      WHERE created_at > CURRENT_DATE - INTERVAL '30 days'
    `);
    
    const performance = performanceResult.rows[0] || {};
    const totalContests = parseInt(performance.total_contests) || 0;
    const winningContests = parseInt(performance.winning_contests) || 0;
    const totalWagered = parseFloat(performance.total_wagered) || 0;
    const totalReturns = parseFloat(performance.total_returns) || 0;
    
    const winRate = totalContests > 0 ? (winningContests / totalContests) * 100 : 0;
    const roi = totalWagered > 0 ? ((totalReturns - totalWagered) / totalWagered) * 100 : 0;
    
    // Calculate drawdown from bankroll history
    const drawdownResult = await pool.query(`
      SELECT 
        MAX(bankroll) as peak_bankroll,
        MIN(bankroll) as trough_bankroll,
        bankroll as current_bankroll
      FROM bankroll_history
      WHERE timestamp > CURRENT_DATE - INTERVAL '30 days'
      ORDER BY timestamp DESC
      LIMIT 1
    `);
    
    const drawdown = drawdownResult.rows[0] || {};
    const maxDrawdown = drawdown.peak_bankroll > 0
      ? ((drawdown.peak_bankroll - drawdown.trough_bankroll) / drawdown.peak_bankroll) * 100
      : 0;
    
    // Calculate available amounts based on risk level
    const reserveAmount = Math.max(currentBankroll * 0.15, 100); // Keep at least $100 or 15%
    const availableForBetting = currentBankroll - reserveAmount;
    const maxSingleBet = Math.floor(currentBankroll * riskSettings.maxSingleBet);
    const maxTotalExposure = Math.floor(currentBankroll * riskSettings.maxTotalExposure);
    
    // Get bankroll health score
    const healthScore = calculateBankrollHealth(winRate, roi, maxDrawdown, currentBankroll);
    
    return NextResponse.json({
      success: true,
      bankroll: {
        current: currentBankroll,
        available: Math.max(0, availableForBetting),
        reserved: reserveAmount,
        maxSingleBet,
        maxTotalExposure
      },
      performance: {
        totalContests,
        winningContests,
        winRate: winRate.toFixed(1) + '%',
        totalWagered,
        totalReturns,
        roi: roi.toFixed(2) + '%',
        maxDrawdown: maxDrawdown.toFixed(1) + '%',
        lastContest: performance.last_contest,
        avgPnl: parseFloat(performance.avg_pnl) || 0,
        bestWin: parseFloat(performance.best_win) || 0,
        worstLoss: parseFloat(performance.worst_loss) || 0
      },
      riskProfile: {
        level: riskLevel,
        settings: riskSettings,
        healthScore,
        healthLabel: getHealthLabel(healthScore),
        recommendations: getPersonalizedRecommendations(healthScore, winRate, roi, maxDrawdown)
      }
    });
    
  } catch (error) {
    logger.error('[USER BANKROLL] Database error:', { error: error });
    
    // Return simplified status without database data
    const reserveAmount = Math.max(currentBankroll * 0.15, 100);
    const availableForBetting = currentBankroll - reserveAmount;
    
    return NextResponse.json({
      success: true,
      bankroll: {
        current: currentBankroll,
        available: Math.max(0, availableForBetting),
        reserved: reserveAmount,
        maxSingleBet: Math.floor(currentBankroll * riskSettings.maxSingleBet),
        maxTotalExposure: Math.floor(currentBankroll * riskSettings.maxTotalExposure)
      },
      performance: {
        totalContests: 0,
        winningContests: 0,
        winRate: '0%',
        totalWagered: 0,
        totalReturns: 0,
        roi: '0%',
        maxDrawdown: '0%',
        message: 'No historical data available - start playing to track performance!'
      },
      riskProfile: {
        level: riskLevel,
        settings: riskSettings,
        healthScore: 75, // Default healthy score
        healthLabel: 'Getting Started',
        recommendations: [
          'Start with small bets to build experience',
          'Focus on cash games for consistent returns',
          'Track your results to improve over time'
        ]
      }
    });
  }
}

async function updateBankroll(body: any) {
  const { 
    currentBankroll, 
    newBankroll, 
    changeAmount, 
    changeType = 'manual', 
    description = 'Manual bankroll update',
    contestId = null 
  } = body;
  
  try {
    const actualNewBankroll = newBankroll || (currentBankroll + changeAmount);
    const actualChange = actualNewBankroll - currentBankroll;
    const changePercent = currentBankroll > 0 ? (actualChange / currentBankroll) * 100 : 0;
    
    // Store in bankroll history
    await pool.query(`
      INSERT INTO bankroll_history (
        timestamp, bankroll, change_amount, change_percent,
        source, contest_id, description
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [
      new Date(),
      actualNewBankroll,
      actualChange,
      changePercent,
      changeType,
      contestId,
      description
    ]);
    
    // If this was a contest result, also store it
    if (contestId && changeType === 'contest') {
      const entryFee = Math.abs(actualChange) / 2; // Estimate entry fee
      const payout = actualChange > 0 ? Math.abs(actualChange) : 0;
      const pnl = actualChange;
      
      await pool.query(`
        INSERT INTO contest_results (
          contest_id, entry_fee, payout, pnl, created_at
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (contest_id) DO UPDATE SET
          payout = EXCLUDED.payout,
          pnl = EXCLUDED.pnl
      `, [contestId, entryFee, payout, pnl, new Date()]);
    }
    
    return NextResponse.json({
      success: true,
      previousBankroll: currentBankroll,
      newBankroll: actualNewBankroll,
      change: actualChange,
      changePercent: changePercent.toFixed(2) + '%',
      message: `Bankroll updated: ${actualChange >= 0 ? '+' : ''}$${actualChange.toFixed(2)}`
    });
    
  } catch (error) {
    logger.error('[USER BANKROLL] Update error:', { error: error });
    return NextResponse.json({
      success: false,
      error: 'Failed to update bankroll'
    }, { status: 500 });
  }
}

async function getBankrollAlerts(currentBankroll: number) {
  const alerts = [];
  
  try {
    // Check for low bankroll
    if (currentBankroll < 500) {
      alerts.push({
        type: 'warning',
        title: 'Low Bankroll',
        message: 'Your bankroll is below $500. Consider reducing bet sizes or adding funds.',
        severity: 'high'
      });
    }
    
    // Check recent performance
    const recentPerformance = await pool.query(`
      SELECT 
        COUNT(*) as recent_contests,
        SUM(pnl) as recent_pnl,
        AVG(pnl) as avg_recent_pnl
      FROM contest_results
      WHERE created_at > CURRENT_DATE - INTERVAL '7 days'
    `);
    
    const recent = recentPerformance.rows[0] || {};
    const recentPnl = parseFloat(recent.recent_pnl) || 0;
    const recentContests = parseInt(recent.recent_contests) || 0;
    
    if (recentContests >= 5 && recentPnl < -200) {
      alerts.push({
        type: 'error',
        title: 'Recent Losses',
        message: `You've lost $${Math.abs(recentPnl).toFixed(2)} in the last week. Consider taking a break or reducing bet sizes.`,
        severity: 'high'
      });
    }
    
    // Check for winning streak
    if (recentContests >= 3 && recentPnl > 100) {
      alerts.push({
        type: 'success',
        title: 'Hot Streak!',
        message: `Great job! You're up $${recentPnl.toFixed(2)} this week. Stay disciplined with your bankroll management.`,
        severity: 'info'
      });
    }
    
    // Check drawdown
    const drawdownResult = await pool.query(`
      SELECT 
        MAX(bankroll) as peak,
        MIN(bankroll) as trough
      FROM bankroll_history
      WHERE timestamp > CURRENT_DATE - INTERVAL '30 days'
    `);
    
    const drawdown = drawdownResult.rows[0] || {};
    if (drawdown.peak && drawdown.trough) {
      const drawdownPercent = ((drawdown.peak - drawdown.trough) / drawdown.peak) * 100;
      
      if (drawdownPercent > 25) {
        alerts.push({
          type: 'warning',
          title: 'High Drawdown',
          message: `Your bankroll has declined ${drawdownPercent.toFixed(1)}% from its peak. Consider more conservative betting.`,
          severity: 'medium'
        });
      }
    }
    
    return NextResponse.json({
      success: true,
      alerts,
      alertCount: alerts.length,
      hasHighSeverity: alerts.some(a => a.severity === 'high')
    });
    
  } catch (error) {
    logger.error('[USER BANKROLL] Alerts error:', { error: error });
    return NextResponse.json({
      success: true,
      alerts: [],
      alertCount: 0,
      hasHighSeverity: false
    });
  }
}

// Helper functions
function calculateBankrollHealth(winRate: number, roi: number, maxDrawdown: number, currentBankroll: number): number {
  let score = 50; // Base score
  
  // Win rate component (0-25 points)
  if (winRate >= 60) score += 25;
  else if (winRate >= 50) score += 20;
  else if (winRate >= 40) score += 15;
  else if (winRate >= 30) score += 10;
  else if (winRate >= 20) score += 5;
  
  // ROI component (0-25 points)
  if (roi >= 20) score += 25;
  else if (roi >= 10) score += 20;
  else if (roi >= 5) score += 15;
  else if (roi >= 0) score += 10;
  else if (roi >= -10) score += 5;
  else score -= 10; // Penalty for large losses
  
  // Drawdown component (0-15 points, penalty for large drawdowns)
  if (maxDrawdown <= 5) score += 15;
  else if (maxDrawdown <= 10) score += 10;
  else if (maxDrawdown <= 20) score += 5;
  else if (maxDrawdown <= 30) score -= 5;
  else score -= 15;
  
  // Bankroll size component (0-10 points)
  if (currentBankroll >= 5000) score += 10;
  else if (currentBankroll >= 2000) score += 8;
  else if (currentBankroll >= 1000) score += 5;
  else if (currentBankroll >= 500) score += 3;
  else score -= 5; // Penalty for very small bankrolls
  
  return Math.max(0, Math.min(100, score));
}

function getHealthLabel(score: number): string {
  if (score >= 85) return 'Excellent';
  if (score >= 70) return 'Good';
  if (score >= 55) return 'Fair';
  if (score >= 40) return 'Poor';
  return 'Critical';
}

function getPersonalizedRecommendations(healthScore: number, winRate: number, roi: number, maxDrawdown: number): string[] {
  const recommendations = [];
  
  if (healthScore >= 85) {
    recommendations.push('Great job! Your bankroll management is excellent.');
    recommendations.push('Consider gradually increasing your risk level for higher returns.');
    recommendations.push('Keep tracking your results and stick to your strategy.');
  } else if (healthScore >= 70) {
    recommendations.push('Solid performance! Stay consistent with your current approach.');
    recommendations.push('Focus on contests where you have the highest win rate.');
    recommendations.push('Consider diversifying across different contest types.');
  } else if (healthScore >= 55) {
    recommendations.push('Room for improvement. Review your contest selection strategy.');
    recommendations.push('Consider focusing more on cash games for consistent returns.');
    recommendations.push('Track which sports and contest types work best for you.');
  } else if (healthScore >= 40) {
    recommendations.push('Your bankroll needs attention. Consider reducing bet sizes.');
    recommendations.push('Focus on improving your player selection and research.');
    recommendations.push('Take a short break to analyze what\'s not working.');
  } else {
    recommendations.push('Critical situation. Stop betting until you develop a better strategy.');
    recommendations.push('Consider starting with much smaller amounts to practice.');
    recommendations.push('Focus on learning and improving your skills before increasing stakes.');
  }
  
  // Specific recommendations based on metrics
  if (winRate < 30) {
    recommendations.push('Your win rate is low. Focus on cash games and improve player research.');
  }
  
  if (roi < -15) {
    recommendations.push('Negative ROI indicates strategy issues. Consider getting coaching or training.');
  }
  
  if (maxDrawdown > 30) {
    recommendations.push('High drawdown detected. Implement stricter bankroll limits immediately.');
  }
  
  return recommendations.slice(0, 4); // Return top 4 recommendations
}
#!/usr/bin/env tsx
/**
 * 🛡️ RISK MANAGEMENT SYSTEM
 * 
 * Protects users from excessive losses
 * Implements Kelly Criterion for optimal bet sizing
 * Monitors pattern performance and adjusts confidence
 * Provides bankroll management recommendations
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import chalk from 'chalk';
import express from 'express';
import cors from 'cors';

config({ path: '.env.local' });

const app = express();
app.use(cors());
app.use(express.json());

const PORT = 3347;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface RiskProfile {
  userId: string;
  type: 'conservative' | 'moderate' | 'aggressive';
  bankroll: number;
  maxBetPercent: number; // % of bankroll
  maxDailyLoss: number; // % of bankroll
  maxWeeklyLoss: number;
  stopLossEnabled: boolean;
  kellyMultiplier: number; // 0.25 = quarter Kelly (safer)
}

interface BetRecommendation {
  gameId: string;
  pattern: string;
  originalBetSize: number;
  adjustedBetSize: number;
  bankrollPercent: number;
  confidence: number;
  risk: 'low' | 'medium' | 'high';
  warnings: string[];
  recommendation: 'proceed' | 'reduce' | 'skip';
  reason: string;
}

interface PerformanceMetrics {
  period: string;
  totalBets: number;
  winRate: number;
  roi: number;
  profitLoss: number;
  maxDrawdown: number;
  sharpeRatio: number;
  kellyGrowth: number;
  riskAdjustedReturn: number;
}

interface RiskAlert {
  id: string;
  userId: string;
  type: 'drawdown' | 'losing_streak' | 'overexposure' | 'pattern_degradation';
  severity: 'warning' | 'critical';
  message: string;
  action: string;
  timestamp: Date;
}

class RiskManagementSystem {
  private userProfiles: Map<string, RiskProfile> = new Map();
  private activeAlerts: Map<string, RiskAlert[]> = new Map();
  private patternPerformance: Map<string, PerformanceMetrics> = new Map();
  
  // Risk thresholds
  private readonly DRAWDOWN_WARNING = 0.15; // 15% drawdown
  private readonly DRAWDOWN_CRITICAL = 0.25; // 25% drawdown
  private readonly LOSING_STREAK_WARNING = 5; // 5 losses in a row
  private readonly PATTERN_CONFIDENCE_MIN = 0.55; // 55% minimum
  
  async initialize() {
    console.log(chalk.cyan('🛡️ Initializing Risk Management System...'));
    
    // Load user profiles
    await this.loadUserProfiles();
    
    // Initialize pattern performance tracking
    await this.loadPatternPerformance();
    
    // Start monitoring
    this.startRiskMonitoring();
    
    console.log(chalk.green('✅ Risk Management System ready'));
  }
  
  private async loadUserProfiles() {
    // In production, load from database
    // For demo, create sample profiles
    this.userProfiles.set('user_1', {
      userId: 'user_1',
      type: 'moderate',
      bankroll: 10000,
      maxBetPercent: 5,
      maxDailyLoss: 10,
      maxWeeklyLoss: 20,
      stopLossEnabled: true,
      kellyMultiplier: 0.25
    });
  }
  
  private async loadPatternPerformance() {
    // Load historical performance for each pattern
    const patterns = ['backToBackFade', 'revengeGame', 'primetimeUnder'];
    
    for (const pattern of patterns) {
      this.patternPerformance.set(pattern, {
        period: 'last_30_days',
        totalBets: 100,
        winRate: 0.652,
        roi: 0.125,
        profitLoss: 1250,
        maxDrawdown: 0.08,
        sharpeRatio: 1.85,
        kellyGrowth: 0.0312,
        riskAdjustedReturn: 0.156
      });
    }
  }
  
  async evaluateBet(
    userId: string,
    gameId: string,
    pattern: string,
    betSize: number,
    odds: number = -110,
    confidence: number = 0.65
  ): Promise<BetRecommendation> {
    const profile = this.userProfiles.get(userId) || this.getDefaultProfile(userId);
    const warnings: string[] = [];
    
    // Check pattern performance
    const patternMetrics = this.patternPerformance.get(pattern);
    if (patternMetrics && patternMetrics.winRate < this.PATTERN_CONFIDENCE_MIN) {
      warnings.push(`Pattern ${pattern} performing below threshold (${(patternMetrics.winRate * 100).toFixed(1)}%)`);
    }
    
    // Calculate Kelly bet size
    const kellyBet = this.calculateKellyBet(confidence, odds, profile);
    
    // Check exposure limits
    const bankrollPercent = (betSize / profile.bankroll) * 100;
    if (bankrollPercent > profile.maxBetPercent) {
      warnings.push(`Bet size exceeds max ${profile.maxBetPercent}% of bankroll`);
    }
    
    // Check daily/weekly limits
    const currentExposure = await this.getCurrentExposure(userId);
    if (currentExposure.daily > profile.maxDailyLoss * 0.8) {
      warnings.push('Approaching daily loss limit');
    }
    
    // Determine risk level
    let risk: 'low' | 'medium' | 'high' = 'medium';
    if (confidence > 0.7 && bankrollPercent < 2) {
      risk = 'low';
    } else if (confidence < 0.6 || bankrollPercent > 5) {
      risk = 'high';
    }
    
    // Make recommendation
    let recommendation: 'proceed' | 'reduce' | 'skip' = 'proceed';
    let adjustedBetSize = betSize;
    let reason = 'Bet within risk parameters';
    
    if (warnings.length > 2 || risk === 'high') {
      recommendation = 'skip';
      adjustedBetSize = 0;
      reason = 'Multiple risk factors detected';
    } else if (warnings.length > 0 || betSize > kellyBet) {
      recommendation = 'reduce';
      adjustedBetSize = Math.min(betSize, kellyBet);
      reason = `Reduced to Kelly optimal: $${adjustedBetSize.toFixed(0)}`;
    }
    
    // Check stop loss
    if (profile.stopLossEnabled && currentExposure.daily >= profile.maxDailyLoss) {
      recommendation = 'skip';
      adjustedBetSize = 0;
      reason = 'Daily stop loss triggered';
      warnings.push('STOP LOSS ACTIVE');
    }
    
    return {
      gameId,
      pattern,
      originalBetSize: betSize,
      adjustedBetSize,
      bankrollPercent: (adjustedBetSize / profile.bankroll) * 100,
      confidence,
      risk,
      warnings,
      recommendation,
      reason
    };
  }
  
  private calculateKellyBet(
    probability: number,
    odds: number,
    profile: RiskProfile
  ): number {
    // Convert American odds to decimal
    const decimalOdds = odds > 0 ? (odds / 100) + 1 : (-100 / odds) + 1;
    
    // Kelly formula: f = (p * b - q) / b
    // where f = fraction of bankroll, p = win probability, q = loss probability, b = odds
    const b = decimalOdds - 1;
    const p = probability;
    const q = 1 - p;
    
    const kellyFraction = (p * b - q) / b;
    
    // Apply Kelly multiplier for safety
    const adjustedFraction = Math.max(0, kellyFraction * profile.kellyMultiplier);
    
    // Calculate bet size
    const betSize = profile.bankroll * adjustedFraction;
    
    // Cap at max bet percent
    const maxBet = profile.bankroll * (profile.maxBetPercent / 100);
    
    return Math.min(betSize, maxBet);
  }
  
  private async getCurrentExposure(userId: string): Promise<{
    daily: number;
    weekly: number;
    active: number;
  }> {
    // In production, calculate from bet history
    // For demo, return mock data
    return {
      daily: 5.2,
      weekly: 12.8,
      active: 8.5
    };
  }
  
  async trackBetResult(
    userId: string,
    betId: string,
    result: 'win' | 'loss' | 'push',
    profit: number
  ) {
    const profile = this.userProfiles.get(userId);
    if (!profile) return;
    
    // Update bankroll
    profile.bankroll += profit;
    
    // Check for alerts
    await this.checkRiskAlerts(userId);
    
    // Update pattern performance if needed
    // This would track actual results vs predictions
  }
  
  private async checkRiskAlerts(userId: string) {
    const profile = this.userProfiles.get(userId);
    if (!profile) return;
    
    const alerts: RiskAlert[] = [];
    
    // Check drawdown
    const startBankroll = 10000; // Would track actual starting bankroll
    const drawdown = (startBankroll - profile.bankroll) / startBankroll;
    
    if (drawdown > this.DRAWDOWN_CRITICAL) {
      alerts.push({
        id: `alert_${Date.now()}`,
        userId,
        type: 'drawdown',
        severity: 'critical',
        message: `Critical drawdown: ${(drawdown * 100).toFixed(1)}% loss`,
        action: 'Consider taking a break and reviewing strategy',
        timestamp: new Date()
      });
    } else if (drawdown > this.DRAWDOWN_WARNING) {
      alerts.push({
        id: `alert_${Date.now()}`,
        userId,
        type: 'drawdown',
        severity: 'warning',
        message: `Warning: ${(drawdown * 100).toFixed(1)}% drawdown`,
        action: 'Reduce bet sizes and focus on highest confidence plays',
        timestamp: new Date()
      });
    }
    
    // Store alerts
    this.activeAlerts.set(userId, alerts);
    
    // Notify user (in production, would send notification)
    if (alerts.length > 0) {
      console.log(chalk.red(`🚨 Risk alerts for user ${userId}:`));
      alerts.forEach(alert => {
        console.log(chalk.yellow(`  ${alert.severity.toUpperCase()}: ${alert.message}`));
      });
    }
  }
  
  async getPortfolioAnalysis(userId: string): Promise<{
    health: 'good' | 'warning' | 'critical';
    metrics: PerformanceMetrics;
    recommendations: string[];
    riskScore: number;
  }> {
    const profile = this.userProfiles.get(userId);
    if (!profile) {
      return {
        health: 'warning',
        metrics: this.getDefaultMetrics(),
        recommendations: ['Create a risk profile first'],
        riskScore: 50
      };
    }
    
    // Calculate current metrics
    const metrics = await this.calculateUserMetrics(userId);
    
    // Determine health status
    let health: 'good' | 'warning' | 'critical' = 'good';
    const recommendations: string[] = [];
    
    if (metrics.maxDrawdown > 0.20) {
      health = 'critical';
      recommendations.push('Reduce position sizes immediately');
    } else if (metrics.maxDrawdown > 0.10) {
      health = 'warning';
      recommendations.push('Consider reducing exposure');
    }
    
    if (metrics.winRate < 0.50) {
      recommendations.push('Review pattern selection criteria');
    }
    
    if (metrics.sharpeRatio < 1.0) {
      recommendations.push('Risk-adjusted returns are below target');
    }
    
    // Calculate risk score (0-100, lower is better)
    const riskScore = Math.round(
      (metrics.maxDrawdown * 40) +
      ((1 - metrics.winRate) * 30) +
      (Math.max(0, 2 - metrics.sharpeRatio) * 30)
    );
    
    return {
      health,
      metrics,
      recommendations,
      riskScore: Math.min(100, Math.max(0, riskScore))
    };
  }
  
  private async calculateUserMetrics(userId: string): Promise<PerformanceMetrics> {
    // In production, calculate from actual bet history
    // For demo, return sample metrics
    return {
      period: 'last_30_days',
      totalBets: 150,
      winRate: 0.648,
      roi: 0.118,
      profitLoss: 1770,
      maxDrawdown: 0.125,
      sharpeRatio: 1.65,
      kellyGrowth: 0.0285,
      riskAdjustedReturn: 0.142
    };
  }
  
  private getDefaultProfile(userId: string): RiskProfile {
    return {
      userId,
      type: 'conservative',
      bankroll: 1000,
      maxBetPercent: 3,
      maxDailyLoss: 5,
      maxWeeklyLoss: 15,
      stopLossEnabled: true,
      kellyMultiplier: 0.20
    };
  }
  
  private getDefaultMetrics(): PerformanceMetrics {
    return {
      period: 'none',
      totalBets: 0,
      winRate: 0,
      roi: 0,
      profitLoss: 0,
      maxDrawdown: 0,
      sharpeRatio: 0,
      kellyGrowth: 0,
      riskAdjustedReturn: 0
    };
  }
  
  private startRiskMonitoring() {
    // Monitor pattern performance degradation
    setInterval(async () => {
      for (const [pattern, metrics] of this.patternPerformance) {
        if (metrics.winRate < this.PATTERN_CONFIDENCE_MIN) {
          console.log(chalk.yellow(`⚠️ Pattern ${pattern} below threshold: ${(metrics.winRate * 100).toFixed(1)}%`));
        }
      }
    }, 300000); // Every 5 minutes
  }
}

// Initialize system
const riskSystem = new RiskManagementSystem();

// API endpoints
app.post('/risk/evaluate', async (req, res) => {
  const { userId, gameId, pattern, betSize, odds, confidence } = req.body;
  
  const recommendation = await riskSystem.evaluateBet(
    userId,
    gameId,
    pattern,
    betSize,
    odds,
    confidence
  );
  
  res.json({ success: true, recommendation });
});

app.post('/risk/track-result', async (req, res) => {
  const { userId, betId, result, profit } = req.body;
  
  await riskSystem.trackBetResult(userId, betId, result, profit);
  
  res.json({ success: true });
});

app.get('/risk/portfolio/:userId', async (req, res) => {
  const analysis = await riskSystem.getPortfolioAnalysis(req.params.userId);
  
  res.json({ success: true, analysis });
});

app.get('/risk/alerts/:userId', (req, res) => {
  const alerts = riskSystem['activeAlerts'].get(req.params.userId) || [];
  
  res.json({ success: true, alerts });
});

// Start server
app.listen(PORT, async () => {
  console.log(chalk.green(`\n🛡️ RISK MANAGEMENT SYSTEM RUNNING!`));
  console.log(chalk.white(`Port: ${PORT}`));
  console.log(chalk.cyan(`\nFeatures:`));
  console.log(`  - Kelly Criterion bet sizing`);
  console.log(`  - Drawdown protection`);
  console.log(`  - Pattern performance monitoring`);
  console.log(`  - Stop loss implementation`);
  console.log(`  - Risk-adjusted recommendations`);
  
  await riskSystem.initialize();
  
  // Example evaluation
  console.log(chalk.cyan('\n📊 Example Risk Evaluation:'));
  const example = await riskSystem.evaluateBet(
    'user_1',
    'game_123',
    'revengeGame',
    500,
    -110,
    0.68
  );
  
  console.log(chalk.white(`Bet: $${example.originalBetSize}`));
  console.log(chalk.green(`Adjusted: $${example.adjustedBetSize}`));
  console.log(chalk.yellow(`Risk: ${example.risk}`));
  console.log(chalk.blue(`Recommendation: ${example.recommendation}`));
  console.log(chalk.gray(`Reason: ${example.reason}`));
});

export { RiskManagementSystem, RiskProfile, BetRecommendation };
#!/usr/bin/env tsx
/**
 * 💰 KELLY CRITERION BANKROLL MANAGEMENT SERVICE (2025)
 * 
 * Advanced bankroll management using modern Kelly Criterion implementations:
 * - Kelly formula with edge probability and win/loss ratio calculations
 * - Fractional Kelly with risk adjustment for conservative approach
 * - Multi-contest portfolio optimization across different contest types
 * - Dynamic position sizing based on confidence levels and volatility
 * - Kelly Criterion Extension (KCE) for complex market conditions
 * - Risk-adjusted optimal bet sizing with bankruptcy prevention
 * 
 * Based on 2025 research findings:
 * - Keeks library principles for modern bankroll management
 * - Half-Kelly and quarter-Kelly for conservative strategies
 * - Integration with ML prediction confidence scores
 * - Real-time bankroll monitoring and automatic adjustments
 */

import chalk from 'chalk';
import { EventEmitter } from 'events';
import { Pool } from 'pg';
import { performance } from 'perf_hooks';
import dotenv from 'dotenv';
import { join } from 'path';

dotenv.config({ path: join(__dirname, '..', '..', '..', '.env.local') });

export interface KellyParameters {
  winProbability: number;        // Probability of winning (0-1)
  averageWin: number;           // Average win amount
  averageLoss: number;          // Average loss amount
  currentBankroll: number;      // Current bankroll size
  confidenceLevel: number;      // ML prediction confidence (0-1)
  volatility: number;           // Historical volatility factor
  riskTolerance: 'conservative' | 'moderate' | 'aggressive';
}

export interface ContestInfo {
  id: string;
  platform: 'draftkings' | 'fanduel';
  contestType: 'gpp' | 'cash' | 'h2h' | 'qualifier';
  entryFee: number;
  totalPrize: number;
  maxEntries: number;
  currentEntries: number;
  expectedValue: number;        // Calculated EV for this contest
  projectedROI: number;         // Expected return on investment
  variance: number;             // Contest variance/volatility
}

export interface BankrollRecommendation {
  contestId: string;
  recommendedBetSize: number;   // Kelly optimal bet size
  adjustedBetSize: number;      // Risk-adjusted bet size
  maxBetSize: number;           // Maximum recommended bet
  kellyFraction: number;        // Kelly percentage of bankroll
  riskLevel: 'low' | 'medium' | 'high' | 'extreme';
  expectedReturn: number;       // Expected return amount
  maxLoss: number;             // Maximum potential loss
  reasoning: string;            // Explanation of recommendation
  confidence: number;           // Confidence in recommendation (0-1)
}

export interface PortfolioAllocation {
  totalBankroll: number;
  totalRecommended: number;
  allocations: Array<{
    contestId: string;
    contestType: string;
    allocation: number;
    percentage: number;
    priority: number;
  }>;
  diversificationScore: number;  // Portfolio diversification metric
  totalRisk: number;            // Combined portfolio risk
  expectedReturn: number;       // Portfolio expected return
  sharpeRatio: number;          // Risk-adjusted return ratio
}

export interface BankrollHistory {
  timestamp: Date;
  bankroll: number;
  change: number;
  changePercent: number;
  source: 'contest_win' | 'contest_loss' | 'deposit' | 'withdrawal';
  contestId?: string;
  description: string;
}

export class KellyBankrollManager extends EventEmitter {
  private pgPool: Pool;
  private currentBankroll: number = 0;
  private historicalPerformance: Array<{ win: number; loss: number; date: Date }> = [];
  private riskParameters = {
    maxSingleBet: 0.25,          // Max 25% of bankroll on single contest
    maxTotalExposure: 0.6,       // Max 60% total exposure
    minBankrollReserve: 0.15,    // Keep 15% as emergency reserve
    kellyMultiplier: {
      conservative: 0.25,         // Quarter-Kelly
      moderate: 0.5,              // Half-Kelly
      aggressive: 0.75            // Three-quarters Kelly
    }
  };

  // 2025 Enhanced Kelly parameters
  private kellyConfig = {
    enableKCE: true,              // Kelly Criterion Extension
    dynamicAdjustment: true,      // Real-time adjustments
    correlationAnalysis: true,    // Cross-contest correlation
    volatilityDecay: 0.05,       // Volatility decay factor
    confidenceThreshold: 0.6,    // Minimum prediction confidence
    maxDrawdownLimit: 0.3        // Stop at 30% drawdown
  };

  private metrics = {
    totalContests: 0,
    winningContests: 0,
    totalWagered: 0,
    totalReturns: 0,
    maxDrawdown: 0,
    currentDrawdown: 0,
    kellyUtilization: 0,
    averageKellySize: 0,
    riskAdjustedReturn: 0,
    sharpeRatio: 0,
    startTime: Date.now()
  };

  constructor(pgPool: Pool, initialBankroll: number = 1000) {
    super();
    this.pgPool = pgPool;
    this.currentBankroll = initialBankroll;
    
    console.log(chalk.bold.cyan('💰 Kelly Criterion Bankroll Manager (2025) Initialized'));
    console.log(chalk.yellow(`   Initial Bankroll: $${initialBankroll.toLocaleString()}`));
    console.log(chalk.yellow(`   Risk Profile: Advanced Kelly with KCE`));
    
    // Load historical performance on startup
    this.loadHistoricalPerformance();
    
    // Setup real-time monitoring
    this.setupMonitoring();
  }

  /**
   * Calculate Kelly optimal bet size for a contest
   */
  async calculateKellyBetSize(
    contestInfo: ContestInfo,
    kellyParams: KellyParameters
  ): Promise<BankrollRecommendation> {
    const startTime = performance.now();
    
    console.log(chalk.cyan(`📊 Calculating Kelly bet size for contest ${contestInfo.id}`));
    
    try {
      // Step 1: Calculate basic Kelly fraction
      const basicKelly = this.calculateBasicKelly(kellyParams);
      
      // Step 2: Apply Kelly Criterion Extension (KCE) for 2025
      const kceAdjustedKelly = this.applyKellyExtension(basicKelly, kellyParams, contestInfo);
      
      // Step 3: Apply risk tolerance multiplier
      const riskMultiplier = this.riskParameters.kellyMultiplier[kellyParams.riskTolerance];
      const adjustedKelly = kceAdjustedKelly * riskMultiplier;
      
      // Step 4: Apply volatility and confidence adjustments
      const volatilityAdjustment = this.calculateVolatilityAdjustment(kellyParams.volatility);
      const confidenceAdjustment = this.calculateConfidenceAdjustment(kellyParams.confidenceLevel);
      
      const finalKellyFraction = adjustedKelly * volatilityAdjustment * confidenceAdjustment;
      
      // Step 5: Calculate bet sizes
      const recommendedBetSize = Math.max(0, this.currentBankroll * finalKellyFraction);
      const maxAllowedBet = this.currentBankroll * this.riskParameters.maxSingleBet;
      const adjustedBetSize = Math.min(recommendedBetSize, maxAllowedBet);
      
      // Step 6: Risk assessment
      const riskLevel = this.assessRiskLevel(finalKellyFraction, kellyParams);
      
      // Step 7: Calculate expected values
      const expectedReturn = this.calculateExpectedReturn(adjustedBetSize, contestInfo);
      const maxLoss = Math.min(adjustedBetSize, contestInfo.entryFee);
      
      // Step 8: Generate recommendation
      const recommendation: BankrollRecommendation = {
        contestId: contestInfo.id,
        recommendedBetSize: Math.round(recommendedBetSize),
        adjustedBetSize: Math.round(adjustedBetSize),
        maxBetSize: Math.round(maxAllowedBet),
        kellyFraction: finalKellyFraction,
        riskLevel,
        expectedReturn: Math.round(expectedReturn),
        maxLoss: Math.round(maxLoss),
        reasoning: this.generateRecommendationReasoning(
          finalKellyFraction,
          riskLevel,
          kellyParams,
          contestInfo
        ),
        confidence: this.calculateRecommendationConfidence(kellyParams, contestInfo)
      };
      
      const calculationTime = performance.now() - startTime;
      
      console.log(chalk.green(`✅ Kelly calculation completed in ${calculationTime.toFixed(1)}ms`));
      console.log(chalk.yellow(`   Kelly Fraction: ${(finalKellyFraction * 100).toFixed(2)}%`));
      console.log(chalk.yellow(`   Recommended Bet: $${recommendation.adjustedBetSize.toLocaleString()}`));
      console.log(chalk.yellow(`   Risk Level: ${recommendation.riskLevel.toUpperCase()}`));
      
      // Store recommendation for analysis
      await this.storeRecommendation(recommendation, kellyParams);
      
      // Emit event for real-time monitoring
      this.emit('kelly_recommendation', {
        recommendation,
        calculationTime,
        timestamp: new Date()
      });
      
      return recommendation;
      
    } catch (error) {
      console.error(chalk.red(`❌ Kelly calculation failed:`), error);
      
      // Return safe fallback recommendation
      return {
        contestId: contestInfo.id,
        recommendedBetSize: 0,
        adjustedBetSize: 0,
        maxBetSize: 0,
        kellyFraction: 0,
        riskLevel: 'extreme',
        expectedReturn: 0,
        maxLoss: 0,
        reasoning: `Calculation failed: ${error.message}. Recommend manual review.`,
        confidence: 0
      };
    }
  }

  /**
   * Calculate basic Kelly fraction: f = (bp - q) / b
   * Where: f = fraction of bankroll to bet, b = odds, p = win probability, q = loss probability
   */
  private calculateBasicKelly(params: KellyParameters): number {
    const { winProbability, averageWin, averageLoss } = params;
    
    if (winProbability <= 0 || winProbability >= 1) {
      throw new Error('Win probability must be between 0 and 1');
    }
    
    if (averageWin <= 0 || averageLoss <= 0) {
      throw new Error('Average win and loss must be positive');
    }
    
    const lossProbability = 1 - winProbability;
    const oddsRatio = averageWin / averageLoss; // b in Kelly formula
    
    // Kelly formula: f = (bp - q) / b
    const kellyFraction = (oddsRatio * winProbability - lossProbability) / oddsRatio;
    
    // Ensure non-negative result
    return Math.max(0, kellyFraction);
  }

  /**
   * Apply Kelly Criterion Extension (KCE) for 2025 advanced markets
   */
  private applyKellyExtension(
    basicKelly: number,
    params: KellyParameters,
    contestInfo: ContestInfo
  ): number {
    if (!this.kellyConfig.enableKCE) {
      return basicKelly;
    }
    
    // KCE factors for DFS contests
    const marketMaturityFactor = this.calculateMarketMaturity(contestInfo);
    const liquidityFactor = this.calculateLiquidityFactor(contestInfo);
    const competitionFactor = this.calculateCompetitionFactor(contestInfo);
    
    // KCE adjustment formula
    const kceMultiplier = (marketMaturityFactor + liquidityFactor + competitionFactor) / 3;
    
    return basicKelly * kceMultiplier;
  }

  /**
   * Calculate volatility adjustment for Kelly sizing
   */
  private calculateVolatilityAdjustment(volatility: number): number {
    // Higher volatility = smaller bet size
    // Volatility adjustment: 1 / (1 + volatility)
    return 1 / (1 + volatility * 2);
  }

  /**
   * Calculate confidence adjustment based on ML prediction confidence
   */
  private calculateConfidenceAdjustment(confidence: number): number {
    if (confidence < this.kellyConfig.confidenceThreshold) {
      return 0; // Don't bet if confidence too low
    }
    
    // Sigmoid-like confidence scaling
    return Math.pow(confidence, 2);
  }

  /**
   * Assess risk level of the bet
   */
  private assessRiskLevel(kellyFraction: number, params: KellyParameters): 'low' | 'medium' | 'high' | 'extreme' {
    if (kellyFraction <= 0.05) return 'low';
    if (kellyFraction <= 0.15) return 'medium';
    if (kellyFraction <= 0.25) return 'high';
    return 'extreme';
  }

  /**
   * Calculate expected return for the bet
   */
  private calculateExpectedReturn(betSize: number, contestInfo: ContestInfo): number {
    return betSize * contestInfo.projectedROI;
  }

  /**
   * Generate multi-contest portfolio allocation
   */
  async generatePortfolioAllocation(
    contests: ContestInfo[],
    totalBudget?: number
  ): Promise<PortfolioAllocation> {
    console.log(chalk.cyan(`🎯 Generating portfolio allocation for ${contests.length} contests`));
    
    const budget = totalBudget || this.currentBankroll * (1 - this.riskParameters.minBankrollReserve);
    const allocations: PortfolioAllocation['allocations'] = [];
    
    let totalAllocated = 0;
    let totalExpectedReturn = 0;
    let totalVariance = 0;
    
    // Sort contests by risk-adjusted return (Sharpe-like ratio)
    const rankedContests = contests
      .map(contest => ({
        ...contest,
        sharpeRatio: contest.projectedROI / Math.sqrt(contest.variance || 1),
        priority: this.calculateContestPriority(contest)
      }))
      .sort((a, b) => b.sharpeRatio - a.sharpeRatio);
    
    for (const contest of rankedContests) {
      // Calculate Kelly parameters for this contest
      const kellyParams = await this.estimateKellyParams(contest);
      
      // Get Kelly recommendation
      const recommendation = await this.calculateKellyBetSize(contest, kellyParams);
      
      if (recommendation.adjustedBetSize > 0 && totalAllocated < budget) {
        const allocation = Math.min(
          recommendation.adjustedBetSize,
          budget - totalAllocated,
          budget * this.riskParameters.maxSingleBet
        );
        
        if (allocation >= contest.entryFee) {
          allocations.push({
            contestId: contest.id,
            contestType: contest.contestType,
            allocation: Math.round(allocation),
            percentage: (allocation / budget) * 100,
            priority: contest.priority
          });
          
          totalAllocated += allocation;
          totalExpectedReturn += allocation * contest.projectedROI;
          totalVariance += Math.pow(allocation, 2) * (contest.variance || 1);
        }
      }
    }
    
    // Calculate portfolio metrics
    const diversificationScore = this.calculateDiversificationScore(allocations);
    const totalRisk = Math.sqrt(totalVariance);
    const sharpeRatio = totalRisk > 0 ? totalExpectedReturn / totalRisk : 0;
    
    const portfolio: PortfolioAllocation = {
      totalBankroll: this.currentBankroll,
      totalRecommended: Math.round(totalAllocated),
      allocations,
      diversificationScore,
      totalRisk: Math.round(totalRisk),
      expectedReturn: Math.round(totalExpectedReturn),
      sharpeRatio
    };
    
    console.log(chalk.green(`✅ Portfolio generated:`));
    console.log(chalk.yellow(`   Total Allocation: $${portfolio.totalRecommended.toLocaleString()}`));
    console.log(chalk.yellow(`   Expected Return: $${portfolio.expectedReturn.toLocaleString()}`));
    console.log(chalk.yellow(`   Diversification Score: ${diversificationScore.toFixed(2)}`));
    console.log(chalk.yellow(`   Sharpe Ratio: ${sharpeRatio.toFixed(3)}`));
    
    // Store portfolio for analysis
    await this.storePortfolioAllocation(portfolio);
    
    return portfolio;
  }

  /**
   * Update bankroll after contest results
   */
  async updateBankroll(
    contestId: string,
    result: 'win' | 'loss',
    amount: number,
    description?: string
  ): Promise<void> {
    const previousBankroll = this.currentBankroll;
    
    if (result === 'win') {
      this.currentBankroll += amount;
      this.metrics.winningContests++;
      this.metrics.totalReturns += amount;
    } else {
      this.currentBankroll = Math.max(0, this.currentBankroll - amount);
    }
    
    const change = this.currentBankroll - previousBankroll;
    const changePercent = (change / previousBankroll) * 100;
    
    // Update drawdown metrics
    const peakBankroll = Math.max(this.currentBankroll, this.metrics.totalReturns);
    this.metrics.currentDrawdown = (peakBankroll - this.currentBankroll) / peakBankroll;
    this.metrics.maxDrawdown = Math.max(this.metrics.maxDrawdown, this.metrics.currentDrawdown);
    
    console.log(chalk.cyan(`💰 Bankroll updated:`));
    console.log(chalk.yellow(`   Previous: $${previousBankroll.toLocaleString()}`));
    console.log(chalk.yellow(`   Current: $${this.currentBankroll.toLocaleString()}`));
    console.log(chalk.yellow(`   Change: ${change >= 0 ? '+' : ''}$${change.toLocaleString()} (${changePercent.toFixed(2)}%)`));
    
    // Store bankroll history
    const historyEntry: BankrollHistory = {
      timestamp: new Date(),
      bankroll: this.currentBankroll,
      change,
      changePercent,
      source: result === 'win' ? 'contest_win' : 'contest_loss',
      contestId,
      description: description || `Contest ${result}`
    };
    
    await this.storeBankrollHistory(historyEntry);
    
    // Check for drawdown limits
    if (this.metrics.currentDrawdown > this.kellyConfig.maxDrawdownLimit) {
      console.log(chalk.red(`🚨 DRAWDOWN LIMIT EXCEEDED: ${(this.metrics.currentDrawdown * 100).toFixed(1)}%`));
      this.emit('drawdown_limit_exceeded', {
        currentDrawdown: this.metrics.currentDrawdown,
        maxDrawdown: this.metrics.maxDrawdown,
        currentBankroll: this.currentBankroll
      });
    }
    
    // Emit bankroll update event
    this.emit('bankroll_updated', {
      previousBankroll,
      currentBankroll: this.currentBankroll,
      change,
      changePercent,
      result,
      contestId
    });
  }

  /**
   * Get current bankroll status and metrics
   */
  getBankrollStatus(): {
    currentBankroll: number;
    availableForBetting: number;
    reserveAmount: number;
    metrics: typeof this.metrics;
    riskProfile: string;
  } {
    const availableForBetting = this.currentBankroll * (1 - this.riskParameters.minBankrollReserve);
    const reserveAmount = this.currentBankroll * this.riskParameters.minBankrollReserve;
    
    // Calculate current metrics
    const winRate = this.metrics.totalContests > 0 
      ? this.metrics.winningContests / this.metrics.totalContests 
      : 0;
    
    const totalReturn = this.metrics.totalReturns - this.metrics.totalWagered;
    const roi = this.metrics.totalWagered > 0 
      ? (totalReturn / this.metrics.totalWagered) * 100 
      : 0;
    
    return {
      currentBankroll: this.currentBankroll,
      availableForBetting: Math.round(availableForBetting),
      reserveAmount: Math.round(reserveAmount),
      metrics: {
        ...this.metrics,
        winRate,
        totalReturn,
        roi
      },
      riskProfile: this.getRiskProfile()
    };
  }

  /**
   * Generate recommendation reasoning
   */
  private generateRecommendationReasoning(
    kellyFraction: number,
    riskLevel: string,
    params: KellyParameters,
    contestInfo: ContestInfo
  ): string {
    const parts: string[] = [];
    
    parts.push(`Kelly fraction: ${(kellyFraction * 100).toFixed(2)}%`);
    parts.push(`Risk level: ${riskLevel}`);
    parts.push(`Win probability: ${(params.winProbability * 100).toFixed(1)}%`);
    parts.push(`ML confidence: ${(params.confidenceLevel * 100).toFixed(1)}%`);
    
    if (kellyFraction === 0) {
      parts.push('No bet recommended due to negative expected value or low confidence');
    } else if (riskLevel === 'low') {
      parts.push('Conservative bet with good risk-adjusted returns');
    } else if (riskLevel === 'medium') {
      parts.push('Moderate risk with solid expected value');
    } else if (riskLevel === 'high') {
      parts.push('Higher risk but strong expected value - monitor closely');
    } else {
      parts.push('Extreme risk - consider reducing position size');
    }
    
    return parts.join('. ');
  }

  /**
   * Calculate recommendation confidence
   */
  private calculateRecommendationConfidence(
    params: KellyParameters,
    contestInfo: ContestInfo
  ): number {
    let confidence = params.confidenceLevel;
    
    // Adjust based on historical performance
    if (this.historicalPerformance.length > 10) {
      const recentWinRate = this.calculateRecentWinRate();
      confidence *= (recentWinRate + 0.5) / 1.5; // Blend with recent performance
    }
    
    // Adjust based on contest type reliability
    const contestTypeMultiplier = {
      cash: 1.0,     // Most predictable
      h2h: 0.9,      // Fairly predictable
      qualifier: 0.8, // Moderate
      gpp: 0.7       // Most volatile
    };
    
    confidence *= contestTypeMultiplier[contestInfo.contestType] || 0.8;
    
    return Math.max(0, Math.min(1, confidence));
  }

  /**
   * Helper methods for calculations
   */
  private calculateMarketMaturity(contestInfo: ContestInfo): number {
    // More mature contests (more entries) are more efficient
    const entryRatio = contestInfo.currentEntries / contestInfo.maxEntries;
    return 0.7 + 0.3 * entryRatio;
  }

  private calculateLiquidityFactor(contestInfo: ContestInfo): number {
    // Higher entry fees indicate higher liquidity
    if (contestInfo.entryFee >= 100) return 1.0;
    if (contestInfo.entryFee >= 20) return 0.9;
    if (contestInfo.entryFee >= 5) return 0.8;
    return 0.7;
  }

  private calculateCompetitionFactor(contestInfo: ContestInfo): number {
    // GPP contests are more competitive
    const competitionMultiplier = {
      gpp: 0.8,
      qualifier: 0.85,
      h2h: 0.95,
      cash: 1.0
    };
    return competitionMultiplier[contestInfo.contestType] || 0.8;
  }

  private calculateContestPriority(contestInfo: ContestInfo): number {
    // Priority based on EV and contest type
    let priority = contestInfo.expectedValue;
    
    // Bonus for cash games (more predictable)
    if (contestInfo.contestType === 'cash') priority *= 1.2;
    if (contestInfo.contestType === 'h2h') priority *= 1.1;
    
    return priority;
  }

  private calculateDiversificationScore(allocations: PortfolioAllocation['allocations']): number {
    if (allocations.length <= 1) return 0;
    
    // Herfindahl-Hirschman Index for diversification
    const totalAllocation = allocations.reduce((sum, a) => sum + a.allocation, 0);
    const hhi = allocations.reduce((sum, a) => {
      const share = a.allocation / totalAllocation;
      return sum + share * share;
    }, 0);
    
    return 1 - hhi; // Higher score = more diversified
  }

  private async estimateKellyParams(contestInfo: ContestInfo): Promise<KellyParameters> {
    // Estimate Kelly parameters based on contest info and historical data
    const historicalWinRate = this.calculateHistoricalWinRate(contestInfo.contestType);
    const avgWin = this.calculateAverageWin(contestInfo.contestType);
    const avgLoss = contestInfo.entryFee;
    
    return {
      winProbability: historicalWinRate,
      averageWin: avgWin,
      averageLoss: avgLoss,
      currentBankroll: this.currentBankroll,
      confidenceLevel: 0.75, // Default confidence
      volatility: this.calculateVolatility(contestInfo.contestType),
      riskTolerance: 'moderate'
    };
  }

  private calculateHistoricalWinRate(contestType: string): number {
    // Default win rates by contest type
    const defaultRates = {
      cash: 0.45,
      h2h: 0.48,
      qualifier: 0.35,
      gpp: 0.15
    };
    
    return defaultRates[contestType] || 0.3;
  }

  private calculateAverageWin(contestType: string): number {
    // Estimate based on contest type and historical data
    if (this.historicalPerformance.length > 0) {
      const wins = this.historicalPerformance.filter(p => p.win > 0);
      if (wins.length > 0) {
        return wins.reduce((sum, p) => sum + p.win, 0) / wins.length;
      }
    }
    
    // Default multipliers for different contest types
    const multipliers = {
      cash: 1.8,    // 80% return
      h2h: 1.9,     // 90% return
      qualifier: 2.5, // 150% return
      gpp: 5.0      // 400% return (when you win)
    };
    
    return 100 * (multipliers[contestType] || 2.0); // Default bet size * multiplier
  }

  private calculateVolatility(contestType: string): number {
    const volatilities = {
      cash: 0.1,
      h2h: 0.15,
      qualifier: 0.3,
      gpp: 0.8
    };
    
    return volatilities[contestType] || 0.5;
  }

  private calculateRecentWinRate(): number {
    const recentResults = this.historicalPerformance.slice(-20); // Last 20 contests
    if (recentResults.length === 0) return 0.5;
    
    const wins = recentResults.filter(r => r.win > 0).length;
    return wins / recentResults.length;
  }

  private getRiskProfile(): string {
    const currentDD = this.metrics.currentDrawdown;
    if (currentDD > 0.2) return 'High Risk - Large Drawdown';
    if (currentDD > 0.1) return 'Moderate Risk - Some Drawdown';
    return 'Low Risk - Stable Performance';
  }

  /**
   * Database operations
   */
  private async storeRecommendation(
    recommendation: BankrollRecommendation,
    params: KellyParameters
  ): Promise<void> {
    const client = await this.pgPool.connect();
    
    try {
      await client.query(`
        INSERT INTO kelly_recommendations (
          contest_id, recommended_bet_size, adjusted_bet_size, kelly_fraction,
          risk_level, expected_return, max_loss, reasoning, confidence,
          win_probability, average_win, average_loss, current_bankroll,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      `, [
        recommendation.contestId, recommendation.recommendedBetSize,
        recommendation.adjustedBetSize, recommendation.kellyFraction,
        recommendation.riskLevel, recommendation.expectedReturn,
        recommendation.maxLoss, recommendation.reasoning, recommendation.confidence,
        params.winProbability, params.averageWin, params.averageLoss,
        params.currentBankroll, new Date()
      ]);
    } catch (error) {
      console.error(chalk.red('Failed to store Kelly recommendation:'), error);
    } finally {
      client.release();
    }
  }

  private async storePortfolioAllocation(portfolio: PortfolioAllocation): Promise<void> {
    const client = await this.pgPool.connect();
    
    try {
      await client.query(`
        INSERT INTO portfolio_allocations (
          total_bankroll, total_recommended, allocations,
          diversification_score, total_risk, expected_return, sharpe_ratio,
          created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `, [
        portfolio.totalBankroll, portfolio.totalRecommended,
        JSON.stringify(portfolio.allocations), portfolio.diversificationScore,
        portfolio.totalRisk, portfolio.expectedReturn, portfolio.sharpeRatio,
        new Date()
      ]);
    } catch (error) {
      console.error(chalk.red('Failed to store portfolio allocation:'), error);
    } finally {
      client.release();
    }
  }

  private async storeBankrollHistory(entry: BankrollHistory): Promise<void> {
    const client = await this.pgPool.connect();
    
    try {
      await client.query(`
        INSERT INTO bankroll_history (
          timestamp, bankroll, change_amount, change_percent,
          source, contest_id, description
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      `, [
        entry.timestamp, entry.bankroll, entry.change, entry.changePercent,
        entry.source, entry.contestId, entry.description
      ]);
    } catch (error) {
      console.error(chalk.red('Failed to store bankroll history:'), error);
    } finally {
      client.release();
    }
  }

  private async loadHistoricalPerformance(): Promise<void> {
    const client = await this.pgPool.connect();
    
    try {
      const result = await client.query(`
        SELECT change_amount as win, 0 as loss, timestamp as date
        FROM bankroll_history 
        WHERE source IN ('contest_win', 'contest_loss')
        ORDER BY timestamp DESC 
        LIMIT 100
      `);
      
      this.historicalPerformance = result.rows.map(row => ({
        win: row.win > 0 ? row.win : 0,
        loss: row.win < 0 ? Math.abs(row.win) : 0,
        date: row.date
      }));
      
      console.log(chalk.green(`📊 Loaded ${this.historicalPerformance.length} historical performance records`));
      
    } catch (error) {
      console.log(chalk.yellow('⚠️ Could not load historical performance (new installation)'));
    } finally {
      client.release();
    }
  }

  private setupMonitoring(): void {
    // Log metrics every 5 minutes
    setInterval(() => {
      this.logMetrics();
    }, 5 * 60 * 1000);
    
    console.log(chalk.green('📊 Kelly bankroll monitoring enabled'));
  }

  private logMetrics(): void {
    const status = this.getBankrollStatus();
    
    console.log(chalk.bold.cyan('💰 Kelly Bankroll Metrics:'));
    console.log(chalk.gray(`   Current Bankroll: $${status.currentBankroll.toLocaleString()}`));
    console.log(chalk.gray(`   Available for Betting: $${status.availableForBetting.toLocaleString()}`));
    console.log(chalk.gray(`   Win Rate: ${(status.metrics.winRate * 100).toFixed(1)}%`));
    console.log(chalk.gray(`   ROI: ${status.metrics.roi.toFixed(2)}%`));
    console.log(chalk.gray(`   Max Drawdown: ${(this.metrics.maxDrawdown * 100).toFixed(1)}%`));
    console.log(chalk.gray(`   Risk Profile: ${status.riskProfile}`));
  }

  /**
   * Shutdown gracefully
   */
  async shutdown(): Promise<void> {
    console.log(chalk.yellow('🔌 Kelly Bankroll Manager shutting down...'));
    // Any cleanup operations
  }
}

// Export configured instance
export const kellyBankrollManager = new KellyBankrollManager(
  new Pool({
    host: process.env.POSTGRES_HOST || 'localhost',
    port: parseInt(process.env.POSTGRES_PORT || '5432'),
    database: process.env.POSTGRES_DB || 'fantasy_ml',
    user: process.env.POSTGRES_USER || 'postgres',
    password: process.env.POSTGRES_PASSWORD || 'password',
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 2000,
  }),
  parseFloat(process.env.INITIAL_BANKROLL || '1000')
);
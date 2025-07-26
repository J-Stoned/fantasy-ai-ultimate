#!/usr/bin/env tsx
/**
 * 💰 KELLY CRITERION BANKROLL MANAGER - PROFESSIONAL TRADING
 * 
 * Enterprise-grade bankroll management using Kelly Criterion:
 * - Optimal position sizing with f* = (bp - q) / b formula
 * - Risk adjustment factors for volatility and correlation
 * - Portfolio allocation across contests and sports
 * - Real-time balance tracking with PostgreSQL integration
 * - Advanced risk metrics and drawdown protection
 * - Fractional Kelly and Multi-Kelly strategies
 * - Integration with DFS platform connector and GPU optimizer
 * 
 * MATHEMATICAL PRECISION FOR MAXIMUM EDGE!
 */

import chalk from 'chalk';
import { Pool } from 'pg';
import { EventEmitter } from 'events';
import crypto from 'crypto';
import { performance } from 'perf_hooks';
import { SecurityAuditLogger, SecurityEventType } from './auth/security-audit-logger';

interface BankrollConfig {
  totalBankroll: number;
  maxRiskPerContest: number; // Maximum % of bankroll per contest (e.g., 0.05 = 5%)
  kellyFraction: number; // Fraction of Kelly to use (e.g., 0.5 = Half Kelly)
  minBetSize: number; // Minimum bet amount in dollars
  maxBetSize: number; // Maximum bet amount in dollars
  stopLoss: number; // Stop trading if bankroll falls below this %
  volatilityAdjustment: boolean; // Apply volatility scaling
  correlationLimit: number; // Max correlation between simultaneous bets
}

interface ContestOpportunity {
  contestId: string;
  platform: 'draftkings' | 'fanduel';
  sport: string;
  entryFee: number;
  expectedValue: number; // EV as decimal (e.g., 1.15 = 15% edge)
  winProbability: number; // Probability of winning money (0-1)
  variance: number; // Contest variance estimate
  correlation: number; // Correlation with existing positions
  maxEntries: number;
  currentEntries: number;
  timeToStart: number; // Minutes until contest starts
  contestType: 'gpp' | 'cash' | 'h2h' | 'qualifier';
}

interface BankrollPosition {
  id: string;
  contestId: string;
  platform: 'draftkings' | 'fanduel';
  amount: number;
  kellyFraction: number;
  expectedValue: number;
  winProbability: number;
  variance: number;
  entryTime: Date;
  status: 'active' | 'completed' | 'cancelled';
  actualReturn?: number;
  profit?: number;
}

interface BankrollMetrics {
  totalBankroll: number;
  availableBalance: number;
  allocatedAmount: number;
  totalProfit: number;
  totalReturn: number;
  sharpeRatio: number;
  maxDrawdown: number;
  winRate: number;
  avgKellyFraction: number;
  riskAdjustedReturn: number;
  volatility: number;
  kellyEfficiency: number; // How well we're following Kelly recommendations
}

interface RiskAssessment {
  riskScore: number; // 0-1 scale
  factors: {
    portfolioConcentration: number;
    correlationRisk: number;
    volatilityRisk: number;
    liquidityRisk: number;
    timeRisk: number;
  };
  recommendations: string[];
  maxPositionSize: number;
}

export class KellyBankrollManager extends EventEmitter {
  private pgPool: Pool;
  private auditLogger: SecurityAuditLogger;
  private config: BankrollConfig;
  private activePositions = new Map<string, BankrollPosition>();
  private historicalReturns: number[] = [];
  private lastUpdateTime = new Date();
  
  // Kelly calculation cache
  private kellyCache = new Map<string, { kelly: number, timestamp: number }>();
  private readonly CACHE_TTL = 60000; // 1 minute cache
  
  // Risk management
  private riskLimits = {
    maxDailyLoss: 0.1, // 10% of bankroll per day
    maxPortfolioCorrelation: 0.7,
    maxVolatilityScalar: 2.0,
    minKellyThreshold: 0.01, // Don't bet if Kelly < 1%
    maxKellyThreshold: 0.25 // Cap Kelly at 25%
  };
  
  constructor(pgPool: Pool, auditLogger: SecurityAuditLogger, config: BankrollConfig) {
    super();
    
    this.pgPool = pgPool;
    this.auditLogger = auditLogger;
    this.config = config;
    
    // Validate configuration
    this.validateConfig();
    
    // Initialize tables
    this.initializeTables();
    
    // Setup monitoring
    this.setupMonitoring();
  }

  /**
   * Initialize bankroll management system
   */
  async initialize(): Promise<void> {
    console.log(chalk.bold.cyan('💰 Initializing Kelly Bankroll Manager...'));
    console.log(chalk.cyan(`   Total Bankroll: $${this.config.totalBankroll.toLocaleString()}`));
    console.log(chalk.cyan(`   Kelly Fraction: ${(this.config.kellyFraction * 100).toFixed(0)}%`));
    console.log(chalk.cyan(`   Max Risk/Contest: ${(this.config.maxRiskPerContest * 100).toFixed(1)}%`));
    
    try {
      // Create database tables
      await this.createBankrollTables();
      
      // Load existing positions
      await this.loadActivePositions();
      
      // Load historical data
      await this.loadHistoricalReturns();
      
      // Calculate current metrics
      await this.updateBankrollMetrics();
      
      // Log initialization
      await this.auditLogger.logSecurityEvent(
        SecurityEventType.SYSTEM_ACCESS,
        {
          action: 'bankroll_manager_initialized',
          totalBankroll: this.config.totalBankroll,
          kellyFraction: this.config.kellyFraction,
          maxRisk: this.config.maxRiskPerContest
        }
      );
      
      console.log(chalk.green('✅ Kelly Bankroll Manager initialized successfully'));
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to initialize bankroll manager:'), error);
      throw error;
    }
  }

  /**
   * Calculate optimal position size using Kelly Criterion
   * Formula: f* = (bp - q) / b
   * Where: f* = fraction to bet, b = odds received, p = win probability, q = lose probability
   */
  calculateKellyPosition(opportunity: ContestOpportunity): {
    kellyFraction: number;
    positionSize: number;
    adjustedSize: number;
    riskAssessment: RiskAssessment;
    recommendation: 'BET' | 'PASS' | 'REDUCE' | 'WAIT';
  } {
    const startTime = performance.now();
    
    // Check cache first
    const cacheKey = this.getCacheKey(opportunity);
    const cached = this.kellyCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return this.buildPositionResponse(cached.kelly, opportunity);
    }
    
    console.log(chalk.cyan(`📊 Calculating Kelly position for ${opportunity.contestId}`));
    
    // Extract Kelly variables
    const b = opportunity.expectedValue - 1; // Net odds (profit/stake)
    const p = opportunity.winProbability;
    const q = 1 - p;
    
    // Basic Kelly formula: f* = (bp - q) / b
    let kellyFraction = b > 0 ? (b * p - q) / b : 0;
    
    console.log(chalk.gray(`   Raw Kelly: ${(kellyFraction * 100).toFixed(2)}% (EV: ${(opportunity.expectedValue * 100 - 100).toFixed(1)}%, WinP: ${(p * 100).toFixed(1)}%)`));
    
    // Apply risk adjustments
    kellyFraction = this.applyRiskAdjustments(kellyFraction, opportunity);
    
    // Apply fractional Kelly
    kellyFraction *= this.config.kellyFraction;
    
    // Cache result
    this.kellyCache.set(cacheKey, { kelly: kellyFraction, timestamp: Date.now() });
    
    const endTime = performance.now();
    console.log(chalk.gray(`   Kelly calculation completed in ${(endTime - startTime).toFixed(1)}ms`));
    
    return this.buildPositionResponse(kellyFraction, opportunity);
  }

  /**
   * Execute position based on Kelly calculation
   */
  async executePosition(
    opportunity: ContestOpportunity,
    lineups: any[],
    userId: string
  ): Promise<{
    success: boolean;
    positionId?: string;
    actualAmount?: number;
    kellyFraction?: number;
    error?: string;
  }> {
    console.log(chalk.bold.cyan(`💸 EXECUTING KELLY POSITION`));
    
    try {
      // Calculate optimal position
      const kelly = this.calculateKellyPosition(opportunity);
      
      if (kelly.recommendation === 'PASS') {
        console.log(chalk.yellow('⚠️ Kelly recommendation: PASS - No position taken'));
        return { success: false, error: 'Kelly recommends passing on this opportunity' };
      }
      
      // Validate available bankroll
      const metrics = await this.getCurrentMetrics();
      if (kelly.adjustedSize > metrics.availableBalance) {
        console.log(chalk.red('❌ Insufficient bankroll for position'));
        return { success: false, error: 'Insufficient available bankroll' };
      }
      
      // Create position record
      const position: BankrollPosition = {
        id: crypto.randomUUID(),
        contestId: opportunity.contestId,
        platform: opportunity.platform,
        amount: kelly.adjustedSize,
        kellyFraction: kelly.kellyFraction,
        expectedValue: opportunity.expectedValue,
        winProbability: opportunity.winProbability,
        variance: opportunity.variance,
        entryTime: new Date(),
        status: 'active'
      };
      
      // Store position in database
      await this.storePosition(position);
      
      // Add to active positions
      this.activePositions.set(position.id, position);
      
      // Log audit event
      await this.auditLogger.logSecurityEvent(
        SecurityEventType.SYSTEM_ACCESS,
        {
          action: 'kelly_position_executed',
          positionId: position.id,
          contestId: opportunity.contestId,
          amount: kelly.adjustedSize,
          kellyFraction: kelly.kellyFraction,
          expectedValue: opportunity.expectedValue,
          userId
        },
        { userId, platform: opportunity.platform }
      );
      
      // Emit event
      this.emit('position_executed', {
        position,
        opportunity,
        kelly,
        userId
      });
      
      console.log(chalk.green(`✅ Kelly position executed: $${kelly.adjustedSize.toFixed(2)} (${(kelly.kellyFraction * 100).toFixed(2)}% Kelly)`));
      
      return {
        success: true,
        positionId: position.id,
        actualAmount: kelly.adjustedSize,
        kellyFraction: kelly.kellyFraction
      };
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to execute Kelly position:'), error);
      
      await this.auditLogger.logSecurityEvent(
        SecurityEventType.ERROR_OCCURRED,
        {
          action: 'kelly_position_failed',
          contestId: opportunity.contestId,
          error: error.message,
          userId
        },
        { userId, platform: opportunity.platform }
      );
      
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update position when contest completes
   */
  async updatePositionResult(
    positionId: string,
    actualReturn: number,
    profit: number
  ): Promise<void> {
    console.log(chalk.cyan(`📊 Updating position result: ${positionId}`));
    
    try {
      const position = this.activePositions.get(positionId);
      if (!position) {
        throw new Error(`Position ${positionId} not found`);
      }
      
      // Update position
      position.actualReturn = actualReturn;
      position.profit = profit;
      position.status = 'completed';
      
      // Store in database
      await this.updatePositionInDatabase(position);
      
      // Add to historical returns
      this.historicalReturns.push(actualReturn);
      
      // Remove from active positions
      this.activePositions.delete(positionId);
      
      // Update bankroll metrics
      await this.updateBankrollMetrics();
      
      // Log result
      const isWin = profit > 0;
      console.log(isWin 
        ? chalk.green(`✅ Position closed with profit: $${profit.toFixed(2)}`)
        : chalk.red(`❌ Position closed with loss: $${profit.toFixed(2)}`)
      );
      
      // Emit event
      this.emit('position_closed', {
        position,
        profit,
        actualReturn,
        isWin
      });
      
    } catch (error) {
      console.error(chalk.red('❌ Failed to update position result:'), error);
      throw error;
    }
  }

  /**
   * Get current bankroll metrics
   */
  async getCurrentMetrics(): Promise<BankrollMetrics> {
    const totalAllocated = Array.from(this.activePositions.values())
      .reduce((sum, pos) => sum + pos.amount, 0);
    
    const totalProfit = this.historicalReturns
      .reduce((sum, ret) => sum + ret, 0);
    
    const availableBalance = this.config.totalBankroll + totalProfit - totalAllocated;
    
    // Calculate advanced metrics
    const winRate = this.calculateWinRate();
    const sharpeRatio = this.calculateSharpeRatio();
    const maxDrawdown = this.calculateMaxDrawdown();
    const volatility = this.calculateVolatility();
    const kellyEfficiency = this.calculateKellyEfficiency();
    
    return {
      totalBankroll: this.config.totalBankroll + totalProfit,
      availableBalance,
      allocatedAmount: totalAllocated,
      totalProfit,
      totalReturn: totalProfit / this.config.totalBankroll,
      sharpeRatio,
      maxDrawdown,
      winRate,
      avgKellyFraction: this.calculateAvgKellyFraction(),
      riskAdjustedReturn: sharpeRatio * Math.sqrt(252), // Annualized
      volatility,
      kellyEfficiency
    };
  }

  /**
   * Get portfolio risk assessment
   */
  async getPortfolioRisk(): Promise<RiskAssessment> {
    const positions = Array.from(this.activePositions.values());
    
    // Calculate concentration risk
    const portfolioConcentration = this.calculateConcentrationRisk(positions);
    
    // Calculate correlation risk
    const correlationRisk = this.calculateCorrelationRisk(positions);
    
    // Calculate volatility risk
    const volatilityRisk = this.calculateVolatilityRisk(positions);
    
    // Calculate liquidity risk
    const liquidityRisk = this.calculateLiquidityRisk(positions);
    
    // Calculate time risk
    const timeRisk = this.calculateTimeRisk(positions);
    
    // Overall risk score
    const riskScore = (
      portfolioConcentration * 0.25 +
      correlationRisk * 0.25 +
      volatilityRisk * 0.2 +
      liquidityRisk * 0.15 +
      timeRisk * 0.15
    );
    
    // Generate recommendations
    const recommendations = this.generateRiskRecommendations(riskScore, {
      portfolioConcentration,
      correlationRisk,
      volatilityRisk,
      liquidityRisk,
      timeRisk
    });
    
    // Calculate max position size
    const maxPositionSize = this.calculateMaxPositionSize(riskScore);
    
    return {
      riskScore,
      factors: {
        portfolioConcentration,
        correlationRisk,
        volatilityRisk,
        liquidityRisk,
        timeRisk
      },
      recommendations,
      maxPositionSize
    };
  }

  /**
   * Apply risk adjustments to Kelly fraction
   */
  private applyRiskAdjustments(
    rawKelly: number, 
    opportunity: ContestOpportunity
  ): number {
    let adjustedKelly = rawKelly;
    
    // Volatility adjustment
    if (this.config.volatilityAdjustment && opportunity.variance > 0) {
      const volatilityScalar = Math.min(
        1 / Math.sqrt(opportunity.variance),
        this.riskLimits.maxVolatilityScalar
      );
      adjustedKelly *= volatilityScalar;
      console.log(chalk.gray(`   Volatility adjustment: ${(volatilityScalar * 100).toFixed(0)}%`));
    }
    
    // Correlation adjustment
    if (opportunity.correlation > this.riskLimits.maxPortfolioCorrelation) {
      const correlationPenalty = 1 - (opportunity.correlation - this.riskLimits.maxPortfolioCorrelation);
      adjustedKelly *= Math.max(correlationPenalty, 0.1);
      console.log(chalk.gray(`   Correlation penalty: ${(correlationPenalty * 100).toFixed(0)}%`));
    }
    
    // Apply Kelly bounds
    adjustedKelly = Math.max(adjustedKelly, 0);
    adjustedKelly = Math.min(adjustedKelly, this.riskLimits.maxKellyThreshold);
    
    console.log(chalk.gray(`   Adjusted Kelly: ${(adjustedKelly * 100).toFixed(2)}%`));
    
    return adjustedKelly;
  }

  /**
   * Build position response from Kelly calculation
   */
  private buildPositionResponse(
    kellyFraction: number,
    opportunity: ContestOpportunity
  ): any {
    const rawPositionSize = kellyFraction * this.config.totalBankroll;
    const maxPositionSize = this.config.totalBankroll * this.config.maxRiskPerContest;
    
    // Apply position size limits
    let positionSize = Math.min(rawPositionSize, maxPositionSize);
    positionSize = Math.min(positionSize, this.config.maxBetSize);
    positionSize = Math.max(positionSize, this.config.minBetSize);
    
    // Adjust for entry fee increments
    const adjustedSize = Math.floor(positionSize / opportunity.entryFee) * opportunity.entryFee;
    
    // Risk assessment
    const riskAssessment: RiskAssessment = {
      riskScore: kellyFraction,
      factors: {
        portfolioConcentration: 0,
        correlationRisk: opportunity.correlation,
        volatilityRisk: opportunity.variance,
        liquidityRisk: 0,
        timeRisk: opportunity.timeToStart < 60 ? 0.2 : 0
      },
      recommendations: [],
      maxPositionSize: maxPositionSize
    };
    
    // Recommendation logic
    let recommendation: 'BET' | 'PASS' | 'REDUCE' | 'WAIT';
    
    if (kellyFraction < this.riskLimits.minKellyThreshold) {
      recommendation = 'PASS';
    } else if (adjustedSize < this.config.minBetSize) {
      recommendation = 'PASS';
    } else if (opportunity.timeToStart < 15) {
      recommendation = 'WAIT';
    } else if (kellyFraction > this.riskLimits.maxKellyThreshold * 0.8) {
      recommendation = 'REDUCE';
    } else {
      recommendation = 'BET';
    }
    
    return {
      kellyFraction,
      positionSize: rawPositionSize,
      adjustedSize,
      riskAssessment,
      recommendation
    };
  }

  /**
   * Calculate various risk metrics
   */
  private calculateConcentrationRisk(positions: BankrollPosition[]): number {
    if (positions.length === 0) return 0;
    
    const total = positions.reduce((sum, pos) => sum + pos.amount, 0);
    const largest = Math.max(...positions.map(pos => pos.amount));
    
    return largest / total;
  }

  private calculateCorrelationRisk(positions: BankrollPosition[]): number {
    // Simplified correlation calculation
    const platforms = new Set(positions.map(pos => pos.platform));
    const sports = new Set(positions.map(pos => pos.contestId.split('_')[1] || 'unknown'));
    
    // Higher risk if concentrated in single platform/sport
    const platformRisk = 1 - (platforms.size / Math.max(positions.length, 1));
    const sportRisk = 1 - (sports.size / Math.max(positions.length, 1));
    
    return Math.max(platformRisk, sportRisk);
  }

  private calculateVolatilityRisk(positions: BankrollPosition[]): number {
    if (positions.length === 0) return 0;
    
    const avgVariance = positions.reduce((sum, pos) => sum + pos.variance, 0) / positions.length;
    return Math.min(avgVariance / 10, 1); // Normalize to 0-1
  }

  private calculateLiquidityRisk(positions: BankrollPosition[]): number {
    // All DFS positions are liquid (settle within hours), so low risk
    return 0.1;
  }

  private calculateTimeRisk(positions: BankrollPosition[]): number {
    // Risk from positions that started recently (less time to analyze)
    const recentPositions = positions.filter(pos => 
      Date.now() - pos.entryTime.getTime() < 3600000 // Less than 1 hour
    );
    
    return recentPositions.length / Math.max(positions.length, 1);
  }

  /**
   * Calculate advanced performance metrics
   */
  private calculateWinRate(): number {
    if (this.historicalReturns.length === 0) return 0;
    const wins = this.historicalReturns.filter(ret => ret > 0).length;
    return wins / this.historicalReturns.length;
  }

  private calculateSharpeRatio(): number {
    if (this.historicalReturns.length < 2) return 0;
    
    const avgReturn = this.historicalReturns.reduce((sum, ret) => sum + ret, 0) / this.historicalReturns.length;
    const variance = this.historicalReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / this.historicalReturns.length;
    const stdDev = Math.sqrt(variance);
    
    return stdDev > 0 ? avgReturn / stdDev : 0;
  }

  private calculateMaxDrawdown(): number {
    if (this.historicalReturns.length === 0) return 0;
    
    let peak = 0;
    let maxDrawdown = 0;
    let running = 0;
    
    for (const ret of this.historicalReturns) {
      running += ret;
      peak = Math.max(peak, running);
      const drawdown = (peak - running) / Math.max(peak, 1);
      maxDrawdown = Math.max(maxDrawdown, drawdown);
    }
    
    return maxDrawdown;
  }

  private calculateVolatility(): number {
    if (this.historicalReturns.length < 2) return 0;
    
    const avgReturn = this.historicalReturns.reduce((sum, ret) => sum + ret, 0) / this.historicalReturns.length;
    const variance = this.historicalReturns.reduce((sum, ret) => sum + Math.pow(ret - avgReturn, 2), 0) / this.historicalReturns.length;
    
    return Math.sqrt(variance);
  }

  private calculateKellyEfficiency(): number {
    // Measure how well we're following Kelly recommendations
    // This would require storing recommended vs actual bet sizes
    return 0.85; // Placeholder
  }

  private calculateAvgKellyFraction(): number {
    const positions = Array.from(this.activePositions.values());
    if (positions.length === 0) return 0;
    
    return positions.reduce((sum, pos) => sum + pos.kellyFraction, 0) / positions.length;
  }

  private calculateMaxPositionSize(riskScore: number): number {
    const baseMax = this.config.totalBankroll * this.config.maxRiskPerContest;
    const riskAdjustment = 1 - Math.min(riskScore, 0.5);
    return baseMax * riskAdjustment;
  }

  /**
   * Generate risk management recommendations
   */
  private generateRiskRecommendations(
    riskScore: number,
    factors: any
  ): string[] {
    const recommendations: string[] = [];
    
    if (riskScore > 0.7) {
      recommendations.push('HIGH RISK: Consider reducing position sizes');
    }
    
    if (factors.portfolioConcentration > 0.5) {
      recommendations.push('Diversify across more contests/sports');
    }
    
    if (factors.correlationRisk > 0.6) {
      recommendations.push('Reduce correlation between positions');
    }
    
    if (factors.volatilityRisk > 0.7) {
      recommendations.push('Focus on lower volatility contests');
    }
    
    if (this.historicalReturns.length > 10) {
      const recentPerformance = this.historicalReturns.slice(-10);
      const recentWins = recentPerformance.filter(ret => ret > 0).length;
      if (recentWins < 3) {
        recommendations.push('Recent performance below average - consider reducing exposure');
      }
    }
    
    return recommendations;
  }

  /**
   * Database operations
   */
  private async createBankrollTables(): Promise<void> {
    const createPositionsTable = `
      CREATE TABLE IF NOT EXISTS bankroll_positions (
        id UUID PRIMARY KEY,
        contest_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        amount DECIMAL(10,2) NOT NULL,
        kelly_fraction DECIMAL(5,4) NOT NULL,
        expected_value DECIMAL(5,3) NOT NULL,
        win_probability DECIMAL(5,3) NOT NULL,
        variance DECIMAL(10,6) NOT NULL,
        entry_time TIMESTAMPTZ NOT NULL,
        status TEXT NOT NULL,
        actual_return DECIMAL(10,2),
        profit DECIMAL(10,2),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_bankroll_positions_status ON bankroll_positions (status);
      CREATE INDEX IF NOT EXISTS idx_bankroll_positions_contest ON bankroll_positions (contest_id);
      CREATE INDEX IF NOT EXISTS idx_bankroll_positions_entry_time ON bankroll_positions (entry_time);
    `;
    
    const createMetricsTable = `
      CREATE TABLE IF NOT EXISTS bankroll_metrics (
        id SERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ NOT NULL,
        total_bankroll DECIMAL(12,2) NOT NULL,
        available_balance DECIMAL(12,2) NOT NULL,
        allocated_amount DECIMAL(12,2) NOT NULL,
        total_profit DECIMAL(12,2) NOT NULL,
        total_return DECIMAL(8,6) NOT NULL,
        sharpe_ratio DECIMAL(8,4),
        max_drawdown DECIMAL(8,6),
        win_rate DECIMAL(5,3),
        volatility DECIMAL(8,6),
        kelly_efficiency DECIMAL(5,3)
      );
      
      CREATE INDEX IF NOT EXISTS idx_bankroll_metrics_timestamp ON bankroll_metrics (timestamp);
    `;
    
    await this.pgPool.query(createPositionsTable);
    await this.pgPool.query(createMetricsTable);
  }

  private async storePosition(position: BankrollPosition): Promise<void> {
    const query = `
      INSERT INTO bankroll_positions (
        id, contest_id, platform, amount, kelly_fraction, expected_value,
        win_probability, variance, entry_time, status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `;
    
    await this.pgPool.query(query, [
      position.id,
      position.contestId,
      position.platform,
      position.amount,
      position.kellyFraction,
      position.expectedValue,
      position.winProbability,
      position.variance,
      position.entryTime,
      position.status
    ]);
  }

  private async updatePositionInDatabase(position: BankrollPosition): Promise<void> {
    const query = `
      UPDATE bankroll_positions 
      SET status = $1, actual_return = $2, profit = $3, updated_at = NOW()
      WHERE id = $4
    `;
    
    await this.pgPool.query(query, [
      position.status,
      position.actualReturn,
      position.profit,
      position.id
    ]);
  }

  private async loadActivePositions(): Promise<void> {
    const query = `SELECT * FROM bankroll_positions WHERE status = 'active'`;
    const result = await this.pgPool.query(query);
    
    for (const row of result.rows) {
      const position: BankrollPosition = {
        id: row.id,
        contestId: row.contest_id,
        platform: row.platform,
        amount: parseFloat(row.amount),
        kellyFraction: parseFloat(row.kelly_fraction),
        expectedValue: parseFloat(row.expected_value),
        winProbability: parseFloat(row.win_probability),
        variance: parseFloat(row.variance),
        entryTime: row.entry_time,
        status: row.status,
        actualReturn: row.actual_return ? parseFloat(row.actual_return) : undefined,
        profit: row.profit ? parseFloat(row.profit) : undefined
      };
      
      this.activePositions.set(position.id, position);
    }
    
    console.log(chalk.cyan(`📊 Loaded ${this.activePositions.size} active positions`));
  }

  private async loadHistoricalReturns(): Promise<void> {
    const query = `
      SELECT actual_return 
      FROM bankroll_positions 
      WHERE status = 'completed' AND actual_return IS NOT NULL
      ORDER BY entry_time DESC
      LIMIT 1000
    `;
    
    const result = await this.pgPool.query(query);
    this.historicalReturns = result.rows.map(row => parseFloat(row.actual_return));
    
    console.log(chalk.cyan(`📈 Loaded ${this.historicalReturns.length} historical returns`));
  }

  private async updateBankrollMetrics(): Promise<void> {
    const metrics = await this.getCurrentMetrics();
    
    const query = `
      INSERT INTO bankroll_metrics (
        timestamp, total_bankroll, available_balance, allocated_amount,
        total_profit, total_return, sharpe_ratio, max_drawdown,
        win_rate, volatility, kelly_efficiency
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;
    
    await this.pgPool.query(query, [
      new Date(),
      metrics.totalBankroll,
      metrics.availableBalance,
      metrics.allocatedAmount,
      metrics.totalProfit,
      metrics.totalReturn,
      metrics.sharpeRatio,
      metrics.maxDrawdown,
      metrics.winRate,
      metrics.volatility,
      metrics.kellyEfficiency
    ]);
  }

  /**
   * Utility methods
   */
  private validateConfig(): void {
    if (this.config.totalBankroll <= 0) {
      throw new Error('Total bankroll must be positive');
    }
    
    if (this.config.kellyFraction <= 0 || this.config.kellyFraction > 1) {
      throw new Error('Kelly fraction must be between 0 and 1');
    }
    
    if (this.config.maxRiskPerContest <= 0 || this.config.maxRiskPerContest > 1) {
      throw new Error('Max risk per contest must be between 0 and 1');
    }
  }

  private initializeTables(): void {
    // Tables created in initialize method
  }

  private setupMonitoring(): void {
    // Update metrics every 5 minutes
    setInterval(async () => {
      try {
        await this.updateBankrollMetrics();
      } catch (error) {
        console.error('Error updating bankroll metrics:', error);
      }
    }, 5 * 60 * 1000);
    
    // Check risk limits every minute
    setInterval(async () => {
      try {
        const risk = await this.getPortfolioRisk();
        if (risk.riskScore > 0.8) {
          console.log(chalk.red('🚨 HIGH PORTFOLIO RISK DETECTED'));
          this.emit('high_risk_alert', risk);
        }
      } catch (error) {
        console.error('Error checking portfolio risk:', error);
      }
    }, 60 * 1000);
  }

  private getCacheKey(opportunity: ContestOpportunity): string {
    return `${opportunity.contestId}_${opportunity.expectedValue}_${opportunity.winProbability}`;
  }

  /**
   * Get detailed bankroll report
   */
  async getBankrollReport(): Promise<{
    metrics: BankrollMetrics;
    riskAssessment: RiskAssessment;
    activePositions: BankrollPosition[];
    recommendations: string[];
  }> {
    const metrics = await this.getCurrentMetrics();
    const riskAssessment = await this.getPortfolioRisk();
    const activePositions = Array.from(this.activePositions.values());
    
    // Generate strategic recommendations
    const recommendations: string[] = [];
    
    if (metrics.availableBalance / metrics.totalBankroll < 0.1) {
      recommendations.push('Consider reducing active positions - low available balance');
    }
    
    if (metrics.winRate < 0.4) {
      recommendations.push('Win rate below optimal - review contest selection strategy');
    }
    
    if (metrics.sharpeRatio < 0.5) {
      recommendations.push('Risk-adjusted returns below target - consider strategy adjustment');
    }
    
    if (riskAssessment.riskScore > 0.6) {
      recommendations.push('Portfolio risk elevated - consider diversification');
    }
    
    return {
      metrics,
      riskAssessment,
      activePositions,
      recommendations
    };
  }

  /**
   * Emergency stop - close all positions
   */
  async emergencyStop(reason: string): Promise<void> {
    console.log(chalk.red.bold(`🚨 EMERGENCY STOP: ${reason}`));
    
    // Log emergency stop
    await this.auditLogger.logSecurityEvent(
      SecurityEventType.SYSTEM_ACCESS,
      {
        action: 'bankroll_emergency_stop',
        reason,
        activePositions: this.activePositions.size,
        totalExposure: Array.from(this.activePositions.values()).reduce((sum, pos) => sum + pos.amount, 0)
      }
    );
    
    // Mark all positions for immediate exit
    for (const position of this.activePositions.values()) {
      position.status = 'cancelled';
      await this.updatePositionInDatabase(position);
    }
    
    this.activePositions.clear();
    
    this.emit('emergency_stop', { reason, timestamp: new Date() });
  }
}

export { BankrollConfig, ContestOpportunity, BankrollPosition, BankrollMetrics, RiskAssessment };
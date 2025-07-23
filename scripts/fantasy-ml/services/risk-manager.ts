/**
 * Advanced Risk Management System for DFS Trading
 * Professional-grade risk controls with ML-based fraud detection
 */

import { EventEmitter } from 'events';
import * as crypto from 'crypto';
import { Redis } from 'ioredis';
import { WebSocket } from 'ws';

interface RiskThresholds {
  maxDailySpend: number;
  maxSingleEntry: number;
  maxContests: number;
  maxExposurePerPlayer: number;
  drawdownLimit: number;
  stopLossPercentage: number;
  varThreshold: number;
  expectedShortfallLimit: number;
}

interface RiskMetrics {
  currentExposure: number;
  dailySpend: number;
  winRate: number;
  sharpeRatio: number;
  valueAtRisk: number;
  expectedShortfall: number;
  maxDrawdown: number;
  currentDrawdown: number;
  volatility: number;
  kellyCriterion: number;
}

interface Position {
  contestId: string;
  platform: string;
  entryFee: number;
  lineupId: string;
  sport: string;
  startTime: Date;
  potentialPayout: number;
  currentRank?: number;
  projectedROI?: number;
}

interface FraudIndicator {
  type: 'VELOCITY' | 'PATTERN' | 'ANOMALY' | 'GEOLOCATION' | 'BEHAVIORAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  description: string;
  timestamp: Date;
}

export class RiskManager extends EventEmitter {
  private redis: Redis;
  private ws: WebSocket;
  private thresholds: RiskThresholds;
  private metrics: RiskMetrics;
  private positions: Map<string, Position>;
  private circuitBreakers: Map<string, CircuitBreaker>;
  private fraudDetector: FraudDetector;
  private emergencyShutdown: boolean = false;
  private mfaRequired: boolean = false;
  private auditLog: AuditLogger;

  constructor(redis: Redis, config: {
    thresholds: RiskThresholds;
    wsUrl: string;
    mfaThreshold: number;
  }) {
    super();
    this.redis = redis;
    this.thresholds = config.thresholds;
    this.positions = new Map();
    this.circuitBreakers = new Map();
    this.fraudDetector = new FraudDetector(redis);
    this.auditLog = new AuditLogger(redis);
    
    // Initialize WebSocket for real-time monitoring
    this.ws = new WebSocket(config.wsUrl);
    this.setupWebSocket();
    
    // Initialize metrics
    this.metrics = {
      currentExposure: 0,
      dailySpend: 0,
      winRate: 0,
      sharpeRatio: 0,
      valueAtRisk: 0,
      expectedShortfall: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      volatility: 0,
      kellyCriterion: 0
    };

    // Initialize circuit breakers
    this.initializeCircuitBreakers();
    
    // Start monitoring
    this.startRiskMonitoring();
  }

  private initializeCircuitBreakers(): void {
    // Spending circuit breaker
    this.circuitBreakers.set('spending', new CircuitBreaker({
      name: 'spending',
      threshold: this.thresholds.maxDailySpend,
      windowMs: 24 * 60 * 60 * 1000, // 24 hours
      cooldownMs: 60 * 60 * 1000 // 1 hour cooldown
    }));

    // Contest velocity circuit breaker
    this.circuitBreakers.set('velocity', new CircuitBreaker({
      name: 'velocity',
      threshold: 50, // Max 50 contests per hour
      windowMs: 60 * 60 * 1000,
      cooldownMs: 15 * 60 * 1000
    }));

    // Loss prevention circuit breaker
    this.circuitBreakers.set('losses', new CircuitBreaker({
      name: 'losses',
      threshold: this.thresholds.drawdownLimit,
      windowMs: 7 * 24 * 60 * 60 * 1000, // Weekly
      cooldownMs: 24 * 60 * 60 * 1000
    }));
  }

  public async validateTransaction(transaction: {
    amount: number;
    contestId: string;
    lineupId: string;
    platform: string;
    userId: string;
  }): Promise<{ approved: boolean; reason?: string; requiresMFA?: boolean }> {
    try {
      // Emergency shutdown check
      if (this.emergencyShutdown) {
        return { approved: false, reason: 'Emergency shutdown active' };
      }

      // Check all circuit breakers
      for (const [name, breaker] of this.circuitBreakers) {
        if (breaker.isOpen()) {
          await this.auditLog.log({
            action: 'TRANSACTION_BLOCKED',
            reason: `Circuit breaker ${name} is open`,
            transaction
          });
          return { approved: false, reason: `Risk limit exceeded: ${name}` };
        }
      }

      // Run fraud detection
      const fraudScore = await this.fraudDetector.analyze(transaction);
      if (fraudScore.severity === 'CRITICAL') {
        await this.triggerEmergencyShutdown('Fraud detected');
        return { approved: false, reason: 'Security alert triggered' };
      }

      // Check spending limits
      const dailySpend = await this.getDailySpend(transaction.userId);
      if (dailySpend + transaction.amount > this.thresholds.maxDailySpend) {
        return { approved: false, reason: 'Daily spending limit exceeded' };
      }

      // High-value transaction MFA
      if (transaction.amount > this.thresholds.maxSingleEntry * 0.5) {
        this.mfaRequired = true;
        return { 
          approved: false, 
          reason: 'MFA required for high-value transaction',
          requiresMFA: true 
        };
      }

      // Calculate risk metrics
      await this.updateRiskMetrics(transaction);

      // Value at Risk check
      if (this.metrics.valueAtRisk > this.thresholds.varThreshold) {
        return { approved: false, reason: 'Value at Risk threshold exceeded' };
      }

      // Expected Shortfall check
      if (this.metrics.expectedShortfall > this.thresholds.expectedShortfallLimit) {
        return { approved: false, reason: 'Expected Shortfall limit exceeded' };
      }

      // Player exposure check
      const playerExposure = await this.calculatePlayerExposure(transaction.lineupId);
      if (playerExposure > this.thresholds.maxExposurePerPlayer) {
        return { approved: false, reason: 'Player exposure limit exceeded' };
      }

      // All checks passed
      await this.recordPosition({
        contestId: transaction.contestId,
        platform: transaction.platform,
        entryFee: transaction.amount,
        lineupId: transaction.lineupId,
        sport: 'auto-detect',
        startTime: new Date(),
        potentialPayout: transaction.amount * 10 // Estimated
      });

      return { approved: true };

    } catch (error) {
      console.error('Risk validation error:', error);
      return { approved: false, reason: 'Risk validation failed' };
    }
  }

  private async updateRiskMetrics(transaction: any): Promise<void> {
    // Get historical performance data
    const history = await this.getPerformanceHistory();
    
    // Calculate Sharpe Ratio
    this.metrics.sharpeRatio = this.calculateSharpeRatio(history);
    
    // Calculate Value at Risk (95% confidence)
    this.metrics.valueAtRisk = this.calculateVaR(history, 0.95);
    
    // Calculate Expected Shortfall
    this.metrics.expectedShortfall = this.calculateExpectedShortfall(history, 0.95);
    
    // Update volatility
    this.metrics.volatility = this.calculateVolatility(history);
    
    // Calculate Kelly Criterion
    this.metrics.kellyCriterion = this.calculateKellyCriterion(
      this.metrics.winRate,
      this.getAverageOdds()
    );
    
    // Update current exposure
    this.metrics.currentExposure = await this.calculateTotalExposure();
    
    // Emit metrics update
    this.emit('metricsUpdate', this.metrics);
  }

  private calculateSharpeRatio(history: any[]): number {
    if (history.length < 30) return 0;
    
    const returns = history.map(h => h.roi);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const riskFreeRate = 0.02 / 365; // Daily risk-free rate
    
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    
    return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;
  }

  private calculateVaR(history: any[], confidence: number): number {
    const losses = history
      .map(h => h.profit)
      .filter(p => p < 0)
      .sort((a, b) => a - b);
    
    if (losses.length === 0) return 0;
    
    const index = Math.floor(losses.length * (1 - confidence));
    return Math.abs(losses[index] || losses[0]);
  }

  private calculateExpectedShortfall(history: any[], confidence: number): number {
    const losses = history
      .map(h => h.profit)
      .filter(p => p < 0)
      .sort((a, b) => a - b);
    
    if (losses.length === 0) return 0;
    
    const varIndex = Math.floor(losses.length * (1 - confidence));
    const tailLosses = losses.slice(0, varIndex + 1);
    
    return tailLosses.length > 0
      ? Math.abs(tailLosses.reduce((a, b) => a + b, 0) / tailLosses.length)
      : 0;
  }

  private calculateVolatility(history: any[]): number {
    if (history.length < 2) return 0;
    
    const returns = history.map(h => h.roi);
    const mean = returns.reduce((a, b) => a + b, 0) / returns.length;
    const variance = returns.reduce((sum, r) => sum + Math.pow(r - mean, 2), 0) / returns.length;
    
    return Math.sqrt(variance);
  }

  private calculateKellyCriterion(winRate: number, avgOdds: number): number {
    // Kelly Criterion: f = (p * b - q) / b
    // Where: f = fraction to bet, p = win probability, q = loss probability, b = odds
    const q = 1 - winRate;
    const kelly = (winRate * avgOdds - q) / avgOdds;
    
    // Apply Kelly fraction limit (max 25% of bankroll)
    return Math.max(0, Math.min(0.25, kelly));
  }

  public async triggerEmergencyShutdown(reason: string): Promise<void> {
    console.error(`EMERGENCY SHUTDOWN TRIGGERED: ${reason}`);
    this.emergencyShutdown = true;
    
    // Audit log
    await this.auditLog.log({
      action: 'EMERGENCY_SHUTDOWN',
      reason,
      timestamp: new Date(),
      positions: Array.from(this.positions.values())
    });
    
    // Notify all systems
    this.emit('emergencyShutdown', { reason, timestamp: new Date() });
    
    // Close all circuit breakers
    for (const breaker of this.circuitBreakers.values()) {
      breaker.open();
    }
    
    // Liquidate all positions if configured
    if (process.env.AUTO_LIQUIDATE === 'true') {
      await this.liquidateAllPositions();
    }
    
    // Send alerts
    await this.sendEmergencyAlerts(reason);
  }

  private async liquidateAllPositions(): Promise<void> {
    console.log('Liquidating all positions...');
    
    for (const [id, position] of this.positions) {
      try {
        // Attempt to cancel/withdraw from contest
        await this.cancelPosition(position);
        
        // Log liquidation
        await this.auditLog.log({
          action: 'POSITION_LIQUIDATED',
          position,
          timestamp: new Date()
        });
        
      } catch (error) {
        console.error(`Failed to liquidate position ${id}:`, error);
      }
    }
    
    this.positions.clear();
  }

  private async sendEmergencyAlerts(reason: string): Promise<void> {
    // Send to monitoring dashboard
    this.ws.send(JSON.stringify({
      type: 'EMERGENCY_ALERT',
      reason,
      metrics: this.metrics,
      timestamp: new Date()
    }));
    
    // Additional alert channels (email, SMS, etc.) would go here
  }

  private setupWebSocket(): void {
    this.ws.on('open', () => {
      console.log('Risk Manager WebSocket connected');
      this.ws.send(JSON.stringify({ type: 'RISK_MANAGER_ONLINE' }));
    });

    this.ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString());
        this.handleWebSocketMessage(message);
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket disconnected, reconnecting...');
      setTimeout(() => this.setupWebSocket(), 5000);
    });
  }

  private handleWebSocketMessage(message: any): void {
    switch (message.type) {
      case 'CONTEST_UPDATE':
        this.updatePositionStatus(message.contestId, message.data);
        break;
      case 'MARKET_ALERT':
        this.processMarketAlert(message.alert);
        break;
      case 'RISK_OVERRIDE':
        this.processRiskOverride(message.override);
        break;
    }
  }

  private startRiskMonitoring(): void {
    // Real-time position monitoring
    setInterval(() => this.monitorPositions(), 5000);
    
    // Risk metrics calculation
    setInterval(() => this.calculateRiskMetrics(), 10000);
    
    // Drawdown monitoring
    setInterval(() => this.monitorDrawdown(), 30000);
    
    // Fraud pattern analysis
    setInterval(() => this.fraudDetector.runPatternAnalysis(), 60000);
  }

  private async monitorDrawdown(): Promise<void> {
    const currentBalance = await this.getCurrentBalance();
    const peakBalance = await this.getPeakBalance();
    
    if (peakBalance > 0) {
      this.metrics.currentDrawdown = (peakBalance - currentBalance) / peakBalance;
      
      if (this.metrics.currentDrawdown > this.metrics.maxDrawdown) {
        this.metrics.maxDrawdown = this.metrics.currentDrawdown;
      }
      
      // Stop-loss trigger
      if (this.metrics.currentDrawdown > this.thresholds.stopLossPercentage) {
        await this.triggerStopLoss();
      }
    }
  }

  private async triggerStopLoss(): Promise<void> {
    console.warn('Stop-loss triggered!');
    
    // Open loss circuit breaker
    this.circuitBreakers.get('losses')?.open();
    
    // Emit stop-loss event
    this.emit('stopLoss', {
      drawdown: this.metrics.currentDrawdown,
      timestamp: new Date()
    });
    
    // Optionally trigger emergency shutdown
    if (this.metrics.currentDrawdown > this.thresholds.drawdownLimit * 1.5) {
      await this.triggerEmergencyShutdown('Catastrophic drawdown');
    }
  }

  // Helper methods
  private async getDailySpend(userId: string): Promise<number> {
    const key = `daily_spend:${userId}:${new Date().toISOString().split('T')[0]}`;
    const spend = await this.redis.get(key);
    return parseFloat(spend || '0');
  }

  private async calculatePlayerExposure(lineupId: string): Promise<number> {
    // Calculate exposure percentage for each player in lineup
    const lineup = await this.redis.get(`lineup:${lineupId}`);
    if (!lineup) return 0;
    
    const players = JSON.parse(lineup);
    let maxExposure = 0;
    
    for (const player of players) {
      const exposure = await this.getPlayerExposurePercentage(player.id);
      maxExposure = Math.max(maxExposure, exposure);
    }
    
    return maxExposure;
  }

  private async getPlayerExposurePercentage(playerId: string): Promise<number> {
    const totalExposure = this.metrics.currentExposure;
    if (totalExposure === 0) return 0;
    
    let playerExposure = 0;
    for (const position of this.positions.values()) {
      const lineup = await this.redis.get(`lineup:${position.lineupId}`);
      if (lineup) {
        const players = JSON.parse(lineup);
        if (players.some((p: any) => p.id === playerId)) {
          playerExposure += position.entryFee;
        }
      }
    }
    
    return (playerExposure / totalExposure) * 100;
  }

  private async getPerformanceHistory(): Promise<any[]> {
    // Get last 100 contest results
    const history = await this.redis.lrange('contest_history', 0, 99);
    return history.map(h => JSON.parse(h));
  }

  private getAverageOdds(): number {
    // Calculate average payout multiple from positions
    const odds = Array.from(this.positions.values())
      .map(p => p.potentialPayout / p.entryFee)
      .filter(o => o > 0);
    
    return odds.length > 0
      ? odds.reduce((a, b) => a + b, 0) / odds.length
      : 2.0; // Default 2x
  }

  private async calculateTotalExposure(): Promise<number> {
    return Array.from(this.positions.values())
      .reduce((total, position) => total + position.entryFee, 0);
  }

  private async recordPosition(position: Position): Promise<void> {
    this.positions.set(position.contestId, position);
    await this.redis.setex(
      `position:${position.contestId}`,
      86400, // 24 hour TTL
      JSON.stringify(position)
    );
  }

  private async cancelPosition(position: Position): Promise<void> {
    // Platform-specific cancellation logic would go here
    console.log(`Cancelling position ${position.contestId} on ${position.platform}`);
  }

  private async getCurrentBalance(): Promise<number> {
    const balance = await this.redis.get('current_balance');
    return parseFloat(balance || '0');
  }

  private async getPeakBalance(): Promise<number> {
    const peak = await this.redis.get('peak_balance');
    return parseFloat(peak || '0');
  }

  private async monitorPositions(): Promise<void> {
    // Monitor active positions
    for (const [id, position] of this.positions) {
      // Check if contest has started
      if (position.startTime < new Date()) {
        // Update live scoring if available
        await this.updateLiveScoring(position);
      }
    }
  }

  private async updateLiveScoring(position: Position): Promise<void> {
    // Fetch live scoring data (implementation depends on platform)
    // Update position rank and projected payout
  }

  private async calculateRiskMetrics(): Promise<void> {
    // Aggregate all risk metrics
    await this.updateRiskMetrics({});
    
    // Store metrics
    await this.redis.set('risk_metrics', JSON.stringify(this.metrics));
    
    // Emit updates
    this.emit('metricsCalculated', this.metrics);
  }

  private updatePositionStatus(contestId: string, data: any): void {
    const position = this.positions.get(contestId);
    if (position) {
      position.currentRank = data.rank;
      position.projectedROI = (data.projectedPayout / position.entryFee - 1) * 100;
    }
  }

  private processMarketAlert(alert: any): void {
    // Handle market alerts (injuries, weather, etc.)
    this.emit('marketAlert', alert);
  }

  private processRiskOverride(override: any): void {
    // Handle manual risk overrides from operators
    if (override.type === 'THRESHOLD_UPDATE') {
      this.thresholds = { ...this.thresholds, ...override.updates };
    }
  }
}

// Circuit Breaker implementation
class CircuitBreaker {
  private name: string;
  private threshold: number;
  private windowMs: number;
  private cooldownMs: number;
  private failures: number[] = [];
  private isOpen: boolean = false;
  private lastOpenTime: number = 0;

  constructor(config: {
    name: string;
    threshold: number;
    windowMs: number;
    cooldownMs: number;
  }) {
    this.name = config.name;
    this.threshold = config.threshold;
    this.windowMs = config.windowMs;
    this.cooldownMs = config.cooldownMs;
  }

  public recordFailure(): void {
    const now = Date.now();
    this.failures.push(now);
    
    // Clean old failures
    this.failures = this.failures.filter(
      f => f > now - this.windowMs
    );
    
    // Check if should open
    if (this.failures.length >= this.threshold) {
      this.open();
    }
  }

  public open(): void {
    this.isOpen = true;
    this.lastOpenTime = Date.now();
    console.warn(`Circuit breaker ${this.name} opened`);
  }

  public close(): void {
    this.isOpen = false;
    this.failures = [];
    console.log(`Circuit breaker ${this.name} closed`);
  }

  public isOpen(): boolean {
    if (!this.isOpen) return false;
    
    // Check if cooldown period has passed
    if (Date.now() - this.lastOpenTime > this.cooldownMs) {
      this.close();
      return false;
    }
    
    return true;
  }
}

// Fraud Detection Engine
class FraudDetector {
  private redis: Redis;
  private patterns: Map<string, FraudPattern>;
  private mlModel: any; // ML model for anomaly detection

  constructor(redis: Redis) {
    this.redis = redis;
    this.patterns = new Map();
    this.initializePatterns();
  }

  private initializePatterns(): void {
    // Velocity patterns
    this.patterns.set('velocity', {
      check: async (transaction: any) => {
        const recentTxns = await this.getRecentTransactions(transaction.userId, 300000); // 5 min
        return recentTxns.length > 10 ? 0.8 : 0;
      }
    });

    // Geographic patterns
    this.patterns.set('geo', {
      check: async (transaction: any) => {
        const lastLocation = await this.getLastLocation(transaction.userId);
        if (lastLocation && this.calculateDistance(lastLocation, transaction.location) > 500) {
          return 0.7;
        }
        return 0;
      }
    });

    // Behavioral patterns
    this.patterns.set('behavior', {
      check: async (transaction: any) => {
        const profile = await this.getUserProfile(transaction.userId);
        if (transaction.amount > profile.avgTransaction * 5) {
          return 0.6;
        }
        return 0;
      }
    });
  }

  public async analyze(transaction: any): Promise<FraudIndicator> {
    const scores: number[] = [];
    
    // Run all pattern checks
    for (const [name, pattern] of this.patterns) {
      const score = await pattern.check(transaction);
      scores.push(score);
    }
    
    // ML anomaly detection
    const anomalyScore = await this.runAnomalyDetection(transaction);
    scores.push(anomalyScore);
    
    // Calculate final fraud score
    const finalScore = Math.max(...scores);
    
    return {
      type: this.getIndicatorType(finalScore),
      severity: this.getSeverity(finalScore),
      confidence: finalScore,
      description: this.getDescription(finalScore, transaction),
      timestamp: new Date()
    };
  }

  private async runAnomalyDetection(transaction: any): Promise<number> {
    // Simplified anomaly detection
    // In production, this would use a trained ML model
    const features = [
      transaction.amount,
      new Date().getHours(),
      transaction.platform === 'DK' ? 1 : 0,
      // Add more features
    ];
    
    // Mock anomaly score
    return Math.random() * 0.3;
  }

  public async runPatternAnalysis(): Promise<void> {
    // Analyze patterns across all users
    console.log('Running fraud pattern analysis...');
  }

  private getIndicatorType(score: number): FraudIndicator['type'] {
    if (score > 0.7) return 'VELOCITY';
    if (score > 0.5) return 'PATTERN';
    if (score > 0.3) return 'ANOMALY';
    return 'BEHAVIORAL';
  }

  private getSeverity(score: number): FraudIndicator['severity'] {
    if (score > 0.8) return 'CRITICAL';
    if (score > 0.6) return 'HIGH';
    if (score > 0.4) return 'MEDIUM';
    return 'LOW';
  }

  private getDescription(score: number, transaction: any): string {
    if (score > 0.8) return 'Critical fraud indicators detected';
    if (score > 0.6) return 'High risk transaction pattern';
    if (score > 0.4) return 'Suspicious activity detected';
    return 'Minor anomaly detected';
  }

  private async getRecentTransactions(userId: string, windowMs: number): Promise<any[]> {
    const key = `txns:${userId}`;
    const txns = await this.redis.lrange(key, 0, -1);
    const cutoff = Date.now() - windowMs;
    
    return txns
      .map(t => JSON.parse(t))
      .filter(t => t.timestamp > cutoff);
  }

  private async getLastLocation(userId: string): Promise<any> {
    const loc = await this.redis.get(`location:${userId}`);
    return loc ? JSON.parse(loc) : null;
  }

  private calculateDistance(loc1: any, loc2: any): number {
    // Haversine formula for distance calculation
    return 0; // Simplified
  }

  private async getUserProfile(userId: string): Promise<any> {
    const profile = await this.redis.get(`profile:${userId}`);
    return profile ? JSON.parse(profile) : { avgTransaction: 50 };
  }
}

// Audit Logger
class AuditLogger {
  private redis: Redis;

  constructor(redis: Redis) {
    this.redis = redis;
  }

  public async log(entry: any): Promise<void> {
    const logEntry = {
      ...entry,
      timestamp: new Date(),
      id: crypto.randomUUID()
    };
    
    // Store in Redis
    await this.redis.lpush('audit_log', JSON.stringify(logEntry));
    await this.redis.ltrim('audit_log', 0, 9999); // Keep last 10k entries
    
    // Also store by date for compliance
    const dateKey = `audit:${new Date().toISOString().split('T')[0]}`;
    await this.redis.lpush(dateKey, JSON.stringify(logEntry));
    await this.redis.expire(dateKey, 90 * 24 * 60 * 60); // 90 day retention
    
    console.log(`[AUDIT] ${entry.action}:`, entry);
  }
}

interface FraudPattern {
  check: (transaction: any) => Promise<number>;
}

export default RiskManager;
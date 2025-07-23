/**
 * Professional Trading Dashboard for DFS
 * Real-time P&L tracking, performance analytics, and portfolio monitoring
 */

import { EventEmitter } from 'events';
import { WebSocket, WebSocketServer } from 'ws';
import { Redis } from 'ioredis';
import * as fs from 'fs/promises';
import * as path from 'path';

interface DashboardConfig {
  port: number;
  redisUrl: string;
  updateInterval: number;
  alertThresholds: AlertThresholds;
  chartHistoryDays: number;
}

interface AlertThresholds {
  maxDailyLoss: number;
  minWinRate: number;
  maxDrawdown: number;
  lowBalance: number;
  highVolatility: number;
}

interface PerformanceMetrics {
  totalPnL: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  totalROI: number;
  winRate: number;
  avgROI: number;
  sharpeRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  totalVolume: number;
  contestsPlayed: number;
  bestDay: number;
  worstDay: number;
  longestWinStreak: number;
  longestLoseStreak: number;
  currentStreak: number;
  kellyOptimal: number;
  sortino: number;
  calmar: number;
  profitFactor: number;
}

interface PortfolioPosition {
  contestId: string;
  platform: string;
  sport: string;
  entryFee: number;
  potentialPayout: number;
  currentRank: number;
  totalEntries: number;
  payoutStructure: PayoutTier[];
  projectedPayout: number;
  projectedROI: number;
  startTime: Date;
  status: 'PENDING' | 'LIVE' | 'COMPLETED' | 'CANCELLED';
  lineup: LineupPlayer[];
  liveScore: number;
  ownership: { [playerId: string]: number };
}

interface PayoutTier {
  minRank: number;
  maxRank: number;
  payout: number;
}

interface LineupPlayer {
  playerId: string;
  name: string;
  position: string;
  salary: number;
  projectedPoints: number;
  actualPoints?: number;
  ownership: number;
  value: number;
}

interface AlertMessage {
  id: string;
  type: 'WARNING' | 'ERROR' | 'INFO' | 'SUCCESS';
  title: string;
  message: string;
  timestamp: Date;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  acknowledged: boolean;
  data?: any;
}

interface ChartDataPoint {
  timestamp: Date;
  value: number;
  volume?: number;
  winRate?: number;
  drawdown?: number;
}

export class TradingDashboard extends EventEmitter {
  private wss: WebSocketServer;
  private redis: Redis;
  private config: DashboardConfig;
  private clients: Set<WebSocket>;
  private metrics: PerformanceMetrics;
  private portfolio: Map<string, PortfolioPosition>;
  private alerts: Map<string, AlertMessage>;
  private chartData: {
    pnl: ChartDataPoint[];
    roi: ChartDataPoint[];
    winRate: ChartDataPoint[];
    volume: ChartDataPoint[];
    drawdown: ChartDataPoint[];
  };
  private updateInterval: NodeJS.Timeout | null = null;

  constructor(config: DashboardConfig) {
    super();
    this.config = config;
    this.clients = new Set();
    this.portfolio = new Map();
    this.alerts = new Map();
    this.chartData = {
      pnl: [],
      roi: [],
      winRate: [],
      volume: [],
      drawdown: []
    };

    // Initialize Redis
    this.redis = new Redis(config.redisUrl);
    
    // Initialize WebSocket server
    this.wss = new WebSocketServer({ port: config.port });
    this.setupWebSocketServer();
    
    // Initialize metrics
    this.metrics = this.initializeMetrics();
    
    // Start real-time updates
    this.startRealTimeUpdates();
    
    console.log(`Trading Dashboard started on port ${config.port}`);
  }

  private initializeMetrics(): PerformanceMetrics {
    return {
      totalPnL: 0,
      dailyPnL: 0,
      weeklyPnL: 0,
      monthlyPnL: 0,
      totalROI: 0,
      winRate: 0,
      avgROI: 0,
      sharpeRatio: 0,
      maxDrawdown: 0,
      currentDrawdown: 0,
      totalVolume: 0,
      contestsPlayed: 0,
      bestDay: 0,
      worstDay: 0,
      longestWinStreak: 0,
      longestLoseStreak: 0,
      currentStreak: 0,
      kellyOptimal: 0,
      sortino: 0,
      calmar: 0,
      profitFactor: 0
    };
  }

  private setupWebSocketServer(): void {
    this.wss.on('connection', (ws) => {
      console.log('New dashboard client connected');
      this.clients.add(ws);
      
      // Send initial state
      this.sendToClient(ws, {
        type: 'INITIAL_STATE',
        data: {
          metrics: this.metrics,
          portfolio: Array.from(this.portfolio.values()),
          alerts: Array.from(this.alerts.values()),
          chartData: this.chartData
        }
      });
      
      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleClientMessage(ws, message);
        } catch (error) {
          console.error('Invalid message from client:', error);
        }
      });
      
      ws.on('close', () => {
        console.log('Dashboard client disconnected');
        this.clients.delete(ws);
      });
      
      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        this.clients.delete(ws);
      });
    });
  }

  private handleClientMessage(ws: WebSocket, message: any): void {
    switch (message.type) {
      case 'ACKNOWLEDGE_ALERT':
        this.acknowledgeAlert(message.alertId);
        break;
      case 'REQUEST_HISTORICAL_DATA':
        this.sendHistoricalData(ws, message.period);
        break;
      case 'UPDATE_SETTINGS':
        this.updateSettings(message.settings);
        break;
      case 'MANUAL_REFRESH':
        this.performManualRefresh();
        break;
      case 'EXPORT_DATA':
        this.exportData(ws, message.format, message.period);
        break;
    }
  }

  private async startRealTimeUpdates(): Promise<void> {
    // Load initial data
    await this.loadInitialData();
    
    // Start update loop
    this.updateInterval = setInterval(() => {
      this.updateMetrics();
    }, this.config.updateInterval);
    
    // Subscribe to Redis events for real-time updates
    const subscriber = new Redis(this.config.redisUrl);
    
    subscriber.subscribe(
      'contest_update',
      'position_update',
      'payout_update',
      'contest_completed',
      'risk_alert',
      'market_alert'
    );
    
    subscriber.on('message', (channel, message) => {
      this.handleRedisMessage(channel, JSON.parse(message));
    });
  }

  private async loadInitialData(): Promise<void> {
    try {
      // Load metrics from Redis
      const storedMetrics = await this.redis.get('dashboard_metrics');
      if (storedMetrics) {
        this.metrics = { ...this.metrics, ...JSON.parse(storedMetrics) };
      }
      
      // Load active portfolio positions
      const positions = await this.redis.hgetall('active_positions');
      for (const [contestId, positionData] of Object.entries(positions)) {
        this.portfolio.set(contestId, JSON.parse(positionData));
      }
      
      // Load recent alerts
      const alertHistory = await this.redis.lrange('dashboard_alerts', 0, 99);
      for (const alertData of alertHistory) {
        const alert = JSON.parse(alertData);
        this.alerts.set(alert.id, alert);
      }
      
      // Load chart data
      await this.loadChartData();
      
      console.log('Dashboard initial data loaded');
      
    } catch (error) {
      console.error('Error loading initial data:', error);
    }
  }

  private async loadChartData(): Promise<void> {
    const days = this.config.chartHistoryDays;
    const now = new Date();
    
    for (let i = days; i >= 0; i--) {
      const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dateKey = date.toISOString().split('T')[0];
      
      const dayData = await this.redis.get(`daily_stats:${dateKey}`);
      if (dayData) {
        const stats = JSON.parse(dayData);
        
        this.chartData.pnl.push({
          timestamp: date,
          value: stats.pnl || 0
        });
        
        this.chartData.roi.push({
          timestamp: date,
          value: stats.roi || 0
        });
        
        this.chartData.winRate.push({
          timestamp: date,
          value: stats.winRate || 0
        });
        
        this.chartData.volume.push({
          timestamp: date,
          value: stats.volume || 0
        });
        
        this.chartData.drawdown.push({
          timestamp: date,
          value: stats.drawdown || 0
        });
      }
    }
  }

  private handleRedisMessage(channel: string, data: any): void {
    switch (channel) {
      case 'contest_update':
        this.handleContestUpdate(data);
        break;
      case 'position_update':
        this.handlePositionUpdate(data);
        break;
      case 'payout_update':
        this.handlePayoutUpdate(data);
        break;
      case 'contest_completed':
        this.handleContestCompleted(data);
        break;
      case 'risk_alert':
        this.handleRiskAlert(data);
        break;
      case 'market_alert':
        this.handleMarketAlert(data);
        break;
    }
  }

  private handleContestUpdate(data: any): void {
    const position = this.portfolio.get(data.contestId);
    if (position) {
      position.currentRank = data.rank;
      position.liveScore = data.score;
      position.totalEntries = data.totalEntries;
      
      // Update projected payout based on current rank
      position.projectedPayout = this.calculateProjectedPayout(
        position.currentRank,
        position.payoutStructure
      );
      position.projectedROI = (position.projectedPayout / position.entryFee - 1) * 100;
      
      // Store updated position
      this.redis.hset('active_positions', data.contestId, JSON.stringify(position));
      
      // Broadcast update
      this.broadcastToClients({
        type: 'POSITION_UPDATE',
        data: position
      });
    }
  }

  private calculateProjectedPayout(rank: number, payoutStructure: PayoutTier[]): number {
    for (const tier of payoutStructure) {
      if (rank >= tier.minRank && rank <= tier.maxRank) {
        return tier.payout;
      }
    }
    return 0;
  }

  private handlePositionUpdate(data: any): void {
    // Update lineup player scores
    const position = this.portfolio.get(data.contestId);
    if (position && data.playerScores) {
      for (const player of position.lineup) {
        if (data.playerScores[player.playerId]) {
          player.actualPoints = data.playerScores[player.playerId];
        }
      }
      
      this.broadcastToClients({
        type: 'LINEUP_UPDATE',
        data: { contestId: data.contestId, lineup: position.lineup }
      });
    }
  }

  private handlePayoutUpdate(data: any): void {
    const position = this.portfolio.get(data.contestId);
    if (position) {
      position.payoutStructure = data.payoutStructure;
      
      // Recalculate projected payout
      position.projectedPayout = this.calculateProjectedPayout(
        position.currentRank,
        position.payoutStructure
      );
      position.projectedROI = (position.projectedPayout / position.entryFee - 1) * 100;
    }
  }

  private async handleContestCompleted(data: any): Promise<void> {
    const position = this.portfolio.get(data.contestId);
    if (position) {
      position.status = 'COMPLETED';
      position.projectedPayout = data.actualPayout;
      position.projectedROI = (data.actualPayout / position.entryFee - 1) * 100;
      
      // Update metrics
      await this.updateMetricsWithCompletedContest(position);
      
      // Move to completed positions
      await this.redis.hset('completed_positions', data.contestId, JSON.stringify(position));
      await this.redis.hdel('active_positions', data.contestId);
      this.portfolio.delete(data.contestId);
      
      // Broadcast completion
      this.broadcastToClients({
        type: 'CONTEST_COMPLETED',
        data: position
      });
      
      // Check for milestone achievements
      this.checkMilestones();
    }
  }

  private async updateMetricsWithCompletedContest(position: PortfolioPosition): Promise<void> {
    const pnl = position.projectedPayout - position.entryFee;
    const roi = (position.projectedPayout / position.entryFee - 1) * 100;
    
    // Update basic metrics
    this.metrics.totalPnL += pnl;
    this.metrics.dailyPnL += pnl;
    this.metrics.totalVolume += position.entryFee;
    this.metrics.contestsPlayed += 1;
    
    // Update win/loss tracking
    if (pnl > 0) {
      this.updateWinStreak();
    } else {
      this.updateLoseStreak();
    }
    
    // Recalculate derived metrics
    await this.recalculateAdvancedMetrics();
    
    // Store updated metrics
    await this.redis.set('dashboard_metrics', JSON.stringify(this.metrics));
    
    // Add to chart data
    this.updateChartData(pnl, roi);
    
    // Broadcast metrics update
    this.broadcastToClients({
      type: 'METRICS_UPDATE',
      data: this.metrics
    });
  }

  private updateWinStreak(): void {
    if (this.metrics.currentStreak >= 0) {
      this.metrics.currentStreak += 1;
      this.metrics.longestWinStreak = Math.max(this.metrics.longestWinStreak, this.metrics.currentStreak);
    } else {
      this.metrics.currentStreak = 1;
    }
  }

  private updateLoseStreak(): void {
    if (this.metrics.currentStreak <= 0) {
      this.metrics.currentStreak -= 1;
      this.metrics.longestLoseStreak = Math.max(this.metrics.longestLoseStreak, Math.abs(this.metrics.currentStreak));
    } else {
      this.metrics.currentStreak = -1;
    }
  }

  private async recalculateAdvancedMetrics(): Promise<void> {
    // Get historical contest data
    const history = await this.getContestHistory();
    
    if (history.length === 0) return;
    
    // Calculate win rate
    const wins = history.filter(h => h.pnl > 0).length;
    this.metrics.winRate = (wins / history.length) * 100;
    
    // Calculate average ROI
    const totalROI = history.reduce((sum, h) => sum + h.roi, 0);
    this.metrics.avgROI = totalROI / history.length;
    
    // Calculate total ROI
    const totalInvested = history.reduce((sum, h) => sum + h.entryFee, 0);
    this.metrics.totalROI = totalInvested > 0 ? (this.metrics.totalPnL / totalInvested) * 100 : 0;
    
    // Calculate Sharpe ratio
    this.metrics.sharpeRatio = this.calculateSharpeRatio(history);
    
    // Calculate Sortino ratio
    this.metrics.sortino = this.calculateSortinoRatio(history);
    
    // Calculate Calmar ratio
    this.metrics.calmar = this.calculateCalmarRatio(history);
    
    // Calculate profit factor
    this.metrics.profitFactor = this.calculateProfitFactor(history);
    
    // Calculate Kelly optimal
    this.metrics.kellyOptimal = this.calculateKellyOptimal(history);
    
    // Update drawdown
    this.updateDrawdown(history);
    
    // Update best/worst days
    this.updateBestWorstDays(history);
  }

  private calculateSharpeRatio(history: any[]): number {
    if (history.length < 2) return 0;
    
    const returns = history.map(h => h.roi / 100);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    const stdDev = Math.sqrt(
      returns.reduce((sum, r) => sum + Math.pow(r - avgReturn, 2), 0) / returns.length
    );
    
    const riskFreeRate = 0.02 / 365; // Daily risk-free rate
    return stdDev > 0 ? (avgReturn - riskFreeRate) / stdDev : 0;
  }

  private calculateSortinoRatio(history: any[]): number {
    if (history.length < 2) return 0;
    
    const returns = history.map(h => h.roi / 100);
    const avgReturn = returns.reduce((a, b) => a + b, 0) / returns.length;
    
    const downside = returns.filter(r => r < 0);
    if (downside.length === 0) return Infinity;
    
    const downsideStdDev = Math.sqrt(
      downside.reduce((sum, r) => sum + Math.pow(r, 2), 0) / downside.length
    );
    
    const riskFreeRate = 0.02 / 365;
    return downsideStdDev > 0 ? (avgReturn - riskFreeRate) / downsideStdDev : 0;
  }

  private calculateCalmarRatio(history: any[]): number {
    if (this.metrics.maxDrawdown === 0) return 0;
    
    const annualizedReturn = this.metrics.avgROI * 365 / 100; // Assuming daily contests
    return annualizedReturn / (this.metrics.maxDrawdown / 100);
  }

  private calculateProfitFactor(history: any[]): number {
    const grossProfit = history.filter(h => h.pnl > 0).reduce((sum, h) => sum + h.pnl, 0);
    const grossLoss = Math.abs(history.filter(h => h.pnl < 0).reduce((sum, h) => sum + h.pnl, 0));
    
    return grossLoss > 0 ? grossProfit / grossLoss : Infinity;
  }

  private calculateKellyOptimal(history: any[]): number {
    if (history.length === 0) return 0;
    
    const wins = history.filter(h => h.pnl > 0);
    const losses = history.filter(h => h.pnl < 0);
    
    if (wins.length === 0 || losses.length === 0) return 0;
    
    const winRate = wins.length / history.length;
    const avgWin = wins.reduce((sum, w) => sum + w.roi, 0) / wins.length / 100;
    const avgLoss = Math.abs(losses.reduce((sum, l) => sum + l.roi, 0) / losses.length / 100);
    
    // Kelly Criterion: f = (bp - q) / b
    // where b = avg win, p = win rate, q = loss rate
    const kelly = (avgWin * winRate - (1 - winRate)) / avgWin;
    
    // Cap at 25% for safety
    return Math.max(0, Math.min(0.25, kelly));
  }

  private updateDrawdown(history: any[]): void {
    let peak = 0;
    let maxDD = 0;
    let runningPnL = 0;
    
    for (const contest of history) {
      runningPnL += contest.pnl;
      if (runningPnL > peak) {
        peak = runningPnL;
      }
      
      const drawdown = (peak - runningPnL) / Math.max(peak, 1);
      maxDD = Math.max(maxDD, drawdown);
    }
    
    this.metrics.maxDrawdown = maxDD * 100;
    
    // Current drawdown
    const currentPeak = await this.getCurrentPeak();
    this.metrics.currentDrawdown = currentPeak > 0 
      ? ((currentPeak - this.metrics.totalPnL) / currentPeak) * 100 
      : 0;
  }

  private async getCurrentPeak(): Promise<number> {
    const peak = await this.redis.get('peak_balance');
    return parseFloat(peak || '0');
  }

  private updateBestWorstDays(history: any[]): void {
    // Group by day and calculate daily PnL
    const dailyPnL = new Map<string, number>();
    
    for (const contest of history) {
      const date = new Date(contest.completedAt).toISOString().split('T')[0];
      dailyPnL.set(date, (dailyPnL.get(date) || 0) + contest.pnl);
    }
    
    const dailyValues = Array.from(dailyPnL.values());
    if (dailyValues.length > 0) {
      this.metrics.bestDay = Math.max(...dailyValues);
      this.metrics.worstDay = Math.min(...dailyValues);
    }
  }

  private updateChartData(pnl: number, roi: number): void {
    const now = new Date();
    
    // Add to PnL chart
    this.chartData.pnl.push({
      timestamp: now,
      value: this.metrics.totalPnL
    });
    
    // Add to ROI chart
    this.chartData.roi.push({
      timestamp: now,
      value: roi
    });
    
    // Add to win rate chart (recalculated)
    this.chartData.winRate.push({
      timestamp: now,
      value: this.metrics.winRate
    });
    
    // Limit chart data points
    const maxPoints = 1000;
    for (const series of Object.values(this.chartData)) {
      if (series.length > maxPoints) {
        series.splice(0, series.length - maxPoints);
      }
    }
  }

  private handleRiskAlert(data: any): void {
    this.createAlert({
      type: 'WARNING',
      title: 'Risk Alert',
      message: data.message,
      priority: data.severity === 'CRITICAL' ? 'CRITICAL' : 'HIGH',
      data: data
    });
  }

  private handleMarketAlert(data: any): void {
    this.createAlert({
      type: 'INFO',
      title: 'Market Alert',
      message: data.message,
      priority: 'MEDIUM',
      data: data
    });
  }

  private createAlert(alertData: Partial<AlertMessage>): void {
    const alert: AlertMessage = {
      id: this.generateAlertId(),
      type: alertData.type || 'INFO',
      title: alertData.title || 'Alert',
      message: alertData.message || '',
      timestamp: new Date(),
      priority: alertData.priority || 'LOW',
      acknowledged: false,
      data: alertData.data
    };
    
    this.alerts.set(alert.id, alert);
    
    // Store in Redis
    this.redis.lpush('dashboard_alerts', JSON.stringify(alert));
    this.redis.ltrim('dashboard_alerts', 0, 999); // Keep last 1000 alerts
    
    // Broadcast to clients
    this.broadcastToClients({
      type: 'NEW_ALERT',
      data: alert
    });
    
    // Check if critical alert needs immediate attention
    if (alert.priority === 'CRITICAL') {
      this.handleCriticalAlert(alert);
    }
  }

  private generateAlertId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private handleCriticalAlert(alert: AlertMessage): void {
    // Send immediate notifications
    console.error(`CRITICAL ALERT: ${alert.title} - ${alert.message}`);
    
    // Additional notification methods (email, SMS, etc.) would go here
    this.emit('criticalAlert', alert);
  }

  private acknowledgeAlert(alertId: string): void {
    const alert = this.alerts.get(alertId);
    if (alert) {
      alert.acknowledged = true;
      
      this.broadcastToClients({
        type: 'ALERT_ACKNOWLEDGED',
        data: { alertId }
      });
    }
  }

  private async updateMetrics(): Promise<void> {
    try {
      // Update portfolio positions
      await this.updatePortfolioPositions();
      
      // Check for new completed contests
      await this.checkCompletedContests();
      
      // Update daily metrics
      await this.updateDailyMetrics();
      
      // Check alert thresholds
      this.checkAlertThresholds();
      
      // Broadcast regular update
      this.broadcastToClients({
        type: 'DASHBOARD_UPDATE',
        data: {
          metrics: this.metrics,
          portfolio: Array.from(this.portfolio.values()),
          timestamp: new Date()
        }
      });
      
    } catch (error) {
      console.error('Error updating metrics:', error);
    }
  }

  private async updatePortfolioPositions(): Promise<void> {
    // Fetch latest position data from platforms
    for (const [contestId, position] of this.portfolio) {
      try {
        // In production, this would fetch from DK/FD APIs
        const updatedPosition = await this.fetchPositionUpdate(position);
        if (updatedPosition) {
          this.portfolio.set(contestId, updatedPosition);
        }
      } catch (error) {
        console.error(`Error updating position ${contestId}:`, error);
      }
    }
  }

  private async fetchPositionUpdate(position: PortfolioPosition): Promise<PortfolioPosition | null> {
    // Mock implementation - would integrate with actual platform APIs
    return position;
  }

  private async checkCompletedContests(): Promise<void> {
    // Check Redis for newly completed contests
    const completedIds = await this.redis.smembers('completed_contest_ids');
    
    for (const contestId of completedIds) {
      if (this.portfolio.has(contestId)) {
        const completionData = await this.redis.get(`contest_result:${contestId}`);
        if (completionData) {
          await this.handleContestCompleted(JSON.parse(completionData));
          await this.redis.srem('completed_contest_ids', contestId);
        }
      }
    }
  }

  private async updateDailyMetrics(): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const todayStats = {
      pnl: this.metrics.dailyPnL,
      roi: this.metrics.avgROI,
      winRate: this.metrics.winRate,
      volume: await this.getDailyVolume(),
      drawdown: this.metrics.currentDrawdown
    };
    
    await this.redis.set(`daily_stats:${today}`, JSON.stringify(todayStats));
  }

  private async getDailyVolume(): Promise<number> {
    const today = new Date().toISOString().split('T')[0];
    const key = `daily_volume:${today}`;
    const volume = await this.redis.get(key);
    return parseFloat(volume || '0');
  }

  private checkAlertThresholds(): void {
    const thresholds = this.config.alertThresholds;
    
    // Daily loss check
    if (this.metrics.dailyPnL < -thresholds.maxDailyLoss) {
      this.createAlert({
        type: 'ERROR',
        title: 'Daily Loss Limit',
        message: `Daily loss of $${Math.abs(this.metrics.dailyPnL)} exceeds limit of $${thresholds.maxDailyLoss}`,
        priority: 'HIGH'
      });
    }
    
    // Win rate check
    if (this.metrics.contestsPlayed >= 20 && this.metrics.winRate < thresholds.minWinRate) {
      this.createAlert({
        type: 'WARNING',
        title: 'Low Win Rate',
        message: `Win rate of ${this.metrics.winRate.toFixed(1)}% is below target of ${thresholds.minWinRate}%`,
        priority: 'MEDIUM'
      });
    }
    
    // Drawdown check
    if (this.metrics.currentDrawdown > thresholds.maxDrawdown) {
      this.createAlert({
        type: 'ERROR',
        title: 'High Drawdown',
        message: `Current drawdown of ${this.metrics.currentDrawdown.toFixed(1)}% exceeds limit of ${thresholds.maxDrawdown}%`,
        priority: 'CRITICAL'
      });
    }
    
    // Volatility check
    if (this.metrics.sharpeRatio !== 0 && Math.abs(1 / this.metrics.sharpeRatio) > thresholds.highVolatility) {
      this.createAlert({
        type: 'WARNING',
        title: 'High Volatility',
        message: 'Portfolio volatility is elevated, consider reducing position sizes',
        priority: 'MEDIUM'
      });
    }
  }

  private checkMilestones(): void {
    // Check for achievement milestones
    const milestones = [
      { contests: 100, name: '100 Contests Played' },
      { contests: 500, name: '500 Contests Played' },
      { contests: 1000, name: '1000 Contests Played' },
      { winStreak: 5, name: '5 Contest Win Streak' },
      { winStreak: 10, name: '10 Contest Win Streak' },
      { totalPnL: 1000, name: '$1000 Total Profit' },
      { totalPnL: 5000, name: '$5000 Total Profit' },
      { totalPnL: 10000, name: '$10000 Total Profit' }
    ];
    
    for (const milestone of milestones) {
      if (
        (milestone.contests && this.metrics.contestsPlayed === milestone.contests) ||
        (milestone.winStreak && this.metrics.currentStreak === milestone.winStreak) ||
        (milestone.totalPnL && this.metrics.totalPnL >= milestone.totalPnL)
      ) {
        this.createAlert({
          type: 'SUCCESS',
          title: 'Milestone Achieved!',
          message: `Congratulations! You've reached: ${milestone.name}`,
          priority: 'LOW'
        });
      }
    }
  }

  private sendToClient(ws: WebSocket, message: any): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }

  private broadcastToClients(message: any): void {
    for (const client of this.clients) {
      this.sendToClient(client, message);
    }
  }

  private async sendHistoricalData(ws: WebSocket, period: string): Promise<void> {
    const history = await this.getContestHistory(period);
    
    this.sendToClient(ws, {
      type: 'HISTORICAL_DATA',
      data: history
    });
  }

  private async getContestHistory(period?: string): Promise<any[]> {
    // Get contest history from Redis
    const history = await this.redis.lrange('contest_history', 0, -1);
    const contests = history.map(h => JSON.parse(h));
    
    if (!period) return contests;
    
    // Filter by period
    const now = new Date();
    let cutoff: Date;
    
    switch (period) {
      case 'day':
        cutoff = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        cutoff = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        cutoff = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        return contests;
    }
    
    return contests.filter(c => new Date(c.completedAt) >= cutoff);
  }

  private updateSettings(settings: any): void {
    // Update dashboard settings
    if (settings.alertThresholds) {
      this.config.alertThresholds = { ...this.config.alertThresholds, ...settings.alertThresholds };
    }
    
    if (settings.updateInterval) {
      this.config.updateInterval = settings.updateInterval;
      
      // Restart update interval
      if (this.updateInterval) {
        clearInterval(this.updateInterval);
      }
      this.updateInterval = setInterval(() => {
        this.updateMetrics();
      }, this.config.updateInterval);
    }
    
    this.broadcastToClients({
      type: 'SETTINGS_UPDATED',
      data: { alertThresholds: this.config.alertThresholds }
    });
  }

  private async performManualRefresh(): Promise<void> {
    console.log('Performing manual refresh...');
    await this.updateMetrics();
    await this.recalculateAdvancedMetrics();
    
    this.broadcastToClients({
      type: 'REFRESH_COMPLETE',
      data: {
        metrics: this.metrics,
        portfolio: Array.from(this.portfolio.values()),
        timestamp: new Date()
      }
    });
  }

  private async exportData(ws: WebSocket, format: string, period: string): Promise<void> {
    try {
      const history = await this.getContestHistory(period);
      
      let exportData: string;
      let mimeType: string;
      
      switch (format) {
        case 'csv':
          exportData = this.generateCSV(history);
          mimeType = 'text/csv';
          break;
        case 'json':
          exportData = JSON.stringify(history, null, 2);
          mimeType = 'application/json';
          break;
        default:
          throw new Error('Unsupported export format');
      }
      
      this.sendToClient(ws, {
        type: 'EXPORT_DATA',
        data: {
          content: exportData,
          mimeType,
          filename: `trading_data_${period}.${format}`
        }
      });
      
    } catch (error) {
      this.sendToClient(ws, {
        type: 'EXPORT_ERROR',
        error: error.message
      });
    }
  }

  private generateCSV(history: any[]): string {
    if (history.length === 0) return '';
    
    const headers = Object.keys(history[0]).join(',');
    const rows = history.map(contest => 
      Object.values(contest).map(value => 
        typeof value === 'string' && value.includes(',') 
          ? `"${value}"` 
          : value
      ).join(',')
    );
    
    return [headers, ...rows].join('\n');
  }

  public async addPosition(position: PortfolioPosition): Promise<void> {
    this.portfolio.set(position.contestId, position);
    await this.redis.hset('active_positions', position.contestId, JSON.stringify(position));
    
    this.broadcastToClients({
      type: 'NEW_POSITION',
      data: position
    });
  }

  public getMetrics(): PerformanceMetrics {
    return { ...this.metrics };
  }

  public getPortfolio(): PortfolioPosition[] {
    return Array.from(this.portfolio.values());
  }

  public getAlerts(): AlertMessage[] {
    return Array.from(this.alerts.values());
  }

  public async stop(): Promise<void> {
    if (this.updateInterval) {
      clearInterval(this.updateInterval);
    }
    
    this.wss.close();
    await this.redis.quit();
    
    console.log('Trading Dashboard stopped');
  }
}

export default TradingDashboard;
/**
 * Trading metrics types for DFS trading terminal
 */

export interface RealTimeMetrics {
  timestamp: Date;
  
  // P&L Metrics
  totalPnL: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  yearlyPnL: number;
  
  // ROI Metrics
  totalROI: number;
  dailyROI: number;
  
  // Performance Metrics
  winRate: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  profitFactor: number;
  
  // Kelly Criterion
  kellyOptimal: number;
  actualKelly: number;
  
  // Volume Metrics
  totalVolume: number;
  dailyVolume: number;
  contestsPlayed: number;
  avgPosition: number;
  
  // Risk Metrics
  volatility: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  trackingError: number;
  var95: number; // Value at Risk 95%
  expectedShortfall: number;
}

export interface MetricTrend {
  metric: keyof RealTimeMetrics;
  current: number;
  previous: number;
  change: number;
  changePercent: number;
  trend: 'up' | 'down' | 'stable';
}

export interface MetricThreshold {
  metric: keyof RealTimeMetrics;
  warning: number;
  critical: number;
  target: number;
}
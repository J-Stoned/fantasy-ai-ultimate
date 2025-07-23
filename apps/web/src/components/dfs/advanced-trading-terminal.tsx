'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell,
  ScatterChart, Scatter, ReferenceLine
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, 
  Target, Activity, Zap, Shield, Brain, Eye, 
  Trophy, Gauge, Signal, Users, Settings, 
  Bell, Filter, Search, ArrowUp, ArrowDown,
  PlayCircle, PauseCircle, RefreshCw, BarChart3,
  PieChart as PieChartIcon, LineChart as LineChartIcon,
  Crosshair, Calculator, Percent
} from 'lucide-react';

// Enhanced interfaces for professional trading
interface RealTimeMetrics {
  timestamp: Date;
  totalPnL: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  yearlyPnL: number;
  totalROI: number;
  dailyROI: number;
  winRate: number;
  sharpeRatio: number;
  sortinoRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  kellyOptimal: number;
  actualKelly: number;
  profitFactor: number;
  totalVolume: number;
  dailyVolume: number;
  contestsPlayed: number;
  avgPosition: number;
  volatility: number;
  beta: number;
  alpha: number;
  informationRatio: number;
  trackingError: number;
  var95: number; // Value at Risk 95%
  expectedShortfall: number;
}

interface ContestIntelligence {
  contestId: string;
  name: string;
  platform: string;
  sport: string;
  slate: string;
  entryFee: number;
  totalPrize: number;
  currentEntries: number;
  maxEntries: number;
  overlay: number;
  rake: number;
  edgeScore: number;
  leverageScore: number;
  fieldStrength: number;
  sharkPercentage: number;
  fishPercentage: number;
  avgROIofField: number;
  recommendation: 'STRONG_BUY' | 'BUY' | 'HOLD' | 'SELL' | 'STRONG_SELL';
  expectedROI: number;
  variance: number;
  kellySize: number;
  optimalEntries: number;
  confidence: number;
  reasoning: string[];
  timeToStart: number; // minutes
  fillRate: number; // how fast it's filling
  lastAnalyzed: Date;
  priceMovement: 'UP' | 'DOWN' | 'STABLE';
}

interface LiveTradePosition {
  positionId: string;
  contestId: string;
  contestName: string;
  platform: string;
  sport: string;
  entryFee: number;
  entries: number;
  currentRank: number;
  totalEntries: number;
  potentialPayout: number;
  currentPayout: number;
  liveScore: number;
  projectedScore: number;
  scorePercentile: number;
  status: 'PENDING' | 'LIVE' | 'FINAL' | 'CANCELLED';
  timeRemaining: number; // minutes
  pnlUnrealized: number;
  pnlRealized: number;
  roiCurrent: number;
  roiProjected: number;
  cashProbability: number;
  bineProbability: number; // top 1% probability
  lineup: TradeLineupPlayer[];
  riskMetrics: {
    sharpeContribution: number;
    beta: number;
    correlation: number;
    concentrationRisk: number;
  };
}

interface TradeLineupPlayer {
  playerId: string;
  name: string;
  position: string;
  team: string;
  opponent: string;
  salary: number;
  projectedPoints: number;
  actualPoints: number;
  ceiling: number;
  floor: number;
  ownership: number;
  leverageScore: number;
  gameStatus: 'SCHEDULED' | 'LIVE' | 'FINAL';
  minutesRemaining: number;
  usage: number;
  gameScript: 'POSITIVE' | 'NEGATIVE' | 'NEUTRAL';
  weatherImpact: number;
  injuryRisk: number;
  value: number; // points per $1000
}

interface AdvancedOwnership {
  playerId: string;
  name: string;
  position: string;
  team: string;
  salary: number;
  projectedOwnership: number;
  actualOwnership?: number;
  leverageScore: number;
  chalkScore: number;
  contrarian: number;
  correlationScore: number;
  stackPartners: string[];
  narrative: string[];
  marketSentiment: 'BULLISH' | 'BEARISH' | 'NEUTRAL';
  momentumScore: number;
  socialBuzz: number;
  expertConsensus: number;
  priceMovement: number;
  weatherFactor: number;
  injuryImpact: number;
  gameEnvironment: number;
  recencyBias: number;
  recommendation: 'LEVERAGE' | 'FADE' | 'NEUTRAL' | 'STACK' | 'AVOID';
  exposureTarget: number;
  maxExposure: number;
  minExposure: number;
}

interface RiskAlert {
  id: string;
  type: 'DRAWDOWN' | 'CONCENTRATION' | 'VOLATILITY' | 'CORRELATION' | 'LIQUIDITY' | 'OPERATIONAL';
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  title: string;
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  autoResolve: boolean;
  threshold: number;
  currentValue: number;
  recommendation: string;
  impact: number;
}

// Mock data generators
const generateRealTimeMetrics = (): RealTimeMetrics => ({
  timestamp: new Date(),
  totalPnL: 24750.80 + (Math.random() - 0.5) * 100,
  dailyPnL: 1247.30 + (Math.random() - 0.5) * 50,
  weeklyPnL: 3891.70,
  monthlyPnL: 12450.90,
  yearlyPnL: 45600.20,
  totalROI: 0.2034,
  dailyROI: 0.0156,
  winRate: 0.673,
  sharpeRatio: 2.14,
  sortinoRatio: 3.28,
  maxDrawdown: -0.087,
  currentDrawdown: -0.023,
  kellyOptimal: 0.123,
  actualKelly: 0.095,
  profitFactor: 2.67,
  totalVolume: 187450,
  dailyVolume: 8750,
  contestsPlayed: 342,
  avgPosition: 0.237, // 23.7th percentile average
  volatility: 0.165,
  beta: 0.89,
  alpha: 0.034,
  informationRatio: 1.47,
  trackingError: 0.032,
  var95: -892.50, // 95% chance loss won't exceed this
  expectedShortfall: -1247.80 // Expected loss if VaR is exceeded
});

const generateContestIntelligence = (): ContestIntelligence[] => [
  {
    contestId: 'DK_NFL_MILLY',
    name: 'Sunday Million',
    platform: 'DraftKings',
    sport: 'NFL',
    slate: 'MAIN',
    entryFee: 20,
    totalPrize: 1000000,
    currentEntries: 38500,
    maxEntries: 50000,
    overlay: 0,
    rake: 0.15,
    edgeScore: 0.187, // 18.7%
    leverageScore: 31.2,
    fieldStrength: 0.42,
    sharkPercentage: 0.285,
    fishPercentage: 0.518,
    avgROIofField: -0.089,
    recommendation: 'STRONG_BUY',
    expectedROI: 0.234,
    variance: 2.45,
    kellySize: 0.067, // 6.7% of bankroll
    optimalEntries: 12,
    confidence: 0.89,
    reasoning: [
      'High leverage opportunities identified',
      'Field strength below average (0.42)',
      'Strong ownership edge in 3+ positions',
      'Weather creating chalk narratives'
    ],
    timeToStart: 125,
    fillRate: 0.023, // 2.3% per minute
    lastAnalyzed: new Date(Date.now() - 30000),
    priceMovement: 'STABLE'
  },
  {
    contestId: 'FD_NBA_TURBO',
    name: 'Turbo Tuesday',
    platform: 'FanDuel',
    sport: 'NBA',
    slate: 'TURBO',
    entryFee: 5,
    totalPrize: 25000,
    currentEntries: 4800,
    maxEntries: 5000,
    overlay: 0,
    rake: 0.10,
    edgeScore: 0.045,
    leverageScore: 12.8,
    fieldStrength: 0.67,
    sharkPercentage: 0.412,
    fishPercentage: 0.234,
    avgROIofField: 0.023,
    recommendation: 'HOLD',
    expectedROI: 0.078,
    variance: 1.23,
    kellySize: 0.019,
    optimalEntries: 2,
    confidence: 0.64,
    reasoning: [
      'Moderate edge detected',
      'Field strength above average',
      'Limited leverage opportunities',
      'Late swap advantage minimal'
    ],
    timeToStart: 45,
    fillRate: 0.045,
    lastAnalyzed: new Date(Date.now() - 15000),
    priceMovement: 'UP'
  },
  {
    contestId: 'DK_NHL_GPP',
    name: 'Hat Trick Hero',
    platform: 'DraftKings',
    sport: 'NHL',
    slate: 'MAIN',
    entryFee: 10,
    totalPrize: 50000,
    currentEntries: 6200,
    maxEntries: 5000, // Over-subscribed!
    overlay: -12000,
    rake: 0.12,
    edgeScore: -0.023,
    leverageScore: 8.4,
    fieldStrength: 0.78,
    sharkPercentage: 0.567,
    fishPercentage: 0.189,
    avgROIofField: 0.134,
    recommendation: 'STRONG_SELL',
    expectedROI: -0.156,
    variance: 3.67,
    kellySize: 0.0,
    optimalEntries: 0,
    confidence: 0.92,
    reasoning: [
      'Negative overlay detected (-$12K)',
      'Shark-heavy field (56.7%)',
      'No sustainable edge',
      'High variance, low reward'
    ],
    timeToStart: 89,
    fillRate: 0.0,
    lastAnalyzed: new Date(Date.now() - 45000),
    priceMovement: 'DOWN'
  }
];

const generateLivePositions = (): LiveTradePosition[] => [
  {
    positionId: 'POS_001',
    contestId: 'DK_NFL_MAIN_001',
    contestName: 'Sunday Night Special',
    platform: 'DraftKings',
    sport: 'NFL',
    entryFee: 25,
    entries: 3,
    currentRank: 45,
    totalEntries: 8500,
    potentialPayout: 450,
    currentPayout: 425,
    liveScore: 187.34,
    projectedScore: 195.8,
    scorePercentile: 0.947, // 94.7th percentile
    status: 'LIVE',
    timeRemaining: 147,
    pnlUnrealized: 350,
    pnlRealized: 0,
    roiCurrent: 4.67, // 467%
    roiProjected: 5.12,
    cashProbability: 0.89,
    bineProbability: 0.234, // 23.4% chance of top 1%
    lineup: [], // Simplified for now
    riskMetrics: {
      sharpeContribution: 0.045,
      beta: 1.12,
      correlation: 0.67,
      concentrationRisk: 0.23
    }
  },
  {
    positionId: 'POS_002',
    contestId: 'FD_NBA_CASH_001',
    contestName: 'Double Up Delight',
    platform: 'FanDuel',
    sport: 'NBA',
    entryFee: 50,
    entries: 1,
    currentRank: 67,
    totalEntries: 100,
    potentialPayout: 95,
    currentPayout: 95,
    liveScore: 245.8,
    projectedScore: 248.3,
    scorePercentile: 0.33,
    status: 'LIVE',
    timeRemaining: 89,
    pnlUnrealized: 45,
    pnlRealized: 0,
    roiCurrent: 0.90,
    roiProjected: 0.90,
    cashProbability: 0.72,
    bineProbability: 0.0,
    lineup: [],
    riskMetrics: {
      sharpeContribution: 0.012,
      beta: 0.45,
      correlation: 0.12,
      concentrationRisk: 0.08
    }
  }
];

const chartDataExtended = [
  { time: '09:00', pnl: 850, roi: 0.15, winRate: 0.68, volume: 2400, drawdown: -0.023, sharpe: 2.1 },
  { time: '10:00', pnl: 1200, roi: 0.18, winRate: 0.71, volume: 3100, drawdown: -0.019, sharpe: 2.2 },
  { time: '11:00', pnl: -420, roi: 0.16, winRate: 0.65, volume: 1800, drawdown: -0.045, sharpe: 1.9 },
  { time: '12:00', pnl: 1850, roi: 0.21, winRate: 0.74, volume: 4200, drawdown: -0.032, sharpe: 2.3 },
  { time: '13:00', pnl: 950, roi: 0.19, winRate: 0.69, volume: 2800, drawdown: -0.028, sharpe: 2.2 },
  { time: '14:00', pnl: 2100, roi: 0.24, winRate: 0.78, volume: 5100, drawdown: -0.015, sharpe: 2.6 },
  { time: '15:00', pnl: 1247, roi: 0.203, winRate: 0.673, volume: 3750, drawdown: -0.023, sharpe: 2.14 }
];

const portfolioAllocation = [
  { name: 'NFL GPP', value: 45000, percentage: 45, color: '#10B981' },
  { name: 'NBA Cash', value: 25000, percentage: 25, color: '#3B82F6' },
  { name: 'NHL GPP', value: 15000, percentage: 15, color: '#F59E0B' },
  { name: 'MLB H2H', value: 10000, percentage: 10, color: '#EF4444' },
  { name: 'Reserve', value: 5000, percentage: 5, color: '#6B7280' }
];

export default function AdvancedTradingTerminal() {
  const [metrics, setMetrics] = useState<RealTimeMetrics>(generateRealTimeMetrics());
  const [contests, setContests] = useState<ContestIntelligence[]>(generateContestIntelligence());
  const [positions, setPositions] = useState<LiveTradePosition[]>(generateLivePositions());
  const [alerts, setAlerts] = useState<RiskAlert[]>([]);
  const [isLive, setIsLive] = useState(true);
  const [selectedView, setSelectedView] = useState<'overview' | 'contests' | 'positions' | 'analytics' | 'risk'>('overview');
  const [refreshRate, setRefreshRate] = useState<number>(2000); // ms
  const [sortBy, setSortBy] = useState<string>('edgeScore');
  const [filterSport, setFilterSport] = useState<string>('ALL');

  // Real-time updates
  useEffect(() => {
    if (!isLive) return;
    
    const interval = setInterval(() => {
      setMetrics(generateRealTimeMetrics());
      
      // Update positions with realistic changes
      setPositions(prev => prev.map(pos => ({
        ...pos,
        liveScore: pos.liveScore + (Math.random() - 0.3) * 3,
        currentRank: Math.max(1, pos.currentRank + Math.floor((Math.random() - 0.5) * 5)),
        timeRemaining: Math.max(0, pos.timeRemaining - 1),
        pnlUnrealized: pos.pnlUnrealized + (Math.random() - 0.4) * 20
      })));

      // Simulate contest changes
      setContests(prev => prev.map(contest => ({
        ...contest,
        currentEntries: Math.min(contest.maxEntries, contest.currentEntries + Math.floor(Math.random() * 50)),
        timeToStart: Math.max(0, contest.timeToStart - 1),
        lastAnalyzed: new Date()
      })));
    }, refreshRate);

    return () => clearInterval(interval);
  }, [isLive, refreshRate]);

  // Alert system
  useEffect(() => {
    const newAlerts: RiskAlert[] = [];
    
    if (Math.abs(metrics.currentDrawdown) > 0.05) {
      newAlerts.push({
        id: 'DD_001',
        type: 'DRAWDOWN',
        severity: Math.abs(metrics.currentDrawdown) > 0.1 ? 'HIGH' : 'MEDIUM',
        title: 'Drawdown Alert',
        message: `Current drawdown: ${(metrics.currentDrawdown * 100).toFixed(1)}%`,
        timestamp: new Date(),
        acknowledged: false,
        autoResolve: false,
        threshold: 0.05,
        currentValue: Math.abs(metrics.currentDrawdown),
        recommendation: 'Consider reducing position sizes',
        impact: Math.abs(metrics.currentDrawdown) * 100000 // Dollar impact
      });
    }

    if (metrics.actualKelly > metrics.kellyOptimal * 1.5) {
      newAlerts.push({
        id: 'KELLY_001',
        type: 'CONCENTRATION',
        severity: 'MEDIUM',
        title: 'Over-Kelly Warning',
        message: `Betting ${(metrics.actualKelly * 100).toFixed(1)}% vs optimal ${(metrics.kellyOptimal * 100).toFixed(1)}%`,
        timestamp: new Date(),
        acknowledged: false,
        autoResolve: true,
        threshold: metrics.kellyOptimal * 1.5,
        currentValue: metrics.actualKelly,
        recommendation: 'Reduce position sizes to optimal Kelly',
        impact: 2500
      });
    }

    setAlerts(newAlerts);
  }, [metrics]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number, decimals: number = 1): string => {
    return `${(value * 100).toFixed(decimals)}%`;
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'STRONG_BUY': return 'bg-green-600 text-white animate-pulse';
      case 'BUY': return 'bg-green-500 text-white';
      case 'HOLD': return 'bg-yellow-500 text-black';
      case 'SELL': return 'bg-red-500 text-white';
      case 'STRONG_SELL': return 'bg-red-600 text-white animate-pulse';
      case 'LEVERAGE': return 'bg-blue-600 text-white';
      case 'FADE': return 'bg-orange-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'border-red-600 bg-red-950 text-red-400';
      case 'HIGH': return 'border-orange-600 bg-orange-950 text-orange-400';
      case 'MEDIUM': return 'border-yellow-600 bg-yellow-950 text-yellow-400';
      case 'LOW': return 'border-blue-600 bg-blue-950 text-blue-400';
      default: return 'border-gray-600 bg-gray-950 text-gray-400';
    }
  };

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    const totalExposed = positions.reduce((sum, pos) => sum + (pos.entryFee * pos.entries), 0);
    const totalUnrealized = positions.reduce((sum, pos) => sum + pos.pnlUnrealized, 0);
    const avgCashProb = positions.reduce((sum, pos) => sum + pos.cashProbability, 0) / positions.length;
    
    return {
      totalExposed,
      totalUnrealized,
      avgCashProb: avgCashProb || 0,
      livePositions: positions.filter(p => p.status === 'LIVE').length
    };
  }, [positions]);

  // Filtered and sorted contests
  const filteredContests = useMemo(() => {
    let filtered = contests;
    
    if (filterSport !== 'ALL') {
      filtered = filtered.filter(c => c.sport === filterSport);
    }
    
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'edgeScore': return b.edgeScore - a.edgeScore;
        case 'leverageScore': return b.leverageScore - a.leverageScore;
        case 'expectedROI': return b.expectedROI - a.expectedROI;
        case 'timeToStart': return a.timeToStart - b.timeToStart;
        default: return 0;
      }
    });
  }, [contests, filterSport, sortBy]);

  return (
    <div className="min-h-screen bg-black text-green-400 p-4 font-mono overflow-x-auto">
      {/* Header with Controls */}
      <div className="flex items-center justify-between mb-6 border-b border-green-800 pb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-green-400" />
            <h1 className="text-2xl font-bold text-green-400">PROFESSIONAL DFS TRADING TERMINAL</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-sm">{isLive ? 'LIVE FEED' : 'PAUSED'}</span>
          </div>
          {alerts.length > 0 && (
            <div className="flex items-center gap-2 text-red-400">
              <Bell className="w-5 h-5 animate-bounce" />
              <span className="text-sm font-bold">{alerts.length} ALERTS</span>
            </div>
          )}
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">Refresh:</span>
            <Select value={refreshRate.toString()} onValueChange={(v) => setRefreshRate(Number(v))}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="1000">1s</SelectItem>
                <SelectItem value="2000">2s</SelectItem>
                <SelectItem value="5000">5s</SelectItem>
                <SelectItem value="10000">10s</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="text-right">
            <div className="text-sm text-gray-400">Total Bankroll</div>
            <div className="text-xl font-bold text-green-400">{formatCurrency(metrics.totalPnL + 100000)}</div>
          </div>
          
          <Button
            onClick={() => setIsLive(!isLive)}
            variant={isLive ? "destructive" : "default"}
            size="sm"
            className="flex items-center gap-1"
          >
            {isLive ? <PauseCircle className="w-4 h-4" /> : <PlayCircle className="w-4 h-4" />}
            {isLive ? 'PAUSE' : 'START'}
          </Button>
        </div>
      </div>

      {/* Alert Bar */}
      {alerts.length > 0 && (
        <div className="mb-4 space-y-2">
          {alerts.slice(0, 3).map((alert) => (
            <div key={alert.id} className={`border rounded p-3 ${getSeverityColor(alert.severity)}`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span className="font-bold text-sm">{alert.title}</span>
                  <span className="text-xs">{alert.message}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs">{alert.recommendation}</span>
                  <Button size="sm" variant="outline" className="h-6 text-xs">
                    ACK
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Key Metrics Dashboard */}
      <div className="grid grid-cols-8 gap-3 mb-6">
        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Daily P&L</p>
                <p className={`text-lg font-bold ${metrics.dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(metrics.dailyPnL)}
                </p>
                <p className="text-xs text-gray-500">ROI: {formatPercent(metrics.dailyROI)}</p>
              </div>
              {metrics.dailyPnL >= 0 ? <ArrowUp className="w-4 h-4 text-green-400" /> : <ArrowDown className="w-4 h-4 text-red-400" />}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Total ROI</p>
                <p className="text-lg font-bold text-green-400">{formatPercent(metrics.totalROI)}</p>
                <p className="text-xs text-gray-500">vs Bench: +{formatPercent(metrics.alpha)}</p>
              </div>
              <Target className="w-4 h-4 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Sharpe</p>
                <p className="text-lg font-bold text-green-400">{metrics.sharpeRatio.toFixed(2)}</p>
                <p className="text-xs text-gray-500">Sortino: {metrics.sortinoRatio.toFixed(2)}</p>
              </div>
              <Activity className="w-4 h-4 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Kelly</p>
                <p className="text-lg font-bold text-yellow-400">{formatPercent(metrics.kellyOptimal)}</p>
                <p className="text-xs text-gray-500">Actual: {formatPercent(metrics.actualKelly)}</p>
              </div>
              <Calculator className="w-4 h-4 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Win Rate</p>
                <p className="text-lg font-bold text-green-400">{formatPercent(metrics.winRate)}</p>
                <p className="text-xs text-gray-500">Avg Pos: {formatPercent(metrics.avgPosition)}</p>
              </div>
              <Trophy className="w-4 h-4 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Drawdown</p>
                <p className="text-lg font-bold text-red-400">{formatPercent(Math.abs(metrics.currentDrawdown))}</p>
                <p className="text-xs text-gray-500">Max: {formatPercent(Math.abs(metrics.maxDrawdown))}</p>
              </div>
              <Shield className="w-4 h-4 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">VaR 95%</p>
                <p className="text-lg font-bold text-red-400">{formatCurrency(metrics.var95)}</p>
                <p className="text-xs text-gray-500">ES: {formatCurrency(metrics.expectedShortfall)}</p>
              </div>
              <AlertTriangle className="w-4 h-4 text-red-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Live Exposure</p>
                <p className="text-lg font-bold text-blue-400">{formatCurrency(portfolioMetrics.totalExposed)}</p>
                <p className="text-xs text-gray-500">Unrealized: {formatCurrency(portfolioMetrics.totalUnrealized)}</p>
              </div>
              <DollarSign className="w-4 h-4 text-blue-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Navigation Tabs */}
      <Tabs value={selectedView} onValueChange={(v) => setSelectedView(v as any)} className="mb-4">
        <TabsList className="bg-gray-900 border-green-800">
          <TabsTrigger value="overview" className="data-[state=active]:bg-green-800">Overview</TabsTrigger>
          <TabsTrigger value="contests" className="data-[state=active]:bg-green-800">Contest Intelligence</TabsTrigger>
          <TabsTrigger value="positions" className="data-[state=active]:bg-green-800">Live Positions</TabsTrigger>
          <TabsTrigger value="analytics" className="data-[state=active]:bg-green-800">Advanced Analytics</TabsTrigger>
          <TabsTrigger value="risk" className="data-[state=active]:bg-green-800">Risk Management</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-2 gap-6">
            {/* P&L Chart */}
            <Card className="bg-gray-900 border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <LineChartIcon className="w-5 h-5" />
                  Real-Time P&L Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <AreaChart data={chartDataExtended}>
                    <defs>
                      <linearGradient id="pnl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" tick={{fontSize: 10}} stroke="#6B7280" />
                    <YAxis tick={{fontSize: 10}} stroke="#6B7280" />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(Number(value)), 'P&L']}
                      labelStyle={{color: '#10B981'}}
                      contentStyle={{backgroundColor: '#1F2937', border: '1px solid #10B981'}}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="pnl" 
                      stroke="#10B981" 
                      fillOpacity={1} 
                      fill="url(#pnl)" 
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Portfolio Allocation */}
            <Card className="bg-gray-900 border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <PieChartIcon className="w-5 h-5" />
                  Portfolio Allocation
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex">
                  <ResponsiveContainer width="60%" height={300}>
                    <PieChart>
                      <Pie
                        data={portfolioAllocation}
                        cx="50%"
                        cy="50%"
                        outerRadius={100}
                        innerRadius={40}
                        paddingAngle={5}
                        dataKey="value"
                      >
                        {portfolioAllocation.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatCurrency(Number(value))} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="w-40% space-y-2 text-xs">
                    {portfolioAllocation.map((item, idx) => (
                      <div key={idx} className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-3 h-3 rounded`} style={{backgroundColor: item.color}} />
                          <span>{item.name}</span>
                        </div>
                        <div className="text-right">
                          <div className="font-bold">{formatCurrency(item.value)}</div>
                          <div className="text-gray-400">{item.percentage}%</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-4 gap-4">
            <Card className="bg-gray-900 border-green-800">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-400">{filteredContests.length}</div>
                  <div className="text-sm text-gray-400">Available Contests</div>
                  <div className="text-xs text-green-300">
                    {filteredContests.filter(c => c.recommendation.includes('BUY')).length} Strong Plays
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-green-800">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-400">{portfolioMetrics.livePositions}</div>
                  <div className="text-sm text-gray-400">Live Positions</div>
                  <div className="text-xs text-blue-300">
                    {formatPercent(portfolioMetrics.avgCashProb)} Avg Cash Prob
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-green-800">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-yellow-400">
                    {formatPercent(metrics.kellyOptimal)}
                  </div>
                  <div className="text-sm text-gray-400">Optimal Kelly</div>
                  <div className="text-xs text-yellow-300">
                    Current: {formatPercent(metrics.actualKelly)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gray-900 border-green-800">
              <CardContent className="p-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-red-400">{alerts.length}</div>
                  <div className="text-sm text-gray-400">Active Alerts</div>
                  <div className="text-xs text-red-300">
                    {alerts.filter(a => a.severity === 'HIGH' || a.severity === 'CRITICAL').length} High Priority
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="contests" className="space-y-4">
          {/* Contest Filters */}
          <div className="flex items-center gap-4 p-4 bg-gray-900 border border-green-800 rounded">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <span className="text-sm text-gray-400">Filters:</span>
            </div>
            
            <Select value={filterSport} onValueChange={setFilterSport}>
              <SelectTrigger className="w-32">
                <SelectValue placeholder="Sport" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Sports</SelectItem>
                <SelectItem value="NFL">NFL</SelectItem>
                <SelectItem value="NBA">NBA</SelectItem>
                <SelectItem value="NHL">NHL</SelectItem>
                <SelectItem value="MLB">MLB</SelectItem>
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Sort By" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="edgeScore">Edge Score</SelectItem>
                <SelectItem value="leverageScore">Leverage Score</SelectItem>
                <SelectItem value="expectedROI">Expected ROI</SelectItem>
                <SelectItem value="timeToStart">Time to Start</SelectItem>
              </SelectContent>
            </Select>

            <div className="flex-1" />
            
            <div className="text-sm text-gray-400">
              Showing {filteredContests.length} contests
            </div>
          </div>

          {/* Contest Intelligence Grid */}
          <div className="grid gap-4">
            {filteredContests.map((contest) => (
              <Card key={contest.contestId} className="bg-gray-900 border-green-800">
                <CardContent className="p-4">
                  <div className="grid grid-cols-6 gap-4">
                    {/* Contest Info */}
                    <div className="col-span-2">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-green-400">{contest.name}</h4>
                        <Badge className={getRecommendationColor(contest.recommendation)}>
                          {contest.recommendation.replace('_', ' ')}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                        <div>{contest.platform} • {contest.sport} • {contest.slate}</div>
                        <div>Entry: {formatCurrency(contest.entryFee)} • Prize: {formatCurrency(contest.totalPrize)}</div>
                        <div>Filled: {contest.currentEntries.toLocaleString()} / {contest.maxEntries.toLocaleString()}</div>
                        <div className="flex items-center gap-2">
                          <span>Starts in:</span>
                          <span className={contest.timeToStart < 60 ? 'text-red-400 font-bold' : 'text-yellow-400'}>
                            {contest.timeToStart}m
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Key Metrics */}
                    <div className="grid grid-cols-2 gap-3 text-sm">
                      <div>
                        <div className="text-gray-400">Edge Score</div>
                        <div className={`font-bold ${contest.edgeScore > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatPercent(contest.edgeScore)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Leverage</div>
                        <div className="font-bold text-blue-400">{contest.leverageScore.toFixed(1)}x</div>
                      </div>
                      <div>
                        <div className="text-gray-400">Expected ROI</div>
                        <div className={`font-bold ${contest.expectedROI > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatPercent(contest.expectedROI)}
                        </div>
                      </div>
                      <div>
                        <div className="text-gray-400">Kelly Size</div>
                        <div className="font-bold text-yellow-400">{formatPercent(contest.kellySize)}</div>
                      </div>
                    </div>

                    {/* Field Analysis */}
                    <div className="text-sm space-y-2">
                      <div className="text-gray-400 font-semibold">Field Analysis</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Sharks:</span>
                          <span className="text-red-400">{formatPercent(contest.sharkPercentage)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Fish:</span>
                          <span className="text-green-400">{formatPercent(contest.fishPercentage)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Field ROI:</span>
                          <span className={contest.avgROIofField > 0 ? 'text-red-400' : 'text-green-400'}>
                            {formatPercent(contest.avgROIofField)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Confidence:</span>
                          <span className="text-blue-400">{formatPercent(contest.confidence)}</span>
                        </div>
                      </div>
                    </div>

                    {/* Recommendation Details */}
                    <div className="text-sm">
                      <div className="text-gray-400 font-semibold mb-2">Analysis</div>
                      <div className="space-y-1">
                        {contest.reasoning.slice(0, 3).map((reason, idx) => (
                          <div key={idx} className="text-gray-300 bg-gray-800 rounded px-2 py-1 text-xs">
                            • {reason}
                          </div>
                        ))}
                      </div>
                      
                      {contest.overlay !== 0 && (
                        <div className={`mt-2 text-xs font-bold ${contest.overlay > 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {contest.overlay > 0 ? '⚡ OVERLAY: ' : '⚠️ NO OVERLAY: '}
                          {formatCurrency(Math.abs(contest.overlay))}
                        </div>
                      )}
                    </div>

                    {/* Action Panel */}
                    <div className="text-center space-y-2">
                      {contest.recommendation.includes('BUY') && (
                        <div className="p-3 bg-green-900 border border-green-700 rounded">
                          <div className="text-green-400 font-bold text-sm">RECOMMENDED</div>
                          <div className="text-xs text-gray-300">Optimal: {contest.optimalEntries} entries</div>
                          <div className="text-xs text-gray-300">Kelly: {formatCurrency(contest.kellySize * 100000)}</div>
                          <Button size="sm" className="mt-2 w-full bg-green-600 hover:bg-green-700">
                            ENTER CONTEST
                          </Button>
                        </div>
                      )}
                      
                      {contest.recommendation.includes('SELL') && (
                        <div className="p-3 bg-red-900 border border-red-700 rounded">
                          <div className="text-red-400 font-bold text-sm">AVOID</div>
                          <div className="text-xs text-gray-300">Negative Edge</div>
                          <div className="text-xs text-gray-300">High Risk</div>
                        </div>
                      )}
                      
                      {contest.recommendation === 'HOLD' && (
                        <div className="p-3 bg-yellow-900 border border-yellow-700 rounded">
                          <div className="text-yellow-400 font-bold text-sm">NEUTRAL</div>
                          <div className="text-xs text-gray-300">Monitor for changes</div>
                          <Button size="sm" variant="outline" className="mt-2 w-full">
                            WATCH LIST
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="positions" className="space-y-4">
          {/* Live Positions Grid */}
          <div className="grid gap-4">
            {positions.map((position) => (
              <Card key={position.positionId} className="bg-gray-900 border-green-800">
                <CardContent className="p-4">
                  <div className="grid grid-cols-5 gap-4">
                    {/* Position Info */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="font-bold text-green-400">{position.contestName}</h4>
                        <Badge variant={position.status === 'LIVE' ? 'default' : 'secondary'}>
                          {position.status}
                        </Badge>
                      </div>
                      <div className="text-sm text-gray-400 space-y-1">
                        <div>{position.platform} • {position.sport}</div>
                        <div>Entries: {position.entries}x @ {formatCurrency(position.entryFee)}</div>
                        <div>Total Risk: {formatCurrency(position.entryFee * position.entries)}</div>
                        <div className="flex items-center gap-2">
                          <span>Time Left:</span>
                          <span className={position.timeRemaining < 60 ? 'text-red-400' : 'text-yellow-400'}>
                            {position.timeRemaining}m
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Performance Metrics */}
                    <div className="space-y-2">
                      <div className="text-sm">
                        <div className="text-gray-400">Current Rank</div>
                        <div className="font-bold text-yellow-400">
                          #{position.currentRank} / {position.totalEntries.toLocaleString()}
                        </div>
                        <div className="text-xs text-gray-400">
                          {formatPercent(1 - (position.currentRank / position.totalEntries))} percentile
                        </div>
                      </div>
                      
                      <div className="text-sm">
                        <div className="text-gray-400">Live Score</div>
                        <div className="font-bold text-green-400">{position.liveScore.toFixed(1)}</div>
                        <div className="text-xs text-gray-400">
                          Proj: {position.projectedScore.toFixed(1)}
                        </div>
                      </div>
                    </div>

                    {/* P&L Analysis */}
                    <div className="space-y-2">
                      <div className="text-sm">
                        <div className="text-gray-400">Unrealized P&L</div>
                        <div className={`font-bold ${position.pnlUnrealized >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                          {formatCurrency(position.pnlUnrealized)}
                        </div>
                        <div className="text-xs text-gray-400">
                          ROI: {formatPercent(position.roiCurrent)}
                        </div>
                      </div>
                      
                      <div className="text-sm">
                        <div className="text-gray-400">Potential Payout</div>
                        <div className="font-bold text-blue-400">{formatCurrency(position.currentPayout)}</div>
                        <div className="text-xs text-gray-400">
                          Max: {formatCurrency(position.potentialPayout)}
                        </div>
                      </div>
                    </div>

                    {/* Probability Analysis */}
                    <div className="space-y-2">
                      <div className="text-sm">
                        <div className="text-gray-400">Cash Probability</div>
                        <div className="font-bold text-green-400">{formatPercent(position.cashProbability)}</div>
                        <Progress value={position.cashProbability * 100} className="h-2 mt-1" />
                      </div>
                      
                      <div className="text-sm">
                        <div className="text-gray-400">Bink Probability</div>
                        <div className="font-bold text-yellow-400">{formatPercent(position.bineProbability)}</div>
                        <Progress value={position.bineProbability * 100} className="h-2 mt-1" />
                      </div>
                    </div>

                    {/* Risk Metrics */}
                    <div className="text-sm space-y-2">
                      <div className="text-gray-400 font-semibold">Risk Metrics</div>
                      <div className="space-y-1">
                        <div className="flex justify-between">
                          <span>Beta:</span>
                          <span className="text-blue-400">{position.riskMetrics.beta.toFixed(2)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Correlation:</span>
                          <span className="text-blue-400">{formatPercent(position.riskMetrics.correlation)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Concentration:</span>
                          <span className={position.riskMetrics.concentrationRisk > 0.3 ? 'text-red-400' : 'text-green-400'}>
                            {formatPercent(position.riskMetrics.concentrationRisk)}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>Sharpe Contrib:</span>
                          <span className="text-blue-400">{position.riskMetrics.sharpeContribution.toFixed(3)}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Position Status Bar */}
                  <div className="mt-4 pt-4 border-t border-gray-700">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 text-xs text-gray-400">
                        <span>Score Percentile: {formatPercent(position.scorePercentile)}</span>
                        <span>•</span>
                        <span>Proj ROI: {formatPercent(position.roiProjected)}</span>
                        <span>•</span>
                        <span>Time: {position.timeRemaining}m</span>
                      </div>
                      
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" className="h-6 text-xs">
                          VIEW LINEUP
                        </Button>
                        <Button size="sm" variant="outline" className="h-6 text-xs">
                          HEDGE
                        </Button>
                        {position.status === 'LIVE' && (
                          <Button size="sm" variant="destructive" className="h-6 text-xs">
                            CLOSE
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="analytics" className="space-y-6">
          {/* Advanced Charts */}
          <div className="grid grid-cols-2 gap-6">
            {/* Sharpe Ratio Trend */}
            <Card className="bg-gray-900 border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <Activity className="w-5 h-5" />
                  Risk-Adjusted Performance
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <LineChart data={chartDataExtended}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" tick={{fontSize: 10}} stroke="#6B7280" />
                    <YAxis tick={{fontSize: 10}} stroke="#6B7280" />
                    <Tooltip 
                      formatter={(value, name) => [Number(value).toFixed(2), name]}
                      labelStyle={{color: '#10B981'}}
                      contentStyle={{backgroundColor: '#1F2937', border: '1px solid #10B981'}}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="sharpe" 
                      stroke="#F59E0B" 
                      strokeWidth={2}
                      name="Sharpe Ratio"
                    />
                    <ReferenceLine y={2.0} stroke="#EF4444" strokeDasharray="5 5" />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Drawdown Analysis */}
            <Card className="bg-gray-900 border-green-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-green-400">
                  <Shield className="w-5 h-5" />
                  Drawdown Analysis
                </CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart data={chartDataExtended}>
                    <defs>
                      <linearGradient id="drawdown" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#EF4444" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#EF4444" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="time" tick={{fontSize: 10}} stroke="#6B7280" />
                    <YAxis tick={{fontSize: 10}} stroke="#6B7280" />
                    <Tooltip 
                      formatter={(value) => [formatPercent(Number(value)), 'Drawdown']}
                      labelStyle={{color: '#EF4444'}}
                      contentStyle={{backgroundColor: '#1F2937', border: '1px solid #EF4444'}}
                    />
                    <Area 
                      type="monotone" 
                      dataKey="drawdown" 
                      stroke="#EF4444" 
                      fillOpacity={1} 
                      fill="url(#drawdown)" 
                    />
                    <ReferenceLine y={-0.05} stroke="#F59E0B" strokeDasharray="3 3" />
                    <ReferenceLine y={-0.10} stroke="#EF4444" strokeDasharray="3 3" />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          {/* Performance Matrix */}
          <Card className="bg-gray-900 border-green-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-green-400">
                <BarChart3 className="w-5 h-5" />
                Advanced Performance Matrix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-4 gap-6">
                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-300">Return Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Total Return:</span>
                      <span className="text-green-400 font-bold">{formatPercent(metrics.totalROI)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Alpha:</span>
                      <span className="text-green-400">{formatPercent(metrics.alpha)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Beta:</span>
                      <span className="text-blue-400">{metrics.beta.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Information Ratio:</span>
                      <span className="text-yellow-400">{metrics.informationRatio.toFixed(2)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-300">Risk Metrics</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Volatility:</span>
                      <span className="text-red-400">{formatPercent(metrics.volatility)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">VaR (95%):</span>
                      <span className="text-red-400">{formatCurrency(metrics.var95)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Expected Shortfall:</span>
                      <span className="text-red-400">{formatCurrency(metrics.expectedShortfall)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Tracking Error:</span>
                      <span className="text-red-400">{formatPercent(metrics.trackingError)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-300">Ratio Analysis</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sharpe Ratio:</span>
                      <span className="text-green-400 font-bold">{metrics.sharpeRatio.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Sortino Ratio:</span>
                      <span className="text-green-400">{metrics.sortinoRatio.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Profit Factor:</span>
                      <span className="text-green-400">{metrics.profitFactor.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Win Rate:</span>
                      <span className="text-green-400">{formatPercent(metrics.winRate)}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="font-semibold text-gray-300">Kelly Analysis</h4>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Kelly Optimal:</span>
                      <span className="text-yellow-400 font-bold">{formatPercent(metrics.kellyOptimal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Actual Kelly:</span>
                      <span className="text-yellow-400">{formatPercent(metrics.actualKelly)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Kelly Efficiency:</span>
                      <span className={metrics.actualKelly <= metrics.kellyOptimal ? 'text-green-400' : 'text-red-400'}>
                        {formatPercent(metrics.actualKelly / metrics.kellyOptimal)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-400">Avg Position:</span>
                      <span className="text-blue-400">{formatPercent(metrics.avgPosition)}</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="risk" className="space-y-6">
          {/* Risk Dashboard */}
          <div className="grid grid-cols-3 gap-6">
            {/* Portfolio Risk */}
            <Card className="bg-gray-900 border-red-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <AlertTriangle className="w-5 h-5" />
                  Portfolio Risk Monitor
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Current Drawdown</span>
                      <span className="text-red-400 font-bold">{formatPercent(Math.abs(metrics.currentDrawdown))}</span>
                    </div>
                    <Progress value={Math.abs(metrics.currentDrawdown) * 200} className="h-2" />
                    <div className="text-xs text-gray-500 mt-1">Max: {formatPercent(Math.abs(metrics.maxDrawdown))}</div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">VaR Utilization</span>
                      <span className="text-yellow-400 font-bold">{formatPercent(Math.abs(metrics.dailyPnL / metrics.var95))}</span>
                    </div>
                    <Progress value={Math.abs(metrics.dailyPnL / metrics.var95) * 100} className="h-2" />
                    <div className="text-xs text-gray-500 mt-1">95% VaR: {formatCurrency(metrics.var95)}</div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Kelly Deviation</span>
                      <span className={metrics.actualKelly > metrics.kellyOptimal * 1.2 ? 'text-red-400' : 'text-green-400'}>
                        {formatPercent(Math.abs(metrics.actualKelly - metrics.kellyOptimal))}
                      </span>
                    </div>
                    <Progress 
                      value={Math.abs(metrics.actualKelly - metrics.kellyOptimal) * 500} 
                      className="h-2" 
                    />
                    <div className="text-xs text-gray-500 mt-1">
                      Target: {formatPercent(metrics.kellyOptimal)}
                    </div>
                  </div>

                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-400">Concentration Risk</span>
                      <span className="text-orange-400 font-bold">67%</span>
                    </div>
                    <Progress value={67} className="h-2" />
                    <div className="text-xs text-gray-500 mt-1">Threshold: 80%</div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Risk Alerts */}
            <Card className="bg-gray-900 border-red-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <Bell className="w-5 h-5" />
                  Active Risk Alerts
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {alerts.length === 0 ? (
                    <div className="text-center text-gray-400 py-8">
                      <Shield className="w-8 h-8 mx-auto mb-2" />
                      <div>No Active Alerts</div>
                      <div className="text-xs">All risk parameters within limits</div>
                    </div>
                  ) : (
                    alerts.map((alert) => (
                      <div key={alert.id} className={`border rounded p-3 ${getSeverityColor(alert.severity)}`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="font-bold text-sm">{alert.title}</div>
                          <Badge variant={alert.severity === 'CRITICAL' ? 'destructive' : 'default'}>
                            {alert.severity}
                          </Badge>
                        </div>
                        <div className="text-xs mb-2">{alert.message}</div>
                        <div className="text-xs text-gray-300">{alert.recommendation}</div>
                        <div className="flex justify-between items-center mt-2">
                          <span className="text-xs">Impact: {formatCurrency(alert.impact)}</span>
                          <Button size="sm" variant="outline" className="h-6 text-xs">
                            ACKNOWLEDGE
                          </Button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Emergency Controls */}
            <Card className="bg-red-950 border-red-800">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-red-400">
                  <Zap className="w-5 h-5" />
                  Emergency Controls
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Button variant="destructive" size="sm" className="w-full">
                    🚨 STOP ALL TRADING
                  </Button>
                  <Button variant="outline" size="sm" className="w-full border-red-600 text-red-400">
                    ⚠️ REDUCE EXPOSURE 50%
                  </Button>
                  <Button variant="outline" size="sm" className="w-full border-yellow-600 text-yellow-400">
                    🛡️ EMERGENCY HEDGE
                  </Button>
                  <Button variant="outline" size="sm" className="w-full border-blue-600 text-blue-400">
                    💰 CLOSE PROFITABLE
                  </Button>
                </div>

                <Separator className="my-4" />

                <div className="space-y-2 text-xs">
                  <div className="text-gray-400 font-semibold">Circuit Breakers</div>
                  <div className="flex justify-between">
                    <span>Daily Loss Limit:</span>
                    <span className="text-red-400">-$5,000</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Max Drawdown:</span>
                    <span className="text-red-400">-15%</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Kelly Violation:</span>
                    <span className="text-yellow-400">2x Optimal</span>
                  </div>
                  <div className="flex justify-between">
                    <span>Correlation Limit:</span>
                    <span className="text-orange-400">0.8</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Risk Matrix */}
          <Card className="bg-gray-900 border-red-800">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-red-400">
                <Crosshair className="w-5 h-5" />
                Risk-Return Matrix
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ScatterChart>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    type="number" 
                    dataKey="risk" 
                    name="Risk (Volatility)" 
                    tick={{fontSize: 10}} 
                    stroke="#6B7280"
                    label={{ value: 'Risk (Volatility)', position: 'insideBottom', offset: -5 }}
                  />
                  <YAxis 
                    type="number" 
                    dataKey="return" 
                    name="Return (ROI)" 
                    tick={{fontSize: 10}} 
                    stroke="#6B7280"
                    label={{ value: 'Return (ROI)', angle: -90, position: 'insideLeft' }}
                  />
                  <Tooltip 
                    formatter={(value, name) => [
                      name === 'return' ? formatPercent(Number(value)) : formatPercent(Number(value)), 
                      name === 'return' ? 'Return' : 'Risk'
                    ]}
                    contentStyle={{backgroundColor: '#1F2937', border: '1px solid #EF4444'}}
                  />
                  <Scatter 
                    name="Positions" 
                    data={[
                      { risk: metrics.volatility, return: metrics.totalROI, size: 100 },
                      { risk: 0.12, return: 0.15, size: 80 },
                      { risk: 0.18, return: 0.25, size: 120 },
                      { risk: 0.08, return: 0.08, size: 60 },
                      { risk: 0.22, return: 0.18, size: 90 }
                    ]} 
                    fill="#10B981" 
                  />
                  <ReferenceLine x={metrics.volatility} stroke="#F59E0B" strokeDasharray="3 3" />
                  <ReferenceLine y={metrics.totalROI} stroke="#F59E0B" strokeDasharray="3 3" />
                </ScatterChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Footer Status Bar */}
      <div className="mt-6 p-4 bg-gray-900 border border-green-800 rounded">
        <div className="flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-6">
            <span>Last Update: {new Date().toLocaleTimeString()}</span>
            <span>Latency: {Math.random() * 50 + 10 | 0}ms</span>
            <span>Memory: {(Math.random() * 200 + 800 | 0)}MB</span>
            <span>Active WebSocket Connections: 3</span>
          </div>
          
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              Database Connected
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-green-500 rounded-full" />
              API Healthy
            </span>
            <span className="flex items-center gap-1">
              <div className="w-2 h-2 bg-yellow-500 rounded-full" />
              {portfolioMetrics.livePositions} Live Positions
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
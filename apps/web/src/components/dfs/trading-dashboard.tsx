'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Separator } from '@/components/ui/separator';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, Area, AreaChart, PieChart, Pie, Cell
} from 'recharts';
import { 
  TrendingUp, TrendingDown, DollarSign, AlertTriangle, 
  Target, Activity, Zap, Shield, Brain, Eye, 
  Trophy, Gauge, Signal, Users
} from 'lucide-react';

// Mock data interfaces
interface PerformanceMetrics {
  totalPnL: number;
  dailyPnL: number;
  weeklyPnL: number;
  monthlyPnL: number;
  totalROI: number;
  winRate: number;
  sharpeRatio: number;
  maxDrawdown: number;
  currentDrawdown: number;
  kellyOptimal: number;
  sortino: number;
  profitFactor: number;
  totalVolume: number;
  contestsPlayed: number;
}

interface ContestOpportunity {
  contestId: string;
  name: string;
  platform: string;
  sport: string;
  entryFee: number;
  totalPrize: number;
  currentEntries: number;
  maxEntries: number;
  overlay: number;
  edgeScore: number;
  leverageScore: number;
  fieldStrength: number;
  recommendation: 'STRONG_PLAY' | 'PLAY' | 'NEUTRAL' | 'AVOID' | 'STRONG_AVOID';
  expectedROI: number;
  optimalEntries: number;
  reasoning: string[];
}

interface LivePosition {
  contestId: string;
  name: string;
  platform: string;
  sport: string;
  entryFee: number;
  currentRank: number;
  totalEntries: number;
  projectedPayout: number;
  liveScore: number;
  status: 'PENDING' | 'LIVE' | 'COMPLETED';
  ownership: { [playerId: string]: number };
}

interface OwnershipLeverage {
  playerId: string;
  name: string;
  position: string;
  salary: number;
  projectedOwnership: number;
  leverageScore: number;
  chalkScore: number;
  contrarianScore: number;
  narrativeFactors: string[];
  recommendation: 'LEVERAGE' | 'FADE' | 'NEUTRAL';
}

// Mock data
const generateMockPerformanceMetrics = (): PerformanceMetrics => ({
  totalPnL: 24750.80,
  dailyPnL: 1247.30,
  weeklyPnL: 3891.70,
  monthlyPnL: 12450.90,
  totalROI: 0.203,  // 20.3%
  winRate: 0.673,   // 67.3%
  sharpeRatio: 2.14,
  maxDrawdown: -0.087, // -8.7%
  currentDrawdown: -0.023, // -2.3%
  kellyOptimal: 0.123, // 12.3%
  sortino: 3.28,
  profitFactor: 2.67,
  totalVolume: 187450,
  contestsPlayed: 342
});

const generateMockContestOpportunities = (): ContestOpportunity[] => [
  {
    contestId: 'GPP_NFL_1',
    name: '$100K Sunday Million',
    platform: 'DraftKings',
    sport: 'NFL',
    entryFee: 20,
    totalPrize: 100000,
    currentEntries: 4500,
    maxEntries: 7000,
    overlay: 10000,
    edgeScore: 0.167, // 16.7%
    leverageScore: 26.04,
    fieldStrength: 0.42,
    recommendation: 'STRONG_PLAY',
    expectedROI: 0.215,
    optimalEntries: 8,
    reasoning: ['High overlay ($10K)', 'Weak field (42% fish)', 'Prime leverage spots available']
  },
  {
    contestId: 'CASH_NFL_1',
    name: 'Double Up $50',
    platform: 'FanDuel',
    sport: 'NFL',
    entryFee: 50,
    totalPrize: 4500,
    currentEntries: 90,
    maxEntries: 100,
    overlay: 0,
    edgeScore: 0.089,
    leverageScore: 12.45,
    fieldStrength: 0.35,
    recommendation: 'PLAY',
    expectedROI: 0.127,
    optimalEntries: 3,
    reasoning: ['Good field strength', 'Positive edge', 'Low variance']
  },
  {
    contestId: 'GPP_NBA_1',
    name: 'Showdown Special',
    platform: 'DraftKings',
    sport: 'NBA',
    entryFee: 5,
    totalPrize: 10000,
    currentEntries: 2800,
    maxEntries: 2500, // Already filled
    overlay: -1500,
    edgeScore: -0.045,
    leverageScore: 8.12,
    fieldStrength: 0.68,
    recommendation: 'AVOID',
    expectedROI: -0.089,
    optimalEntries: 0,
    reasoning: ['No overlay', 'Shark-heavy field', 'Negative edge']
  }
];

const generateMockLivePositions = (): LivePosition[] => [
  {
    contestId: 'GPP_NFL_LIVE1',
    name: 'Sunday Night Showdown',
    platform: 'DraftKings',
    sport: 'NFL',
    entryFee: 25,
    currentRank: 45,
    totalEntries: 8500,
    projectedPayout: 450,
    liveScore: 187.34,
    status: 'LIVE',
    ownership: { 'player1': 12.4, 'player2': 8.7 }
  },
  {
    contestId: 'CASH_NBA_LIVE1',
    name: 'Triple Up Madness',
    platform: 'FanDuel',
    sport: 'NBA',
    entryFee: 10,
    currentRank: 12,
    totalEntries: 100,
    projectedPayout: 30,
    liveScore: 245.8,
    status: 'LIVE',
    ownership: { 'player3': 23.1, 'player4': 18.9 }
  }
];

const generateMockOwnershipLeverage = (): OwnershipLeverage[] => [
  {
    playerId: 'nfl_1',
    name: 'Josh Allen',
    position: 'QB',
    salary: 8400,
    projectedOwnership: 0.347, // 34.7%
    leverageScore: 26.04,
    chalkScore: 8.9,
    contrarianScore: 2.1,
    narrativeFactors: ['Prime time game', 'Revenge narrative', 'High vegas total'],
    recommendation: 'FADE'
  },
  {
    playerId: 'nfl_2',
    name: 'DeAndre Hopkins',
    position: 'WR',
    salary: 6200,
    projectedOwnership: 0.089, // 8.9%
    leverageScore: 31.7,
    chalkScore: 2.4,
    contrarianScore: 7.8,
    narrativeFactors: ['Injury return', 'Favorable matchup', 'Low ownership projected'],
    recommendation: 'LEVERAGE'
  },
  {
    playerId: 'nfl_3',
    name: 'Christian McCaffrey',
    position: 'RB',
    salary: 9000,
    projectedOwnership: 0.412, // 41.2%
    leverageScore: 18.9,
    chalkScore: 9.2,
    contrarianScore: 1.8,
    narrativeFactors: ['Highest salary', 'Safe floor play', 'Chalk territory'],
    recommendation: 'FADE'
  }
];

const chartData = [
  { date: '1/15', pnl: 850, roi: 0.15, winRate: 0.68, volume: 2400 },
  { date: '1/16', pnl: 1200, roi: 0.18, winRate: 0.71, volume: 3100 },
  { date: '1/17', pnl: -420, roi: 0.16, winRate: 0.65, volume: 1800 },
  { date: '1/18', pnl: 1850, roi: 0.21, winRate: 0.74, volume: 4200 },
  { date: '1/19', pnl: 950, roi: 0.19, winRate: 0.69, volume: 2800 },
  { date: '1/20', pnl: 2100, roi: 0.24, winRate: 0.78, volume: 5100 },
  { date: '1/21', pnl: 1247, roi: 0.203, winRate: 0.673, volume: 3750 }
];

const riskData = [
  { name: 'Low Risk', value: 45, color: '#10B981' },
  { name: 'Medium Risk', value: 35, color: '#F59E0B' },
  { name: 'High Risk', value: 15, color: '#EF4444' },
  { name: 'Extreme Risk', value: 5, color: '#7C2D12' }
];

export default function TradingDashboard() {
  const [metrics, setMetrics] = useState<PerformanceMetrics>(generateMockPerformanceMetrics());
  const [contests, setContests] = useState<ContestOpportunity[]>(generateMockContestOpportunities());
  const [positions, setPositions] = useState<LivePosition[]>(generateMockLivePositions());
  const [leverage, setLeverage] = useState<OwnershipLeverage[]>(generateMockOwnershipLeverage());
  const [selectedTimeframe, setSelectedTimeframe] = useState<'1D' | '7D' | '30D' | 'ALL'>('7D');
  const [isLive, setIsLive] = useState(true);

  // Simulate real-time updates
  useEffect(() => {
    if (!isLive) return;
    
    const interval = setInterval(() => {
      // Update metrics with small random changes
      setMetrics(prev => ({
        ...prev,
        dailyPnL: prev.dailyPnL + (Math.random() - 0.5) * 50,
        totalPnL: prev.totalPnL + (Math.random() - 0.5) * 50
      }));
      
      // Update live positions
      setPositions(prev => prev.map(pos => ({
        ...pos,
        liveScore: pos.liveScore + (Math.random() - 0.3) * 5,
        currentRank: Math.max(1, pos.currentRank + Math.floor((Math.random() - 0.5) * 10))
      })));
    }, 2000);

    return () => clearInterval(interval);
  }, [isLive]);

  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(value);
  };

  const formatPercent = (value: number): string => {
    return `${(value * 100).toFixed(1)}%`;
  };

  const getRecommendationColor = (rec: string) => {
    switch (rec) {
      case 'STRONG_PLAY': return 'bg-green-600 text-white';
      case 'PLAY': return 'bg-green-500 text-white';
      case 'NEUTRAL': return 'bg-gray-500 text-white';
      case 'AVOID': return 'bg-red-500 text-white';
      case 'STRONG_AVOID': return 'bg-red-600 text-white';
      case 'LEVERAGE': return 'bg-blue-600 text-white';
      case 'FADE': return 'bg-orange-600 text-white';
      default: return 'bg-gray-500 text-white';
    }
  };

  return (
    <div className="min-h-screen bg-black text-green-400 p-4 font-mono">
      {/* Header */}
      <div className="flex items-center justify-between mb-6 border-b border-green-800 pb-4">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Brain className="w-8 h-8 text-green-400" />
            <h1 className="text-2xl font-bold text-green-400">DFS TRADING TERMINAL</h1>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-3 h-3 rounded-full ${isLive ? 'bg-green-500' : 'bg-red-500'} animate-pulse`} />
            <span className="text-sm">{isLive ? 'LIVE' : 'OFFLINE'}</span>
          </div>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-sm text-gray-400">Current Bankroll</div>
            <div className="text-xl font-bold text-green-400">{formatCurrency(metrics.totalPnL + 100000)}</div>
          </div>
          <Button
            onClick={() => setIsLive(!isLive)}
            variant={isLive ? "destructive" : "default"}
            size="sm"
          >
            {isLive ? 'PAUSE' : 'START'} FEED
          </Button>
        </div>
      </div>

      {/* Key Metrics Row */}
      <div className="grid grid-cols-6 gap-4 mb-6">
        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Daily P&L</p>
                <p className={`text-lg font-bold ${metrics.dailyPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                  {formatCurrency(metrics.dailyPnL)}
                </p>
              </div>
              {metrics.dailyPnL >= 0 ? <TrendingUp className="w-5 h-5 text-green-400" /> : <TrendingDown className="w-5 h-5 text-red-400" />}
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Total ROI</p>
                <p className="text-lg font-bold text-green-400">{formatPercent(metrics.totalROI)}</p>
              </div>
              <Target className="w-5 h-5 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Win Rate</p>
                <p className="text-lg font-bold text-green-400">{formatPercent(metrics.winRate)}</p>
              </div>
              <Trophy className="w-5 h-5 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Sharpe Ratio</p>
                <p className="text-lg font-bold text-green-400">{metrics.sharpeRatio.toFixed(2)}</p>
              </div>
              <Activity className="w-5 h-5 text-green-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Kelly Optimal</p>
                <p className="text-lg font-bold text-yellow-400">{formatPercent(metrics.kellyOptimal)}</p>
              </div>
              <Gauge className="w-5 h-5 text-yellow-400" />
            </div>
          </CardContent>
        </Card>

        <Card className="bg-gray-900 border-green-800">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-400 uppercase">Max Drawdown</p>
                <p className="text-lg font-bold text-red-400">{formatPercent(Math.abs(metrics.maxDrawdown))}</p>
              </div>
              <Shield className="w-5 h-5 text-red-400" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Dashboard Grid */}
      <div className="grid grid-cols-3 gap-6">
        {/* Contest Intelligence Center */}
        <Card className="bg-gray-900 border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-400">
              <Eye className="w-5 h-5" />
              Contest Intelligence Center
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {contests.map((contest) => (
              <div key={contest.contestId} className="border border-gray-700 rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-green-400 text-sm">{contest.name}</h4>
                    <p className="text-xs text-gray-400">{contest.platform} • {contest.sport}</p>
                  </div>
                  <Badge className={getRecommendationColor(contest.recommendation)}>
                    {contest.recommendation.replace('_', ' ')}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">Entry:</span>
                    <div className="font-bold text-green-400">{formatCurrency(contest.entryFee)}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Edge:</span>
                    <div className={`font-bold ${contest.edgeScore > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {formatPercent(contest.edgeScore)}
                    </div>
                  </div>
                  <div>
                    <span className="text-gray-400">Leverage:</span>
                    <div className="font-bold text-blue-400">{contest.leverageScore.toFixed(1)}x</div>
                  </div>
                </div>

                {contest.overlay > 0 && (
                  <div className="text-xs">
                    <span className="text-yellow-400">⚡ OVERLAY: {formatCurrency(contest.overlay)}</span>
                  </div>
                )}

                <div className="text-xs text-gray-400">
                  {contest.reasoning.slice(0, 2).join(' • ')}
                </div>

                {contest.recommendation === 'STRONG_PLAY' && (
                  <div className="text-xs bg-green-900 border border-green-700 rounded p-2">
                    <span className="text-green-400 font-semibold">OPTIMAL: {contest.optimalEntries} entries</span>
                    <div>Expected ROI: {formatPercent(contest.expectedROI)}</div>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* Performance Analytics */}
        <Card className="bg-gray-900 border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-400">
              <Signal className="w-5 h-5" />
              Performance Analytics
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {/* P&L Chart */}
              <div>
                <h4 className="text-sm font-semibold text-green-400 mb-2">7-Day P&L Trend</h4>
                <ResponsiveContainer width="100%" height={120}>
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="pnl" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10B981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10B981" stopOpacity={0.1}/>
                      </linearGradient>
                    </defs>
                    <Area 
                      type="monotone" 
                      dataKey="pnl" 
                      stroke="#10B981" 
                      fillOpacity={1} 
                      fill="url(#pnl)" 
                    />
                    <XAxis dataKey="date" tick={{fontSize: 10}} />
                    <Tooltip 
                      formatter={(value) => [formatCurrency(Number(value)), 'P&L']}
                      labelStyle={{color: '#10B981'}}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* Win Rate Chart */}
              <div>
                <h4 className="text-sm font-semibold text-green-400 mb-2">Win Rate Trend</h4>
                <ResponsiveContainer width="100%" height={100}>
                  <LineChart data={chartData}>
                    <Line 
                      type="monotone" 
                      dataKey="winRate" 
                      stroke="#F59E0B" 
                      strokeWidth={2}
                      dot={{fill: '#F59E0B', strokeWidth: 2, r: 3}}
                    />
                    <XAxis dataKey="date" tick={{fontSize: 10}} />
                    <Tooltip 
                      formatter={(value) => [formatPercent(Number(value)), 'Win Rate']}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Risk Distribution */}
              <div>
                <h4 className="text-sm font-semibold text-green-400 mb-2">Risk Distribution</h4>
                <ResponsiveContainer width="100%" height={120}>
                  <PieChart>
                    <Pie
                      data={riskData}
                      cx="50%"
                      cy="50%"
                      innerRadius={25}
                      outerRadius={50}
                      paddingAngle={2}
                      dataKey="value"
                    >
                      {riskData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => [`${value}%`, 'Allocation']} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Live Trading Monitor */}
        <Card className="bg-gray-900 border-green-800">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-green-400">
              <Zap className="w-5 h-5" />
              Live Trading Monitor
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {positions.map((position) => (
              <div key={position.contestId} className="border border-gray-700 rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-green-400 text-sm">{position.name}</h4>
                    <p className="text-xs text-gray-400">{position.platform} • {position.sport}</p>
                  </div>
                  <Badge variant={position.status === 'LIVE' ? 'default' : 'secondary'}>
                    {position.status}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400">Current Rank:</span>
                    <div className="font-bold text-yellow-400">#{position.currentRank}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Live Score:</span>
                    <div className="font-bold text-green-400">{position.liveScore.toFixed(1)}</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400">Entry Fee:</span>
                    <div className="font-bold text-green-400">{formatCurrency(position.entryFee)}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Proj. Payout:</span>
                    <div className="font-bold text-green-400">{formatCurrency(position.projectedPayout)}</div>
                  </div>
                </div>

                {/* Progress bar for position */}
                <div>
                  <div className="flex justify-between text-xs text-gray-400 mb-1">
                    <span>Position</span>
                    <span>{position.currentRank} / {position.totalEntries}</span>
                  </div>
                  <Progress 
                    value={((position.totalEntries - position.currentRank) / position.totalEntries) * 100} 
                    className="h-2"
                  />
                </div>

                {position.projectedPayout > position.entryFee && (
                  <div className="text-xs bg-green-900 border border-green-700 rounded p-2">
                    <span className="text-green-400 font-semibold">
                      PROFITABLE: +{formatCurrency(position.projectedPayout - position.entryFee)}
                    </span>
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Ownership Analytics Hub */}
      <Card className="bg-gray-900 border-green-800 mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-green-400">
            <Users className="w-5 h-5" />
            Ownership Projection Engine - Leverage Opportunities
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {leverage.map((player) => (
              <div key={player.playerId} className="border border-gray-700 rounded p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-green-400 text-sm">{player.name}</h4>
                    <p className="text-xs text-gray-400">{player.position} • ${player.salary}</p>
                  </div>
                  <Badge className={getRecommendationColor(player.recommendation)}>
                    {player.recommendation}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 text-xs">
                  <div>
                    <span className="text-gray-400">Ownership:</span>
                    <div className="font-bold text-yellow-400">{formatPercent(player.projectedOwnership)}</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Leverage:</span>
                    <div className="font-bold text-blue-400">{player.leverageScore.toFixed(1)}x</div>
                  </div>
                  <div>
                    <span className="text-gray-400">Chalk:</span>
                    <div className="font-bold text-orange-400">{player.chalkScore.toFixed(1)}</div>
                  </div>
                </div>

                <div className="space-y-1">
                  {player.narrativeFactors.slice(0, 2).map((factor, idx) => (
                    <div key={idx} className="text-xs text-gray-300 bg-gray-800 rounded px-2 py-1">
                      {factor}
                    </div>
                  ))}
                </div>

                {player.recommendation === 'LEVERAGE' && (
                  <div className="text-xs bg-blue-900 border border-blue-700 rounded p-2">
                    <span className="text-blue-400 font-semibold">
                      🎯 HIGH LEVERAGE OPPORTUNITY
                    </span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Emergency Controls */}
      <Card className="bg-red-950 border-red-800 mt-6">
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-red-400">
            <AlertTriangle className="w-5 h-5" />
            Emergency Trading Controls
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="text-sm text-red-300">
              Current drawdown: {formatPercent(Math.abs(metrics.currentDrawdown))} 
              {Math.abs(metrics.currentDrawdown) > 0.05 && (
                <span className="ml-2 text-yellow-400">⚠️ Monitor closely</span>
              )}
            </div>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm">
                STOP ALL TRADING
              </Button>
              <Button variant="outline" size="sm" className="border-yellow-600 text-yellow-400">
                REDUCE EXPOSURE
              </Button>
              <Button variant="outline" size="sm" className="border-blue-600 text-blue-400">
                EMERGENCY HEDGE
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
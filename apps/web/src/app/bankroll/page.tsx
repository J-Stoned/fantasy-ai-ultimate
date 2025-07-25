"use client";

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { 
import { logger } from '../../lib/logging/logger';
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  AlertTriangle, 
  Shield, 
  Target,
  Zap,
  RefreshCw,
  History,
  Eye,
  EyeOff
} from 'lucide-react';

interface BankrollData {
  current: number;
  available: number;
  reserved: number;
}

interface PerformanceData {
  totalContests: number;
  winningContests: number;
  winRate: string;
  totalWagered: number;
  totalReturns: number;
  roi: string;
  maxDrawdown: string;
}

interface ContestRecommendation {
  contestId: string;
  contestName: string;
  contestType: string;
  entryFee: number;
  recommendedBetSize: number;
  riskLevel: string;
  expectedReturn: number;
  confidence: number;
  reasoning: string;
}

interface BankrollHistory {
  date: string;
  bankroll: number;
  change: number;
}

const RISK_LEVELS = {
  conservative: { label: 'Conservative', color: '#10b981', description: 'Quarter-Kelly, lower risk' },
  moderate: { label: 'Balanced', color: '#f59e0b', description: 'Half-Kelly, balanced approach' },
  aggressive: { label: 'Aggressive', color: '#ef4444', description: 'Three-quarter Kelly, higher risk' }
};

const BANKROLL_HEALTH = [
  { threshold: 0.9, label: 'Excellent', color: '#10b981', icon: '🟢' },
  { threshold: 0.75, label: 'Good', color: '#22c55e', icon: '🔵' },
  { threshold: 0.6, label: 'Fair', color: '#f59e0b', icon: '🟡' },
  { threshold: 0.4, label: 'Caution', color: '#f97316', icon: '🟠' },
  { threshold: 0, label: 'Critical', color: '#ef4444', icon: '🔴' }
];

export default function BankrollPage() {
  const [bankroll, setBankroll] = useState<number>(1000);
  const [riskTolerance, setRiskTolerance] = useState<string>('moderate');
  const [bankrollData, setBankrollData] = useState<BankrollData | null>(null);
  const [performance, setPerformance] = useState<PerformanceData | null>(null);
  const [recommendations, setRecommendations] = useState<ContestRecommendation[]>([]);
  const [history, setHistory] = useState<BankrollHistory[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);

  // Load initial data
  useEffect(() => {
    loadBankrollData();
    loadBankrollHistory();
  }, []);

  // Auto-refresh every 30 seconds if enabled
  useEffect(() => {
    if (!autoRefresh) return;
    
    const interval = setInterval(() => {
      loadBankrollData();
      loadRecommendations();
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh, bankroll, riskTolerance]);

  const loadBankrollData = async () => {
    try {
      const response = await fetch('/api/bankroll/user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'status',
          currentBankroll: bankroll 
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setBankrollData(data.bankroll);
        setPerformance(data.performance);
      }
    } catch (error) {
      logger.error('Failed to load bankroll data:', { error: error });
    }
  };

  const loadBankrollHistory = async () => {
    try {
      const response = await fetch('/api/bankroll/history');
      if (response.ok) {
        const data = await response.json();
        setHistory(data.chartData || []);
      }
    } catch (error) {
      logger.error('Failed to load bankroll history:', { error: error });
    }
  };

  const loadRecommendations = async () => {
    if (!bankroll) return;
    
    setLoading(true);
    try {
      const response = await fetch('/api/bankroll/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          currentBankroll: bankroll,
          riskTolerance,
          maxRecommendations: 10
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setRecommendations(data.recommendations || []);
      }
    } catch (error) {
      logger.error('Failed to load recommendations:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  const updateBankroll = async (amount: number) => {
    setBankroll(amount);
    await loadBankrollData();
  };

  const getBankrollHealth = () => {
    if (!bankrollData || !history.length) return BANKROLL_HEALTH[2];
    
    const currentRatio = bankrollData.current / Math.max(...history.map(h => h.bankroll));
    return BANKROLL_HEALTH.find(h => currentRatio >= h.threshold) || BANKROLL_HEALTH[4];
  };

  const getRiskAllocation = () => {
    if (!bankrollData) return [];
    
    return [
      { name: 'Available', value: bankrollData.available, color: '#10b981' },
      { name: 'Reserved', value: bankrollData.reserved, color: '#6b7280' }
    ];
  };

  const health = getBankrollHealth();
  const riskAllocation = getRiskAllocation();

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 text-white p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                💰 Bankroll Manager
              </h1>
              <p className="text-slate-400 mt-2">Smart bankroll management with Kelly Criterion optimization</p>
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="border-slate-600 text-slate-300 hover:bg-slate-800"
              >
                {showAdvanced ? <EyeOff className="w-4 h-4 mr-2" /> : <Eye className="w-4 h-4 mr-2" />}
                {showAdvanced ? 'Hide' : 'Show'} Advanced
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setAutoRefresh(!autoRefresh)}
                className={`border-slate-600 ${autoRefresh ? 'bg-green-600 text-white' : 'text-slate-300 hover:bg-slate-800'}`}
              >
                <RefreshCw className={`w-4 h-4 mr-2 ${autoRefresh ? 'animate-spin' : ''}`} />
                Auto Refresh
              </Button>
            </div>
          </div>
        </div>

        {/* Bankroll Setup */}
        <Card className="bg-slate-800/50 border-slate-700 mb-6">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <DollarSign className="w-5 h-5 text-green-400" />
              Bankroll Setup
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <Label htmlFor="bankroll" className="text-slate-300">Current Bankroll</Label>
                <Input
                  id="bankroll"
                  type="number"
                  value={bankroll}
                  onChange={(e) => updateBankroll(Number(e.target.value))}
                  className="bg-slate-700 border-slate-600 text-white mt-1"
                  placeholder="Enter your bankroll amount"
                />
              </div>
              <div>
                <Label htmlFor="risk" className="text-slate-300">Risk Level</Label>
                <Select value={riskTolerance} onValueChange={setRiskTolerance}>
                  <SelectTrigger className="bg-slate-700 border-slate-600 text-white mt-1">
                    <SelectValue placeholder="Select risk level" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-700">
                    {Object.entries(RISK_LEVELS).map(([key, value]) => (
                      <SelectItem key={key} value={key} className="text-white hover:bg-slate-700">
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-full" style={{ backgroundColor: value.color }} />
                          <span>{value.label}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-end">
                <Button 
                  onClick={loadRecommendations} 
                  disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white w-full"
                >
                  {loading ? <RefreshCw className="w-4 h-4 mr-2 animate-spin" /> : <Target className="w-4 h-4 mr-2" />}
                  Get Recommendations
                </Button>
              </div>
            </div>
            
            {/* Risk Level Description */}
            <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
              <p className="text-sm text-slate-300">
                <strong className="text-white">{RISK_LEVELS[riskTolerance as keyof typeof RISK_LEVELS]?.label}:</strong>{' '}
                {RISK_LEVELS[riskTolerance as keyof typeof RISK_LEVELS]?.description}
              </p>
            </div>
          </CardContent>
        </Card>

        <Tabs defaultValue="dashboard" className="space-y-6">
          <TabsList className="bg-slate-800 border-slate-700">
            <TabsTrigger value="dashboard" className="data-[state=active]:bg-slate-700 text-slate-300 data-[state=active]:text-white">
              Dashboard
            </TabsTrigger>
            <TabsTrigger value="recommendations" className="data-[state=active]:bg-slate-700 text-slate-300 data-[state=active]:text-white">
              Recommendations
            </TabsTrigger>
            <TabsTrigger value="history" className="data-[state=active]:bg-slate-700 text-slate-300 data-[state=active]:text-white">
              History
            </TabsTrigger>
          </TabsList>

          {/* Dashboard Tab */}
          <TabsContent value="dashboard" className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Bankroll Health */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-400">Bankroll Health</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-white">{health.icon}</div>
                      <div className="text-lg font-semibold" style={{ color: health.color }}>
                        {health.label}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-white">
                        ${bankrollData?.current.toLocaleString() || '0'}
                      </div>
                      <div className="text-sm text-slate-400">Current</div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Available Funds */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-400">Available to Bet</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-green-400">
                        ${bankrollData?.available.toLocaleString() || '0'}
                      </div>
                      <div className="text-sm text-slate-400">85% of bankroll</div>
                    </div>
                    <Zap className="w-8 h-8 text-green-400" />
                  </div>
                </CardContent>
              </Card>

              {/* Win Rate */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-400">Win Rate</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-2xl font-bold text-blue-400">
                        {performance?.winRate || '0%'}
                      </div>
                      <div className="text-sm text-slate-400">
                        {performance?.winningContests || 0}/{performance?.totalContests || 0} contests
                      </div>
                    </div>
                    <TrendingUp className="w-8 h-8 text-blue-400" />
                  </div>
                </CardContent>
              </Card>

              {/* ROI */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium text-slate-400">ROI</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className={`text-2xl font-bold ${
                        performance?.roi?.startsWith('-') ? 'text-red-400' : 'text-green-400'
                      }`}>
                        {performance?.roi || '0%'}
                      </div>
                      <div className="text-sm text-slate-400">30 days</div>
                    </div>
                    {performance?.roi?.startsWith('-') ? 
                      <TrendingDown className="w-8 h-8 text-red-400" /> :
                      <TrendingUp className="w-8 h-8 text-green-400" />
                    }
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Bankroll Chart */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Bankroll History</CardTitle>
                </CardHeader>
                <CardContent>
                  {history.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#9ca3af"
                          tick={{ fill: '#9ca3af' }}
                        />
                        <YAxis 
                          stroke="#9ca3af"
                          tick={{ fill: '#9ca3af' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1f2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="bankroll" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-slate-400">
                      <div className="text-center">
                        <History className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                        <p>No historical data available</p>
                        <p className="text-sm mt-2">Start placing bets to see your progress</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Risk Allocation */}
              <Card className="bg-slate-800/50 border-slate-700">
                <CardHeader>
                  <CardTitle className="text-white">Risk Allocation</CardTitle>
                </CardHeader>
                <CardContent>
                  {riskAllocation.length > 0 ? (
                    <div className="space-y-4">
                      <ResponsiveContainer width="100%" height={200}>
                        <PieChart>
                          <Pie
                            data={riskAllocation}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {riskAllocation.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip 
                            contentStyle={{ 
                              backgroundColor: '#1f2937', 
                              border: '1px solid #374151',
                              borderRadius: '8px'
                            }}
                            formatter={(value: number) => [`$${value.toLocaleString()}`, '']}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="space-y-2">
                        {riskAllocation.map((item, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div 
                                className="w-3 h-3 rounded-full" 
                                style={{ backgroundColor: item.color }}
                              />
                              <span className="text-slate-300">{item.name}</span>
                            </div>
                            <span className="text-white font-medium">
                              ${item.value.toLocaleString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center justify-center h-64 text-slate-400">
                      <div className="text-center">
                        <Shield className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                        <p>Set your bankroll to see allocation</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* Recommendations Tab */}
          <TabsContent value="recommendations" className="space-y-6">
            {recommendations.length > 0 ? (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {recommendations.map((rec, index) => (
                  <Card key={rec.contestId} className="bg-slate-800/50 border-slate-700">
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-white">{rec.contestName}</CardTitle>
                        <Badge 
                          variant="outline" 
                          className={`border-slate-600 ${
                            rec.riskLevel === 'low' ? 'text-green-400 border-green-400' :
                            rec.riskLevel === 'medium' ? 'text-yellow-400 border-yellow-400' :
                            'text-red-400 border-red-400'
                          }`}
                        >
                          {rec.riskLevel} risk
                        </Badge>
                      </div>
                      <div className="text-sm text-slate-400 capitalize">
                        {rec.contestType} • ${rec.entryFee} entry
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <div className="text-sm text-slate-400">Recommended Bet</div>
                          <div className="text-xl font-bold text-green-400">
                            ${rec.recommendedBetSize.toLocaleString()}
                          </div>
                        </div>
                        <div>
                          <div className="text-sm text-slate-400">Expected Return</div>
                          <div className="text-xl font-bold text-blue-400">
                            ${rec.expectedReturn.toLocaleString()}
                          </div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="text-sm text-slate-400 mb-2">Confidence</div>
                        <Progress 
                          value={rec.confidence * 100} 
                          className="bg-slate-700"
                        />
                        <div className="text-sm text-slate-300 mt-1">
                          {(rec.confidence * 100).toFixed(0)}%
                        </div>
                      </div>

                      {showAdvanced && (
                        <div className="mt-4 p-3 bg-slate-700/50 rounded-lg">
                          <div className="text-sm text-slate-300">
                            <strong>Analysis:</strong> {rec.reasoning}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="bg-slate-800/50 border-slate-700">
                <CardContent className="py-12">
                  <div className="text-center text-slate-400">
                    <Target className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                    <p className="text-lg mb-2">No Contest Recommendations</p>
                    <p>Set your bankroll and click "Get Recommendations" to see optimal contests</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* History Tab */}
          <TabsContent value="history" className="space-y-6">
            <Card className="bg-slate-800/50 border-slate-700">
              <CardHeader>
                <CardTitle className="text-white">Bankroll History</CardTitle>
              </CardHeader>
              <CardContent>
                {history.length > 0 ? (
                  <div className="space-y-4">
                    <ResponsiveContainer width="100%" height={400}>
                      <LineChart data={history}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                        <XAxis 
                          dataKey="date" 
                          stroke="#9ca3af"
                          tick={{ fill: '#9ca3af' }}
                        />
                        <YAxis 
                          stroke="#9ca3af"
                          tick={{ fill: '#9ca3af' }}
                        />
                        <Tooltip 
                          contentStyle={{ 
                            backgroundColor: '#1f2937', 
                            border: '1px solid #374151',
                            borderRadius: '8px'
                          }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="bankroll" 
                          stroke="#3b82f6" 
                          strokeWidth={2}
                          dot={{ fill: '#3b82f6', strokeWidth: 2 }}
                        />
                        <Line 
                          type="monotone" 
                          dataKey="change" 
                          stroke="#10b981" 
                          strokeWidth={1}
                          dot={false}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-64 text-slate-400">
                    <div className="text-center">
                      <History className="w-12 h-12 mx-auto mb-4 text-slate-500" />
                      <p>No historical data available</p>
                      <p className="text-sm mt-2">Your bankroll changes will appear here over time</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Alerts */}
        {bankrollData && bankrollData.current < 500 && (
          <Alert className="mt-6 bg-red-900/20 border-red-700">
            <AlertTriangle className="h-4 w-4 text-red-400" />
            <AlertDescription className="text-red-300">
              <strong>Low Bankroll Warning:</strong> Your bankroll is below $500. Consider reducing bet sizes or adding funds.
            </AlertDescription>
          </Alert>
        )}

        {performance && parseFloat(performance.maxDrawdown.replace('%', '')) > 20 && (
          <Alert className="mt-6 bg-yellow-900/20 border-yellow-700">
            <AlertTriangle className="h-4 w-4 text-yellow-400" />
            <AlertDescription className="text-yellow-300">
              <strong>High Drawdown Alert:</strong> Your maximum drawdown is {performance.maxDrawdown}. Consider more conservative betting.
            </AlertDescription>
          </Alert>
        )}
      </div>
    </div>
  );
}
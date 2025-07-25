'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { 
  DollarSign, 
  TrendingUp, 
  TrendingDown, 
  Calculator,
  Shield,
  AlertTriangle,
  PieChart,
  BarChart3,
  Activity,
  Target,
  Award,
  RefreshCw,
  Settings,
  History,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Line } from 'react-chartjs-2';
import { logger } from '../../../lib/logging/logger';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface KellyRecommendation {
  contestId: string;
  contestName: string;
  contestType: string;
  entryFee: number;
  recommendedBetSize: number;
  adjustedBetSize: number;
  kellyFraction: number;
  riskLevel: string;
  expectedReturn: number;
  confidence: number;
  reasoning: string;
}

interface PortfolioAllocation {
  contestId: string;
  contestName: string;
  contestType: string;
  entryFee: number;
  entries: number;
  allocation: number;
  percentage: number;
  expectedReturn: number;
}

export default function BankrollDashboard() {
  const [currentBankroll, setCurrentBankroll] = useState(1000);
  const [riskTolerance, setRiskTolerance] = useState<'conservative' | 'moderate' | 'aggressive'>('moderate');
  const [activeTab, setActiveTab] = useState<'kelly' | 'portfolio' | 'history'>('kelly');
  const [loading, setLoading] = useState(false);
  const [kellyData, setKellyData] = useState<any>(null);
  const [portfolioData, setPortfolioData] = useState<any>(null);
  const [statusData, setStatusData] = useState<any>(null);
  const [historyData, setHistoryData] = useState<any>(null);

  // Sample contests for demo
  const sampleContests = [
    { id: 'DK-NFL-GPP-1', name: 'NFL $100K Millionaire', type: 'gpp', entryFee: 25, projectedROI: 0.25, variance: 0.8 },
    { id: 'DK-NFL-CASH-1', name: 'NFL 50/50 Double Up', type: 'cash', entryFee: 10, projectedROI: 0.15, variance: 0.1 },
    { id: 'FD-NBA-GPP-1', name: 'NBA $50K Slam', type: 'gpp', entryFee: 15, projectedROI: 0.20, variance: 0.6 },
    { id: 'FD-NBA-H2H-1', name: 'NBA Head-to-Head', type: 'h2h', entryFee: 5, projectedROI: 0.12, variance: 0.15 },
    { id: 'DK-MLB-QUAL-1', name: 'MLB Qualifier', type: 'qualifier', entryFee: 50, projectedROI: 0.30, variance: 0.4 }
  ];

  // Fetch bankroll status on mount
  useEffect(() => {
    fetchBankrollStatus();
    fetchBankrollHistory();
  }, []);

  const fetchBankrollStatus = async () => {
    try {
      const response = await fetch('/api/bankroll/kelly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'status',
          currentBankroll
        })
      });

      const data = await response.json();
      if (data.success) {
        setStatusData(data);
      }
    } catch (error) {
      logger.error('Failed to fetch bankroll status:', { error: error });
    }
  };

  const fetchBankrollHistory = async () => {
    try {
      const response = await fetch('/api/bankroll/kelly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'history'
        })
      });

      const data = await response.json();
      if (data.success) {
        setHistoryData(data);
      }
    } catch (error) {
      logger.error('Failed to fetch bankroll history:', { error: error });
    }
  };

  const calculateKellyBets = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bankroll/kelly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'calculate',
          currentBankroll,
          contests: sampleContests,
          riskTolerance,
          confidenceLevel: 0.75
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setKellyData(data);
        toast.success('Kelly calculations complete!');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      logger.error('Kelly calculation error:', { error: error });
      toast.error('Failed to calculate Kelly bets');
    } finally {
      setLoading(false);
    }
  };

  const generatePortfolio = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/bankroll/kelly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'portfolio',
          currentBankroll,
          contests: sampleContests,
          riskTolerance
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setPortfolioData(data);
        toast.success('Portfolio allocation generated!');
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      logger.error('Portfolio generation error:', { error: error });
      toast.error('Failed to generate portfolio');
    } finally {
      setLoading(false);
    }
  };

  const updateBankrollResult = async (contestId: string, result: 'win' | 'loss', amount: number) => {
    try {
      const response = await fetch('/api/bankroll/kelly', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          contestId,
          result,
          amount,
          currentBankroll,
          description: `Contest ${result}: ${contestId}`
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setCurrentBankroll(data.newBankroll);
        toast.success(`Bankroll updated: ${data.message}`);
        fetchBankrollStatus();
        fetchBankrollHistory();
      }
    } catch (error) {
      logger.error('Bankroll update error:', { error: error });
      toast.error('Failed to update bankroll');
    }
  };

  const riskToleranceConfig = {
    conservative: {
      icon: <Shield className="w-5 h-5" />,
      color: 'text-green-500',
      bgColor: 'bg-green-500/10',
      description: 'Quarter-Kelly (25% of optimal)'
    },
    moderate: {
      icon: <Calculator className="w-5 h-5" />,
      color: 'text-blue-500',
      bgColor: 'bg-blue-500/10',
      description: 'Half-Kelly (50% of optimal)'
    },
    aggressive: {
      icon: <AlertTriangle className="w-5 h-5" />,
      color: 'text-red-500',
      bgColor: 'bg-red-500/10',
      description: 'Three-quarter Kelly (75% of optimal)'
    }
  };

  // Chart data
  const chartData = historyData?.chartData ? {
    labels: historyData.chartData.map((d: any) => new Date(d.date).toLocaleDateString()),
    datasets: [
      {
        label: 'Bankroll',
        data: historyData.chartData.map((d: any) => d.bankroll),
        borderColor: 'rgb(147, 51, 234)',
        backgroundColor: 'rgba(147, 51, 234, 0.1)',
        fill: true,
        tension: 0.4
      }
    ]
  } : null;

  const chartOptions = {
    responsive: true,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
      }
    },
    scales: {
      y: {
        beginAtZero: false,
        ticks: {
          callback: function(value: any) {
            return '$' + value.toLocaleString();
          }
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 text-transparent bg-clip-text">
            Kelly Bankroll Manager
          </h1>
          <p className="text-gray-600 mt-1">Mathematical position sizing and risk management</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-sm text-gray-600">Current Bankroll</p>
            <p className="text-2xl font-bold">${currentBankroll.toLocaleString()}</p>
          </div>
          <button
            onClick={fetchBankrollStatus}
            className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition-all"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Bankroll Input & Risk Tolerance */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Bankroll Configuration */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Bankroll Configuration</h3>
          <div className="space-y-4">
            <div>
              <label className="text-sm text-gray-600">Total Bankroll</label>
              <input
                type="number"
                value={currentBankroll}
                onChange={(e) => setCurrentBankroll(Number(e.target.value))}
                className="w-full mt-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            {statusData && (
              <>
                <div className="pt-2 border-t border-gray-100">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Available for Betting</span>
                    <span className="font-medium">${statusData.bankroll?.available?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between text-sm mt-2">
                    <span className="text-gray-600">Emergency Reserve</span>
                    <span className="font-medium">${statusData.bankroll?.reserved?.toLocaleString() || 0}</span>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Risk Tolerance */}
        <div className="bg-white rounded-xl p-6 border border-gray-200">
          <h3 className="text-lg font-semibold mb-4">Risk Tolerance</h3>
          <div className="space-y-3">
            {(['conservative', 'moderate', 'aggressive'] as const).map((risk) => (
              <button
                key={risk}
                onClick={() => setRiskTolerance(risk)}
                className={`w-full p-3 rounded-lg border-2 transition-all ${
                  riskTolerance === risk ? 'border-purple-500 bg-purple-50' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${riskToleranceConfig[risk].bgColor} ${riskToleranceConfig[risk].color}`}>
                    {riskToleranceConfig[risk].icon}
                  </div>
                  <div className="text-left">
                    <div className="font-medium capitalize">{risk}</div>
                    <div className="text-sm text-gray-600">{riskToleranceConfig[risk].description}</div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Performance Stats */}
      {statusData?.performance && (
        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Win Rate</p>
                <p className="text-2xl font-bold">{statusData.performance.winRate || '0%'}</p>
              </div>
              <Award className="w-8 h-8 text-green-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">ROI</p>
                <p className={`text-2xl font-bold ${
                  parseFloat(statusData.performance.roi) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {statusData.performance.roi || '0%'}
                </p>
              </div>
              <TrendingUp className="w-8 h-8 text-blue-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Wagered</p>
                <p className="text-2xl font-bold">
                  ${statusData.performance.totalWagered?.toLocaleString() || 0}
                </p>
              </div>
              <DollarSign className="w-8 h-8 text-purple-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Max Drawdown</p>
                <p className="text-2xl font-bold text-orange-600">
                  {statusData.performance.maxDrawdown || '0%'}
                </p>
              </div>
              <TrendingDown className="w-8 h-8 text-orange-400" />
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl p-4 border border-gray-200"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Risk Profile</p>
                <p className="text-lg font-bold text-gray-800">
                  {statusData.riskProfile?.split(' - ')[0] || 'Unknown'}
                </p>
              </div>
              <Activity className="w-8 h-8 text-gray-400" />
            </div>
          </motion.div>
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="border-b border-gray-200">
          <div className="flex">
            <button
              onClick={() => {
                setActiveTab('kelly');
                calculateKellyBets();
              }}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-all ${
                activeTab === 'kelly'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <Calculator className="w-5 h-5" />
              Kelly Calculator
            </button>
            <button
              onClick={() => {
                setActiveTab('portfolio');
                generatePortfolio();
              }}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-all ${
                activeTab === 'portfolio'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <PieChart className="w-5 h-5" />
              Portfolio Allocation
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex items-center gap-2 px-6 py-3 font-medium transition-all ${
                activeTab === 'history'
                  ? 'text-purple-600 border-b-2 border-purple-600'
                  : 'text-gray-600 hover:text-gray-800'
              }`}
            >
              <History className="w-5 h-5" />
              History
            </button>
          </div>
        </div>

        <div className="p-6">
          {/* Kelly Calculator */}
          {activeTab === 'kelly' && (
            <div className="space-y-4">
              {loading && (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-500" />
                  <p className="mt-2 text-gray-600">Calculating optimal bet sizes...</p>
                </div>
              )}
              
              {kellyData && !loading && (
                <>
                  <div className="mb-6 p-4 bg-purple-50 rounded-lg">
                    <h4 className="font-semibold text-purple-900">Kelly Summary</h4>
                    <div className="grid grid-cols-4 gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-purple-700">Total Recommended:</span>
                        <p className="font-semibold">${kellyData.summary.totalRecommended.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-purple-700">Avg Kelly %:</span>
                        <p className="font-semibold">{kellyData.summary.avgKellyFraction}</p>
                      </div>
                      <div>
                        <span className="text-purple-700">Utilization:</span>
                        <p className="font-semibold">{kellyData.summary.utilizationRate}</p>
                      </div>
                      <div>
                        <span className="text-purple-700">Top Bet:</span>
                        <p className="font-semibold">${kellyData.summary.topBet?.adjustedBetSize || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {kellyData.recommendations.map((rec: KellyRecommendation) => (
                      <motion.div
                        key={rec.contestId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 border border-gray-200 rounded-lg hover:border-purple-300 transition-all"
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h4 className="font-semibold">{rec.contestName}</h4>
                            <div className="flex gap-4 mt-2 text-sm text-gray-600">
                              <span>Entry: ${rec.entryFee}</span>
                              <span>Type: {rec.contestType.toUpperCase()}</span>
                              <span className={`font-medium ${
                                rec.riskLevel === 'low' ? 'text-green-600' :
                                rec.riskLevel === 'medium' ? 'text-yellow-600' :
                                rec.riskLevel === 'high' ? 'text-orange-600' :
                                'text-red-600'
                              }`}>
                                Risk: {rec.riskLevel.toUpperCase()}
                              </span>
                            </div>
                            <p className="text-sm text-gray-500 mt-2">{rec.reasoning}</p>
                          </div>
                          <div className="text-right">
                            <div className="text-2xl font-bold text-purple-600">
                              ${rec.adjustedBetSize}
                            </div>
                            <div className="text-sm text-gray-600">
                              Kelly: {(rec.kellyFraction * 100).toFixed(2)}%
                            </div>
                            <div className="text-sm text-green-600 mt-1">
                              EV: +${rec.expectedReturn}
                            </div>
                            <div className="flex gap-2 mt-2">
                              <button
                                onClick={() => updateBankrollResult(rec.contestId, 'win', rec.expectedReturn)}
                                className="px-3 py-1 bg-green-500 text-white text-sm rounded hover:bg-green-600"
                              >
                                Win
                              </button>
                              <button
                                onClick={() => updateBankrollResult(rec.contestId, 'loss', rec.adjustedBetSize)}
                                className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                              >
                                Loss
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Portfolio Allocation */}
          {activeTab === 'portfolio' && (
            <div className="space-y-4">
              {loading && (
                <div className="text-center py-8">
                  <RefreshCw className="w-8 h-8 animate-spin mx-auto text-purple-500" />
                  <p className="mt-2 text-gray-600">Generating optimal portfolio...</p>
                </div>
              )}
              
              {portfolioData && !loading && (
                <>
                  <div className="mb-6 p-4 bg-blue-50 rounded-lg">
                    <h4 className="font-semibold text-blue-900">Portfolio Metrics</h4>
                    <div className="grid grid-cols-5 gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-blue-700">Total Allocated:</span>
                        <p className="font-semibold">${portfolioData.totalAllocated.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-blue-700">Expected Return:</span>
                        <p className="font-semibold">${portfolioData.metrics.expectedReturn.toLocaleString()}</p>
                      </div>
                      <div>
                        <span className="text-blue-700">ROI:</span>
                        <p className="font-semibold">{portfolioData.metrics.roi}</p>
                      </div>
                      <div>
                        <span className="text-blue-700">Diversification:</span>
                        <p className="font-semibold">{portfolioData.metrics.diversificationScore}</p>
                      </div>
                      <div>
                        <span className="text-blue-700">Sharpe Ratio:</span>
                        <p className="font-semibold">{portfolioData.metrics.sharpeRatio}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {portfolioData.allocations.map((alloc: PortfolioAllocation) => (
                      <motion.div
                        key={alloc.contestId}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="p-4 border border-gray-200 rounded-lg"
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <h4 className="font-semibold">{alloc.contestName}</h4>
                            <div className="flex gap-4 mt-1 text-sm text-gray-600">
                              <span>Entry Fee: ${alloc.entryFee}</span>
                              <span>Type: {alloc.contestType.toUpperCase()}</span>
                              <span>Entries: {alloc.entries}</span>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-xl font-bold text-blue-600">
                              ${alloc.allocation.toLocaleString()}
                            </div>
                            <div className="text-sm text-gray-600">
                              {alloc.percentage.toFixed(1)}% of portfolio
                            </div>
                            <div className="text-sm text-green-600">
                              EV: +${alloc.expectedReturn.toFixed(0)}
                            </div>
                          </div>
                        </div>
                        <div className="mt-3 bg-gray-100 rounded-full h-2">
                          <div 
                            className="bg-blue-500 h-2 rounded-full"
                            style={{ width: `${alloc.percentage}%` }}
                          />
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {/* History */}
          {activeTab === 'history' && historyData && (
            <div className="space-y-6">
              {chartData && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h4 className="font-semibold mb-4">Bankroll History</h4>
                  <div className="h-64">
                    <Line data={chartData} options={chartOptions} />
                  </div>
                </div>
              )}
              
              <div className="space-y-2">
                <h4 className="font-semibold mb-3">Recent Transactions</h4>
                {historyData.history?.map((entry: any, idx: number) => (
                  <motion.div
                    key={idx}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex justify-between items-center p-3 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      {entry.source === 'contest_win' ? (
                        <TrendingUp className="w-5 h-5 text-green-500" />
                      ) : (
                        <TrendingDown className="w-5 h-5 text-red-500" />
                      )}
                      <div>
                        <p className="font-medium">{entry.description}</p>
                        <p className="text-sm text-gray-600">
                          {new Date(entry.timestamp).toLocaleString()}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${
                        entry.change_amount >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {entry.change_amount >= 0 ? '+' : ''}${Math.abs(entry.change_amount).toFixed(2)}
                      </p>
                      <p className="text-sm text-gray-600">
                        Balance: ${parseFloat(entry.bankroll).toFixed(2)}
                      </p>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Strategy Recommendation */}
      {statusData?.recommendations && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl p-6 text-white"
        >
          <div className="flex items-start gap-4">
            <Target className="w-8 h-8 flex-shrink-0" />
            <div>
              <h3 className="text-xl font-semibold mb-2">Strategy Recommendation</h3>
              <p className="text-white/90">{statusData.recommendations.suggestedStrategy}</p>
              <div className="flex gap-6 mt-4 text-sm">
                <div>
                  <span className="text-white/70">Max Single Bet:</span>
                  <p className="font-semibold">${statusData.recommendations.maxSingleBet.toLocaleString()}</p>
                </div>
                <div>
                  <span className="text-white/70">Max Total Exposure:</span>
                  <p className="font-semibold">${statusData.recommendations.maxTotalExposure.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
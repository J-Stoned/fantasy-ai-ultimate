'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiArrowRight, FiPlus, FiX, FiTrendingUp, FiAlertTriangle, FiCheck } from 'react-icons/fi';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { tradeAnalysisService } from '@/lib/services/traditional-fantasy/keeper-management/trade-analysis-service';
import type { TradePackage, TradeAnalysis } from '@/lib/services/traditional-fantasy/keeper-management/types';
import { logger } from '../../lib/logging/logger';

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

interface TradeCalculatorProps {
  leagueId: string;
  teamId: string;
}

interface TradeSide {
  players: Array<{ id: string; name: string; value: number }>;
  picks: Array<{ id: string; year: number; round: number; value: number }>;
}

export const TradeCalculator: React.FC<TradeCalculatorProps> = ({
  leagueId,
  teamId
}) => {
  const [yourSide, setYourSide] = useState<TradeSide>({ players: [], picks: [] });
  const [theirSide, setTheirSide] = useState<TradeSide>({ players: [], picks: [] });
  const [analysis, setAnalysis] = useState<TradeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [availablePlayers, setAvailablePlayers] = useState<any[]>([]);
  const [availablePicks, setAvailablePicks] = useState<any[]>([]);

  useEffect(() => {
    loadAvailableAssets();
  }, [leagueId, teamId]);

  const loadAvailableAssets = async () => {
    try {
      // Load available players and picks from service
      // This would be implemented in the actual service
      setAvailablePlayers([
        { id: '1', name: 'Justin Jefferson', position: 'WR', value: 100 },
        { id: '2', name: 'Christian McCaffrey', position: 'RB', value: 95 },
        { id: '3', name: 'Patrick Mahomes', position: 'QB', value: 85 },
      ]);
      setAvailablePicks([
        { id: 'p1', year: 2024, round: 1, value: 30 },
        { id: 'p2', year: 2024, round: 2, value: 15 },
        { id: 'p3', year: 2025, round: 1, value: 25 },
      ]);
    } catch (error) {
      logger.error('Failed to load assets:', { error: error });
    }
  };

  const analyzeTrade = async () => {
    if (yourSide.players.length === 0 && yourSide.picks.length === 0) return;
    if (theirSide.players.length === 0 && theirSide.picks.length === 0) return;

    setLoading(true);
    try {
      const tradePackage: TradePackage = {
        givingPlayers: yourSide.players.map(p => p.id),
        givingPicks: yourSide.picks.map(p => p.id),
        receivingPlayers: theirSide.players.map(p => p.id),
        receivingPicks: theirSide.picks.map(p => p.id)
      };

      const result = await tradeAnalysisService.analyzeTrade(leagueId, teamId, tradePackage);
      setAnalysis(result);
    } catch (error) {
      logger.error('Failed to analyze trade:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  const addToSide = (side: 'your' | 'their', type: 'player' | 'pick', item: any) => {
    if (side === 'your') {
      if (type === 'player') {
        setYourSide(prev => ({ ...prev, players: [...prev.players, item] }));
      } else {
        setYourSide(prev => ({ ...prev, picks: [...prev.picks, item] }));
      }
    } else {
      if (type === 'player') {
        setTheirSide(prev => ({ ...prev, players: [...prev.players, item] }));
      } else {
        setTheirSide(prev => ({ ...prev, picks: [...prev.picks, item] }));
      }
    }
  };

  const removeFromSide = (side: 'your' | 'their', type: 'player' | 'pick', itemId: string) => {
    if (side === 'your') {
      if (type === 'player') {
        setYourSide(prev => ({ ...prev, players: prev.players.filter(p => p.id !== itemId) }));
      } else {
        setYourSide(prev => ({ ...prev, picks: prev.picks.filter(p => p.id !== itemId) }));
      }
    } else {
      if (type === 'player') {
        setTheirSide(prev => ({ ...prev, players: prev.players.filter(p => p.id !== itemId) }));
      } else {
        setTheirSide(prev => ({ ...prev, picks: prev.picks.filter(p => p.id !== itemId) }));
      }
    }
  };

  const getTotalValue = (side: TradeSide) => {
    const playerValue = side.players.reduce((sum, p) => sum + p.value, 0);
    const pickValue = side.picks.reduce((sum, p) => sum + p.value, 0);
    return playerValue + pickValue;
  };

  const getTradeBalance = () => {
    const yourValue = getTotalValue(yourSide);
    const theirValue = getTotalValue(theirSide);
    const difference = theirValue - yourValue;
    const percentage = yourValue > 0 ? (difference / yourValue) * 100 : 0;
    return { difference, percentage };
  };

  const balance = getTradeBalance();

  const chartData = analysis ? {
    labels: ['Current', 'Post-Trade', '1 Year', '3 Years'],
    datasets: [
      {
        label: 'Team Value',
        data: [
          analysis.currentValue,
          analysis.immediateValue,
          analysis.projectedValue1Year,
          analysis.projectedValue3Years
        ],
        backgroundColor: 'rgba(168, 85, 247, 0.5)',
        borderColor: 'rgb(168, 85, 247)',
        borderWidth: 2
      }
    ]
  } : null;

  const chartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.1)',
        borderWidth: 1,
        cornerRadius: 8,
        padding: 12
      }
    },
    scales: {
      x: {
        grid: {
          display: false
        },
        ticks: {
          color: '#9CA3AF'
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#9CA3AF'
        }
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Trade Builder */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <h2 className="text-2xl font-bold text-white mb-6">Dynasty Trade Calculator</h2>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Your Side */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4">You Give</h3>
            <div className="space-y-3">
              {/* Players */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Players</p>
                <div className="space-y-2">
                  {yourSide.players.map(player => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-white">{player.name}</span>
                      <button
                        onClick={() => removeFromSide('your', 'player', player.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <FiX />
                      </button>
                    </motion.div>
                  ))}
                  <button
                    className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center space-x-2"
                    onClick={() => {/* Open player selector */}}
                  >
                    <FiPlus />
                    <span>Add Player</span>
                  </button>
                </div>
              </div>

              {/* Picks */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Draft Picks</p>
                <div className="space-y-2">
                  {yourSide.picks.map(pick => (
                    <motion.div
                      key={pick.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-white">{pick.year} Round {pick.round}</span>
                      <button
                        onClick={() => removeFromSide('your', 'pick', pick.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <FiX />
                      </button>
                    </motion.div>
                  ))}
                  <button
                    className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center space-x-2"
                    onClick={() => {/* Open pick selector */}}
                  >
                    <FiPlus />
                    <span>Add Pick</span>
                  </button>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-400">Total Value</p>
                <p className="text-2xl font-bold text-white">{getTotalValue(yourSide)}</p>
              </div>
            </div>
          </div>

          {/* Their Side */}
          <div>
            <h3 className="text-lg font-medium text-white mb-4">You Receive</h3>
            <div className="space-y-3">
              {/* Players */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Players</p>
                <div className="space-y-2">
                  {theirSide.players.map(player => (
                    <motion.div
                      key={player.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-white">{player.name}</span>
                      <button
                        onClick={() => removeFromSide('their', 'player', player.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <FiX />
                      </button>
                    </motion.div>
                  ))}
                  <button
                    className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center space-x-2"
                    onClick={() => {/* Open player selector */}}
                  >
                    <FiPlus />
                    <span>Add Player</span>
                  </button>
                </div>
              </div>

              {/* Picks */}
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-sm text-gray-400 mb-2">Draft Picks</p>
                <div className="space-y-2">
                  {theirSide.picks.map(pick => (
                    <motion.div
                      key={pick.id}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      className="flex items-center justify-between bg-gray-700/50 rounded-lg px-3 py-2"
                    >
                      <span className="text-white">{pick.year} Round {pick.round}</span>
                      <button
                        onClick={() => removeFromSide('their', 'pick', pick.id)}
                        className="text-red-400 hover:text-red-300 transition-colors"
                      >
                        <FiX />
                      </button>
                    </motion.div>
                  ))}
                  <button
                    className="w-full py-2 border border-dashed border-gray-600 rounded-lg text-gray-400 hover:text-white hover:border-gray-500 transition-colors flex items-center justify-center space-x-2"
                    onClick={() => {/* Open pick selector */}}
                  >
                    <FiPlus />
                    <span>Add Pick</span>
                  </button>
                </div>
              </div>

              <div className="text-center">
                <p className="text-sm text-gray-400">Total Value</p>
                <p className="text-2xl font-bold text-white">{getTotalValue(theirSide)}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Trade Balance */}
        <div className="mt-6 p-4 rounded-lg bg-gradient-to-r from-purple-900/20 to-pink-900/20 border border-purple-700/30">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-300">Trade Balance</p>
            <div className="flex items-center space-x-2">
              {balance.difference > 0 ? (
                <FiTrendingUp className="text-green-400" />
              ) : balance.difference < 0 ? (
                <FiTrendingUp className="text-red-400 rotate-180" />
              ) : (
                <FiCheck className="text-gray-400" />
              )}
              <span className={`text-xl font-bold ${
                balance.difference > 0 ? 'text-green-400' : 
                balance.difference < 0 ? 'text-red-400' : 
                'text-gray-400'
              }`}>
                {balance.difference > 0 ? '+' : ''}{balance.difference} ({balance.percentage.toFixed(1)}%)
              </span>
            </div>
          </div>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={analyzeTrade}
          disabled={loading || (yourSide.players.length === 0 && yourSide.picks.length === 0)}
          className="w-full mt-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-medium rounded-xl disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? 'Analyzing...' : 'Analyze Trade'}
        </motion.button>
      </motion.div>

      {/* Analysis Results */}
      {analysis && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="space-y-6"
        >
          {/* Summary */}
          <div className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Trade Analysis</h3>
            
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">Trade Grade</p>
                <p className={`text-2xl font-bold ${
                  analysis.tradeGrade >= 80 ? 'text-green-400' :
                  analysis.tradeGrade >= 60 ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {analysis.tradeGrade}%
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">Win Now Impact</p>
                <p className={`text-2xl font-bold ${
                  analysis.winNowImpact > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {analysis.winNowImpact > 0 ? '+' : ''}{analysis.winNowImpact.toFixed(1)}%
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">Dynasty Impact</p>
                <p className={`text-2xl font-bold ${
                  analysis.dynastyImpact > 0 ? 'text-green-400' : 'text-red-400'
                }`}>
                  {analysis.dynastyImpact > 0 ? '+' : ''}{analysis.dynastyImpact.toFixed(1)}%
                </p>
              </div>
              <div className="bg-gray-800/50 rounded-lg p-4">
                <p className="text-xs text-gray-400 mb-1">Risk Level</p>
                <p className={`text-2xl font-bold ${
                  analysis.riskLevel === 'low' ? 'text-green-400' :
                  analysis.riskLevel === 'medium' ? 'text-yellow-400' :
                  'text-red-400'
                }`}>
                  {analysis.riskLevel.toUpperCase()}
                </p>
              </div>
            </div>

            {/* Value Projection Chart */}
            {chartData && (
              <div className="h-64">
                <Bar data={chartData} options={chartOptions} />
              </div>
            )}
          </div>

          {/* Detailed Analysis */}
          <div className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6">
            <h3 className="text-lg font-bold text-white mb-4">Key Insights</h3>
            <div className="space-y-4">
              {analysis.keyInsights.map((insight, index) => (
                <div key={index} className="flex items-start space-x-3">
                  <div className={`mt-1 w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${
                    insight.type === 'positive' ? 'bg-green-500/20' :
                    insight.type === 'negative' ? 'bg-red-500/20' :
                    'bg-yellow-500/20'
                  }`}>
                    {insight.type === 'positive' ? (
                      <FiCheck className="text-green-400 text-sm" />
                    ) : insight.type === 'negative' ? (
                      <FiX className="text-red-400 text-sm" />
                    ) : (
                      <FiAlertTriangle className="text-yellow-400 text-sm" />
                    )}
                  </div>
                  <p className="text-gray-300">{insight.message}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
};
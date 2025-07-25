'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiTarget, FiTrendingUp, FiAlertCircle, FiChevronRight, FiClock, FiDollarSign } from 'react-icons/fi';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { dynastyStrategyService } from '@/lib/services/traditional-fantasy/keeper-management/dynasty-strategy-service';
import type { TeamStrategy, StrategyRecommendation } from '@/lib/services/traditional-fantasy/keeper-management/types';
import { logger } from '../../lib/logging/logger';

ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

interface TeamStrategyAdvisorProps {
  leagueId: string;
  teamId: string;
}

export const TeamStrategyAdvisor: React.FC<TeamStrategyAdvisorProps> = ({
  leagueId,
  teamId
}) => {
  const [strategy, setStrategy] = useState<TeamStrategy | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [expandedRec, setExpandedRec] = useState<string | null>(null);

  useEffect(() => {
    loadStrategy();
  }, [leagueId, teamId]);

  const loadStrategy = async () => {
    setLoading(true);
    try {
      const data = await dynastyStrategyService.getTeamStrategy(leagueId, teamId);
      setStrategy(data);
    } catch (error) {
      logger.error('Failed to load strategy:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !strategy) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700/50 rounded w-1/3"></div>
          <div className="h-64 bg-gray-700/50 rounded"></div>
        </div>
      </div>
    );
  }

  const radarData = {
    labels: ['Offense', 'Defense', 'Youth', 'Experience', 'Depth', 'Star Power'],
    datasets: [
      {
        label: 'Your Team',
        data: [
          strategy.teamMetrics.offense,
          strategy.teamMetrics.defense,
          strategy.teamMetrics.youth,
          strategy.teamMetrics.experience,
          strategy.teamMetrics.depth,
          strategy.teamMetrics.starPower
        ],
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        borderColor: 'rgb(168, 85, 247)',
        pointBackgroundColor: 'rgb(168, 85, 247)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(168, 85, 247)'
      },
      {
        label: 'League Average',
        data: [75, 75, 75, 75, 75, 75],
        backgroundColor: 'rgba(107, 114, 128, 0.2)',
        borderColor: 'rgb(107, 114, 128)',
        pointBackgroundColor: 'rgb(107, 114, 128)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(107, 114, 128)'
      }
    ]
  };

  const radarOptions: ChartOptions<'radar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          color: '#fff',
          padding: 20,
          font: {
            size: 12
          }
        }
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
      r: {
        angleLines: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        pointLabels: {
          color: '#9CA3AF',
          font: {
            size: 12
          }
        },
        ticks: {
          color: '#9CA3AF',
          backdropColor: 'transparent',
          display: false
        },
        min: 0,
        max: 100
      }
    }
  };

  const getStrategyColor = (type: string) => {
    switch (type) {
      case 'win-now': return 'from-green-500 to-emerald-500';
      case 'rebuild': return 'from-red-500 to-pink-500';
      case 'balanced': return 'from-blue-500 to-purple-500';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getStrategyIcon = (type: string) => {
    switch (type) {
      case 'win-now': return <FiTarget />;
      case 'rebuild': return <FiClock />;
      case 'balanced': return <FiTrendingUp />;
      default: return <FiAlertCircle />;
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'critical': return 'text-red-400 bg-red-500/20';
      case 'high': return 'text-orange-400 bg-orange-500/20';
      case 'medium': return 'text-yellow-400 bg-yellow-500/20';
      case 'low': return 'text-green-400 bg-green-500/20';
      default: return 'text-gray-400 bg-gray-500/20';
    }
  };

  const categories = ['all', 'trades', 'draft', 'roster', 'waivers'];
  
  const filteredRecommendations = strategy.recommendations.filter(rec => 
    selectedCategory === 'all' || rec.category === selectedCategory
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Team Strategy Advisor</h2>
            <p className="text-gray-400">AI-powered recommendations for dynasty success</p>
          </div>
          <div className={`px-4 py-2 rounded-lg bg-gradient-to-r ${getStrategyColor(strategy.currentStrategy)} flex items-center space-x-2`}>
            {getStrategyIcon(strategy.currentStrategy)}
            <span className="font-medium text-white capitalize">{strategy.currentStrategy.replace('-', ' ')}</span>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-4 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Power Ranking</p>
            <p className="text-2xl font-bold text-white">#{strategy.powerRanking}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Title Odds</p>
            <p className="text-2xl font-bold text-purple-400">{strategy.titleOdds}%</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Cap Space</p>
            <p className="text-2xl font-bold text-green-400">${strategy.capSpace}</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <p className="text-xs text-gray-400 mb-1">Future Picks</p>
            <p className="text-2xl font-bold text-blue-400">{strategy.futurePicks}</p>
          </div>
        </div>
      </motion.div>

      {/* Team Profile Radar */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <h3 className="text-lg font-bold text-white mb-4">Team Profile Analysis</h3>
        <div className="h-64">
          <Radar data={radarData} options={radarOptions} />
        </div>
      </motion.div>

      {/* Strategy Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Strategic Recommendations</h3>
          <div className="flex items-center space-x-2 bg-gray-800/50 rounded-lg p-1">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
                  selectedCategory === cat ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <AnimatePresence>
            {filteredRecommendations.map((rec, index) => (
              <motion.div
                key={rec.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-800/50 rounded-lg border border-gray-700/50 overflow-hidden"
              >
                <div
                  className="p-4 cursor-pointer"
                  onClick={() => setExpandedRec(expandedRec === rec.id ? null : rec.id)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <span className={`px-2 py-1 rounded-lg text-xs font-medium ${getPriorityColor(rec.priority)}`}>
                          {rec.priority}
                        </span>
                        <span className="text-xs text-gray-500">
                          {rec.category}
                        </span>
                        {rec.timeframe && (
                          <span className="text-xs text-gray-500 flex items-center">
                            <FiClock className="mr-1" />
                            {rec.timeframe}
                          </span>
                        )}
                      </div>
                      <h4 className="font-medium text-white mb-1">{rec.action}</h4>
                      <p className="text-sm text-gray-400">{rec.reason}</p>
                    </div>
                    <motion.div
                      animate={{ rotate: expandedRec === rec.id ? 90 : 0 }}
                      transition={{ duration: 0.2 }}
                    >
                      <FiChevronRight className="text-gray-400" />
                    </motion.div>
                  </div>
                </div>

                <AnimatePresence>
                  {expandedRec === rec.id && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="border-t border-gray-700"
                    >
                      <div className="p-4 space-y-4">
                        {/* Implementation Steps */}
                        {rec.steps && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-300 mb-2">Implementation Steps</h5>
                            <ol className="space-y-2">
                              {rec.steps.map((step, stepIndex) => (
                                <li key={stepIndex} className="flex items-start text-sm text-gray-400">
                                  <span className="mr-2">{stepIndex + 1}.</span>
                                  <span>{step}</span>
                                </li>
                              ))}
                            </ol>
                          </div>
                        )}

                        {/* Expected Impact */}
                        {rec.impact && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-300 mb-2">Expected Impact</h5>
                            <div className="grid grid-cols-3 gap-3">
                              <div className="bg-gray-900/50 rounded-lg p-3">
                                <p className="text-xs text-gray-500">Win Now</p>
                                <p className={`text-lg font-bold ${
                                  rec.impact.winNow > 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {rec.impact.winNow > 0 ? '+' : ''}{rec.impact.winNow}%
                                </p>
                              </div>
                              <div className="bg-gray-900/50 rounded-lg p-3">
                                <p className="text-xs text-gray-500">Dynasty</p>
                                <p className={`text-lg font-bold ${
                                  rec.impact.dynasty > 0 ? 'text-green-400' : 'text-red-400'
                                }`}>
                                  {rec.impact.dynasty > 0 ? '+' : ''}{rec.impact.dynasty}%
                                </p>
                              </div>
                              <div className="bg-gray-900/50 rounded-lg p-3">
                                <p className="text-xs text-gray-500">Risk</p>
                                <p className={`text-lg font-bold ${
                                  rec.impact.risk === 'low' ? 'text-green-400' :
                                  rec.impact.risk === 'medium' ? 'text-yellow-400' :
                                  'text-red-400'
                                }`}>
                                  {rec.impact.risk.toUpperCase()}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Target Players */}
                        {rec.targetPlayers && (
                          <div>
                            <h5 className="text-sm font-medium text-gray-300 mb-2">Target Players</h5>
                            <div className="flex flex-wrap gap-2">
                              {rec.targetPlayers.map((player, playerIndex) => (
                                <span
                                  key={playerIndex}
                                  className="px-3 py-1 bg-purple-500/20 text-purple-400 rounded-lg text-sm"
                                >
                                  {player}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
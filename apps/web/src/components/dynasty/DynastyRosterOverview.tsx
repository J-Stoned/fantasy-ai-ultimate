'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiTrendingUp, FiAlertTriangle, FiStar, FiCalendar, FiDollarSign } from 'react-icons/fi';
import { Radar, Doughnut } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  ArcElement,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { dynastyStrategyService } from '@/lib/services/traditional-fantasy/keeper-management/dynasty-strategy-service';
import type { DynastyRoster, RosterAnalysis } from '@/lib/services/traditional-fantasy/keeper-management/types';
import { logger } from '../../lib/logging/logger';

ChartJS.register(RadialLinearScale, ArcElement, PointElement, LineElement, Filler, Tooltip, Legend);

interface DynastyRosterOverviewProps {
  leagueId: string;
  teamId: string;
}

export const DynastyRosterOverview: React.FC<DynastyRosterOverviewProps> = ({
  leagueId,
  teamId
}) => {
  const [roster, setRoster] = useState<DynastyRoster | null>(null);
  const [analysis, setAnalysis] = useState<RosterAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedPosition, setSelectedPosition] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  useEffect(() => {
    loadRosterData();
  }, [leagueId, teamId]);

  const loadRosterData = async () => {
    setLoading(true);
    try {
      const [rosterData, analysisData] = await Promise.all([
        dynastyStrategyService.getDynastyRoster(leagueId, teamId),
        dynastyStrategyService.analyzeRoster(leagueId, teamId)
      ]);
      setRoster(rosterData);
      setAnalysis(analysisData);
    } catch (error) {
      logger.error('Failed to load roster data:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !roster || !analysis) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700/50 rounded w-1/3"></div>
          <div className="grid grid-cols-2 gap-4">
            <div className="h-64 bg-gray-700/50 rounded"></div>
            <div className="h-64 bg-gray-700/50 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  const filteredPlayers = roster.players.filter(player => 
    selectedPosition === 'all' || player.position === selectedPosition
  );

  const rosterCompositionData = {
    labels: ['QB', 'RB', 'WR', 'TE'],
    datasets: [
      {
        data: [
          roster.players.filter(p => p.position === 'QB').length,
          roster.players.filter(p => p.position === 'RB').length,
          roster.players.filter(p => p.position === 'WR').length,
          roster.players.filter(p => p.position === 'TE').length
        ],
        backgroundColor: [
          'rgba(239, 68, 68, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(34, 197, 94, 0.8)',
          'rgba(168, 85, 247, 0.8)'
        ],
        borderColor: [
          'rgb(239, 68, 68)',
          'rgb(59, 130, 246)',
          'rgb(34, 197, 94)',
          'rgb(168, 85, 247)'
        ],
        borderWidth: 2
      }
    ]
  };

  const rosterStrengthData = {
    labels: ['Starters', 'Depth', 'Youth', 'Upside', 'Consistency', 'Health'],
    datasets: [
      {
        label: 'Your Roster',
        data: [
          analysis.starterStrength,
          analysis.depthScore,
          analysis.youthScore,
          analysis.upsideScore,
          analysis.consistencyScore,
          analysis.healthScore
        ],
        backgroundColor: 'rgba(168, 85, 247, 0.2)',
        borderColor: 'rgb(168, 85, 247)',
        pointBackgroundColor: 'rgb(168, 85, 247)',
        pointBorderColor: '#fff',
        pointHoverBackgroundColor: '#fff',
        pointHoverBorderColor: 'rgb(168, 85, 247)'
      }
    ]
  };

  const doughnutOptions: ChartOptions<'doughnut'> = {
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
    }
  };

  const radarOptions: ChartOptions<'radar'> = {
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
          display: false
        },
        min: 0,
        max: 100
      }
    }
  };

  const getAgeColor = (age: number) => {
    if (age < 24) return 'text-green-400';
    if (age < 28) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getValueTrendIcon = (trend: number) => {
    if (trend > 5) return <FiTrendingUp className="text-green-400" />;
    if (trend < -5) return <FiTrendingUp className="text-red-400 rotate-180" />;
    return null;
  };

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
            <h2 className="text-2xl font-bold text-white mb-2">Dynasty Roster Overview</h2>
            <p className="text-gray-400">Complete analysis of your dynasty roster</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Overall Grade</p>
            <p className={`text-3xl font-bold ${
              analysis.overallGrade >= 85 ? 'text-green-400' :
              analysis.overallGrade >= 70 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {analysis.overallGrade}%
            </p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-6 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <FiUsers className="text-purple-400" />
              <span className="text-xl font-bold text-white">{roster.players.length}</span>
            </div>
            <p className="text-xs text-gray-400">Total Players</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <FiStar className="text-yellow-400" />
              <span className="text-xl font-bold text-white">{roster.elitePlayers}</span>
            </div>
            <p className="text-xs text-gray-400">Elite Players</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <FiCalendar className="text-blue-400" />
              <span className="text-xl font-bold text-white">{roster.averageAge.toFixed(1)}</span>
            </div>
            <p className="text-xs text-gray-400">Avg Age</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <FiDollarSign className="text-green-400" />
              <span className="text-xl font-bold text-white">${roster.totalValue}</span>
            </div>
            <p className="text-xs text-gray-400">Total Value</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <FiTrendingUp className="text-purple-400" />
              <span className="text-xl font-bold text-white">{roster.projectedPoints}</span>
            </div>
            <p className="text-xs text-gray-400">Proj Points</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-3">
            <div className="flex items-center justify-between mb-1">
              <FiAlertTriangle className="text-red-400" />
              <span className="text-xl font-bold text-white">{analysis.concerns.length}</span>
            </div>
            <p className="text-xs text-gray-400">Concerns</p>
          </div>
        </div>
      </motion.div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Roster Composition</h3>
          <div className="h-64">
            <Doughnut data={rosterCompositionData} options={doughnutOptions} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Roster Strength Analysis</h3>
          <div className="h-64">
            <Radar data={rosterStrengthData} options={radarOptions} />
          </div>
        </motion.div>
      </div>

      {/* Roster List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-lg font-bold text-white">Roster Details</h3>
          <div className="flex items-center space-x-4">
            <select
              value={selectedPosition}
              onChange={(e) => setSelectedPosition(e.target.value)}
              className="bg-gray-800/50 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-purple-500 focus:outline-none"
            >
              <option value="all">All Positions</option>
              <option value="QB">QB</option>
              <option value="RB">RB</option>
              <option value="WR">WR</option>
              <option value="TE">TE</option>
            </select>
            <div className="flex items-center space-x-2 bg-gray-800/50 rounded-lg p-1">
              <button
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'grid' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Grid
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  viewMode === 'list' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                List
              </button>
            </div>
          </div>
        </div>

        {viewMode === 'grid' ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <AnimatePresence>
              {filteredPlayers.map((player, index) => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ delay: index * 0.05 }}
                  className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-purple-700/50 transition-all"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h4 className="font-medium text-white">{player.name}</h4>
                      <div className="flex items-center space-x-2 text-sm text-gray-400">
                        <span>{player.position}</span>
                        <span>•</span>
                        <span className={getAgeColor(player.age)}>Age {player.age}</span>
                      </div>
                    </div>
                    {player.keeperStatus && (
                      <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-lg">
                        Keeper
                      </span>
                    )}
                  </div>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-gray-500">Value</p>
                      <p className="font-medium text-white">${player.value}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Proj Pts</p>
                      <p className="font-medium text-white">{player.projectedPoints}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Rank</p>
                      <p className="font-medium text-white">#{player.positionRank}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">Trend</p>
                      <div className="flex items-center space-x-1">
                        {getValueTrendIcon(player.valueTrend)}
                        <span className={player.valueTrend > 0 ? 'text-green-400' : 'text-red-400'}>
                          {player.valueTrend > 0 ? '+' : ''}{player.valueTrend}%
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-700">
                  <th className="text-left py-3 px-4 text-sm font-medium text-gray-400">Player</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Pos</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Age</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Value</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Proj Pts</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Rank</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Trend</th>
                  <th className="text-center py-3 px-4 text-sm font-medium text-gray-400">Status</th>
                </tr>
              </thead>
              <tbody>
                <AnimatePresence>
                  {filteredPlayers.map((player, index) => (
                    <motion.tr
                      key={player.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ delay: index * 0.02 }}
                      className="border-b border-gray-800 hover:bg-gray-800/30 transition-colors"
                    >
                      <td className="py-3 px-4 text-white">{player.name}</td>
                      <td className="py-3 px-4 text-center text-gray-400">{player.position}</td>
                      <td className={`py-3 px-4 text-center ${getAgeColor(player.age)}`}>
                        {player.age}
                      </td>
                      <td className="py-3 px-4 text-center text-white">${player.value}</td>
                      <td className="py-3 px-4 text-center text-white">{player.projectedPoints}</td>
                      <td className="py-3 px-4 text-center text-white">#{player.positionRank}</td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center space-x-1">
                          {getValueTrendIcon(player.valueTrend)}
                          <span className={player.valueTrend > 0 ? 'text-green-400' : 'text-red-400'}>
                            {player.valueTrend > 0 ? '+' : ''}{player.valueTrend}%
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-center">
                        {player.keeperStatus && (
                          <span className="px-2 py-1 bg-purple-500/20 text-purple-400 text-xs rounded-lg">
                            Keeper
                          </span>
                        )}
                      </td>
                    </motion.tr>
                  ))}
                </AnimatePresence>
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Roster Concerns */}
      {analysis.concerns.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4 flex items-center">
            <FiAlertTriangle className="mr-2 text-yellow-400" />
            Roster Concerns
          </h3>
          <div className="space-y-3">
            {analysis.concerns.map((concern, index) => (
              <div
                key={index}
                className={`p-4 rounded-lg border ${
                  concern.severity === 'high'
                    ? 'bg-red-900/20 border-red-700/50'
                    : concern.severity === 'medium'
                    ? 'bg-yellow-900/20 border-yellow-700/50'
                    : 'bg-gray-800/50 border-gray-700/50'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium text-white mb-1">{concern.issue}</p>
                    <p className="text-sm text-gray-400">{concern.description}</p>
                  </div>
                  <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                    concern.severity === 'high'
                      ? 'bg-red-500/20 text-red-400'
                      : concern.severity === 'medium'
                      ? 'bg-yellow-500/20 text-yellow-400'
                      : 'bg-gray-700/50 text-gray-400'
                  }`}>
                    {concern.severity}
                  </span>
                </div>
                {concern.recommendation && (
                  <p className="text-xs text-purple-400 mt-2">
                    Recommendation: {concern.recommendation}
                  </p>
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};
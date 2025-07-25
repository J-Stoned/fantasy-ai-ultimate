'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { Line, Bar } from 'react-chartjs-2';
import { FiTrendingUp, FiClock, FiTarget, FiAlertCircle } from 'react-icons/fi';
import { dynastyStrategyService } from '@/lib/services/traditional-fantasy/keeper-management/dynasty-strategy-service';
import type { ChampionshipWindow } from '@/lib/services/traditional-fantasy/keeper-management/types';
import { logger } from '../../lib/logging/logger';

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface ChampionshipWindowVisualizerProps {
  leagueId: string;
  teamId: string;
}

export const ChampionshipWindowVisualizer: React.FC<ChampionshipWindowVisualizerProps> = ({
  leagueId,
  teamId
}) => {
  const [window, setWindow] = useState<ChampionshipWindow | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);

  useEffect(() => {
    loadChampionshipWindow();
  }, [leagueId, teamId]);

  const loadChampionshipWindow = async () => {
    setLoading(true);
    try {
      const data = await dynastyStrategyService.calculateChampionshipWindow(leagueId, teamId);
      setWindow(data);
      setSelectedYear(new Date().getFullYear());
    } catch (error) {
      logger.error('Failed to load championship window:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !window) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700/50 rounded w-1/3"></div>
          <div className="h-64 bg-gray-700/50 rounded"></div>
        </div>
      </div>
    );
  }

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear + i);

  const probabilityData = {
    labels: years.map(y => y.toString()),
    datasets: [
      {
        label: 'Championship Probability',
        data: window.yearlyProbabilities.map(yp => yp.probability * 100),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: 'rgb(168, 85, 247)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      },
      {
        label: 'Playoff Probability',
        data: window.yearlyProbabilities.map(yp => yp.playoffProbability * 100),
        borderColor: 'rgb(59, 130, 246)',
        backgroundColor: 'rgba(59, 130, 246, 0.1)',
        fill: true,
        tension: 0.4,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: 'rgb(59, 130, 246)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      }
    ]
  };

  const strengthData = {
    labels: ['QB', 'RB', 'WR', 'TE', 'Overall'],
    datasets: [
      {
        label: 'Current Strength',
        data: [
          window.positionStrengths.QB.current,
          window.positionStrengths.RB.current,
          window.positionStrengths.WR.current,
          window.positionStrengths.TE.current,
          window.overallStrength
        ],
        backgroundColor: 'rgba(168, 85, 247, 0.5)',
        borderColor: 'rgb(168, 85, 247)',
        borderWidth: 2
      },
      {
        label: 'Projected Strength',
        data: [
          window.positionStrengths.QB.projected,
          window.positionStrengths.RB.projected,
          window.positionStrengths.WR.projected,
          window.positionStrengths.TE.projected,
          window.projectedStrength
        ],
        backgroundColor: 'rgba(59, 130, 246, 0.5)',
        borderColor: 'rgb(59, 130, 246)',
        borderWidth: 2
      }
    ]
  };

  const chartOptions: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#fff',
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
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
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
          color: '#9CA3AF',
          callback: function(value) {
            return value + '%';
          }
        },
        min: 0,
        max: 100
      }
    }
  };

  const barChartOptions: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: true,
        position: 'top',
        labels: {
          color: '#fff',
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
        },
        min: 0,
        max: 100
      }
    }
  };

  const getWindowStatusColor = () => {
    if (window.windowStatus === 'open') return 'text-green-400';
    if (window.windowStatus === 'closing') return 'text-yellow-400';
    return 'text-red-400';
  };

  const getWindowStatusIcon = () => {
    if (window.windowStatus === 'open') return <FiTrendingUp />;
    if (window.windowStatus === 'closing') return <FiClock />;
    return <FiAlertCircle />;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-bold text-white mb-2">Championship Window</h2>
            <div className="flex items-center space-x-2">
              <span className={`flex items-center space-x-1 ${getWindowStatusColor()}`}>
                {getWindowStatusIcon()}
                <span className="font-medium capitalize">{window.windowStatus}</span>
              </span>
              <span className="text-gray-400">•</span>
              <span className="text-gray-400">
                Peak Year: {window.peakYear}
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Overall Strength</p>
            <p className="text-3xl font-bold text-white">{window.overallStrength}%</p>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <FiTarget className="text-purple-400" />
              <span className="text-2xl font-bold text-white">
                {(window.yearlyProbabilities[0]?.probability * 100).toFixed(1)}%
              </span>
            </div>
            <p className="text-xs text-gray-400">Championship Odds</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <FiClock className="text-blue-400" />
              <span className="text-2xl font-bold text-white">
                {window.windowYearsRemaining}
              </span>
            </div>
            <p className="text-xs text-gray-400">Years Remaining</p>
          </div>
          <div className="bg-gray-800/50 rounded-lg p-4">
            <div className="flex items-center justify-between mb-2">
              <FiTrendingUp className="text-green-400" />
              <span className="text-2xl font-bold text-white">
                {window.projectedStrength}%
              </span>
            </div>
            <p className="text-xs text-gray-400">Projected Strength</p>
          </div>
        </div>
      </motion.div>

      {/* Probability Chart */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <h3 className="text-lg font-bold text-white mb-4">Championship Probability Timeline</h3>
        <div className="h-64">
          <Line data={probabilityData} options={chartOptions} />
        </div>
      </motion.div>

      {/* Position Strength Comparison */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <h3 className="text-lg font-bold text-white mb-4">Position Strength Analysis</h3>
        <div className="h-64">
          <Bar data={strengthData} options={barChartOptions} />
        </div>
      </motion.div>

      {/* Strategic Recommendations */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <h3 className="text-lg font-bold text-white mb-4">Strategic Recommendations</h3>
        <div className="space-y-3">
          {window.recommendations.map((rec, index) => (
            <motion.div
              key={index}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.4 + index * 0.1 }}
              className={`p-4 rounded-lg border ${
                rec.priority === 'high'
                  ? 'bg-purple-900/20 border-purple-700/50'
                  : rec.priority === 'medium'
                  ? 'bg-blue-900/20 border-blue-700/50'
                  : 'bg-gray-800/50 border-gray-700/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="font-medium text-white mb-1">{rec.action}</p>
                  <p className="text-sm text-gray-400">{rec.reason}</p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-lg ${
                  rec.priority === 'high'
                    ? 'bg-purple-500/20 text-purple-400'
                    : rec.priority === 'medium'
                    ? 'bg-blue-500/20 text-blue-400'
                    : 'bg-gray-700/50 text-gray-400'
                }`}>
                  {rec.priority}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </motion.div>
    </div>
  );
};
'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  TrophyIcon,
  FireIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ClockIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { Line, Bar } from 'react-chartjs-2';
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
  Filler
} from 'chart.js';
import type { ChampionshipWindow, TeamMetrics } from '@/lib/services/traditional-fantasy/keeper-management/types';

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
  window: ChampionshipWindow;
  teamMetrics: TeamMetrics;
}

export function ChampionshipWindowVisualizer({ window, teamMetrics }: ChampionshipWindowVisualizerProps) {
  const currentYear = new Date().getFullYear();
  
  const windowStatusConfig = {
    competing: {
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/50',
      icon: TrophyIcon,
      message: 'Championship Contender',
      description: 'Your team is in prime position to compete for a championship'
    },
    fringe: {
      color: 'from-yellow-500 to-yellow-600',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/50',
      icon: ArrowTrendingUpIcon,
      message: 'Playoff Contender',
      description: 'One or two moves away from championship contention'
    },
    rebuilding: {
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/50',
      icon: ArrowTrendingDownIcon,
      message: 'Rebuilding Phase',
      description: 'Focus on accumulating young talent and future assets'
    },
    retooling: {
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/50',
      icon: ClockIcon,
      message: 'Retooling',
      description: 'Strategic adjustments needed to return to contention'
    }
  };

  const config = windowStatusConfig[window.status];
  const StatusIcon = config.icon;

  // Championship probability chart data
  const probabilityChartData = {
    labels: Array.from({ length: window.windowDuration }, (_, i) => currentYear + i),
    datasets: [
      {
        label: 'Championship Probability',
        data: window.championshipProbability,
        borderColor: 'rgb(251, 191, 36)',
        backgroundColor: 'rgba(251, 191, 36, 0.2)',
        fill: true,
        tension: 0.4
      }
    ]
  };

  // Roster value projection chart
  const rosterValueData = {
    labels: ['Current', 'Year 1', 'Year 2', 'Year 3'],
    datasets: [
      {
        label: 'Roster Value',
        data: [teamMetrics.currentRosterValue, ...teamMetrics.futureRosterValue],
        backgroundColor: [
          'rgba(59, 130, 246, 0.8)',
          'rgba(59, 130, 246, 0.6)',
          'rgba(59, 130, 246, 0.4)',
          'rgba(59, 130, 246, 0.2)'
        ],
        borderColor: [
          'rgb(59, 130, 246)',
          'rgb(59, 130, 246)',
          'rgb(59, 130, 246)',
          'rgb(59, 130, 246)'
        ],
        borderWidth: 1
      }
    ]
  };

  const chartOptions = {
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
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1
      }
    },
    scales: {
      x: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)'
        }
      },
      y: {
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)'
        }
      }
    }
  };

  // Calculate key metrics
  const peakProbability = Math.max(...window.championshipProbability);
  const averageProbability = window.championshipProbability.reduce((a, b) => a + b, 0) / window.championshipProbability.length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={`${config.bgColor} ${config.borderColor} border rounded-xl p-6`}
    >
      <div className="flex items-start justify-between mb-6">
        <div className="flex items-center gap-4">
          <motion.div
            animate={{ 
              rotate: window.status === 'competing' ? [0, 10, -10, 0] : 0,
              scale: window.status === 'competing' ? [1, 1.1, 1] : 1
            }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className={`w-12 h-12 bg-gradient-to-r ${config.color} rounded-lg flex items-center justify-center`}
          >
            <StatusIcon className="w-6 h-6 text-white" />
          </motion.div>
          <div>
            <h3 className="text-xl font-bold text-white">{config.message}</h3>
            <p className="text-gray-400">{config.description}</p>
          </div>
        </div>

        {/* AI Confidence Badge */}
        <div className="flex items-center gap-2 bg-purple-500/20 border border-purple-500/50 rounded-lg px-3 py-2">
          <SparklesIcon className="w-5 h-5 text-purple-400" />
          <div>
            <p className="text-xs text-purple-300">AI Confidence</p>
            <p className="text-sm font-bold text-purple-400">
              {(averageProbability * 100).toFixed(0)}%
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Championship Probability Timeline */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-4">Championship Probability Timeline</h4>
          <div className="h-48">
            <Line data={probabilityChartData} options={chartOptions} />
          </div>
          
          <div className="grid grid-cols-3 gap-3 mt-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">Peak Year</p>
              <p className="text-lg font-bold text-yellow-400">{currentYear + window.peakYear}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Peak Probability</p>
              <p className="text-lg font-bold text-green-400">{(peakProbability * 100).toFixed(0)}%</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Window Length</p>
              <p className="text-lg font-bold text-blue-400">{window.windowDuration} years</p>
            </div>
          </div>
        </div>

        {/* Roster Value Projection */}
        <div className="bg-gray-900/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-4">Roster Value Projection</h4>
          <div className="h-48">
            <Bar data={rosterValueData} options={chartOptions} />
          </div>
          
          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="text-center">
              <p className="text-xs text-gray-500">Competitive Balance</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <div className="w-20 bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
                    style={{ width: `${teamMetrics.competitiveBalance * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-white">
                  {(teamMetrics.competitiveBalance * 100).toFixed(0)}%
                </span>
              </div>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">Sustainability</p>
              <div className="flex items-center justify-center gap-2 mt-1">
                <div className="w-20 bg-gray-700 rounded-full h-2">
                  <div 
                    className="bg-gradient-to-r from-orange-500 to-yellow-500 h-2 rounded-full"
                    style={{ width: `${teamMetrics.sustainabilityScore * 100}%` }}
                  />
                </div>
                <span className="text-sm font-bold text-white">
                  {(teamMetrics.sustainabilityScore * 100).toFixed(0)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Strategy Recommendations */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gray-900/50 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <FireIcon className="w-5 h-5 text-orange-400" />
            <h5 className="text-sm font-semibold text-white">Target Positions</h5>
          </div>
          <div className="flex flex-wrap gap-2">
            {window.recommendedStrategy.targetPositions.map((pos, idx) => (
              <span key={idx} className="px-2 py-1 bg-gray-800 rounded text-xs text-gray-300">
                {pos}
              </span>
            ))}
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gray-900/50 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <ArrowTrendingUpIcon className="w-5 h-5 text-green-400" />
            <h5 className="text-sm font-semibold text-white">Draft Strategy</h5>
          </div>
          <p className="text-sm text-gray-300 capitalize">
            {window.recommendedStrategy.draftStrategy}
          </p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          className="bg-gray-900/50 rounded-lg p-4"
        >
          <div className="flex items-center gap-2 mb-2">
            <TrophyIcon className="w-5 h-5 text-yellow-400" />
            <h5 className="text-sm font-semibold text-white">Keeper Strategy</h5>
          </div>
          <p className="text-sm text-gray-300 capitalize">
            {window.recommendedStrategy.keeperStrategy}
          </p>
        </motion.div>
      </div>
    </motion.div>
  );
}
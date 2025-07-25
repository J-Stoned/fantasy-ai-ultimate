'use client';

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  ChartBarIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ExclamationTriangleIcon,
  SparklesIcon,
  CalendarDaysIcon,
  FireIcon,
  ClockIcon
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
import type { Player, ValueProjection } from '@/lib/services/traditional-fantasy/keeper-management/types';

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

interface PlayerValueProjectionChartProps {
  player: Player;
  projection: ValueProjection;
  leagueAverage?: number[];
}

export function PlayerValueProjectionChart({ 
  player, 
  projection,
  leagueAverage = []
}: PlayerValueProjectionChartProps) {
  const currentYear = new Date().getFullYear();
  
  // Generate chart data
  const chartData = useMemo(() => {
    const years = Array.from({ length: 5 }, (_, i) => currentYear + i);
    const projectedValues = [
      projection.currentYearValue,
      projection.threeYearValue / 3,
      projection.threeYearValue / 3,
      projection.threeYearValue / 3,
      projection.fiveYearValue / 5
    ];

    return {
      labels: years,
      datasets: [
        {
          label: `${player.name} Projection`,
          data: projectedValues,
          borderColor: 'rgb(251, 191, 36)',
          backgroundColor: 'rgba(251, 191, 36, 0.1)',
          fill: true,
          tension: 0.4,
          pointRadius: 6,
          pointHoverRadius: 8
        },
        {
          label: 'Confidence High',
          data: projection.confidenceIntervals.high.slice(0, 5),
          borderColor: 'rgba(34, 197, 94, 0.5)',
          backgroundColor: 'rgba(34, 197, 94, 0.1)',
          borderDash: [5, 5],
          fill: '+1',
          tension: 0.4,
          pointRadius: 0
        },
        {
          label: 'Confidence Low',
          data: projection.confidenceIntervals.low.slice(0, 5),
          borderColor: 'rgba(239, 68, 68, 0.5)',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          borderDash: [5, 5],
          fill: '-1',
          tension: 0.4,
          pointRadius: 0
        }
      ]
    };
  }, [player, projection, currentYear]);

  // Calculate key metrics
  const metrics = useMemo(() => {
    const peakYear = currentYear + projection.peakValueYear;
    const declineYear = currentYear + projection.declineStartYear;
    const peakValue = Math.max(...projection.confidenceIntervals.median);
    const valueTrajectory = projection.threeYearValue > projection.currentYearValue ? 'rising' : 'declining';
    const careerStage = player.age < 25 ? 'developing' : player.age < 30 ? 'prime' : 'veteran';
    
    return {
      peakYear,
      declineYear,
      peakValue,
      valueTrajectory,
      careerStage,
      remainingPrime: Math.max(0, 30 - player.age)
    };
  }, [player, projection, currentYear]);

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: 'index' as const,
      intersect: false
    },
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.8)',
          usePointStyle: true
        }
      },
      tooltip: {
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleColor: '#fff',
        bodyColor: '#fff',
        borderColor: 'rgba(255, 255, 255, 0.2)',
        borderWidth: 1,
        callbacks: {
          label: (context: any) => {
            return `${context.dataset.label}: ${context.parsed.y.toFixed(0)} pts`;
          }
        }
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
          color: 'rgba(255, 255, 255, 0.6)',
          callback: (value: any) => `${value} pts`
        }
      }
    }
  };

  const getCareerStageConfig = (stage: string) => {
    switch (stage) {
      case 'developing':
        return {
          color: 'from-blue-500 to-blue-600',
          bgColor: 'bg-blue-500/20',
          borderColor: 'border-blue-500/50',
          icon: TrendingUpIcon,
          label: 'Developing Talent'
        };
      case 'prime':
        return {
          color: 'from-green-500 to-green-600',
          bgColor: 'bg-green-500/20',
          borderColor: 'border-green-500/50',
          icon: FireIcon,
          label: 'Prime Years'
        };
      case 'veteran':
        return {
          color: 'from-orange-500 to-orange-600',
          bgColor: 'bg-orange-500/20',
          borderColor: 'border-orange-500/50',
          icon: ClockIcon,
          label: 'Veteran Stage'
        };
      default:
        return {
          color: 'from-gray-500 to-gray-600',
          bgColor: 'bg-gray-500/20',
          borderColor: 'border-gray-500/50',
          icon: ChartBarIcon,
          label: 'Unknown'
        };
    }
  };

  const stageConfig = getCareerStageConfig(metrics.careerStage);
  const StageIcon = stageConfig.icon;

  return (
    <div className="bg-gray-800/50 rounded-xl p-6">
      {/* Header */}
      <div className="flex items-start justify-between mb-6">
        <div>
          <h3 className="text-lg font-bold text-white mb-1">Value Projection Analysis</h3>
          <p className="text-sm text-gray-400">
            AI-powered {projection.declineStartYear - projection.peakValueYear + 1}-year outlook
          </p>
        </div>
        
        <div className={`${stageConfig.bgColor} ${stageConfig.borderColor} border rounded-lg px-3 py-2`}>
          <div className="flex items-center gap-2">
            <StageIcon className="w-5 h-5 text-white" />
            <div>
              <p className="text-xs text-gray-300">Career Stage</p>
              <p className="text-sm font-bold text-white">{stageConfig.label}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-gray-900/50 rounded-lg p-3 text-center"
        >
          <CalendarDaysIcon className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500">Peak Year</p>
          <p className="text-lg font-bold text-white">{metrics.peakYear}</p>
          <p className="text-xs text-gray-400">
            {projection.peakValueYear === 0 ? 'Now!' : `In ${projection.peakValueYear} years`}
          </p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-gray-900/50 rounded-lg p-3 text-center"
        >
          <ChartBarIcon className="w-6 h-6 text-blue-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500">Peak Value</p>
          <p className="text-lg font-bold text-white">{metrics.peakValue.toFixed(0)}</p>
          <p className="text-xs text-gray-400">Fantasy points</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-gray-900/50 rounded-lg p-3 text-center"
        >
          {metrics.valueTrajectory === 'rising' ? (
            <TrendingUpIcon className="w-6 h-6 text-green-400 mx-auto mb-1" />
          ) : (
            <TrendingDownIcon className="w-6 h-6 text-red-400 mx-auto mb-1" />
          )}
          <p className="text-xs text-gray-500">Trajectory</p>
          <p className={`text-lg font-bold ${
            metrics.valueTrajectory === 'rising' ? 'text-green-400' : 'text-red-400'
          }`}>
            {metrics.valueTrajectory === 'rising' ? 'Rising' : 'Declining'}
          </p>
          <p className="text-xs text-gray-400">Next 3 years</p>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.05 }}
          className="bg-gray-900/50 rounded-lg p-3 text-center"
        >
          <ExclamationTriangleIcon className="w-6 h-6 text-orange-400 mx-auto mb-1" />
          <p className="text-xs text-gray-500">Prime Years Left</p>
          <p className="text-lg font-bold text-white">{metrics.remainingPrime}</p>
          <p className="text-xs text-gray-400">Until age 30</p>
        </motion.div>
      </div>

      {/* Main Chart */}
      <div className="bg-gray-900/50 rounded-lg p-4 mb-6">
        <div className="h-64">
          <Line data={chartData} options={chartOptions} />
        </div>
      </div>

      {/* Value Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="bg-gray-900/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
            <SparklesIcon className="w-4 h-4 text-purple-400" />
            Current Season
          </h4>
          <p className="text-2xl font-bold text-white mb-2">
            {projection.currentYearValue.toFixed(0)}
          </p>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between">
              <span className="text-gray-500">High</span>
              <span className="text-green-400">{projection.confidenceIntervals.high[0].toFixed(0)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-500">Low</span>
              <span className="text-red-400">{projection.confidenceIntervals.low[0].toFixed(0)}</span>
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-3">3-Year Outlook</h4>
          <p className="text-2xl font-bold text-white mb-2">
            {projection.threeYearValue.toFixed(0)}
          </p>
          <p className="text-xs text-gray-400">
            Avg: {(projection.threeYearValue / 3).toFixed(0)} per year
          </p>
          <div className="mt-2">
            <div className="w-full bg-gray-700 rounded-full h-2">
              <div 
                className="bg-gradient-to-r from-blue-500 to-green-500 h-2 rounded-full"
                style={{ width: `${Math.min(100, (projection.threeYearValue / 1000) * 100)}%` }}
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-900/50 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-gray-400 mb-3">Career Remaining</h4>
          <p className="text-2xl font-bold text-white mb-2">
            {projection.careerRemainingValue.toFixed(0)}
          </p>
          <p className="text-xs text-gray-400">
            Decline starts year {projection.declineStartYear}
          </p>
          <div className="mt-2">
            {player.age > 30 && (
              <div className="flex items-center gap-1 text-xs text-orange-400">
                <ExclamationTriangleIcon className="w-3 h-3" />
                Age-related decline risk
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Position Context */}
      <div className="mt-4 p-3 bg-gray-900/50 rounded-lg">
        <p className="text-xs text-gray-500 mb-1">Position Context</p>
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-300">
            {player.position} typically peak at age {getPositionPeakAge(player.position)}
          </p>
          {player.age <= getPositionPeakAge(player.position) ? (
            <span className="text-xs px-2 py-1 bg-green-500/20 rounded text-green-400">
              Pre-peak
            </span>
          ) : (
            <span className="text-xs px-2 py-1 bg-orange-500/20 rounded text-orange-400">
              Post-peak
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper function
function getPositionPeakAge(position: string): number {
  const peakAges: Record<string, number> = {
    QB: 30,
    RB: 25,
    WR: 27,
    TE: 28,
    K: 32,
    DEF: 0
  };
  return peakAges[position] || 27;
}
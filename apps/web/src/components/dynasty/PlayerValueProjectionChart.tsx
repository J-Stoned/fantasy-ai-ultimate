'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FiTrendingUp, FiTrendingDown, FiActivity, FiCalendar } from 'react-icons/fi';
import { Line, Area } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  ChartOptions
} from 'chart.js';
import { valueProjectionService } from '@/lib/services/traditional-fantasy/keeper-management/value-projection-service';
import type { PlayerValueProjection } from '@/lib/services/traditional-fantasy/keeper-management/types';
import { logger } from '../../lib/logging/logger';

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

interface PlayerValueProjectionChartProps {
  playerId: string;
  playerName: string;
  position: string;
  age: number;
}

export const PlayerValueProjectionChart: React.FC<PlayerValueProjectionChartProps> = ({
  playerId,
  playerName,
  position,
  age
}) => {
  const [projection, setProjection] = useState<PlayerValueProjection | null>(null);
  const [loading, setLoading] = useState(true);
  const [timeframe, setTimeframe] = useState<'1year' | '3year' | '5year'>('3year');
  const [showConfidenceInterval, setShowConfidenceInterval] = useState(true);

  useEffect(() => {
    loadProjection();
  }, [playerId]);

  const loadProjection = async () => {
    setLoading(true);
    try {
      const data = await valueProjectionService.getPlayerProjection(playerId);
      setProjection(data);
    } catch (error) {
      logger.error('Failed to load projection:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  if (loading || !projection) {
    return (
      <div className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-700/50 rounded w-1/3"></div>
          <div className="h-64 bg-gray-700/50 rounded"></div>
        </div>
      </div>
    );
  }

  const getTimeframeData = () => {
    const years = timeframe === '1year' ? 1 : timeframe === '3year' ? 3 : 5;
    return projection.projections.slice(0, years + 1);
  };

  const timeframeData = getTimeframeData();
  const currentYear = new Date().getFullYear();

  const chartData = {
    labels: timeframeData.map(p => p.year.toString()),
    datasets: [
      {
        label: 'Value Projection',
        data: timeframeData.map(p => p.value),
        borderColor: 'rgb(168, 85, 247)',
        backgroundColor: 'rgba(168, 85, 247, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.4,
        pointRadius: 6,
        pointHoverRadius: 8,
        pointBackgroundColor: 'rgb(168, 85, 247)',
        pointBorderColor: '#fff',
        pointBorderWidth: 2
      },
      ...(showConfidenceInterval ? [
        {
          label: 'Upper Bound',
          data: timeframeData.map(p => p.upperBound),
          borderColor: 'rgba(168, 85, 247, 0.3)',
          backgroundColor: 'rgba(168, 85, 247, 0.05)',
          borderWidth: 1,
          borderDash: [5, 5],
          fill: '+1',
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 0
        },
        {
          label: 'Lower Bound',
          data: timeframeData.map(p => p.lowerBound),
          borderColor: 'rgba(168, 85, 247, 0.3)',
          backgroundColor: 'rgba(168, 85, 247, 0.05)',
          borderWidth: 1,
          borderDash: [5, 5],
          fill: false,
          tension: 0.4,
          pointRadius: 0,
          pointHoverRadius: 0
        }
      ] : [])
    ]
  };

  const chartOptions: ChartOptions<'line'> = {
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
        padding: 12,
        callbacks: {
          label: function(context) {
            const label = context.dataset.label || '';
            const value = context.parsed.y;
            const confidence = timeframeData[context.dataIndex]?.confidence;
            
            if (label === 'Value Projection') {
              return [`Value: $${value}`, `Confidence: ${confidence}%`];
            }
            return `${label}: $${value}`;
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
            return '$' + value;
          }
        }
      }
    }
  };

  const totalChange = projection.projections[projection.projections.length - 1].value - projection.currentValue;
  const percentageChange = (totalChange / projection.currentValue) * 100;

  const getValueTrendIcon = () => {
    if (percentageChange > 10) return <FiTrendingUp className="text-green-400" />;
    if (percentageChange < -10) return <FiTrendingDown className="text-red-400" />;
    return <FiActivity className="text-yellow-400" />;
  };

  const getKeyFactorIcon = (factor: string) => {
    if (factor.includes('age') || factor.includes('decline')) return '📉';
    if (factor.includes('breakout') || factor.includes('growth')) return '📈';
    if (factor.includes('injury')) return '🏥';
    if (factor.includes('situation') || factor.includes('team')) return '🏈';
    return '📊';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-xl font-bold text-white mb-1">{playerName}</h3>
          <div className="flex items-center space-x-3 text-sm text-gray-400">
            <span>{position}</span>
            <span>•</span>
            <span>Age {age}</span>
            <span>•</span>
            <span className={`flex items-center space-x-1 ${
              percentageChange > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {getValueTrendIcon()}
              <span>{percentageChange > 0 ? '+' : ''}{percentageChange.toFixed(1)}%</span>
            </span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <button
            onClick={() => setTimeframe('1year')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              timeframe === '1year' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            1 Year
          </button>
          <button
            onClick={() => setTimeframe('3year')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              timeframe === '3year' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            3 Years
          </button>
          <button
            onClick={() => setTimeframe('5year')}
            className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              timeframe === '5year' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
            }`}
          >
            5 Years
          </button>
        </div>
      </div>

      {/* Value Cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Current Value</p>
          <p className="text-xl font-bold text-white">${projection.currentValue}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Peak Value</p>
          <p className="text-xl font-bold text-purple-400">${projection.peakValue}</p>
          <p className="text-xs text-gray-500">{projection.peakYear}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Floor</p>
          <p className="text-xl font-bold text-red-400">${projection.floorValue}</p>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3">
          <p className="text-xs text-gray-400 mb-1">Ceiling</p>
          <p className="text-xl font-bold text-green-400">${projection.ceilingValue}</p>
        </div>
      </div>

      {/* Chart */}
      <div className="h-64 mb-6">
        <Line data={chartData} options={chartOptions} />
      </div>

      {/* Confidence Toggle */}
      <div className="flex items-center justify-between mb-4">
        <label className="flex items-center space-x-2 text-sm text-gray-400">
          <input
            type="checkbox"
            checked={showConfidenceInterval}
            onChange={(e) => setShowConfidenceInterval(e.target.checked)}
            className="rounded border-gray-600 bg-gray-700 text-purple-500 focus:ring-purple-500 focus:ring-offset-0"
          />
          <span>Show Confidence Interval</span>
        </label>
        <p className="text-sm text-gray-400">
          Average Confidence: {projection.averageConfidence}%
        </p>
      </div>

      {/* Key Factors */}
      <div className="space-y-3">
        <h4 className="text-sm font-medium text-gray-300">Key Value Factors</h4>
        <div className="grid grid-cols-2 gap-3">
          {projection.keyFactors.map((factor, index) => (
            <div
              key={index}
              className={`flex items-start space-x-3 p-3 rounded-lg border ${
                factor.impact === 'positive'
                  ? 'bg-green-900/20 border-green-700/30'
                  : factor.impact === 'negative'
                  ? 'bg-red-900/20 border-red-700/30'
                  : 'bg-gray-800/50 border-gray-700/30'
              }`}
            >
              <span className="text-xl">{getKeyFactorIcon(factor.factor)}</span>
              <div className="flex-1">
                <p className="text-sm font-medium text-white">{factor.factor}</p>
                <p className="text-xs text-gray-400 mt-1">{factor.description}</p>
              </div>
              <span className={`text-sm font-medium ${
                factor.impact === 'positive' ? 'text-green-400' :
                factor.impact === 'negative' ? 'text-red-400' :
                'text-gray-400'
              }`}>
                {factor.weight}%
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Historical Accuracy */}
      {projection.historicalAccuracy && (
        <div className="mt-4 p-3 bg-gray-800/50 rounded-lg">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-400">Historical Projection Accuracy</p>
            <p className={`text-sm font-medium ${
              projection.historicalAccuracy >= 80 ? 'text-green-400' :
              projection.historicalAccuracy >= 60 ? 'text-yellow-400' :
              'text-red-400'
            }`}>
              {projection.historicalAccuracy}%
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};
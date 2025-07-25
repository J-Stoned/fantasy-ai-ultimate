'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiPackage, FiTrendingUp, FiDollarSign, FiCalendar, FiFilter } from 'react-icons/fi';
import { Doughnut, Scatter } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  ArcElement,
  CategoryScale,
  LinearScale,
  PointElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions
} from 'chart.js';
import { dynastyStrategyService } from '@/lib/services/traditional-fantasy/keeper-management/dynasty-strategy-service';
import type { DynastyAsset } from '@/lib/services/traditional-fantasy/keeper-management/types';
import { logger } from '../../lib/logging/logger';

ChartJS.register(ArcElement, CategoryScale, LinearScale, PointElement, Title, Tooltip, Legend);

interface DynastyAssetManagerProps {
  leagueId: string;
  teamId: string;
}

export const DynastyAssetManager: React.FC<DynastyAssetManagerProps> = ({
  leagueId,
  teamId
}) => {
  const [assets, setAssets] = useState<DynastyAsset[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'players' | 'picks'>('all');
  const [sortBy, setSortBy] = useState<'value' | 'age' | 'potential'>('value');

  useEffect(() => {
    loadAssets();
  }, [leagueId, teamId]);

  const loadAssets = async () => {
    setLoading(true);
    try {
      const data = await dynastyStrategyService.getTeamAssets(leagueId, teamId);
      setAssets(data);
    } catch (error) {
      logger.error('Failed to load assets:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  const filteredAssets = assets.filter(asset => {
    if (filter === 'all') return true;
    if (filter === 'players') return asset.type === 'player';
    if (filter === 'picks') return asset.type === 'pick';
    return true;
  });

  const sortedAssets = [...filteredAssets].sort((a, b) => {
    if (sortBy === 'value') return b.currentValue - a.currentValue;
    if (sortBy === 'age' && a.age && b.age) return a.age - b.age;
    if (sortBy === 'potential') return b.projectedValue - a.projectedValue;
    return 0;
  });

  const totalValue = assets.reduce((sum, asset) => sum + asset.currentValue, 0);
  const playerValue = assets
    .filter(a => a.type === 'player')
    .reduce((sum, asset) => sum + asset.currentValue, 0);
  const pickValue = assets
    .filter(a => a.type === 'pick')
    .reduce((sum, asset) => sum + asset.currentValue, 0);

  const portfolioData = {
    labels: ['Players', 'Draft Picks'],
    datasets: [
      {
        data: [playerValue, pickValue],
        backgroundColor: ['rgba(168, 85, 247, 0.8)', 'rgba(59, 130, 246, 0.8)'],
        borderColor: ['rgb(168, 85, 247)', 'rgb(59, 130, 246)'],
        borderWidth: 2
      }
    ]
  };

  const scatterData = {
    datasets: [
      {
        label: 'Players',
        data: assets
          .filter(a => a.type === 'player' && a.age)
          .map(a => ({ x: a.age!, y: a.currentValue })),
        backgroundColor: 'rgba(168, 85, 247, 0.6)',
        borderColor: 'rgb(168, 85, 247)',
        pointRadius: 6,
        pointHoverRadius: 8
      },
      {
        label: 'Picks',
        data: assets
          .filter(a => a.type === 'pick')
          .map(a => ({ x: 22, y: a.currentValue })), // Use 22 as proxy age for picks
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(59, 130, 246)',
        pointRadius: 6,
        pointHoverRadius: 8
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
        padding: 12,
        callbacks: {
          label: function(context) {
            const label = context.label || '';
            const value = context.parsed || 0;
            const percentage = ((value / totalValue) * 100).toFixed(1);
            return `${label}: $${value.toFixed(0)} (${percentage}%)`;
          }
        }
      }
    }
  };

  const scatterOptions: ChartOptions<'scatter'> = {
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
        padding: 12,
        callbacks: {
          label: function(context) {
            const asset = assets.find(a => 
              (a.age === context.parsed.x || (a.type === 'pick' && context.parsed.x === 22)) &&
              a.currentValue === context.parsed.y
            );
            if (asset) {
              return `${asset.name}: $${asset.currentValue} (Age: ${asset.age || 'N/A'})`;
            }
            return '';
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Age',
          color: '#9CA3AF'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#9CA3AF'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Value ($)',
          color: '#9CA3AF'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: '#9CA3AF'
        }
      }
    }
  };

  if (loading) {
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
            <h2 className="text-2xl font-bold text-white mb-2">Dynasty Assets</h2>
            <p className="text-gray-400">Manage your players and draft capital</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-gray-400">Total Portfolio Value</p>
            <p className="text-3xl font-bold text-white">${totalValue.toFixed(0)}</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2 bg-gray-800/50 rounded-lg p-1">
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === 'all' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('players')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === 'players' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Players
            </button>
            <button
              onClick={() => setFilter('picks')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                filter === 'picks' ? 'bg-purple-500 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Picks
            </button>
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="bg-gray-800/50 text-white rounded-lg px-3 py-2 text-sm border border-gray-700 focus:border-purple-500 focus:outline-none"
          >
            <option value="value">Sort by Value</option>
            <option value="age">Sort by Age</option>
            <option value="potential">Sort by Potential</option>
          </select>
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
          <h3 className="text-lg font-bold text-white mb-4">Portfolio Distribution</h3>
          <div className="h-64">
            <Doughnut data={portfolioData} options={doughnutOptions} />
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
        >
          <h3 className="text-lg font-bold text-white mb-4">Age vs Value Distribution</h3>
          <div className="h-64">
            <Scatter data={scatterData} options={scatterOptions} />
          </div>
        </motion.div>
      </div>

      {/* Assets List */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="rounded-2xl bg-gradient-to-br from-gray-900/90 to-gray-800/90 backdrop-blur-xl border border-gray-700/50 p-6"
      >
        <h3 className="text-lg font-bold text-white mb-4">Asset Details</h3>
        <div className="space-y-3 max-h-96 overflow-y-auto">
          <AnimatePresence>
            {sortedAssets.map((asset, index) => (
              <motion.div
                key={asset.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.05 }}
                className="bg-gray-800/50 rounded-lg p-4 border border-gray-700/50 hover:border-purple-700/50 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                      asset.type === 'player' ? 'bg-purple-500/20' : 'bg-blue-500/20'
                    }`}>
                      {asset.type === 'player' ? (
                        <FiPackage className="text-purple-400" />
                      ) : (
                        <FiCalendar className="text-blue-400" />
                      )}
                    </div>
                    <div>
                      <h4 className="font-medium text-white">{asset.name}</h4>
                      <div className="flex items-center space-x-3 text-sm text-gray-400">
                        {asset.type === 'player' && (
                          <>
                            <span>{asset.position}</span>
                            <span>•</span>
                            <span>Age {asset.age}</span>
                          </>
                        )}
                        {asset.type === 'pick' && (
                          <>
                            <span>{asset.year} Draft</span>
                            <span>•</span>
                            <span>Round {asset.round}</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-lg font-bold text-white">${asset.currentValue}</p>
                    <div className="flex items-center justify-end space-x-1 text-sm">
                      {asset.projectedValue > asset.currentValue ? (
                        <FiTrendingUp className="text-green-400" />
                      ) : (
                        <FiTrendingUp className="text-red-400 rotate-180" />
                      )}
                      <span className={asset.projectedValue > asset.currentValue ? 'text-green-400' : 'text-red-400'}>
                        {((asset.projectedValue / asset.currentValue - 1) * 100).toFixed(1)}%
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
};
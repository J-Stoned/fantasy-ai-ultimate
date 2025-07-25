'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BanknotesIcon,
  UserGroupIcon,
  DocumentTextIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ArrowsUpDownIcon,
  SparklesIcon,
  ChartBarIcon,
  FireIcon,
  ClockIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Scatter, Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
} from 'chart.js';
import type { Player, TeamMetrics, LeagueContext, DynastyAsset } from '@/lib/services/traditional-fantasy/keeper-management/types';

ChartJS.register(
  RadialLinearScale,
  PointElement,
  LineElement,
  Filler,
  Tooltip,
  Legend
);

interface DynastyAssetManagerProps {
  roster: Player[];
  teamMetrics: TeamMetrics;
  leagueContext: LeagueContext;
}

type AssetCategory = 'elite' | 'core' | 'developing' | 'aging' | 'trade';

export function DynastyAssetManager({ roster, teamMetrics, leagueContext }: DynastyAssetManagerProps) {
  const [selectedCategory, setSelectedCategory] = useState<AssetCategory>('elite');
  const [sortBy, setSortBy] = useState<'value' | 'age' | 'trend'>('value');

  // Calculate dynasty assets
  const dynastyAssets = useMemo(() => {
    const playerAssets: (DynastyAsset & { player: Player })[] = roster.map(player => {
      // Simplified valuation - in production, this would use complex algorithms
      const ageMultiplier = player.age < 25 ? 1.3 : player.age > 30 ? 0.7 : 1;
      const positionMultiplier = { QB: 1.1, RB: 0.9, WR: 1.0, TE: 0.85 }[player.position] || 1;
      const performanceValue = player.performanceHistory[0]?.fantasyPointsPerGame || 10;
      
      const currentValue = performanceValue * ageMultiplier * positionMultiplier * 10;
      const futureValue = Array.from({ length: 3 }, (_, i) => 
        currentValue * Math.pow(player.age < 27 ? 1.1 : 0.9, i + 1)
      );

      return {
        type: 'player' as const,
        currentValue,
        futureValue,
        liquidity: player.age < 28 && player.position !== 'QB' ? 0.8 : 0.5,
        demandScore: calculateDemandScore(player),
        player
      };
    });

    // Add draft picks
    const pickAssets: DynastyAsset[] = teamMetrics.draftCapital.map(pick => ({
      type: 'pick' as const,
      currentValue: pick.expectedValue,
      futureValue: [pick.expectedValue * 0.9, pick.expectedValue * 0.8],
      liquidity: 0.9,
      demandScore: pick.round === 1 ? 0.9 : 0.6
    }));

    return { playerAssets, pickAssets };
  }, [roster, teamMetrics]);

  // Categorize players
  const categorizedPlayers = useMemo(() => {
    const categories: Record<AssetCategory, (DynastyAsset & { player: Player })[]> = {
      elite: [],
      core: [],
      developing: [],
      aging: [],
      trade: []
    };

    dynastyAssets.playerAssets.forEach(asset => {
      if (asset.currentValue > 150 && asset.player.age < 30) {
        categories.elite.push(asset);
      } else if (asset.currentValue > 100 && asset.player.age < 28) {
        categories.core.push(asset);
      } else if (asset.player.age < 25) {
        categories.developing.push(asset);
      } else if (asset.player.age > 30) {
        categories.aging.push(asset);
      } else {
        categories.trade.push(asset);
      }
    });

    return categories;
  }, [dynastyAssets]);

  // Sort assets
  const sortedAssets = useMemo(() => {
    const assets = [...categorizedPlayers[selectedCategory]];
    
    switch (sortBy) {
      case 'value':
        return assets.sort((a, b) => b.currentValue - a.currentValue);
      case 'age':
        return assets.sort((a, b) => a.player.age - b.player.age);
      case 'trend':
        return assets.sort((a, b) => {
          const aTrend = (a.futureValue[0] - a.currentValue) / a.currentValue;
          const bTrend = (b.futureValue[0] - b.currentValue) / b.currentValue;
          return bTrend - aTrend;
        });
      default:
        return assets;
    }
  }, [categorizedPlayers, selectedCategory, sortBy]);

  // Calculate portfolio metrics
  const portfolioMetrics = useMemo(() => {
    const totalCurrentValue = dynastyAssets.playerAssets.reduce((sum, a) => sum + a.currentValue, 0);
    const totalFutureValue = dynastyAssets.playerAssets.reduce((sum, a) => sum + a.futureValue[0], 0);
    const avgAge = roster.reduce((sum, p) => sum + p.age, 0) / roster.length;
    const eliteAssetCount = categorizedPlayers.elite.length;
    const developingAssetCount = categorizedPlayers.developing.length;

    return {
      totalCurrentValue,
      totalFutureValue,
      valueTrajectory: ((totalFutureValue - totalCurrentValue) / totalCurrentValue) * 100,
      avgAge,
      eliteAssetCount,
      developingAssetCount,
      liquidityScore: dynastyAssets.playerAssets.reduce((sum, a) => sum + a.liquidity, 0) / dynastyAssets.playerAssets.length
    };
  }, [dynastyAssets, roster, categorizedPlayers]);

  // Scatter plot data for asset visualization
  const scatterData = {
    datasets: [
      {
        label: 'Elite Assets',
        data: categorizedPlayers.elite.map(a => ({
          x: a.player.age,
          y: a.currentValue,
          r: a.demandScore * 10
        })),
        backgroundColor: 'rgba(34, 197, 94, 0.6)',
        borderColor: 'rgb(34, 197, 94)'
      },
      {
        label: 'Core Assets',
        data: categorizedPlayers.core.map(a => ({
          x: a.player.age,
          y: a.currentValue,
          r: a.demandScore * 10
        })),
        backgroundColor: 'rgba(59, 130, 246, 0.6)',
        borderColor: 'rgb(59, 130, 246)'
      },
      {
        label: 'Developing Assets',
        data: categorizedPlayers.developing.map(a => ({
          x: a.player.age,
          y: a.currentValue,
          r: a.demandScore * 10
        })),
        backgroundColor: 'rgba(251, 191, 36, 0.6)',
        borderColor: 'rgb(251, 191, 36)'
      },
      {
        label: 'Aging Assets',
        data: categorizedPlayers.aging.map(a => ({
          x: a.player.age,
          y: a.currentValue,
          r: a.demandScore * 10
        })),
        backgroundColor: 'rgba(239, 68, 68, 0.6)',
        borderColor: 'rgb(239, 68, 68)'
      }
    ]
  };

  const scatterOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: {
          color: 'rgba(255, 255, 255, 0.8)'
        }
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const asset = dynastyAssets.playerAssets.find(a => 
              a.player.age === context.parsed.x && 
              Math.abs(a.currentValue - context.parsed.y) < 5
            );
            if (asset) {
              return `${asset.player.name}: ${context.parsed.y.toFixed(0)} value`;
            }
            return `Value: ${context.parsed.y.toFixed(0)}`;
          }
        }
      }
    },
    scales: {
      x: {
        title: {
          display: true,
          text: 'Age',
          color: 'rgba(255, 255, 255, 0.8)'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)'
        }
      },
      y: {
        title: {
          display: true,
          text: 'Current Value',
          color: 'rgba(255, 255, 255, 0.8)'
        },
        grid: {
          color: 'rgba(255, 255, 255, 0.1)'
        },
        ticks: {
          color: 'rgba(255, 255, 255, 0.6)'
        }
      }
    }
  };

  const categoryConfig = {
    elite: {
      color: 'from-green-500 to-green-600',
      bgColor: 'bg-green-500/20',
      borderColor: 'border-green-500/50',
      icon: FireIcon,
      label: 'Elite Assets'
    },
    core: {
      color: 'from-blue-500 to-blue-600',
      bgColor: 'bg-blue-500/20',
      borderColor: 'border-blue-500/50',
      icon: UserGroupIcon,
      label: 'Core Players'
    },
    developing: {
      color: 'from-yellow-500 to-yellow-600',
      bgColor: 'bg-yellow-500/20',
      borderColor: 'border-yellow-500/50',
      icon: TrendingUpIcon,
      label: 'Developing Talent'
    },
    aging: {
      color: 'from-red-500 to-red-600',
      bgColor: 'bg-red-500/20',
      borderColor: 'border-red-500/50',
      icon: ClockIcon,
      label: 'Aging Veterans'
    },
    trade: {
      color: 'from-purple-500 to-purple-600',
      bgColor: 'bg-purple-500/20',
      borderColor: 'border-purple-500/50',
      icon: ArrowsUpDownIcon,
      label: 'Trade Candidates'
    }
  };

  return (
    <div className="space-y-6">
      {/* Portfolio Overview */}
      <Card className="bg-gradient-to-br from-gray-800 to-gray-900 border-gray-700 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <BanknotesIcon className="w-8 h-8 text-yellow-500" />
            <div>
              <h2 className="text-2xl font-bold text-white">Dynasty Portfolio</h2>
              <p className="text-gray-400">Total asset valuation and trajectory</p>
            </div>
          </div>
          
          {/* AI Insights Badge */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex items-center gap-2 bg-purple-500/20 border border-purple-500/50 rounded-lg px-4 py-2"
          >
            <SparklesIcon className="w-5 h-5 text-purple-400" />
            <div>
              <p className="text-xs text-purple-300">Portfolio Health</p>
              <p className="text-lg font-bold text-purple-400">
                {portfolioMetrics.liquidityScore > 0.7 ? 'Excellent' : 
                 portfolioMetrics.liquidityScore > 0.5 ? 'Good' : 'Fair'}
              </p>
            </div>
          </motion.div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4"
          >
            <p className="text-sm text-gray-500 mb-1">Total Value</p>
            <p className="text-2xl font-bold text-white">
              {portfolioMetrics.totalCurrentValue.toFixed(0)}
            </p>
            <div className="flex items-center gap-1 mt-2">
              {portfolioMetrics.valueTrajectory > 0 ? (
                <TrendingUpIcon className="w-4 h-4 text-green-400" />
              ) : (
                <TrendingDownIcon className="w-4 h-4 text-red-400" />
              )}
              <span className={`text-sm font-semibold ${
                portfolioMetrics.valueTrajectory > 0 ? 'text-green-400' : 'text-red-400'
              }`}>
                {portfolioMetrics.valueTrajectory > 0 ? '+' : ''}{portfolioMetrics.valueTrajectory.toFixed(1)}%
              </span>
            </div>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4"
          >
            <p className="text-sm text-gray-500 mb-1">Avg Age</p>
            <p className="text-2xl font-bold text-white">
              {portfolioMetrics.avgAge.toFixed(1)}
            </p>
            <p className="text-xs text-gray-400 mt-2">
              {portfolioMetrics.avgAge < 26 ? 'Young core' : 
               portfolioMetrics.avgAge < 28 ? 'Balanced' : 'Veteran heavy'}
            </p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4"
          >
            <p className="text-sm text-gray-500 mb-1">Elite Assets</p>
            <p className="text-2xl font-bold text-green-400">
              {portfolioMetrics.eliteAssetCount}
            </p>
            <p className="text-xs text-gray-400 mt-2">Championship pieces</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4"
          >
            <p className="text-sm text-gray-500 mb-1">Future Stars</p>
            <p className="text-2xl font-bold text-yellow-400">
              {portfolioMetrics.developingAssetCount}
            </p>
            <p className="text-xs text-gray-400 mt-2">High upside assets</p>
          </motion.div>
        </div>

        {/* Asset Visualization */}
        <div className="bg-gray-900/50 rounded-lg p-4 h-64">
          <Scatter data={scatterData} options={scatterOptions} />
        </div>
      </Card>

      {/* Category Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {Object.entries(categoryConfig).map(([key, config]) => {
          const Icon = config.icon;
          const count = categorizedPlayers[key as AssetCategory].length;
          
          return (
            <motion.button
              key={key}
              onClick={() => setSelectedCategory(key as AssetCategory)}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`
                flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition-all
                ${selectedCategory === key 
                  ? `bg-gradient-to-r ${config.color} text-white` 
                  : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                }
              `}
            >
              <Icon className="w-5 h-5" />
              <span>{config.label}</span>
              <span className="px-2 py-0.5 bg-black/20 rounded text-sm">{count}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Sort Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">
          {categoryConfig[selectedCategory].label}
        </h3>
        <div className="flex gap-2">
          {['value', 'age', 'trend'].map(sort => (
            <button
              key={sort}
              onClick={() => setSortBy(sort as any)}
              className={`
                px-3 py-1 rounded text-sm font-medium transition-colors
                ${sortBy === sort 
                  ? 'bg-gray-700 text-white' 
                  : 'text-gray-400 hover:text-white'
                }
              `}
            >
              Sort by {sort}
            </button>
          ))}
        </div>
      </div>

      {/* Asset List */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <AnimatePresence>
          {sortedAssets.map((asset, index) => (
            <motion.div
              key={asset.player.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ delay: index * 0.05 }}
            >
              <AssetCard asset={asset} categoryConfig={categoryConfig[selectedCategory]} />
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Draft Capital */}
      <Card className="bg-gray-800/50 border-gray-700 p-6">
        <div className="flex items-center gap-3 mb-4">
          <DocumentTextIcon className="w-6 h-6 text-blue-400" />
          <h3 className="text-lg font-semibold text-white">Draft Capital</h3>
        </div>
        
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {teamMetrics.draftCapital.map((pick, idx) => (
            <motion.div
              key={idx}
              whileHover={{ scale: 1.02 }}
              className="bg-gray-900/50 rounded-lg p-4"
            >
              <div className="flex items-center justify-between mb-3">
                <h4 className="font-semibold text-white">
                  {pick.year} Round {pick.round}
                </h4>
                <span className="text-sm px-2 py-1 bg-blue-500/20 rounded text-blue-400">
                  Value: {pick.expectedValue}
                </span>
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Star Rate</span>
                  <span className="text-green-400 font-semibold">
                    {(pick.starRate * 100).toFixed(0)}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-400">Bust Rate</span>
                  <span className="text-red-400 font-semibold">
                    {(pick.bustRate * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// Helper component for individual asset cards
function AssetCard({ 
  asset, 
  categoryConfig 
}: { 
  asset: DynastyAsset & { player: Player }; 
  categoryConfig: any;
}) {
  const valueTrend = (asset.futureValue[0] - asset.currentValue) / asset.currentValue;
  const Icon = categoryConfig.icon;

  return (
    <Card className="bg-gray-800/50 border-gray-700 p-4">
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 bg-gradient-to-r ${categoryConfig.color} rounded-lg flex items-center justify-center`}>
            <Icon className="w-5 h-5 text-white" />
          </div>
          <div>
            <h4 className="font-semibold text-white">{asset.player.name}</h4>
            <p className="text-sm text-gray-400">
              {asset.player.position} - {asset.player.team} • Age {asset.player.age}
            </p>
          </div>
        </div>
        
        <div className="text-right">
          <p className="text-lg font-bold text-white">{asset.currentValue.toFixed(0)}</p>
          <div className="flex items-center gap-1">
            {valueTrend > 0 ? (
              <TrendingUpIcon className="w-4 h-4 text-green-400" />
            ) : (
              <TrendingDownIcon className="w-4 h-4 text-red-400" />
            )}
            <span className={`text-sm font-semibold ${
              valueTrend > 0 ? 'text-green-400' : 'text-red-400'
            }`}>
              {valueTrend > 0 ? '+' : ''}{(valueTrend * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div className="bg-gray-900/50 rounded-lg p-2">
          <p className="text-xs text-gray-500">Liquidity</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-blue-500 h-1.5 rounded-full"
                style={{ width: `${asset.liquidity * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-white">
              {(asset.liquidity * 100).toFixed(0)}%
            </span>
          </div>
        </div>
        
        <div className="bg-gray-900/50 rounded-lg p-2">
          <p className="text-xs text-gray-500">Demand</p>
          <div className="flex items-center gap-2 mt-1">
            <div className="flex-1 bg-gray-700 rounded-full h-1.5">
              <div 
                className="bg-yellow-500 h-1.5 rounded-full"
                style={{ width: `${asset.demandScore * 100}%` }}
              />
            </div>
            <span className="text-xs font-semibold text-white">
              {(asset.demandScore * 100).toFixed(0)}%
            </span>
          </div>
        </div>
      </div>
    </Card>
  );
}

// Helper function to calculate demand score
function calculateDemandScore(player: Player): number {
  const positionDemand = { RB: 0.9, WR: 0.85, QB: 0.7, TE: 0.65 }[player.position] || 0.5;
  const ageDemand = player.age < 25 ? 0.9 : player.age < 28 ? 0.8 : player.age < 31 ? 0.6 : 0.3;
  const performanceDemand = player.performanceHistory[0]?.positionRank <= 12 ? 0.9 : 0.6;
  
  return (positionDemand * 0.4 + ageDemand * 0.4 + performanceDemand * 0.2);
}
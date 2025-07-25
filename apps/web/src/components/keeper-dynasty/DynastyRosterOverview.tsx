'use client';

import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  UserGroupIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  CalendarDaysIcon,
  BoltIcon,
  FireIcon,
  ClockIcon,
  ShieldCheckIcon,
  SparklesIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { PlayerValueProjectionChart } from './PlayerValueProjectionChart';
import { Radar, Bar } from 'react-chartjs-2';
import type { Player, TeamMetrics, ChampionshipWindow } from '@/lib/services/traditional-fantasy/keeper-management/types';

interface DynastyRosterOverviewProps {
  roster: Player[];
  teamMetrics: TeamMetrics;
  championshipWindow: ChampionshipWindow;
}

interface PositionGroup {
  position: string;
  players: Player[];
  avgAge: number;
  totalValue: number;
  strengthRating: number;
  depth: 'elite' | 'strong' | 'adequate' | 'weak';
}

export function DynastyRosterOverview({ roster, teamMetrics, championshipWindow }: DynastyRosterOverviewProps) {
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [sortBy, setSortBy] = useState<'position' | 'value' | 'age' | 'keeper'>('position');

  // Group players by position
  const positionGroups = useMemo(() => {
    const groups: Record<string, Player[]> = {};
    roster.forEach(player => {
      if (!groups[player.position]) {
        groups[player.position] = [];
      }
      groups[player.position].push(player);
    });

    return Object.entries(groups).map(([position, players]): PositionGroup => {
      const avgAge = players.reduce((sum, p) => sum + p.age, 0) / players.length;
      const totalValue = players.reduce((sum, p) => {
        const perf = p.performanceHistory[0];
        return sum + (perf ? perf.fantasyPointsPerGame * 10 : 0);
      }, 0);

      // Calculate strength rating
      const topPerformers = players.filter(p => {
        const perf = p.performanceHistory[0];
        return perf && perf.positionRank <= 12;
      }).length;

      let depth: PositionGroup['depth'] = 'weak';
      let strengthRating = 0;

      if (topPerformers >= 2 || (topPerformers >= 1 && players.length >= 3)) {
        depth = 'elite';
        strengthRating = 90;
      } else if (topPerformers >= 1 || players.length >= 3) {
        depth = 'strong';
        strengthRating = 70;
      } else if (players.length >= 2) {
        depth = 'adequate';
        strengthRating = 50;
      } else {
        depth = 'weak';
        strengthRating = 30;
      }

      return {
        position,
        players,
        avgAge,
        totalValue,
        strengthRating,
        depth
      };
    });
  }, [roster]);

  // Sort players
  const sortedRoster = useMemo(() => {
    const sorted = [...roster];
    
    switch (sortBy) {
      case 'value':
        return sorted.sort((a, b) => {
          const aValue = a.performanceHistory[0]?.fantasyPointsPerGame || 0;
          const bValue = b.performanceHistory[0]?.fantasyPointsPerGame || 0;
          return bValue - aValue;
        });
      case 'age':
        return sorted.sort((a, b) => a.age - b.age);
      case 'keeper':
        return sorted.sort((a, b) => {
          const aKeeper = a.draftDetails?.timesKept || 0;
          const bKeeper = b.draftDetails?.timesKept || 0;
          return bKeeper - aKeeper;
        });
      default:
        return sorted.sort((a, b) => {
          const posOrder = ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'];
          return posOrder.indexOf(a.position) - posOrder.indexOf(b.position);
        });
    }
  }, [roster, sortBy]);

  // Calculate roster health metrics
  const rosterHealth = useMemo(() => {
    const avgAge = roster.reduce((sum, p) => sum + p.age, 0) / roster.length;
    const keeperEligible = roster.filter(p => 
      p.draftDetails && p.draftDetails.timesKept < p.draftDetails.keeperEligibleYears
    ).length;
    const injuryProne = roster.filter(p => p.injuryHistory.length > 2).length;
    const elitePlayers = roster.filter(p => {
      const perf = p.performanceHistory[0];
      return perf && perf.positionRank <= 5;
    }).length;

    return {
      avgAge,
      keeperEligible,
      injuryProne,
      elitePlayers,
      youthMovement: roster.filter(p => p.age < 25).length,
      veteranPresence: roster.filter(p => p.age > 30).length
    };
  }, [roster]);

  // Position strength radar chart
  const radarData = {
    labels: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'],
    datasets: [{
      label: 'Position Strength',
      data: ['QB', 'RB', 'WR', 'TE', 'K', 'DEF'].map(pos => {
        const group = positionGroups.find(g => g.position === pos);
        return group?.strengthRating || 0;
      }),
      backgroundColor: 'rgba(251, 191, 36, 0.2)',
      borderColor: 'rgb(251, 191, 36)',
      pointBackgroundColor: 'rgb(251, 191, 36)',
      pointBorderColor: '#fff',
      pointHoverBackgroundColor: '#fff',
      pointHoverBorderColor: 'rgb(251, 191, 36)'
    }]
  };

  const radarOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      r: {
        angleLines: { color: 'rgba(255, 255, 255, 0.1)' },
        grid: { color: 'rgba(255, 255, 255, 0.1)' },
        pointLabels: { color: 'rgba(255, 255, 255, 0.6)' },
        ticks: { 
          color: 'rgba(255, 255, 255, 0.6)',
          beginAtZero: true,
          max: 100
        }
      }
    },
    plugins: {
      legend: { display: false }
    }
  };

  const getDepthColor = (depth: string) => {
    switch (depth) {
      case 'elite': return 'from-green-500 to-green-600';
      case 'strong': return 'from-blue-500 to-blue-600';
      case 'adequate': return 'from-yellow-500 to-yellow-600';
      case 'weak': return 'from-red-500 to-red-600';
      default: return 'from-gray-500 to-gray-600';
    }
  };

  const getPlayerStatusIcon = (player: Player) => {
    const perf = player.performanceHistory[0];
    if (perf && perf.positionRank <= 5) return FireIcon;
    if (player.age < 25) return TrendingUpIcon;
    if (player.age > 30) return ClockIcon;
    if (player.injuryHistory.length > 0) return ExclamationTriangleIcon;
    return CheckCircleIcon;
  };

  const getPlayerStatusColor = (player: Player) => {
    const perf = player.performanceHistory[0];
    if (perf && perf.positionRank <= 5) return 'text-orange-400';
    if (player.age < 25) return 'text-blue-400';
    if (player.age > 30) return 'text-yellow-400';
    if (player.injuryHistory.length > 0) return 'text-red-400';
    return 'text-green-400';
  };

  return (
    <div className="space-y-6">
      {/* Roster Health Overview */}
      <Card className="bg-gradient-to-br from-indigo-900/20 to-gray-900 border-indigo-500/30 p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <UserGroupIcon className="w-8 h-8 text-indigo-400" />
            <div>
              <h2 className="text-2xl font-bold text-white">Dynasty Roster Analysis</h2>
              <p className="text-gray-400">Comprehensive multi-year outlook</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setViewMode(viewMode === 'grid' ? 'list' : 'grid')}
              className="px-3 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm text-gray-300 transition-colors"
            >
              {viewMode === 'grid' ? 'List View' : 'Grid View'}
            </button>
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-4 mb-6">
          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4 text-center"
          >
            <CalendarDaysIcon className="w-6 h-6 text-blue-400 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Avg Age</p>
            <p className="text-xl font-bold text-white">{rosterHealth.avgAge.toFixed(1)}</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4 text-center"
          >
            <FireIcon className="w-6 h-6 text-orange-400 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Elite Players</p>
            <p className="text-xl font-bold text-white">{rosterHealth.elitePlayers}</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4 text-center"
          >
            <ShieldCheckIcon className="w-6 h-6 text-green-400 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Keeper Eligible</p>
            <p className="text-xl font-bold text-white">{rosterHealth.keeperEligible}</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4 text-center"
          >
            <TrendingUpIcon className="w-6 h-6 text-blue-400 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Youth (<25)</p>
            <p className="text-xl font-bold text-white">{rosterHealth.youthMovement}</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4 text-center"
          >
            <ClockIcon className="w-6 h-6 text-yellow-400 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Veterans (30+)</p>
            <p className="text-xl font-bold text-white">{rosterHealth.veteranPresence}</p>
          </motion.div>

          <motion.div
            whileHover={{ scale: 1.05 }}
            className="bg-gray-800/50 rounded-lg p-4 text-center"
          >
            <ExclamationTriangleIcon className="w-6 h-6 text-red-400 mx-auto mb-1" />
            <p className="text-xs text-gray-500">Injury Risk</p>
            <p className="text-xl font-bold text-white">{rosterHealth.injuryProne}</p>
          </motion.div>
        </div>

        {/* Position Strength Radar */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-gray-900/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-400 mb-4">Position Strength Analysis</h4>
            <div className="h-64">
              <Radar data={radarData} options={radarOptions} />
            </div>
          </div>

          <div className="bg-gray-900/50 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-gray-400 mb-4">Position Groups</h4>
            <div className="space-y-3">
              {positionGroups.map(group => (
                <div key={group.position} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-8 bg-gradient-to-b ${getDepthColor(group.depth)} rounded`} />
                    <div>
                      <p className="font-semibold text-white">{group.position}</p>
                      <p className="text-xs text-gray-400">
                        {group.players.length} players • Avg age {group.avgAge.toFixed(1)}
                      </p>
                    </div>
                  </div>
                  <span className={`text-sm font-semibold px-2 py-1 rounded bg-gradient-to-r ${getDepthColor(group.depth)} text-white`}>
                    {group.depth}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Card>

      {/* Sort Controls */}
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Roster Details</h3>
        <div className="flex gap-2">
          {['position', 'value', 'age', 'keeper'].map(sort => (
            <button
              key={sort}
              onClick={() => setSortBy(sort as any)}
              className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                sortBy === sort
                  ? 'bg-indigo-500 text-white'
                  : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
              }`}
            >
              Sort by {sort}
            </button>
          ))}
        </div>
      </div>

      {/* Player Grid/List */}
      {viewMode === 'grid' ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {sortedRoster.map((player, idx) => {
            const StatusIcon = getPlayerStatusIcon(player);
            const statusColor = getPlayerStatusColor(player);
            const perf = player.performanceHistory[0];
            
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
              >
                <Card 
                  className="bg-gray-800/50 border-gray-700 p-4 cursor-pointer hover:border-indigo-500/50 transition-all"
                  onClick={() => setSelectedPlayer(player)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-gray-600 to-gray-700 rounded-full flex items-center justify-center">
                        <span className="text-sm font-bold text-white">{player.position}</span>
                      </div>
                      <div>
                        <h4 className="font-bold text-white">{player.name}</h4>
                        <p className="text-sm text-gray-400">{player.team} • Age {player.age}</p>
                      </div>
                    </div>
                    <StatusIcon className={`w-5 h-5 ${statusColor}`} />
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-gray-900/50 rounded px-2 py-1">
                      <p className="text-xs text-gray-500">PPG</p>
                      <p className="text-sm font-bold text-white">
                        {perf ? perf.fantasyPointsPerGame.toFixed(1) : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-gray-900/50 rounded px-2 py-1">
                      <p className="text-xs text-gray-500">Rank</p>
                      <p className="text-sm font-bold text-white">
                        {perf ? `#${perf.positionRank}` : 'N/A'}
                      </p>
                    </div>
                    <div className="bg-gray-900/50 rounded px-2 py-1">
                      <p className="text-xs text-gray-500">Years</p>
                      <p className="text-sm font-bold text-white">{player.yearsInLeague}</p>
                    </div>
                  </div>

                  {player.draftDetails && (
                    <div className="mt-3 pt-3 border-t border-gray-700/50">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-400">Keeper Status</span>
                        <span className={`font-semibold ${
                          player.draftDetails.timesKept < player.draftDetails.keeperEligibleYears
                            ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {player.draftDetails.timesKept}/{player.draftDetails.keeperEligibleYears} kept
                        </span>
                      </div>
                      {player.draftDetails.timesKept < player.draftDetails.keeperEligibleYears && (
                        <p className="text-xs text-gray-500 mt-1">
                          Round {player.draftDetails.round + (player.draftDetails.keeperRoundPenalty * (player.draftDetails.timesKept + 1))} cost
                        </p>
                      )}
                    </div>
                  )}
                </Card>
              </motion.div>
            );
          })}
        </div>
      ) : (
        <Card className="bg-gray-800/50 border-gray-700 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-900/50">
              <tr>
                <th className="text-left text-sm text-gray-400 p-4">Player</th>
                <th className="text-center text-sm text-gray-400 p-4">Pos</th>
                <th className="text-center text-sm text-gray-400 p-4">Age</th>
                <th className="text-center text-sm text-gray-400 p-4">PPG</th>
                <th className="text-center text-sm text-gray-400 p-4">Rank</th>
                <th className="text-center text-sm text-gray-400 p-4">Keeper</th>
                <th className="text-center text-sm text-gray-400 p-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {sortedRoster.map((player, idx) => {
                const StatusIcon = getPlayerStatusIcon(player);
                const statusColor = getPlayerStatusColor(player);
                const perf = player.performanceHistory[0];
                
                return (
                  <motion.tr
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="border-b border-gray-700/50 hover:bg-gray-700/30 cursor-pointer transition-colors"
                    onClick={() => setSelectedPlayer(player)}
                  >
                    <td className="p-4">
                      <div>
                        <p className="font-semibold text-white">{player.name}</p>
                        <p className="text-xs text-gray-400">{player.team}</p>
                      </div>
                    </td>
                    <td className="text-center p-4">
                      <span className="px-2 py-1 bg-gray-700 rounded text-sm text-white">
                        {player.position}
                      </span>
                    </td>
                    <td className="text-center p-4 text-white">{player.age}</td>
                    <td className="text-center p-4 text-white">
                      {perf ? perf.fantasyPointsPerGame.toFixed(1) : 'N/A'}
                    </td>
                    <td className="text-center p-4">
                      {perf && (
                        <span className={`font-bold ${
                          perf.positionRank <= 5 ? 'text-orange-400' :
                          perf.positionRank <= 12 ? 'text-yellow-400' :
                          'text-gray-400'
                        }`}>
                          #{perf.positionRank}
                        </span>
                      )}
                    </td>
                    <td className="text-center p-4">
                      {player.draftDetails ? (
                        <span className={`text-sm ${
                          player.draftDetails.timesKept < player.draftDetails.keeperEligibleYears
                            ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {player.draftDetails.timesKept}/{player.draftDetails.keeperEligibleYears}
                        </span>
                      ) : (
                        <span className="text-gray-500">N/A</span>
                      )}
                    </td>
                    <td className="text-center p-4">
                      <StatusIcon className={`w-5 h-5 ${statusColor} mx-auto`} />
                    </td>
                  </motion.tr>
                );
              })}
            </tbody>
          </table>
        </Card>
      )}

      {/* Player Detail Modal */}
      <AnimatePresence>
        {selectedPlayer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setSelectedPlayer(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
              onClick={e => e.stopPropagation()}
            >
              <div className="flex items-start justify-between mb-6">
                <div>
                  <h3 className="text-2xl font-bold text-white">{selectedPlayer.name}</h3>
                  <p className="text-gray-400">
                    {selectedPlayer.position} • {selectedPlayer.team} • Age {selectedPlayer.age}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedPlayer(null)}
                  className="text-gray-400 hover:text-white"
                >
                  ✕
                </button>
              </div>

              {/* Player Value Projection */}
              <PlayerValueProjectionChart
                player={selectedPlayer}
                projection={{
                  currentYearValue: 200,
                  threeYearValue: 550,
                  fiveYearValue: 800,
                  careerRemainingValue: 1200,
                  peakValueYear: selectedPlayer.age < 27 ? 2 : 0,
                  declineStartYear: Math.max(0, 30 - selectedPlayer.age),
                  confidenceIntervals: {
                    low: [180, 170, 160, 150, 140],
                    median: [200, 190, 180, 170, 160],
                    high: [220, 210, 200, 190, 180]
                  }
                }}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
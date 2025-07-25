'use client';

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowsRightLeftIcon,
  PlusIcon,
  MinusIcon,
  SparklesIcon,
  ChartBarIcon,
  ExclamationTriangleIcon,
  CheckCircleIcon,
  TrendingUpIcon,
  TrendingDownIcon,
  ScaleIcon,
  ClockIcon,
  FireIcon
} from '@heroicons/react/24/outline';
import { Card } from '@/components/ui/Card';
import { Bar, Line } from 'react-chartjs-2';
import type { 
import { logger } from '../../lib/logging/logger';
  Player, 
  ChampionshipWindow,
  DynastyAsset,
  KeeperEngine 
} from '@/lib/services/traditional-fantasy/keeper-management/types';

interface TradeCalculatorProps {
  roster: Player[];
  championshipWindow: ChampionshipWindow;
  keeperEngine: any; // Using any to avoid circular dependency
}

interface TradeSide {
  players: Player[];
  picks: any[]; // Draft picks
}

interface TradeAnalysis {
  netValueGain: number;
  windowImpact: number;
  riskAdjustedValue: number;
  fairnessScore: number;
  recommendations: string[];
  impactByYear: number[];
  positionImpact: Record<string, number>;
}

export function TradeCalculator({ roster, championshipWindow, keeperEngine }: TradeCalculatorProps) {
  const [giveSide, setGiveSide] = useState<TradeSide>({ players: [], picks: [] });
  const [receiveSide, setReceiveSide] = useState<TradeSide>({ players: [], picks: [] });
  const [analysis, setAnalysis] = useState<TradeAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [showPlayerSearch, setShowPlayerSearch] = useState<'give' | 'receive' | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // Available players (excluding those already in trade)
  const availablePlayersGive = useMemo(() => 
    roster.filter(p => !giveSide.players.find(gp => gp.id === p.id)),
    [roster, giveSide.players]
  );

  // Mock available players to receive (in production, would come from league data)
  const mockReceivablePlayers: Player[] = [
    {
      id: 'r1',
      name: 'Justin Jefferson',
      team: 'MIN',
      position: 'WR',
      age: 24,
      yearsInLeague: 4,
      injuryHistory: [],
      performanceHistory: [
        { year: 2023, gamesPlayed: 17, fantasyPoints: 340, fantasyPointsPerGame: 20, positionRank: 1, consistency: 0.9, clutchPerformance: 0.95 }
      ]
    },
    {
      id: 'r2',
      name: 'Breece Hall',
      team: 'NYJ',
      position: 'RB',
      age: 23,
      yearsInLeague: 2,
      injuryHistory: [],
      performanceHistory: [
        { year: 2023, gamesPlayed: 17, fantasyPoints: 290, fantasyPointsPerGame: 17.1, positionRank: 5, consistency: 0.85, clutchPerformance: 0.88 }
      ]
    }
  ];

  const availablePlayersReceive = useMemo(() => 
    mockReceivablePlayers.filter(p => !receiveSide.players.find(rp => rp.id === p.id)),
    [receiveSide.players]
  );

  // Analyze trade when sides change
  useEffect(() => {
    if (giveSide.players.length > 0 || receiveSide.players.length > 0) {
      analyzeTrade();
    }
  }, [giveSide, receiveSide]);

  const analyzeTrade = async () => {
    setLoading(true);
    try {
      // In production, this would call the actual trade evaluator
      const mockAnalysis: TradeAnalysis = {
        netValueGain: calculateNetValue(),
        windowImpact: calculateWindowImpact(),
        riskAdjustedValue: calculateRiskAdjustedValue(),
        fairnessScore: calculateFairness(),
        recommendations: generateRecommendations(),
        impactByYear: calculateYearlyImpact(),
        positionImpact: calculatePositionImpact()
      };
      
      setAnalysis(mockAnalysis);
    } catch (error) {
      logger.error('Error analyzing trade:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  const calculateNetValue = () => {
    const giveValue = giveSide.players.reduce((sum, p) => {
      const perf = p.performanceHistory[0];
      return sum + (perf ? perf.fantasyPointsPerGame * 10 : 0);
    }, 0);
    
    const receiveValue = receiveSide.players.reduce((sum, p) => {
      const perf = p.performanceHistory[0];
      return sum + (perf ? perf.fantasyPointsPerGame * 10 : 0);
    }, 0);
    
    return receiveValue - giveValue;
  };

  const calculateWindowImpact = () => {
    // Simplified calculation based on age and championship window
    const giveAvgAge = giveSide.players.reduce((sum, p) => sum + p.age, 0) / (giveSide.players.length || 1);
    const receiveAvgAge = receiveSide.players.reduce((sum, p) => sum + p.age, 0) / (receiveSide.players.length || 1);
    
    if (championshipWindow.status === 'competing') {
      return receiveAvgAge < giveAvgAge ? 0.2 : -0.1;
    } else if (championshipWindow.status === 'rebuilding') {
      return receiveAvgAge < giveAvgAge ? 0.3 : -0.2;
    }
    return 0;
  };

  const calculateRiskAdjustedValue = () => {
    const netValue = calculateNetValue();
    const riskFactor = 0.8; // Simplified risk adjustment
    return netValue * riskFactor;
  };

  const calculateFairness = () => {
    const netValue = Math.abs(calculateNetValue());
    const totalValue = giveSide.players.length + receiveSide.players.length;
    if (totalValue === 0) return 0.5;
    
    const fairnessRatio = 1 - (netValue / (totalValue * 100));
    return Math.max(0, Math.min(1, fairnessRatio));
  };

  const generateRecommendations = () => {
    const recommendations: string[] = [];
    const netValue = calculateNetValue();
    const fairness = calculateFairness();
    
    if (netValue > 50) {
      recommendations.push('This trade significantly favors you - great value!');
    } else if (netValue < -50) {
      recommendations.push('You\'re giving up too much value - consider negotiating');
    }
    
    if (fairness > 0.8) {
      recommendations.push('Fair trade that both sides should consider');
    }
    
    if (championshipWindow.status === 'competing' && receiveSide.players.some(p => p.age > 30)) {
      recommendations.push('Adding aging players aligns with win-now strategy');
    }
    
    if (championshipWindow.status === 'rebuilding' && receiveSide.players.some(p => p.age < 25)) {
      recommendations.push('Acquiring young talent fits your rebuilding timeline');
    }
    
    return recommendations;
  };

  const calculateYearlyImpact = () => {
    // Simplified projection over 3 years
    return [
      calculateNetValue(),
      calculateNetValue() * 0.9,
      calculateNetValue() * 0.8
    ];
  };

  const calculatePositionImpact = () => {
    const impact: Record<string, number> = {};
    
    giveSide.players.forEach(p => {
      impact[p.position] = (impact[p.position] || 0) - 1;
    });
    
    receiveSide.players.forEach(p => {
      impact[p.position] = (impact[p.position] || 0) + 1;
    });
    
    return impact;
  };

  const addPlayerToSide = (player: Player, side: 'give' | 'receive') => {
    if (side === 'give') {
      setGiveSide(prev => ({ ...prev, players: [...prev.players, player] }));
    } else {
      setReceiveSide(prev => ({ ...prev, players: [...prev.players, player] }));
    }
    setShowPlayerSearch(null);
    setSearchQuery('');
  };

  const removePlayerFromSide = (playerId: string, side: 'give' | 'receive') => {
    if (side === 'give') {
      setGiveSide(prev => ({ 
        ...prev, 
        players: prev.players.filter(p => p.id !== playerId) 
      }));
    } else {
      setReceiveSide(prev => ({ 
        ...prev, 
        players: prev.players.filter(p => p.id !== playerId) 
      }));
    }
  };

  const getTradeGrade = (netValue: number, fairness: number) => {
    if (netValue > 100 && fairness > 0.6) return { grade: 'A+', color: 'text-green-400' };
    if (netValue > 50 && fairness > 0.6) return { grade: 'A', color: 'text-green-400' };
    if (netValue > 25 && fairness > 0.5) return { grade: 'B+', color: 'text-blue-400' };
    if (netValue > 0 && fairness > 0.5) return { grade: 'B', color: 'text-blue-400' };
    if (netValue > -25 && fairness > 0.4) return { grade: 'C', color: 'text-yellow-400' };
    if (netValue > -50) return { grade: 'D', color: 'text-orange-400' };
    return { grade: 'F', color: 'text-red-400' };
  };

  return (
    <div className="space-y-6">
      {/* Trade Interface */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Give Side */}
        <Card className="bg-gradient-to-br from-red-900/20 to-gray-900 border-red-500/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <MinusIcon className="w-5 h-5 text-red-400" />
              You Give
            </h3>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPlayerSearch('give')}
              className="px-3 py-1 bg-red-500/20 hover:bg-red-500/30 rounded-lg text-red-400 font-medium transition-colors"
            >
              <PlusIcon className="w-4 h-4 inline mr-1" />
              Add Player
            </motion.button>
          </div>

          <div className="space-y-3">
            {giveSide.players.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No players selected</p>
            ) : (
              giveSide.players.map(player => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="bg-gray-800/50 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-semibold text-white">{player.name}</h4>
                    <p className="text-sm text-gray-400">
                      {player.position} - {player.team} • Age {player.age}
                    </p>
                  </div>
                  <button
                    onClick={() => removePlayerFromSide(player.id, 'give')}
                    className="text-red-400 hover:text-red-300"
                  >
                    <MinusIcon className="w-5 h-5" />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </Card>

        {/* Receive Side */}
        <Card className="bg-gradient-to-br from-green-900/20 to-gray-900 border-green-500/30 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <PlusIcon className="w-5 h-5 text-green-400" />
              You Receive
            </h3>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setShowPlayerSearch('receive')}
              className="px-3 py-1 bg-green-500/20 hover:bg-green-500/30 rounded-lg text-green-400 font-medium transition-colors"
            >
              <PlusIcon className="w-4 h-4 inline mr-1" />
              Add Player
            </motion.button>
          </div>

          <div className="space-y-3">
            {receiveSide.players.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No players selected</p>
            ) : (
              receiveSide.players.map(player => (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="bg-gray-800/50 rounded-lg p-4 flex items-center justify-between"
                >
                  <div>
                    <h4 className="font-semibold text-white">{player.name}</h4>
                    <p className="text-sm text-gray-400">
                      {player.position} - {player.team} • Age {player.age}
                    </p>
                  </div>
                  <button
                    onClick={() => removePlayerFromSide(player.id, 'receive')}
                    className="text-red-400 hover:text-red-300"
                  >
                    <MinusIcon className="w-5 h-5" />
                  </button>
                </motion.div>
              ))
            )}
          </div>
        </Card>
      </div>

      {/* Trade Analysis */}
      {analysis && (giveSide.players.length > 0 || receiveSide.players.length > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <Card className="bg-gray-800/50 border-gray-700 p-6">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <ScaleIcon className="w-6 h-6 text-blue-400" />
                <h3 className="text-xl font-bold text-white">Trade Analysis</h3>
              </div>

              {/* Trade Grade */}
              {(() => {
                const grade = getTradeGrade(analysis.netValueGain, analysis.fairnessScore);
                return (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="text-center"
                  >
                    <p className="text-sm text-gray-400">Trade Grade</p>
                    <p className={`text-4xl font-bold ${grade.color}`}>
                      {grade.grade}
                    </p>
                  </motion.div>
                );
              })()}
            </div>

            {/* Key Metrics */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gray-900/50 rounded-lg p-4 text-center"
              >
                <p className="text-sm text-gray-500 mb-1">Net Value</p>
                <div className="flex items-center justify-center gap-1">
                  {analysis.netValueGain > 0 ? (
                    <TrendingUpIcon className="w-5 h-5 text-green-400" />
                  ) : (
                    <TrendingDownIcon className="w-5 h-5 text-red-400" />
                  )}
                  <p className={`text-2xl font-bold ${
                    analysis.netValueGain > 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {analysis.netValueGain > 0 ? '+' : ''}{analysis.netValueGain.toFixed(0)}
                  </p>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gray-900/50 rounded-lg p-4 text-center"
              >
                <p className="text-sm text-gray-500 mb-1">Window Impact</p>
                <div className="flex items-center justify-center gap-1">
                  {analysis.windowImpact > 0 ? (
                    <FireIcon className="w-5 h-5 text-orange-400" />
                  ) : (
                    <ClockIcon className="w-5 h-5 text-blue-400" />
                  )}
                  <p className={`text-2xl font-bold ${
                    analysis.windowImpact > 0 ? 'text-orange-400' : 'text-blue-400'
                  }`}>
                    {analysis.windowImpact > 0 ? '+' : ''}{(analysis.windowImpact * 100).toFixed(0)}%
                  </p>
                </div>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gray-900/50 rounded-lg p-4 text-center"
              >
                <p className="text-sm text-gray-500 mb-1">Risk Adjusted</p>
                <p className="text-2xl font-bold text-purple-400">
                  {analysis.riskAdjustedValue.toFixed(0)}
                </p>
              </motion.div>

              <motion.div
                whileHover={{ scale: 1.05 }}
                className="bg-gray-900/50 rounded-lg p-4 text-center"
              >
                <p className="text-sm text-gray-500 mb-1">Fairness</p>
                <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                  <div 
                    className={`h-2 rounded-full transition-all ${
                      analysis.fairnessScore > 0.8 ? 'bg-green-500' :
                      analysis.fairnessScore > 0.6 ? 'bg-yellow-500' :
                      'bg-red-500'
                    }`}
                    style={{ width: `${analysis.fairnessScore * 100}%` }}
                  />
                </div>
              </motion.div>
            </div>

            {/* AI Recommendations */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-gray-400 mb-3 flex items-center gap-2">
                <SparklesIcon className="w-4 h-4 text-purple-400" />
                AI Recommendations
              </h4>
              <div className="space-y-2">
                {analysis.recommendations.map((rec, idx) => (
                  <motion.div
                    key={idx}
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    transition={{ delay: idx * 0.1 }}
                    className="flex items-start gap-2"
                  >
                    <CheckCircleIcon className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-300">{rec}</p>
                  </motion.div>
                ))}
              </div>
            </div>

            {/* Position Impact */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-gray-900/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">Position Impact</h4>
                <div className="space-y-2">
                  {Object.entries(analysis.positionImpact).map(([pos, impact]) => (
                    <div key={pos} className="flex items-center justify-between">
                      <span className="text-sm text-gray-300">{pos}</span>
                      <div className="flex items-center gap-2">
                        {impact > 0 ? (
                          <ArrowTrendingUpIcon className="w-4 h-4 text-green-400" />
                        ) : (
                          <ArrowTrendingDownIcon className="w-4 h-4 text-red-400" />
                        )}
                        <span className={`text-sm font-semibold ${
                          impact > 0 ? 'text-green-400' : 'text-red-400'
                        }`}>
                          {impact > 0 ? '+' : ''}{impact}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-gray-900/50 rounded-lg p-4">
                <h4 className="text-sm font-semibold text-gray-400 mb-3">3-Year Projection</h4>
                <div className="h-32">
                  <Line
                    data={{
                      labels: ['Year 1', 'Year 2', 'Year 3'],
                      datasets: [{
                        label: 'Value Impact',
                        data: analysis.impactByYear,
                        borderColor: analysis.impactByYear[0] > 0 ? 'rgb(34, 197, 94)' : 'rgb(239, 68, 68)',
                        backgroundColor: analysis.impactByYear[0] > 0 ? 'rgba(34, 197, 94, 0.2)' : 'rgba(239, 68, 68, 0.2)',
                        tension: 0.4
                      }]
                    }}
                    options={{
                      responsive: true,
                      maintainAspectRatio: false,
                      plugins: { legend: { display: false } },
                      scales: {
                        x: { 
                          grid: { color: 'rgba(255, 255, 255, 0.1)' },
                          ticks: { color: 'rgba(255, 255, 255, 0.6)' }
                        },
                        y: { 
                          grid: { color: 'rgba(255, 255, 255, 0.1)' },
                          ticks: { color: 'rgba(255, 255, 255, 0.6)' }
                        }
                      }
                    }}
                  />
                </div>
              </div>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Player Search Modal */}
      <AnimatePresence>
        {showPlayerSearch && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
            onClick={() => setShowPlayerSearch(null)}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-gray-800 rounded-xl p-6 max-w-md w-full max-h-[80vh] overflow-hidden"
              onClick={e => e.stopPropagation()}
            >
              <h3 className="text-lg font-bold text-white mb-4">
                Add Player to {showPlayerSearch === 'give' ? 'Give' : 'Receive'}
              </h3>
              
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search players..."
                className="w-full px-4 py-2 bg-gray-900 border border-gray-700 rounded-lg text-white placeholder-gray-500 mb-4"
                autoFocus
              />

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {(showPlayerSearch === 'give' ? availablePlayersGive : availablePlayersReceive)
                  .filter(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
                  .map(player => (
                    <motion.button
                      key={player.id}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => addPlayerToSide(player, showPlayerSearch)}
                      className="w-full bg-gray-700 hover:bg-gray-600 rounded-lg p-3 text-left transition-colors"
                    >
                      <h4 className="font-semibold text-white">{player.name}</h4>
                      <p className="text-sm text-gray-400">
                        {player.position} - {player.team} • Age {player.age}
                      </p>
                    </motion.button>
                  ))
                }
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
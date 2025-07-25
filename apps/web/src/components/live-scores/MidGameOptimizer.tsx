'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  TrendingUp, 
  TrendingDown, 
  RefreshCw, 
  AlertTriangle, 
  Zap, 
  Target, 
  DollarSign,
  Clock,
  Users,
  Activity
} from 'lucide-react';

// Types
interface LivePlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  salary: number;
  fantasyPoints: number;
  projectedPoints: number;
  ownership: number;
  gameStatus: 'pre' | 'live' | 'final';
  minutesRemaining: number;
  isInjured: boolean;
  recentTrend: 'up' | 'down' | 'neutral';
  leverage: number;
  ceiling: number;
  floor: number;
  volatility: number;
}

interface LineupPosition {
  position: string;
  player: LivePlayer | null;
  salary: number;
  isFlexible: boolean;
}

interface OptimizationStrategy {
  name: string;
  description: string;
  weightings: {
    projection: number;
    ownership: number;
    ceiling: number;
    leverage: number;
    gameScript: number;
  };
}

interface LineupRecommendation {
  type: 'swap' | 'pivot' | 'stack' | 'fade';
  title: string;
  description: string;
  currentPlayer?: LivePlayer;
  recommendedPlayer: LivePlayer;
  reasoning: string;
  projectedImpact: number;
  confidence: number;
  urgency: 'high' | 'medium' | 'low';
}

// Mock data
const mockPlayers: LivePlayer[] = [
  {
    id: '1',
    name: 'Josh Allen',
    team: 'BUF',
    position: 'QB',
    salary: 8800,
    fantasyPoints: 18.4,
    projectedPoints: 22.8,
    ownership: 23.4,
    gameStatus: 'live',
    minutesRemaining: 35,
    isInjured: false,
    recentTrend: 'up',
    leverage: 85.2,
    ceiling: 35.2,
    floor: 15.8,
    volatility: 0.78
  },
  {
    id: '2',
    name: 'Patrick Mahomes',
    team: 'KC',
    position: 'QB',
    salary: 9200,
    fantasyPoints: 21.6,
    projectedPoints: 25.2,
    ownership: 28.1,
    gameStatus: 'live',
    minutesRemaining: 35,
    isInjured: false,
    recentTrend: 'up',
    leverage: 78.9,
    ceiling: 38.5,
    floor: 18.2,
    volatility: 0.82
  },
  {
    id: '3',
    name: 'Lamar Jackson',
    team: 'BAL',
    position: 'QB',
    salary: 8600,
    fantasyPoints: 8.2,
    projectedPoints: 24.5,
    ownership: 15.2,
    gameStatus: 'pre',
    minutesRemaining: 60,
    isInjured: false,
    recentTrend: 'neutral',
    leverage: 92.4,
    ceiling: 42.1,
    floor: 12.5,
    volatility: 0.95
  }
];

const optimizationStrategies: OptimizationStrategy[] = [
  {
    name: 'Cash Game Safe',
    description: 'High floor, consistent scoring',
    weightings: {
      projection: 0.4,
      ownership: 0.1,
      ceiling: 0.2,
      leverage: 0.1,
      gameScript: 0.2
    }
  },
  {
    name: 'GPP Ceiling',
    description: 'Maximum upside potential',
    weightings: {
      projection: 0.2,
      ownership: 0.15,
      ceiling: 0.4,
      leverage: 0.15,
      gameScript: 0.1
    }
  },
  {
    name: 'Leverage Play',
    description: 'Low ownership, high upside',
    weightings: {
      projection: 0.25,
      ownership: 0.3,
      ceiling: 0.25,
      leverage: 0.15,
      gameScript: 0.05
    }
  },
  {
    name: 'Live Momentum',
    description: 'Capitalize on game script',
    weightings: {
      projection: 0.15,
      ownership: 0.1,
      ceiling: 0.2,
      leverage: 0.1,
      gameScript: 0.45
    }
  }
];

interface MidGameOptimizerProps {
  isOpen: boolean;
  onClose: () => void;
  currentLineup?: LineupPosition[];
}

export default function MidGameOptimizer({ isOpen, onClose, currentLineup }: MidGameOptimizerProps) {
  // State
  const [lineup, setLineup] = useState<LineupPosition[]>([
    { position: 'QB', player: null, salary: 0, isFlexible: false },
    { position: 'RB', player: null, salary: 0, isFlexible: false },
    { position: 'RB', player: null, salary: 0, isFlexible: false },
    { position: 'WR', player: null, salary: 0, isFlexible: false },
    { position: 'WR', player: null, salary: 0, isFlexible: false },
    { position: 'WR', player: null, salary: 0, isFlexible: false },
    { position: 'TE', player: null, salary: 0, isFlexible: false },
    { position: 'FLEX', player: null, salary: 0, isFlexible: true },
    { position: 'DST', player: null, salary: 0, isFlexible: false }
  ]);
  
  const [selectedStrategy, setSelectedStrategy] = useState<OptimizationStrategy>(optimizationStrategies[0]);
  const [autoOptimize, setAutoOptimize] = useState(false);
  const [riskTolerance, setRiskTolerance] = useState([50]);
  const [salaryCap] = useState(50000);
  const [recommendations, setRecommendations] = useState<LineupRecommendation[]>([]);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [showOnlyLive, setShowOnlyLive] = useState(true);
  const [lockOptimal, setLockOptimal] = useState(true);

  // Computed values
  const totalSalary = useMemo(() => {
    return lineup.reduce((sum, pos) => sum + (pos.player?.salary || 0), 0);
  }, [lineup]);

  const totalFantasyPoints = useMemo(() => {
    return lineup.reduce((sum, pos) => sum + (pos.player?.fantasyPoints || 0), 0);
  }, [lineup]);

  const projectedPoints = useMemo(() => {
    return lineup.reduce((sum, pos) => sum + (pos.player?.projectedPoints || 0), 0);
  }, [lineup]);

  const averageOwnership = useMemo(() => {
    const players = lineup.filter(pos => pos.player).map(pos => pos.player!);
    if (players.length === 0) return 0;
    return players.reduce((sum, player) => sum + player.ownership, 0) / players.length;
  }, [lineup]);

  const lineupScore = useMemo(() => {
    const weights = selectedStrategy.weightings;
    const players = lineup.filter(pos => pos.player).map(pos => pos.player!);
    
    if (players.length === 0) return 0;
    
    const avgProjection = players.reduce((sum, p) => sum + p.projectedPoints, 0) / players.length;
    const avgOwnership = players.reduce((sum, p) => sum + p.ownership, 0) / players.length;
    const avgCeiling = players.reduce((sum, p) => sum + p.ceiling, 0) / players.length;
    const avgLeverage = players.reduce((sum, p) => sum + p.leverage, 0) / players.length;
    
    return (
      avgProjection * weights.projection +
      (100 - avgOwnership) * weights.ownership +
      avgCeiling * weights.ceiling +
      avgLeverage * weights.leverage
    );
  }, [lineup, selectedStrategy]);

  // Generate recommendations
  useEffect(() => {
    const generateRecommendations = () => {
      const recs: LineupRecommendation[] = [];
      
      // Find injury pivots
      lineup.forEach((pos, index) => {
        if (pos.player?.isInjured) {
          const alternatives = mockPlayers.filter(p => 
            p.position === pos.position && 
            !p.isInjured && 
            p.id !== pos.player?.id
          );
          
          if (alternatives.length > 0) {
            const bestAlternative = alternatives.sort((a, b) => b.projectedPoints - a.projectedPoints)[0];
            recs.push({
              type: 'swap',
              title: 'Injury Pivot Required',
              description: `${pos.player.name} is injured`,
              currentPlayer: pos.player,
              recommendedPlayer: bestAlternative,
              reasoning: 'Player is injured and unlikely to return',
              projectedImpact: bestAlternative.projectedPoints - pos.player.projectedPoints,
              confidence: 95,
              urgency: 'high'
            });
          }
        }
      });

      // Find leverage opportunities
      const lowOwnedPlayers = mockPlayers
        .filter(p => p.ownership < 15 && p.gameStatus === 'live' && p.leverage > 80)
        .sort((a, b) => b.leverage - a.leverage)
        .slice(0, 3);

      lowOwnedPlayers.forEach(player => {
        const currentPlayer = lineup.find(pos => pos.position === player.position)?.player;
        if (currentPlayer && player.leverage > currentPlayer.leverage + 10) {
          recs.push({
            type: 'pivot',
            title: 'High Leverage Opportunity',
            description: `${player.name} has exceptional leverage`,
            currentPlayer,
            recommendedPlayer: player,
            reasoning: `Only ${player.ownership}% owned with ${player.leverage} leverage score`,
            projectedImpact: player.projectedPoints - currentPlayer.projectedPoints,
            confidence: 78,
            urgency: 'medium'
          });
        }
      });

      // Find game script pivots
      const momentumPlayers = mockPlayers
        .filter(p => p.recentTrend === 'up' && p.gameStatus === 'live')
        .sort((a, b) => b.fantasyPoints - a.fantasyPoints)
        .slice(0, 2);

      momentumPlayers.forEach(player => {
        recs.push({
          type: 'stack',
          title: 'Live Game Momentum',
          description: `${player.name} is trending up`,
          recommendedPlayer: player,
          reasoning: `Currently outperforming by ${(player.fantasyPoints / player.projectedPoints * 100 - 100).toFixed(1)}%`,
          projectedImpact: 2.5,
          confidence: 65,
          urgency: 'low'
        });
      });

      setRecommendations(recs.sort((a, b) => {
        const urgencyWeight = { high: 3, medium: 2, low: 1 };
        return (urgencyWeight[b.urgency] * b.confidence) - (urgencyWeight[a.urgency] * a.confidence);
      }));
    };

    generateRecommendations();
  }, [lineup, selectedStrategy]);

  // Auto-optimize
  useEffect(() => {
    if (autoOptimize) {
      const interval = setInterval(() => {
        optimizeLineup();
      }, 60000); // Every minute

      return () => clearInterval(interval);
    }
  }, [autoOptimize]);

  const optimizeLineup = async () => {
    setIsOptimizing(true);
    
    // Simulate optimization delay
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // Simple optimization logic (would be more complex in real implementation)
    const newLineup = [...lineup];
    const availablePlayers = mockPlayers.filter(p => 
      showOnlyLive ? p.gameStatus === 'live' : true
    );

    // Fill empty positions with best available players
    newLineup.forEach((pos, index) => {
      if (!pos.player) {
        const candidates = availablePlayers.filter(p => 
          p.position === pos.position || (pos.isFlexible && ['RB', 'WR', 'TE'].includes(p.position))
        );
        
        if (candidates.length > 0) {
          const best = candidates.sort((a, b) => {
            const scoreA = calculatePlayerScore(a, selectedStrategy);
            const scoreB = calculatePlayerScore(b, selectedStrategy);
            return scoreB - scoreA;
          })[0];
          
          newLineup[index] = { ...pos, player: best, salary: best.salary };
        }
      }
    });

    setLineup(newLineup);
    setIsOptimizing(false);
  };

  const calculatePlayerScore = (player: LivePlayer, strategy: OptimizationStrategy): number => {
    const weights = strategy.weightings;
    return (
      player.projectedPoints * weights.projection +
      (100 - player.ownership) * weights.ownership +
      player.ceiling * weights.ceiling +
      player.leverage * weights.leverage +
      (player.gameStatus === 'live' ? 10 : 0) * weights.gameScript
    );
  };

  const applyRecommendation = (rec: LineupRecommendation) => {
    if (rec.type === 'swap' && rec.currentPlayer) {
      const newLineup = lineup.map(pos => 
        pos.player?.id === rec.currentPlayer?.id 
          ? { ...pos, player: rec.recommendedPlayer, salary: rec.recommendedPlayer.salary }
          : pos
      );
      setLineup(newLineup);
    }
    
    // Remove applied recommendation
    setRecommendations(prev => prev.filter(r => r !== rec));
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case 'up': return <TrendingUp className="w-4 h-4 text-green-500" />;
      case 'down': return <TrendingDown className="w-4 h-4 text-red-500" />;
      default: return <Activity className="w-4 h-4 text-gray-500" />;
    }
  };

  const getUrgencyColor = (urgency: string) => {
    switch (urgency) {
      case 'high': return 'border-red-500 bg-red-50';
      case 'medium': return 'border-yellow-500 bg-yellow-50';
      case 'low': return 'border-blue-500 bg-blue-50';
      default: return 'border-gray-300 bg-gray-50';
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-6 border-b">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-2xl font-bold">Mid-Game Lineup Optimizer</h2>
              <p className="text-gray-600">Real-time lineup optimization based on live game data</p>
            </div>
            <Button variant="outline" onClick={onClose}>Close</Button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Lineup Panel */}
            <div className="lg:col-span-2 space-y-6">
              {/* Lineup Summary */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Current Lineup</span>
                    <div className="flex items-center gap-2">
                      <Badge variant={totalSalary > salaryCap ? 'destructive' : 'default'}>
                        ${totalSalary.toLocaleString()} / ${salaryCap.toLocaleString()}
                      </Badge>
                      <Badge variant="outline">{totalFantasyPoints.toFixed(1)} pts</Badge>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="text-center">
                      <div className="text-2xl font-bold text-green-600">{projectedPoints.toFixed(1)}</div>
                      <div className="text-sm text-gray-500">Projected</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">{averageOwnership.toFixed(1)}%</div>
                      <div className="text-sm text-gray-500">Avg Ownership</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold text-blue-600">{lineupScore.toFixed(1)}</div>
                      <div className="text-sm text-gray-500">Lineup Score</div>
                    </div>
                    <div className="text-center">
                      <div className="text-2xl font-bold">
                        {lineup.filter(p => p.player?.gameStatus === 'live').length}
                      </div>
                      <div className="text-sm text-gray-500">Live Games</div>
                    </div>
                  </div>

                  <Progress value={(totalSalary / salaryCap) * 100} className="mb-4" />

                  {/* Lineup Positions */}
                  <div className="space-y-2">
                    {lineup.map((pos, index) => (
                      <div key={index} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <div className="flex items-center gap-3">
                          <div className="w-12 text-sm font-semibold text-center">
                            {pos.position}
                          </div>
                          <div>
                            {pos.player ? (
                              <>
                                <div className="font-semibold flex items-center gap-2">
                                  {pos.player.name}
                                  {getTrendIcon(pos.player.recentTrend)}
                                  {pos.player.isInjured && (
                                    <AlertTriangle className="w-4 h-4 text-red-500" />
                                  )}
                                </div>
                                <div className="text-sm text-gray-600">
                                  {pos.player.team} • {pos.player.fantasyPoints.toFixed(1)} pts • 
                                  {pos.player.ownership.toFixed(1)}% owned
                                </div>
                              </>
                            ) : (
                              <div className="text-gray-400">Empty</div>
                            )}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="font-semibold">${pos.player?.salary.toLocaleString() || '0'}</div>
                          {pos.player && (
                            <div className="text-sm text-gray-600">
                              {pos.player.minutesRemaining}min left
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Recommendations */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Zap className="w-5 h-5" />
                    Live Recommendations
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {recommendations.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">
                      No recommendations at this time
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {recommendations.map((rec, index) => (
                        <div 
                          key={index} 
                          className={`p-4 rounded-lg border-l-4 ${getUrgencyColor(rec.urgency)}`}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <div>
                              <div className="font-semibold">{rec.title}</div>
                              <div className="text-sm text-gray-600">{rec.description}</div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge variant={rec.urgency === 'high' ? 'destructive' : 'default'}>
                                {rec.confidence}% confidence
                              </Badge>
                              <Button size="sm" onClick={() => applyRecommendation(rec)}>
                                Apply
                              </Button>
                            </div>
                          </div>
                          <div className="text-sm">
                            <div className="font-medium">{rec.recommendedPlayer.name}</div>
                            <div className="text-gray-600">{rec.reasoning}</div>
                            <div className="flex items-center gap-4 mt-1">
                              <span>Impact: {rec.projectedImpact > 0 ? '+' : ''}{rec.projectedImpact.toFixed(1)} pts</span>
                              <span>Salary: ${rec.recommendedPlayer.salary.toLocaleString()}</span>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Settings Panel */}
            <div className="space-y-6">
              {/* Optimization Settings */}
              <Card>
                <CardHeader>
                  <CardTitle>Optimization Settings</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Strategy Selection */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">Strategy</label>
                    <select
                      className="w-full p-2 border rounded-md"
                      value={selectedStrategy.name}
                      onChange={(e) => {
                        const strategy = optimizationStrategies.find(s => s.name === e.target.value);
                        if (strategy) setSelectedStrategy(strategy);
                      }}
                    >
                      {optimizationStrategies.map(strategy => (
                        <option key={strategy.name} value={strategy.name}>
                          {strategy.name}
                        </option>
                      ))}
                    </select>
                    <p className="text-xs text-gray-500 mt-1">{selectedStrategy.description}</p>
                  </div>

                  {/* Risk Tolerance */}
                  <div>
                    <label className="text-sm font-medium mb-2 block">
                      Risk Tolerance: {riskTolerance[0]}%
                    </label>
                    <Slider
                      value={riskTolerance}
                      onValueChange={setRiskTolerance}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  {/* Options */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Auto-Optimize</label>
                      <Switch checked={autoOptimize} onCheckedChange={setAutoOptimize} />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Show Only Live Games</label>
                      <Switch checked={showOnlyLive} onCheckedChange={setShowOnlyLive} />
                    </div>
                    <div className="flex items-center justify-between">
                      <label className="text-sm font-medium">Lock Optimal Players</label>
                      <Switch checked={lockOptimal} onCheckedChange={setLockOptimal} />
                    </div>
                  </div>

                  {/* Optimize Button */}
                  <Button 
                    className="w-full" 
                    onClick={optimizeLineup} 
                    disabled={isOptimizing}
                  >
                    {isOptimizing ? (
                      <>
                        <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                        Optimizing...
                      </>
                    ) : (
                      <>
                        <Target className="w-4 h-4 mr-2" />
                        Optimize Lineup
                      </>
                    )}
                  </Button>
                </CardContent>
              </Card>

              {/* Live Game Status */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="w-5 h-5" />
                    Game Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Live Games</span>
                      <Badge variant="default">
                        {mockPlayers.filter(p => p.gameStatus === 'live').length}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Pre-Game</span>
                      <Badge variant="outline">
                        {mockPlayers.filter(p => p.gameStatus === 'pre').length}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-sm">Final</span>
                      <Badge variant="secondary">
                        {mockPlayers.filter(p => p.gameStatus === 'final').length}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Quick Stats */}
              <Card>
                <CardHeader>
                  <CardTitle>Quick Stats</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-sm">Salary Remaining</span>
                      <span className="font-semibold">
                        ${(salaryCap - totalSalary).toLocaleString()}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Lineup Filled</span>
                      <span className="font-semibold">
                        {lineup.filter(p => p.player).length}/9
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm">Injured Players</span>
                      <span className="font-semibold text-red-600">
                        {lineup.filter(p => p.player?.isInjured).length}
                      </span>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
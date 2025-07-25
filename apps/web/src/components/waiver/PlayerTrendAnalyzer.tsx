'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Activity,
  Target,
  Fire,
  Eye,
  Users,
  Calendar,
  BarChart3,
  ArrowUp,
  ArrowDown,
  Minus
} from 'lucide-react';

interface TrendingPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  ownership: number;
  ownershipChange: number;
  trendScore: number;
  momentumScore: number;
  projectedPoints: number;
  recentPerformance: number[];
  targetShare: number;
  redZoneTargets: number;
  snapShare: number;
  injuryRisk: number;
  scheduleStrength: number;
  faabValue: number;
  buzzScore: number;
  searchVolume: number;
  weeklyTrend: { week: number; points: number; usage: number }[];
}

interface PlayerTrendAnalyzerProps {
  players: TrendingPlayer[];
  onClaim: (playerId: string, bidAmount: number, dropPlayerId?: string) => void;
}

export const PlayerTrendAnalyzer: React.FC<PlayerTrendAnalyzerProps> = ({
  players,
  onClaim
}) => {
  const [sortBy, setSortBy] = useState<'trendScore' | 'momentum' | 'ownership' | 'buzz'>('trendScore');
  const [filterBy, setFilterBy] = useState<'all' | 'rising' | 'falling' | 'breakout'>('all');
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [timeframe, setTimeframe] = useState<'1week' | '2week' | '4week'>('2week');

  const getPositionColor = (position: string) => {
    const colors = {
      QB: 'bg-red-500/20 text-red-300 border-red-500/30',
      RB: 'bg-green-500/20 text-green-300 border-green-500/30',
      WR: 'bg-blue-500/20 text-blue-300 border-blue-500/30',
      TE: 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30',
      K: 'bg-purple-500/20 text-purple-300 border-purple-500/30',
      DST: 'bg-gray-500/20 text-gray-300 border-gray-500/30'
    };
    return colors[position as keyof typeof colors] || colors.QB;
  };

  const getTrendIcon = (trendScore: number) => {
    if (trendScore > 75) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (trendScore < 25) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Activity className="w-4 h-4 text-yellow-400" />;
  };

  const getOwnershipTrend = (change: number) => {
    if (change > 5) return { icon: <ArrowUp className="w-3 h-3 text-green-400" />, color: 'text-green-400' };
    if (change < -5) return { icon: <ArrowDown className="w-3 h-3 text-red-400" />, color: 'text-red-400' };
    return { icon: <Minus className="w-3 h-3 text-yellow-400" />, color: 'text-yellow-400' };
  };

  const getMomentumBadge = (momentum: number) => {
    if (momentum > 80) return <Badge className="bg-green-500/20 text-green-300 border-green-500/30">🚀 Hot</Badge>;
    if (momentum > 60) return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">📈 Rising</Badge>;
    if (momentum < 30) return <Badge className="bg-red-500/20 text-red-300 border-red-500/30">📉 Cooling</Badge>;
    return null;
  };

  const getBuzzLevel = (buzzScore: number) => {
    if (buzzScore > 80) return { level: 'Viral', color: 'text-red-400', icon: <Fire className="w-3 h-3" /> };
    if (buzzScore > 60) return { level: 'High', color: 'text-orange-400', icon: <Eye className="w-3 h-3" /> };
    if (buzzScore > 40) return { level: 'Medium', color: 'text-yellow-400', icon: <Users className="w-3 h-3" /> };
    return { level: 'Low', color: 'text-slate-400', icon: <Activity className="w-3 h-3" /> };
  };

  const filteredAndSortedPlayers = players
    .filter(player => {
      switch (filterBy) {
        case 'rising':
          return player.trendScore > 60 && player.ownershipChange > 2;
        case 'falling':
          return player.trendScore < 40 && player.ownershipChange < -2;
        case 'breakout':
          return player.momentumScore > 70 && player.ownership < 50;
        default:
          return true;
      }
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'momentum':
          return b.momentumScore - a.momentumScore;
        case 'ownership':
          return b.ownershipChange - a.ownershipChange;
        case 'buzz':
          return b.buzzScore - a.buzzScore;
        default:
          return b.trendScore - a.trendScore;
      }
    });

  const handleClaimPlayer = (player: TrendingPlayer) => {
    onClaim(player.id, player.faabValue);
  };

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-purple-400" />
            Player Trend Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={sortBy === 'trendScore' ? 'default' : 'outline'}
                onClick={() => setSortBy('trendScore')}
              >
                Trend Score
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'momentum' ? 'default' : 'outline'}
                onClick={() => setSortBy('momentum')}
              >
                Momentum
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'ownership' ? 'default' : 'outline'}
                onClick={() => setSortBy('ownership')}
              >
                Ownership Δ
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'buzz' ? 'default' : 'outline'}
                onClick={() => setSortBy('buzz')}
              >
                Buzz Score
              </Button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={filterBy === 'all' ? 'default' : 'outline'}
                onClick={() => setFilterBy('all')}
              >
                All Players
              </Button>
              <Button
                size="sm"
                variant={filterBy === 'rising' ? 'default' : 'outline'}
                onClick={() => setFilterBy('rising')}
                className="text-green-400"
              >
                📈 Rising
              </Button>
              <Button
                size="sm"
                variant={filterBy === 'falling' ? 'default' : 'outline'}
                onClick={() => setFilterBy('falling')}
                className="text-red-400"
              >
                📉 Falling
              </Button>
              <Button
                size="sm"
                variant={filterBy === 'breakout' ? 'default' : 'outline'}
                onClick={() => setFilterBy('breakout')}
                className="text-yellow-400"
              >
                🚀 Breakout
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Trending Players Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredAndSortedPlayers.map((player) => {
          const ownershipTrend = getOwnershipTrend(player.ownershipChange);
          const buzzLevel = getBuzzLevel(player.buzzScore);
          
          return (
            <Card key={player.id} className="bg-slate-800/50 border-purple-500/20 hover:border-purple-400/40 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      {player.name}
                      {getTrendIcon(player.trendScore)}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs ${getPositionColor(player.position)}`}>
                        {player.position}
                      </Badge>
                      <span className="text-slate-400 text-sm">{player.team}</span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className="text-lg font-bold text-white">{player.trendScore}</div>
                    <div className="text-xs text-slate-400">Trend Score</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-400">Ownership</div>
                    <div className="flex items-center gap-1">
                      <span className="text-white font-semibold">{player.ownership.toFixed(1)}%</span>
                      {ownershipTrend.icon}
                      <span className={`text-xs ${ownershipTrend.color}`}>
                        {player.ownershipChange > 0 ? '+' : ''}{player.ownershipChange.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-400">Momentum</div>
                    <div className="text-white font-semibold">{player.momentumScore}</div>
                  </div>
                </div>

                {/* Performance Metrics */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Target Share</span>
                    <span className="text-white">{player.targetShare.toFixed(1)}%</span>
                  </div>
                  <Progress value={player.targetShare} className="h-2" />
                </div>

                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-slate-400">Snap Share</span>
                    <span className="text-white">{player.snapShare.toFixed(1)}%</span>
                  </div>
                  <Progress value={player.snapShare} className="h-2" />
                </div>

                {/* Recent Performance */}
                <div>
                  <div className="text-xs text-slate-400 mb-1">Recent Performance (4 weeks)</div>
                  <div className="flex gap-1">
                    {player.recentPerformance.map((score, idx) => (
                      <div 
                        key={idx}
                        className={`h-6 flex-1 rounded text-xs flex items-center justify-center font-semibold ${
                          score > 15 ? 'bg-green-500/30 text-green-300' :
                          score > 10 ? 'bg-yellow-500/30 text-yellow-300' :
                          'bg-red-500/30 text-red-300'
                        }`}
                      >
                        {score.toFixed(0)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Badges */}
                <div className="flex gap-1 flex-wrap">
                  {getMomentumBadge(player.momentumScore)}
                  
                  {player.scheduleStrength > 75 && (
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                      Easy ROS
                    </Badge>
                  )}
                  
                  {player.redZoneTargets > 3 && (
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                      RZ Looks
                    </Badge>
                  )}

                  <Badge className={`${buzzLevel.color.replace('text-', 'bg-').replace('-400', '-500/20')} ${buzzLevel.color} border-current/30`}>
                    {buzzLevel.icon}
                    <span className="ml-1">{buzzLevel.level} Buzz</span>
                  </Badge>
                </div>

                {/* Advanced Stats */}
                <div className="bg-slate-700/50 rounded p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Proj Points</span>
                      <span className="text-white">{player.projectedPoints.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">FAAB Value</span>
                      <span className="text-green-400">${player.faabValue}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Injury Risk</span>
                      <span className={`${
                        player.injuryRisk > 70 ? 'text-red-400' :
                        player.injuryRisk > 40 ? 'text-yellow-400' :
                        'text-green-400'
                      }`}>
                        {player.injuryRisk}%
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Search Vol</span>
                      <span className="text-blue-400">{(player.searchVolume / 1000).toFixed(1)}K</span>
                    </div>
                  </div>
                </div>

                {/* Weekly Trend Chart */}
                {selectedPlayer === player.id && (
                  <div className="bg-slate-700/30 rounded p-3">
                    <div className="text-sm text-white font-semibold mb-2">Weekly Trend</div>
                    <div className="flex items-end gap-1 h-16">
                      {player.weeklyTrend.map((week, idx) => (
                        <div key={idx} className="flex-1 flex flex-col items-center">
                          <div 
                            className="w-full bg-purple-500/60 rounded-sm"
                            style={{ height: `${Math.max(10, (week.points / 25) * 100)}%` }}
                          ></div>
                          <div className="text-xs text-slate-400 mt-1">W{week.week}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => handleClaimPlayer(player)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    <Target className="w-4 h-4 mr-2" />
                    Claim (${player.faabValue})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedPlayer(
                      selectedPlayer === player.id ? null : player.id
                    )}
                    className="flex-1"
                  >
                    {selectedPlayer === player.id ? 'Hide' : 'Details'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredAndSortedPlayers.length === 0 && (
        <Card className="bg-slate-800/50 border-purple-500/20">
          <CardContent className="p-8 text-center">
            <BarChart3 className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Trending Players Found</h3>
            <p className="text-slate-400">
              Try adjusting your filters or check back later for new trending players.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Trend Explanation */}
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Activity className="w-5 h-5 text-blue-400" />
            Understanding Player Trends
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-white font-semibold mb-2">Trend Score Components</h4>
              <div className="space-y-2 text-sm text-slate-300">
                <div>• Performance trajectory (last 4 weeks)</div>
                <div>• Usage trend (targets, carries, snaps)</div>
                <div>• Opportunity metrics (red zone, goal line)</div>
                <div>• Team context (game script, injuries)</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-2">Momentum Indicators</h4>
              <div className="space-y-2 text-sm text-slate-300">
                <div>• Ownership velocity (rate of adds)</div>
                <div>• Social media buzz and mentions</div>
                <div>• Expert recommendations and rankings</div>
                <div>• Schedule strength and matchups</div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
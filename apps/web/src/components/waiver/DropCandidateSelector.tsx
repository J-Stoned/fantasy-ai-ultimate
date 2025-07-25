'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { logger } from '../../lib/logging/logger';
import { 
  Trash2, 
  AlertTriangle, 
  TrendingDown,
  Calendar,
  Target,
  Activity,
  Users,
  Zap,
  Shield,
  Clock
} from 'lucide-react';

interface RosterPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  dropScore: number;
  rosteredWeeks: number;
  recentPoints: number[];
  projectedPoints: number;
  injuryStatus?: string;
  byeWeek: number;
  upcomingMatchups: string[];
  rostePrcentage: number;
  tradeValue: number;
  keeperValue?: number;
  replacementLevel: number;
  positionalRank: number;
  seasonLongProjection: number;
  opportunityTrend: number;
  ageRisk: number;
}

interface DropCandidateSelectorProps {
  onSelectDrop: (playerId: string) => void;
}

export const DropCandidateSelector: React.FC<DropCandidateSelectorProps> = ({
  onSelectDrop
}) => {
  const [rosterPlayers, setRosterPlayers] = useState<RosterPlayer[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [sortBy, setSortBy] = useState<'dropScore' | 'projectedPoints' | 'tradeValue' | 'rosteredWeeks'>('dropScore');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadRosterPlayers();
  }, []);

  const loadRosterPlayers = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/roster/drop-candidates');
      const data = await response.json();
      setRosterPlayers(data);
    } catch (error) {
      logger.error('Error loading roster players:', { error: error });
      // Mock data for demonstration
      setRosterPlayers([
        {
          id: '1',
          name: 'Tyler Boyd',
          position: 'WR',
          team: 'CIN',
          dropScore: 85,
          rosteredWeeks: 8,
          recentPoints: [4.2, 2.1, 8.5, 1.3],
          projectedPoints: 6.2,
          byeWeek: 12,
          upcomingMatchups: ['@BAL', 'vs LAC', '@PIT'],
          rostePrcentage: 45.2,
          tradeValue: 12,
          replacementLevel: 5.8,
          positionalRank: 45,
          seasonLongProjection: 110.5,
          opportunityTrend: -15,
          ageRisk: 28
        },
        {
          id: '2', 
          name: 'Deon Jackson',
          position: 'RB',
          team: 'IND',
          dropScore: 92,
          rosteredWeeks: 3,
          recentPoints: [1.2, 0.0, 3.4, 2.1],
          projectedPoints: 3.1,
          injuryStatus: 'Healthy',
          byeWeek: 14,
          upcomingMatchups: ['vs HOU', '@NE', 'vs LV'],
          rostePrcentage: 8.3,
          tradeValue: 3,
          replacementLevel: 4.2,
          positionalRank: 58,
          seasonLongProjection: 45.8,
          opportunityTrend: -32,
          ageRisk: 15
        }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

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

  const getDropRiskLevel = (dropScore: number) => {
    if (dropScore > 80) return { level: 'Safe Drop', color: 'text-green-400', bgColor: 'bg-green-500/20' };
    if (dropScore > 60) return { level: 'Consider', color: 'text-yellow-400', bgColor: 'bg-yellow-500/20' };
    if (dropScore > 40) return { level: 'Risky', color: 'text-orange-400', bgColor: 'bg-orange-500/20' };
    return { level: 'Keep', color: 'text-red-400', bgColor: 'bg-red-500/20' };
  };

  const getOpportunityTrendIcon = (trend: number) => {
    if (trend > 10) return <TrendingDown className="w-4 h-4 text-green-400" />;
    if (trend < -10) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Activity className="w-4 h-4 text-yellow-400" />;
  };

  const filteredAndSortedPlayers = rosterPlayers
    .filter(player => positionFilter === 'all' || player.position === positionFilter)
    .sort((a, b) => {
      switch (sortBy) {
        case 'projectedPoints':
          return a.projectedPoints - b.projectedPoints;
        case 'tradeValue':
          return a.tradeValue - b.tradeValue;
        case 'rosteredWeeks':
          return b.rosteredWeeks - a.rosteredWeeks;
        default:
          return b.dropScore - a.dropScore;
      }
    });

  const handlePlayerSelect = (playerId: string) => {
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedPlayers(newSelected);
  };

  const handleConfirmDrop = (playerId: string) => {
    onSelectDrop(playerId);
    const newSelected = new Set(selectedPlayers);
    newSelected.delete(playerId);
    setSelectedPlayers(newSelected);
  };

  const getPositionDepth = (position: string) => {
    return rosterPlayers.filter(p => p.position === position).length;
  };

  if (isLoading) {
    return (
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardContent className="p-8 text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400 mx-auto mb-4"></div>
          <p className="text-white">Loading your roster...</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Controls */}
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Trash2 className="w-5 h-5 text-red-400" />
            Drop Candidate Analysis
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={sortBy === 'dropScore' ? 'default' : 'outline'}
                onClick={() => setSortBy('dropScore')}
              >
                Drop Score
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'projectedPoints' ? 'default' : 'outline'}
                onClick={() => setSortBy('projectedPoints')}
              >
                Projection
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'tradeValue' ? 'default' : 'outline'}
                onClick={() => setSortBy('tradeValue')}
              >
                Trade Value
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'rosteredWeeks' ? 'default' : 'outline'}
                onClick={() => setSortBy('rosteredWeeks')}
              >
                Tenure
              </Button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={positionFilter === 'all' ? 'default' : 'outline'}
                onClick={() => setPositionFilter('all')}
              >
                All Positions
              </Button>
              {['QB', 'RB', 'WR', 'TE'].map(pos => (
                <Button
                  key={pos}
                  size="sm"
                  variant={positionFilter === pos ? 'default' : 'outline'}
                  onClick={() => setPositionFilter(pos)}
                >
                  {pos} ({getPositionDepth(pos)})
                </Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Drop Candidates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredAndSortedPlayers.map((player) => {
          const dropRisk = getDropRiskLevel(player.dropScore);
          const isSelected = selectedPlayers.has(player.id);
          
          return (
            <Card 
              key={player.id} 
              className={`bg-slate-800/50 border-purple-500/20 hover:border-purple-400/40 transition-all ${
                isSelected ? 'border-red-400/60 bg-red-900/10' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      {player.name}
                      {player.injuryStatus && (
                        <AlertTriangle className="w-4 h-4 text-yellow-400" />
                      )}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs ${getPositionColor(player.position)}`}>
                        {player.position}#{player.positionalRank}
                      </Badge>
                      <span className="text-slate-400 text-sm">{player.team}</span>
                      <span className="text-slate-400 text-xs">
                        Week {player.rosteredWeeks} rostered
                      </span>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <Badge className={`${dropRisk.bgColor} ${dropRisk.color} border-current/30 text-xs`}>
                      {dropRisk.level}
                    </Badge>
                    <div className="text-lg font-bold text-white mt-1">{player.dropScore}</div>
                    <div className="text-xs text-slate-400">Drop Score</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-400">Projected Pts</div>
                    <div className="text-white font-semibold">{player.projectedPoints.toFixed(1)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Trade Value</div>
                    <div className="text-blue-400 font-semibold">{player.tradeValue}</div>
                  </div>
                </div>

                {/* Recent Performance */}
                <div>
                  <div className="text-xs text-slate-400 mb-1">Last 4 weeks</div>
                  <div className="flex gap-1">
                    {player.recentPoints.map((score, idx) => (
                      <div 
                        key={idx}
                        className={`h-6 flex-1 rounded text-xs flex items-center justify-center font-semibold ${
                          score > 10 ? 'bg-green-500/30 text-green-300' :
                          score > 5 ? 'bg-yellow-500/30 text-yellow-300' :
                          'bg-red-500/30 text-red-300'
                        }`}
                      >
                        {score.toFixed(1)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Drop Factors */}
                <div className="bg-slate-700/50 rounded p-3 space-y-2">
                  <div className="text-xs font-semibold text-white mb-1">Drop Analysis</div>
                  <div className="space-y-1 text-xs">
                    <div className="flex justify-between">
                      <span className="text-slate-400">vs Replacement</span>
                      <span className={`${
                        player.projectedPoints - player.replacementLevel > 2 ? 'text-green-400' :
                        player.projectedPoints - player.replacementLevel > 0 ? 'text-yellow-400' :
                        'text-red-400'
                      }`}>
                        +{(player.projectedPoints - player.replacementLevel).toFixed(1)}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Rostered %</span>
                      <span className="text-white">{player.rostePrcentage.toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Opportunity Trend</span>
                      <span className={`flex items-center gap-1 ${
                        player.opportunityTrend > 0 ? 'text-green-400' :
                        player.opportunityTrend < -10 ? 'text-red-400' :
                        'text-yellow-400'
                      }`}>
                        {getOpportunityTrendIcon(player.opportunityTrend)}
                        {player.opportunityTrend > 0 ? '+' : ''}{player.opportunityTrend}%
                      </span>
                    </div>
                  </div>
                </div>

                {/* Upcoming Schedule */}
                <div>
                  <div className="text-xs text-slate-400 mb-1 flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    Next 3 matchups
                  </div>
                  <div className="flex gap-2 text-xs">
                    {player.upcomingMatchups.slice(0, 3).map((matchup, idx) => (
                      <span key={idx} className="bg-slate-600/50 px-2 py-1 rounded text-slate-300">
                        {matchup}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Risk Factors */}
                <div className="flex gap-1 flex-wrap">
                  {player.byeWeek <= 15 && (
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                      <Clock className="w-3 h-3 mr-1" />
                      Bye Wk {player.byeWeek}
                    </Badge>
                  )}
                  
                  {player.ageRisk > 30 && (
                    <Badge className="bg-orange-500/20 text-orange-300 border-orange-500/30 text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Age Risk
                    </Badge>
                  )}

                  {player.keeperValue && (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                      <Shield className="w-3 h-3 mr-1" />
                      Keeper Value
                    </Badge>
                  )}

                  {player.seasonLongProjection < 100 && (
                    <Badge className="bg-red-500/20 text-red-300 border-red-500/30 text-xs">
                      <TrendingDown className="w-3 h-3 mr-1" />
                      Low ROS
                    </Badge>
                  )}
                </div>

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant={isSelected ? 'default' : 'outline'}
                    onClick={() => handlePlayerSelect(player.id)}
                    className={`flex-1 ${isSelected ? 'bg-red-600 hover:bg-red-700' : ''}`}
                  >
                    <Target className="w-4 h-4 mr-2" />
                    {isSelected ? 'Selected' : 'Select'}
                  </Button>
                  
                  {isSelected && (
                    <Button
                      size="sm"
                      onClick={() => handleConfirmDrop(player.id)}
                      className="flex-1 bg-red-600 hover:bg-red-700"
                    >
                      <Trash2 className="w-4 h-4 mr-2" />
                      Confirm Drop
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredAndSortedPlayers.length === 0 && (
        <Card className="bg-slate-800/50 border-purple-500/20">
          <CardContent className="p-8 text-center">
            <Shield className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">Strong Roster</h3>
            <p className="text-slate-400">
              No obvious drop candidates found in your current position filter.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Drop Strategy Guide */}
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            Smart Drop Strategy
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h4 className="text-white font-semibold mb-2">Safe Drop Indicators</h4>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5"></div>
                  <span>Consistently underperforming projections</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5"></div>
                  <span>Declining target/carry share over 3+ weeks</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5"></div>
                  <span>Low rostership and trade value</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-green-400 rounded-full mt-1.5"></div>
                  <span>Difficult remaining schedule</span>
                </div>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-2">Hold Considerations</h4>
              <div className="space-y-2 text-sm text-slate-300">
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-1.5"></div>
                  <span>Recent injury to player ahead on depth chart</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-1.5"></div>
                  <span>Upcoming bye week coverage need</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-1.5"></div>
                  <span>Positive target/usage trend recently</span>
                </div>
                <div className="flex items-start gap-2">
                  <div className="w-2 h-2 bg-red-400 rounded-full mt-1.5"></div>
                  <span>Keeper league value for next season</span>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
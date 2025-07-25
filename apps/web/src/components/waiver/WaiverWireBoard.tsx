'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { 
  TrendingUp, 
  TrendingDown, 
  Star, 
  DollarSign, 
  Activity,
  Target,
  AlertTriangle,
  Zap
} from 'lucide-react';

interface WaiverPlayer {
  id: string;
  name: string;
  position: string;
  team: string;
  ownership: number;
  trendScore: number;
  projectedPoints: number;
  recentPerformance: number[];
  injuryStatus?: string;
  news?: string;
  faabValue: number;
  breakoutProbability: number;
  scheduleStrength: number;
  ros_rank?: number;
}

interface WaiverClaim {
  id: string;
  playerId: string;
  bidAmount: number;
  priority: number;
  dropPlayerId?: string;
  status: 'pending' | 'processed' | 'won' | 'lost';
}

interface WaiverWireBoardProps {
  players: WaiverPlayer[];
  onClaim: (playerId: string, bidAmount: number, dropPlayerId?: string) => void;
  existingClaims: WaiverClaim[];
}

export const WaiverWireBoard: React.FC<WaiverWireBoardProps> = ({
  players,
  onClaim,
  existingClaims
}) => {
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [bidAmount, setBidAmount] = useState<number>(1);

  const isPlayerClaimed = (playerId: string) => {
    return existingClaims.some(claim => claim.playerId === playerId);
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

  const getTrendIcon = (trendScore: number) => {
    if (trendScore > 75) return <TrendingUp className="w-4 h-4 text-green-400" />;
    if (trendScore < 25) return <TrendingDown className="w-4 h-4 text-red-400" />;
    return <Activity className="w-4 h-4 text-yellow-400" />;
  };

  const getBreakoutBadge = (probability: number) => {
    if (probability > 70) return <Badge className="bg-green-500/20 text-green-300 border-green-500/30">🚀 Breakout</Badge>;
    if (probability > 50) return <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30">⭐ Rising</Badge>;
    return null;
  };

  const handleClaimPlayer = (player: WaiverPlayer) => {
    onClaim(player.id, bidAmount);
    setSelectedPlayer(null);
    setBidAmount(1);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-white flex items-center gap-2">
          <Target className="w-5 h-5 text-purple-400" />
          Available Players ({players.length})
        </h2>
        
        <div className="text-sm text-slate-400">
          Sorted by AI recommendation score
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {players.map((player) => (
          <Card 
            key={player.id} 
            className={`bg-slate-800/50 border-purple-500/20 hover:border-purple-400/40 transition-all duration-300 ${
              isPlayerClaimed(player.id) ? 'opacity-50' : ''
            }`}
          >
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div>
                  <CardTitle className="text-lg text-white flex items-center gap-2">
                    {player.name}
                    {player.breakoutProbability > 50 && <Zap className="w-4 h-4 text-yellow-400" />}
                  </CardTitle>
                  <div className="flex items-center gap-2 mt-1">
                    <Badge className={`text-xs ${getPositionColor(player.position)}`}>
                      {player.position}
                    </Badge>
                    <span className="text-slate-400 text-sm">{player.team}</span>
                  </div>
                </div>
                
                <div className="text-right">
                  <div className="flex items-center gap-1 text-sm">
                    {getTrendIcon(player.trendScore)}
                    <span className="text-slate-300">{player.trendScore}%</span>
                  </div>
                  <div className="text-xs text-slate-400 mt-1">
                    {player.ownership.toFixed(1)}% owned
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-3">
              {/* Performance Metrics */}
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <div className="text-slate-400">Projected Pts</div>
                  <div className="text-white font-semibold">{player.projectedPoints.toFixed(1)}</div>
                </div>
                <div>
                  <div className="text-slate-400">FAAB Value</div>
                  <div className="text-green-400 font-semibold">${player.faabValue}</div>
                </div>
              </div>

              {/* Recent Performance */}
              <div>
                <div className="text-xs text-slate-400 mb-1">Last 4 weeks</div>
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
                {getBreakoutBadge(player.breakoutProbability)}
                {player.scheduleStrength > 75 && (
                  <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                    Easy Schedule
                  </Badge>
                )}
                {player.injuryStatus && (
                  <Badge className="bg-red-500/20 text-red-300 border-red-500/30">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    {player.injuryStatus}
                  </Badge>
                )}
              </div>

              {/* News */}
              {player.news && (
                <div className="bg-slate-700/50 rounded p-2">
                  <div className="text-xs text-slate-300">{player.news}</div>
                </div>
              )}

              {/* Action Button */}
              <div className="pt-2">
                {isPlayerClaimed(player.id) ? (
                  <Button 
                    disabled 
                    className="w-full bg-gray-600 text-gray-400"
                  >
                    Already Claimed
                  </Button>
                ) : selectedPlayer === player.id ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-green-400" />
                      <input
                        type="number"
                        min="1"
                        max="100"
                        value={bidAmount}
                        onChange={(e) => setBidAmount(Number(e.target.value))}
                        className="flex-1 bg-slate-700 border border-purple-500/20 rounded px-2 py-1 text-white text-sm"
                        placeholder="Bid amount"
                      />
                    </div>
                    <div className="flex gap-2">
                      <Button 
                        size="sm" 
                        onClick={() => handleClaimPlayer(player)}
                        className="flex-1 bg-green-600 hover:bg-green-700"
                      >
                        Submit Claim
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => setSelectedPlayer(null)}
                        className="flex-1"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button 
                    onClick={() => setSelectedPlayer(player.id)}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    <DollarSign className="w-4 h-4 mr-2" />
                    Add Waiver Claim
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {players.length === 0 && (
        <Card className="bg-slate-800/50 border-purple-500/20">
          <CardContent className="p-8 text-center">
            <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Players Found</h3>
            <p className="text-slate-400">
              Try adjusting your search filters or check back later for new available players.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};
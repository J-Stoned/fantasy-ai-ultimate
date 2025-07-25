'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { logger } from '../../lib/logging/logger';
import { 
  DollarSign, 
  TrendingUp, 
  Target, 
  AlertTriangle,
  Calculator,
  Zap,
  Users,
  Trash2,
  Edit3
} from 'lucide-react';

interface WaiverClaim {
  id: string;
  playerId: string;
  playerName?: string;
  position?: string;
  team?: string;
  bidAmount: number;
  priority: number;
  dropPlayerId?: string;
  dropPlayerName?: string;
  status: 'pending' | 'processed' | 'won' | 'lost';
  optimalBid?: number;
  successProbability?: number;
  competitorBids?: number[];
}

interface FAAbBiddingPanelProps {
  claims: WaiverClaim[];
  budget: number;
  onUpdateBid: (claimId: string, newBid: number) => void;
  onRemoveClaim: (claimId: string) => void;
}

export const FAAbBiddingPanel: React.FC<FAAbBiddingPanelProps> = ({
  claims,
  budget,
  onUpdateBid,
  onRemoveClaim
}) => {
  const [editingClaim, setEditingClaim] = useState<string | null>(null);
  const [editBid, setEditBid] = useState<number>(0);
  const [biddingStrategy, setBiddingStrategy] = useState<'conservative' | 'balanced' | 'aggressive'>('balanced');
  const [optimizedBids, setOptimizedBids] = useState<{ [claimId: string]: number }>({});

  const totalCommitted = claims.reduce((sum, claim) => sum + claim.bidAmount, 0);
  const budgetUsagePercent = (totalCommitted / budget) * 100;

  useEffect(() => {
    calculateOptimalBids();
  }, [claims, budget, biddingStrategy]);

  const calculateOptimalBids = async () => {
    try {
      const response = await fetch('/api/waivers/bid-optimal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claims: claims.map(claim => ({
            playerId: claim.playerId,
            priority: claim.priority,
            currentBid: claim.bidAmount
          })),
          budget,
          strategy: biddingStrategy
        })
      });

      if (response.ok) {
        const optimizedData = await response.json();
        setOptimizedBids(optimizedData);
      }
    } catch (error) {
      logger.error('Error calculating optimal bids:', { error: error });
    }
  };

  const handleStartEdit = (claim: WaiverClaim) => {
    setEditingClaim(claim.id);
    setEditBid(claim.bidAmount);
  };

  const handleSaveEdit = (claimId: string) => {
    onUpdateBid(claimId, editBid);
    setEditingClaim(null);
  };

  const handleCancelEdit = () => {
    setEditingClaim(null);
    setEditBid(0);
  };

  const getBidRecommendation = (claim: WaiverClaim) => {
    if (!claim.optimalBid) return null;
    
    const difference = claim.bidAmount - claim.optimalBid;
    if (Math.abs(difference) <= 2) return null;
    
    if (difference > 2) {
      return {
        type: 'warning',
        message: `Consider lowering to $${claim.optimalBid} (save $${difference})`
      };
    } else {
      return {
        type: 'info',
        message: `Consider raising to $${claim.optimalBid} (${claim.successProbability}% success rate)`
      };
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

  const getBudgetStatus = () => {
    if (budgetUsagePercent > 90) return { color: 'text-red-400', status: 'Critical' };
    if (budgetUsagePercent > 75) return { color: 'text-yellow-400', status: 'High' };
    if (budgetUsagePercent > 50) return { color: 'text-blue-400', status: 'Moderate' };
    return { color: 'text-green-400', status: 'Low' };
  };

  const budgetStatus = getBudgetStatus();

  return (
    <div className="space-y-6">
      {/* Budget Overview */}
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Calculator className="w-5 h-5 text-purple-400" />
            FAAB Budget Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">${budget}</div>
              <div className="text-sm text-slate-400">Total Budget</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">${totalCommitted}</div>
              <div className="text-sm text-slate-400">Committed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-white">${budget - totalCommitted}</div>
              <div className="text-sm text-slate-400">Remaining</div>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">Budget Usage</span>
              <span className={`text-sm font-semibold ${budgetStatus.color}`}>
                {budgetUsagePercent.toFixed(1)}% ({budgetStatus.status})
              </span>
            </div>
            <Progress 
              value={budgetUsagePercent} 
              className="h-3"
              style={{
                background: budgetUsagePercent > 90 ? '#ef4444' : 
                           budgetUsagePercent > 75 ? '#f59e0b' : 
                           '#8b5cf6'
              }}
            />
          </div>

          {/* Strategy Selector */}
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={biddingStrategy === 'conservative' ? 'default' : 'outline'}
              onClick={() => setBiddingStrategy('conservative')}
              className="flex-1"
            >
              Conservative
            </Button>
            <Button
              size="sm"
              variant={biddingStrategy === 'balanced' ? 'default' : 'outline'}
              onClick={() => setBiddingStrategy('balanced')}
              className="flex-1"
            >
              Balanced
            </Button>
            <Button
              size="sm"
              variant={biddingStrategy === 'aggressive' ? 'default' : 'outline'}
              onClick={() => setBiddingStrategy('aggressive')}
              className="flex-1"
            >
              Aggressive
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Active Claims */}
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-white flex items-center gap-2">
            <Target className="w-5 h-5 text-purple-400" />
            Active Waiver Claims ({claims.length})
          </CardTitle>
          <Button 
            size="sm" 
            onClick={calculateOptimalBids}
            className="bg-purple-600 hover:bg-purple-700"
          >
            <Zap className="w-4 h-4 mr-2" />
            Optimize Bids
          </Button>
        </CardHeader>
        <CardContent>
          {claims.length === 0 ? (
            <div className="text-center py-8">
              <Target className="w-12 h-12 text-slate-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-white mb-2">No Active Claims</h3>
              <p className="text-slate-400">
                Start by adding waiver claims from the Available Players tab.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {claims
                .sort((a, b) => a.priority - b.priority)
                .map((claim) => {
                  const recommendation = getBidRecommendation(claim);
                  
                  return (
                    <Card key={claim.id} className="bg-slate-700/50 border-slate-600/50">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                                #{claim.priority}
                              </Badge>
                              <span className="text-white font-semibold">
                                {claim.playerName || `Player ${claim.playerId}`}
                              </span>
                              {claim.position && (
                                <Badge className={`text-xs ${getPositionColor(claim.position)}`}>
                                  {claim.position}
                                </Badge>
                              )}
                              {claim.team && (
                                <span className="text-slate-400 text-sm">{claim.team}</span>
                              )}
                            </div>

                            {claim.dropPlayerName && (
                              <div className="text-sm text-slate-400 mb-2">
                                Dropping: {claim.dropPlayerName}
                              </div>
                            )}

                            {/* Bid Information */}
                            <div className="flex items-center gap-4 mb-2">
                              <div className="flex items-center gap-2">
                                <DollarSign className="w-4 h-4 text-green-400" />
                                {editingClaim === claim.id ? (
                                  <div className="flex items-center gap-2">
                                    <input
                                      type="number"
                                      min="1"
                                      max={budget}
                                      value={editBid}
                                      onChange={(e) => setEditBid(Number(e.target.value))}
                                      className="w-20 bg-slate-600 border border-purple-500/20 rounded px-2 py-1 text-white text-sm"
                                    />
                                    <Button 
                                      size="sm" 
                                      onClick={() => handleSaveEdit(claim.id)}
                                      className="bg-green-600 hover:bg-green-700 px-2 py-1 h-auto"
                                    >
                                      Save
                                    </Button>
                                    <Button 
                                      size="sm" 
                                      variant="outline" 
                                      onClick={handleCancelEdit}
                                      className="px-2 py-1 h-auto"
                                    >
                                      Cancel
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="flex items-center gap-2">
                                    <span className="text-white font-semibold">${claim.bidAmount}</span>
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => handleStartEdit(claim)}
                                      className="p-1 h-auto"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                    </Button>
                                  </div>
                                )}
                              </div>

                              {claim.successProbability && (
                                <div className="flex items-center gap-1">
                                  <TrendingUp className="w-4 h-4 text-blue-400" />
                                  <span className="text-blue-300 text-sm">
                                    {claim.successProbability}% success
                                  </span>
                                </div>
                              )}

                              {claim.competitorBids && claim.competitorBids.length > 0 && (
                                <div className="flex items-center gap-1">
                                  <Users className="w-4 h-4 text-yellow-400" />
                                  <span className="text-yellow-300 text-sm">
                                    Avg competitor: ${Math.round(claim.competitorBids.reduce((a, b) => a + b, 0) / claim.competitorBids.length)}
                                  </span>
                                </div>
                              )}
                            </div>

                            {/* Recommendation */}
                            {recommendation && (
                              <div className={`flex items-center gap-2 text-sm p-2 rounded ${
                                recommendation.type === 'warning' ? 
                                'bg-yellow-500/20 text-yellow-300 border border-yellow-500/30' :
                                'bg-blue-500/20 text-blue-300 border border-blue-500/30'
                              }`}>
                                <AlertTriangle className="w-4 h-4" />
                                {recommendation.message}
                              </div>
                            )}
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => onRemoveClaim(claim.id)}
                            className="text-red-400 hover:text-red-300 hover:bg-red-500/20"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Quick Tips */}
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Zap className="w-5 h-5 text-yellow-400" />
            FAAB Bidding Tips
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5"></div>
                <div>
                  <div className="text-white font-semibold">Conservative Strategy</div>
                  <div className="text-slate-400">Bid 5-10% of budget on high-priority targets</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5"></div>
                <div>
                  <div className="text-white font-semibold">Balanced Strategy</div>
                  <div className="text-slate-400">Bid 10-20% on must-have players, 5-10% on depth</div>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5"></div>
                <div>
                  <div className="text-white font-semibold">Aggressive Strategy</div>
                  <div className="text-slate-400">Bid 20-40% on league-winners, go big or go home</div>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <div className="w-2 h-2 bg-purple-400 rounded-full mt-1.5"></div>
                <div>
                  <div className="text-white font-semibold">Save for Playoffs</div>
                  <div className="text-slate-400">Keep 30-40% budget for mid-season emergencies</div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Progress } from '../ui/progress';
import { 
  Radar,
  Zap,
  TrendingUp,
  Target,
  Star,
  Activity,
  AlertTriangle,
  Eye,
  Users,
  Calendar,
  BarChart3,
  Crown
} from 'lucide-react';

interface BreakoutCandidate {
  id: string;
  name: string;
  position: string;
  team: string;
  breakoutScore: number;
  opportunityScore: number;
  talentScore: number;  
  situationScore: number;
  age: number;
  ownership: number;
  breakoutProbability: number;
  projectedPoints: number;
  currentPoints: number;
  upside: number;
  recentTargets: number[];
  snapTrend: number;
  depthChartPosition: number;
  teamPace: number;
  strengthOfSchedule: number;
  injuryReplacementUpside: number;
  rookieStatus?: boolean;
  catalysts: string[];
  concerns: string[];
  comparableBreakouts: string[];
  faabRecommendation: number;
  confidenceLevel: 'Low' | 'Medium' | 'High' | 'Very High';
  timeframe: '2-3 weeks' | '1 month' | '2-3 months' | 'ROS';
}

interface BreakoutRadarProps {
  candidates: BreakoutCandidate[];
  onClaim: (playerId: string, bidAmount: number, dropPlayerId?: string) => void;
}

export const BreakoutRadar: React.FC<BreakoutRadarProps> = ({
  candidates,
  onClaim
}) => {
  const [sortBy, setSortBy] = useState<'breakoutScore' | 'upside' | 'opportunity' | 'talent'>('breakoutScore');
  const [confidenceFilter, setConfidenceFilter] = useState<string>('all');
  const [timeframeFilter, setTimeframeFilter] = useState<string>('all');
  const [selectedCandidate, setSelectedCandidate] = useState<string | null>(null);
  const [showAnalysis, setShowAnalysis] = useState<{ [key: string]: boolean }>({});

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

  const getConfidenceColor = (confidence: string) => {
    switch (confidence) {
      case 'Very High':
        return 'bg-green-500/20 text-green-300 border-green-500/30';
      case 'High':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'Medium':
        return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30';
      default:
        return 'bg-slate-500/20 text-slate-300 border-slate-500/30';
    }
  };

  const getBreakoutTier = (score: number) => {
    if (score >= 90) return { tier: 'Elite', icon: <Crown className="w-4 h-4 text-yellow-400" />, color: 'text-yellow-400' };
    if (score >= 80) return { tier: 'High', icon: <Star className="w-4 h-4 text-green-400" />, color: 'text-green-400' };
    if (score >= 70) return { tier: 'Medium', icon: <Zap className="w-4 h-4 text-blue-400" />, color: 'text-blue-400' };
    if (score >= 60) return { tier: 'Sleeper', icon: <Eye className="w-4 h-4 text-purple-400" />, color: 'text-purple-400' };
    return { tier: 'Dart Throw', icon: <Target className="w-4 h-4 text-slate-400" />, color: 'text-slate-400' };
  };

  const getUpsideLevel = (upside: number) => {
    if (upside >= 15) return 'League Winner';
    if (upside >= 10) return 'High Upside';
    if (upside >= 7) return 'Solid Upside';
    return 'Limited Upside';
  };

  const filteredAndSortedCandidates = candidates
    .filter(candidate => {
      const matchesConfidence = confidenceFilter === 'all' || candidate.confidenceLevel === confidenceFilter;
      const matchesTimeframe = timeframeFilter === 'all' || candidate.timeframe === timeframeFilter;
      return matchesConfidence && matchesTimeframe;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'upside':
          return b.upside - a.upside;
        case 'opportunity':
          return b.opportunityScore - a.opportunityScore;
        case 'talent':
          return b.talentScore - a.talentScore;
        default:
          return b.breakoutScore - a.breakoutScore;
      }
    });

  const toggleAnalysis = (candidateId: string) => {
    setShowAnalysis({
      ...showAnalysis,
      [candidateId]: !showAnalysis[candidateId]
    });
  };

  const handleClaimCandidate = (candidate: BreakoutCandidate) => {
    onClaim(candidate.id, candidate.faabRecommendation);
  };

  const getAgeRisk = (age: number) => {
    if (age <= 23) return { risk: 'Low', color: 'text-green-400' };
    if (age <= 26) return { risk: 'Medium', color: 'text-yellow-400' };
    return { risk: 'High', color: 'text-red-400' };
  };

  return (
    <div className="space-y-6">
      {/* Header Controls */}
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Radar className="w-5 h-5 text-purple-400" />
            Breakout Radar Detection System
          </CardTitle>
          <p className="text-slate-400 text-sm">
            AI-powered detection of players with highest breakout potential
          </p>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                variant={sortBy === 'breakoutScore' ? 'default' : 'outline'}
                onClick={() => setSortBy('breakoutScore')}
              >
                Breakout Score
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'upside' ? 'default' : 'outline'}
                onClick={() => setSortBy('upside')}
              >
                Upside
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'opportunity' ? 'default' : 'outline'}
                onClick={() => setSortBy('opportunity')}
              >
                Opportunity
              </Button>
              <Button
                size="sm"
                variant={sortBy === 'talent' ? 'default' : 'outline'}
                onClick={() => setSortBy('talent')}
              >
                Talent
              </Button>
            </div>

            <div className="flex gap-2 flex-wrap">
              <select
                value={confidenceFilter}
                onChange={(e) => setConfidenceFilter(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-white text-sm"
              >
                <option value="all">All Confidence</option>
                <option value="Very High">Very High</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>

              <select
                value={timeframeFilter}
                onChange={(e) => setTimeframeFilter(e.target.value)}
                className="bg-slate-700 border border-slate-600 rounded px-3 py-1 text-white text-sm"
              >
                <option value="all">All Timeframes</option>
                <option value="2-3 weeks">2-3 weeks</option>
                <option value="1 month">1 month</option>
                <option value="2-3 months">2-3 months</option>
                <option value="ROS">Rest of Season</option>
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Breakout Candidates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {filteredAndSortedCandidates.map((candidate) => {
          const breakoutTier = getBreakoutTier(candidate.breakoutScore);
          const ageRisk = getAgeRisk(candidate.age);
          const showDetailedAnalysis = showAnalysis[candidate.id];
          
          return (
            <Card key={candidate.id} className="bg-slate-800/50 border-purple-500/20 hover:border-purple-400/40 transition-all">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="text-lg text-white flex items-center gap-2">
                      {candidate.name}
                      {breakoutTier.icon}
                      {candidate.rookieStatus && <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">ROOKIE</Badge>}
                    </CardTitle>
                    <div className="flex items-center gap-2 mt-1">
                      <Badge className={`text-xs ${getPositionColor(candidate.position)}`}>
                        {candidate.position}
                      </Badge>
                      <span className="text-slate-400 text-sm">{candidate.team}</span>
                      <span className="text-slate-400 text-xs">Age {candidate.age}</span>
                      <Badge className={`text-xs ${getConfidenceColor(candidate.confidenceLevel)}`}>
                        {candidate.confidenceLevel}
                      </Badge>
                    </div>
                  </div>
                  
                  <div className="text-right">
                    <div className={`text-lg font-bold ${breakoutTier.color}`}>{candidate.breakoutScore}</div>
                    <div className="text-xs text-slate-400">{breakoutTier.tier}</div>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                {/* Key Metrics */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <div className="text-slate-400">Upside Points</div>
                    <div className="text-green-400 font-semibold">+{candidate.upside.toFixed(1)}</div>
                    <div className="text-xs text-slate-500">{getUpsideLevel(candidate.upside)}</div>
                  </div>
                  <div>
                    <div className="text-slate-400">Ownership</div>
                    <div className="text-white font-semibold">{candidate.ownership.toFixed(1)}%</div>
                    <div className="text-xs text-slate-500">Low Rostered</div>
                  </div>
                </div>

                {/* Breakout Components */}
                <div className="space-y-2">
                  <div className="text-sm text-white font-semibold">Breakout Analysis</div>
                  
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Opportunity</span>
                      <span className="text-white">{candidate.opportunityScore}/100</span>
                    </div>
                    <Progress value={candidate.opportunityScore} className="h-2" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Talent</span>
                      <span className="text-white">{candidate.talentScore}/100</span>
                    </div>
                    <Progress value={candidate.talentScore} className="h-2" />
                  </div>

                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Situation</span>
                      <span className="text-white">{candidate.situationScore}/100</span>
                    </div>
                    <Progress value={candidate.situationScore} className="h-2" />
                  </div>
                </div>

                {/* Recent Targets/Carries */}
                <div>
                  <div className="text-xs text-slate-400 mb-1">Recent Usage (4 weeks)</div>
                  <div className="flex gap-1">
                    {candidate.recentTargets.map((targets, idx) => (
                      <div 
                        key={idx}
                        className={`h-6 flex-1 rounded text-xs flex items-center justify-center font-semibold ${
                          targets > 6 ? 'bg-green-500/30 text-green-300' :
                          targets > 3 ? 'bg-yellow-500/30 text-yellow-300' :
                          'bg-red-500/30 text-red-300'
                        }`}
                      >
                        {targets}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Key Badges */}
                <div className="flex gap-1 flex-wrap">
                  {candidate.snapTrend > 10 && (
                    <Badge className="bg-green-500/20 text-green-300 border-green-500/30 text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      Snap ↑
                    </Badge>
                  )}
                  
                  {candidate.depthChartPosition <= 2 && (
                    <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30 text-xs">
                      Depth Chart #{candidate.depthChartPosition}
                    </Badge>
                  )}

                  {candidate.teamPace > 70 && (
                    <Badge className="bg-purple-500/20 text-purple-300 border-purple-500/30 text-xs">
                      <Activity className="w-3 h-3 mr-1" />
                      Fast Pace
                    </Badge>
                  )}

                  {candidate.injuryReplacementUpside > 80 && (
                    <Badge className="bg-yellow-500/20 text-yellow-300 border-yellow-500/30 text-xs">
                      <AlertTriangle className="w-3 h-3 mr-1" />
                      Injury Upside
                    </Badge>
                  )}

                  <Badge className="bg-slate-500/20 text-slate-300 border-slate-500/30 text-xs">
                    <Calendar className="w-3 h-3 mr-1" />
                    {candidate.timeframe}
                  </Badge>
                </div>

                {/* Detailed Analysis Toggle */}
                {showDetailedAnalysis && (
                  <div className="bg-slate-700/30 rounded p-3 space-y-3">
                    {/* Catalysts */}
                    <div>
                      <div className="text-sm font-semibold text-green-400 flex items-center gap-1 mb-1">
                        <Zap className="w-3 h-3" />
                        Breakout Catalysts
                      </div>
                      <div className="space-y-1">
                        {candidate.catalysts.map((catalyst, idx) => (
                          <div key={idx} className="text-xs text-slate-300 flex items-start gap-1">
                            <div className="w-1 h-1 bg-green-400 rounded-full mt-1.5"></div>
                            {catalyst}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Concerns */}
                    {candidate.concerns.length > 0 && (
                      <div>
                        <div className="text-sm font-semibold text-red-400 flex items-center gap-1 mb-1">
                          <AlertTriangle className="w-3 h-3" />
                          Risk Factors
                        </div>
                        <div className="space-y-1">
                          {candidate.concerns.map((concern, idx) => (
                            <div key={idx} className="text-xs text-slate-300 flex items-start gap-1">
                              <div className="w-1 h-1 bg-red-400 rounded-full mt-1.5"></div>
                              {concern}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Comparable Breakouts */}
                    {candidate.comparableBreakouts.length > 0 && (
                      <div>
                        <div className="text-sm font-semibold text-blue-400 mb-1">Similar Breakouts</div>
                        <div className="flex gap-1 flex-wrap">
                          {candidate.comparableBreakouts.map((comp, idx) => (
                            <span key={idx} className="text-xs bg-blue-500/20 text-blue-300 px-2 py-1 rounded">
                              {comp}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    onClick={() => handleClaimCandidate(candidate)}
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                  >
                    <Target className="w-4 h-4 mr-2" />
                    Claim (${candidate.faabRecommendation})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => toggleAnalysis(candidate.id)}
                    className="flex-1"
                  >
                    <BarChart3 className="w-4 h-4 mr-2" />
                    {showDetailedAnalysis ? 'Hide' : 'Analysis'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {filteredAndSortedCandidates.length === 0 && (
        <Card className="bg-slate-800/50 border-purple-500/20">
          <CardContent className="p-8 text-center">
            <Radar className="w-12 h-12 text-slate-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-white mb-2">No Breakout Candidates</h3>
            <p className="text-slate-400">
              No players match your current filters. Try adjusting the confidence level or timeframe.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Breakout Methodology */}
      <Card className="bg-slate-800/50 border-purple-500/20">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <Star className="w-5 h-5 text-yellow-400" />
            Breakout Detection Methodology
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <h4 className="text-white font-semibold mb-2 flex items-center gap-1">
                <Target className="w-4 h-4 text-green-400" />
                Opportunity Score
              </h4>
              <div className="space-y-1 text-sm text-slate-300">
                <div>• Target/carry share trends</div>
                <div>• Snap count progression</div>
                <div>• Depth chart movement</div>
                <div>• Team pace and volume</div>
              </div>
            </div>
            
            <div>
              <h4 className="text-white font-semibold mb-2 flex items-center gap-1">
                <Zap className="w-4 h-4 text-blue-400" />
                Talent Score
              </h4>
              <div className="space-y-1 text-sm text-slate-300">
                <div>• College production metrics</div>
                <div>• Athletic testing results</div>
                <div>• Efficiency per opportunity</div>
                <div>• Advanced analytics grades</div>
              </div>
            </div>

            <div>
              <h4 className="text-white font-semibold mb-2 flex items-center gap-1">
                <Activity className="w-4 h-4 text-purple-400" />
                Situation Score
              </h4>
              <div className="space-y-1 text-sm text-slate-300">
                <div>• Team offensive scheme fit</div>
                <div>• Injury situations ahead</div>
                <div>• Schedule strength</div>
                <div>• Coaching/system changes</div>
              </div>
            </div>
          </div>

          <div className="bg-slate-700/30 rounded-lg p-4 mt-4">
            <h4 className="text-white font-semibold mb-2 flex items-center gap-2">
              <Crown className="w-4 h-4 text-yellow-400" />
              Historical Breakout Patterns
            </h4>
            <div className="text-sm text-slate-300">
              Our AI model analyzes 5+ years of breakout patterns, identifying players who increased their scoring by 5+ PPG 
              and maintained that production for 4+ weeks. Key predictors include opportunity increase (40% weight), 
              talent metrics (35% weight), and situational factors (25% weight).
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
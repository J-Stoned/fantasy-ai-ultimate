'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/card';
import { Button } from '../../components/ui/button';
import { Badge } from '../../components/ui/badge';
import { Input } from '../../components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../../components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { Progress } from '../../components/ui/progress';
import { 
  TrendingUp, 
  TrendingDown, 
  Star, 
  DollarSign, 
  Clock, 
  Users,
  AlertTriangle,
  Target,
  Zap,
  Activity
} from 'lucide-react';
import { WaiverWireBoard } from '../../components/waiver/WaiverWireBoard';
import { FAAbBiddingPanel } from '../../components/waiver/FAAbBiddingPanel';
import { WaiverPriorityManager } from '../../components/waiver/WaiverPriorityManager';
import { PlayerTrendAnalyzer } from '../../components/waiver/PlayerTrendAnalyzer';
import { DropCandidateSelector } from '../../components/waiver/DropCandidateSelector';
import { BreakoutRadar } from '../../components/waiver/BreakoutRadar';
import { logger } from '../../lib/logging/logger';

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

interface LeagueSettings {
  faabBudget: number;
  waiverOrder: number;
  waiversProcessDay: string;
  maxClaims: number;
}

const WaiversPage: React.FC = () => {
  const [availablePlayers, setAvailablePlayers] = useState<WaiverPlayer[]>([]);
  const [trendingPlayers, setTrendingPlayers] = useState<WaiverPlayer[]>([]);
  const [breakoutCandidates, setBreakoutCandidates] = useState<WaiverPlayer[]>([]);
  const [waiverClaims, setWaiverClaims] = useState<WaiverClaim[]>([]);
  const [leagueSettings, setLeagueSettings] = useState<LeagueSettings>({
    faabBudget: 100,
    waiverOrder: 5,
    waiversProcessDay: 'Wednesday',
    maxClaims: 5
  });
  const [selectedTab, setSelectedTab] = useState('available');
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');

  useEffect(() => {
    loadWaiverData();
  }, []);

  const loadWaiverData = async () => {
    setIsLoading(true);
    try {
      // Load available players
      const availableResponse = await fetch('/api/waivers/available');
      const available = await availableResponse.json();
      setAvailablePlayers(available);

      // Load trending players
      const trendsResponse = await fetch('/api/waivers/trends');
      const trends = await trendsResponse.json();
      setTrendingPlayers(trends.trending || []);
      setBreakoutCandidates(trends.breakouts || []);

      // Load user's waiver claims
      const claimsResponse = await fetch('/api/waivers/claims');
      const claims = await claimsResponse.json();
      setWaiverClaims(claims);

    } catch (error) {
      logger.error('Error loading waiver data:', { error: error });
    } finally {
      setIsLoading(false);
    }
  };

  const handleWaiverClaim = async (playerId: string, bidAmount: number, dropPlayerId?: string) => {
    try {
      const response = await fetch('/api/waivers/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          playerId,
          bidAmount,
          dropPlayerId,
          priority: waiverClaims.length + 1
        })
      });

      if (response.ok) {
        const newClaim = await response.json();
        setWaiverClaims([...waiverClaims, newClaim]);
      }
    } catch (error) {
      logger.error('Error submitting waiver claim:', { error: error });
    }
  };

  const handleRemoveClaim = (claimId: string) => {
    setWaiverClaims(waiverClaims.filter(claim => claim.id !== claimId));
  };

  const getDaysUntilWaivers = () => {
    const today = new Date().getDay();
    const processDay = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
      .indexOf(leagueSettings.waiversProcessDay);
    
    let daysUntil = processDay - today;
    if (daysUntil <= 0) daysUntil += 7;
    
    return daysUntil;
  };

  const getTotalBidAmount = () => {
    return waiverClaims.reduce((sum, claim) => sum + claim.bidAmount, 0);
  };

  const filteredPlayers = availablePlayers.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         player.team.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
    const matchesTeam = teamFilter === 'all' || player.team === teamFilter;
    
    return matchesSearch && matchesPosition && matchesTeam;
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 p-4">
        <div className="max-w-7xl mx-auto">
          <div className="text-center py-20">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-400 mx-auto mb-4"></div>
            <p className="text-white text-lg">Loading waiver wire intelligence...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      {/* Header */}
      <div className="bg-slate-800/50 backdrop-blur-sm border-b border-purple-500/20 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-purple-400 to-cyan-400 bg-clip-text text-transparent">
                🎯 Waiver Wire Assistant
              </h1>
              <p className="text-slate-300 mt-1">
                AI-powered waiver recommendations and FAAB optimization
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Card className="bg-slate-800/50 border-purple-500/20 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="w-4 h-4 text-purple-400" />
                  <span className="text-white">
                    Waivers process in {getDaysUntilWaivers()} days
                  </span>
                </div>
              </Card>
              
              <Card className="bg-slate-800/50 border-purple-500/20 p-3">
                <div className="flex items-center gap-2 text-sm">
                  <DollarSign className="w-4 h-4 text-green-400" />
                  <span className="text-white">
                    ${leagueSettings.faabBudget - getTotalBidAmount()} remaining
                  </span>
                </div>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Active Claims</p>
                  <p className="text-2xl font-bold text-white">{waiverClaims.length}</p>
                </div>
                <Target className="w-8 h-8 text-purple-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">FAAB Committed</p>
                  <p className="text-2xl font-bold text-white">${getTotalBidAmount()}</p>
                </div>
                <DollarSign className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Waiver Priority</p>
                  <p className="text-2xl font-bold text-white">#{leagueSettings.waiverOrder}</p>
                </div>
                <Users className="w-8 h-8 text-blue-400" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-slate-800/50 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-slate-400 text-sm">Trending Up</p>
                  <p className="text-2xl font-bold text-white">{trendingPlayers.length}</p>
                </div>
                <TrendingUp className="w-8 h-8 text-green-400" />
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Tabs value={selectedTab} onValueChange={setSelectedTab} className="w-full">
          <TabsList className="grid w-full grid-cols-6 bg-slate-800/50 border border-purple-500/20">
            <TabsTrigger value="available" className="data-[state=active]:bg-purple-600">
              Available Players
            </TabsTrigger>
            <TabsTrigger value="trends" className="data-[state=active]:bg-purple-600">
              Trending
            </TabsTrigger>
            <TabsTrigger value="breakouts" className="data-[state=active]:bg-purple-600">
              Breakout Radar
            </TabsTrigger>
            <TabsTrigger value="bidding" className="data-[state=active]:bg-purple-600">
              FAAB Bidding
            </TabsTrigger>
            <TabsTrigger value="priority" className="data-[state=active]:bg-purple-600">
              Priority Manager
            </TabsTrigger>
            <TabsTrigger value="drops" className="data-[state=active]:bg-purple-600">
              Drop Candidates
            </TabsTrigger>
          </TabsList>

          {/* Available Players Tab */}
          <TabsContent value="available" className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex-1 max-w-md">
                <Input
                  placeholder="Search players or teams..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="bg-slate-800/50 border-purple-500/20 text-white"
                />
              </div>
              
              <div className="flex gap-2">
                <Select value={positionFilter} onValueChange={setPositionFilter}>
                  <SelectTrigger className="w-32 bg-slate-800/50 border-purple-500/20 text-white">
                    <SelectValue placeholder="Position" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Positions</SelectItem>
                    <SelectItem value="QB">QB</SelectItem>
                    <SelectItem value="RB">RB</SelectItem>
                    <SelectItem value="WR">WR</SelectItem>
                    <SelectItem value="TE">TE</SelectItem>
                    <SelectItem value="K">K</SelectItem>
                    <SelectItem value="DST">DST</SelectItem>
                  </SelectContent>
                </Select>

                <Select value={teamFilter} onValueChange={setTeamFilter}>
                  <SelectTrigger className="w-32 bg-slate-800/50 border-purple-500/20 text-white">
                    <SelectValue placeholder="Team" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Teams</SelectItem>
                    <SelectItem value="BUF">BUF</SelectItem>
                    <SelectItem value="MIA">MIA</SelectItem>
                    <SelectItem value="NE">NE</SelectItem>
                    <SelectItem value="NYJ">NYJ</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <WaiverWireBoard 
              players={filteredPlayers}
              onClaim={handleWaiverClaim}
              existingClaims={waiverClaims}
            />
          </TabsContent>

          {/* Trending Players Tab */}
          <TabsContent value="trends" className="space-y-4">
            <PlayerTrendAnalyzer 
              players={trendingPlayers}
              onClaim={handleWaiverClaim}
            />
          </TabsContent>

          {/* Breakout Radar Tab */}
          <TabsContent value="breakouts" className="space-y-4">
            <BreakoutRadar 
              candidates={breakoutCandidates}
              onClaim={handleWaiverClaim}
            />
          </TabsContent>

          {/* FAAB Bidding Tab */}
          <TabsContent value="bidding" className="space-y-4">
            <FAAbBiddingPanel 
              claims={waiverClaims}
              budget={leagueSettings.faabBudget}
              onUpdateBid={(claimId, newBid) => {
                setWaiverClaims(waiverClaims.map(claim => 
                  claim.id === claimId ? { ...claim, bidAmount: newBid } : claim
                ));
              }}
              onRemoveClaim={handleRemoveClaim}
            />
          </TabsContent>

          {/* Priority Manager Tab */}
          <TabsContent value="priority" className="space-y-4">
            <WaiverPriorityManager 
              claims={waiverClaims}
              onReorderClaims={(newOrder) => setWaiverClaims(newOrder)}
            />
          </TabsContent>

          {/* Drop Candidates Tab */}
          <TabsContent value="drops" className="space-y-4">
            <DropCandidateSelector 
              onSelectDrop={(playerId) => {
                // Handle drop selection logic
                logger.info('Selected player to drop:', { data: playerId });
              }}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
};

export default WaiversPage;
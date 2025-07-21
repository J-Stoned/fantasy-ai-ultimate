'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import useLeagueStore from '../../stores/useLeagueStore';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { ScrollArea } from '../ui/scroll-area';
import { PlatformImportWizard } from './PlatformImportWizard';
import { CrossPlatformTradeAnalyzer } from './CrossPlatformTradeAnalyzer';
import { LineupOptimizer } from './LineupOptimizer';
// import { PatternAlerts } from './PatternAlerts'; // Removed - pattern detection failed

export function UnifiedDashboard() {
  const [showImportWizard, setShowImportWizard] = useState(false);
  const [selectedSport, setSelectedSport] = useState<string>('all');
  
  const {
    leagues,
    selectedLeagueId,
    selectLeague,
    getConnectedPlatforms,
    getTotalLeagues,
    getLeaguesBySport,
    syncAllLeagues,
  } = useLeagueStore();
  
  const connectedPlatforms = getConnectedPlatforms();
  const totalLeagues = getTotalLeagues();
  const allLeagues = Array.from(leagues.values());
  const filteredLeagues = selectedSport === 'all' 
    ? allLeagues 
    : allLeagues.filter(l => l.sport === selectedSport);
  
  // Auto-sync on mount and periodically
  useEffect(() => {
    syncAllLeagues();
    const interval = setInterval(syncAllLeagues, 5 * 60 * 1000); // Every 5 minutes
    return () => clearInterval(interval);
  }, []);
  
  const getPlatformColor = (platform: string) => {
    const colors: Record<string, string> = {
      espn: 'bg-red-600',
      yahoo: 'bg-purple-600',
      sleeper: 'bg-orange-600',
      cbs: 'bg-blue-600',
      draftkings: 'bg-green-600',
      fanduel: 'bg-blue-700',
    };
    return colors[platform] || 'bg-gray-600';
  };
  
  const getSportEmoji = (sport: string) => {
    const emojis: Record<string, string> = {
      nfl: '🏈',
      nba: '🏀',
      mlb: '⚾',
      nhl: '🏒',
      ncaa_fb: '🏈',
      ncaa_bb: '🏀',
    };
    return emojis[sport] || '🏆';
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      {/* Header */}
      <div className="bg-black/20 backdrop-blur-lg border-b border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
            <div>
              <h1 className="text-2xl font-bold text-white">AI Command Center</h1>
              <p className="text-gray-400">
                {totalLeagues} leagues across {connectedPlatforms.length} platforms
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button
                onClick={() => setShowImportWizard(true)}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Import Leagues
              </Button>
              
              <Button
                onClick={syncAllLeagues}
                variant="outline"
                className="bg-white/10 border-white/20 text-white hover:bg-white/20"
              >
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Sync All
              </Button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Leagues List */}
          <div className="lg:col-span-1">
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <div className="p-4 border-b border-white/10">
                <h2 className="text-lg font-semibold text-white">Your Leagues</h2>
                
                {/* Sport Filter */}
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    size="sm"
                    variant={selectedSport === 'all' ? 'default' : 'outline'}
                    onClick={() => setSelectedSport('all')}
                    className="text-xs"
                  >
                    All Sports
                  </Button>
                  {['nfl', 'nba', 'mlb', 'nhl'].map((sport) => (
                    <Button
                      key={sport}
                      size="sm"
                      variant={selectedSport === sport ? 'default' : 'outline'}
                      onClick={() => setSelectedSport(sport)}
                      className="text-xs"
                    >
                      {getSportEmoji(sport)} {sport.toUpperCase()}
                    </Button>
                  ))}
                </div>
              </div>
              
              <ScrollArea className="h-[calc(100vh-300px)]">
                <div className="p-4 space-y-2">
                  {filteredLeagues.length === 0 ? (
                    <div className="text-center py-8">
                      <p className="text-gray-400 mb-4">No leagues found</p>
                      <Button
                        size="sm"
                        onClick={() => setShowImportWizard(true)}
                      >
                        Import Your First League
                      </Button>
                    </div>
                  ) : (
                    filteredLeagues.map((league) => (
                      <motion.button
                        key={league.id}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => selectLeague(league.id)}
                        className={`
                          w-full p-3 rounded-lg text-left transition-all
                          ${selectedLeagueId === league.id 
                            ? 'bg-white/20 border border-white/30' 
                            : 'bg-white/5 hover:bg-white/10 border border-transparent'
                          }
                        `}
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex-1">
                            <h3 className="font-medium text-white text-sm">
                              {league.name}
                            </h3>
                            <p className="text-xs text-gray-400">
                              {league.myTeamName || 'My Team'}
                            </p>
                          </div>
                          <Badge
                            className={`${getPlatformColor(league.platform)} text-white text-xs`}
                          >
                            {league.platform}
                          </Badge>
                        </div>
                        
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-400">
                            {getSportEmoji(league.sport)} {league.sport.toUpperCase()}
                          </span>
                          {league.currentStanding && (
                            <span className="text-gray-300">
                              #{league.currentStanding} / {league.teamCount}
                            </span>
                          )}
                        </div>
                      </motion.button>
                    ))
                  )}
                </div>
              </ScrollArea>
            </Card>
          </div>
          
          {/* Right Column - League Details & Actions */}
          <div className="lg:col-span-2 space-y-6">
            {/* Pattern Alerts - Removed (pattern detection failed) */}
            
            {/* Main Tabs */}
            <Card className="bg-white/10 backdrop-blur-lg border-white/20">
              <Tabs defaultValue="overview" className="w-full">
                <TabsList className="w-full bg-white/5">
                  <TabsTrigger value="overview" className="flex-1">Overview</TabsTrigger>
                  <TabsTrigger value="lineup" className="flex-1">Lineup</TabsTrigger>
                  <TabsTrigger value="trades" className="flex-1">Trades</TabsTrigger>
                  <TabsTrigger value="insights" className="flex-1">AI Insights</TabsTrigger>
                </TabsList>
                
                <TabsContent value="overview" className="p-4">
                  {selectedLeagueId ? (
                    <LeagueOverview leagueId={selectedLeagueId} />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-400">Select a league to view details</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="lineup" className="p-4">
                  {selectedLeagueId ? (
                    <LineupOptimizer leagueId={selectedLeagueId} />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-400">Select a league to optimize lineup</p>
                    </div>
                  )}
                </TabsContent>
                
                <TabsContent value="trades" className="p-4">
                  <CrossPlatformTradeAnalyzer />
                </TabsContent>
                
                <TabsContent value="insights" className="p-4">
                  {selectedLeagueId ? (
                    <AIInsights leagueId={selectedLeagueId} />
                  ) : (
                    <div className="text-center py-12">
                      <p className="text-gray-400">Select a league to view AI insights</p>
                    </div>
                  )}
                </TabsContent>
              </Tabs>
            </Card>
          </div>
        </div>
      </div>
      
      {/* Import Wizard Modal */}
      {showImportWizard && (
        <PlatformImportWizard onClose={() => setShowImportWizard(false)} />
      )}
    </div>
  );
}

// League Overview Component
function LeagueOverview({ leagueId }: { leagueId: string }) {
  const league = useLeagueStore((state) => state.leagues.get(leagueId));
  
  if (!league) return null;
  
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white/5 rounded-lg p-4">
          <h4 className="text-sm text-gray-400 mb-1">Current Standing</h4>
          <p className="text-2xl font-bold text-white">
            {league.currentStanding || '-'} / {league.teamCount}
          </p>
        </div>
        
        <div className="bg-white/5 rounded-lg p-4">
          <h4 className="text-sm text-gray-400 mb-1">Scoring Type</h4>
          <p className="text-2xl font-bold text-white capitalize">
            {league.scoringType}
          </p>
        </div>
      </div>
      
      {league.roster && league.roster.length > 0 && (
        <div>
          <h4 className="text-lg font-medium text-white mb-3">Current Roster</h4>
          <div className="space-y-2">
            {league.roster.slice(0, 10).map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between bg-white/5 rounded-lg p-3"
              >
                <div>
                  <p className="font-medium text-white">{player.name}</p>
                  <p className="text-sm text-gray-400">
                    {player.position} - {player.team}
                  </p>
                </div>
                <div className="text-right">
                  {player.projectedPoints && (
                    <p className="text-white">
                      {player.projectedPoints.toFixed(1)} pts
                    </p>
                  )}
                  {player.injuryStatus && (
                    <Badge variant="destructive" className="text-xs">
                      {player.injuryStatus}
                    </Badge>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      
      <div className="flex items-center justify-between text-sm text-gray-400">
        <span>
          Last synced: {league.lastSynced 
            ? new Date(league.lastSynced).toLocaleString() 
            : 'Never'
          }
        </span>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => useLeagueStore.getState().refreshLeague(leagueId)}
        >
          Refresh
        </Button>
      </div>
    </div>
  );
}

// AI Insights Component
function AIInsights({ leagueId }: { leagueId: string }) {
  const league = useLeagueStore((state) => state.leagues.get(leagueId));
  const [insights, setInsights] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    fetchInsights();
  }, [leagueId]);
  
  const fetchInsights = async () => {
    try {
      setLoading(true);
      // This would call your pattern detection API
      const response = await fetch(`/api/patterns?leagueId=${leagueId}`);
      const data = await response.json();
      setInsights(data.insights || []);
    } catch (error) {
      console.error('Failed to fetch insights:', error);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white mx-auto"></div>
        <p className="text-gray-400 mt-2">Analyzing patterns...</p>
      </div>
    );
  }
  
  return (
    <div className="space-y-4">
      <h4 className="text-lg font-medium text-white">AI-Powered Insights</h4>
      
      {insights.length === 0 ? (
        <p className="text-gray-400">No insights available yet. Check back after games are played.</p>
      ) : (
        <div className="space-y-3">
          {insights.map((insight, index) => (
            <div
              key={index}
              className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg p-4 border border-purple-500/30"
            >
              <div className="flex items-start gap-3">
                <div className="text-2xl">{insight.emoji || '💡'}</div>
                <div className="flex-1">
                  <h5 className="font-medium text-white mb-1">{insight.title}</h5>
                  <p className="text-sm text-gray-300">{insight.description}</p>
                  {insight.confidence && (
                    <div className="mt-2">
                      <Badge variant="outline" className="text-xs">
                        {(insight.confidence * 100).toFixed(0)}% confidence
                      </Badge>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
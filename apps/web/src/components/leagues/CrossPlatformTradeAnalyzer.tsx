'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import useLeagueStore from '../../stores/useLeagueStore';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Select } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';

interface TradePlayer {
  id: string;
  name: string;
  team: string;
  position: string;
  platforms: {
    platform: string;
    leagueId: string;
    leagueName: string;
    value: number;
    projectedPoints: number;
    seasonPoints: number;
  }[];
  averageValue: number;
  valueVariance: number;
}

export function CrossPlatformTradeAnalyzer() {
  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [tradeSide, setTradeSide] = useState<'give' | 'get'>('give');
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState<string>('all');
  const [tradeAnalysis, setTradeAnalysis] = useState<any>(null);
  
  const { leagues, unifiedRoster, buildUnifiedRoster } = useLeagueStore();
  
  // Build unified roster on mount
  useEffect(() => {
    buildUnifiedRoster();
  }, [leagues]);
  
  // Convert unified roster to trade players
  const tradePlayers: TradePlayer[] = Array.from(unifiedRoster.entries()).map(([id, players]) => {
    const platforms = players.map(player => {
      const league = Array.from(leagues.values()).find(l => 
        l.roster?.some(p => p.id === player.id)
      );
      
      return {
        platform: player.platform || league?.platform || '',
        leagueId: league?.id || '',
        leagueName: league?.name || '',
        value: calculatePlayerValue(player),
        projectedPoints: player.projectedPoints || 0,
        seasonPoints: player.seasonPoints || 0,
      };
    }).filter(p => p.platform);
    
    const values = platforms.map(p => p.value);
    const averageValue = values.reduce((a, b) => a + b, 0) / values.length;
    const valueVariance = Math.sqrt(
      values.reduce((sum, val) => sum + Math.pow(val - averageValue, 2), 0) / values.length
    );
    
    return {
      id,
      name: players[0].name,
      team: players[0].team,
      position: players[0].position,
      platforms,
      averageValue,
      valueVariance,
    };
  });
  
  // Filter players
  const filteredPlayers = tradePlayers.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         player.team.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPosition = positionFilter === 'all' || player.position === positionFilter;
    return matchesSearch && matchesPosition;
  });
  
  // Calculate player value based on various factors
  function calculatePlayerValue(player: any): number {
    const baseValue = player.projectedPoints || 0;
    const performanceBonus = (player.seasonPoints || 0) / 10;
    const injuryPenalty = player.injuryStatus ? -5 : 0;
    return Math.max(0, baseValue + performanceBonus + injuryPenalty);
  }
  
  // Analyze trade
  const analyzeTrade = () => {
    const givePlayers = selectedPlayers.filter(id => 
      tradePlayers.find(p => p.id === id && p.platforms.length > 0)
    );
    const getPlayers = []; // Would be populated from another selection
    
    // Calculate trade values across platforms
    const analysis = {
      overallScore: 0,
      platformScores: new Map(),
      recommendations: [],
      warnings: [],
    };
    
    // Analyze for each platform
    const platforms = new Set(
      givePlayers.flatMap(id => 
        tradePlayers.find(p => p.id === id)?.platforms.map(p => p.platform) || []
      )
    );
    
    platforms.forEach(platform => {
      const giveValue = givePlayers.reduce((sum, id) => {
        const player = tradePlayers.find(p => p.id === id);
        const platformData = player?.platforms.find(p => p.platform === platform);
        return sum + (platformData?.value || 0);
      }, 0);
      
      // Calculate platform-specific score
      const score = 0; // Would calculate based on get players too
      analysis.platformScores.set(platform, { giveValue, getValue: 0, score });
    });
    
    setTradeAnalysis(analysis);
  };
  
  const togglePlayerSelection = (playerId: string) => {
    setSelectedPlayers(prev => 
      prev.includes(playerId) 
        ? prev.filter(id => id !== playerId)
        : [...prev, playerId]
    );
  };
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-xl font-semibold text-white mb-2">
          Cross-Platform Trade Analyzer
        </h3>
        <p className="text-gray-400">
          Compare player values across all your fantasy platforms
        </p>
      </div>
      
      {/* Search and Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <Input
          placeholder="Search players..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-gray-400"
        />
        
        <Select 
          value={positionFilter} 
          onChange={(e) => setPositionFilter(e.target.value)}
          className="w-full sm:w-40 bg-white/10 border-white/20 text-white"
        >
          <option value="all">All Positions</option>
          <option value="QB">QB</option>
          <option value="RB">RB</option>
          <option value="WR">WR</option>
          <option value="TE">TE</option>
          <option value="DEF">DEF</option>
          <option value="K">K</option>
        </Select>
      </div>
      
      {/* Trade Builder */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Player List */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <div className="p-4 border-b border-white/10">
            <h4 className="font-medium text-white">Available Players</h4>
            <p className="text-sm text-gray-400 mt-1">
              {filteredPlayers.length} players across {leagues.size} leagues
            </p>
          </div>
          
          <div className="p-4 space-y-2 max-h-[500px] overflow-y-auto">
            {filteredPlayers.map((player) => (
              <motion.div
                key={player.id}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => togglePlayerSelection(player.id)}
                className={`
                  p-3 rounded-lg cursor-pointer transition-all
                  ${selectedPlayers.includes(player.id)
                    ? 'bg-purple-600/30 border border-purple-500/50'
                    : 'bg-white/5 hover:bg-white/10 border border-transparent'
                  }
                `}
              >
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <h5 className="font-medium text-white">{player.name}</h5>
                    <p className="text-sm text-gray-400">
                      {player.position} - {player.team}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {player.platforms.length} leagues
                  </Badge>
                </div>
                
                {/* Platform Values */}
                <div className="space-y-1">
                  {player.platforms.map((platform, idx) => (
                    <div key={idx} className="flex items-center justify-between text-xs">
                      <span className="text-gray-400">
                        {platform.platform} - {platform.leagueName}
                      </span>
                      <span className="text-white">
                        {platform.value.toFixed(1)} pts
                      </span>
                    </div>
                  ))}
                </div>
                
                {/* Value Variance Indicator */}
                {player.valueVariance > 5 && (
                  <div className="mt-2">
                    <Badge variant="destructive" className="text-xs">
                      High value variance across platforms
                    </Badge>
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </Card>
        
        {/* Trade Summary */}
        <Card className="bg-white/10 backdrop-blur-lg border-white/20">
          <div className="p-4 border-b border-white/10">
            <h4 className="font-medium text-white">Trade Summary</h4>
          </div>
          
          <div className="p-4">
            <Tabs defaultValue="give" className="w-full">
              <TabsList className="grid w-full grid-cols-2 bg-white/5">
                <TabsTrigger value="give">Players to Give</TabsTrigger>
                <TabsTrigger value="get">Players to Get</TabsTrigger>
              </TabsList>
              
              <TabsContent value="give" className="mt-4">
                <div className="space-y-2">
                  {selectedPlayers.length === 0 ? (
                    <p className="text-gray-400 text-center py-8">
                      Select players to trade away
                    </p>
                  ) : (
                    selectedPlayers.map(id => {
                      const player = tradePlayers.find(p => p.id === id);
                      if (!player) return null;
                      
                      return (
                        <div key={id} className="bg-white/5 rounded-lg p-3">
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="font-medium text-white">{player.name}</p>
                              <p className="text-sm text-gray-400">
                                {player.position} - {player.team}
                              </p>
                            </div>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => togglePlayerSelection(id)}
                              className="text-red-400 hover:text-red-300"
                            >
                              Remove
                            </Button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </TabsContent>
              
              <TabsContent value="get" className="mt-4">
                <p className="text-gray-400 text-center py-8">
                  Feature coming soon: Search and add players you want to receive
                </p>
              </TabsContent>
            </Tabs>
            
            {/* Trade Analysis Button */}
            <Button
              onClick={analyzeTrade}
              disabled={selectedPlayers.length === 0}
              className="w-full mt-6"
            >
              Analyze Trade Across All Platforms
            </Button>
            
            {/* Trade Analysis Results */}
            {tradeAnalysis && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mt-6 space-y-4"
              >
                <div className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 rounded-lg p-4 border border-purple-500/30">
                  <h5 className="font-medium text-white mb-2">Trade Analysis</h5>
                  <div className="space-y-2">
                    {Array.from(tradeAnalysis.platformScores.entries()).map(([platform, score]) => (
                      <div key={platform} className="flex items-center justify-between text-sm">
                        <span className="text-gray-300">{platform}</span>
                        <span className="text-white">
                          Give: {score.giveValue.toFixed(1)} pts
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
                
                {tradeAnalysis.recommendations.length > 0 && (
                  <div className="bg-green-900/20 rounded-lg p-4 border border-green-600/30">
                    <h5 className="font-medium text-green-400 mb-2">Recommendations</h5>
                    <ul className="space-y-1 text-sm text-green-300">
                      {tradeAnalysis.recommendations.map((rec: string, idx: number) => (
                        <li key={idx}>• {rec}</li>
                      ))}
                    </ul>
                  </div>
                )}
                
                {tradeAnalysis.warnings.length > 0 && (
                  <div className="bg-red-900/20 rounded-lg p-4 border border-red-600/30">
                    <h5 className="font-medium text-red-400 mb-2">Warnings</h5>
                    <ul className="space-y-1 text-sm text-red-300">
                      {tradeAnalysis.warnings.map((warning: string, idx: number) => (
                        <li key={idx}>• {warning}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </motion.div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
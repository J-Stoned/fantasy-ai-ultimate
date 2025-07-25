'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { 
  Users, 
  TrendingUp, 
  TrendingDown,
  AlertTriangle, 
  Crown,
  Target,
  Activity,
  Zap,
  BarChart3,
  Settings,
  RefreshCw,
  Clock,
  Shield,
  Trophy,
  Star,
  ChevronRight,
  ArrowUpDown,
  Calendar
} from 'lucide-react';
import useLeagueStore from '../../stores/useLeagueStore';
import { Card } from '../../components/ui/card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/button';
import { Progress } from '../../components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/tabs';
import { logger } from '../../lib/logging/logger';

interface Player {
  id: string;
  name: string;
  position: string;
  team: string;
  opponent?: string;
  projectedPoints: number;
  seasonStats: {
    points: number;
    games: number;
    average: number;
  };
  injuryStatus?: 'healthy' | 'questionable' | 'doubtful' | 'out' | 'ir';
  byeWeek?: number;
  isLocked?: boolean;
  gameTime?: string;
  matchupRating?: 'elite' | 'good' | 'average' | 'poor' | 'avoid';
  trends: {
    weekly: number; // % change from last week
    monthly: number; // % change from last month
    direction: 'up' | 'down' | 'stable';
  };
  ownership?: number; // % owned in leagues
  tradeValue?: number;
  contractInfo?: {
    salary?: number;
    yearsRemaining?: number;
    isKeeper?: boolean;
  };
}

interface LineupSlot {
  position: string;
  player?: Player;
  isRequired: boolean;
  maxCount?: number;
}

interface League {
  id: string;
  name: string;
  platform: string;
  sport: string;
  scoring: string;
  roster: Player[];
  lineupSlots: LineupSlot[];
  settings: {
    rosterSize: number;
    lineupSize: number;
    tradeDeadline?: string;
    waiverType: string;
  };
}

export default function RosterManagementPage() {
  const [selectedLeague, setSelectedLeague] = useState<string>('');
  const [roster, setRoster] = useState<Player[]>([]);
  const [lineup, setLineup] = useState<LineupSlot[]>([]);
  const [bench, setBench] = useState<Player[]>([]);
  const [activeTab, setActiveTab] = useState('lineup');
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [optimizing, setOptimizing] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  
  const leagues = useLeagueStore((state) => Array.from(state.leagues.values()));
  
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      const ws = new WebSocket(`ws://localhost:3001?token=${localStorage.getItem('auth_token')}`);
      
      ws.onopen = () => {
        setWsConnected(true);
        logger.info('WebSocket connected');
        
        // Subscribe to roster updates
        ws.send(JSON.stringify({
          type: 'subscribe',
          channel: `user:${getUserId()}:roster`
        }));
      };
      
      ws.onmessage = (event) => {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      };
      
      ws.onclose = () => {
        setWsConnected(false);
        logger.info('WebSocket disconnected');
        // Reconnect after 3 seconds
        setTimeout(connectWebSocket, 3000);
      };
    };
    
    connectWebSocket();
  }, []);

  // Load league data
  useEffect(() => {
    if (selectedLeague) {
      loadLeagueRoster(selectedLeague);
    }
  }, [selectedLeague]);

  // Auto-select first league
  useEffect(() => {
    if (leagues.length > 0 && !selectedLeague) {
      setSelectedLeague(leagues[0].id);
    }
  }, [leagues]);

  const loadLeagueRoster = async (leagueId: string) => {
    try {
      const response = await fetch(`/api/roster?leagueId=${leagueId}`);
      const data = await response.json();
      
      if (data.success) {
        setRoster(data.roster || []);
        setLineup(data.lineup || []);
        setBench(data.bench || []);
        setLastUpdated(new Date());
      }
    } catch (error) {
      logger.error('Failed to load roster:', { error: error });
    }
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'roster:updated':
        setRoster(message.data.roster);
        setLastUpdated(new Date());
        break;
      case 'player:injury':
        updatePlayerInjuryStatus(message.data.playerId, message.data.status);
        break;
      case 'lineup:optimized':
        setLineup(message.data.lineup);
        setRecommendations(message.data.recommendations);
        setOptimizing(false);
        break;
    }
  };

  const updatePlayerInjuryStatus = (playerId: string, status: string) => {
    setRoster(prev => prev.map(player => 
      player.id === playerId 
        ? { ...player, injuryStatus: status as any }
        : player
    ));
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (!over || active.id === over.id) return;

    const activePlayer = roster.find(p => p.id === active.id);
    if (!activePlayer) return;

    // Update lineup
    const newLineup = [...lineup];
    const targetSlotIndex = newLineup.findIndex(slot => slot.position === over.id);
    
    if (targetSlotIndex !== -1) {
      // Remove player from current position
      const currentSlotIndex = newLineup.findIndex(slot => slot.player?.id === activePlayer.id);
      if (currentSlotIndex !== -1) {
        newLineup[currentSlotIndex] = {
          ...newLineup[currentSlotIndex],
          player: undefined
        };
      }
      
      // Add to new position
      newLineup[targetSlotIndex] = {
        ...newLineup[targetSlotIndex],
        player: activePlayer
      };
      
      setLineup(newLineup);
      
      // Save lineup changes
      await saveLineupChanges(newLineup);
    }
  };

  const saveLineupChanges = async (newLineup: LineupSlot[]) => {
    try {
      const response = await fetch('/api/roster/lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: selectedLeague,
          lineup: newLineup
        }),
      });
      
      if (response.ok) {
        logger.info('Lineup saved successfully');
      }
    } catch (error) {
      logger.error('Failed to save lineup:', { error: error });
    }
  };

  const optimizeLineup = async () => {
    setOptimizing(true);
    
    try {
      const response = await fetch('/api/roster/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: selectedLeague,
          currentLineup: lineup,
          bench: bench
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRecommendations(data.recommendations);
        if (data.optimizedLineup) {
          setLineup(data.optimizedLineup);
        }
      }
    } catch (error) {
      logger.error('Optimization failed:', { error: error });
    } finally {
      setOptimizing(false);
    }
  };

  const togglePlayerSelection = (playerId: string) => {
    const newSelection = new Set(selectedPlayers);
    if (newSelection.has(playerId)) {
      newSelection.delete(playerId);
    } else {
      newSelection.add(playerId);
    }
    setSelectedPlayers(newSelection);
  };

  const getInjuryBadgeColor = (status?: string) => {
    switch (status) {
      case 'out': return 'bg-red-500';
      case 'doubtful': return 'bg-red-400';
      case 'questionable': return 'bg-yellow-500';
      case 'ir': return 'bg-gray-500';
      default: return 'bg-green-500';
    }
  };

  const getMatchupColor = (rating?: string) => {
    switch (rating) {
      case 'elite': return 'text-green-400';
      case 'good': return 'text-green-300';
      case 'average': return 'text-yellow-400';
      case 'poor': return 'text-orange-400';
      case 'avoid': return 'text-red-400';
      default: return 'text-gray-400';
    }
  };

  const getUserId = () => {
    // Get user ID from auth token or context
    return 'current-user-id';
  };

  const selectedLeagueData = leagues.find(l => l.id === selectedLeague);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-900 via-blue-900 to-purple-900">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
              <Users className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white">Roster Management</h1>
              <p className="text-gray-300">
                Optimize your lineup • Last updated: {lastUpdated.toLocaleTimeString()}
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-sm ${
              wsConnected ? 'bg-green-900/50 text-green-400' : 'bg-red-900/50 text-red-400'
            }`}>
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              {wsConnected ? 'Live' : 'Offline'}
            </div>
            
            <Button
              onClick={() => loadLeagueRoster(selectedLeague)}
              variant="outline"
              size="sm"
              className="bg-white/10 border-white/20"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>

        {/* League Selector */}
        <Card className="glass-card mb-6">
          <div className="p-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white mb-4">Select League</h3>
              <Badge variant="outline" className="text-xs">
                {leagues.length} leagues
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {leagues.map((league) => (
                <motion.div
                  key={league.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setSelectedLeague(league.id)}
                  className={`p-4 rounded-lg cursor-pointer border-2 transition-all ${
                    selectedLeague === league.id
                      ? 'border-blue-500 bg-blue-500/20'
                      : 'border-white/10 bg-white/5 hover:border-white/20'
                  }`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium text-white">{league.name}</h4>
                    <Badge variant="secondary" className="text-xs">
                      {league.platform}
                    </Badge>
                  </div>
                  <p className="text-sm text-gray-400">
                    {league.sport} • {league.scoring}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </Card>

        {selectedLeagueData && (
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="grid w-full grid-cols-4 bg-white/10 mb-6">
              <TabsTrigger value="lineup" className="data-[state=active]:bg-white/20">
                <Target className="w-4 h-4 mr-2" />
                Lineup
              </TabsTrigger>
              <TabsTrigger value="roster" className="data-[state=active]:bg-white/20">
                <Users className="w-4 h-4 mr-2" />
                Full Roster
              </TabsTrigger>
              <TabsTrigger value="analysis" className="data-[state=active]:bg-white/20">
                <BarChart3 className="w-4 h-4 mr-2" />
                Analysis
              </TabsTrigger>
              <TabsTrigger value="trades" className="data-[state=active]:bg-white/20">
                <ArrowUpDown className="w-4 h-4 mr-2" />
                Trades
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lineup" className="space-y-6">
              <LineupManager
                lineup={lineup}
                bench={bench}
                roster={roster}
                onDragEnd={handleDragEnd}
                sensors={sensors}
                optimizing={optimizing}
                onOptimize={optimizeLineup}
                recommendations={recommendations}
              />
            </TabsContent>

            <TabsContent value="roster" className="space-y-6">
              <RosterOverview
                roster={roster}
                selectedPlayers={selectedPlayers}
                onPlayerSelect={togglePlayerSelection}
                league={selectedLeagueData}
              />
            </TabsContent>

            <TabsContent value="analysis" className="space-y-6">
              <RosterAnalysis
                roster={roster}
                lineup={lineup}
                league={selectedLeagueData}
              />
            </TabsContent>

            <TabsContent value="trades" className="space-y-6">
              <TradeCenter
                roster={roster}
                league={selectedLeagueData}
              />
            </TabsContent>
          </Tabs>
        )}
      </div>
    </div>
  );
}

// Lineup Manager Component
function LineupManager({ 
  lineup, 
  bench, 
  roster, 
  onDragEnd, 
  sensors, 
  optimizing, 
  onOptimize, 
  recommendations 
}: {
  lineup: LineupSlot[];
  bench: Player[];
  roster: Player[];
  onDragEnd: (event: DragEndEvent) => void;
  sensors: any;
  optimizing: boolean;
  onOptimize: () => void;
  recommendations: any[];
}) {
  const totalProjected = lineup.reduce((sum, slot) => sum + (slot.player?.projectedPoints || 0), 0);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Starting Lineup */}
      <div className="lg:col-span-2">
        <Card className="glass-card">
          <div className="p-4 border-b border-white/10">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-white">Starting Lineup</h3>
              <div className="text-right">
                <p className="text-2xl font-bold text-white">{totalProjected.toFixed(1)}</p>
                <p className="text-xs text-gray-400">Projected Points</p>
              </div>
            </div>
          </div>

          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext
              items={roster.map(p => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="p-4 space-y-2">
                {lineup.map((slot, index) => (
                  <LineupSlotCard key={`${slot.position}-${index}`} slot={slot} />
                ))}
              </div>
            </SortableContext>
          </DndContext>

          <div className="p-4 border-t border-white/10">
            <Button
              onClick={onOptimize}
              disabled={optimizing}
              className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
            >
              {optimizing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Optimizing...
                </>
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-2" />
                  AI Optimize Lineup
                </>
              )}
            </Button>
          </div>
        </Card>
      </div>

      {/* Bench & Recommendations */}
      <div className="space-y-6">
        {/* Bench */}
        <Card className="glass-card">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-semibold text-white">Bench ({bench.length})</h3>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {bench.map((player) => (
              <PlayerCard key={player.id} player={player} compact />
            ))}
          </div>
        </Card>

        {/* AI Recommendations */}
        {recommendations.length > 0 && (
          <Card className="glass-card bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-purple-500/30">
            <div className="p-4 border-b border-purple-500/30">
              <h3 className="font-semibold text-white flex items-center">
                <Star className="w-5 h-5 mr-2 text-yellow-400" />
                AI Recommendations
              </h3>
            </div>
            <div className="p-4 space-y-3">
              {recommendations.slice(0, 3).map((rec, idx) => (
                <div key={idx} className="bg-black/20 rounded-lg p-3">
                  <p className="text-sm text-white font-medium">{rec.title}</p>
                  <p className="text-xs text-gray-300 mt-1">{rec.description}</p>
                  <Badge variant="outline" className="mt-2 text-xs">
                    +{rec.expectedGain?.toFixed(1)} pts
                  </Badge>
                </div>
              ))}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}

// Lineup Slot Card Component
function LineupSlotCard({ slot }: { slot: LineupSlot }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ 
    id: slot.position,
    disabled: !slot.player
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      whileHover={{ scale: 1.01 }}
      className={`
        bg-white/5 rounded-lg p-4 cursor-move border
        ${slot.player ? 'border-white/20' : 'border-dashed border-white/10'}
        ${slot.isRequired && !slot.player ? 'border-red-500/50' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="min-w-[3rem] text-center">
            {slot.position}
          </Badge>
          
          {slot.player ? (
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="font-medium text-white">{slot.player.name}</p>
                {slot.player.injuryStatus && slot.player.injuryStatus !== 'healthy' && (
                  <div className={`w-2 h-2 rounded-full ${
                    slot.player.injuryStatus === 'out' ? 'bg-red-500' :
                    slot.player.injuryStatus === 'doubtful' ? 'bg-red-400' :
                    slot.player.injuryStatus === 'questionable' ? 'bg-yellow-500' :
                    'bg-gray-500'
                  }`} />
                )}
              </div>
              <p className="text-sm text-gray-400">
                {slot.player.team} vs {slot.player.opponent || 'TBD'}
                {slot.player.gameTime && (
                  <span className="ml-2">• {slot.player.gameTime}</span>
                )}
              </p>
            </div>
          ) : (
            <p className="text-gray-500 italic">Empty slot</p>
          )}
        </div>
        
        {slot.player && (
          <div className="text-right">
            <p className="text-lg font-bold text-white">
              {slot.player.projectedPoints.toFixed(1)}
            </p>
            <p className="text-xs text-gray-400">projected</p>
            {slot.player.matchupRating && (
              <Badge 
                variant="outline" 
                className={`text-xs mt-1 ${getMatchupColor(slot.player.matchupRating)}`}
              >
                {slot.player.matchupRating}
              </Badge>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// Player Card Component
function PlayerCard({ player, compact = false }: { player: Player; compact?: boolean }) {
  return (
    <div className="bg-white/5 rounded-lg p-3 flex items-center justify-between">
      <div className="flex items-center gap-3">
        <Badge variant="outline" className="text-xs min-w-[2.5rem] text-center">
          {player.position}
        </Badge>
        <div>
          <div className="flex items-center gap-2">
            <p className="font-medium text-white text-sm">{player.name}</p>
            {player.injuryStatus && player.injuryStatus !== 'healthy' && (
              <div className={`w-2 h-2 rounded-full ${getInjuryBadgeColor(player.injuryStatus)}`} />
            )}
          </div>
          <p className="text-xs text-gray-400">
            {player.team} • {player.seasonStats.average.toFixed(1)} avg
          </p>
        </div>
      </div>
      
      <div className="text-right">
        <p className="text-white font-medium">{player.projectedPoints.toFixed(1)}</p>
        {player.trends.direction !== 'stable' && (
          <div className="flex items-center gap-1 text-xs">
            {player.trends.direction === 'up' ? (
              <TrendingUp className="w-3 h-3 text-green-400" />
            ) : (
              <TrendingDown className="w-3 h-3 text-red-400" />
            )}
            <span className={player.trends.direction === 'up' ? 'text-green-400' : 'text-red-400'}>
              {Math.abs(player.trends.weekly)}%
            </span>
          </div>
        )}
      </div>
    </div>
  );
}

// Roster Overview Component
function RosterOverview({ 
  roster, 
  selectedPlayers, 
  onPlayerSelect, 
  league 
}: {
  roster: Player[];
  selectedPlayers: Set<string>;
  onPlayerSelect: (playerId: string) => void;
  league: any;
}) {
  const positions = ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'];
  
  return (
    <div className="space-y-6">
      {positions.map(position => {
        const positionPlayers = roster.filter(p => p.position === position);
        
        return (
          <Card key={position} className="glass-card">
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold text-white">{position}</h3>
                <Badge variant="outline">{positionPlayers.length} players</Badge>
              </div>
            </div>
            
            <div className="p-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {positionPlayers.map(player => (
                  <motion.div
                    key={player.id}
                    whileHover={{ scale: 1.02 }}
                    onClick={() => onPlayerSelect(player.id)}
                    className={`
                      p-4 rounded-lg cursor-pointer border transition-all
                      ${selectedPlayers.has(player.id)
                        ? 'border-blue-500 bg-blue-500/20'
                        : 'border-white/10 bg-white/5 hover:border-white/20'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <h4 className="font-medium text-white">{player.name}</h4>
                      <div className="flex items-center gap-2">
                        {player.injuryStatus && player.injuryStatus !== 'healthy' && (
                          <Badge variant="destructive" className="text-xs">
                            {player.injuryStatus.toUpperCase()}
                          </Badge>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {player.team}
                        </Badge>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-4 text-sm">
                      <div>
                        <p className="text-gray-400">Projected</p>
                        <p className="text-white font-medium">{player.projectedPoints.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Season Avg</p>
                        <p className="text-white font-medium">{player.seasonStats.average.toFixed(1)}</p>
                      </div>
                      <div>
                        <p className="text-gray-400">Games</p>
                        <p className="text-white font-medium">{player.seasonStats.games}</p>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// Roster Analysis Component
function RosterAnalysis({ roster, lineup, league }: {
  roster: Player[];
  lineup: LineupSlot[];
  league: any;
}) {
  const startingPlayers = lineup.filter(slot => slot.player).map(slot => slot.player!);
  const benchPlayers = roster.filter(p => !startingPlayers.find(sp => sp.id === p.id));
  
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="glass-card">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Roster Strength</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Add roster analysis content */}
          <div className="text-center py-8 text-gray-400">
            Roster analysis coming soon...
          </div>
        </div>
      </Card>
      
      <Card className="glass-card">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Improvement Areas</h3>
        </div>
        <div className="p-4 space-y-4">
          {/* Add improvement suggestions */}
          <div className="text-center py-8 text-gray-400">
            Improvement suggestions coming soon...
          </div>
        </div>
      </Card>
    </div>
  );
}

// Trade Center Component
function TradeCenter({ roster, league }: {
  roster: Player[];
  league: any;
}) {
  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Trade Analyzer</h3>
        </div>
        <div className="p-4">
          <div className="text-center py-8 text-gray-400">
            Trade analysis tools coming soon...
          </div>
        </div>
      </Card>
    </div>
  );
}

// Helper functions
function getMatchupColor(rating?: string) {
  switch (rating) {
    case 'elite': return 'text-green-400';
    case 'good': return 'text-green-300';
    case 'average': return 'text-yellow-400';
    case 'poor': return 'text-orange-400';
    case 'avoid': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

function getInjuryBadgeColor(status?: string) {
  switch (status) {
    case 'out': return 'bg-red-500';
    case 'doubtful': return 'bg-red-400';
    case 'questionable': return 'bg-yellow-500';
    case 'ir': return 'bg-gray-500';
    default: return 'bg-green-500';
  }
}
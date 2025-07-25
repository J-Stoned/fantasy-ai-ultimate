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
  Calendar,
  DollarSign,
  Percent,
  Eye,
  Heart,
  UserCheck
} from 'lucide-react';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
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
    weekly: number;
    monthly: number;
    direction: 'up' | 'down' | 'stable';
  };
  ownership?: number;
  tradeValue?: number;
  contractInfo?: {
    salary?: number;
    yearsRemaining?: number;
    isKeeper?: boolean;
  };
  fantasyRelevance?: number; // 0-100 scale
  targetShare?: number;
  redZoneTargets?: number;
  consistency?: number;
}

interface LineupSlot {
  position: string;
  player?: Player;
  isRequired: boolean;
  maxCount?: number;
}

interface RosterAnalysis {
  overallGrade: string;
  totalProjected: number;
  riskLevel: 'low' | 'moderate' | 'high';
  strengths: string[];
  weaknesses: string[];
  recommendations: any[];
  ceiling: number;
  floor: number;
  consistency: number;
}

interface FantasyRosterManagerProps {
  leagueId: string;
  initialData?: {
    roster: Player[];
    lineup: LineupSlot[];
    analysis: RosterAnalysis;
  };
  onRosterUpdate?: (roster: Player[]) => void;
  onLineupUpdate?: (lineup: LineupSlot[]) => void;
  className?: string;
}

export function FantasyRosterManager({
  leagueId,
  initialData,
  onRosterUpdate,
  onLineupUpdate,
  className = ''
}: FantasyRosterManagerProps) {
  const [roster, setRoster] = useState<Player[]>(initialData?.roster || []);
  const [lineup, setLineup] = useState<LineupSlot[]>(initialData?.lineup || []);
  const [bench, setBench] = useState<Player[]>([]);
  const [analysis, setAnalysis] = useState<RosterAnalysis | null>(initialData?.analysis || null);
  const [activeTab, setActiveTab] = useState('lineup');
  const [optimizing, setOptimizing] = useState(false);
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [selectedPlayers, setSelectedPlayers] = useState<Set<string>>(new Set());
  const [wsConnected, setWsConnected] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  
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

  // Initialize data
  useEffect(() => {
    if (leagueId && !initialData) {
      loadRosterData();
    }
  }, [leagueId]);

  // Setup WebSocket connection
  useEffect(() => {
    const connectWebSocket = () => {
      try {
        const ws = new WebSocket(`ws://localhost:3001?token=${localStorage.getItem('auth_token')}`);
        
        ws.onopen = () => {
          setWsConnected(true);
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
          setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        logger.error('WebSocket connection failed:', { error: error });
      }
    };
    
    connectWebSocket();
  }, []);

  const loadRosterData = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/roster?leagueId=${leagueId}`);
      const data = await response.json();
      
      if (data.success) {
        setRoster(data.roster || []);
        setLineup(data.lineup || []);
        setBench(data.bench || []);
        setLastUpdated(new Date());
        onRosterUpdate?.(data.roster || []);
        onLineupUpdate?.(data.lineup || []);
      }
    } catch (error) {
      logger.error('Failed to load roster:', { error: error });
    } finally {
      setLoading(false);
    }
  };

  const handleWebSocketMessage = (message: any) => {
    switch (message.type) {
      case 'roster:updated':
        setRoster(message.data.roster);
        setLastUpdated(new Date());
        onRosterUpdate?.(message.data.roster);
        break;
      case 'lineup:updated':
        setLineup(message.data.lineup);
        setAnalysis(message.data.analysis);
        onLineupUpdate?.(message.data.lineup);
        break;
      case 'recommendations:updated':
        setRecommendations(message.data.recommendations);
        break;
      case 'player:injury':
        updatePlayerInjuryStatus(message.data.playerId, message.data.status);
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
      onLineupUpdate?.(newLineup);
      
      // Save changes
      await saveLineupChanges(newLineup);
    }
  };

  const saveLineupChanges = async (newLineup: LineupSlot[]) => {
    try {
      const response = await fetch('/api/roster/lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          lineup: newLineup
        }),
      });
      
      if (response.ok) {
        const data = await response.json();
        setAnalysis(data.analysis);
      }
    } catch (error) {
      logger.error('Failed to save lineup:', { error: error });
    }
  };

  const optimizeLineup = async () => {
    setOptimizing(true);
    
    try {
      const response = await fetch('/api/roster/lineup', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          optimizationType: 'projected_points'
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setLineup(data.optimizedLineup);
        setRecommendations(data.recommendations);
        onLineupUpdate?.(data.optimizedLineup);
      }
    } catch (error) {
      logger.error('Optimization failed:', { error: error });
    } finally {
      setOptimizing(false);
    }
  };

  const getRecommendations = async () => {
    try {
      const response = await fetch('/api/roster/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          currentLineup: lineup,
          bench
        }),
      });
      
      const data = await response.json();
      
      if (data.success) {
        setRecommendations(data.recommendations.startSit || []);
        setAnalysis(prev => ({ ...prev, ...data.analysis }));
      }
    } catch (error) {
      logger.error('Failed to get recommendations:', { error: error });
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

  const getUserId = () => 'current-user-id'; // Get from auth context

  const totalProjected = lineup.reduce((sum, slot) => sum + (slot.player?.projectedPoints || 0), 0);

  if (loading) {
    return (
      <div className={`${className} flex items-center justify-center py-12`}>
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        <span className="ml-3 text-gray-400">Loading roster data...</span>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-gradient-to-r from-blue-600 to-purple-600 rounded-xl">
            <Users className="w-8 h-8 text-white" />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-white">Fantasy Roster Manager</h2>
            <p className="text-gray-300 flex items-center gap-2">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-green-400' : 'bg-red-400'}`} />
              {wsConnected ? 'Live updates' : 'Offline'} • Last updated: {lastUpdated.toLocaleTimeString()}
            </p>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <Button
            onClick={loadRosterData}
            variant="outline"
            size="sm"
            className="bg-white/10 border-white/20"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Refresh
          </Button>
          
          <Button
            onClick={getRecommendations}
            variant="outline"
            size="sm"
            className="bg-purple-600/20 border-purple-500/30 text-purple-300"
          >
            <Star className="w-4 h-4 mr-2" />
            Get AI Tips
          </Button>
        </div>
      </div>

      {/* Quick Stats */}
      {analysis && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="glass-card p-4">
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="text-2xl font-bold text-white">{analysis.overallGrade}</p>
                <p className="text-xs text-gray-400">Overall Grade</p>
              </div>
            </div>
          </Card>
          
          <Card className="glass-card p-4">
            <div className="flex items-center gap-2">
              <Target className="w-5 h-5 text-blue-400" />
              <div>
                <p className="text-2xl font-bold text-white">{totalProjected.toFixed(1)}</p>
                <p className="text-xs text-gray-400">Projected Points</p>
              </div>
            </div>
          </Card>
          
          <Card className="glass-card p-4">
            <div className="flex items-center gap-2">
              <Shield className={`w-5 h-5 ${
                analysis.riskLevel === 'low' ? 'text-green-400' :
                analysis.riskLevel === 'moderate' ? 'text-yellow-400' :
                'text-red-400'
              }`} />
              <div>
                <p className="text-lg font-bold text-white capitalize">{analysis.riskLevel}</p>
                <p className="text-xs text-gray-400">Risk Level</p>
              </div>
            </div>
          </Card>
          
          <Card className="glass-card p-4">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-purple-400" />
              <div>
                <p className="text-2xl font-bold text-white">{(analysis.consistency * 100).toFixed(0)}%</p>
                <p className="text-xs text-gray-400">Consistency</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* AI Recommendations Banner */}
      {recommendations.length > 0 && (
        <Card className="glass-card bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-purple-500/30">
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-white flex items-center">
                <Star className="w-5 h-5 mr-2 text-yellow-400" />
                AI Recommendations ({recommendations.length})
              </h3>
              <Button size="sm" variant="ghost" className="text-purple-300 hover:text-purple-200">
                View All <ChevronRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
            
            <div className="space-y-2">
              {recommendations.slice(0, 2).map((rec, idx) => (
                <div key={idx} className="bg-black/20 rounded-lg p-3 flex items-center justify-between">
                  <div>
                    <p className="text-sm text-white font-medium">{rec.title}</p>
                    <p className="text-xs text-gray-300">{rec.description}</p>
                  </div>
                  {rec.expectedGain && (
                    <Badge variant="outline" className="text-green-400 border-green-400/30">
                      +{rec.expectedGain.toFixed(1)} pts
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* Main Content Tabs */}
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
          <TabsTrigger value="management" className="data-[state=active]:bg-white/20">
            <Settings className="w-4 h-4 mr-2" />
            Management
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
          />
        </TabsContent>

        <TabsContent value="analysis" className="space-y-6">
          <RosterAnalysisView
            roster={roster}
            lineup={lineup}
            analysis={analysis}
          />
        </TabsContent>

        <TabsContent value="management" className="space-y-6">
          <RosterManagement
            roster={roster}
            leagueId={leagueId}
            selectedPlayers={selectedPlayers}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}

// Sub-components

function LineupManager({ 
  lineup, 
  bench, 
  roster, 
  onDragEnd, 
  sensors, 
  optimizing, 
  onOptimize, 
  recommendations 
}: any) {
  const totalProjected = lineup.reduce((sum: number, slot: any) => sum + (slot.player?.projectedPoints || 0), 0);

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
              items={roster.map((p: any) => p.id)}
              strategy={verticalListSortingStrategy}
            >
              <div className="p-4 space-y-2">
                {lineup.map((slot: any, index: number) => (
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

      {/* Bench & Tools */}
      <div className="space-y-6">
        <Card className="glass-card">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-semibold text-white">Bench ({bench.length})</h3>
          </div>
          <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
            {bench.map((player: any) => (
              <PlayerCard key={player.id} player={player} compact />
            ))}
          </div>
        </Card>

        <Card className="glass-card">
          <div className="p-4 border-b border-white/10">
            <h3 className="font-semibold text-white">Quick Actions</h3>
          </div>
          <div className="p-4 space-y-2">
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Eye className="w-4 h-4 mr-2" />
              View Matchups
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Activity className="w-4 h-4 mr-2" />
              Injury Report
            </Button>
            <Button variant="outline" className="w-full justify-start" size="sm">
              <Clock className="w-4 h-4 mr-2" />
              Game Times
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function LineupSlotCard({ slot }: { slot: any }) {
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
                  <div className={`w-2 h-2 rounded-full ${getInjuryColor(slot.player.injuryStatus)}`} />
                )}
                {slot.player.trends.direction !== 'stable' && (
                  <div className="flex items-center">
                    {slot.player.trends.direction === 'up' ? (
                      <TrendingUp className="w-3 h-3 text-green-400" />
                    ) : (
                      <TrendingDown className="w-3 h-3 text-red-400" />
                    )}
                  </div>
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

function PlayerCard({ player, compact = false }: { player: any; compact?: boolean }) {
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
              <div className={`w-2 h-2 rounded-full ${getInjuryColor(player.injuryStatus)}`} />
            )}
          </div>
          <p className="text-xs text-gray-400">
            {player.team} • {player.seasonStats.average.toFixed(1)} avg
            {player.ownership && (
              <span className="ml-2">• {player.ownership.toFixed(0)}% owned</span>
            )}
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

function RosterOverview({ roster, selectedPlayers, onPlayerSelect }: any) {
  const positions = ['QB', 'RB', 'WR', 'TE', 'DEF', 'K'];
  
  return (
    <div className="space-y-6">
      {positions.map(position => {
        const positionPlayers = roster.filter((p: any) => p.position === position);
        
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
                {positionPlayers.map((player: any) => (
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
                        <p className="text-gray-400">Ownership</p>
                        <p className="text-white font-medium">{player.ownership?.toFixed(0) || 0}%</p>
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

function RosterAnalysisView({ roster, lineup, analysis }: any) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <Card className="glass-card">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Roster Strength Analysis</h3>
        </div>
        <div className="p-4 space-y-4">
          {analysis?.strengths?.map((strength: string, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full mt-2"></div>
              <p className="text-gray-300 text-sm">{strength}</p>
            </div>
          ))}
        </div>
      </Card>
      
      <Card className="glass-card">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Areas for Improvement</h3>
        </div>
        <div className="p-4 space-y-4">
          {analysis?.weaknesses?.map((weakness: string, i: number) => (
            <div key={i} className="flex items-start gap-2">
              <div className="w-2 h-2 bg-yellow-400 rounded-full mt-2"></div>
              <p className="text-gray-300 text-sm">{weakness}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RosterManagement({ roster, leagueId, selectedPlayers }: any) {
  return (
    <div className="space-y-6">
      <Card className="glass-card">
        <div className="p-4 border-b border-white/10">
          <h3 className="font-semibold text-white">Roster Actions</h3>
        </div>
        <div className="p-4">
          <div className="text-center py-8 text-gray-400">
            Advanced roster management tools coming soon...
          </div>
        </div>
      </Card>
    </div>
  );
}

// Helper functions
function getInjuryColor(status: string) {
  switch (status) {
    case 'out': return 'bg-red-500';
    case 'doubtful': return 'bg-red-400';
    case 'questionable': return 'bg-yellow-500';
    case 'ir': return 'bg-gray-500';
    default: return 'bg-green-500';
  }
}

function getMatchupColor(rating: string) {
  switch (rating) {
    case 'elite': return 'text-green-400 border-green-400/30';
    case 'good': return 'text-green-300 border-green-300/30';
    case 'average': return 'text-yellow-400 border-yellow-400/30';
    case 'poor': return 'text-orange-400 border-orange-400/30';
    case 'avoid': return 'text-red-400 border-red-400/30';
    default: return 'text-gray-400 border-gray-400/30';
  }
}
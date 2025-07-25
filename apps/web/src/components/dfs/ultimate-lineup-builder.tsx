'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { PlayerAvatar } from '@/components/avatars/PlayerAvatar';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Progress } from '@/components/ui/progress';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  TrendingUp, 
  TrendingDown, 
  Zap, 
  Brain, 
  Target, 
  DollarSign,
  Users,
  AlertTriangle,
  Trophy,
  Flame,
  CloudRain,
  Wind,
  Activity,
  BarChart3,
  Sparkles,
  Rocket,
  Shield,
  Clock,
  RefreshCw,
  Download,
  Upload,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  X,
  Monitor,
  Terminal,
  BarChart4
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

// Import visualization components
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from 'recharts';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { logger } from '../../lib/logging/logger';

// Types
interface Player {
  player_id: string;
  name: string;
  position: string;
  team: string;
  opponent: string;
  salary: number;
  projected_points: number;
  floor: number;
  ceiling: number;
  ownership_projection: number;
  leverage_score: number;
  chalk_score: number;
  contrarian_score: number;
  boom_probability: number;
  bust_probability: number;
  value_rating: number;
  confidence_score: number;
  injury_status?: string;
  injury_risk?: number;
  narrative_factors?: string[];
  stack_partners?: string[];
  game_time?: string;
  weather_impact?: number;
  vegas_total?: number;
  spread?: number;
}

interface Lineup {
  players: Player[];
  totalSalary: number;
  totalProjected: number;
  totalOwnership: number;
  avgLeverage: number;
  stackType?: string;
  confidence: number;
  rank?: number;
}

interface OptimizationSettings {
  sport: string;
  platform: 'draftkings' | 'fanduel';
  contestType: 'GPP' | 'CASH';
  lineupCount: number;
  optimizationStrategy: 'balanced' | 'ceiling' | 'leverage' | 'contrarian';
  minSalaryUsed: number;
  maxOwnership: number;
  enableStacking: boolean;
  enableGPU: boolean;
  diversityWeight: number;
  correlationWeight: number;
}

// Sortable Player Component for Drag & Drop
function SortablePlayer({ player, onRemove, isLocked }: { player: Player; onRemove: () => void; isLocked: boolean }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.player_id, disabled: isLocked });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      className={cn(
        "p-3 bg-white dark:bg-gray-800 rounded-lg border",
        isDragging && "shadow-lg",
        isLocked && "opacity-75"
      )}
      whileHover={{ scale: isLocked ? 1 : 1.02 }}
      whileTap={{ scale: isLocked ? 1 : 0.98 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3" {...(isLocked ? {} : { ...attributes, ...listeners })}>
          <PlayerAvatar 
            playerId={player.player_id}
            size={48}
            showBadge={false}
            animate={true}
          />
          <div className="flex items-center space-x-2">
            <Badge variant={player.position === 'QB' ? 'default' : 'secondary'}>
              {player.position}
            </Badge>
            <div>
              <p className="font-medium">{player.name}</p>
              <p className="text-sm text-gray-500">
                {player.team} vs {player.opponent}
              </p>
            </div>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="text-right">
            <p className="font-medium">${player.salary.toLocaleString()}</p>
            <p className="text-sm text-gray-500">{player.projected_points.toFixed(1)} pts</p>
          </div>
          
          <div className="flex flex-col items-center">
            <Badge 
              variant={player.ownership_projection > 0.25 ? 'destructive' : 
                       player.leverage_score > 2 ? 'default' : 'secondary'}
            >
              {(player.ownership_projection * 100).toFixed(1)}%
            </Badge>
            <span className="text-xs text-gray-500 mt-1">
              {player.leverage_score.toFixed(2)}x
            </span>
          </div>
          
          {!isLocked && (
            <Button
              size="sm"
              variant="ghost"
              onClick={onRemove}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
          
          <Button
            size="sm"
            variant="ghost"
            className="h-8 w-8 p-0"
          >
            {isLocked ? <Lock className="h-4 w-4" /> : <Unlock className="h-4 w-4" />}
          </Button>
        </div>
      </div>
      
      {player.narrative_factors && player.narrative_factors.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {player.narrative_factors.map((factor, i) => (
            <Badge key={i} variant="outline" className="text-xs">
              {factor}
            </Badge>
          ))}
        </div>
      )}
    </motion.div>
  );
}

// Main Component
export default function UltimateLineupBuilder() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [activeTab, setActiveTab] = useState('builder');
  
  // State
  const [settings, setSettings] = useState<OptimizationSettings>({
    sport: 'nfl',
    platform: 'draftkings',
    contestType: 'GPP',
    lineupCount: 20,
    optimizationStrategy: 'balanced',
    minSalaryUsed: 0.95,
    maxOwnership: 0.30,
    enableStacking: true,
    enableGPU: true,
    diversityWeight: 0.7,
    correlationWeight: 0.8
  });
  
  const [playerPool, setPlayerPool] = useState<Player[]>([]);
  const [currentLineup, setCurrentLineup] = useState<Player[]>([]);
  const [savedLineups, setSavedLineups] = useState<Lineup[]>([]);
  const [leveragePlays, setLeveragePlays] = useState<Player[]>([]);
  const [chalkPlays, setChalkPlays] = useState<Player[]>([]);
  const [ownershipData, setOwnershipData] = useState<any>(null);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  const [realtimeUpdates, setRealtimeUpdates] = useState(true);
  const [lockedPlayers, setLockedPlayers] = useState<Set<string>>(new Set());
  
  // WebSocket for real-time updates
  useEffect(() => {
    if (!realtimeUpdates) return;
    
    // In production, connect to WebSocket for real-time updates
    // const ws = new WebSocket('ws://localhost:3001/dfs-updates');
    // ws.onmessage = (event) => {
    //   const update = JSON.parse(event.data);
    //   handleRealtimeUpdate(update);
    // };
    
    // Simulate real-time updates
    const interval = setInterval(() => {
      // Simulate ownership changes
      setPlayerPool(prev => prev.map(p => ({
        ...p,
        ownership_projection: Math.max(0.01, Math.min(0.5, 
          p.ownership_projection + (Math.random() - 0.5) * 0.02
        ))
      })));
    }, 30000); // Every 30 seconds
    
    return () => clearInterval(interval);
  }, [realtimeUpdates]);
  
  // Load initial data
  useEffect(() => {
    loadPlayerPool();
    loadOwnershipData();
  }, [settings.sport, settings.platform]);
  
  const loadPlayerPool = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/predictions?sport=${settings.sport}&platform=${settings.platform}`);
      const data = await response.json();
      
      if (data.success) {
        setPlayerPool(data.predictions);
        
        // Find leverage plays
        const leverage = data.predictions
          .filter((p: Player) => p.leverage_score > 2 && p.ownership_projection < 0.15)
          .sort((a: Player, b: Player) => b.leverage_score - a.leverage_score)
          .slice(0, 10);
        setLeveragePlays(leverage);
        
        // Find chalk
        const chalk = data.predictions
          .filter((p: Player) => p.ownership_projection > 0.20)
          .sort((a: Player, b: Player) => b.ownership_projection - a.ownership_projection)
          .slice(0, 10);
        setChalkPlays(chalk);
      }
    } catch (error) {
      toast({
        title: "Error loading players",
        description: "Failed to load player pool",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  const loadOwnershipData = async () => {
    try {
      const response = await fetch(`/api/ownership?sport=${settings.sport}&contestType=${settings.contestType}`);
      const data = await response.json();
      
      if (data.success) {
        setOwnershipData(data.data);
      }
    } catch (error) {
      logger.error('Failed to load ownership data:', { error: error });
    }
  };
  
  // Optimize lineups using MCP workflow
  const optimizeLineups = async () => {
    setOptimizing(true);
    setOptimizationProgress(0);
    
    try {
      // Start optimization
      const response = await fetch('/api/optimize/mcp-workflow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings,
          lockedPlayers: Array.from(lockedPlayers),
          excludedPlayers: [],
          currentLineup: currentLineup.map(p => p.player_id)
        })
      });
      
      // Handle streaming response for progress updates
      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      
      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;
        
        const chunk = decoder.decode(value);
        const updates = chunk.split('\n').filter(Boolean);
        
        for (const update of updates) {
          try {
            const data = JSON.parse(update);
            if (data.progress) {
              setOptimizationProgress(data.progress);
            }
            if (data.lineups) {
              setSavedLineups(prev => [...prev, ...data.lineups]);
            }
          } catch (e) {
            // Handle non-JSON updates
          }
        }
      }
      
      toast({
        title: "Optimization Complete! 🚀",
        description: `Generated ${savedLineups.length} optimized lineups`,
      });
      
    } catch (error) {
      toast({
        title: "Optimization Failed",
        description: "Failed to generate lineups",
        variant: "destructive"
      });
    } finally {
      setOptimizing(false);
      setOptimizationProgress(0);
    }
  };
  
  // Calculate lineup stats
  const lineupStats = useMemo(() => {
    const totalSalary = currentLineup.reduce((sum, p) => sum + p.salary, 0);
    const totalProjected = currentLineup.reduce((sum, p) => sum + p.projected_points, 0);
    const totalOwnership = currentLineup.reduce((sum, p) => sum + p.ownership_projection, 0);
    const avgLeverage = currentLineup.length > 0 
      ? currentLineup.reduce((sum, p) => sum + p.leverage_score, 0) / currentLineup.length 
      : 0;
    
    const salaryCap = settings.platform === 'draftkings' ? 50000 : 60000;
    const remainingSalary = salaryCap - totalSalary;
    
    return {
      totalSalary,
      totalProjected,
      totalOwnership,
      avgLeverage,
      remainingSalary,
      salaryCap,
      isValid: currentLineup.length === 9 && remainingSalary >= 0 // Adjust based on sport
    };
  }, [currentLineup, settings.platform]);
  
  // Drag and drop handlers
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setCurrentLineup((items) => {
        const oldIndex = items.findIndex(p => p.player_id === active.id);
        const newIndex = items.findIndex(p => p.player_id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  
  // Export lineups
  const exportLineups = () => {
    const csv = savedLineups.map((lineup, i) => {
      const positions = settings.sport === 'nfl' 
        ? ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'DST']
        : []; // Add other sports
        
      return positions.map(pos => {
        const player = lineup.players.find(p => p.position === pos);
        return player ? player.player_id : '';
      }).join(',');
    }).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `dfs-lineups-${Date.now()}.csv`;
    a.click();
  };
  
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold flex items-center gap-3">
                <Rocket className="h-10 w-10 text-blue-500" />
                Ultimate DFS Lineup Builder
                <Badge variant="default" className="ml-2">
                  MCP-ENHANCED
                </Badge>
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Powered by AI ownership projections, leverage calculations, and real-time optimization
              </p>
            </div>
            
            {/* Professional Trading Tools */}
            <div className="flex flex-col gap-2">
              <div className="text-sm text-gray-500 font-semibold uppercase tracking-wide">
                Professional Trading Tools
              </div>
              <div className="flex gap-3">
                <Button
                  onClick={() => window.open('/dfs/trading', '_blank')}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-green-50 dark:hover:bg-green-900/20 border-green-300 text-green-700 dark:text-green-400"
                >
                  <Monitor className="w-4 h-4" />
                  Trading Dashboard
                </Button>
                <Button
                  onClick={() => window.open('/dfs/terminal', '_blank')}
                  variant="outline"
                  className="flex items-center gap-2 hover:bg-blue-50 dark:hover:bg-blue-900/20 border-blue-300 text-blue-700 dark:text-blue-400"
                >
                  <Terminal className="w-4 h-4" />
                  Bloomberg Terminal
                </Button>
              </div>
              <div className="text-xs text-gray-400 max-w-sm">
                Access professional-grade trading analytics, real-time contest intelligence, and advanced risk management
              </div>
            </div>
          </div>
        </motion.div>
        
        {/* Settings Bar */}
        <Card className="mb-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              <Select
                value={settings.sport}
                onValueChange={(value) => setSettings({ ...settings, sport: value })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="nfl">NFL</SelectItem>
                  <SelectItem value="nba">NBA</SelectItem>
                  <SelectItem value="mlb">MLB</SelectItem>
                  <SelectItem value="nhl">NHL</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={settings.platform}
                onValueChange={(value: 'draftkings' | 'fanduel') => 
                  setSettings({ ...settings, platform: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draftkings">DraftKings</SelectItem>
                  <SelectItem value="fanduel">FanDuel</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={settings.contestType}
                onValueChange={(value: 'GPP' | 'CASH') => 
                  setSettings({ ...settings, contestType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GPP">GPP</SelectItem>
                  <SelectItem value="CASH">Cash</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={settings.optimizationStrategy}
                onValueChange={(value: any) => 
                  setSettings({ ...settings, optimizationStrategy: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="balanced">Balanced</SelectItem>
                  <SelectItem value="ceiling">Ceiling</SelectItem>
                  <SelectItem value="leverage">Leverage</SelectItem>
                  <SelectItem value="contrarian">Contrarian</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={settings.enableGPU}
                  onCheckedChange={(checked) => 
                    setSettings({ ...settings, enableGPU: checked })
                  }
                />
                <label className="text-sm">GPU Boost</label>
              </div>
              
              <div className="flex items-center space-x-2">
                <Switch
                  checked={realtimeUpdates}
                  onCheckedChange={setRealtimeUpdates}
                />
                <label className="text-sm">Live Updates</label>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Main Content */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="builder">Lineup Builder</TabsTrigger>
            <TabsTrigger value="optimizer">Mass Optimizer</TabsTrigger>
            <TabsTrigger value="analytics">Analytics</TabsTrigger>
            <TabsTrigger value="export">Export</TabsTrigger>
          </TabsList>
          
          <TabsContent value="builder" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Player Pool */}
              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Player Pool</span>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        {playerPool.length} players
                      </Badge>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={loadPlayerPool}
                        disabled={loading}
                      >
                        <RefreshCw className={cn(
                          "h-4 w-4",
                          loading && "animate-spin"
                        )} />
                      </Button>
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Filters and search would go here */}
                  
                  <ScrollArea className="h-[600px] pr-4">
                    <div className="space-y-2">
                      {playerPool.map((player) => (
                        <motion.div
                          key={player.player_id}
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className={cn(
                            "p-3 bg-white dark:bg-gray-800 rounded-lg border cursor-pointer",
                            "hover:shadow-md transition-shadow",
                            currentLineup.some(p => p.player_id === player.player_id) && 
                            "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                          )}
                          onClick={() => {
                            if (!currentLineup.some(p => p.player_id === player.player_id)) {
                              setCurrentLineup([...currentLineup, player]);
                            }
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-3">
                              <Badge variant={player.position === 'QB' ? 'default' : 'secondary'}>
                                {player.position}
                              </Badge>
                              <div>
                                <p className="font-medium">{player.name}</p>
                                <p className="text-sm text-gray-500">
                                  {player.team} vs {player.opponent}
                                </p>
                              </div>
                            </div>
                            
                            <div className="flex items-center space-x-4">
                              <div className="text-right">
                                <p className="font-medium">${player.salary.toLocaleString()}</p>
                                <p className="text-sm text-gray-500">
                                  {player.projected_points.toFixed(1)} pts
                                </p>
                              </div>
                              
                              <TooltipProvider>
                                <Tooltip>
                                  <TooltipTrigger>
                                    <div className="flex flex-col items-center">
                                      <Badge 
                                        variant={player.ownership_projection > 0.25 ? 'destructive' : 
                                                 player.leverage_score > 2 ? 'default' : 'secondary'}
                                      >
                                        {(player.ownership_projection * 100).toFixed(1)}%
                                      </Badge>
                                      <span className="text-xs text-gray-500 mt-1">
                                        {player.leverage_score.toFixed(2)}x
                                      </span>
                                    </div>
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <div className="space-y-1">
                                      <p>Ownership: {(player.ownership_projection * 100).toFixed(1)}%</p>
                                      <p>Leverage: {player.leverage_score.toFixed(2)}x</p>
                                      <p>Value: {player.value_rating.toFixed(2)}x</p>
                                      <p>Ceiling: {player.ceiling.toFixed(1)} pts</p>
                                    </div>
                                  </TooltipContent>
                                </Tooltip>
                              </TooltipProvider>
                              
                              {player.injury_status && (
                                <Badge variant="destructive" className="text-xs">
                                  {player.injury_status}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
              
              {/* Current Lineup */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <span>Current Lineup</span>
                    <Badge variant={lineupStats.isValid ? 'default' : 'destructive'}>
                      {currentLineup.length}/9
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Lineup stats */}
                  <div className="space-y-3 mb-4">
                    <div className="flex justify-between items-center">
                      <span className="text-sm text-gray-500">Salary Used</span>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">
                          ${lineupStats.totalSalary.toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-500">
                          / ${lineupStats.salaryCap.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    
                    <Progress 
                      value={(lineupStats.totalSalary / lineupStats.salaryCap) * 100} 
                      className="h-2"
                    />
                    
                    <div className="grid grid-cols-2 gap-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-gray-500">Projected</span>
                        <span className="font-medium">
                          {lineupStats.totalProjected.toFixed(1)} pts
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Ownership</span>
                        <span className="font-medium">
                          {(lineupStats.totalOwnership * 100).toFixed(1)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Avg Leverage</span>
                        <span className="font-medium">
                          {lineupStats.avgLeverage.toFixed(2)}x
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-gray-500">Remaining</span>
                        <span className={cn(
                          "font-medium",
                          lineupStats.remainingSalary < 0 && "text-red-500"
                        )}>
                          ${lineupStats.remainingSalary.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Lineup players */}
                  <DndContext
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext
                      items={currentLineup.map(p => p.player_id)}
                      strategy={verticalListSortingStrategy}
                    >
                      <div className="space-y-2">
                        {currentLineup.map((player) => (
                          <SortablePlayer
                            key={player.player_id}
                            player={player}
                            onRemove={() => {
                              setCurrentLineup(prev => 
                                prev.filter(p => p.player_id !== player.player_id)
                              );
                            }}
                            isLocked={lockedPlayers.has(player.player_id)}
                          />
                        ))}
                      </div>
                    </SortableContext>
                  </DndContext>
                  
                  {/* Action buttons */}
                  <div className="mt-4 space-y-2">
                    <Button 
                      className="w-full" 
                      onClick={() => {
                        if (lineupStats.isValid) {
                          setSavedLineups(prev => [...prev, {
                            players: currentLineup,
                            totalSalary: lineupStats.totalSalary,
                            totalProjected: lineupStats.totalProjected,
                            totalOwnership: lineupStats.totalOwnership,
                            avgLeverage: lineupStats.avgLeverage,
                            confidence: 0.85
                          }]);
                          setCurrentLineup([]);
                          toast({
                            title: "Lineup Saved!",
                            description: "Your lineup has been saved to the optimizer"
                          });
                        }
                      }}
                      disabled={!lineupStats.isValid}
                    >
                      Save Lineup
                    </Button>
                    
                    <Button 
                      variant="outline" 
                      className="w-full"
                      onClick={() => setCurrentLineup([])}
                    >
                      Clear Lineup
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
            
            {/* Leverage Plays & Chalk */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5 text-green-500" />
                    Top Leverage Plays
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {leveragePlays.map((player) => (
                      <div
                        key={player.player_id}
                        className="flex items-center justify-between p-2 bg-green-50 dark:bg-green-900/20 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <PlayerAvatar
                            playerId={player.player_id}
                            size={40}
                            showBadge={false}
                          />
                          <div>
                            <p className="font-medium">{player.name}</p>
                            <p className="text-sm text-gray-500">
                              {player.position} - {player.team}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="default">
                            {player.leverage_score.toFixed(2)}x
                          </Badge>
                          <p className="text-sm text-gray-500 mt-1">
                            {(player.ownership_projection * 100).toFixed(1)}% owned
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
              
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Flame className="h-5 w-5 text-red-500" />
                    Chalk to Consider Fading
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {chalkPlays.map((player) => (
                      <div
                        key={player.player_id}
                        className="flex items-center justify-between p-2 bg-red-50 dark:bg-red-900/20 rounded-lg"
                      >
                        <div className="flex items-center gap-3">
                          <PlayerAvatar
                            playerId={player.player_id}
                            size={40}
                            showBadge={false}
                          />
                          <div>
                            <p className="font-medium">{player.name}</p>
                            <p className="text-sm text-gray-500">
                              {player.position} - {player.team}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <Badge variant="destructive">
                            {(player.ownership_projection * 100).toFixed(1)}%
                          </Badge>
                          <p className="text-sm text-gray-500 mt-1">
                            {player.leverage_score.toFixed(2)}x leverage
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          </TabsContent>
          
          <TabsContent value="optimizer" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Mass Lineup Optimizer</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Optimization settings */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Number of Lineups</label>
                    <Slider
                      value={[settings.lineupCount]}
                      onValueChange={([value]) => 
                        setSettings({ ...settings, lineupCount: value })
                      }
                      min={1}
                      max={150}
                      step={1}
                    />
                    <span className="text-sm text-gray-500">{settings.lineupCount} lineups</span>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Max Ownership %</label>
                    <Slider
                      value={[settings.maxOwnership * 100]}
                      onValueChange={([value]) => 
                        setSettings({ ...settings, maxOwnership: value / 100 })
                      }
                      min={0}
                      max={50}
                      step={1}
                    />
                    <span className="text-sm text-gray-500">
                      {(settings.maxOwnership * 100).toFixed(0)}% max
                    </span>
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Diversity Weight</label>
                    <Slider
                      value={[settings.diversityWeight]}
                      onValueChange={([value]) => 
                        setSettings({ ...settings, diversityWeight: value })
                      }
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Correlation Weight</label>
                    <Slider
                      value={[settings.correlationWeight]}
                      onValueChange={([value]) => 
                        setSettings({ ...settings, correlationWeight: value })
                      }
                      min={0}
                      max={1}
                      step={0.1}
                    />
                  </div>
                </div>
                
                <div className="flex items-center space-x-4">
                  <Button
                    size="lg"
                    onClick={optimizeLineups}
                    disabled={optimizing}
                    className="flex-1"
                  >
                    {optimizing ? (
                      <>
                        <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                        Optimizing...
                      </>
                    ) : (
                      <>
                        <Brain className="mr-2 h-4 w-4" />
                        Optimize Lineups
                      </>
                    )}
                  </Button>
                  
                  {settings.enableGPU && (
                    <Badge variant="outline" className="px-3 py-2">
                      <Zap className="mr-1 h-3 w-3" />
                      GPU Accelerated
                    </Badge>
                  )}
                </div>
                
                {optimizing && (
                  <div className="space-y-2">
                    <Progress value={optimizationProgress} />
                    <p className="text-sm text-center text-gray-500">
                      Generating lineup {Math.floor(optimizationProgress / 100 * settings.lineupCount)} of {settings.lineupCount}
                    </p>
                  </div>
                )}
                
                {/* Saved lineups */}
                {savedLineups.length > 0 && (
                  <div className="mt-6">
                    <h3 className="font-medium mb-3">
                      Generated Lineups ({savedLineups.length})
                    </h3>
                    <ScrollArea className="h-[400px]">
                      <div className="space-y-2">
                        {savedLineups.map((lineup, i) => (
                          <Card key={i} className="p-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-medium">Lineup {i + 1}</p>
                                <p className="text-sm text-gray-500">
                                  {lineup.totalProjected.toFixed(1)} pts • 
                                  {(lineup.totalOwnership * 100).toFixed(1)}% owned • 
                                  {lineup.avgLeverage.toFixed(2)}x leverage
                                </p>
                              </div>
                              <div className="flex items-center gap-2">
                                {lineup.confidence > 0.8 && (
                                  <Badge variant="default">
                                    High Confidence
                                  </Badge>
                                )}
                                {lineup.stackType && (
                                  <Badge variant="outline">
                                    {lineup.stackType}
                                  </Badge>
                                )}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => setCurrentLineup(lineup.players)}
                                >
                                  <Eye className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </Card>
                        ))}
                      </div>
                    </ScrollArea>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          
          <TabsContent value="analytics" className="space-y-4">
            {/* Ownership distribution chart */}
            <Card>
              <CardHeader>
                <CardTitle>Ownership Distribution</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={ownershipData?.projections?.slice(0, 20) || []}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                    <YAxis />
                    <RechartsTooltip />
                    <Bar dataKey="projectedOwnership" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
            
            {/* More analytics components would go here */}
          </TabsContent>
          
          <TabsContent value="export" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Export Lineups</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertTriangle className="h-4 w-4" />
                  <AlertDescription>
                    Make sure your lineups are valid for the selected platform before exporting.
                  </AlertDescription>
                </Alert>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Button
                    size="lg"
                    onClick={exportLineups}
                    disabled={savedLineups.length === 0}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export as CSV
                  </Button>
                  
                  <Button
                    size="lg"
                    variant="outline"
                    disabled={savedLineups.length === 0}
                  >
                    <Upload className="mr-2 h-4 w-4" />
                    Upload to {settings.platform === 'draftkings' ? 'DraftKings' : 'FanDuel'}
                  </Button>
                </div>
                
                <div className="text-sm text-gray-500">
                  <p>• CSV format compatible with mass entry tools</p>
                  <p>• Includes player IDs for direct platform upload</p>
                  <p>• {savedLineups.length} lineups ready for export</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
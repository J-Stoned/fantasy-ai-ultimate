'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Zap, 
  DollarSign,
  Users,
  Target,
  Sparkles,
  Download,
  RefreshCw,
  Search,
  Filter,
  Shuffle,
  TrendingUp,
  Trophy,
  X,
  Lock,
  Unlock,
  ChevronDown,
  Settings,
  BarChart3,
  Eye,
  Star
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { VoiceInterface } from '@/components/VoiceInterface';

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
  value_rating: number;
  injury_status?: string;
  game_time?: string;
  weather_impact?: number;
  vegas_total?: number;
  spread?: number;
  stack_partners?: string[];
}

interface Lineup {
  players: Player[];
  totalSalary: number;
  totalProjected: number;
  totalOwnership: number;
  avgLeverage: number;
  confidence: number;
}

interface OptimizationSettings {
  sport: string;
  platform: 'draftkings' | 'fanduel';
  contestType: 'GPP' | 'CASH' | 'TOURNAMENTS';
  riskLevel: 'conservative' | 'balanced' | 'aggressive';
  enableStacking: boolean;
  stackType?: 'qb-wr' | 'rb-dst' | 'game-stack' | 'custom';
  maxFromTeam: number;
  minSalaryUsed: number;
}

// Player Card Component
function PlayerCard({ 
  player, 
  onAdd, 
  onRemove, 
  isInLineup, 
  isLocked,
  onToggleLock 
}: { 
  player: Player; 
  onAdd: () => void; 
  onRemove: () => void; 
  isInLineup: boolean;
  isLocked: boolean;
  onToggleLock: () => void;
}) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "p-4 bg-white dark:bg-gray-800 rounded-lg border cursor-pointer transition-all duration-200",
        "hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600",
        isInLineup && "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-200",
        isLocked && "border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20"
      )}
      onClick={isInLineup ? onRemove : onAdd}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <Badge 
            variant={
              player.position === 'QB' ? 'default' : 
              player.position === 'RB' ? 'secondary' :
              player.position === 'WR' ? 'outline' :
              'destructive'
            }
            className="font-semibold"
          >
            {player.position}
          </Badge>
          
          <div>
            <div className="flex items-center gap-2">
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {player.name}
              </p>
              {player.injury_status && (
                <Badge variant="destructive" className="text-xs">
                  {player.injury_status}
                </Badge>
              )}
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              {player.team} vs {player.opponent}
            </p>
            {player.game_time && (
              <p className="text-xs text-gray-500">
                Game: {player.game_time}
              </p>
            )}
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          {/* Salary & Projection */}
          <div className="text-right">
            <p className="font-bold text-gray-900 dark:text-gray-100">
              ${player.salary.toLocaleString()}
            </p>
            <p className="text-sm font-medium text-blue-600 dark:text-blue-400">
              {player.projected_points.toFixed(1)} pts
            </p>
            <p className="text-xs text-gray-500">
              {player.floor.toFixed(1)}-{player.ceiling.toFixed(1)}
            </p>
          </div>
          
          {/* Ownership & Value */}
          <div className="text-center min-w-[60px]">
            <Badge 
              variant={
                player.ownership_projection > 0.25 ? 'destructive' : 
                player.ownership_projection > 0.15 ? 'default' : 
                'secondary'
              }
              className="mb-1 text-xs"
            >
              {(player.ownership_projection * 100).toFixed(1)}%
            </Badge>
            <div className="flex items-center justify-center gap-1">
              <Star className="h-3 w-3 text-yellow-500" />
              <span className="text-xs font-medium">
                {player.value_rating.toFixed(1)}x
              </span>
            </div>
          </div>
          
          {/* Lock Toggle */}
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              onToggleLock();
            }}
            className="h-8 w-8 p-0"
          >
            {isLocked ? 
              <Lock className="h-4 w-4 text-yellow-600" /> : 
              <Unlock className="h-4 w-4 text-gray-400" />
            }
          </Button>
        </div>
      </div>
      
      {/* Stack Partners */}
      {player.stack_partners && player.stack_partners.length > 0 && (
        <div className="mt-3 flex items-center text-xs text-gray-600 dark:text-gray-400">
          <Users className="h-3 w-3 mr-1" />
          <span>Stacks with: {player.stack_partners.slice(0, 2).join(', ')}</span>
        </div>
      )}
      
      {/* Weather/Game Info */}
      {(player.weather_impact || player.vegas_total) && (
        <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
          {player.vegas_total && (
            <span>O/U: {player.vegas_total}</span>
          )}
          {player.spread && (
            <span>Spread: {player.spread > 0 ? '+' : ''}{player.spread}</span>
          )}
        </div>
      )}
    </motion.div>
  );
}

// Main Component
export default function LineupBuilder() {
  const { toast } = useToast();
  
  // State
  const [loading, setLoading] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [optimizationProgress, setOptimizationProgress] = useState(0);
  
  const [settings, setSettings] = useState<OptimizationSettings>({
    sport: 'nfl',
    platform: 'draftkings',
    contestType: 'GPP',
    riskLevel: 'balanced',
    enableStacking: true,
    stackType: 'qb-wr',
    maxFromTeam: 4,
    minSalaryUsed: 0.95
  });
  
  const [playerPool, setPlayerPool] = useState<Player[]>([]);
  const [currentLineup, setCurrentLineup] = useState<Player[]>([]);
  const [optimizedLineups, setOptimizedLineups] = useState<Lineup[]>([]);
  const [lockedPlayers, setLockedPlayers] = useState<Set<string>>(new Set());
  
  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [positionFilter, setPositionFilter] = useState('all');
  const [teamFilter, setTeamFilter] = useState('all');
  const [salaryRange, setSalaryRange] = useState([3000, 12000]);
  const [ownershipRange, setOwnershipRange] = useState([0, 50]);
  
  // UI State
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [selectedLineupIndex, setSelectedLineupIndex] = useState(0);
  
  // Load player data
  useEffect(() => {
    loadPlayerPool();
  }, [settings.sport, settings.platform]);
  
  const loadPlayerPool = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/lineup-builder/players?sport=${settings.sport}&platform=${settings.platform}`);
      const data = await response.json();
      
      if (data.success && data.players) {
        setPlayerPool(data.players);
        toast({
          title: "Players Loaded! 🎯",
          description: `Found ${data.players.length} players for ${settings.sport.toUpperCase()}`
        });
      }
    } catch (error) {
      toast({
        title: "Error Loading Players",
        description: "Failed to load player pool. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };
  
  // Filter players
  const filteredPlayers = useMemo(() => {
    return playerPool.filter(player => {
      // Search filter
      if (searchQuery && !player.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !player.team.toLowerCase().includes(searchQuery.toLowerCase())) {
        return false;
      }
      
      // Position filter
      if (positionFilter !== 'all' && player.position !== positionFilter) {
        return false;
      }
      
      // Team filter
      if (teamFilter !== 'all' && player.team !== teamFilter) {
        return false;
      }
      
      // Salary range
      if (player.salary < salaryRange[0] || player.salary > salaryRange[1]) {
        return false;
      }
      
      // Ownership range
      const ownershipPct = player.ownership_projection * 100;
      if (ownershipPct < ownershipRange[0] || ownershipPct > ownershipRange[1]) {
        return false;
      }
      
      return true;
    });
  }, [playerPool, searchQuery, positionFilter, teamFilter, salaryRange, ownershipRange]);
  
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
    const requiredPlayers = settings.sport === 'nfl' ? 9 : 8; // Adjust based on sport
    
    return {
      totalSalary,
      totalProjected,
      totalOwnership,
      avgLeverage,
      remainingSalary,
      salaryCap,
      requiredPlayers,
      isValid: currentLineup.length === requiredPlayers && remainingSalary >= 0,
      salaryUtilization: (totalSalary / salaryCap) * 100
    };
  }, [currentLineup, settings.platform, settings.sport]);
  
  // Add/Remove players
  const addPlayer = (player: Player) => {
    if (currentLineup.length >= lineupStats.requiredPlayers) {
      toast({
        title: "Lineup Full",
        description: "Remove a player first to add another",
        variant: "destructive"
      });
      return;
    }
    
    if (currentLineup.some(p => p.player_id === player.player_id)) {
      toast({
        title: "Player Already Added",
        description: `${player.name} is already in your lineup`,
        variant: "destructive"
      });
      return;
    }
    
    if (lineupStats.totalSalary + player.salary > lineupStats.salaryCap) {
      toast({
        title: "Salary Cap Exceeded",
        description: `Adding ${player.name} would exceed salary cap`,
        variant: "destructive"
      });
      return;
    }
    
    setCurrentLineup([...currentLineup, player]);
    toast({
      title: "Player Added! 🎯",
      description: `${player.name} added to lineup`
    });
  };
  
  const removePlayer = (playerId: string) => {
    setCurrentLineup(prev => prev.filter(p => p.player_id !== playerId));
  };
  
  const togglePlayerLock = (playerId: string) => {
    setLockedPlayers(prev => {
      const newSet = new Set(prev);
      if (newSet.has(playerId)) {
        newSet.delete(playerId);
      } else {
        newSet.add(playerId);
      }
      return newSet;
    });
  };
  
  // One-click optimization
  const optimizeLineup = async () => {
    setOptimizing(true);
    setOptimizationProgress(0);
    
    try {
      const response = await fetch('/api/lineup-builder/optimize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings,
          lockedPlayers: Array.from(lockedPlayers),
          currentLineup: currentLineup.map(p => p.player_id)
        })
      });
      
      if (!response.ok) throw new Error('Optimization failed');
      
      // Handle streaming response
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
              setOptimizedLineups(data.lineups);
              if (data.lineups.length > 0) {
                setCurrentLineup(data.lineups[0].players);
              }
            }
          } catch (e) {
            // Handle non-JSON updates
          }
        }
      }
      
      toast({
        title: "Optimization Complete! 🚀",
        description: `Generated ${optimizedLineups.length} optimized lineups`,
      });
      
    } catch (error) {
      toast({
        title: "Optimization Failed",
        description: "Failed to optimize lineup. Please try again.",
        variant: "destructive"
      });
    } finally {
      setOptimizing(false);
      setOptimizationProgress(0);
    }
  };
  
  // Get stack recommendations
  const getStackRecommendations = async () => {
    try {
      const response = await fetch('/api/lineup-builder/stacks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport: settings.sport,
          stackType: settings.stackType,
          currentLineup: currentLineup.map(p => p.player_id)
        })
      });
      
      const data = await response.json();
      if (data.success && data.recommendations) {
        // Apply stack recommendations to current lineup
        toast({
          title: "Stack Recommendations Found! 📊",
          description: `Found ${data.recommendations.length} stack opportunities`
        });
      }
    } catch (error) {
      toast({
        title: "Stack Analysis Failed",
        description: "Unable to get stack recommendations",
        variant: "destructive"
      });
    }
  };
  
  // Export lineup
  const exportLineup = () => {
    if (!lineupStats.isValid) {
      toast({
        title: "Invalid Lineup",
        description: "Please complete your lineup before exporting",
        variant: "destructive"
      });
      return;
    }
    
    const positions = settings.sport === 'nfl' 
      ? ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'DST']
      : ['PG', 'SG', 'SF', 'PF', 'C', 'G', 'F', 'UTIL']; // NBA example
      
    const csv = positions.map(pos => {
      const player = currentLineup.find(p => p.position === pos);
      return player ? player.player_id : '';
    }).join(',');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `lineup-${settings.platform}-${Date.now()}.csv`;
    a.click();
    
    toast({
      title: "Lineup Exported! 📁",
      description: `CSV file ready for ${settings.platform === 'draftkings' ? 'DraftKings' : 'FanDuel'}`
    });
  };
  
  // Get unique teams and positions for filters
  const uniqueTeams = useMemo(() => 
    Array.from(new Set(playerPool.map(p => p.team))).sort()
  , [playerPool]);
  
  const uniquePositions = useMemo(() => 
    Array.from(new Set(playerPool.map(p => p.position))).sort()
  , [playerPool]);
  
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 p-4">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 flex items-center gap-3">
                <Target className="h-10 w-10 text-blue-500" />
                Lineup Builder
                <Badge variant="secondary" className="ml-2">
                  AI-POWERED
                </Badge>
              </h1>
              <p className="text-gray-600 dark:text-gray-400 mt-2">
                Build winning DFS lineups with one-click optimization and smart recommendations
              </p>
            </div>
            
            <div className="flex items-center gap-3">
              <Button
                onClick={() => setShowAdvanced(!showAdvanced)}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Settings className="h-4 w-4" />
                {showAdvanced ? 'Simple' : 'Advanced'}
              </Button>
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
                  <SelectItem value="nfl">🏈 NFL</SelectItem>
                  <SelectItem value="nba">🏀 NBA</SelectItem>
                  <SelectItem value="mlb">⚾ MLB</SelectItem>
                  <SelectItem value="nhl">🏒 NHL</SelectItem>
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
                onValueChange={(value: any) => 
                  setSettings({ ...settings, contestType: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="GPP">🏆 GPP</SelectItem>
                  <SelectItem value="CASH">💰 Cash</SelectItem>
                  <SelectItem value="TOURNAMENTS">🎯 Tournaments</SelectItem>
                </SelectContent>
              </Select>
              
              <Select
                value={settings.riskLevel}
                onValueChange={(value: any) => 
                  setSettings({ ...settings, riskLevel: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="conservative">🛡️ Conservative</SelectItem>
                  <SelectItem value="balanced">⚖️ Balanced</SelectItem>
                  <SelectItem value="aggressive">🚀 Aggressive</SelectItem>
                </SelectContent>
              </Select>
              
              <div className="col-span-2 flex justify-center">
                <Button
                  size="lg"
                  onClick={optimizeLineup}
                  disabled={optimizing || loading}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-bold px-8"
                >
                  {optimizing ? (
                    <>
                      <RefreshCw className="mr-2 h-5 w-5 animate-spin" />
                      Optimizing...
                    </>
                  ) : (
                    <>
                      <Zap className="mr-2 h-5 w-5" />
                      Optimize For Me!
                    </>
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
        
        {/* Optimization Progress */}
        <AnimatePresence>
          {optimizing && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="mb-6"
            >
              <Card>
                <CardContent className="p-4">
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span className="text-sm font-medium">Generating optimal lineup...</span>
                      <span className="text-sm text-gray-500">{optimizationProgress}%</span>
                    </div>
                    <Progress value={optimizationProgress} className="h-2" />
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Player Pool */}
          <div className="lg:col-span-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Player Pool</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">
                      {filteredPlayers.length} players
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
                {/* Filters */}
                <div className="space-y-4 mb-4">
                  <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                      <Input
                        placeholder="Search players or teams..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="pl-10"
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setSearchQuery('');
                        setPositionFilter('all');
                        setTeamFilter('all');
                        setSalaryRange([3000, 12000]);
                        setOwnershipRange([0, 50]);
                      }}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                  
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                    <Select value={positionFilter} onValueChange={setPositionFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Position" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Positions</SelectItem>
                        {uniquePositions.map(pos => (
                          <SelectItem key={pos} value={pos}>{pos}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Select value={teamFilter} onValueChange={setTeamFilter}>
                      <SelectTrigger>
                        <SelectValue placeholder="Team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">All Teams</SelectItem>
                        {uniqueTeams.map(team => (
                          <SelectItem key={team} value={team}>{team}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    
                    <Button
                      variant="outline"
                      onClick={getStackRecommendations}
                      className="flex items-center gap-2"
                    >
                      <Users className="h-4 w-4" />
                      Stacks
                    </Button>
                    
                    <Button
                      variant="outline"
                      onClick={() => {
                        const shuffled = [...filteredPlayers].sort(() => Math.random() - 0.5);
                        setCurrentLineup(shuffled.slice(0, lineupStats.requiredPlayers));
                      }}
                      className="flex items-center gap-2"
                    >
                      <Shuffle className="h-4 w-4" />
                      Random
                    </Button>
                  </div>
                </div>
                
                {/* Player List */}
                <ScrollArea className="h-[600px] pr-4">
                  <div className="space-y-3">
                    {filteredPlayers.map((player) => (
                      <PlayerCard
                        key={player.player_id}
                        player={player}
                        onAdd={() => addPlayer(player)}
                        onRemove={() => removePlayer(player.player_id)}
                        isInLineup={currentLineup.some(p => p.player_id === player.player_id)}
                        isLocked={lockedPlayers.has(player.player_id)}
                        onToggleLock={() => togglePlayerLock(player.player_id)}
                      />
                    ))}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>
          
          {/* Current Lineup */}
          <div>
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>Current Lineup</span>
                  <Badge variant={lineupStats.isValid ? 'default' : 'destructive'}>
                    {currentLineup.length}/{lineupStats.requiredPlayers}
                  </Badge>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* Lineup Stats */}
                <div className="space-y-4 mb-4">
                  <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">Salary Used</span>
                      <div className="text-right">
                        <span className="font-bold">
                          ${lineupStats.totalSalary.toLocaleString()}
                        </span>
                        <span className="text-sm text-gray-500 ml-1">
                          / ${lineupStats.salaryCap.toLocaleString()}
                        </span>
                      </div>
                    </div>
                    <Progress value={lineupStats.salaryUtilization} className="h-2 mb-2" />
                    <div className="text-right">
                      <span className={cn(
                        "text-sm font-medium",
                        lineupStats.remainingSalary < 0 ? "text-red-500" : "text-green-600"
                      )}>
                        ${lineupStats.remainingSalary.toLocaleString()} remaining
                      </span>
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div className="text-center p-2 bg-blue-50 dark:bg-blue-900/20 rounded">
                      <div className="font-bold text-blue-600 dark:text-blue-400">
                        {lineupStats.totalProjected.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-600">Projected Points</div>
                    </div>
                    <div className="text-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                      <div className="font-bold text-green-600 dark:text-green-400">
                        {(lineupStats.totalOwnership * 100).toFixed(1)}%
                      </div>
                      <div className="text-xs text-gray-600">Avg Ownership</div>
                    </div>
                    <div className="text-center p-2 bg-purple-50 dark:bg-purple-900/20 rounded">
                      <div className="font-bold text-purple-600 dark:text-purple-400">
                        {lineupStats.avgLeverage.toFixed(2)}x
                      </div>
                      <div className="text-xs text-gray-600">Avg Leverage</div>
                    </div>
                    <div className="text-center p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded">
                      <div className="font-bold text-yellow-600 dark:text-yellow-400">
                        {Array.from(new Set(currentLineup.map(p => p.team))).length}
                      </div>
                      <div className="text-xs text-gray-600">Teams Used</div>
                    </div>
                  </div>
                </div>
                
                {/* Lineup Players */}
                <ScrollArea className="h-[300px] mb-4">
                  <div className="space-y-2">
                    {currentLineup.map((player) => (
                      <motion.div
                        key={player.player_id}
                        layout
                        className={cn(
                          "p-3 bg-white dark:bg-gray-700 rounded-lg border",
                          lockedPlayers.has(player.player_id) && "border-yellow-400 bg-yellow-50 dark:bg-yellow-900/20"
                        )}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <Badge variant="outline" className="text-xs">
                              {player.position}
                            </Badge>
                            <div>
                              <p className="font-medium text-sm">{player.name}</p>
                              <p className="text-xs text-gray-500">{player.team}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center space-x-2">
                            <div className="text-right">
                              <p className="text-sm font-medium">
                                ${player.salary.toLocaleString()}
                              </p>
                              <p className="text-xs text-gray-500">
                                {player.projected_points.toFixed(1)} pts
                              </p>
                            </div>
                            
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => togglePlayerLock(player.player_id)}
                              className="h-6 w-6 p-0"
                            >
                              {lockedPlayers.has(player.player_id) ? 
                                <Lock className="h-3 w-3 text-yellow-600" /> : 
                                <Unlock className="h-3 w-3 text-gray-400" />
                              }
                            </Button>
                            
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => removePlayer(player.player_id)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </ScrollArea>
                
                {/* Action Buttons */}
                <div className="space-y-2">
                  <Button 
                    className="w-full" 
                    onClick={exportLineup}
                    disabled={!lineupStats.isValid}
                  >
                    <Download className="mr-2 h-4 w-4" />
                    Export Lineup
                  </Button>
                  
                  <Button 
                    variant="outline" 
                    className="w-full"
                    onClick={() => {
                      setCurrentLineup([]);
                      setLockedPlayers(new Set());
                    }}
                  >
                    Clear All
                  </Button>
                </div>
                
                {/* Lineup Status */}
                {!lineupStats.isValid && currentLineup.length > 0 && (
                  <Alert className="mt-4">
                    <AlertDescription>
                      {currentLineup.length < lineupStats.requiredPlayers ? 
                        `Need ${lineupStats.requiredPlayers - currentLineup.length} more players` :
                        'Salary cap exceeded'
                      }
                    </AlertDescription>
                  </Alert>
                )}
              </CardContent>
            </Card>
            
            {/* Optimized Lineups */}
            {optimizedLineups.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Trophy className="h-5 w-5 text-yellow-500" />
                    Optimized Lineups ({optimizedLineups.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <ScrollArea className="h-[200px]">
                    <div className="space-y-2">
                      {optimizedLineups.map((lineup, i) => (
                        <motion.div
                          key={i}
                          className={cn(
                            "p-3 border rounded-lg cursor-pointer transition-colors",
                            i === selectedLineupIndex ? 
                              "border-blue-500 bg-blue-50 dark:bg-blue-900/20" :
                              "border-gray-200 hover:border-gray-300"
                          )}
                          onClick={() => {
                            setSelectedLineupIndex(i);
                            setCurrentLineup(lineup.players);
                          }}
                        >
                          <div className="flex justify-between items-center">
                            <div>
                              <p className="font-medium">Lineup {i + 1}</p>
                              <p className="text-sm text-gray-500">
                                {lineup.totalProjected.toFixed(1)} pts • 
                                {(lineup.totalOwnership * 100).toFixed(1)}% owned
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {lineup.confidence > 0.8 && (
                                <Badge variant="default" className="text-xs">
                                  High Confidence
                                </Badge>
                              )}
                              <Button size="sm" variant="ghost">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </ScrollArea>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* 🔥 ENTERPRISE VOICE ASSISTANT FOR LINEUP BUILDING */}
        <div className="fixed bottom-6 right-6 z-50">
          <div className="bg-white/95 backdrop-blur-lg rounded-2xl shadow-2xl border border-gray-200">
            <VoiceInterface 
              onCommandProcessed={(response) => {
                // Handle lineup optimization commands
                if (response.intent === 'LINEUP_OPTIMIZATION' && response.response.actions) {
                  response.response.actions.forEach(action => {
                    if (action.type === 'update_lineup' && action.lineup) {
                      setCurrentLineup(action.lineup);
                      toast({
                        title: "🎯 Lineup Optimized!",
                        description: "Your lineup has been updated with AI recommendations.",
                      });
                    }
                  });
                }
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
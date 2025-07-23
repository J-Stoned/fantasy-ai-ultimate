'use client';

import React, { useState, useCallback } from 'react';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors, DragEndEvent } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion, AnimatePresence } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  GripVertical,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Heart,
  Activity,
  Calendar,
  Trophy,
  Users,
  ArrowUpDown,
  Sparkles,
  Shield,
  Zap,
  Target,
  Plus,
  X,
  ChevronRight,
  Star,
  Clock,
  BarChart3
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface Player {
  id: string;
  name: string;
  position: 'QB' | 'RB' | 'WR' | 'TE' | 'K' | 'DEF';
  team: string;
  opponent: string;
  projectedPoints: number;
  averagePoints: number;
  injury?: 'Q' | 'D' | 'O' | 'IR';
  trend: 'up' | 'down' | 'stable';
  ownership: number;
  matchupRating: number;
  confidence: number;
  isStarter: boolean;
  byeWeek?: number;
}

interface MatchupTeam {
  name: string;
  record: string;
  projectedPoints: number;
  logo: string;
  powerRanking: number;
}

const POSITION_COLORS = {
  QB: 'bg-red-500',
  RB: 'bg-green-500',
  WR: 'bg-blue-500',
  TE: 'bg-purple-500',
  K: 'bg-yellow-500',
  DEF: 'bg-orange-500'
};

const INJURY_COLORS = {
  Q: 'bg-yellow-500/20 text-yellow-500 border-yellow-500/50',
  D: 'bg-orange-500/20 text-orange-500 border-orange-500/50',
  O: 'bg-red-500/20 text-red-500 border-red-500/50',
  IR: 'bg-gray-500/20 text-gray-500 border-gray-500/50'
};

const SortablePlayer: React.FC<{ player: Player; index: number }> = ({ player, index }) => {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: player.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: isDragging ? 0.5 : 1, x: 0 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "relative bg-gray-900 border border-gray-800 rounded-lg p-4",
        "hover:border-gray-700 transition-all",
        isDragging && "z-50 shadow-xl"
      )}
    >
      <div className="flex items-center gap-3">
        {/* Drag Handle */}
        <div
          {...attributes}
          {...listeners}
          className="cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="w-5 h-5 text-gray-500" />
        </div>

        {/* Position Badge */}
        <div className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-white font-bold",
          POSITION_COLORS[player.position]
        )}>
          {player.position}
        </div>

        {/* Player Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h4 className="font-bold text-base">{player.name}</h4>
            {player.injury && (
              <Badge className={cn("text-xs", INJURY_COLORS[player.injury])}>
                {player.injury}
              </Badge>
            )}
            {player.trend === 'up' && <TrendingUp className="w-4 h-4 text-green-500" />}
            {player.trend === 'down' && <TrendingDown className="w-4 h-4 text-red-500" />}
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-400">
            <span>{player.team}</span>
            <span>vs</span>
            <span>{player.opponent}</span>
          </div>
        </div>

        {/* Stats */}
        <div className="text-right">
          <div className="text-xl font-bold">{player.projectedPoints.toFixed(1)}</div>
          <div className="text-xs text-gray-400">proj pts</div>
        </div>

        {/* Matchup Rating */}
        <div className="flex flex-col items-center">
          <div className={cn(
            "text-sm font-bold",
            player.matchupRating >= 8 ? "text-green-500" :
            player.matchupRating >= 5 ? "text-yellow-500" :
            "text-red-500"
          )}>
            {player.matchupRating}/10
          </div>
          <div className="text-xs text-gray-400">matchup</div>
        </div>

        {/* Confidence Meter */}
        <div className="w-16">
          <Progress 
            value={player.confidence} 
            className="h-2"
          />
          <div className="text-xs text-gray-400 text-center mt-1">
            {player.confidence}%
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export const FantasyRosterManager: React.FC = () => {
  const [players, setPlayers] = useState<Player[]>([
    {
      id: '1',
      name: 'Patrick Mahomes',
      position: 'QB',
      team: 'KC',
      opponent: 'BUF',
      projectedPoints: 24.5,
      averagePoints: 23.8,
      trend: 'up',
      ownership: 15.2,
      matchupRating: 7,
      confidence: 85,
      isStarter: true
    },
    {
      id: '2',
      name: 'Christian McCaffrey',
      position: 'RB',
      team: 'SF',
      opponent: 'DAL',
      projectedPoints: 22.3,
      averagePoints: 21.5,
      injury: 'Q',
      trend: 'stable',
      ownership: 45.6,
      matchupRating: 6,
      confidence: 70,
      isStarter: true
    },
    {
      id: '3',
      name: 'Tyreek Hill',
      position: 'WR',
      team: 'MIA',
      opponent: 'NYJ',
      projectedPoints: 18.7,
      averagePoints: 19.2,
      trend: 'up',
      ownership: 38.9,
      matchupRating: 9,
      confidence: 92,
      isStarter: true
    },
    {
      id: '4',
      name: 'Travis Kelce',
      position: 'TE',
      team: 'KC',
      opponent: 'BUF',
      projectedPoints: 15.2,
      averagePoints: 14.8,
      trend: 'stable',
      ownership: 52.1,
      matchupRating: 7,
      confidence: 88,
      isStarter: true
    },
    {
      id: '5',
      name: 'Justin Jefferson',
      position: 'WR',
      team: 'MIN',
      opponent: 'GB',
      projectedPoints: 19.4,
      averagePoints: 20.1,
      trend: 'down',
      ownership: 41.3,
      matchupRating: 8,
      confidence: 82,
      isStarter: true
    }
  ]);

  const [matchup] = useState<{ team1: MatchupTeam; team2: MatchupTeam }>({
    team1: {
      name: 'Your Team',
      record: '7-2',
      projectedPoints: 128.5,
      logo: '🏆',
      powerRanking: 2
    },
    team2: {
      name: 'Opponent',
      record: '5-4',
      projectedPoints: 119.3,
      logo: '⚔️',
      powerRanking: 6
    }
  });

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (active.id !== over?.id) {
      setPlayers((items) => {
        const oldIndex = items.findIndex(item => item.id === active.id);
        const newIndex = items.findIndex(item => item.id === over?.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const totalProjectedPoints = players.filter(p => p.isStarter).reduce((sum, p) => sum + p.projectedPoints, 0);
  const averageConfidence = players.filter(p => p.isStarter).reduce((sum, p) => sum + p.confidence, 0) / players.filter(p => p.isStarter).length;

  return (
    <div className="space-y-6">
      {/* Matchup Header */}
      <Card className="bg-gradient-to-r from-blue-600/20 to-purple-600/20 border-gray-800 p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="text-center flex-1">
            <div className="text-4xl mb-2">{matchup.team1.logo}</div>
            <h3 className="text-xl font-bold">{matchup.team1.name}</h3>
            <Badge className="mt-1">{matchup.team1.record}</Badge>
            <div className="text-sm text-gray-400 mt-1">#{matchup.team1.powerRanking} Power Rank</div>
          </div>
          
          <div className="flex flex-col items-center mx-4">
            <div className="text-3xl font-bold text-white mb-2">VS</div>
            <div className="text-sm text-gray-400">Week 10</div>
          </div>
          
          <div className="text-center flex-1">
            <div className="text-4xl mb-2">{matchup.team2.logo}</div>
            <h3 className="text-xl font-bold">{matchup.team2.name}</h3>
            <Badge className="mt-1">{matchup.team2.record}</Badge>
            <div className="text-sm text-gray-400 mt-1">#{matchup.team2.powerRanking} Power Rank</div>
          </div>
        </div>
        
        <div className="grid grid-cols-3 gap-4 mt-6">
          <div className="text-center">
            <div className="text-2xl font-bold text-green-500">{matchup.team1.projectedPoints}</div>
            <div className="text-sm text-gray-400">Projected</div>
          </div>
          <div className="text-center">
            <div className="text-lg font-bold">
              {((matchup.team1.projectedPoints / (matchup.team1.projectedPoints + matchup.team2.projectedPoints)) * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-gray-400">Win Probability</div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-500">{matchup.team2.projectedPoints}</div>
            <div className="text-sm text-gray-400">Projected</div>
          </div>
        </div>
      </Card>

      {/* Roster Management */}
      <Card className="bg-gray-900 border-gray-800 p-6">
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-bold">Roster Management</h2>
            <p className="text-gray-400">Drag to reorder, tap for details</p>
          </div>
          <div className="text-right">
            <div className="text-3xl font-bold text-green-500">{totalProjectedPoints.toFixed(1)}</div>
            <div className="text-sm text-gray-400">Total Projected</div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          <Button size="sm" variant="outline" className="whitespace-nowrap">
            <Sparkles className="w-4 h-4 mr-2" />
            Optimize Lineup
          </Button>
          <Button size="sm" variant="outline" className="whitespace-nowrap">
            <Shield className="w-4 h-4 mr-2" />
            Set Best Lineup
          </Button>
          <Button size="sm" variant="outline" className="whitespace-nowrap">
            <Activity className="w-4 h-4 mr-2" />
            Check Injuries
          </Button>
          <Button size="sm" variant="outline" className="whitespace-nowrap">
            <Target className="w-4 h-4 mr-2" />
            Waiver Targets
          </Button>
        </div>

        {/* Confidence Meter */}
        <div className="mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium">Lineup Confidence</span>
            <span className="text-sm font-bold">{averageConfidence.toFixed(0)}%</span>
          </div>
          <Progress value={averageConfidence} className="h-3" />
          <div className="flex justify-between text-xs text-gray-400 mt-1">
            <span>Low</span>
            <span>Optimal</span>
          </div>
        </div>

        {/* Roster Tabs */}
        <Tabs defaultValue="starters" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger value="starters">Starters</TabsTrigger>
            <TabsTrigger value="bench">Bench</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="starters" className="mt-4">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={players.map(p => p.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="space-y-3">
                  {players.filter(p => p.isStarter).map((player, index) => (
                    <SortablePlayer key={player.id} player={player} index={index} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </TabsContent>

          <TabsContent value="bench" className="mt-4">
            <div className="space-y-3">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="bg-gray-800 border border-gray-700 rounded-lg p-4 text-center"
              >
                <p className="text-gray-400 mb-3">No bench players yet</p>
                <Button size="sm">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Players
                </Button>
              </motion.div>
            </div>
          </TabsContent>

          <TabsContent value="insights" className="mt-4">
            <div className="space-y-4">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/20 rounded-lg"
              >
                <TrendingUp className="w-5 h-5 text-green-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Lineup Strength: Strong</p>
                  <p className="text-sm text-gray-400">Projected to outscore 73% of teams this week</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-3 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg"
              >
                <AlertCircle className="w-5 h-5 text-yellow-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Injury Alert</p>
                  <p className="text-sm text-gray-400">McCaffrey (Q) - Monitor status before kickoff</p>
                </div>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 }}
                className="flex items-center gap-3 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg"
              >
                <Zap className="w-5 h-5 text-blue-500 flex-shrink-0" />
                <div>
                  <p className="font-semibold">Hot Streak</p>
                  <p className="text-sm text-gray-400">Tyreek Hill averaging 25.3 pts last 3 games</p>
                </div>
              </motion.div>
            </div>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Mobile-Optimized Quick Stats */}
      <div className="grid grid-cols-2 gap-4 lg:hidden">
        <Card className="bg-gray-900 border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <Trophy className="w-4 h-4 text-yellow-500" />
            <span className="text-sm text-gray-400">League Rank</span>
          </div>
          <div className="text-2xl font-bold">#2</div>
          <div className="text-xs text-gray-400">of 12 teams</div>
        </Card>

        <Card className="bg-gray-900 border-gray-800 p-4">
          <div className="flex items-center gap-2 mb-2">
            <BarChart3 className="w-4 h-4 text-blue-500" />
            <span className="text-sm text-gray-400">Points For</span>
          </div>
          <div className="text-2xl font-bold">1,142.3</div>
          <div className="text-xs text-green-500">+8.5% vs avg</div>
        </Card>
      </div>
    </div>
  );
};

export default FantasyRosterManager;
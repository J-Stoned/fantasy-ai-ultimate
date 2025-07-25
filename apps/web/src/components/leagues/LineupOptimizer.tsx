'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import useLeagueStore from '../../stores/useLeagueStore';
import { Card } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Progress } from '../ui/progress';
import { logger } from '../../lib/logging/logger';

interface LineupSlot {
  position: string;
  player?: any;
  isLocked?: boolean;
  projectedPoints?: number;
}

interface LineupOptimizerProps {
  leagueId: string;
}

export function LineupOptimizer({ leagueId }: LineupOptimizerProps) {
  const league = useLeagueStore((state) => state.leagues.get(leagueId));
  const [lineup, setLineup] = useState<LineupSlot[]>([]);
  const [bench, setBench] = useState<any[]>([]);
  const [optimizing, setOptimizing] = useState(false);
  const [aiRecommendations, setAiRecommendations] = useState<any[]>([]);
  const [totalProjected, setTotalProjected] = useState(0);
  
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );
  
  // Initialize lineup based on league settings
  useEffect(() => {
    if (league) {
      initializeLineup();
    }
  }, [league]);
  
  // Calculate total projected points
  useEffect(() => {
    const total = lineup.reduce((sum, slot) => sum + (slot.projectedPoints || 0), 0);
    setTotalProjected(total);
  }, [lineup]);
  
  const initializeLineup = () => {
    if (!league) return;
    
    // Default lineup structure (customize based on league.settings)
    const positions = ['QB', 'RB', 'RB', 'WR', 'WR', 'WR', 'TE', 'FLEX', 'DEF', 'K'];
    const lineupSlots: LineupSlot[] = positions.map(pos => ({
      position: pos,
      player: undefined,
      projectedPoints: 0,
    }));
    
    // Fill with current roster
    if (league.roster) {
      const usedPlayers = new Set<string>();
      
      // First, fill position-specific slots
      lineupSlots.forEach((slot, index) => {
        const eligiblePlayer = league.roster!.find(p => 
          p.position === slot.position && !usedPlayers.has(p.id)
        );
        
        if (eligiblePlayer) {
          lineupSlots[index] = {
            ...slot,
            player: eligiblePlayer,
            projectedPoints: eligiblePlayer.projectedPoints || 0,
          };
          usedPlayers.add(eligiblePlayer.id);
        }
      });
      
      // Remaining players go to bench
      const benchPlayers = league.roster.filter(p => !usedPlayers.has(p.id));
      setBench(benchPlayers);
    }
    
    setLineup(lineupSlots);
  };
  
  const optimizeLineup = async () => {
    setOptimizing(true);
    
    try {
      // Call your optimization API
      const response = await fetch('/api/optimize/lineup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId,
          currentLineup: lineup,
          bench,
          scoringSettings: league?.settings,
        }),
      });
      
      const data = await response.json();
      
      if (data.optimizedLineup) {
        setLineup(data.optimizedLineup);
        setAiRecommendations(data.recommendations || []);
      }
    } catch (error) {
      logger.error('Optimization failed:', { error: error });
    } finally {
      setOptimizing(false);
    }
  };
  
  const handleDragEnd = (event: any) => {
    const { active, over } = event;
    
    if (active.id !== over.id) {
      setLineup((items) => {
        const oldIndex = items.findIndex(item => item.position === active.id);
        const newIndex = items.findIndex(item => item.position === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };
  
  const applyToAllLeagues = async () => {
    if (!league) return;
    
    // Get all leagues of the same sport
    const sameLeagues = useLeagueStore.getState().getLeaguesBySport(league.sport);
    
    // Apply lineup to each league (would need platform-specific API calls)
    for (const targetLeague of sameLeagues) {
      if (targetLeague.id !== leagueId) {
        // Map players to target league's roster
        logger.info('Applying lineup to ${targetLeague.name}');
      }
    }
  };
  
  if (!league) {
    return <div className="text-gray-400">League not found</div>;
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold text-white">Lineup Optimizer</h3>
          <p className="text-gray-400">
            Projected Total: <span className="text-white font-bold">{totalProjected.toFixed(1)}</span> points
          </p>
        </div>
        
        <div className="flex gap-3">
          <Button
            onClick={optimizeLineup}
            disabled={optimizing}
            variant="default"
          >
            {optimizing ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Optimizing...
              </>
            ) : (
              <>
                <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                AI Optimize
              </>
            )}
          </Button>
          
          <Button
            onClick={applyToAllLeagues}
            variant="outline"
            className="bg-white/10 border-white/20 text-white hover:bg-white/20"
          >
            Apply to All Leagues
          </Button>
        </div>
      </div>
      
      {/* AI Recommendations */}
      {aiRecommendations.length > 0 && (
        <Card className="bg-gradient-to-r from-purple-600/20 to-blue-600/20 border-purple-500/30">
          <div className="p-4">
            <h4 className="font-medium text-white mb-3 flex items-center">
              <svg className="w-5 h-5 mr-2 text-yellow-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              AI Recommendations
            </h4>
            <div className="space-y-2">
              {aiRecommendations.map((rec, idx) => (
                <div key={idx} className="flex items-start gap-2 text-sm">
                  <span className="text-purple-400">•</span>
                  <span className="text-gray-300">{rec.message}</span>
                  {rec.confidence && (
                    <Badge variant="outline" className="ml-auto text-xs">
                      {(rec.confidence * 100).toFixed(0)}%
                    </Badge>
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Starting Lineup */}
        <div className="lg:col-span-2">
          <Card className="bg-white/10 backdrop-blur-lg border-white/20">
            <div className="p-4 border-b border-white/10">
              <h4 className="font-medium text-white">Starting Lineup</h4>
            </div>
            
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={lineup.map(slot => slot.position)}
                strategy={verticalListSortingStrategy}
              >
                <div className="p-4 space-y-2">
                  {lineup.map((slot) => (
                    <LineupSlot key={slot.position} slot={slot} />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </Card>
        </div>
        
        {/* Bench */}
        <div>
          <Card className="bg-white/10 backdrop-blur-lg border-white/20">
            <div className="p-4 border-b border-white/10">
              <h4 className="font-medium text-white">Bench</h4>
            </div>
            
            <div className="p-4 space-y-2">
              {bench.length === 0 ? (
                <p className="text-gray-400 text-center py-4">No bench players</p>
              ) : (
                bench.map((player) => (
                  <div
                    key={player.id}
                    className="bg-white/5 rounded-lg p-3 flex items-center justify-between"
                  >
                    <div>
                      <p className="font-medium text-white text-sm">{player.name}</p>
                      <p className="text-xs text-gray-400">
                        {player.position} - {player.team}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-white text-sm">
                        {player.projectedPoints?.toFixed(1) || '0.0'}
                      </p>
                      {player.injuryStatus && (
                        <Badge variant="destructive" className="text-xs mt-1">
                          {player.injuryStatus}
                        </Badge>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
          
          {/* Pattern Insights */}
          <Card className="bg-white/10 backdrop-blur-lg border-white/20 mt-4">
            <div className="p-4">
              <h4 className="font-medium text-white mb-3">Pattern Insights</h4>
              <div className="space-y-3">
                <div className="bg-green-900/20 rounded-lg p-3 border border-green-600/30">
                  <p className="text-sm text-green-400 font-medium">Back-to-Back Fade</p>
                  <p className="text-xs text-gray-300 mt-1">
                    Consider fading RB Johnson - team on 2nd game in 2 days
                  </p>
                </div>
                <div className="bg-yellow-900/20 rounded-lg p-3 border border-yellow-600/30">
                  <p className="text-sm text-yellow-400 font-medium">Altitude Advantage</p>
                  <p className="text-xs text-gray-300 mt-1">
                    WR Smith playing in Denver - historical 15% boost
                  </p>
                </div>
              </div>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

// Sortable Lineup Slot Component
function LineupSlot({ slot }: { slot: LineupSlot }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: slot.position });
  
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
      whileHover={{ scale: 1.02 }}
      className={`
        bg-white/5 rounded-lg p-4 cursor-move
        ${slot.isLocked ? 'opacity-50' : ''}
        ${!slot.player ? 'border-2 border-dashed border-white/20' : ''}
      `}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="min-w-[3rem] text-center">
            {slot.position}
          </Badge>
          
          {slot.player ? (
            <div>
              <p className="font-medium text-white">{slot.player.name}</p>
              <p className="text-sm text-gray-400">
                {slot.player.team} vs {slot.player.opponent || 'TBD'}
              </p>
            </div>
          ) : (
            <p className="text-gray-500">Empty slot</p>
          )}
        </div>
        
        <div className="text-right">
          <p className="text-lg font-bold text-white">
            {slot.projectedPoints?.toFixed(1) || '0.0'}
          </p>
          <p className="text-xs text-gray-400">projected</p>
        </div>
      </div>
      
      {slot.player?.injuryStatus && (
        <div className="mt-2">
          <Badge variant="destructive" className="text-xs">
            {slot.player.injuryStatus}
          </Badge>
        </div>
      )}
    </motion.div>
  );
}
'use client';

import React, { useState, useEffect, useMemo, useCallback, memo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Search, 
  Filter, 
  TrendingUp, 
  TrendingDown,
  Star,
  AlertCircle,
  Check,
  X,
  Wifi,
  WifiOff,
  Zap
} from 'lucide-react';
import { 
  DraftState, 
  Player, 
  DraftRecommendation 
} from '@/lib/services/traditional-fantasy/draft-analysis/types';
import { PlayerCard } from './PlayerCard';
import { 
  useDraftWebSocket, 
  DraftPickUpdate,
  DraftParticipant 
} from '@/lib/hooks/useDraftWebSocket';
import toast from 'react-hot-toast';
import { 
import { logger } from '../../lib/logging/logger';
  usePerformanceMonitor, 
  useDebouncedCallback,
  useVirtualList,
  shallowEqualKeys 
} from '@/lib/utils/performance';

interface DraftBoardProps {
  draftState: DraftState | null;
  selectedPlayer: Player | null;
  onMakePick: (playerId: string) => void;
  recommendations: DraftRecommendation[];
  draftId: string;
  userId: string;
  teamId: string;
}

// Memoized search bar component
const SearchBar = memo(({ 
  searchQuery, 
  onSearchChange, 
  selectedPosition, 
  onPositionChange 
}: {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  selectedPosition: string;
  onPositionChange: (value: string) => void;
}) => {
  const debouncedSearch = useDebouncedCallback(onSearchChange, 300);
  
  return (
    <div className="flex gap-4">
      <div className="flex-1 relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
        <input
          type="text"
          placeholder="Search players..."
          defaultValue={searchQuery}
          onChange={(e) => debouncedSearch(e.target.value)}
          className="input-field pl-10"
        />
      </div>
      
      <select
        value={selectedPosition}
        onChange={(e) => onPositionChange(e.target.value)}
        className="input-field w-32"
      >
        <option value="ALL">All Positions</option>
        <option value="QB">QB</option>
        <option value="RB">RB</option>
        <option value="WR">WR</option>
        <option value="TE">TE</option>
        <option value="K">K</option>
        <option value="DST">DST</option>
      </select>
    </div>
  );
});

SearchBar.displayName = 'SearchBar';

// Memoized recent picks component
const RecentPicks = memo(({ picks }: { picks: DraftPickUpdate[] }) => {
  if (picks.length === 0) return null;
  
  return (
    <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
      <h4 className="text-sm font-medium mb-2 text-gray-300">Recent Picks</h4>
      <div className="flex gap-2 overflow-x-auto">
        {picks.map((pick, index) => (
          <motion.div
            key={pick.pickNumber}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex-shrink-0 p-2 bg-white/10 rounded text-xs"
          >
            <div className="font-medium text-primary-400">
              Pick {pick.pickNumber}
            </div>
            <div className="text-white">{pick.playerName}</div>
            <div className="text-gray-400">
              {pick.position} • {pick.team}
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.picks.length === nextProps.picks.length &&
    prevProps.picks[0]?.pickNumber === nextProps.picks[0]?.pickNumber;
});

RecentPicks.displayName = 'RecentPicks';

// Memoized connection status
const ConnectionStatus = memo(({ 
  isConnected, 
  participants 
}: { 
  isConnected: boolean; 
  participants: DraftParticipant[] 
}) => {
  const autoPickCount = useMemo(
    () => participants.filter(p => p.autoPick).length,
    [participants]
  );
  
  return (
    <div className="flex items-center gap-2">
      {isConnected ? (
        <div className="flex items-center gap-1 text-green-400">
          <Wifi className="w-4 h-4" />
          <span className="text-xs">Live</span>
        </div>
      ) : (
        <div className="flex items-center gap-1 text-red-400">
          <WifiOff className="w-4 h-4" />
          <span className="text-xs">Offline</span>
        </div>
      )}
      
      {autoPickCount > 0 && (
        <div className="flex items-center gap-1 text-orange-400">
          <Zap className="w-3 h-3" />
          <span className="text-xs">
            {autoPickCount} auto-pick
          </span>
        </div>
      )}
    </div>
  );
});

ConnectionStatus.displayName = 'ConnectionStatus';

// Main optimized draft board
export const DraftBoardOptimized = memo(function DraftBoardOptimized({ 
  draftState, 
  selectedPlayer, 
  onMakePick,
  recommendations,
  draftId,
  userId,
  teamId 
}: DraftBoardProps) {
  const { measureRender } = usePerformanceMonitor('DraftBoard');
  
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedPosition, setSelectedPosition] = useState<string>('ALL');
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(false);
  const [recentPicks, setRecentPicks] = useState<DraftPickUpdate[]>([]);
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);

  // WebSocket integration
  const {
    isConnected,
    connectionStatus,
    makePick: wsPickPlayer
  } = useDraftWebSocket({
    draftId,
    userId,
    teamId,
    onPickUpdate: useCallback((pick: DraftPickUpdate) => {
      setRecentPicks(prev => [pick, ...prev.slice(0, 4)]); // Keep last 5 picks
      toast.success(`${pick.playerName} drafted by ${pick.teamId}!`, {
        icon: '🏈',
        duration: 4000,
      });
      
      // Remove player from available players
      setAvailablePlayers(prev => prev.filter(p => p.id !== pick.playerId));
    }, []),
    onParticipantUpdate: useCallback((newParticipants: DraftParticipant[]) => {
      setParticipants(newParticipants);
    }, []),
    onConnectionChange: useCallback((connected: boolean) => {
      if (connected) {
        toast.success('Connected to draft room!', { icon: '🔗' });
      } else {
        toast.error('Disconnected from draft room', { icon: '📱' });
      }
    }, [])
  });

  // Mock available players (in production, this would come from the API)
  useEffect(() => {
    if (draftState) {
      // Generate mock available players
      const mockPlayers: Player[] = [];
      const positions = ['QB', 'RB', 'WR', 'TE', 'K', 'DST'];
      
      draftState.availablePlayers.forEach((playerId) => {
        // Create mock player data
        const position = positions[Math.floor(Math.random() * positions.length)];
        mockPlayers.push({
          id: playerId,
          name: `Player ${playerId.split('-')[1]}`,
          team: ['KC', 'BUF', 'SF', 'PHI'][Math.floor(Math.random() * 4)],
          position,
          sport: 'NFL',
          age: 22 + Math.floor(Math.random() * 12),
          injuryStatus: Math.random() > 0.9 ? 'questionable' : 'healthy'
        });
      });
      
      setAvailablePlayers(mockPlayers);
    }
  }, [draftState]);

  // Memoized recommendation lookup
  const recommendationMap = useMemo(() => {
    const map = new Map<string, number>();
    recommendations.forEach(rec => {
      map.set(rec.playerId, rec.score);
    });
    return map;
  }, [recommendations]);

  // Memoized filtered and sorted players
  const sortedPlayers = useMemo(() => {
    const filtered = availablePlayers.filter(player => {
      const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                           player.team.toLowerCase().includes(searchQuery.toLowerCase());
      const matchesPosition = selectedPosition === 'ALL' || player.position === selectedPosition;
      return matchesSearch && matchesPosition;
    });
    
    // Sort by recommendation score
    return filtered.sort((a, b) => {
      const scoreA = recommendationMap.get(a.id) || 0;
      const scoreB = recommendationMap.get(b.id) || 0;
      return scoreB - scoreA;
    });
  }, [availablePlayers, searchQuery, selectedPosition, recommendationMap]);

  // Virtual list for large player lists
  const {
    visibleItems,
    totalHeight,
    offsetY,
    handleScroll
  } = useVirtualList({
    items: sortedPlayers,
    itemHeight: 180, // Approximate height of PlayerCard
    containerHeight: 600,
    overscan: 3
  });

  const handlePick = useCallback(async (playerId: string) => {
    setLoading(true);
    
    try {
      const player = availablePlayers.find(p => p.id === playerId);
      if (!player) {
        toast.error('Player not found');
        return;
      }

      // Use WebSocket for real-time pick
      wsPickPlayer(playerId, player.name, player.position, player.team);
      
      // Also call the original callback for local state management
      await onMakePick(playerId);
    } catch (error) {
      toast.error('Failed to make pick');
      logger.error('Pick error:', { error: error });
    } finally {
      setLoading(false);
    }
  }, [availablePlayers, wsPickPlayer, onMakePick]);

  if (!draftState) {
    return (
      <div className="glass-card p-8 text-center">
        <p className="text-gray-400">No active draft</p>
      </div>
    );
  }

  const isMyTurn = draftState.draftOrder[draftState.currentPick % draftState.teamCount] === draftState.myTeamId;

  return (
    <div className="glass-card p-6">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h2 className="text-2xl font-bold">Draft Board</h2>
            <ConnectionStatus 
              isConnected={isConnected} 
              participants={participants} 
            />
          </div>
          
          <div className="text-sm text-gray-400">
            {isMyTurn ? (
              <span className="text-primary-400 font-semibold">Your Turn!</span>
            ) : (
              <span>Waiting for other teams...</span>
            )}
          </div>
        </div>

        <RecentPicks picks={recentPicks} />

        <SearchBar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          selectedPosition={selectedPosition}
          onPositionChange={setSelectedPosition}
        />
      </div>

      {/* Virtual Scrolling Players Grid */}
      <div 
        className="relative max-h-[600px] overflow-y-auto"
        onScroll={handleScroll}
      >
        <div 
          style={{ height: totalHeight }}
          className="relative"
        >
          <div
            style={{ transform: `translateY(${offsetY}px)` }}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4"
          >
            {visibleItems.map((player, index) => {
              const recommendationScore = recommendationMap.get(player.id) || 0;
              const isRecommended = recommendationScore > 80;
              const isTopPick = index < 3 && recommendationScore > 70;
              
              return (
                <motion.div
                  key={player.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                >
                  <PlayerCard
                    player={player}
                    isRecommended={isRecommended}
                    isTopPick={isTopPick}
                    recommendationScore={recommendationScore}
                    onSelect={() => handlePick(player.id)}
                    isMyTurn={isMyTurn}
                    loading={loading}
                  />
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Selected Player Preview */}
      {selectedPlayer && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-6 p-4 bg-primary-500/10 border border-primary-500/30 rounded-lg"
        >
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold">{selectedPlayer.name}</h3>
              <p className="text-sm text-gray-400">
                {selectedPlayer.position} • {selectedPlayer.team}
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => handlePick(selectedPlayer.id)}
                disabled={!isMyTurn || loading}
                className="btn-primary text-sm flex items-center gap-2"
              >
                <Check className="w-4 h-4" />
                Draft
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}, shallowEqualKeys(['draftId', 'userId', 'teamId']));

export default DraftBoardOptimized;
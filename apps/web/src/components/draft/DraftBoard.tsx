'use client';

import { useState, useEffect } from 'react';
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
import { logger } from '../../lib/logging/logger';

interface DraftBoardProps {
  draftState: DraftState | null;
  selectedPlayer: Player | null;
  onMakePick: (playerId: string) => void;
  recommendations: DraftRecommendation[];
  draftId: string;
  userId: string;
  teamId: string;
}

export function DraftBoard({ 
  draftState, 
  selectedPlayer, 
  onMakePick,
  recommendations,
  draftId,
  userId,
  teamId 
}: DraftBoardProps) {
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
    onPickUpdate: (pick) => {
      setRecentPicks(prev => [pick, ...prev.slice(0, 4)]); // Keep last 5 picks
      toast.success(`${pick.playerName} drafted by ${pick.teamId}!`, {
        icon: '🏈',
        duration: 4000,
      });
      
      // Remove player from available players
      setAvailablePlayers(prev => prev.filter(p => p.id !== pick.playerId));
    },
    onParticipantUpdate: (newParticipants) => {
      setParticipants(newParticipants);
    },
    onConnectionChange: (connected) => {
      if (connected) {
        toast.success('Connected to draft room!', { icon: '🔗' });
      } else {
        toast.error('Disconnected from draft room', { icon: '📱' });
      }
    }
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

  // Filter players
  const filteredPlayers = availablePlayers.filter(player => {
    const matchesSearch = player.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         player.team.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesPosition = selectedPosition === 'ALL' || player.position === selectedPosition;
    return matchesSearch && matchesPosition;
  });

  // Get recommendation score for a player
  const getRecommendationScore = (playerId: string) => {
    const rec = recommendations.find(r => r.playerId === playerId);
    return rec?.score || 0;
  };

  // Sort players by recommendation score
  const sortedPlayers = [...filteredPlayers].sort((a, b) => {
    const scoreA = getRecommendationScore(a.id);
    const scoreB = getRecommendationScore(b.id);
    return scoreB - scoreA;
  });

  const handlePick = async (playerId: string) => {
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
  };

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
            
            {/* Connection Status */}
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
              
              {participants.filter(p => p.autoPick).length > 0 && (
                <div className="flex items-center gap-1 text-orange-400">
                  <Zap className="w-3 h-3" />
                  <span className="text-xs">
                    {participants.filter(p => p.autoPick).length} auto-pick
                  </span>
                </div>
              )}
            </div>
          </div>
          
          <div className="text-sm text-gray-400">
            {isMyTurn ? (
              <span className="text-primary-400 font-semibold">Your Turn!</span>
            ) : (
              <span>Waiting for other teams...</span>
            )}
          </div>
        </div>

        {/* Recent Picks */}
        {recentPicks.length > 0 && (
          <div className="mb-4 p-3 bg-white/5 rounded-lg border border-white/10">
            <h4 className="text-sm font-medium mb-2 text-gray-300">Recent Picks</h4>
            <div className="flex gap-2 overflow-x-auto">
              {recentPicks.map((pick, index) => (
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
        )}

        {/* Search and Filters */}
        <div className="flex gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search players..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field pl-10"
            />
          </div>
          
          <select
            value={selectedPosition}
            onChange={(e) => setSelectedPosition(e.target.value)}
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
      </div>

      {/* Players Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto">
        <AnimatePresence>
          {sortedPlayers.slice(0, 30).map((player, index) => {
            const recommendationScore = getRecommendationScore(player.id);
            const isRecommended = recommendationScore > 80;
            const isTopPick = index < 3 && recommendationScore > 70;
            
            return (
              <motion.div
                key={player.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
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
        </AnimatePresence>
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
}
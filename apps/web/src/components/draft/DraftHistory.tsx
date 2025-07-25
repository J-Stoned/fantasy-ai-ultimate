'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Clock, 
  User,
  TrendingUp,
  TrendingDown,
  Minus,
  Zap,
  Crown
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { DraftPickUpdate } from '@/lib/hooks/useDraftWebSocket';

interface DraftHistoryProps {
  picks: any[]; // DraftPick[]
  teams: Map<string, any>; // Map<string, TeamState>
  realtimePicks?: DraftPickUpdate[];
  onPickClick?: (pick: any) => void;
}

export function DraftHistory({ 
  picks, 
  teams, 
  realtimePicks = [],
  onPickClick 
}: DraftHistoryProps) {
  const [showAll, setShowAll] = useState(false);
  const [combinedPicks, setCombinedPicks] = useState<any[]>([]);
  const [newPicksCount, setNewPicksCount] = useState(0);

  // Combine original picks with real-time picks
  useEffect(() => {
    const allPicks = [
      ...picks,
      ...realtimePicks.map(rp => ({
        pickNumber: rp.pickNumber,
        round: rp.round,
        teamId: rp.teamId,
        playerId: rp.playerId,
        playerName: rp.playerName,
        position: rp.position,
        team: rp.team,
        timestamp: rp.timestamp,
        valueScore: Math.floor(Math.random() * 30) + 70, // Mock value
        reachScore: Math.floor(Math.random() * 20),
        isRealtime: true
      }))
    ].sort((a, b) => b.pickNumber - a.pickNumber);

    setCombinedPicks(allPicks);
    
    // Track new picks for badge
    if (realtimePicks.length > newPicksCount) {
      setNewPicksCount(realtimePicks.length);
    }
  }, [picks, realtimePicks, newPicksCount]);
  
  // Get recent picks (last 10 or all if showAll)
  const displayPicks = showAll ? combinedPicks : combinedPicks.slice(0, 10);

  const getValueIndicator = (valueScore: number, reachScore: number) => {
    if (valueScore >= 85) {
      return { icon: <TrendingUp className="w-3 h-3" />, color: 'text-green-400', label: 'Great Value' };
    } else if (valueScore >= 70) {
      return { icon: <TrendingUp className="w-3 h-3" />, color: 'text-blue-400', label: 'Good Value' };
    } else if (reachScore > 20) {
      return { icon: <TrendingDown className="w-3 h-3" />, color: 'text-orange-400', label: 'Reach' };
    } else {
      return { icon: <Minus className="w-3 h-3" />, color: 'text-gray-400', label: 'Fair Value' };
    }
  };

  const formatTime = (timestamp: Date) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    
    if (diff < 60000) return 'Just now';
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    return date.toLocaleDateString();
  };

  return (
    <div className="glass-card p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-purple-400" />
          <h2 className="text-xl font-bold">Draft History</h2>
          {newPicksCount > 0 && (
            <span className="bg-primary-500 text-white text-xs px-2 py-0.5 rounded-full animate-pulse">
              {newPicksCount} new
            </span>
          )}
        </div>
        {combinedPicks.length > 10 && (
          <button
            onClick={() => {
              setShowAll(!showAll);
              setNewPicksCount(0); // Clear badge when expanding
            }}
            className="text-xs text-primary-400 hover:text-primary-300"
          >
            {showAll ? 'Show Less' : `Show All (${combinedPicks.length})`}
          </button>
        )}
      </div>

      <div className="space-y-2 max-h-96 overflow-y-auto">
        {displayPicks.length === 0 ? (
          <p className="text-gray-400 text-center py-8">
            No picks made yet
          </p>
        ) : (
          <AnimatePresence>
            {displayPicks.map((pick, index) => {
              const team = teams.get(pick.teamId);
              const { icon, color, label } = getValueIndicator(pick.valueScore, pick.reachScore);
              
              return (
                <motion.div
                  key={`${pick.pickNumber}-${index}`}
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{ delay: index * 0.02 }}
                  className={`flex items-center gap-3 p-3 rounded-lg transition-all duration-300 cursor-pointer ${
                    pick.isRealtime 
                      ? 'bg-primary-500/20 border border-primary-500/40 hover:bg-primary-500/30' 
                      : 'bg-white/5 hover:bg-white/10'
                  }`}
                  onClick={() => onPickClick?.(pick)}
                >
                {/* Pick Number */}
                <div className="text-center">
                  <div className="text-xs text-gray-500">Pick</div>
                  <div className="font-bold">{pick.pickNumber}</div>
                </div>

                {/* Team & Player Info */}
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <User className="w-3 h-3 text-gray-400" />
                    <span className="text-sm font-medium">
                      {team?.teamName || `Team ${pick.teamId.split('-')[1]}`}
                    </span>
                    {pick.isRealtime && (
                      <Zap className="w-3 h-3 text-primary-400" />
                    )}
                  </div>
                  <div className="text-xs text-gray-400">
                    {pick.playerName || `Player ${pick.playerId.split('-')[1]}`} • Round {pick.round}
                  </div>
                  {pick.position && pick.team && (
                    <div className="text-xs text-purple-400">
                      {pick.position} • {pick.team}
                    </div>
                  )}
                </div>

                {/* Value Indicator */}
                <div className="flex items-center gap-1">
                  <div className={`${color}`}>{icon}</div>
                  <span className={`text-xs ${color}`}>{label}</span>
                </div>

                {/* Time */}
                <div className="text-xs text-gray-500">
                  {formatTime(pick.timestamp)}
                </div>
              </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* Quick Stats */}
      {picks.length > 0 && (
        <div className="mt-4 pt-4 border-t border-white/10">
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center p-2 bg-white/5 rounded">
              <div className="text-gray-400">Total Picks</div>
              <div className="font-semibold">{picks.length}</div>
            </div>
            <div className="text-center p-2 bg-white/5 rounded">
              <div className="text-gray-400">Current Round</div>
              <div className="font-semibold">
                {picks.length > 0 ? picks[picks.length - 1].round : 1}
              </div>
            </div>
            <div className="text-center p-2 bg-white/5 rounded">
              <div className="text-gray-400">Avg Value</div>
              <div className="font-semibold">
                {picks.length > 0 
                  ? Math.round(picks.reduce((sum, p) => sum + p.valueScore, 0) / picks.length)
                  : 0}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
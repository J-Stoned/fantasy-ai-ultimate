'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { 
  Users, 
  Wifi, 
  WifiOff, 
  Crown, 
  Timer, 
  Play,
  Settings,
  UserCheck,
  Clock,
  Zap
} from 'lucide-react';
import { DraftParticipant } from '@/lib/hooks/useDraftWebSocket';

interface DraftLobbyProps {
  participants: DraftParticipant[];
  currentPickTeamId?: string;
  isCommissioner?: boolean;
  onToggleAutoPick?: (teamId: string, enabled: boolean) => void;
  onKickUser?: (userId: string) => void;
  className?: string;
}

export function DraftLobby({ 
  participants, 
  currentPickTeamId,
  isCommissioner = false,
  onToggleAutoPick,
  onKickUser,
  className = '' 
}: DraftLobbyProps) {
  const sortedParticipants = [...participants].sort((a, b) => {
    // Current pick first
    if (a.isCurrentPick) return -1;
    if (b.isCurrentPick) return 1;
    
    // Online users next
    if (a.isOnline && !b.isOnline) return -1;
    if (!a.isOnline && b.isOnline) return 1;
    
    // Then by team order
    return a.teamId.localeCompare(b.teamId);
  });

  const onlineCount = participants.filter(p => p.isOnline).length;
  const autoPickCount = participants.filter(p => p.autoPick).length;

  const getStatusIcon = (participant: DraftParticipant) => {
    if (participant.isCurrentPick) {
      return <Timer className="w-4 h-4 text-primary-400 animate-pulse" />;
    }
    if (participant.isOnline) {
      return <Wifi className="w-4 h-4 text-green-400" />;
    }
    return <WifiOff className="w-4 h-4 text-gray-500" />;
  };

  const getStatusColor = (participant: DraftParticipant) => {
    if (participant.isCurrentPick) return 'border-primary-500/50 bg-primary-500/10';
    if (participant.isOnline) return 'border-green-500/30 bg-green-500/5';
    return 'border-gray-600/30 bg-gray-600/5';
  };

  return (
    <div className={`glass-card p-4 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Users className="w-5 h-5 text-blue-400" />
          <h3 className="font-semibold">Draft Room</h3>
        </div>
        
        <div className="flex items-center gap-4 text-sm text-gray-400">
          <div className="flex items-center gap-1">
            <div className="w-2 h-2 bg-green-400 rounded-full"></div>
            <span>{onlineCount}/{participants.length} online</span>
          </div>
          {autoPickCount > 0 && (
            <div className="flex items-center gap-1">
              <Zap className="w-3 h-3 text-orange-400" />
              <span>{autoPickCount} auto-pick</span>
            </div>
          )}
        </div>
      </div>

      {/* Participants List */}
      <div className="space-y-2 max-h-64 overflow-y-auto">
        <AnimatePresence>
          {sortedParticipants.map((participant, index) => (
            <motion.div
              key={participant.userId}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ delay: index * 0.05 }}
              className={`p-3 rounded-lg border transition-all duration-300 ${getStatusColor(participant)}`}
            >
              <div className="flex items-center justify-between">
                {/* User Info */}
                <div className="flex items-center gap-3">
                  <div className="relative">
                    {getStatusIcon(participant)}
                    {participant.isCurrentPick && (
                      <motion.div
                        className="absolute -inset-1 bg-primary-400 opacity-20 rounded-full"
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1, repeat: Infinity }}
                      />
                    )}
                  </div>
                  
                  <div>
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${
                        participant.isCurrentPick 
                          ? 'text-primary-400' 
                          : participant.isOnline 
                            ? 'text-white' 
                            : 'text-gray-400'
                      }`}>
                        {participant.username}
                      </span>
                      
                      {isCommissioner && participant.userId === 'commissioner' && (
                        <Crown className="w-3 h-3 text-yellow-400" />
                      )}
                    </div>
                    
                    <div className="flex items-center gap-2 text-xs text-gray-400">
                      <span>{participant.teamId}</span>
                      
                      {participant.autoPick && (
                        <div className="flex items-center gap-1 text-orange-400">
                          <Zap className="w-3 h-3" />
                          <span>Auto-pick</span>
                        </div>
                      )}
                      
                      {participant.isCurrentPick && (
                        <motion.div
                          animate={{ opacity: [1, 0.5, 1] }}
                          transition={{ duration: 1, repeat: Infinity }}
                          className="flex items-center gap-1 text-primary-400"
                        >
                          <Clock className="w-3 h-3" />
                          <span>On the clock</span>
                        </motion.div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Actions */}
                {isCommissioner && (
                  <div className="flex items-center gap-1">
                    {onToggleAutoPick && (
                      <button
                        onClick={() => onToggleAutoPick(participant.teamId, !participant.autoPick)}
                        className={`p-1 rounded transition-colors text-xs ${
                          participant.autoPick
                            ? 'bg-orange-500/20 text-orange-400 hover:bg-orange-500/30'
                            : 'bg-gray-600/20 text-gray-400 hover:bg-gray-600/30'
                        }`}
                        title={participant.autoPick ? 'Disable auto-pick' : 'Enable auto-pick'}
                      >
                        <Zap className="w-3 h-3" />
                      </button>
                    )}
                    
                    {onKickUser && participant.userId !== 'commissioner' && (
                      <button
                        onClick={() => onKickUser(participant.userId)}
                        className="p-1 rounded transition-colors text-xs bg-red-500/20 text-red-400 hover:bg-red-500/30"
                        title="Remove from draft"
                      >
                        ×
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Current Pick Indicator */}
              {participant.isCurrentPick && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  className="mt-2 pt-2 border-t border-primary-500/30"
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-primary-400">
                      {participant.isOnline ? 'Making pick...' : 'Away - Auto-pick soon'}
                    </span>
                    {!participant.isOnline && (
                      <div className="flex items-center gap-1 text-orange-400">
                        <Timer className="w-3 h-3" />
                        <span>30s warning</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Draft Status */}
      <div className="mt-4 pt-3 border-t border-white/10">
        <div className="grid grid-cols-2 gap-4 text-xs">
          <div className="text-center p-2 bg-white/5 rounded">
            <div className="text-gray-400">Current Pick</div>
            <div className="font-semibold text-primary-400">
              {currentPickTeamId || 'Starting...'}
            </div>
          </div>
          
          <div className="text-center p-2 bg-white/5 rounded">
            <div className="text-gray-400">Connection</div>
            <div className={`font-semibold ${
              onlineCount === participants.length 
                ? 'text-green-400' 
                : onlineCount > participants.length / 2 
                  ? 'text-orange-400' 
                  : 'text-red-400'
            }`}>
              {onlineCount === participants.length 
                ? 'All Connected' 
                : `${onlineCount}/${participants.length} Online`}
            </div>
          </div>
        </div>
      </div>

      {/* Commissioner Controls */}
      {isCommissioner && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="mt-4 pt-3 border-t border-white/10"
        >
          <div className="flex items-center gap-2 text-xs text-gray-400 mb-2">
            <Crown className="w-3 h-3 text-yellow-400" />
            <span>Commissioner Controls</span>
          </div>
          
          <div className="flex gap-2">
            <button className="btn-ghost text-xs px-3 py-1 flex items-center gap-1">
              <Settings className="w-3 h-3" />
              Settings
            </button>
            <button className="btn-ghost text-xs px-3 py-1 flex items-center gap-1">
              <UserCheck className="w-3 h-3" />
              Check All
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
}
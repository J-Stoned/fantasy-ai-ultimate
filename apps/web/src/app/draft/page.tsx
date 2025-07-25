'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Trophy, 
  TrendingUp, 
  AlertCircle, 
  Clock, 
  Users,
  Sparkles,
  BarChart3,
  Play,
  Pause,
  Download,
  RefreshCw
} from 'lucide-react';
import { DraftBoard } from '@/components/draft/DraftBoard';
import { RecommendationPanel } from '@/components/draft/RecommendationPanel';
import { ScarcityIndicator } from '@/components/draft/ScarcityIndicator';
import { TeamRoster } from '@/components/draft/TeamRoster';
import { DraftHistory } from '@/components/draft/DraftHistory';
import { DraftTimer } from '@/components/draft/DraftTimer';
import { DraftChat } from '@/components/draft/DraftChat';
import { DraftLobby } from '@/components/draft/DraftLobby';
import { 
  useDraftWebSocket,
  DraftPickUpdate,
  DraftChatMessage,
  DraftTimerUpdate,
  DraftStateUpdate,
  DraftParticipant
} from '@/lib/hooks/useDraftWebSocket';
import { 
  DraftState, 
  DraftRecommendation, 
  PositionScarcity,
  DraftAnalysis,
  Player
} from '@/lib/services/traditional-fantasy/draft-analysis/types';
import toast from 'react-hot-toast';
import { logger } from '../../lib/logging/logger';

export default function DraftPage() {
  const [draftState, setDraftState] = useState<DraftState | null>(null);
  const [recommendations, setRecommendations] = useState<DraftRecommendation[]>([]);
  const [positionScarcity, setPositionScarcity] = useState<Map<string, PositionScarcity>>(new Map());
  const [teamAnalysis, setTeamAnalysis] = useState<DraftAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [draftStarted, setDraftStarted] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<Player | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  
  // WebSocket state
  const [draftId] = useState(`draft_${Date.now()}`);
  const userId = 'user-1'; // In real app, get from auth context
  const teamId = 'team-1';
  const [realtimePicks, setRealtimePicks] = useState<DraftPickUpdate[]>([]);
  const [chatMessages, setChatMessages] = useState<DraftChatMessage[]>([]);
  const [timerUpdate, setTimerUpdate] = useState<DraftTimerUpdate | null>(null);
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);
  const [isChatMinimized, setIsChatMinimized] = useState(false);

  // WebSocket integration
  const {
    isConnected,
    connectionStatus,
    sendChatMessage: wsSendChatMessage,
    toggleAutoPick,
    pauseDraft: wsPauseDraft,
    resumeDraft: wsResumeDraft,
    skipPick,
    undoLastPick
  } = useDraftWebSocket({
    draftId,
    userId,
    teamId,
    onPickUpdate: (pick) => {
      setRealtimePicks(prev => [pick, ...prev]);
      // Refresh local state
      fetchRecommendations();
      fetchTeamAnalysis();
    },
    onChatMessage: (message) => {
      setChatMessages(prev => [...prev, message]);
    },
    onTimerUpdate: (timer) => {
      setTimerUpdate(timer);
    },
    onStateUpdate: (state) => {
      setIsPaused(state.isPaused);
    },
    onParticipantUpdate: (newParticipants) => {
      setParticipants(newParticipants);
    }
  });

  // Initialize draft
  const initializeDraft = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/draft/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueSettings: {
            sport: 'NFL',
            draftType: 'snake',
            scoringType: 'ppr',
            teamCount: 12,
            rosterSize: 16
          },
          draftOrder: Array.from({ length: 12 }, (_, i) => `team-${i + 1}`),
          myTeamId: 'team-1'
        })
      });

      if (!response.ok) throw new Error('Failed to initialize draft');

      const data = await response.json();
      setDraftState(data.draftState);
      setDraftStarted(true);
      toast.success('Draft initialized successfully!');
    } catch (error) {
      toast.error('Failed to start draft');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch recommendations
  const fetchRecommendations = useCallback(async () => {
    if (!draftState) return;

    try {
      const response = await fetch('/api/draft/recommendations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draftState.draftId })
      });

      if (!response.ok) throw new Error('Failed to fetch recommendations');

      const data = await response.json();
      setRecommendations(data.recommendations);
      setPositionScarcity(new Map(Object.entries(data.positionScarcity)));
    } catch (error) {
      logger.error('Failed to fetch recommendations:', { error: error });
    }
  }, [draftState]);

  // Fetch team analysis
  const fetchTeamAnalysis = useCallback(async () => {
    if (!draftState) return;

    try {
      const response = await fetch('/api/draft/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          draftId: draftState.draftId,
          teamId: draftState.myTeamId 
        })
      });

      if (!response.ok) throw new Error('Failed to fetch analysis');

      const data = await response.json();
      setTeamAnalysis(data.analysis);
    } catch (error) {
      logger.error('Failed to fetch analysis:', { error: error });
    }
  }, [draftState]);

  // Make a pick
  const makePick = useCallback(async (playerId: string) => {
    if (!draftState) return;

    try {
      const response = await fetch('/api/draft/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          draftId: draftState.draftId,
          playerId 
        })
      });

      if (!response.ok) throw new Error('Failed to make pick');

      const data = await response.json();
      setDraftState(data.draftState);
      toast.success('Pick made successfully!');
      
      // Refresh recommendations and analysis
      await Promise.all([
        fetchRecommendations(),
        fetchTeamAnalysis()
      ]);
    } catch (error) {
      toast.error('Failed to make pick');
      console.error(error);
    }
  }, [draftState, fetchRecommendations, fetchTeamAnalysis]);

  // Toggle pause
  const togglePause = useCallback(() => {
    if (isPaused) {
      wsResumeDraft();
    } else {
      wsPauseDraft();
    }
  }, [isPaused, wsPauseDraft, wsResumeDraft]);

  // Export draft results
  const exportDraft = useCallback(async () => {
    if (!draftState) return;

    try {
      const response = await fetch(`/api/draft/export?draftId=${draftState.draftId}`);
      if (!response.ok) throw new Error('Failed to export draft');

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `draft-results-${new Date().toISOString()}.csv`;
      a.click();
      window.URL.revokeObjectURL(url);
      
      toast.success('Draft exported successfully!');
    } catch (error) {
      toast.error('Failed to export draft');
      console.error(error);
    }
  }, [draftState]);

  // Mock draft
  const runMockDraft = useCallback(async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/draft/mock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          settings: {
            aiDifficulty: 'medium',
            speed: 'fast'
          }
        })
      });

      if (!response.ok) throw new Error('Failed to run mock draft');

      const data = await response.json();
      setDraftState(data.draftState);
      setDraftStarted(true);
      toast.success('Mock draft started!');
    } catch (error) {
      toast.error('Failed to run mock draft');
      console.error(error);
    } finally {
      setLoading(false);
    }
  }, []);

  // Update recommendations when draft state changes
  useEffect(() => {
    if (draftState && draftStarted) {
      fetchRecommendations();
      fetchTeamAnalysis();
    }
  }, [draftState, draftStarted, fetchRecommendations, fetchTeamAnalysis]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="spinner w-12 h-12 mx-auto mb-4"></div>
          <p className="text-gray-400">Loading draft engine...</p>
        </div>
      </div>
    );
  }

  if (!draftStarted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-8 max-w-2xl w-full text-center"
        >
          <Trophy className="w-16 h-16 text-primary-500 mx-auto mb-6" />
          <h1 className="text-3xl font-bold mb-4">Start Your Draft</h1>
          <p className="text-gray-400 mb-8">
            Get AI-powered recommendations and real-time analysis to dominate your draft
          </p>
          
          <div className="space-y-4">
            <button
              onClick={initializeDraft}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Start New Draft
            </button>
            
            <button
              onClick={runMockDraft}
              className="btn-secondary w-full flex items-center justify-center gap-2"
            >
              <Users className="w-5 h-5" />
              Run Mock Draft
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold mb-2">AI Draft Assistant</h1>
          <p className="text-gray-400">
            Round {draftState?.currentRound} • Pick {draftState?.currentPick}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Connection Status */}
          <div className={`flex items-center gap-2 px-3 py-1 rounded-full text-xs ${
            isConnected 
              ? 'bg-green-500/20 text-green-400' 
              : 'bg-red-500/20 text-red-400'
          }`}>
            <div className={`w-2 h-2 rounded-full ${
              isConnected ? 'bg-green-400 animate-pulse' : 'bg-red-400'
            }`} />
            {isConnected ? 'Live' : 'Offline'}
          </div>

          <button
            onClick={togglePause}
            className="btn-ghost flex items-center gap-2"
          >
            {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
            {isPaused ? 'Resume' : 'Pause'}
          </button>
          
          <button
            onClick={() => skipPick()}
            className="btn-ghost flex items-center gap-2"
            disabled={!isConnected}
          >
            <RefreshCw className="w-5 h-5" />
            Skip
          </button>
          
          <button
            onClick={exportDraft}
            className="btn-ghost flex items-center gap-2"
          >
            <Download className="w-5 h-5" />
            Export
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Panel - Recommendations & Timer */}
        <div className="lg:col-span-3 space-y-6">
          <DraftTimer
            timerUpdate={timerUpdate}
            isMyTurn={draftState?.draftOrder[draftState?.currentPick % draftState?.teamCount] === draftState?.myTeamId}
            isPaused={isPaused}
            onTimeExpired={() => skipPick()}
          />
          
          <RecommendationPanel
            recommendations={recommendations}
            onSelectPlayer={(playerId) => {
              const player = recommendations.find(r => r.playerId === playerId);
              if (player) setSelectedPlayer(player as any);
            }}
          />
          
          <ScarcityIndicator
            positionScarcity={positionScarcity}
            sport={draftState?.leagueSettings.sport || 'NFL'}
          />
        </div>

        {/* Center - Draft Board */}
        <div className="lg:col-span-6">
          <DraftBoard
            draftState={draftState}
            selectedPlayer={selectedPlayer}
            onMakePick={makePick}
            recommendations={recommendations}
            draftId={draftId}
            userId={userId}
            teamId={teamId}
          />
        </div>

        {/* Right Panel - Team, History & Chat */}
        <div className="lg:col-span-3 space-y-6">
          <DraftLobby
            participants={participants}
            currentPickTeamId={draftState?.currentTeamId}
            isCommissioner={userId === 'commissioner'}
            onToggleAutoPick={(teamId, enabled) => toggleAutoPick(enabled)}
          />
          
          <TeamRoster
            team={draftState?.teams.get(draftState.myTeamId)}
            analysis={teamAnalysis}
          />
          
          <DraftHistory
            picks={draftState?.picks || []}
            teams={draftState?.teams || new Map()}
            realtimePicks={realtimePicks}
            onPickClick={(pick) => {
              toast(`Pick ${pick.pickNumber}: ${pick.playerName || 'Player'} (${pick.position || 'Unknown'})`, {
                icon: '🏈',
                duration: 3000,
              });
            }}
          />
          
          {/* Chat Component */}
          <DraftChat
            messages={chatMessages}
            onSendMessage={(message, emoji) => wsSendChatMessage(message, emoji)}
            participants={participants}
            isMinimized={isChatMinimized}
            onToggleMinimize={() => setIsChatMinimized(!isChatMinimized)}
          />
        </div>
      </div>

      {/* Mobile Chat Toggle */}
      <div className="lg:hidden fixed bottom-4 right-4">
        <button
          onClick={() => setIsChatMinimized(!isChatMinimized)}
          className="btn-primary w-12 h-12 rounded-full flex items-center justify-center shadow-lg"
        >
          <Users className="w-6 h-6" />
          {chatMessages.length > 0 && (
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 rounded-full flex items-center justify-center">
              {chatMessages.length > 9 ? '9+' : chatMessages.length}
            </span>
          )}
        </button>
      </div>
    </div>
  );
}
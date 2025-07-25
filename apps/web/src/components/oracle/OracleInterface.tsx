/**
 * 🔮 ORACLE INTERFACE - MAIN FANTASY ORACLE UI
 * 
 * This component provides the primary interface for interacting with
 * the Fantasy Oracle, including voice input, visual responses, and
 * specialist handoffs.
 */

'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, VolumeX, Sparkles, Brain, ChevronUp } from 'lucide-react';
import { useOracleSession } from '@/hooks/useOracleSession';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { OracleResponse, OracleAction } from '@/lib/services/ai/oracle-service';
import { OracleVisualizer } from './OracleVisualizer';
import { OracleChat } from './OracleChat';
import { SpecialistPanel } from './SpecialistPanel';
import { OracleSuggestions } from './OracleSuggestions';
import { ProphecyDisplay } from './ProphecyDisplay';
import { cn } from '@/lib/utils';
import { logger } from '../../lib/logging/logger';

interface OracleInterfaceProps {
  className?: string;
  sport?: string;
  contestType?: 'GPP' | 'CASH' | 'H2H';
  onLineupGenerated?: (lineup: any) => void;
  onChartRequested?: (config: any) => void;
}

export function OracleInterface({
  className,
  sport = 'NFL',
  contestType = 'GPP',
  onLineupGenerated,
  onChartRequested
}: OracleInterfaceProps) {
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [currentSpeaker, setCurrentSpeaker] = useState<string>('oracle');
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [prophecy, setProphecy] = useState<any>(null);
  
  const audioRef = useRef<HTMLAudioElement>(null);
  
  // Oracle session hook
  const {
    session,
    messages,
    sendQuery,
    isConnected,
    isLoading,
    error,
    specialists,
    summonSpecialist
  } = useOracleSession({
    sport,
    contestType,
    onResponse: handleOracleResponse
  });
  
  // Voice input hook
  const {
    startListening,
    stopListening,
    transcript,
    isProcessing,
    confidence
  } = useVoiceInput({
    onTranscript: handleVoiceTranscript,
    onWakeWord: handleWakeWord
  });
  
  // Handle Oracle response
  function handleOracleResponse(response: OracleResponse) {
    setCurrentSpeaker(response.speaker);
    
    // Play audio if available and enabled
    if (response.audioUrl && audioEnabled && audioRef.current) {
      audioRef.current.src = response.audioUrl;
      audioRef.current.play()
        .then(() => setIsSpeaking(true))
        .catch(console.error);
    }
    
    // Handle actions
    if (response.actions) {
      response.actions.forEach(handleAction);
    }
    
    // Handle visualization
    if (response.visualization) {
      if (onChartRequested) {
        onChartRequested(response.visualization);
      }
    }
    
    // Handle lineup data
    if (response.data?.lineup && onLineupGenerated) {
      onLineupGenerated(response.data.lineup);
    }
  }
  
  // Handle voice transcript
  function handleVoiceTranscript(text: string, isFinal: boolean) {
    if (isFinal && text.trim()) {
      sendQuery(text);
      setIsListening(false);
    }
  }
  
  // Handle wake word detection
  function handleWakeWord() {
    setIsListening(true);
    setIsExpanded(true);
    startListening();
  }
  
  // Handle action from Oracle
  function handleAction(action: OracleAction) {
    switch (action.type) {
      case 'add_player':
        // Handle add player action
        logger.info('Add player:', { data: action.payload });
        break;
        
      case 'view_details':
        // Handle view details action
        logger.info('View details:', { data: action.payload });
        break;
        
      case 'show_chart':
        if (onChartRequested) {
          onChartRequested(action.payload);
        }
        break;
        
      case 'build_lineup':
        // Trigger lineup build
        sendQuery(`Build ${action.payload.contestType} lineup for ${action.payload.sport}`);
        break;
        
      case 'summon_specialist':
        summonSpecialist(action.payload.specialistId);
        break;
    }
  }
  
  // Toggle listening
  const toggleListening = useCallback(() => {
    if (isListening) {
      stopListening();
      setIsListening(false);
    } else {
      startListening();
      setIsListening(true);
      setIsExpanded(true);
    }
  }, [isListening, startListening, stopListening]);
  
  // Toggle audio
  const toggleAudio = useCallback(() => {
    setAudioEnabled(!audioEnabled);
    if (audioRef.current && !audioEnabled) {
      audioRef.current.pause();
      setIsSpeaking(false);
    }
  }, [audioEnabled]);
  
  // Handle audio ended
  const handleAudioEnded = useCallback(() => {
    setIsSpeaking(false);
  }, []);
  
  // Request prophecy
  const requestProphecy = useCallback(async () => {
    try {
      const res = await fetch('/api/oracle/prophecy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sport,
          timeframe: 'tonight',
          sessionId: session?.id
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        setProphecy(data.prophecy);
      }
    } catch (error) {
      logger.error('Prophecy error:', { error: error });
    }
  }, [sport, session]);
  
  return (
    <div className={cn('relative', className)}>
      {/* Oracle Visualizer Background */}
      <div className="absolute inset-0 pointer-events-none">
        <OracleVisualizer
          isListening={isListening}
          isSpeaking={isSpeaking}
          currentSpeaker={currentSpeaker}
          confidence={confidence}
        />
      </div>
      
      {/* Main Interface */}
      <AnimatePresence mode="wait">
        {isExpanded ? (
          // Expanded View
          <motion.div
            key="expanded"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="relative z-10 bg-black/80 backdrop-blur-xl rounded-2xl border border-purple-500/20 p-6 shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-600/20 rounded-xl">
                  <Sparkles className="w-6 h-6 text-purple-400" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">Fantasy Oracle</h2>
                  <p className="text-sm text-gray-400">
                    {currentSpeaker === 'oracle' ? 'Master AI' : `Speaking with ${currentSpeaker}`}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                {/* Audio Toggle */}
                <button
                  onClick={toggleAudio}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  title={audioEnabled ? 'Mute' : 'Unmute'}
                >
                  {audioEnabled ? (
                    <Volume2 className="w-5 h-5 text-white" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-gray-400" />
                  )}
                </button>
                
                {/* Minimize */}
                <button
                  onClick={() => setIsExpanded(false)}
                  className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                >
                  <ChevronUp className="w-5 h-5 text-white rotate-180" />
                </button>
              </div>
            </div>
            
            {/* Chat Area */}
            <div className="mb-6">
              <OracleChat
                messages={messages}
                isLoading={isLoading}
                currentSpeaker={currentSpeaker}
                className="h-[400px]"
              />
            </div>
            
            {/* Specialist Panel */}
            {specialists.length > 0 && (
              <div className="mb-6">
                <SpecialistPanel
                  specialists={specialists}
                  currentSpecialist={currentSpeaker !== 'oracle' ? currentSpeaker : undefined}
                  onSummon={summonSpecialist}
                />
              </div>
            )}
            
            {/* Suggestions */}
            <div className="mb-6">
              <OracleSuggestions
                suggestions={session?.followUp || []}
                onSelect={(suggestion) => sendQuery(suggestion)}
              />
            </div>
            
            {/* Input Area */}
            <div className="flex items-center gap-3">
              <input
                type="text"
                placeholder={isListening ? "Listening..." : "Ask the Oracle..."}
                className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && e.currentTarget.value.trim()) {
                    sendQuery(e.currentTarget.value);
                    e.currentTarget.value = '';
                  }
                }}
                disabled={isListening || isLoading}
              />
              
              {/* Voice Button */}
              <button
                onClick={toggleListening}
                disabled={isLoading || isProcessing}
                className={cn(
                  "p-3 rounded-xl transition-all duration-300",
                  isListening
                    ? "bg-red-600 hover:bg-red-700 animate-pulse"
                    : "bg-purple-600 hover:bg-purple-700",
                  (isLoading || isProcessing) && "opacity-50 cursor-not-allowed"
                )}
              >
                {isListening ? (
                  <MicOff className="w-5 h-5 text-white" />
                ) : (
                  <Mic className="w-5 h-5 text-white" />
                )}
              </button>
              
              {/* Prophecy Button */}
              <button
                onClick={requestProphecy}
                className="p-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 transition-colors"
                title="Request Prophecy"
              >
                <Brain className="w-5 h-5 text-white" />
              </button>
            </div>
            
            {/* Prophecy Display */}
            {prophecy && (
              <div className="mt-6">
                <ProphecyDisplay prophecy={prophecy} />
              </div>
            )}
            
            {/* Connection Status */}
            {!isConnected && (
              <div className="mt-4 text-center text-sm text-red-400">
                Connecting to Oracle...
              </div>
            )}
            
            {error && (
              <div className="mt-4 text-center text-sm text-red-400">
                {error}
              </div>
            )}
          </motion.div>
        ) : (
          // Minimized View
          <motion.div
            key="minimized"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="relative z-10"
          >
            <button
              onClick={() => setIsExpanded(true)}
              className="group relative p-4 bg-purple-600/20 backdrop-blur-xl rounded-full border border-purple-500/30 hover:border-purple-500/50 transition-all duration-300 hover:scale-110"
            >
              {/* Glow Effect */}
              <div className="absolute inset-0 rounded-full bg-purple-600/30 blur-xl group-hover:bg-purple-600/40 transition-all" />
              
              {/* Icon */}
              <Sparkles className="w-8 h-8 text-purple-400 relative z-10" />
              
              {/* Pulse Animation */}
              {isListening && (
                <div className="absolute inset-0 rounded-full border-2 border-purple-400 animate-ping" />
              )}
              
              {/* Tooltip */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
                <div className="px-3 py-1 bg-black rounded-lg text-sm text-white whitespace-nowrap">
                  Say "Hey Fantasy" or click to open
                </div>
              </div>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Hidden Audio Element */}
      <audio
        ref={audioRef}
        onEnded={handleAudioEnded}
        className="hidden"
      />
    </div>
  );
}

/**
 * 🔮 ORACLE INTERFACE FEATURES:
 * 
 * - Voice-activated with "Hey Fantasy" wake word
 * - Real-time WebSocket communication
 * - Animated visualizer background
 * - Specialist summoning and handoffs
 * - Audio playback with 11Labs voices
 * - Prophecy requests
 * - Minimized/expanded states
 * - Suggestion chips
 * - Full chat history
 * 
 * The gateway to AI-powered fantasy wisdom!
 */
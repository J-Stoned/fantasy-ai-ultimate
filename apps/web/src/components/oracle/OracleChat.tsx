/**
 * 💬 ORACLE CHAT - CONVERSATION DISPLAY
 * 
 * This component displays the conversation history between the user
 * and the Oracle/specialists with beautiful animations.
 */

'use client';

import React, { useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, User, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { logger } from '../../lib/logging/logger';

export interface ChatMessage {
  id: string;
  speaker: 'user' | 'oracle' | string;
  text: string;
  timestamp: Date;
  confidence?: number;
  actions?: Array<{
    type: string;
    label: string;
    payload: any;
  }>;
  data?: any;
}

interface OracleChatProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  currentSpeaker?: string;
  className?: string;
}

const speakerInfo: Record<string, { name: string; emoji: string; color: string }> = {
  oracle: { name: 'Fantasy Oracle', emoji: '🔮', color: 'text-purple-400' },
  user: { name: 'You', emoji: '👤', color: 'text-blue-400' },
  'data-scientist': { name: 'Data Scientist', emoji: '🤓', color: 'text-blue-400' },
  'vegas-sharp': { name: 'Vegas Sharp', emoji: '🎰', color: 'text-red-400' },
  'contrarian': { name: 'Contrarian', emoji: '😈', color: 'text-amber-400' },
  'optimizer': { name: 'Optimizer', emoji: '🤖', color: 'text-green-400' },
  'floor-general': { name: 'Floor General', emoji: '🛡️', color: 'text-purple-400' },
  'narrative-master': { name: 'Narrative Master', emoji: '📖', color: 'text-pink-400' },
  'weather-hawk': { name: 'Weather Hawk', emoji: '🌦️', color: 'text-sky-400' },
  'chaos-agent': { name: 'Chaos Agent', emoji: '🎲', color: 'text-red-500' }
};

export function OracleChat({
  messages,
  isLoading = false,
  currentSpeaker = 'oracle',
  className
}: OracleChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  
  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);
  
  const getSpeakerInfo = (speaker: string) => {
    return speakerInfo[speaker] || {
      name: speaker,
      emoji: '🤔',
      color: 'text-gray-400'
    };
  };
  
  return (
    <div
      ref={scrollRef}
      className={cn(
        "overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent",
        className
      )}
    >
      <div className="space-y-4 p-4">
        <AnimatePresence mode="popLayout">
          {messages.map((message, index) => {
            const speaker = getSpeakerInfo(message.speaker);
            const isUser = message.speaker === 'user';
            
            return (
              <motion.div
                key={message.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className={cn(
                  "flex gap-3",
                  isUser ? "flex-row-reverse" : "flex-row"
                )}
              >
                {/* Avatar */}
                <div className={cn(
                  "flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg",
                  isUser ? "bg-blue-600/20" : "bg-white/10"
                )}>
                  {speaker.emoji}
                </div>
                
                {/* Message Content */}
                <div className={cn(
                  "flex-1 max-w-[80%]",
                  isUser ? "items-end" : "items-start"
                )}>
                  {/* Speaker Name */}
                  <div className={cn(
                    "flex items-center gap-2 mb-1",
                    isUser ? "flex-row-reverse" : "flex-row"
                  )}>
                    <span className={cn("text-sm font-medium", speaker.color)}>
                      {speaker.name}
                    </span>
                    <span className="text-xs text-gray-500">
                      {format(message.timestamp, 'HH:mm')}
                    </span>
                    {message.confidence && (
                      <span className="text-xs text-gray-500">
                        {Math.round(message.confidence * 100)}%
                      </span>
                    )}
                  </div>
                  
                  {/* Message Bubble */}
                  <div className={cn(
                    "relative rounded-2xl px-4 py-3",
                    isUser
                      ? "bg-blue-600/20 border border-blue-500/30"
                      : "bg-white/5 border border-white/10"
                  )}>
                    {/* Text */}
                    <p className="text-white whitespace-pre-wrap">
                      {message.text}
                    </p>
                    
                    {/* Actions */}
                    {message.actions && message.actions.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {message.actions.map((action, i) => (
                          <button
                            key={i}
                            className="px-3 py-1 text-sm bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                            onClick={() => {
                              logger.info('Action clicked:', { data: action });
                              // Handle action click
                            }}
                          >
                            {action.label}
                          </button>
                        ))}
                      </div>
                    )}
                    
                    {/* Data Display */}
                    {message.data && (
                      <div className="mt-3 p-3 bg-black/30 rounded-lg">
                        <pre className="text-xs text-gray-400 overflow-x-auto">
                          {JSON.stringify(message.data, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        
        {/* Loading Indicator */}
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex gap-3"
          >
            <div className="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center">
              {getSpeakerInfo(currentSpeaker).emoji}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-gray-400 mb-1">
                {getSpeakerInfo(currentSpeaker).name} is thinking...
              </div>
              <div className="bg-white/5 rounded-2xl px-4 py-3 inline-flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                <div className="flex gap-1">
                  <motion.div
                    className="w-2 h-2 bg-gray-400 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-gray-400 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}
                  />
                  <motion.div
                    className="w-2 h-2 bg-gray-400 rounded-full"
                    animate={{ opacity: [0.3, 1, 0.3] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

/**
 * 💬 ORACLE CHAT FEATURES:
 * 
 * - Beautiful message bubbles with speaker info
 * - Smooth animations on message entry
 * - Loading indicator with typing dots
 * - Action buttons for interactive responses
 * - Data display for complex responses
 * - Auto-scroll to latest message
 * - Speaker-specific colors and emojis
 * - Confidence indicators
 * 
 * A visually stunning chat experience!
 */
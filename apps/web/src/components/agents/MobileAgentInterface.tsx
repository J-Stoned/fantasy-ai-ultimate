/**
 * 📱 MOBILE AGENT INTERFACE - SWIPEABLE AI AGENTS
 * 
 * This component provides a mobile-optimized interface for interacting
 * with all 9 AI agents using swipe gestures and touch interactions.
 */

'use client';

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform } from 'framer-motion';
import { 
  Mic, MicOff, Send, X, ChevronUp, ChevronDown,
  Sparkles, MessageCircle, Users, Volume2, VolumeX
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useVoiceInput } from '@/hooks/useVoiceInput';

interface Agent {
  id: string;
  name: string;
  emoji: string;
  personality: string;
  strategy: string;
  specialties: string[];
  color: string;
  gradient: string;
}

interface MobileAgentInterfaceProps {
  agents: Agent[];
  onQuerySubmit?: (query: string, agentId: string) => void;
  className?: string;
}

export function MobileAgentInterface({ 
  agents, 
  onQuerySubmit,
  className 
}: MobileAgentInterfaceProps) {
  const [selectedAgent, setSelectedAgent] = useState<Agent>(agents[0]);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Array<{
    id: string;
    agent: Agent;
    text: string;
    type: 'user' | 'agent';
    timestamp: Date;
  }>>([]);
  
  const inputRef = useRef<HTMLInputElement>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Voice input
  const {
    startListening,
    stopListening,
    transcript,
    isProcessing
  } = useVoiceInput({
    onTranscript: (text, isFinal) => {
      if (isFinal) {
        setQuery(text);
        handleSubmit(text);
        setIsListening(false);
      }
    }
  });
  
  // Swipe gesture setup
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-150, 0, 150], [-15, 0, 15]);
  const opacity = useTransform(x, [-150, 0, 150], [0.5, 1, 0.5]);
  
  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  const handleSubmit = (text: string = query) => {
    if (!text.trim()) return;
    
    // Add user message
    const userMessage = {
      id: Date.now().toString(),
      agent: selectedAgent,
      text,
      type: 'user' as const,
      timestamp: new Date()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setQuery('');
    
    // Simulate agent response
    setTimeout(() => {
      const agentMessage = {
        id: (Date.now() + 1).toString(),
        agent: selectedAgent,
        text: `${selectedAgent.emoji} ${selectedAgent.name}: I'll analyze "${text}" using my ${selectedAgent.specialties[0]} expertise...`,
        type: 'agent' as const,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, agentMessage]);
    }, 1000);
    
    // Call parent handler
    onQuerySubmit?.(text, selectedAgent.id);
  };
  
  const toggleListening = () => {
    if (isListening) {
      stopListening();
      setIsListening(false);
    } else {
      startListening();
      setIsListening(true);
    }
  };
  
  const handleSwipe = (direction: 'left' | 'right') => {
    const currentIndex = agents.findIndex(a => a.id === selectedAgent.id);
    let newIndex = currentIndex;
    
    if (direction === 'left') {
      newIndex = (currentIndex + 1) % agents.length;
    } else {
      newIndex = currentIndex === 0 ? agents.length - 1 : currentIndex - 1;
    }
    
    setSelectedAgent(agents[newIndex]);
  };
  
  return (
    <div className={cn(
      "fixed bottom-0 left-0 right-0 z-50",
      className
    )}>
      <AnimatePresence mode="wait">
        {isExpanded ? (
          // Expanded Chat View
          <motion.div
            key="expanded"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 25 }}
            className="h-[80vh] bg-black/95 backdrop-blur-xl border-t border-white/10"
          >
            {/* Header */}
            <div className="p-4 border-b border-white/10">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{selectedAgent.emoji}</span>
                  <div>
                    <h3 className={cn("font-semibold", selectedAgent.color)}>
                      {selectedAgent.name}
                    </h3>
                    <p className="text-xs text-gray-400">
                      {selectedAgent.specialties.join(' • ')}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setAudioEnabled(!audioEnabled)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    {audioEnabled ? (
                      <Volume2 className="w-4 h-4 text-white" />
                    ) : (
                      <VolumeX className="w-4 h-4 text-gray-400" />
                    )}
                  </button>
                  
                  <button
                    onClick={() => setIsExpanded(false)}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                  >
                    <ChevronDown className="w-5 h-5 text-white" />
                  </button>
                </div>
              </div>
            </div>
            
            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {messages.length === 0 ? (
                <div className="text-center py-12">
                  <MessageCircle className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 mb-2">No messages yet</p>
                  <p className="text-sm text-gray-500">
                    Ask {selectedAgent.name} for {selectedAgent.specialties[0]} advice
                  </p>
                </div>
              ) : (
                messages.map((message) => (
                  <motion.div
                    key={message.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className={cn(
                      "flex",
                      message.type === 'user' ? "justify-end" : "justify-start"
                    )}
                  >
                    <div className={cn(
                      "max-w-[80%] rounded-2xl p-3",
                      message.type === 'user' 
                        ? "bg-purple-600 text-white" 
                        : "bg-white/10 text-white"
                    )}>
                      <p className="text-sm">{message.text}</p>
                      <p className="text-xs opacity-60 mt-1">
                        {message.timestamp.toLocaleTimeString()}
                      </p>
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={messagesEndRef} />
            </div>
            
            {/* Input */}
            <div className="p-4 border-t border-white/10">
              <div className="flex items-center gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSubmit();
                  }}
                  placeholder={isListening ? "Listening..." : "Ask a question..."}
                  className="flex-1 px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder:text-gray-500 focus:outline-none focus:border-purple-500/50"
                  disabled={isListening}
                />
                
                <button
                  onClick={toggleListening}
                  disabled={isProcessing}
                  className={cn(
                    "p-3 rounded-xl transition-all",
                    isListening 
                      ? "bg-red-600 hover:bg-red-700 animate-pulse"
                      : "bg-white/10 hover:bg-white/20"
                  )}
                >
                  {isListening ? (
                    <MicOff className="w-5 h-5 text-white" />
                  ) : (
                    <Mic className="w-5 h-5 text-white" />
                  )}
                </button>
                
                <button
                  onClick={() => handleSubmit()}
                  disabled={!query.trim()}
                  className={cn(
                    "p-3 rounded-xl transition-all",
                    query.trim() 
                      ? "bg-purple-600 hover:bg-purple-700"
                      : "bg-white/5 opacity-50 cursor-not-allowed"
                  )}
                >
                  <Send className="w-5 h-5 text-white" />
                </button>
              </div>
            </div>
          </motion.div>
        ) : (
          // Collapsed Agent Selector
          <motion.div
            key="collapsed"
            initial={{ y: 100 }}
            animate={{ y: 0 }}
            exit={{ y: 100 }}
            className="bg-black/90 backdrop-blur-xl border-t border-white/10"
          >
            {/* Agent Carousel */}
            <div className="p-4">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-medium text-white">AI Agents</h3>
                <Badge className="bg-purple-600/20 text-purple-400 border-purple-500/30">
                  {agents.length} Available
                </Badge>
              </div>
              
              {/* Swipeable Agent Card */}
              <div className="relative h-32 mb-3">
                <motion.div
                  drag="x"
                  dragConstraints={{ left: 0, right: 0 }}
                  dragElastic={0.2}
                  style={{ x, rotate, opacity }}
                  onDragEnd={(_, info) => {
                    if (info.offset.x > 100) {
                      handleSwipe('right');
                    } else if (info.offset.x < -100) {
                      handleSwipe('left');
                    }
                    x.set(0);
                  }}
                  className="absolute inset-0"
                >
                  <Card className={cn(
                    "h-full bg-gradient-to-br border-white/20 cursor-grab active:cursor-grabbing",
                    selectedAgent.gradient
                  )}>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        <span className="text-4xl">{selectedAgent.emoji}</span>
                        <div className="flex-1">
                          <h4 className="font-semibold text-white">
                            {selectedAgent.name}
                          </h4>
                          <p className="text-xs text-gray-200 mt-1">
                            {selectedAgent.personality}
                          </p>
                          <div className="flex flex-wrap gap-1 mt-2">
                            {selectedAgent.specialties.slice(0, 2).map((spec, i) => (
                              <span
                                key={i}
                                className="px-2 py-0.5 text-xs bg-white/20 rounded-full"
                              >
                                {spec}
                              </span>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
                
                {/* Swipe Hints */}
                <div className="absolute inset-y-0 left-0 flex items-center pl-2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-white/20 -rotate-90" />
                </div>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <ChevronDown className="w-4 h-4 text-white/20 rotate-90" />
                </div>
              </div>
              
              {/* Agent Dots */}
              <div className="flex justify-center gap-1">
                {agents.map((agent, index) => (
                  <button
                    key={agent.id}
                    onClick={() => setSelectedAgent(agent)}
                    className={cn(
                      "w-1.5 h-1.5 rounded-full transition-all",
                      selectedAgent.id === agent.id 
                        ? "bg-purple-400 w-4" 
                        : "bg-white/20"
                    )}
                  />
                ))}
              </div>
              
              {/* Expand Button */}
              <button
                onClick={() => setIsExpanded(true)}
                className="w-full mt-3 py-3 bg-gradient-to-r from-purple-600 to-blue-600 rounded-xl font-medium text-white hover:from-purple-700 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
              >
                <MessageCircle className="w-4 h-4" />
                Chat with {selectedAgent.name}
                <ChevronUp className="w-4 h-4" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * 📱 MOBILE AGENT INTERFACE FEATURES:
 * 
 * - Swipeable agent selection
 * - Expandable chat interface
 * - Voice input support
 * - Real-time messaging
 * - Touch-optimized interactions
 * - Beautiful animations
 * - Agent personality display
 * - Audio toggle
 * - Message history
 * - One-handed operation
 * 
 * Swipe to meet your AI team!
 */
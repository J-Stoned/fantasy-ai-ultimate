'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Mic, MicOff, Volume2, X, Loader2 } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { 
  ElevenLabsMCPClient, 
  VoiceInputProcessor, 
  MLResponseGenerator,
  VoiceQuery,
  VoiceResponse 
} from '@fantasy-ai/shared';
import { useUserStore } from '@fantasy-ai/shared';
import { logger } from '../../lib/logging/logger';

interface VoiceAssistantProps {
  className?: string;
}

export function VoiceAssistant({ className }: VoiceAssistantProps) {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState('');
  const [currentResponse, setCurrentResponse] = useState<VoiceResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [wakeWordActive, setWakeWordActive] = useState(false);
  
  const audioContextRef = useRef<AudioContext>();
  const mediaStreamRef = useRef<MediaStream>();
  const elevenLabsRef = useRef<ElevenLabsMCPClient>();
  const voiceProcessorRef = useRef<VoiceInputProcessor>();
  const responseGeneratorRef = useRef<MLResponseGenerator>();
  const recognitionRef = useRef<any>();
  
  const user = useUserStore(state => state.user);
  const canUseVoice = user?.subscription.tier !== 'free';
  
  useEffect(() => {
    if (!canUseVoice) return;
    
    // Initialize services
    elevenLabsRef.current = new ElevenLabsMCPClient({
      apiKey: process.env.NEXT_PUBLIC_ELEVENLABS_API_KEY!,
      voiceId: process.env.NEXT_PUBLIC_ELEVENLABS_VOICE_ID || 'pNInz6obpgDQGcFmaJgB', // Adam voice
      model: 'eleven_turbo_v2',
      streamingLatency: 1,
      voiceSettings: {
        stability: 0.8,
        similarity_boost: 0.9,
        style: 0.5,
        use_speaker_boost: true
      }
    });
    
    voiceProcessorRef.current = new VoiceInputProcessor();
    // Note: responseGeneratorRef would need ML and Player services injected
    
    // Connect to 11Labs
    elevenLabsRef.current.connect().catch(console.error);
    
    // Set up audio events
    elevenLabsRef.current.on('audioChunk', () => {
      setIsSpeaking(true);
    });
    
    elevenLabsRef.current.on('complete', () => {
      setIsSpeaking(false);
    });
    
    elevenLabsRef.current.on('error', (err) => {
      logger.error('11Labs error:', { error: err });
      setError('Voice synthesis error');
      setIsSpeaking(false);
    });
    
    // Initialize wake word detection if enabled
    if (wakeWordActive) {
      initializeWakeWordDetection();
    }
    
    return () => {
      elevenLabsRef.current?.disconnect();
      stopListening();
    };
  }, [canUseVoice, wakeWordActive]);
  
  const initializeWakeWordDetection = useCallback(() => {
    // This would use a wake word detection library
    logger.info('Wake word detection initialized');
  }, []);
  
  const startListening = useCallback(async () => {
    if (!canUseVoice) {
      setError('Voice features are available for paid subscribers');
      return;
    }
    
    try {
      // Get microphone permission
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        } 
      });
      
      mediaStreamRef.current = stream;
      
      // Initialize Web Speech API
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SpeechRecognition) {
        throw new Error('Speech recognition not supported');
      }
      
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = 'en-US';
      
      recognition.onstart = () => {
        setIsListening(true);
        setError(null);
      };
      
      recognition.onresult = (event: any) => {
        const current = event.resultIndex;
        const transcript = event.results[current][0].transcript;
        
        setCurrentTranscript(transcript);
        
        // If final result, process it
        if (event.results[current].isFinal) {
          processVoiceInput(transcript);
        }
      };
      
      recognition.onerror = (event: any) => {
        logger.error('Speech recognition error:', { error: event.error });
        setError(`Recognition error: ${event.error}`);
        stopListening();
      };
      
      recognition.onend = () => {
        setIsListening(false);
      };
      
      recognitionRef.current = recognition;
      recognition.start();
      
    } catch (err) {
      logger.error('Error starting voice input:', { error: err });
      setError('Failed to access microphone');
    }
  }, [canUseVoice]);
  
  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach(track => track.stop());
      mediaStreamRef.current = undefined;
    }
    
    setIsListening(false);
    setCurrentTranscript('');
  }, []);
  
  const processVoiceInput = useCallback(async (transcript: string) => {
    if (!voiceProcessorRef.current || !responseGeneratorRef.current) return;
    
    setIsProcessing(true);
    
    try {
      // Process the voice query
      const query = await voiceProcessorRef.current.processText(transcript);
      
      // Generate ML-powered response
      const response = await responseGeneratorRef.current.generateResponse(query, {
        tone: 'analytical',
        length: 'normal',
        includeVisuals: true,
        personalization: {
          userName: user?.name,
          fantasyExperience: 'intermediate',
          preferredInsights: ['projections', 'injury updates', 'trade analysis']
        }
      });
      
      setCurrentResponse(response);
      
      // Synthesize voice response
      if (elevenLabsRef.current) {
        await elevenLabsRef.current.streamSSML(response.ssml);
      }
      
    } catch (err) {
      logger.error('Error processing voice input:', { error: err });
      setError('Failed to process your request');
    } finally {
      setIsProcessing(false);
    }
  }, [user]);
  
  const handleSuggestionClick = useCallback((suggestion: string) => {
    setCurrentTranscript(suggestion);
    processVoiceInput(suggestion);
  }, [processVoiceInput]);
  
  if (!canUseVoice) {
    return null;
  }
  
  return (
    <>
      {/* Floating Voice Button */}
      <motion.div
        className={cn(
          "fixed bottom-6 right-6 z-50",
          className
        )}
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        exit={{ scale: 0 }}
      >
        <motion.button
          className={cn(
            "relative w-16 h-16 rounded-full shadow-lg transition-all",
            isListening 
              ? "bg-red-500 hover:bg-red-600" 
              : "bg-blue-600 hover:bg-blue-700"
          )}
          onClick={isListening ? stopListening : startListening}
          whileTap={{ scale: 0.95 }}
          disabled={isProcessing || isSpeaking}
        >
          {/* Animated rings for visual feedback */}
          <AnimatePresence>
            {isListening && (
              <>
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-full border-2 border-white"
                    initial={{ scale: 1, opacity: 0.8 }}
                    animate={{
                      scale: [1, 2, 2.5],
                      opacity: [0.8, 0.4, 0]
                    }}
                    transition={{
                      duration: 2,
                      repeat: Infinity,
                      delay: i * 0.4
                    }}
                  />
                ))}
              </>
            )}
          </AnimatePresence>
          
          {/* Icon */}
          <div className="relative z-10 flex items-center justify-center h-full">
            {isProcessing ? (
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            ) : isSpeaking ? (
              <Volume2 className="w-8 h-8 text-white" />
            ) : isListening ? (
              <Mic className="w-8 h-8 text-white" />
            ) : (
              <MicOff className="w-8 h-8 text-white" />
            )}
          </div>
          
          {/* Wake word indicator */}
          {wakeWordActive && (
            <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          )}
        </motion.button>
        
        {/* Wake word toggle */}
        <Button
          size="sm"
          variant="outline"
          className="absolute -top-12 right-0 text-xs"
          onClick={() => setWakeWordActive(!wakeWordActive)}
        >
          {wakeWordActive ? 'Hey Fantasy: ON' : 'Hey Fantasy: OFF'}
        </Button>
      </motion.div>
      
      {/* Voice Response Card */}
      <AnimatePresence>
        {(currentTranscript || currentResponse || error) && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 50, scale: 0.9 }}
            className="fixed bottom-24 right-6 z-40 w-96 max-w-[calc(100vw-3rem)]"
          >
            <Card className="shadow-2xl">
              <div className="p-4">
                {/* Header */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "w-2 h-2 rounded-full",
                      isListening ? "bg-red-500 animate-pulse" :
                      isProcessing ? "bg-yellow-500 animate-pulse" :
                      isSpeaking ? "bg-green-500 animate-pulse" :
                      "bg-gray-400"
                    )} />
                    <span className="text-sm font-medium">
                      {isListening ? 'Listening...' :
                       isProcessing ? 'Thinking...' :
                       isSpeaking ? 'Speaking...' :
                       'Ready'}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setCurrentTranscript('');
                      setCurrentResponse(null);
                      setError(null);
                    }}
                  >
                    <X className="w-4 h-4" />
                  </Button>
                </div>
                
                {/* Transcript */}
                {currentTranscript && (
                  <div className="mb-3">
                    <p className="text-sm text-muted-foreground">You said:</p>
                    <p className="font-medium">{currentTranscript}</p>
                  </div>
                )}
                
                {/* Error */}
                {error && (
                  <div className="mb-3 p-3 bg-red-50 dark:bg-red-950 text-red-600 dark:text-red-400 rounded-md text-sm">
                    {error}
                  </div>
                )}
                
                {/* Response */}
                {currentResponse && (
                  <div className="space-y-3">
                    <div>
                      <p className="text-sm text-muted-foreground mb-1">Response:</p>
                      <p className="text-sm leading-relaxed">{currentResponse.text}</p>
                    </div>
                    
                    {/* Confidence */}
                    {currentResponse.confidence > 0 && (
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {(currentResponse.confidence * 100).toFixed(0)}% confident
                        </Badge>
                      </div>
                    )}
                    
                    {/* Visual Data Preview */}
                    {currentResponse.visualData && (
                      <div className="p-3 bg-gray-50 dark:bg-gray-900 rounded-md">
                        <p className="text-xs text-muted-foreground mb-1">Visual data available</p>
                        <Button size="sm" variant="outline" className="text-xs">
                          View Charts
                        </Button>
                      </div>
                    )}
                    
                    {/* Suggestions */}
                    {currentResponse.suggestions && currentResponse.suggestions.length > 0 && (
                      <div>
                        <p className="text-xs text-muted-foreground mb-2">You can also ask:</p>
                        <div className="flex flex-wrap gap-2">
                          {currentResponse.suggestions.slice(0, 3).map((suggestion, i) => (
                            <Button
                              key={i}
                              size="sm"
                              variant="outline"
                              className="text-xs"
                              onClick={() => handleSuggestionClick(suggestion)}
                            >
                              {suggestion}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
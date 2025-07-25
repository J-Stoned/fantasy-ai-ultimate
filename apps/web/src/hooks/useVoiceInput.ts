/**
 * 🎤 VOICE INPUT HOOK - SPEECH RECOGNITION
 * 
 * This hook provides voice input capabilities with wake word
 * detection and real-time speech-to-text conversion.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { logger } from '../lib/logging/logger';

interface UseVoiceInputOptions {
  onTranscript?: (text: string, isFinal: boolean) => void;
  onWakeWord?: () => void;
  onError?: (error: string) => void;
  wakeWords?: string[];
  continuous?: boolean;
  interimResults?: boolean;
}

interface UseVoiceInputReturn {
  startListening: () => void;
  stopListening: () => void;
  transcript: string;
  interimTranscript: string;
  isListening: boolean;
  isProcessing: boolean;
  confidence: number;
  error: string | null;
  isSupported: boolean;
}

// Speech recognition types
interface SpeechRecognitionEvent extends Event {
  results: SpeechRecognitionResultList;
  resultIndex: number;
}

interface SpeechRecognitionResultList {
  length: number;
  item(index: number): SpeechRecognitionResult;
  [index: number]: SpeechRecognitionResult;
}

interface SpeechRecognitionResult {
  length: number;
  item(index: number): SpeechRecognitionAlternative;
  [index: number]: SpeechRecognitionAlternative;
  isFinal: boolean;
}

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}

interface SpeechRecognitionErrorEvent extends Event {
  error: string;
  message: string;
}

// Extend window for webkit prefix
declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export function useVoiceInput({
  onTranscript,
  onWakeWord,
  onError,
  wakeWords = ['hey fantasy', 'okay fantasy', 'fantasy oracle'],
  continuous = true,
  interimResults = true
}: UseVoiceInputOptions = {}): UseVoiceInputReturn {
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [confidence, setConfidence] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(false);
  
  const recognitionRef = useRef<any>(null);
  const restartTimeoutRef = useRef<NodeJS.Timeout>();
  
  // Check if speech recognition is supported
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    setIsSupported(!!SpeechRecognition);
    
    if (!SpeechRecognition) {
      setError('Speech recognition not supported in this browser');
      if (onError) onError('Speech recognition not supported');
    }
  }, [onError]);
  
  // Initialize speech recognition
  const initializeRecognition = useCallback(() => {
    if (!isSupported) return null;
    
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = continuous;
    recognition.interimResults = interimResults;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 3;
    
    // Handle results
    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let finalTranscript = '';
      let interimText = '';
      let maxConfidence = 0;
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alternative = result[0];
        const text = alternative.transcript;
        
        if (result.isFinal) {
          finalTranscript += text + ' ';
          maxConfidence = Math.max(maxConfidence, alternative.confidence);
          
          // Check for wake words
          const lowerText = text.toLowerCase();
          const hasWakeWord = wakeWords.some(word => lowerText.includes(word));
          
          if (hasWakeWord && onWakeWord) {
            onWakeWord();
          }
        } else {
          interimText += text;
        }
      }
      
      if (finalTranscript) {
        setTranscript(prev => prev + finalTranscript);
        setConfidence(maxConfidence);
        
        if (onTranscript) {
          onTranscript(finalTranscript.trim(), true);
        }
      }
      
      if (interimText) {
        setInterimTranscript(interimText);
        
        if (onTranscript) {
          onTranscript(interimText, false);
        }
      }
    };
    
    // Handle errors
    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      logger.error('Speech recognition error:', { error: event.error });
      
      let errorMessage = 'Speech recognition error';
      
      switch (event.error) {
        case 'network':
          errorMessage = 'Network error. Please check your connection.';
          break;
        case 'not-allowed':
          errorMessage = 'Microphone access denied. Please allow microphone access.';
          break;
        case 'no-speech':
          errorMessage = 'No speech detected. Please try again.';
          break;
        case 'aborted':
          errorMessage = 'Speech recognition aborted.';
          break;
        default:
          errorMessage = `Speech recognition error: ${event.error}`;
      }
      
      setError(errorMessage);
      if (onError) onError(errorMessage);
      
      // Auto-restart for certain errors
      if (event.error === 'network' || event.error === 'no-speech') {
        restartTimeoutRef.current = setTimeout(() => {
          if (isListening) {
            recognition.start();
          }
        }, 1000);
      }
    };
    
    // Handle start
    recognition.onstart = () => {
      logger.info('🎤 Speech recognition started');
      setIsProcessing(false);
      setError(null);
    };
    
    // Handle end
    recognition.onend = () => {
      logger.info('🎤 Speech recognition ended');
      setIsProcessing(false);
      
      // Restart if still listening (for continuous mode)
      if (continuous && isListening) {
        restartTimeoutRef.current = setTimeout(() => {
          if (isListening && recognitionRef.current) {
            try {
              recognitionRef.current.start();
            } catch (err) {
              logger.error('Failed to restart recognition:', { error: err });
            }
          }
        }, 100);
      }
    };
    
    return recognition;
  }, [isSupported, continuous, interimResults, wakeWords, isListening, onTranscript, onWakeWord, onError]);
  
  // Start listening
  const startListening = useCallback(() => {
    if (!isSupported || isListening) return;
    
    setIsListening(true);
    setIsProcessing(true);
    setTranscript('');
    setInterimTranscript('');
    setError(null);
    
    try {
      if (!recognitionRef.current) {
        recognitionRef.current = initializeRecognition();
      }
      
      if (recognitionRef.current) {
        recognitionRef.current.start();
      }
    } catch (err) {
      logger.error('Failed to start recognition:', { error: err });
      setError('Failed to start speech recognition');
      setIsListening(false);
      setIsProcessing(false);
      
      if (onError) onError('Failed to start speech recognition');
    }
  }, [isSupported, isListening, initializeRecognition, onError]);
  
  // Stop listening
  const stopListening = useCallback(() => {
    setIsListening(false);
    
    if (recognitionRef.current) {
      try {
        recognitionRef.current.stop();
      } catch (err) {
        logger.error('Failed to stop recognition:', { error: err });
      }
    }
    
    if (restartTimeoutRef.current) {
      clearTimeout(restartTimeoutRef.current);
    }
  }, []);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try {
          recognitionRef.current.stop();
        } catch (err) {
          // Ignore errors on cleanup
        }
      }
      
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
    };
  }, []);
  
  return {
    startListening,
    stopListening,
    transcript,
    interimTranscript,
    isListening,
    isProcessing,
    confidence,
    error,
    isSupported
  };
}

/**
 * 🎤 VOICE INPUT HOOK FEATURES:
 * 
 * - Web Speech API integration
 * - Wake word detection
 * - Real-time transcription
 * - Interim results support
 * - Confidence scoring
 * - Auto-restart on errors
 * - Browser compatibility
 * - Error handling
 * 
 * Voice-first interaction with the Oracle!
 */
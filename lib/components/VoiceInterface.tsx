'use client';

import React, { useState, useEffect, useRef } from 'react';
import { WebSpeechService } from '../voice/web-speech-service';
import { useAuth } from '../hooks/useAuth';

interface VoiceInterfaceProps {
  fantasyTeamId?: string;
  leagueId?: string;
}

export function VoiceInterface({ fantasyTeamId, leagueId }: VoiceInterfaceProps) {
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState('');
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [lastCommandId, setLastCommandId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  
  const voiceServiceRef = useRef<WebSpeechService | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Initialize voice service
    voiceServiceRef.current = new WebSpeechService();
    
    // Set up event listeners
    voiceServiceRef.current.on('transcript', ({ transcript, isFinal }) => {
      if (!isFinal) {
        setTranscript(transcript);
      }
    });
    
    voiceServiceRef.current.on('command', async (command) => {
      setTranscript(command);
      await handleVoiceCommand(command);
    });
    
    voiceServiceRef.current.on('error', (error) => {
      console.error('Voice error:', error);
      setResponse('Sorry, there was an error with voice recognition.');
    });
    
    voiceServiceRef.current.on('wakeword', () => {
      console.log('🎙️ Wake word detected!');
    });

    return () => {
      if (voiceServiceRef.current) {
        voiceServiceRef.current.stopListening();
      }
    };
  }, []);

  const startListening = async () => {
    if (!voiceServiceRef.current) return;
    
    try {
      setIsListening(true);
      setTranscript('');
      setResponse('');
      
      await voiceServiceRef.current.startListening();
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (isListening) {
          stopListening();
        }
      }, 10000);
      
    } catch (error) {
      console.error('Failed to start listening:', error);
      setIsListening(false);
      setResponse('Please allow microphone access to use voice commands.');
    }
  };

  const stopListening = () => {
    if (voiceServiceRef.current) {
      voiceServiceRef.current.stopListening();
    }
    setIsListening(false);
  };
  
  const handleVoiceCommand = async (text: string) => {
    if (!voiceServiceRef.current) return;

    setIsProcessing(true);
    
    try {
      const result = await voiceServiceRef.current.processCommand(
        text,
        {
          userId: user?.id,
          fantasyTeamId,
          leagueId,
          week: getCurrentWeek()
        }
      );

      setResponse(result.response);
      setLastCommandId(`cmd_${Date.now()}`);
      setShowFeedback(true);
      
      // Audio is handled by Web Speech API automatically
      
    } catch (error) {
      console.error('Voice command error:', error);
      setResponse('Sorry, I had trouble processing that command.');
    } finally {
      setIsProcessing(false);
    }
  };
  
  const getCurrentWeek = () => {
    const seasonStart = new Date('2024-09-05');
    const now = new Date();
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(1, weeksSinceStart + 1), 18);
  };


  const toggleWakeWord = () => {
    if (!voiceServiceRef.current) return;
    
    const newState = !wakeWordEnabled;
    setWakeWordEnabled(newState);
    voiceServiceRef.current.toggleWakeWordDetection(newState);
  };

  const handleTextInput = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const input = form.querySelector('input') as HTMLInputElement;
    
    if (input.value.trim()) {
      setTranscript(input.value);
      handleVoiceCommand(input.value);
      input.value = '';
    }
  };

  const provideFeedback = async (feedback: 'positive' | 'negative') => {
    if (!lastCommandId) return;
    
    setShowFeedback(false);
    
    try {
      const response = await fetch('/api/voice/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          commandId: lastCommandId,
          feedback,
          sessionId: `session_${Date.now()}`,
          userId: user?.id
        })
      });
      
      const data = await response.json();
      console.log('Feedback sent:', data.message);
    } catch (error) {
      console.error('Failed to send feedback:', error);
    }
  };

  return (
    <div className="voice-interface bg-white dark:bg-gray-800 rounded-lg shadow-lg p-6 max-w-2xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold flex items-center gap-2">
          <span className="text-3xl">🎤</span>
          Hey Fantasy Voice Assistant
        </h2>
        
        <button
          onClick={toggleWakeWord}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            wakeWordEnabled
              ? 'bg-green-500 text-white hover:bg-green-600'
              : 'bg-gray-200 dark:bg-gray-700 hover:bg-gray-300'
          }`}
        >
          {wakeWordEnabled ? '👂 Wake Word ON' : '💤 Wake Word OFF'}
        </button>
      </div>

      {/* Voice Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={isListening ? stopListening : startListening}
          disabled={isProcessing}
          className={`relative w-32 h-32 rounded-full transition-all transform hover:scale-105 ${
            isListening
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : isProcessing
              ? 'bg-gray-400 cursor-not-allowed'
              : 'bg-blue-500 hover:bg-blue-600'
          }`}
        >
          <div className="absolute inset-0 flex items-center justify-center">
            {isListening ? (
              <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8 7a1 1 0 00-1 1v4a1 1 0 001 1h4a1 1 0 001-1V8a1 1 0 00-1-1H8z" clipRule="evenodd" />
              </svg>
            ) : (
              <svg className="w-16 h-16 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M7 4a3 3 0 016 0v4a3 3 0 11-6 0V4zm4 10.93A7.001 7.001 0 0017 8a1 1 0 10-2 0A5 5 0 015 8a1 1 0 00-2 0 7.001 7.001 0 006 6.93V17H6a1 1 0 100 2h8a1 1 0 100-2h-3v-2.07z" clipRule="evenodd" />
              </svg>
            )}
          </div>
          
          {/* Status text */}
          <div className="absolute -bottom-8 left-1/2 transform -translate-x-1/2 text-sm font-medium">
            {isListening ? 'Listening...' : isProcessing ? 'Processing...' : 'Tap to speak'}
          </div>
        </button>
      </div>

      {/* Text Input Alternative */}
      <form onSubmit={handleTextInput} className="mb-6">
        <div className="flex gap-2">
          <input
            type="text"
            placeholder="Or type your question here..."
            className="flex-1 px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="px-6 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Ask
          </button>
        </div>
      </form>

      {/* Transcript */}
      {transcript && (
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
          <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-1">
            You asked:
          </h3>
          <p className="text-gray-800 dark:text-gray-200">{transcript}</p>
        </div>
      )}

      {/* Response */}
      {response && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400 mb-1">
            Fantasy Assistant:
          </h3>
          <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap">
            {response}
          </div>
          
          {/* Feedback buttons */}
          {showFeedback && lastCommandId && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">Was this helpful?</span>
              <button
                onClick={() => provideFeedback('positive')}
                className="p-2 rounded-lg bg-green-100 dark:bg-green-900/20 hover:bg-green-200 dark:hover:bg-green-900/30 transition-colors"
                title="Yes, this was helpful"
              >
                👍
              </button>
              <button
                onClick={() => provideFeedback('negative')}
                className="p-2 rounded-lg bg-red-100 dark:bg-red-900/20 hover:bg-red-200 dark:hover:bg-red-900/30 transition-colors"
                title="No, this wasn't helpful"
              >
                👎
              </button>
            </div>
          )}
        </div>
      )}

      {/* Audio Player (hidden) */}
      <audio ref={audioRef} className="hidden" />

      {/* Examples */}
      <div className="mt-8 pt-6 border-t border-gray-200 dark:border-gray-700">
        <h3 className="text-sm font-semibold text-gray-600 dark:text-gray-400 mb-3">
          Try asking:
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {[
            "Hey Fantasy, show me sleeper picks",
            "Hey Fantasy, daily fantasy lineup",
            "Hey Fantasy, give me hot takes", 
            "Hey Fantasy, pattern analysis",
            "Hey Fantasy, value plays this week",
            "Hey Fantasy, DFS stacking advice",
            "Who should I start this week?",
            "Show me the best waiver wire RBs",
          ].map((example, index) => (
            <button
              key={index}
              onClick={() => {
                setTranscript(example);
                handleVoiceCommand(example);
              }}
              className="text-left px-3 py-2 text-sm bg-gray-100 dark:bg-gray-700 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
            >
              "{example}"
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
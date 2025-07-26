'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth } from '../lib/hooks/useAuth';
import RecordRTC from 'recordrtc';
import { logger } from '../lib/logging/logger';

interface VoiceProcessingResponse {
  success: boolean;
  commandId: string;
  transcript: string;
  intent: string;
  confidence: number;
  response: {
    text: string;
    audioUrl?: string;
    visualData?: any;
    actions?: any[];
  };
  suggestions: string[];
  processingTime: number;
}

interface VoiceInterfaceProps {
  fantasyTeamId?: string;
  leagueId?: string;
  onCommandProcessed?: (response: VoiceProcessingResponse) => void;
}

export function VoiceInterface({ fantasyTeamId, leagueId, onCommandProcessed }: VoiceInterfaceProps) {
  const { user } = useAuth();
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [response, setResponse] = useState<VoiceProcessingResponse | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [wakeWordEnabled, setWakeWordEnabled] = useState(false);
  const [lastCommandId, setLastCommandId] = useState<string | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  
  const recorderRef = useRef<RecordRTC | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Get current NFL week for context
  const getCurrentWeek = (): number => {
    const seasonStart = new Date('2024-09-05');
    const now = new Date();
    const weeksSinceStart = Math.floor((now.getTime() - seasonStart.getTime()) / (7 * 24 * 60 * 60 * 1000));
    return Math.min(Math.max(1, weeksSinceStart + 1), 18);
  };

  useEffect(() => {
    return () => {
      if (recorderRef.current) {
        recorderRef.current.stopRecording();
      }
    };
  }, []);

  const startListening = async () => {
    try {
      setIsListening(true);
      setTranscript('');
      setResponse('');

      // Get microphone access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      
      // Create recorder
      recorderRef.current = new RecordRTC(stream, {
        type: 'audio',
        mimeType: 'audio/webm',
        recorderType: RecordRTC.StereoAudioRecorder,
        numberOfAudioChannels: 1,
        desiredSampRate: 16000
      });
      
      recorderRef.current.startRecording();
      
      // Auto-stop after 10 seconds
      setTimeout(() => {
        if (isListening) {
          stopListening();
        }
      }, 10000);
      
    } catch (error) {
      logger.error('Failed to start listening:', { error: error });
      setIsListening(false);
    }
  };

  const stopListening = async () => {
    if (!recorderRef.current) {
      setIsListening(false);
      return;
    }
    
    recorderRef.current.stopRecording(async () => {
      const blob = recorderRef.current!.getBlob();
      
      // Stop all tracks
      recorderRef.current!.stream.getTracks().forEach(track => track.stop());
      
      // Send to API
      await sendAudioToAPI(blob);
      
      setIsListening(false);
    });
  };
  
  // 🔥 PROCESS AUDIO WITH ENTERPRISE API
  const sendAudioToAPI = async (audioBlob: Blob) => {
    setIsProcessing(true);
    
    try {
      // Convert audio blob to base64
      const base64Audio = await blobToBase64(audioBlob);
      
      // Call our enterprise voice processing API
      const apiResponse = await fetch('/api/voice/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          audio: base64Audio,
          userId: user?.id || 'web-user',
          context: {
            platform: 'web',
            fantasyTeamId,
            leagueId,
            week: getCurrentWeek()
          },
          includeAudio: true
        })
      });
      
      if (!apiResponse.ok) {
        throw new Error(`API Error: ${apiResponse.status}`);
      }
      
      const result: VoiceProcessingResponse = await apiResponse.json();
      
      // Update UI with comprehensive results
      setTranscript(result.transcript);
      setResponse(result);
      setLastCommandId(result.commandId);
      setShowFeedback(true);
      
      // Play 11Labs audio response if available
      if (result.response.audioUrl && audioRef.current) {
        audioRef.current.src = result.response.audioUrl;
        audioRef.current.play().catch(e => logger.info('Audio play failed:', { data: e }));
      }
      
      // Handle any actions from ML services
      if (result.response.actions && result.response.actions.length > 0) {
        await handleActions(result.response.actions);
      }
      
      // Call parent callback if provided
      if (onCommandProcessed) {
        onCommandProcessed(result);
      }
      
    } catch (error) {
      logger.error('Voice API processing error:', { error: error });
      const errorResponse: VoiceProcessingResponse = {
        success: false,
        commandId: '',
        transcript: '',
        intent: 'ERROR',
        confidence: 0,
        response: {
          text: 'Sorry, I had trouble processing your voice command. Please try again.'
        },
        suggestions: ['Try speaking more clearly', 'Check your microphone', 'Use text input instead'],
        processingTime: 0
      };
      setResponse(errorResponse);
    } finally {
      setIsProcessing(false);
    }
  };

  // Convert blob to base64 for API transmission
  const blobToBase64 = (blob: Blob): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = reader.result?.toString().split(',')[1] || '';
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  };
  
  // Removed duplicate getCurrentWeek - already defined above

  // 🎯 HANDLE ACTIONS FROM ML SERVICES
  const handleActions = async (actions: any[]) => {
    for (const action of actions) {
      switch (action.type) {
        case 'update_lineup':
          logger.info('Lineup optimization complete:', { data: action.lineup });
          // TODO: Navigate to lineup screen or update lineup display
          break;
        case 'show_player_analysis':
          logger.info('Player analysis available:', { data: action.playerName });
          // TODO: Navigate to player screen or show analysis modal
          break;
        case 'open_trade_analysis':
          logger.info('Trade analysis complete:', { data: action.analysis });
          // TODO: Navigate to trade screen or show trade modal
          break;
        case 'show_waiver_recommendations':
          logger.info('Waiver recommendations available:', { data: action.recommendations });
          // TODO: Navigate to waiver screen or show recommendations modal
          break;
        default:
          logger.info('Unknown action type:', { data: action.type });
      }
    }
  };

  // 💬 PROCESS TEXT COMMAND (FOR MANUAL INPUT)
  const handleVoiceCommand = async (text: string) => {
    setIsProcessing(true);
    
    try {
      const apiResponse = await fetch('/api/voice/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript: text,
          userId: user?.id || 'web-user',
          context: {
            platform: 'web',
            fantasyTeamId,
            leagueId,
            week: getCurrentWeek()
          },
          includeAudio: true // Include audio generation for text input too
        })
      });
      
      if (!apiResponse.ok) {
        throw new Error(`API Error: ${apiResponse.status}`);
      }
      
      const result: VoiceProcessingResponse = await apiResponse.json();
      
      // Update UI with results
      setTranscript(result.transcript);
      setResponse(result);
      setLastCommandId(result.commandId);
      setShowFeedback(true);
      
      // Play 11Labs audio response
      if (result.response.audioUrl && audioRef.current) {
        audioRef.current.src = result.response.audioUrl;
        audioRef.current.play().catch(e => logger.info('Audio play failed:', { data: e }));
      }
      
      // Handle actions
      if (result.response.actions && result.response.actions.length > 0) {
        await handleActions(result.response.actions);
      }
      
      // Call parent callback
      if (onCommandProcessed) {
        onCommandProcessed(result);
      }
      
    } catch (error) {
      logger.error('Text command processing error:', { error: error });
      const errorResponse: VoiceProcessingResponse = {
        success: false,
        commandId: '',
        transcript: text,
        intent: 'ERROR',
        confidence: 0,
        response: {
          text: 'Sorry, I had trouble processing that command. Please try again.'
        },
        suggestions: ['Try rephrasing your question', 'Check the examples below'],
        processingTime: 0
      };
      setResponse(errorResponse);
    } finally {
      setIsProcessing(false);
    }
  };

  const toggleWakeWord = async () => {
    if (wakeWordEnabled) {
      setWakeWordEnabled(false);
      // TODO: Stop wake word detection (implement with WebRTC/AudioContext)
      logger.info('Wake word detection disabled');
    } else {
      setWakeWordEnabled(true);
      // TODO: Start wake word detection (implement with WebRTC/AudioContext)
      }
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
      logger.info('Feedback sent:', { data: data.message });
    } catch (error) {
      logger.error('Failed to send feedback:', { error: error });
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

      {/* Enterprise Voice Response */}
      {response && (
        <div className="mb-4 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          {/* Response Header with Analytics */}
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-blue-600 dark:text-blue-400">
              🎤 Fantasy Assistant
            </h3>
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <span className="px-2 py-1 bg-gray-100 dark:bg-gray-700 rounded-full">
                {response.intent.replace('_', ' ').toLowerCase()}
              </span>
              <span className="px-2 py-1 bg-green-100 dark:bg-green-800 rounded-full text-green-700 dark:text-green-300">
                {Math.round(response.confidence * 100)}% confident
              </span>
              <span className="px-2 py-1 bg-purple-100 dark:bg-purple-800 rounded-full text-purple-700 dark:text-purple-300">
                {response.processingTime}ms
              </span>
            </div>
          </div>
          
          {/* Main Response Text */}
          <div className="text-gray-800 dark:text-gray-200 whitespace-pre-wrap mb-3">
            {response.response.text}
          </div>
          
          {/* Visual Data Display */}
          {response.response.visualData && (
            <div className="mb-3 p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">📊 Data Insights</h4>
              <pre className="text-xs text-gray-700 dark:text-gray-300 overflow-x-auto">
                {JSON.stringify(response.response.visualData, null, 2)}
              </pre>
            </div>
          )}
          
          {/* Action Items */}
          {response.response.actions && response.response.actions.length > 0 && (
            <div className="mb-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <h4 className="text-xs font-medium text-green-700 dark:text-green-400 mb-2">⚡ Actions Triggered</h4>
              <ul className="text-xs text-green-600 dark:text-green-300">
                {response.response.actions.map((action, index) => (
                  <li key={index} className="flex items-center gap-2">
                    <span className="w-1 h-1 bg-green-500 rounded-full"></span>
                    {action.type.replace('_', ' ')} 
                    {action.description && `: ${action.description}`}
                  </li>
                ))}
              </ul>
            </div>
          )}
          
          {/* AI Suggestions */}
          {response.suggestions && response.suggestions.length > 0 && (
            <div className="mb-3">
              <h4 className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">💡 Try asking:</h4>
              <div className="flex flex-wrap gap-2">
                {response.suggestions.map((suggestion, index) => (
                  <button
                    key={index}
                    onClick={() => {
                      setTranscript(suggestion);
                      handleVoiceCommand(suggestion);
                    }}
                    className="text-xs px-2 py-1 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    "{suggestion}"
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Feedback buttons */}
          {showFeedback && lastCommandId && (
            <div className="mt-3 flex items-center gap-2 pt-3 border-t border-gray-200 dark:border-gray-700">
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
            "Who should I start this week?",
            "Show me the best waiver wire RBs",
            "Should I trade Mahomes for Lamar?",
            "Is Derrick Henry injured?",
            "What's my team's projected score?",
            "Find me a replacement for my injured TE",
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
/**
 * 🔮 ORACLE SESSION HOOK - ORACLE INTERACTION MANAGEMENT
 * 
 * This hook manages the Oracle session, WebSocket connection,
 * and all interactions with the Fantasy Oracle system.
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { OracleResponse, OracleContext } from '@/lib/services/ai/oracle-service';
import { ChatMessage } from '@/components/oracle/OracleChat';
import { Specialist } from '@/components/oracle/SpecialistPanel';
import { logger } from '../lib/logging/logger';

interface UseOracleSessionOptions {
  sport?: string;
  contestType?: 'GPP' | 'CASH' | 'H2H';
  autoConnect?: boolean;
  onResponse?: (response: OracleResponse) => void;
  onError?: (error: string) => void;
}

interface UseOracleSessionReturn {
  session: {
    id: string;
    isListening: boolean;
    currentSpeaker: string;
  } | null;
  messages: ChatMessage[];
  sendQuery: (text: string) => Promise<void>;
  isConnected: boolean;
  isLoading: boolean;
  error: string | null;
  specialists: Specialist[];
  summonSpecialist: (specialistId: string) => Promise<void>;
  clearMessages: () => void;
  updateContext: (context: Partial<OracleContext>) => Promise<void>;
}

export function useOracleSession({
  sport = 'NFL',
  contestType = 'GPP',
  autoConnect = true,
  onResponse,
  onError
}: UseOracleSessionOptions = {}): UseOracleSessionReturn {
  const [session, setSession] = useState<UseOracleSessionReturn['session']>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [specialists, setSpecialists] = useState<Specialist[]>([]);
  
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const messageIdCounter = useRef(0);
  
  // Initialize session
  const initializeSession = useCallback(async () => {
    try {
      const res = await fetch('/api/oracle/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          initialContext: { sport, contestType }
        })
      });
      
      if (!res.ok) throw new Error('Failed to create session');
      
      const data = await res.json();
      setSession({
        id: data.sessionId,
        isListening: false,
        currentSpeaker: 'oracle'
      });
      
      return data.sessionId;
    } catch (err) {
      logger.error('Session initialization error:', { error: err });
      setError('Failed to initialize Oracle session');
      if (onError) onError('Failed to initialize Oracle session');
      return null;
    }
  }, [sport, contestType, onError]);
  
  // Load specialists
  const loadSpecialists = useCallback(async () => {
    try {
      const res = await fetch('/api/oracle/summon-specialist');
      if (!res.ok) throw new Error('Failed to load specialists');
      
      const data = await res.json();
      setSpecialists(data.specialists);
    } catch (err) {
      logger.error('Load specialists error:', { error: err });
    }
  }, []);
  
  // Connect WebSocket
  const connectWebSocket = useCallback((sessionId: string) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;
    
    const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/ws/oracle?sessionId=${sessionId}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      logger.info('🔮 Oracle WebSocket connected');
      setIsConnected(true);
      setError(null);
    };
    
    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        handleWebSocketMessage(message);
      } catch (err) {
        logger.error('WebSocket message parse error:', { error: err });
      }
    };
    
    ws.onerror = (event) => {
      logger.error('Oracle WebSocket error:', { error: event });
      setError('Connection error');
      if (onError) onError('Connection error');
    };
    
    ws.onclose = () => {
      logger.info('Oracle WebSocket closed');
      setIsConnected(false);
      
      // Attempt reconnection
      reconnectTimeoutRef.current = setTimeout(() => {
        if (session?.id) {
          connectWebSocket(session.id);
        }
      }, 3000);
    };
    
    wsRef.current = ws;
  }, [session, onError]);
  
  // Handle WebSocket messages
  const handleWebSocketMessage = useCallback((message: any) => {
    switch (message.type) {
      case 'oracle_response':
        handleOracleResponse(message.payload);
        break;
        
      case 'specialist_handoff':
        setSession(prev => prev ? {
          ...prev,
          currentSpeaker: message.payload.specialist
        } : null);
        break;
        
      case 'listening_state':
        setSession(prev => prev ? {
          ...prev,
          isListening: message.payload.isListening
        } : null);
        break;
        
      case 'wake_word_detected':
        setSession(prev => prev ? {
          ...prev,
          isListening: true
        } : null);
        handleOracleResponse(message.payload);
        break;
        
      case 'error':
        setError(message.payload.error);
        if (onError) onError(message.payload.error);
        break;
    }
  }, [onError]);
  
  // Handle Oracle response
  const handleOracleResponse = useCallback((response: OracleResponse) => {
    const message: ChatMessage = {
      id: `msg_${Date.now()}_${++messageIdCounter.current}`,
      speaker: response.speaker,
      text: response.text,
      timestamp: new Date(),
      confidence: response.confidence,
      actions: response.actions,
      data: response.data
    };
    
    setMessages(prev => [...prev, message]);
    setIsLoading(false);
    
    // Update session speaker
    setSession(prev => prev ? {
      ...prev,
      currentSpeaker: response.speaker
    } : null);
    
    // Call onResponse callback
    if (onResponse) {
      onResponse(response);
    }
  }, [onResponse]);
  
  // Send query
  const sendQuery = useCallback(async (text: string) => {
    if (!session || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setError('Not connected to Oracle');
      return;
    }
    
    // Add user message
    const userMessage: ChatMessage = {
      id: `msg_${Date.now()}_user_${++messageIdCounter.current}`,
      speaker: 'user',
      text,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMessage]);
    
    // Send via WebSocket
    setIsLoading(true);
    setError(null);
    
    wsRef.current.send(JSON.stringify({
      type: 'oracle_query',
      payload: {
        text,
        context: { sport, contestType },
        generateAudio: true
      },
      sessionId: session.id,
      timestamp: new Date()
    }));
  }, [session, sport, contestType]);
  
  // Summon specialist
  const summonSpecialist = useCallback(async (specialistId: string) => {
    if (!session) return;
    
    try {
      setIsLoading(true);
      
      const res = await fetch('/api/oracle/summon-specialist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          specialistId,
          query: '',
          sessionId: session.id,
          context: { sport, contestType }
        })
      });
      
      if (!res.ok) throw new Error('Failed to summon specialist');
      
      const data = await res.json();
      handleOracleResponse(data.response);
      
    } catch (err) {
      logger.error('Summon specialist error:', { error: err });
      setError('Failed to summon specialist');
      if (onError) onError('Failed to summon specialist');
    } finally {
      setIsLoading(false);
    }
  }, [session, sport, contestType, handleOracleResponse, onError]);
  
  // Update context
  const updateContext = useCallback(async (context: Partial<OracleContext>) => {
    if (!session) return;
    
    try {
      await fetch('/api/oracle/session', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId: session.id,
          context
        })
      });
    } catch (err) {
      logger.error('Update context error:', { error: err });
    }
  }, [session]);
  
  // Clear messages
  const clearMessages = useCallback(() => {
    setMessages([]);
  }, []);
  
  // Initialize on mount
  useEffect(() => {
    if (autoConnect) {
      initializeSession().then(sessionId => {
        if (sessionId) {
          connectWebSocket(sessionId);
          loadSpecialists();
        }
      });
    }
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, [autoConnect, initializeSession, connectWebSocket, loadSpecialists]);
  
  return {
    session,
    messages,
    sendQuery,
    isConnected,
    isLoading,
    error,
    specialists,
    summonSpecialist,
    clearMessages,
    updateContext
  };
}

/**
 * 🔮 ORACLE SESSION HOOK FEATURES:
 * 
 * - WebSocket connection management
 * - Session initialization and persistence
 * - Message history tracking
 * - Specialist summoning
 * - Context updates
 * - Auto-reconnection
 * - Error handling
 * - Loading states
 * 
 * Complete Oracle interaction management!
 */
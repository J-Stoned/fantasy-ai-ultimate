'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import { toast } from 'react-hot-toast';
import { logger } from '../logging/logger';

export interface DraftWebSocketMessage {
  type: string;
  channel?: string;
  data?: any;
  timestamp?: string;
}

export interface DraftPickUpdate {
  pickNumber: number;
  round: number;
  teamId: string;
  playerId: string;
  playerName: string;
  position: string;
  team: string;
  timestamp: Date;
  pickTimeRemaining?: number;
}

export interface DraftChatMessage {
  id: string;
  userId: string;
  username: string;
  message: string;
  timestamp: Date;
  emoji?: string;
}

export interface DraftTimerUpdate {
  timeRemaining: number;
  currentTeamId: string;
  pickNumber: number;
  round: number;
  isAutoPick?: boolean;
}

export interface DraftStateUpdate {
  currentPick: number;
  currentRound: number;
  currentTeamId: string;
  isPaused: boolean;
  isCompleted: boolean;
  participants: DraftParticipant[];
}

export interface DraftParticipant {
  userId: string;
  teamId: string;
  username: string;
  isOnline: boolean;
  isCurrentPick: boolean;
  autoPick: boolean;
}

interface UseDraftWebSocketOptions {
  draftId: string;
  userId: string;
  teamId: string;
  onPickUpdate?: (pick: DraftPickUpdate) => void;
  onChatMessage?: (message: DraftChatMessage) => void;
  onTimerUpdate?: (timer: DraftTimerUpdate) => void;
  onStateUpdate?: (state: DraftStateUpdate) => void;
  onParticipantUpdate?: (participants: DraftParticipant[]) => void;
  onConnectionChange?: (connected: boolean) => void;
}

export function useDraftWebSocket({
  draftId,
  userId,
  teamId,
  onPickUpdate,
  onChatMessage,
  onTimerUpdate,
  onStateUpdate,
  onParticipantUpdate,
  onConnectionChange,
}: UseDraftWebSocketOptions) {
  const ws = useRef<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('disconnected');
  const [participants, setParticipants] = useState<DraftParticipant[]>([]);
  const [chatMessages, setChatMessages] = useState<DraftChatMessage[]>([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout>();
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = 5;

  const connect = useCallback(() => {
    if (ws.current?.readyState === WebSocket.OPEN) return;

    setConnectionStatus('connecting');
    
    try {
      // Get auth token (from localStorage, cookies, or auth context)
      const token = localStorage.getItem('auth_token') || 'demo-token';
      const wsUrl = `ws://localhost:3001?token=${token}`;
      
      ws.current = new WebSocket(wsUrl);

      ws.current.onopen = () => {
        logger.info('Draft WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        reconnectAttemptsRef.current = 0;
        onConnectionChange?.(true);

        // Subscribe to draft channels
        subscribeToChannels();
        
        // Send join draft message
        sendMessage({
          type: 'draft:join',
          data: {
            draftId,
            userId,
            teamId,
            timestamp: new Date().toISOString(),
          },
        });

        toast.success('Connected to draft room!', {
          icon: '🔗',
          duration: 2000,
        });
      };

      ws.current.onmessage = (event) => {
        try {
          const message: DraftWebSocketMessage = JSON.parse(event.data);
          handleMessage(message);
        } catch (error) {
          logger.error('Failed to parse WebSocket message:', { error: error });
        }
      };

      ws.current.onclose = (event) => {
        logger.info('Draft WebSocket disconnected:', { code: event.code, reason: event.reason });
        setIsConnected(false);
        setConnectionStatus('disconnected');
        onConnectionChange?.(false);

        // Attempt reconnection if not a clean close
        if (event.code !== 1000 && reconnectAttemptsRef.current < maxReconnectAttempts) {
          const delay = Math.min(1000 * Math.pow(2, reconnectAttemptsRef.current), 10000);
          reconnectTimeoutRef.current = setTimeout(() => {
            reconnectAttemptsRef.current++;
            toast.loading(`Reconnecting to draft room (${reconnectAttemptsRef.current}/${maxReconnectAttempts})...`, {
              id: 'reconnecting',
            });
            connect();
          }, delay);
        } else if (reconnectAttemptsRef.current >= maxReconnectAttempts) {
          toast.error('Failed to reconnect to draft room. Please refresh the page.', {
            id: 'reconnecting',
            duration: 0,
          });
        }
      };

      ws.current.onerror = (error) => {
        logger.error('Draft WebSocket error:', { error: error });
        setConnectionStatus('error');
        toast.error('Draft connection error');
      };
    } catch (error) {
      logger.error('Failed to connect to draft WebSocket:', { error: error });
      setConnectionStatus('error');
    }
  }, [draftId, userId, teamId, onConnectionChange]);

  const disconnect = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
    }
    
    if (ws.current) {
      ws.current.close(1000, 'User disconnected');
    }
    
    setIsConnected(false);
    setConnectionStatus('disconnected');
  }, []);

  const subscribeToChannels = useCallback(() => {
    if (!ws.current || ws.current.readyState !== WebSocket.OPEN) return;

    // Subscribe to draft-specific channels
    const channels = [
      `draft:${draftId}:picks`,
      `draft:${draftId}:chat`,
      `draft:${draftId}:timer`,
      `draft:${draftId}:state`,
      `draft:${draftId}:participants`,
    ];

    channels.forEach(channel => {
      sendMessage({
        type: 'subscribe',
        channel,
      });
    });
  }, [draftId]);

  const sendMessage = useCallback((message: DraftWebSocketMessage) => {
    if (ws.current?.readyState === WebSocket.OPEN) {
      ws.current.send(JSON.stringify(message));
    }
  }, []);

  const handleMessage = useCallback((message: DraftWebSocketMessage) => {
    switch (message.type) {
      case 'connected':
        logger.info('Draft WebSocket authenticated:', { data: message.data });
        break;

      case 'subscribed':
        logger.info('Subscribed to channel:', { data: message.data?.channel });
        break;

      case 'channel:message':
        handleChannelMessage(message.channel!, message.data);
        break;

      case 'draft:pick_made':
        if (onPickUpdate) {
          onPickUpdate(message.data as DraftPickUpdate);
        }
        break;

      case 'draft:chat_message':
        const chatMessage = message.data as DraftChatMessage;
        setChatMessages(prev => [...prev, chatMessage]);
        if (onChatMessage) {
          onChatMessage(chatMessage);
        }
        break;

      case 'draft:timer_update':
        if (onTimerUpdate) {
          onTimerUpdate(message.data as DraftTimerUpdate);
        }
        break;

      case 'draft:state_update':
        if (onStateUpdate) {
          onStateUpdate(message.data as DraftStateUpdate);
        }
        break;

      case 'draft:participants_update':
        const newParticipants = message.data as DraftParticipant[];
        setParticipants(newParticipants);
        if (onParticipantUpdate) {
          onParticipantUpdate(newParticipants);
        }
        break;

      case 'draft:user_joined':
        toast.success(`${message.data.username} joined the draft`, {
          icon: '👋',
          duration: 3000,
        });
        break;

      case 'draft:user_left':
        toast(`${message.data.username} left the draft`, {
          icon: '👋',
          duration: 3000,
        });
        break;

      case 'draft:paused':
        toast('Draft paused by commissioner', {
          icon: '⏸️',
          duration: 3000,
        });
        break;

      case 'draft:resumed':
        toast('Draft resumed', {
          icon: '▶️',
          duration: 3000,
        });
        break;

      case 'draft:pick_timeout':
        toast(`Time expired! Auto-picking for ${message.data.teamName}`, {
          icon: '⏰',
          duration: 5000,
        });
        break;

      case 'error':
        logger.error('Draft WebSocket error:', { error: message.data });
        toast.error(message.data?.message || 'Draft connection error');
        break;

      default:
        logger.info('Unknown draft message type:', { data: message.type });
    }
  }, [onPickUpdate, onChatMessage, onTimerUpdate, onStateUpdate, onParticipantUpdate]);

  const handleChannelMessage = useCallback((channel: string, data: any) => {
    if (channel.endsWith(':picks')) {
      if (onPickUpdate) {
        onPickUpdate(data);
      }
    } else if (channel.endsWith(':chat')) {
      const chatMessage = data as DraftChatMessage;
      setChatMessages(prev => [...prev, chatMessage]);
      if (onChatMessage) {
        onChatMessage(chatMessage);
      }
    } else if (channel.endsWith(':timer')) {
      if (onTimerUpdate) {
        onTimerUpdate(data);
      }
    } else if (channel.endsWith(':state')) {
      if (onStateUpdate) {
        onStateUpdate(data);
      }
    } else if (channel.endsWith(':participants')) {
      const newParticipants = data as DraftParticipant[];
      setParticipants(newParticipants);
      if (onParticipantUpdate) {
        onParticipantUpdate(newParticipants);
      }
    }
  }, [onPickUpdate, onChatMessage, onTimerUpdate, onStateUpdate, onParticipantUpdate]);

  // Public methods
  const makePick = useCallback((playerId: string, playerName: string, position: string, team: string) => {
    sendMessage({
      type: 'draft:make_pick',
      data: {
        draftId,
        userId,
        teamId,
        playerId,
        playerName,
        position,
        team,
        timestamp: new Date().toISOString(),
      },
    });
  }, [draftId, userId, teamId, sendMessage]);

  const sendChatMessage = useCallback((message: string, emoji?: string) => {
    const chatMessage: Omit<DraftChatMessage, 'id'> = {
      userId,
      username: `User ${userId}`, // In real app, get from user context
      message,
      timestamp: new Date(),
      emoji,
    };

    sendMessage({
      type: 'draft:chat_send',
      data: chatMessage,
    });
  }, [userId, sendMessage]);

  const toggleAutoPick = useCallback((enabled: boolean) => {
    sendMessage({
      type: 'draft:autopick_toggle',
      data: {
        draftId,
        userId,
        teamId,
        enabled,
      },
    });
  }, [draftId, userId, teamId, sendMessage]);

  const pauseDraft = useCallback(() => {
    sendMessage({
      type: 'draft:pause',
      data: { draftId, userId },
    });
  }, [draftId, userId, sendMessage]);

  const resumeDraft = useCallback(() => {
    sendMessage({
      type: 'draft:resume',
      data: { draftId, userId },
    });
  }, [draftId, userId, sendMessage]);

  const skipPick = useCallback(() => {
    sendMessage({
      type: 'draft:skip_pick',
      data: { draftId, userId, teamId },
    });
  }, [draftId, userId, teamId, sendMessage]);

  const undoLastPick = useCallback(() => {
    sendMessage({
      type: 'draft:undo_pick',
      data: { draftId, userId },
    });
  }, [draftId, userId, sendMessage]);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      disconnect();
    };
  }, [connect, disconnect]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  return {
    isConnected,
    connectionStatus,
    participants,
    chatMessages,
    connect,
    disconnect,
    makePick,
    sendChatMessage,
    toggleAutoPick,
    pauseDraft,
    resumeDraft,
    skipPick,
    undoLastPick,
  };
}
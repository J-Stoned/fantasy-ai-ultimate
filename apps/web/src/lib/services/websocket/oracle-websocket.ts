/**
 * 🔮 ORACLE WEBSOCKET HANDLER - REAL-TIME ORACLE COMMUNICATION
 * 
 * This module handles WebSocket connections for the Fantasy Oracle,
 * enabling real-time bi-directional communication for voice interactions.
 */

import { Server } from 'http';
import WebSocket from 'ws';
import { getOracleService } from '../ai/oracle-service';
import { getAgentDebateEngine } from '../ai/agent-debate-engine';
import { logger } from '../../logging/logger';

export interface OracleWebSocketMessage {
  type: 'oracle_query' | 'oracle_response' | 'specialist_handoff' | 
        'debate_request' | 'session_update' | 'audio_stream' | 
        'wake_word_detected' | 'listening_state' | 'error';
  payload: any;
  sessionId?: string;
  timestamp: Date;
}

export class OracleWebSocketHandler {
  private wss: WebSocket.Server | null = null;
  private oracleService = getOracleService();
  private debateEngine = getAgentDebateEngine();
  private connections: Map<string, {
    ws: WebSocket;
    sessionId?: string;
    userId?: string;
    isListening: boolean;
  }> = new Map();
  
  /**
   * Initialize WebSocket server
   */
  initialize(server: Server): void {
    this.wss = new WebSocket.Server({ 
      server, 
      path: '/ws/oracle',
      verifyClient: this.verifyClient.bind(this)
    });
    
    this.wss.on('connection', this.handleConnection.bind(this));
    
    logger.info('🔮 Oracle WebSocket server initialized');
  }
  
  /**
   * Verify WebSocket client
   */
  private verifyClient(info: any, cb: (result: boolean) => void): void {
    // In production, verify auth token from headers
    // For now, allow all connections
    cb(true);
  }
  
  /**
   * Handle new WebSocket connection
   */
  private handleConnection(ws: WebSocket, req: any): void {
    const connectionId = `oracle_ws_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Parse session from URL or headers
    const url = new URL(req.url, `http://${req.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');
    const userId = url.searchParams.get('userId');
    
    // Store connection
    this.connections.set(connectionId, {
      ws,
      sessionId,
      userId,
      isListening: false
    });
    
    logger.info('🔮 Oracle WebSocket connected: ${connectionId}');
    
    // Send welcome message
    this.sendMessage(ws, {
      type: 'oracle_response',
      payload: {
        text: 'Oracle WebSocket connected. Say "Hey Fantasy" to begin.',
        speaker: 'oracle',
        confidence: 1.0
      },
      timestamp: new Date()
    });
    
    // Set up event handlers
    ws.on('message', (data) => this.handleMessage(connectionId, data));
    ws.on('close', () => this.handleDisconnection(connectionId));
    ws.on('error', (error) => this.handleError(connectionId, error));
    
    // Set up ping/pong for connection health
    const pingInterval = setInterval(() => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.ping();
      } else {
        clearInterval(pingInterval);
      }
    }, 30000); // 30 seconds
  }
  
  /**
   * Handle incoming WebSocket message
   */
  private async handleMessage(connectionId: string, data: any): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    try {
      const message: OracleWebSocketMessage = JSON.parse(data.toString());
      
      logger.info('🔮 Oracle WebSocket message: ${message.type}', { data: {
        connectionId,
        sessionId: connection.sessionId
      } });
      
      switch (message.type) {
        case 'oracle_query':
          await this.handleOracleQuery(connectionId, message);
          break;
          
        case 'debate_request':
          await this.handleDebateRequest(connectionId, message);
          break;
          
        case 'session_update':
          await this.handleSessionUpdate(connectionId, message);
          break;
          
        case 'audio_stream':
          await this.handleAudioStream(connectionId, message);
          break;
          
        case 'wake_word_detected':
          await this.handleWakeWord(connectionId, message);
          break;
          
        default:
          this.sendError(connection.ws, `Unknown message type: ${message.type}`);
      }
      
    } catch (error) {
      logger.error('Oracle WebSocket message error:', { error: error });
      this.sendError(connection.ws, 'Failed to process message');
    }
  }
  
  /**
   * Handle Oracle query
   */
  private async handleOracleQuery(
    connectionId: string, 
    message: OracleWebSocketMessage
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    const { text, context, voiceMetadata, generateAudio } = message.payload;
    
    try {
      // Process query through Oracle
      const response = await this.oracleService.processQuery({
        text,
        context,
        sessionId: connection.sessionId || message.sessionId,
        userId: connection.userId,
        voiceMetadata
      });
      
      // Send response
      this.sendMessage(connection.ws, {
        type: 'oracle_response',
        payload: response,
        sessionId: response.sessionId,
        timestamp: new Date()
      });
      
      // Update connection session if changed
      if (response.sessionId !== connection.sessionId) {
        connection.sessionId = response.sessionId;
      }
      
      // Handle specialist handoff
      if (response.speaker !== 'oracle') {
        this.sendMessage(connection.ws, {
          type: 'specialist_handoff',
          payload: {
            specialist: response.speaker,
            message: `Connected to ${response.speaker}`
          },
          sessionId: response.sessionId,
          timestamp: new Date()
        });
      }
      
    } catch (error) {
      logger.error('Oracle query error:', { error: error });
      this.sendError(connection.ws, 'Failed to process Oracle query');
    }
  }
  
  /**
   * Handle debate request
   */
  private async handleDebateRequest(
    connectionId: string,
    message: OracleWebSocketMessage
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    const { topic, type, context } = message.payload;
    
    try {
      // Start debate through debate engine
      const debateId = await this.debateEngine.startDebate(
        topic,
        type,
        context,
        { streamAudio: true }
      );
      
      // Send debate started message
      this.sendMessage(connection.ws, {
        type: 'oracle_response',
        payload: {
          text: `Starting ${type} debate: "${topic}"`,
          speaker: 'oracle',
          debateId,
          actions: [{
            type: 'view_debate',
            label: 'Watch Debate',
            payload: { debateId }
          }]
        },
        sessionId: connection.sessionId,
        timestamp: new Date()
      });
      
    } catch (error) {
      logger.error('Debate request error:', { error: error });
      this.sendError(connection.ws, 'Failed to start debate');
    }
  }
  
  /**
   * Handle session update
   */
  private async handleSessionUpdate(
    connectionId: string,
    message: OracleWebSocketMessage
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    const { sessionId, context, isListening } = message.payload;
    
    // Update connection info
    if (sessionId) {
      connection.sessionId = sessionId;
    }
    
    if (isListening !== undefined) {
      connection.isListening = isListening;
      
      // Send listening state update
      this.sendMessage(connection.ws, {
        type: 'listening_state',
        payload: { isListening },
        sessionId: connection.sessionId,
        timestamp: new Date()
      });
    }
  }
  
  /**
   * Handle audio stream (for future voice processing)
   */
  private async handleAudioStream(
    connectionId: string,
    message: OracleWebSocketMessage
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    // In production, this would handle streaming audio for real-time STT
    // For now, acknowledge receipt
    logger.info('🎤 Audio stream received', { data: { 
      connectionId, 
      size: message.payload.audioData?.length 
    } });
  }
  
  /**
   * Handle wake word detection
   */
  private async handleWakeWord(
    connectionId: string,
    message: OracleWebSocketMessage
  ): Promise<void> {
    const connection = this.connections.get(connectionId);
    if (!connection) return;
    
    connection.isListening = true;
    
    // Process wake word through Oracle
    const response = await this.oracleService.processQuery({
      text: 'Hey Fantasy',
      sessionId: connection.sessionId,
      userId: connection.userId
    });
    
    // Send wake response
    this.sendMessage(connection.ws, {
      type: 'wake_word_detected',
      payload: {
        text: response.text,
        speaker: 'oracle',
        isListening: true
      },
      sessionId: response.sessionId,
      timestamp: new Date()
    });
  }
  
  /**
   * Handle disconnection
   */
  private handleDisconnection(connectionId: string): void {
    const connection = this.connections.get(connectionId);
    if (connection) {
      logger.info('🔮 Oracle WebSocket disconnected: ${connectionId}');
      this.connections.delete(connectionId);
    }
  }
  
  /**
   * Handle WebSocket error
   */
  private handleError(connectionId: string, error: Error): void {
    logger.error('Oracle WebSocket error for ${connectionId}:', { error: error });
    const connection = this.connections.get(connectionId);
    if (connection) {
      this.sendError(connection.ws, 'WebSocket error occurred');
    }
  }
  
  /**
   * Send message to client
   */
  private sendMessage(ws: WebSocket, message: OracleWebSocketMessage): void {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(message));
    }
  }
  
  /**
   * Send error message
   */
  private sendError(ws: WebSocket, error: string): void {
    this.sendMessage(ws, {
      type: 'error',
      payload: { error },
      timestamp: new Date()
    });
  }
  
  /**
   * Broadcast to all connections in a session
   */
  broadcastToSession(sessionId: string, message: OracleWebSocketMessage): void {
    this.connections.forEach((connection) => {
      if (connection.sessionId === sessionId) {
        this.sendMessage(connection.ws, message);
      }
    });
  }
  
  /**
   * Get connection statistics
   */
  getStats(): any {
    return {
      totalConnections: this.connections.size,
      listeningConnections: Array.from(this.connections.values())
        .filter(c => c.isListening).length,
      sessionCount: new Set(
        Array.from(this.connections.values())
          .map(c => c.sessionId)
          .filter(Boolean)
      ).size
    };
  }
}

// Singleton instance
let oracleWebSocketHandler: OracleWebSocketHandler | null = null;

export function getOracleWebSocketHandler(): OracleWebSocketHandler {
  if (!oracleWebSocketHandler) {
    oracleWebSocketHandler = new OracleWebSocketHandler();
  }
  return oracleWebSocketHandler;
}

/**
 * 🔮 ORACLE WEBSOCKET FEATURES:
 * 
 * - Real-time bi-directional Oracle communication
 * - Session-based connection management
 * - Wake word detection and listening states
 * - Specialist handoff support
 * - Debate request handling
 * - Audio streaming preparation
 * - Connection health monitoring
 * 
 * WebSocket endpoint: ws://localhost:3000/ws/oracle
 */
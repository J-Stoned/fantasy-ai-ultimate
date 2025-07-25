/**
 * 🔮 FANTASY ORACLE SERVICE - THE MASTER AI SYSTEM
 * 
 * This service manages the Fantasy Oracle, providing concise, professional
 * fantasy sports guidance with seamless specialist handoffs.
 */

import { EventEmitter } from 'events';
import { getMultiAgentSystem, MultiAgentSystem, AgentDecision } from './multi-agent-system';
import { getVoiceAnalyticsProcessor, VoiceAnalyticsProcessor } from '../analytics/voice-analytics-processor';
import { getPredictionService } from '../ml/prediction-service';
import { getGPUOptimizerService } from '../ml/gpu-optimizer-service';
import { pool } from '@/lib/db';
import { logger } from '../../logging/logger';

export interface OracleQuery {
  text: string;
  context?: OracleContext;
  sessionId?: string;
  userId?: string;
  voiceMetadata?: {
    confidence: number;
    emotion?: string;
    speed?: number;
  };
}

export interface OracleContext {
  sport?: string;
  contestType?: 'GPP' | 'CASH' | 'H2H';
  playerIds?: string[];
  lineup?: any;
  timeframe?: string;
  budget?: number;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  riskTolerance: 'conservative' | 'balanced' | 'aggressive';
  favoriteTeams?: string[];
  blacklist?: string[];
  sportPreference?: string[];
  contestPreference?: string;
}

export interface OracleResponse {
  text: string;
  speaker: 'oracle' | string; // Oracle or specialist ID
  audioUrl?: string;
  data?: any;
  visualization?: any;
  actions?: OracleAction[];
  specialists?: string[];
  confidence: number;
  sessionId: string;
  followUp?: string[];
}

export interface OracleAction {
  type: 'add_player' | 'remove_player' | 'view_details' | 'show_chart' | 'build_lineup' | 'summon_specialist';
  label: string;
  payload: any;
}

export interface OracleSession {
  id: string;
  userId?: string;
  startTime: Date;
  lastActivity: Date;
  context: OracleContext;
  memory: OracleMemory[];
  currentSpeaker: 'oracle' | string;
  isListening: boolean;
}

export interface OracleMemory {
  timestamp: Date;
  type: 'query' | 'response' | 'preference' | 'decision';
  content: any;
  importance: number;
}

export interface OracleProphecy {
  id: string;
  prediction: string;
  confidence: number;
  timeframe: 'tonight' | 'this_week' | 'season';
  sport: string;
  createdAt: Date;
  fulfilled?: boolean;
  accuracy?: number;
}

export class OracleService extends EventEmitter {
  private multiAgentSystem: MultiAgentSystem;
  private analyticsProcessor: VoiceAnalyticsProcessor;
  private predictionService: any;
  private optimizerService: any;
  private sessions: Map<string, OracleSession> = new Map();
  private prophecies: Map<string, OracleProphecy> = new Map();
  private userPreferences: Map<string, UserPreferences> = new Map();
  
  // Wake phrases
  private readonly WAKE_PHRASES = [
    'hey fantasy',
    'okay fantasy',
    'fantasy oracle',
    'oracle'
  ];
  
  // Oracle responses
  private readonly ORACLE_GREETINGS = [
    'Listening.',
    'Yes?',
    'Oracle ready.',
    'How can I help?',
    'Go ahead.'
  ];
  
  constructor() {
    super();
    this.multiAgentSystem = getMultiAgentSystem();
    this.analyticsProcessor = getVoiceAnalyticsProcessor();
    this.predictionService = getPredictionService();
    this.optimizerService = getGPUOptimizerService();
    this.startSessionCleanup();
  }

  /**
   * 🎤 Process voice/text query
   */
  async processQuery(query: OracleQuery): Promise<OracleResponse> {
    const startTime = Date.now();
    
    // Get or create session
    const session = this.getOrCreateSession(query.sessionId, query.userId);
    
    // Check for wake word
    if (this.detectWakeWord(query.text)) {
      session.isListening = true;
      session.currentSpeaker = 'oracle';
      return this.createOracleResponse(
        this.getRandomGreeting(),
        session,
        0.95
      );
    }
    
    // Must be listening to process
    if (!session.isListening) {
      return this.createOracleResponse(
        'Say "Hey Fantasy" to start.',
        session,
        1.0
      );
    }
    
    // Update session activity
    session.lastActivity = new Date();
    
    // Check for specialist request
    const specialistRequest = this.multiAgentSystem.detectSpecialistRequest(query.text);
    if (specialistRequest) {
      return this.summonSpecialist(specialistRequest, query, session);
    }
    
    // Check for return to Oracle
    if (this.detectReturnToOracle(query.text)) {
      session.currentSpeaker = 'oracle';
      return this.createOracleResponse(
        'Oracle back. What else?',
        session,
        0.95
      );
    }
    
    // Route to current speaker
    if (session.currentSpeaker !== 'oracle') {
      return this.routeToSpecialist(session.currentSpeaker, query, session);
    }
    
    // Process with Oracle
    return this.processOracleQuery(query, session);
  }

  /**
   * 🔮 Process query as Oracle
   */
  private async processOracleQuery(
    query: OracleQuery,
    session: OracleSession
  ): Promise<OracleResponse> {
    // Extract intent
    const intent = await this.extractIntent(query.text, session.context);
    
    // Update context
    session.context = { ...session.context, ...intent.context };
    
    // Handle different intents
    switch (intent.type) {
      case 'player_analysis':
        return this.analyzePlayer(intent.entities.player, session);
        
      case 'player_comparison':
        return this.comparePlayers(intent.entities.players, session);
        
      case 'lineup_build':
        return this.buildLineup(intent.entities, session);
        
      case 'lineup_optimize':
        return this.optimizeLineup(session.context.lineup, session);
        
      case 'show_chart':
        return this.generateChart(intent.entities, session);
        
      case 'prophecy':
        return this.generateProphecy(intent.entities, session);
        
      case 'preference':
        return this.savePreference(intent.entities, session);
        
      case 'help':
        return this.showHelp(session);
        
      default:
        return this.handleGeneralQuery(query, session);
    }
  }

  /**
   * 🎯 Extract intent from query
   */
  private async extractIntent(text: string, context: OracleContext): Promise<any> {
    const lowerText = text.toLowerCase();
    
    // Player analysis
    const playerMatch = text.match(/([A-Z][a-z]+ [A-Z][a-z]+)/g);
    if (playerMatch && !lowerText.includes(' or ') && !lowerText.includes(' vs ')) {
      return {
        type: 'player_analysis',
        entities: { player: playerMatch[0] },
        context: {}
      };
    }
    
    // Player comparison
    if (lowerText.includes(' or ') || lowerText.includes(' vs ')) {
      const players = text.match(/([A-Z][a-z]+ [A-Z][a-z]+)/g) || [];
      return {
        type: 'player_comparison',
        entities: { players },
        context: {}
      };
    }
    
    // Lineup building
    if (/build.*lineup|create.*lineup|make.*lineup/i.test(text)) {
      const contestType = this.extractContestType(text);
      const sport = this.extractSport(text) || context.sport || 'NFL';
      return {
        type: 'lineup_build',
        entities: { contestType, sport },
        context: { contestType, sport }
      };
    }
    
    // Chart request
    if (/show.*chart|display.*graph|visualize/i.test(text)) {
      return {
        type: 'show_chart',
        entities: { query: text },
        context: {}
      };
    }
    
    // Prophecy
    if (/prophecy|predict|forecast/i.test(text)) {
      return {
        type: 'prophecy',
        entities: { timeframe: this.extractTimeframe(text) },
        context: {}
      };
    }
    
    // Preference
    if (/remember|prefer|always|never/i.test(text)) {
      return {
        type: 'preference',
        entities: { text },
        context: {}
      };
    }
    
    // Help
    if (/help|commands|what can you/i.test(text)) {
      return {
        type: 'help',
        entities: {},
        context: {}
      };
    }
    
    // General
    return {
      type: 'general',
      entities: { text },
      context: {}
    };
  }

  /**
   * 🎯 Analyze player
   */
  private async analyzePlayer(
    playerName: string,
    session: OracleSession
  ): Promise<OracleResponse> {
    try {
      // Get player data
      const player = await this.getPlayerByName(playerName);
      if (!player) {
        return this.createOracleResponse(
          `${playerName} not found. Try full name.`,
          session,
          0.9
        );
      }
      
      // Get ML prediction
      const prediction = await this.predictionService.predictPlayer(
        player.player_id,
        player.sport
      );
      
      // Get Oracle decision
      const decision = await this.multiAgentSystem.getAgentDecision(
        'fantasy-oracle',
        `Should I play ${playerName}?`,
        {
          type: 'player_analysis',
          player,
          prediction,
          contestType: session.context.contestType || 'GPP'
        }
      );
      
      // Build concise response
      let response = `${decision.reasoning}`;
      
      // Add key stats
      if (prediction.projectedPoints) {
        response += ` ${prediction.projectedPoints.toFixed(1)} pts projected.`;
      }
      
      // Add ownership if GPP
      if (session.context.contestType === 'GPP' && player.projected_ownership) {
        response += ` ${player.projected_ownership}% owned.`;
      }
      
      // Create actions
      const actions: OracleAction[] = [
        {
          type: 'add_player',
          label: 'Add to lineup',
          payload: { playerId: player.player_id }
        },
        {
          type: 'view_details',
          label: 'View details',
          payload: { playerId: player.player_id }
        }
      ];
      
      // Add memory
      this.addMemory(session, 'decision', {
        player: playerName,
        decision: decision.decision,
        confidence: decision.confidence
      });
      
      return this.createOracleResponse(
        response,
        session,
        decision.confidence,
        { player, prediction },
        actions
      );
      
    } catch (error) {
      logger.error('Player analysis error:', { error: error });
      return this.createOracleResponse(
        'Analysis failed. Try again.',
        session,
        0.5
      );
    }
  }

  /**
   * 🆚 Compare players
   */
  private async comparePlayers(
    players: string[],
    session: OracleSession
  ): Promise<OracleResponse> {
    if (players.length < 2) {
      return this.createOracleResponse(
        'Need two players to compare.',
        session,
        0.9
      );
    }
    
    try {
      // Get player data
      const playerData = await Promise.all(
        players.slice(0, 2).map(name => this.getPlayerByName(name))
      );
      
      if (playerData.some(p => !p)) {
        return this.createOracleResponse(
          'One or more players not found.',
          session,
          0.9
        );
      }
      
      // Get predictions
      const predictions = await Promise.all(
        playerData.map(player => 
          this.predictionService.predictPlayer(player.player_id, player.sport)
        )
      );
      
      // Compare
      const winner = predictions[0].projectedPoints > predictions[1].projectedPoints ? 0 : 1;
      const margin = Math.abs(predictions[0].projectedPoints - predictions[1].projectedPoints);
      
      // Build response
      const response = `${players[winner]} by ${margin.toFixed(1)} points. ` +
        `${predictions[winner].projectedPoints.toFixed(1)} vs ${predictions[1-winner].projectedPoints.toFixed(1)}.`;
      
      // Add context
      let context = '';
      if (margin < 2) {
        context = ' Close call.';
      } else if (margin > 5) {
        context = ' Clear choice.';
      }
      
      return this.createOracleResponse(
        response + context,
        session,
        0.85,
        { players: playerData, predictions }
      );
      
    } catch (error) {
      logger.error('Comparison error:', { error: error });
      return this.createOracleResponse(
        'Comparison failed. Try again.',
        session,
        0.5
      );
    }
  }

  /**
   * 🏆 Build lineup
   */
  private async buildLineup(
    entities: any,
    session: OracleSession
  ): Promise<OracleResponse> {
    const { sport = 'NFL', contestType = 'GPP' } = entities;
    
    try {
      // Generate optimized lineup
      const lineups = contestType === 'GPP' ?
        await this.optimizerService.generateGPPLineups('default', 1) :
        await this.optimizerService.generateCashLineups('default', 1);
      
      if (!lineups || lineups.length === 0) {
        return this.createOracleResponse(
          'Lineup generation failed. Try again.',
          session,
          0.5
        );
      }
      
      const lineup = lineups[0];
      
      // Build response
      const response = `${contestType} lineup ready. ` +
        `${lineup.projectedPoints.toFixed(1)} projected points. ` +
        `$${lineup.totalSalary.toLocaleString()} used.`;
      
      // Update context
      session.context.lineup = lineup;
      
      // Create actions
      const actions: OracleAction[] = [
        {
          type: 'view_details',
          label: 'View lineup',
          payload: { lineup }
        },
        {
          type: 'build_lineup',
          label: 'New lineup',
          payload: { sport, contestType }
        }
      ];
      
      return this.createOracleResponse(
        response,
        session,
        0.9,
        { lineup },
        actions
      );
      
    } catch (error) {
      logger.error('Lineup build error:', { error: error });
      return this.createOracleResponse(
        'Build failed. Try again.',
        session,
        0.5
      );
    }
  }

  /**
   * 📊 Generate chart
   */
  private async generateChart(
    entities: any,
    session: OracleSession
  ): Promise<OracleResponse> {
    try {
      // Process analytics query
      const result = await this.analyticsProcessor.processVoiceQuery({
        text: entities.query,
        context: session.context
      });
      
      // Build response
      const response = `Displaying ${result.intent.type} chart. ` +
        result.insights[0] || '';
      
      return this.createOracleResponse(
        response,
        session,
        0.9,
        result.data,
        [],
        result.chartConfig
      );
      
    } catch (error) {
      logger.error('Chart generation error:', { error: error });
      return this.createOracleResponse(
        'Chart failed. Try different query.',
        session,
        0.5
      );
    }
  }

  /**
   * 🔮 Generate prophecy
   */
  private async generateProphecy(
    entities: any,
    session: OracleSession
  ): Promise<OracleResponse> {
    const timeframe = entities.timeframe || 'tonight';
    const sport = session.context.sport || 'NFL';
    
    // Get insights from specialists
    const insights = await this.gatherPropheticInsights(sport, timeframe);
    
    // Build prophecy
    const prophecy = this.craftProphecy(insights, timeframe);
    
    // Store prophecy
    const prophecyRecord: OracleProphecy = {
      id: `prophecy_${Date.now()}`,
      prediction: prophecy,
      confidence: 0.75,
      timeframe,
      sport,
      createdAt: new Date()
    };
    
    this.prophecies.set(prophecyRecord.id, prophecyRecord);
    
    return this.createOracleResponse(
      prophecy,
      session,
      0.75
    );
  }

  /**
   * 🔄 Summon specialist
   */
  private async summonSpecialist(
    specialistId: string,
    query: OracleQuery,
    session: OracleSession
  ): Promise<OracleResponse> {
    // Update session
    session.currentSpeaker = specialistId;
    
    // Get specialist
    const specialist = this.multiAgentSystem.getRandomAgent(); // This should get specific agent
    
    // Create handoff message
    const handoffMessage = `Connecting to ${specialist.name}...`;
    
    // Process with specialist
    const specialistResponse = await this.multiAgentSystem.getAgentDecision(
      specialistId,
      query.text,
      session.context
    );
    
    return this.createOracleResponse(
      `${specialist.emoji} ${specialistResponse.reasoning}`,
      session,
      specialistResponse.confidence,
      undefined,
      [],
      undefined,
      specialistId
    );
  }

  /**
   * 🎯 Create Oracle response
   */
  private createOracleResponse(
    text: string,
    session: OracleSession,
    confidence: number,
    data?: any,
    actions?: OracleAction[],
    visualization?: any,
    speaker: string = 'oracle'
  ): OracleResponse {
    return {
      text,
      speaker,
      confidence,
      data,
      actions: actions || [],
      visualization,
      sessionId: session.id,
      followUp: this.generateFollowUpSuggestions(session)
    };
  }

  /**
   * 🔍 Detect wake word
   */
  private detectWakeWord(text: string): boolean {
    const lowerText = text.toLowerCase();
    return this.WAKE_PHRASES.some(phrase => lowerText.includes(phrase));
  }

  /**
   * 🔄 Detect return to Oracle
   */
  private detectReturnToOracle(text: string): boolean {
    const lowerText = text.toLowerCase();
    return lowerText.includes('back to oracle') || 
           lowerText.includes('oracle') && !lowerText.includes('fantasy');
  }

  /**
   * 🎲 Get random greeting
   */
  private getRandomGreeting(): string {
    return this.ORACLE_GREETINGS[Math.floor(Math.random() * this.ORACLE_GREETINGS.length)];
  }

  /**
   * 📋 Session management
   */
  private getOrCreateSession(sessionId?: string, userId?: string): OracleSession {
    const id = sessionId || `oracle_session_${Date.now()}`;
    
    if (!this.sessions.has(id)) {
      const session: OracleSession = {
        id,
        userId,
        startTime: new Date(),
        lastActivity: new Date(),
        context: {},
        memory: [],
        currentSpeaker: 'oracle',
        isListening: false
      };
      
      // Load user preferences
      if (userId && this.userPreferences.has(userId)) {
        session.context.preferences = this.userPreferences.get(userId);
      }
      
      this.sessions.set(id, session);
    }
    
    return this.sessions.get(id)!;
  }

  /**
   * 🧠 Add to session memory
   */
  private addMemory(
    session: OracleSession,
    type: OracleMemory['type'],
    content: any,
    importance: number = 0.5
  ): void {
    session.memory.push({
      timestamp: new Date(),
      type,
      content,
      importance
    });
    
    // Keep only recent/important memories
    if (session.memory.length > 50) {
      session.memory = session.memory
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 30);
    }
  }

  /**
   * 📍 Save user preference
   */
  private async savePreference(
    entities: any,
    session: OracleSession
  ): Promise<OracleResponse> {
    const text = entities.text.toLowerCase();
    
    // Extract preference
    let preference: Partial<UserPreferences> = {};
    
    if (text.includes('gpp') || text.includes('tournament')) {
      preference.contestPreference = 'GPP';
    } else if (text.includes('cash') || text.includes('safe')) {
      preference.contestPreference = 'CASH';
    }
    
    if (text.includes('aggressive') || text.includes('risk')) {
      preference.riskTolerance = 'aggressive';
    } else if (text.includes('conservative') || text.includes('safe')) {
      preference.riskTolerance = 'conservative';
    }
    
    // Update preferences
    if (session.userId) {
      const existing = this.userPreferences.get(session.userId) || {} as UserPreferences;
      this.userPreferences.set(session.userId, { ...existing, ...preference });
      session.context.preferences = { ...existing, ...preference };
    }
    
    // Add to memory
    this.addMemory(session, 'preference', preference, 0.9);
    
    return this.createOracleResponse(
      'Preference saved.',
      session,
      0.95
    );
  }

  /**
   * ❓ Show help
   */
  private async showHelp(session: OracleSession): Promise<OracleResponse> {
    const help = `Say player names for analysis. ` +
      `"A or B" to compare. ` +
      `"Build lineup" for optimization. ` +
      `"Show chart" for visuals. ` +
      `Name specialists for their view.`;
    
    return this.createOracleResponse(
      help,
      session,
      1.0
    );
  }

  /**
   * 🎯 Handle general query
   */
  private async handleGeneralQuery(
    query: OracleQuery,
    session: OracleSession
  ): Promise<OracleResponse> {
    // Get Oracle's general response
    const decision = await this.multiAgentSystem.getAgentDecision(
      'fantasy-oracle',
      query.text,
      session.context
    );
    
    return this.createOracleResponse(
      decision.reasoning,
      session,
      decision.confidence
    );
  }

  /**
   * 🔍 Helper methods
   */
  private extractContestType(text: string): 'GPP' | 'CASH' | 'H2H' {
    const lower = text.toLowerCase();
    if (lower.includes('gpp') || lower.includes('tournament')) return 'GPP';
    if (lower.includes('cash') || lower.includes('50/50')) return 'CASH';
    if (lower.includes('h2h') || lower.includes('head')) return 'H2H';
    return 'GPP'; // default
  }

  private extractSport(text: string): string | undefined {
    const sports = ['NFL', 'NBA', 'MLB', 'NHL', 'PGA', 'UFC'];
    for (const sport of sports) {
      if (text.toUpperCase().includes(sport)) {
        return sport;
      }
    }
    return undefined;
  }

  private extractTimeframe(text: string): 'tonight' | 'this_week' | 'season' {
    if (text.includes('tonight') || text.includes('today')) return 'tonight';
    if (text.includes('week')) return 'this_week';
    if (text.includes('season')) return 'season';
    return 'tonight';
  }

  private async getPlayerByName(name: string): Promise<any> {
    try {
      const query = `
        SELECT * FROM players 
        WHERE LOWER(name) = LOWER($1) 
        OR LOWER(name) LIKE LOWER($2)
        LIMIT 1
      `;
      
      const result = await pool.query(query, [name, `%${name}%`]);
      return result.rows[0];
    } catch (error) {
      logger.error('Player lookup error:', { error: error });
      return null;
    }
  }

  private generateFollowUpSuggestions(session: OracleSession): string[] {
    const suggestions: string[] = [];
    
    // Context-based suggestions
    if (session.memory.length > 0) {
      const lastMemory = session.memory[session.memory.length - 1];
      if (lastMemory.type === 'decision' && lastMemory.content.player) {
        suggestions.push('Show alternatives');
        suggestions.push('Add to lineup');
      }
    }
    
    // Always available
    suggestions.push('Build lineup');
    suggestions.push('Top plays');
    
    return suggestions.slice(0, 3);
  }

  private async gatherPropheticInsights(sport: string, timeframe: string): Promise<any[]> {
    // Get insights from different agents
    const agents = ['data-scientist', 'vegas-sharp', 'weather-hawk'];
    const insights = await Promise.all(
      agents.map(agentId => 
        this.multiAgentSystem.getAgentDecision(
          agentId,
          `Prophecy for ${sport} ${timeframe}`,
          { sport, timeframe }
        )
      )
    );
    
    return insights;
  }

  private craftProphecy(insights: any[], timeframe: string): string {
    // Synthesize insights into prophecy
    const keyPoints = insights
      .flatMap(i => i.keyFactors)
      .filter((v, i, a) => a.indexOf(v) === i)
      .slice(0, 3);
    
    let prophecy = `Three insights for ${timeframe}: `;
    keyPoints.forEach((point, i) => {
      prophecy += `${i + 1}. ${point}. `;
    });
    
    return prophecy;
  }

  private async routeToSpecialist(
    specialistId: string,
    query: OracleQuery,
    session: OracleSession
  ): Promise<OracleResponse> {
    const response = await this.multiAgentSystem.getAgentDecision(
      specialistId,
      query.text,
      session.context
    );
    
    const specialist = this.multiAgentSystem.getRandomAgent();
    
    return this.createOracleResponse(
      `${specialist.emoji} ${response.reasoning}`,
      session,
      response.confidence,
      undefined,
      [],
      undefined,
      specialistId
    );
  }

  /**
   * 🧹 Session cleanup
   */
  private startSessionCleanup(): void {
    setInterval(() => {
      const now = Date.now();
      const timeout = 30 * 60 * 1000; // 30 minutes
      
      this.sessions.forEach((session, id) => {
        if (now - session.lastActivity.getTime() > timeout) {
          this.sessions.delete(id);
        }
      });
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * 📊 Get service statistics
   */
  getStats(): any {
    return {
      activeSessions: this.sessions.size,
      totalProphecies: this.prophecies.size,
      userPreferences: this.userPreferences.size,
      oraclePersonality: this.multiAgentSystem.getOracle()
    };
  }
}

// Singleton instance
let oracleServiceInstance: OracleService | null = null;

export function getOracleService(): OracleService {
  if (!oracleServiceInstance) {
    oracleServiceInstance = new OracleService();
  }
  return oracleServiceInstance;
}

/**
 * 🔮 THE FANTASY ORACLE GUARANTEE:
 * 
 * This service provides:
 * - Concise, professional fantasy guidance
 * - Seamless specialist handoffs
 * - Voice-first interaction design
 * - Session memory and learning
 * - Prophetic insights
 * - User preference tracking
 * 
 * 100% REAL ORACLE WISDOM - NO MYSTICAL FLUFF!
 */
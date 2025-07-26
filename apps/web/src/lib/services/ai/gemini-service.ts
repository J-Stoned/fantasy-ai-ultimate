/**
 * 🔥 Google Gemini AI Service - Elite Natural Language Processing
 * 
 * Revolutionary AI integration with:
 * - Natural language lineup advice
 * - Context-aware fantasy insights
 * - Multi-modal analysis (text + images)
 * - Real-time game flow predictions
 * - Advanced injury impact analysis
 * - Weather pattern correlation
 * 
 * @version 2025.1.0
 */

import { GoogleGenerativeAI, HarmCategory, HarmBlockThreshold } from '@google/generative-ai';
import { logger } from '../../logging/logger';
import { supabase } from '../../supabase/client';
import { ga4Service } from '../../analytics/ga4-service';

// Gemini Models
export enum GeminiModel {
  PRO = 'gemini-pro',                    // Text-only, best for analysis
  PRO_VISION = 'gemini-pro-vision',      // Text + images
  PRO_1_5 = 'gemini-1.5-pro-latest',    // Latest, most capable
  FLASH = 'gemini-1.5-flash'            // Fast, efficient
}

// Fantasy Context Types
export interface FantasyContext {
  sport: 'nfl' | 'nba' | 'mlb' | 'nhl';
  gameWeek?: number;
  playerStats?: PlayerStats[];
  injuries?: InjuryReport[];
  weather?: WeatherCondition[];
  lineup?: LineupPlayer[];
  matchups?: Matchup[];
  historicalData?: any[];
}

// Player Stats
export interface PlayerStats {
  playerId: string;
  name: string;
  team: string;
  position: string;
  projectedPoints: number;
  salary: number;
  ownership?: number;
  recentForm?: number[];
  averagePoints?: number;
}

// Injury Report
export interface InjuryReport {
  playerId: string;
  status: 'out' | 'doubtful' | 'questionable' | 'probable';
  description: string;
  returnDate?: Date;
}

// Weather Condition
export interface WeatherCondition {
  gameId: string;
  temperature: number;
  windSpeed: number;
  precipitation: number;
  condition: string;
}

// Lineup Player
export interface LineupPlayer {
  playerId: string;
  name: string;
  position: string;
  salary: number;
  projectedPoints: number;
}

// Matchup
export interface Matchup {
  homeTeam: string;
  awayTeam: string;
  homeScore?: number;
  awayScore?: number;
  gameTime: Date;
  venue: string;
}

// Gemini Response Types
export interface GeminiInsight {
  type: 'lineup' | 'player' | 'strategy' | 'injury' | 'weather' | 'general';
  confidence: number; // 0-1
  insight: string;
  reasoning: string[];
  recommendations: string[];
  dataPoints: Record<string, any>;
  timestamp: Date;
}

// Chat Session
export interface ChatSession {
  sessionId: string;
  userId: string;
  messages: ChatMessage[];
  context: FantasyContext;
  createdAt: Date;
  lastActive: Date;
}

// Chat Message
export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

// Configuration
const GEMINI_CONFIG = {
  apiKey: process.env.NEXT_PUBLIC_GOOGLE_GEMINI_API_KEY!,
  generationConfig: {
    temperature: 0.7,          // Balance creativity and accuracy
    topK: 40,                 // Consider top 40 tokens
    topP: 0.95,              // Nucleus sampling
    maxOutputTokens: 2048,    // Response length
    stopSequences: []
  },
  safetySettings: [
    {
      category: HarmCategory.HARM_CATEGORY_HARASSMENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
      category: HarmCategory.HARM_CATEGORY_HATE_SPEECH,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
      category: HarmCategory.HARM_CATEGORY_SEXUALLY_EXPLICIT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    },
    {
      category: HarmCategory.HARM_CATEGORY_DANGEROUS_CONTENT,
      threshold: HarmBlockThreshold.BLOCK_MEDIUM_AND_ABOVE
    }
  ]
};

// System prompts for different contexts
const SYSTEM_PROMPTS = {
  lineup: `You are an elite fantasy sports analyst with deep expertise in DFS optimization. 
    Analyze the provided lineup and context to give actionable advice. Consider:
    - Player form and matchups
    - Injury reports and weather conditions
    - Salary efficiency and ownership projections
    - Correlation and game stacking strategies
    - GPP vs Cash game considerations
    Provide specific, data-driven recommendations.`,
    
  injury: `You are a sports medicine expert analyzing injury impacts on fantasy performance.
    Consider:
    - Injury severity and typical recovery timelines
    - Historical performance after similar injuries
    - Backup player opportunities
    - Workload management implications
    - Re-injury risk factors`,
    
  weather: `You are a meteorologist specializing in weather impacts on sports performance.
    Analyze how weather conditions affect:
    - Passing vs rushing game scripts
    - Scoring environments
    - Kicking accuracy
    - Player safety and performance
    - Historical weather correlations`,
    
  strategy: `You are a professional DFS player sharing winning strategies.
    Focus on:
    - Contest selection and bankroll management
    - Ownership leverage opportunities
    - Multi-entry strategies
    - Late swap optimization
    - Risk/reward assessment`
};

/**
 * Elite Google Gemini AI Service
 */
export class GeminiAIService {
  private static instance: GeminiAIService;
  private genAI: GoogleGenerativeAI;
  private model: any; // Default model for backward compatibility
  private models: Map<GeminiModel, any> = new Map();
  private chatSessions: Map<string, ChatSession> = new Map();
  private responseCache: Map<string, GeminiInsight> = new Map();
  private cacheTimeout = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    this.genAI = new GoogleGenerativeAI(GEMINI_CONFIG.apiKey);
    this.initializeModels();
  }

  static getInstance(): GeminiAIService {
    if (!GeminiAIService.instance) {
      GeminiAIService.instance = new GeminiAIService();
    }
    return GeminiAIService.instance;
  }

  /**
   * Initialize Gemini models
   */
  private initializeModels(): void {
    try {
      // Initialize text model
      this.models.set(
        GeminiModel.PRO,
        this.genAI.getGenerativeModel({
          model: GeminiModel.PRO,
          ...GEMINI_CONFIG
        })
      );

      // Initialize vision model
      this.models.set(
        GeminiModel.PRO_VISION,
        this.genAI.getGenerativeModel({
          model: GeminiModel.PRO_VISION,
          ...GEMINI_CONFIG
        })
      );

      // Initialize latest Pro model
      this.models.set(
        GeminiModel.PRO_1_5,
        this.genAI.getGenerativeModel({
          model: GeminiModel.PRO_1_5,
          ...GEMINI_CONFIG
        })
      );

      // Initialize Flash model for fast responses
      this.models.set(
        GeminiModel.FLASH,
        this.genAI.getGenerativeModel({
          model: GeminiModel.FLASH,
          generationConfig: {
            ...GEMINI_CONFIG.generationConfig,
            temperature: 0.5,  // More focused for quick responses
            maxOutputTokens: 1024
          }
        })
      );

      // Set default model for backward compatibility
      this.model = this.models.get(GeminiModel.PRO);

      logger.info('Gemini AI models initialized successfully');
    } catch (error) {
      logger.error('Failed to initialize Gemini models:', error);
    }
  }

  /**
   * Get lineup advice using natural language
   */
  async getLineupAdvice(
    question: string,
    context: FantasyContext,
    options?: {
      detailed?: boolean;
      model?: GeminiModel;
    }
  ): Promise<GeminiInsight> {
    const startTime = Date.now();

    try {
      // Check cache
      const cacheKey = this.generateCacheKey('lineup', question, context);
      const cached = this.getCachedResponse(cacheKey);
      if (cached) return cached;

      // Build context prompt
      const contextPrompt = this.buildContextPrompt(context);
      const fullPrompt = `${SYSTEM_PROMPTS.lineup}\n\nContext:\n${contextPrompt}\n\nUser Question: ${question}`;

      // Get model
      const model = this.models.get(options?.model || GeminiModel.PRO_1_5);
      if (!model) throw new Error('Model not initialized');

      // Generate response
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      // Parse and structure response
      const insight = this.parseLineupResponse(text, context);

      // Cache response
      this.cacheResponse(cacheKey, insight);

      // Track analytics
      ga4Service.trackEvent('gemini_lineup_advice', {
        sport: context.sport,
        response_time: Date.now() - startTime,
        model_used: options?.model || GeminiModel.PRO_1_5,
        question_length: question.length
      });

      return insight;

    } catch (error) {
      logger.error('Failed to get lineup advice:', error);
      throw error;
    }
  }

  /**
   * Analyze injury impact
   */
  async analyzeInjuryImpact(
    player: PlayerStats,
    injury: InjuryReport,
    context: FantasyContext
  ): Promise<GeminiInsight> {
    try {
      const prompt = `${SYSTEM_PROMPTS.injury}
        
        Player: ${player.name} (${player.position}, ${player.team})
        Injury: ${injury.status} - ${injury.description}
        Recent Performance: ${player.recentForm?.join(', ') || 'N/A'}
        Average Points: ${player.averagePoints || player.projectedPoints}
        
        Analyze the fantasy impact of this injury and provide recommendations.`;

      const model = this.models.get(GeminiModel.PRO);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return this.parseInjuryResponse(text, player, injury);

    } catch (error) {
      logger.error('Failed to analyze injury impact:', error);
      throw error;
    }
  }

  /**
   * Analyze weather impact
   */
  async analyzeWeatherImpact(
    matchup: Matchup,
    weather: WeatherCondition,
    context: FantasyContext
  ): Promise<GeminiInsight> {
    try {
      const prompt = `${SYSTEM_PROMPTS.weather}
        
        Game: ${matchup.awayTeam} @ ${matchup.homeTeam}
        Venue: ${matchup.venue}
        Weather: ${weather.temperature}°F, Wind: ${weather.windSpeed}mph, 
                 Precipitation: ${weather.precipitation}%, ${weather.condition}
        
        How will these weather conditions impact fantasy scoring for this game?`;

      const model = this.models.get(GeminiModel.PRO);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return this.parseWeatherResponse(text, matchup, weather);

    } catch (error) {
      logger.error('Failed to analyze weather impact:', error);
      throw error;
    }
  }

  /**
   * Multi-modal analysis with images
   */
  async analyzeWithImage(
    prompt: string,
    imageData: string | Uint8Array,
    context?: FantasyContext
  ): Promise<GeminiInsight> {
    try {
      const model = this.models.get(GeminiModel.PRO_VISION);
      if (!model) throw new Error('Vision model not initialized');

      // Prepare image
      const image = {
        inlineData: {
          data: typeof imageData === 'string' ? imageData : Buffer.from(imageData).toString('base64'),
          mimeType: 'image/jpeg'
        }
      };

      // Build full prompt
      const contextPrompt = context ? this.buildContextPrompt(context) : '';
      const fullPrompt = `Analyze this image in the context of fantasy sports.
        ${contextPrompt}
        
        User request: ${prompt}`;

      // Generate response
      const result = await model.generateContent([fullPrompt, image]);
      const text = result.response.text();

      return {
        type: 'general',
        confidence: 0.85,
        insight: text,
        reasoning: ['Visual analysis completed'],
        recommendations: this.extractRecommendations(text),
        dataPoints: {},
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Failed to analyze with image:', error);
      throw error;
    }
  }

  /**
   * Analyze intent for voice commands
   */
  async analyzeIntent(
    text: string,
    context: any
  ): Promise<{
    intent: string;
    confidence: number;
    entities: Record<string, any>;
  }> {
    const prompt = `Analyze this fantasy football voice command and determine the intent:
    
    Command: "${text}"
    Context: Week ${context.week} of the NFL season
    
    Possible intents:
    - PLAYER_ANALYSIS (asking about a specific player)
    - LINEUP_OPTIMIZATION (wants lineup help)
    - TRADE_ANALYSIS (asking about trades)
    - WAIVER_WIRE (looking for player pickups)
    - INJURY_UPDATE (asking about injuries)
    - MATCHUP_ANALYSIS (asking about matchups)
    - GENERAL_ADVICE (general fantasy questions)
    
    Extract any player names, positions, or other entities mentioned.
    
    Respond in JSON format:
    {
      "intent": "INTENT_NAME",
      "confidence": 0.0-1.0,
      "entities": {
        "playerName": "name if mentioned",
        "position": "position if mentioned",
        "other": "any other relevant entities"
      }
    }`;

    try {
      const model = this.models.get(GeminiModel.FLASH); // Use fast model for intent
      const result = await model.generateContent(prompt);
      const response = result.response.text();
      
      // Parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
      
      // Fallback
      return {
        intent: 'GENERAL_ADVICE',
        confidence: 0.5,
        entities: {}
      };
    } catch (error) {
      logger.error('Gemini intent analysis error:', error);
      throw error;
    }
  }

  /**
   * Get lineup advice with enhanced response
   */
  async getLineupAdvice(
    question: string,
    context: FantasyContext,
    options?: {
      detailed?: boolean;
      model?: GeminiModel;
    }
  ): Promise<{
    advice: string;
    data?: any;
    playerRecommendations?: Array<{
      name: string;
      action: string;
      confidence: number;
    }>;
    followUpQuestions?: string[];
  }> {
    const startTime = Date.now();

    try {
      // Check cache
      const cacheKey = this.generateCacheKey('lineup', question, context);
      const cached = this.getCachedResponse(cacheKey);
      if (cached) {
        return {
          advice: cached.insight,
          data: cached.dataPoints,
          playerRecommendations: this.extractPlayerRecommendations(cached.recommendations),
          followUpQuestions: this.generateFollowUpQuestions(cached.type, context)
        };
      }

      // Build context prompt
      const contextPrompt = this.buildContextPrompt(context);
      const fullPrompt = `${SYSTEM_PROMPTS.lineup}\n\nContext:\n${contextPrompt}\n\nUser Question: ${question}
      
      Provide specific advice that includes:
      1. Direct answer to the question
      2. Player recommendations with confidence levels
      3. Data-driven reasoning
      4. Follow-up considerations`;

      // Get model
      const model = this.models.get(options?.model || GeminiModel.PRO_1_5);
      if (!model) throw new Error('Model not initialized');

      // Generate response
      const result = await model.generateContent(fullPrompt);
      const response = result.response;
      const text = response.text();

      // Parse and structure response
      const insight = this.parseLineupResponse(text, context);

      // Cache response
      this.cacheResponse(cacheKey, insight);

      // Track analytics
      ga4Service.trackEvent('gemini_lineup_advice', {
        sport: context.sport,
        response_time: Date.now() - startTime,
        model_used: options?.model || GeminiModel.PRO_1_5,
        question_length: question.length
      });

      return {
        advice: insight.insight,
        data: insight.dataPoints,
        playerRecommendations: this.extractPlayerRecommendations(insight.recommendations),
        followUpQuestions: this.generateFollowUpQuestions(insight.type, context)
      };

    } catch (error) {
      logger.error('Failed to get lineup advice:', error);
      throw error;
    }
  }

  /**
   * Extract player recommendations from text
   */
  private extractPlayerRecommendations(recommendations: string[]): Array<{
    name: string;
    action: string;
    confidence: number;
  }> {
    const playerRecs: Array<{ name: string; action: string; confidence: number }> = [];
    
    recommendations.forEach(rec => {
      // Look for player names (capitalized words)
      const playerMatch = rec.match(/([A-Z][a-z]+ [A-Z][a-z]+)/);
      if (playerMatch) {
        const action = rec.toLowerCase().includes('start') ? 'start' :
                      rec.toLowerCase().includes('bench') ? 'bench' :
                      rec.toLowerCase().includes('add') ? 'add' :
                      rec.toLowerCase().includes('drop') ? 'drop' : 'consider';
        
        const confidence = rec.toLowerCase().includes('definitely') ? 0.9 :
                          rec.toLowerCase().includes('strongly') ? 0.85 :
                          rec.toLowerCase().includes('likely') ? 0.7 :
                          rec.toLowerCase().includes('maybe') ? 0.5 : 0.75;
        
        playerRecs.push({
          name: playerMatch[1],
          action,
          confidence
        });
      }
    });
    
    return playerRecs;
  }

  /**
   * Generate follow-up questions
   */
  private generateFollowUpQuestions(type: string, context: FantasyContext): string[] {
    const baseQuestions = [
      'Who should I start this week?',
      'Show me the best waiver wire pickups',
      'Optimize my lineup for this week'
    ];
    
    switch (type) {
      case 'lineup':
        return [
          'What about my bench players?',
          'Should I make any trades?',
          'How does weather affect my lineup?',
          ...baseQuestions.slice(1)
        ];
      case 'player':
        return [
          'Compare to other players at this position',
          'What\'s the injury risk?',
          'Show me historical performance',
          ...baseQuestions
        ];
      case 'injury':
        return [
          'Who should I pick up as a replacement?',
          'What\'s the timeline for return?',
          'How does this affect my playoff chances?',
          ...baseQuestions
        ];
      default:
        return baseQuestions;
    }
  }

  /**
   * Start or continue chat session
   */
  async chat(
    userId: string,
    message: string,
    sessionId?: string,
    context?: FantasyContext
  ): Promise<{ response: string; sessionId: string }> {
    try {
      // Get or create session
      let session: ChatSession;
      if (sessionId && this.chatSessions.has(sessionId)) {
        session = this.chatSessions.get(sessionId)!;
        session.lastActive = new Date();
      } else {
        session = {
          sessionId: crypto.randomUUID(),
          userId,
          messages: [],
          context: context || { sport: 'nfl' },
          createdAt: new Date(),
          lastActive: new Date()
        };
        this.chatSessions.set(session.sessionId, session);
      }

      // Add user message
      session.messages.push({
        role: 'user',
        content: message,
        timestamp: new Date()
      });

      // Build conversation history
      const history = session.messages.map(msg => 
        `${msg.role === 'user' ? 'User' : 'Assistant'}: ${msg.content}`
      ).join('\n\n');

      // Generate response
      const model = this.models.get(GeminiModel.FLASH); // Use fast model for chat
      const prompt = `You are a helpful fantasy sports assistant. 
        Previous conversation:
        ${history}
        
        Context: ${JSON.stringify(session.context)}
        
        Respond naturally and helpfully to the user's latest message.`;

      const result = await model.generateContent(prompt);
      const response = result.response.text();

      // Add assistant message
      session.messages.push({
        role: 'assistant',
        content: response,
        timestamp: new Date()
      });

      // Persist session if user is authenticated
      if (userId !== 'anonymous') {
        await this.persistChatSession(session);
      }

      // Track analytics
      ga4Service.trackEvent('gemini_chat_interaction', {
        session_id: session.sessionId,
        message_count: session.messages.length,
        sport: session.context.sport
      });

      return {
        response,
        sessionId: session.sessionId
      };

    } catch (error) {
      logger.error('Chat error:', error);
      throw error;
    }
  }

  /**
   * Get DFS strategy recommendations
   */
  async getDFSStrategy(
    contestType: 'gpp' | 'cash' | 'h2h',
    budget: number,
    context: FantasyContext
  ): Promise<GeminiInsight> {
    try {
      const prompt = `${SYSTEM_PROMPTS.strategy}
        
        Contest Type: ${contestType.toUpperCase()}
        Budget: $${budget}
        Sport: ${context.sport.toUpperCase()}
        Week: ${context.gameWeek || 'Current'}
        
        Provide specific DFS strategy recommendations for this contest type and budget.
        Include lineup construction tips, ownership leverage ideas, and risk management.`;

      const model = this.models.get(GeminiModel.PRO_1_5);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return this.parseStrategyResponse(text, contestType, budget);

    } catch (error) {
      logger.error('Failed to get DFS strategy:', error);
      throw error;
    }
  }

  /**
   * Compare players using AI
   */
  async comparePlayers(
    players: PlayerStats[],
    criteria: string[],
    context: FantasyContext
  ): Promise<GeminiInsight> {
    try {
      const playerDetails = players.map(p => 
        `${p.name} (${p.position}, ${p.team}): $${p.salary}, Proj: ${p.projectedPoints}pts`
      ).join('\n');

      const prompt = `Compare these players for fantasy purposes:
        ${playerDetails}
        
        Evaluation criteria: ${criteria.join(', ')}
        Sport: ${context.sport.toUpperCase()}
        
        Provide a detailed comparison with clear recommendations on which player(s) to roster.`;

      const model = this.models.get(GeminiModel.PRO);
      const result = await model.generateContent(prompt);
      const text = result.response.text();

      return {
        type: 'player',
        confidence: 0.8,
        insight: text,
        reasoning: this.extractReasoningPoints(text),
        recommendations: this.extractRecommendations(text),
        dataPoints: {
          players: players.map(p => p.name),
          criteria
        },
        timestamp: new Date()
      };

    } catch (error) {
      logger.error('Failed to compare players:', error);
      throw error;
    }
  }

  /**
   * Build context prompt
   */
  private buildContextPrompt(context: FantasyContext): string {
    const parts: string[] = [];

    parts.push(`Sport: ${context.sport.toUpperCase()}`);
    
    if (context.gameWeek) {
      parts.push(`Week: ${context.gameWeek}`);
    }

    if (context.lineup && context.lineup.length > 0) {
      const lineupStr = context.lineup.map(p => 
        `${p.position}: ${p.name} ($${p.salary}, ${p.projectedPoints}pts)`
      ).join('\n');
      parts.push(`Current Lineup:\n${lineupStr}`);
    }

    if (context.injuries && context.injuries.length > 0) {
      const injuryStr = context.injuries.map(i => 
        `${i.playerId}: ${i.status} - ${i.description}`
      ).join('\n');
      parts.push(`Injuries:\n${injuryStr}`);
    }

    if (context.weather && context.weather.length > 0) {
      const weatherStr = context.weather.map(w => 
        `Game ${w.gameId}: ${w.temperature}°F, Wind: ${w.windSpeed}mph`
      ).join('\n');
      parts.push(`Weather:\n${weatherStr}`);
    }

    return parts.join('\n\n');
  }

  /**
   * Parse lineup response
   */
  private parseLineupResponse(text: string, context: FantasyContext): GeminiInsight {
    return {
      type: 'lineup',
      confidence: this.extractConfidence(text),
      insight: this.extractMainInsight(text),
      reasoning: this.extractReasoningPoints(text),
      recommendations: this.extractRecommendations(text),
      dataPoints: {
        sport: context.sport,
        lineupSize: context.lineup?.length || 0
      },
      timestamp: new Date()
    };
  }

  /**
   * Parse injury response
   */
  private parseInjuryResponse(
    text: string, 
    player: PlayerStats, 
    injury: InjuryReport
  ): GeminiInsight {
    return {
      type: 'injury',
      confidence: this.extractConfidence(text),
      insight: this.extractMainInsight(text),
      reasoning: this.extractReasoningPoints(text),
      recommendations: this.extractRecommendations(text),
      dataPoints: {
        player: player.name,
        status: injury.status,
        projectedImpact: this.extractProjectedImpact(text)
      },
      timestamp: new Date()
    };
  }

  /**
   * Parse weather response
   */
  private parseWeatherResponse(
    text: string,
    matchup: Matchup,
    weather: WeatherCondition
  ): GeminiInsight {
    return {
      type: 'weather',
      confidence: this.extractConfidence(text),
      insight: this.extractMainInsight(text),
      reasoning: this.extractReasoningPoints(text),
      recommendations: this.extractRecommendations(text),
      dataPoints: {
        game: `${matchup.awayTeam} @ ${matchup.homeTeam}`,
        temperature: weather.temperature,
        windSpeed: weather.windSpeed
      },
      timestamp: new Date()
    };
  }

  /**
   * Parse strategy response
   */
  private parseStrategyResponse(
    text: string,
    contestType: string,
    budget: number
  ): GeminiInsight {
    return {
      type: 'strategy',
      confidence: 0.85,
      insight: this.extractMainInsight(text),
      reasoning: this.extractReasoningPoints(text),
      recommendations: this.extractRecommendations(text),
      dataPoints: {
        contestType,
        budget,
        strategies: this.extractStrategies(text)
      },
      timestamp: new Date()
    };
  }

  /**
   * Extract confidence from response
   */
  private extractConfidence(text: string): number {
    // Look for confidence indicators
    const highConfidence = /highly recommend|strongly suggest|definitely|certainly/i;
    const mediumConfidence = /recommend|suggest|likely|probably/i;
    const lowConfidence = /might|could|possibly|uncertain/i;

    if (highConfidence.test(text)) return 0.9;
    if (mediumConfidence.test(text)) return 0.7;
    if (lowConfidence.test(text)) return 0.5;
    return 0.75; // Default
  }

  /**
   * Extract main insight
   */
  private extractMainInsight(text: string): string {
    // Try to find the first substantive sentence
    const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 20);
    return sentences[0]?.trim() || text.substring(0, 200);
  }

  /**
   * Extract reasoning points
   */
  private extractReasoningPoints(text: string): string[] {
    const points: string[] = [];
    
    // Look for numbered lists
    const numberedMatches = text.match(/\d+\.\s+([^.!?]+)/g);
    if (numberedMatches) {
      points.push(...numberedMatches.map(m => m.replace(/^\d+\.\s+/, '')));
    }

    // Look for bullet points
    const bulletMatches = text.match(/[•\-\*]\s+([^.!?]+)/g);
    if (bulletMatches) {
      points.push(...bulletMatches.map(m => m.replace(/^[•\-\*]\s+/, '')));
    }

    // If no lists found, extract key sentences
    if (points.length === 0) {
      const sentences = text.split(/[.!?]+/)
        .filter(s => s.length > 30 && /because|since|due to|given|considering/i.test(s))
        .slice(0, 3);
      points.push(...sentences.map(s => s.trim()));
    }

    return points;
  }

  /**
   * Extract recommendations
   */
  private extractRecommendations(text: string): string[] {
    const recommendations: string[] = [];
    
    // Look for recommendation patterns
    const patterns = [
      /recommend[^.!?]+/gi,
      /suggest[^.!?]+/gi,
      /should[^.!?]+/gi,
      /consider[^.!?]+/gi,
      /advise[^.!?]+/gi
    ];

    patterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        recommendations.push(...matches.map(m => m.trim()));
      }
    });

    return [...new Set(recommendations)].slice(0, 5); // Unique, max 5
  }

  /**
   * Extract projected impact
   */
  private extractProjectedImpact(text: string): number {
    // Look for percentage mentions
    const percentMatch = text.match(/(\d+)%/);
    if (percentMatch) {
      return parseInt(percentMatch[1]) / 100;
    }

    // Look for point mentions
    const pointMatch = text.match(/(\d+(?:\.\d+)?)\s*points?/i);
    if (pointMatch) {
      return parseFloat(pointMatch[1]);
    }

    return 0;
  }

  /**
   * Extract strategies
   */
  private extractStrategies(text: string): string[] {
    const strategies: string[] = [];
    
    // Look for strategy keywords
    const strategyPatterns = [
      /stack[^.!?]+/gi,
      /leverage[^.!?]+/gi,
      /fade[^.!?]+/gi,
      /target[^.!?]+/gi,
      /avoid[^.!?]+/gi
    ];

    strategyPatterns.forEach(pattern => {
      const matches = text.match(pattern);
      if (matches) {
        strategies.push(...matches.map(m => m.trim()));
      }
    });

    return [...new Set(strategies)].slice(0, 7);
  }

  /**
   * Generate cache key
   */
  private generateCacheKey(type: string, input: string, context: any): string {
    const contextStr = JSON.stringify(context);
    return `${type}:${input}:${contextStr}`.substring(0, 100);
  }

  /**
   * Get cached response
   */
  private getCachedResponse(key: string): GeminiInsight | null {
    const cached = this.responseCache.get(key);
    if (cached && Date.now() - cached.timestamp.getTime() < this.cacheTimeout) {
      return cached;
    }
    return null;
  }

  /**
   * Cache response
   */
  private cacheResponse(key: string, response: GeminiInsight): void {
    this.responseCache.set(key, response);
    
    // Clean old cache entries
    if (this.responseCache.size > 100) {
      const entries = Array.from(this.responseCache.entries());
      entries.sort((a, b) => a[1].timestamp.getTime() - b[1].timestamp.getTime());
      entries.slice(0, 50).forEach(([k]) => this.responseCache.delete(k));
    }
  }

  /**
   * Persist chat session
   */
  private async persistChatSession(session: ChatSession): Promise<void> {
    try {
      const { error } = await supabase
        .from('ai_chat_sessions')
        .upsert({
          session_id: session.sessionId,
          user_id: session.userId,
          messages: session.messages,
          context: session.context,
          created_at: session.createdAt.toISOString(),
          last_active: session.lastActive.toISOString()
        }, {
          onConflict: 'session_id'
        });

      if (error) throw error;
    } catch (error) {
      logger.error('Failed to persist chat session:', error);
    }
  }

  /**
   * Load chat session
   */
  async loadChatSession(sessionId: string): Promise<ChatSession | null> {
    try {
      const { data, error } = await supabase
        .from('ai_chat_sessions')
        .select('*')
        .eq('session_id', sessionId)
        .single();

      if (error) throw error;
      if (!data) return null;

      const session: ChatSession = {
        sessionId: data.session_id,
        userId: data.user_id,
        messages: data.messages,
        context: data.context,
        createdAt: new Date(data.created_at),
        lastActive: new Date(data.last_active)
      };

      this.chatSessions.set(sessionId, session);
      return session;

    } catch (error) {
      logger.error('Failed to load chat session:', error);
      return null;
    }
  }

  /**
   * Clear old sessions
   */
  clearOldSessions(): void {
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    for (const [sessionId, session] of this.chatSessions.entries()) {
      if (session.lastActive.getTime() < oneHourAgo) {
        this.chatSessions.delete(sessionId);
      }
    }
  }
}

// Export singleton instance
export const geminiService = GeminiAIService.getInstance();
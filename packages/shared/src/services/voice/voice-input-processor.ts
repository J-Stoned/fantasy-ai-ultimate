import { Player, SportType } from '../../types';

// 2025 Best Practice: Advanced NLP for voice queries
export interface VoiceQuery {
  raw: string;
  normalized: string;
  intent: QueryIntent;
  entities: ExtractedEntity[];
  confidence: number;
  context: ConversationContext;
  timestamp: Date;
}

export interface QueryIntent {
  type: IntentType;
  subType?: string;
  confidence: number;
  requiresML: boolean;
}

export type IntentType = 
  | 'PLAYER_ANALYSIS'
  | 'LINEUP_OPTIMIZATION'
  | 'TRADE_EVALUATION'
  | 'INJURY_IMPACT'
  | 'WEATHER_CHECK'
  | 'PREDICTION'
  | 'COMPARISON'
  | 'NAVIGATION'
  | 'SETTINGS'
  | 'GENERAL';

export interface ExtractedEntity {
  type: EntityType;
  value: string;
  normalized: string;
  confidence: number;
  metadata?: Record<string, any>;
}

export type EntityType = 
  | 'PLAYER'
  | 'TEAM'
  | 'POSITION'
  | 'STAT'
  | 'TIMEFRAME'
  | 'CONTEST'
  | 'NUMBER'
  | 'COMPARISON_OP';

export interface ConversationContext {
  sessionId: string;
  previousQueries: VoiceQuery[];
  currentLeague?: string;
  currentSport?: SportType;
  userPreferences: UserVoicePreferences;
}

export interface UserVoicePreferences {
  favoriteTeams: string[];
  favoritePlayers: string[];
  defaultSport: SportType;
  responseStyle: 'concise' | 'detailed' | 'analytical';
}

// 2025: Pattern-based NLP with ML enhancement
export class VoiceInputProcessor {
  private patterns = {
    playerAnalysis: [
      /(?:how|what)(?:'s|s| is) (.+?)(?:'s|s)? (?:doing|performing|looking|outlook|projection)/i,
      /(?:tell me about|analyze|evaluate|assess) (.+)/i,
      /(.+) (?:stats|statistics|performance|numbers)/i
    ],
    lineupOptimization: [
      /(?:optimize|best|optimal|perfect) (?:my )?(lineup|roster|team)/i,
      /who (?:should i|do i) (?:start|play|sit|bench)/i,
      /(?:build|create|make) (?:me )?(?:a |the )?(?:best |optimal )?lineup/i
    ],
    tradeAnalysis: [
      /(?:should i|evaluate|analyze) (?:trade|trading) (.+?) (?:for|with) (.+)/i,
      /(?:is|would) (.+?) (?:for|with) (.+?) (?:a )?(?:good|fair) trade/i,
      /trade (?:value|analysis|evaluation) (?:for |of )?(.+)/i
    ],
    comparison: [
      /(?:compare|versus|vs|or) (.+?) (?:to|vs|versus|with|or) (.+)/i,
      /(.+?) or (.+?)(?:\?)?$/i,
      /(?:who's|whos|which is) better (.+?) or (.+)/i
    ],
    prediction: [
      /(?:predict|projection|forecast|expected) (?:for |of )?(.+)/i,
      /(?:how many|what) (?:points|yards|touchdowns) (?:will|for) (.+)/i,
      /(.+?) (?:ceiling|floor|range)/i
    ]
  };
  
  private entityPatterns = {
    timeframe: /(?:this |next )?(?:week|month|season|game|sunday|monday|thursday)/i,
    position: /\b(?:QB|RB|WR|TE|K|DST|DEF|PG|SG|SF|PF|C|SP|RP|1B|2B|3B|SS|OF|DH|G|D|F|LW|RW)\b/i,
    stat: /(?:points|yards|touchdowns|receptions|assists|rebounds|goals|saves|strikeouts)/i,
    number: /\d+(?:\.\d+)?/g
  };
  
  private conversationHistory: ConversationContext = {
    sessionId: '',
    previousQueries: [],
    userPreferences: {
      favoriteTeams: [],
      favoritePlayers: [],
      defaultSport: 'NFL',
      responseStyle: 'analytical'
    }
  };
  
  async processAudioStream(stream: MediaStream): Promise<VoiceQuery> {
    // Use Web Speech API for speech-to-text
    const transcription = await this.transcribeAudio(stream);
    return this.processText(transcription);
  }
  
  async processText(text: string): Promise<VoiceQuery> {
    const normalized = this.normalizeText(text);
    const intent = this.extractIntent(normalized);
    const entities = this.extractEntities(normalized);
    
    // Enhance with context
    const enhancedEntities = await this.enhanceEntitiesWithContext(entities);
    
    const query: VoiceQuery = {
      raw: text,
      normalized,
      intent,
      entities: enhancedEntities,
      confidence: this.calculateConfidence(intent, enhancedEntities),
      context: this.conversationHistory,
      timestamp: new Date()
    };
    
    // Update conversation history
    this.conversationHistory.previousQueries.push(query);
    if (this.conversationHistory.previousQueries.length > 10) {
      this.conversationHistory.previousQueries.shift();
    }
    
    return query;
  }
  
  private async transcribeAudio(stream: MediaStream): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
        reject(new Error('Speech recognition not supported'));
        return;
      }
      
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      const recognition = new SpeechRecognition();
      
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';
      
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        resolve(transcript);
      };
      
      recognition.onerror = (event: any) => {
        reject(new Error(`Speech recognition error: ${event.error}`));
      };
      
      recognition.start();
      
      // Stop after 10 seconds max
      setTimeout(() => {
        recognition.stop();
      }, 10000);
    });
  }
  
  private normalizeText(text: string): string {
    return text
      .toLowerCase()
      .trim()
      .replace(/[''']/g, "'")
      .replace(/\s+/g, ' ')
      .replace(/[?!.]+$/, ''); // Remove trailing punctuation
  }
  
  private extractIntent(text: string): QueryIntent {
    let bestMatch: QueryIntent = {
      type: 'GENERAL',
      confidence: 0.5,
      requiresML: false
    };
    
    // Check each pattern category
    for (const [category, patterns] of Object.entries(this.patterns)) {
      for (const pattern of patterns) {
        if (pattern.test(text)) {
          const intentType = this.categoryToIntentType(category);
          bestMatch = {
            type: intentType,
            subType: category,
            confidence: 0.8 + (text.match(pattern)![0].length / text.length) * 0.2,
            requiresML: this.requiresML(intentType)
          };
          break;
        }
      }
    }
    
    return bestMatch;
  }
  
  private categoryToIntentType(category: string): IntentType {
    const mapping: Record<string, IntentType> = {
      playerAnalysis: 'PLAYER_ANALYSIS',
      lineupOptimization: 'LINEUP_OPTIMIZATION',
      tradeAnalysis: 'TRADE_EVALUATION',
      comparison: 'COMPARISON',
      prediction: 'PREDICTION'
    };
    
    return mapping[category] || 'GENERAL';
  }
  
  private requiresML(intent: IntentType): boolean {
    const mlRequired: IntentType[] = [
      'PLAYER_ANALYSIS',
      'LINEUP_OPTIMIZATION',
      'TRADE_EVALUATION',
      'PREDICTION',
      'COMPARISON'
    ];
    
    return mlRequired.includes(intent);
  }
  
  private extractEntities(text: string): ExtractedEntity[] {
    const entities: ExtractedEntity[] = [];
    
    // Extract timeframe
    const timeframeMatch = text.match(this.entityPatterns.timeframe);
    if (timeframeMatch) {
      entities.push({
        type: 'TIMEFRAME',
        value: timeframeMatch[0],
        normalized: this.normalizeTimeframe(timeframeMatch[0]),
        confidence: 0.9
      });
    }
    
    // Extract positions
    const positions = text.match(new RegExp(this.entityPatterns.position, 'g'));
    if (positions) {
      positions.forEach(pos => {
        entities.push({
          type: 'POSITION',
          value: pos,
          normalized: pos.toUpperCase(),
          confidence: 0.95
        });
      });
    }
    
    // Extract stats
    const stats = text.match(new RegExp(this.entityPatterns.stat, 'g'));
    if (stats) {
      stats.forEach(stat => {
        entities.push({
          type: 'STAT',
          value: stat,
          normalized: this.normalizeStat(stat),
          confidence: 0.9
        });
      });
    }
    
    // Extract numbers
    const numbers = text.match(this.entityPatterns.number);
    if (numbers) {
      numbers.forEach(num => {
        entities.push({
          type: 'NUMBER',
          value: num,
          normalized: num,
          confidence: 1.0
        });
      });
    }
    
    // Extract potential player names (capitalized words)
    const playerPattern = /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)+\b/g;
    const potentialPlayers = text.match(playerPattern);
    if (potentialPlayers) {
      potentialPlayers.forEach(name => {
        entities.push({
          type: 'PLAYER',
          value: name,
          normalized: name,
          confidence: 0.7 // Lower confidence until verified
        });
      });
    }
    
    return entities;
  }
  
  private async enhanceEntitiesWithContext(
    entities: ExtractedEntity[]
  ): Promise<ExtractedEntity[]> {
    // TODO: Verify player names against database
    // TODO: Add player IDs and metadata
    // TODO: Resolve ambiguous references using context
    
    return entities;
  }
  
  private normalizeTimeframe(timeframe: string): string {
    const normalized = timeframe.toLowerCase().trim();
    
    if (normalized.includes('week')) return 'week';
    if (normalized.includes('season')) return 'season';
    if (normalized.includes('month')) return 'month';
    if (['sunday', 'monday', 'thursday'].some(day => normalized.includes(day))) {
      return 'game';
    }
    
    return normalized;
  }
  
  private normalizeStat(stat: string): string {
    const statMap: Record<string, string> = {
      'points': 'fantasy_points',
      'yards': 'total_yards',
      'touchdowns': 'touchdowns',
      'tds': 'touchdowns',
      'receptions': 'receptions',
      'catches': 'receptions',
      'assists': 'assists',
      'rebounds': 'rebounds',
      'goals': 'goals',
      'saves': 'saves',
      'strikeouts': 'strikeouts',
      'ks': 'strikeouts'
    };
    
    return statMap[stat.toLowerCase()] || stat.toLowerCase();
  }
  
  private calculateConfidence(
    intent: QueryIntent, 
    entities: ExtractedEntity[]
  ): number {
    let confidence = intent.confidence;
    
    // Boost confidence if we have high-confidence entities
    const avgEntityConfidence = entities.length > 0
      ? entities.reduce((sum, e) => sum + e.confidence, 0) / entities.length
      : 0.5;
    
    confidence = confidence * 0.7 + avgEntityConfidence * 0.3;
    
    // Reduce confidence if query is ambiguous
    if (entities.filter(e => e.type === 'PLAYER').length > 3) {
      confidence *= 0.8; // Too many players mentioned
    }
    
    return Math.min(confidence, 0.95);
  }
  
  updateContext(context: Partial<ConversationContext>) {
    this.conversationHistory = {
      ...this.conversationHistory,
      ...context
    };
  }
  
  clearContext() {
    this.conversationHistory.previousQueries = [];
  }
}
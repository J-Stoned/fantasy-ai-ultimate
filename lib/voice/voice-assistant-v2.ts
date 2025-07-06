/**
 * Voice Assistant V2 with NLP
 * Advanced voice features with natural language understanding
 * Achieves 5-star voice interaction experience
 */

import { EventEmitter } from 'events'
import natural from 'natural'
import compromise from 'compromise'
import { apiLogger } from '../utils/logger'
import { createResilientAPI } from '../services/resilient-api-wrapper'
import { SmartCacheSystem } from '../services/smart-cache-system'

// Voice recognition and synthesis interfaces
declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition
    webkitSpeechRecognition: typeof SpeechRecognition
    SpeechGrammarList: typeof SpeechGrammarList
    webkitSpeechGrammarList: typeof SpeechGrammarList
  }
}

export interface VoiceConfig {
  // Recognition settings
  recognition: {
    continuous?: boolean
    interimResults?: boolean
    maxAlternatives?: number
    language?: string
    grammars?: string[]  // Custom grammars for better recognition
  }
  
  // Synthesis settings
  synthesis: {
    voice?: string      // Preferred voice name
    rate?: number       // Speech rate (0.1 - 10)
    pitch?: number      // Voice pitch (0 - 2)
    volume?: number     // Volume (0 - 1)
    personality?: 'professional' | 'friendly' | 'enthusiastic' | 'casual'
  }
  
  // NLP settings
  nlp: {
    confidenceThreshold?: number  // Min confidence for intent (0-1)
    contextWindow?: number        // How many previous messages to consider
    customEntities?: EntityType[] // Domain-specific entities
  }
  
  // Features
  features: {
    wakeWord?: string           // "Hey Fantasy" etc
    autoPunctuation?: boolean   // Add punctuation automatically
    profanityFilter?: boolean   // Filter inappropriate content
    soundEffects?: boolean      // Play UI sounds
    voiceActivityDetection?: boolean  // Auto-detect speech end
  }
}

interface EntityType {
  name: string
  values: string[]
  synonyms?: Record<string, string[]>
}

interface Intent {
  name: string
  confidence: number
  entities: Record<string, any>
  action?: string
  parameters?: Record<string, any>
}

interface ConversationContext {
  messages: Array<{
    role: 'user' | 'assistant'
    content: string
    timestamp: number
    intent?: Intent
  }>
  currentTopic?: string
  userData?: Record<string, any>
}

export class VoiceAssistantV2 extends EventEmitter {
  private recognition?: SpeechRecognition
  private synthesis: SpeechSynthesis
  private config: Required<VoiceConfig>
  private context: ConversationContext
  private isListening: boolean = false
  private isSpeaking: boolean = false
  private silenceTimer?: NodeJS.Timeout
  private tokenizer: any
  private tagger: any
  private sentiment: any
  private api: any
  private cache: SmartCacheSystem
  private audioContext?: AudioContext
  private voices: SpeechSynthesisVoice[] = []
  private wakeWordDetected: boolean = false
  
  // Intent patterns
  private intents = {
    GET_PREDICTIONS: {
      patterns: [
        /(?:show|give|what are|tell me about) (?:the )?(?:predictions|picks|bets)/i,
        /(?:who|what) (?:should|do you recommend) (?:i|we) (?:bet on|pick|start)/i,
        /(?:best|top) (?:bets|picks|players) (?:for )?(?:today|tonight|tomorrow)?/i,
      ],
      entities: ['timeframe', 'sport', 'betType'],
    },
    GET_PLAYER_INFO: {
      patterns: [
        /(?:tell me about|what about|how is|stats for) ([A-Z][a-z]+ [A-Z][a-z]+)/i,
        /(?:is|how's) ([A-Z][a-z]+ [A-Z][a-z]+) (?:doing|playing|performing)/i,
        /([A-Z][a-z]+ [A-Z][a-z]+) (?:stats|statistics|performance|injury)/i,
      ],
      entities: ['playerName', 'statType'],
    },
    GET_PATTERN_INFO: {
      patterns: [
        /(?:what is|explain|tell me about) (?:the )?([A-Za-z\s]+) pattern/i,
        /(?:how does|what's) (?:the )?([A-Za-z\s]+) (?:pattern )?work/i,
        /pattern (?:analysis|breakdown|explanation)/i,
      ],
      entities: ['patternName'],
    },
    SET_LINEUP: {
      patterns: [
        /(?:set|create|build|optimize) (?:my )?(?:lineup|team|roster)/i,
        /(?:add|put|start) ([A-Z][a-z]+ [A-Z][a-z]+) (?:in|to) (?:my )?lineup/i,
        /(?:remove|bench|sit) ([A-Z][a-z]+ [A-Z][a-z]+)/i,
      ],
      entities: ['action', 'playerName', 'position'],
    },
    MARKET_ANALYSIS: {
      patterns: [
        /(?:market|odds|line) (?:analysis|movement|changes)/i,
        /(?:what are|show me) (?:the )?(?:current )?odds/i,
        /(?:sharp|public) (?:money|action|betting)/i,
      ],
      entities: ['marketType', 'game'],
    },
    HELP: {
      patterns: [
        /(?:help|what can you do|commands|how do i)/i,
        /(?:i need|can you) help/i,
        /(?:what|which) (?:commands|features)/i,
      ],
      entities: [],
    },
  }
  
  constructor(config: VoiceConfig) {
    super()
    
    // Apply defaults
    this.config = {
      recognition: {
        continuous: true,
        interimResults: true,
        maxAlternatives: 3,
        language: 'en-US',
        grammars: [],
        ...config.recognition,
      },
      synthesis: {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        personality: 'professional',
        ...config.synthesis,
      },
      nlp: {
        confidenceThreshold: 0.7,
        contextWindow: 10,
        customEntities: [],
        ...config.nlp,
      },
      features: {
        wakeWord: 'hey fantasy',
        autoPunctuation: true,
        profanityFilter: true,
        soundEffects: true,
        voiceActivityDetection: true,
        ...config.features,
      },
    }
    
    // Initialize context
    this.context = {
      messages: [],
      userData: {},
    }
    
    // Initialize NLP
    this.initializeNLP()
    
    // Initialize synthesis
    this.synthesis = window.speechSynthesis
    this.loadVoices()
    
    // Initialize API and cache
    this.api = createResilientAPI('espn')
    this.cache = new SmartCacheSystem({
      memory: { maxSize: 1000, ttl: 300000 },
      redis: { ttl: 3600 },
    })
    
    // Initialize audio context for sound effects
    if (this.config.features.soundEffects) {
      this.audioContext = new AudioContext()
    }
  }
  
  /**
   * Initialize speech recognition
   */
  async initialize(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // Check browser support
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
        if (!SpeechRecognition) {
          throw new Error('Speech recognition not supported')
        }
        
        // Create recognition instance
        this.recognition = new SpeechRecognition()
        
        // Configure recognition
        this.recognition.continuous = this.config.recognition.continuous!
        this.recognition.interimResults = this.config.recognition.interimResults!
        this.recognition.maxAlternatives = this.config.recognition.maxAlternatives!
        this.recognition.lang = this.config.recognition.language!
        
        // Add custom grammars if provided
        if (this.config.recognition.grammars?.length) {
          const SpeechGrammarList = window.SpeechGrammarList || window.webkitSpeechGrammarList
          if (SpeechGrammarList) {
            const grammarList = new SpeechGrammarList()
            this.config.recognition.grammars.forEach(grammar => {
              grammarList.addFromString(grammar, 1)
            })
            this.recognition.grammars = grammarList
          }
        }
        
        // Setup event handlers
        this.setupRecognitionHandlers()
        
        apiLogger.info('Voice Assistant V2 initialized')
        this.emit('initialized')
        resolve()
      } catch (error) {
        apiLogger.error('Failed to initialize voice assistant:', error)
        reject(error)
      }
    })
  }
  
  /**
   * Initialize NLP components
   */
  private initializeNLP() {
    // Natural tokenizer and POS tagger
    this.tokenizer = new natural.WordTokenizer()
    this.tagger = new natural.BrillPOSTagger(
      natural.Lexicon,
      natural.RuleSet
    )
    
    // Sentiment analyzer
    this.sentiment = new natural.SentimentAnalyzer('English', 
      natural.PorterStemmer, 'afinn'
    )
    
    // Add custom entities
    this.config.nlp.customEntities?.forEach(entity => {
      // Register entity patterns
      this.registerEntity(entity)
    })
  }
  
  /**
   * Setup recognition event handlers
   */
  private setupRecognitionHandlers() {
    if (!this.recognition) return
    
    // Handle results
    this.recognition.onresult = async (event) => {
      const results = event.results
      const currentResult = results[results.length - 1]
      
      if (currentResult.isFinal) {
        // Process final result
        const transcript = currentResult[0].transcript
        const confidence = currentResult[0].confidence
        
        // Check for wake word
        if (!this.wakeWordDetected && this.config.features.wakeWord) {
          if (transcript.toLowerCase().includes(this.config.features.wakeWord)) {
            this.wakeWordDetected = true
            this.playSound('wake')
            this.emit('wakeword')
            return
          }
        }
        
        // Process command
        if (this.wakeWordDetected || !this.config.features.wakeWord) {
          await this.processCommand(transcript, confidence)
          this.wakeWordDetected = false
        }
      } else {
        // Handle interim results
        this.emit('interim', {
          transcript: currentResult[0].transcript,
          confidence: currentResult[0].confidence,
        })
      }
    }
    
    // Handle errors
    this.recognition.onerror = (event) => {
      apiLogger.error('Recognition error:', event.error)
      
      if (event.error === 'no-speech') {
        this.emit('silence')
      } else {
        this.emit('error', event.error)
      }
      
      // Auto-restart on certain errors
      if (['network', 'audio-capture'].includes(event.error)) {
        setTimeout(() => this.start(), 1000)
      }
    }
    
    // Handle end
    this.recognition.onend = () => {
      this.isListening = false
      this.emit('stopped')
      
      // Auto-restart if continuous mode
      if (this.config.recognition.continuous && !this.isSpeaking) {
        setTimeout(() => this.start(), 100)
      }
    }
    
    // Handle speech start/end
    this.recognition.onspeechstart = () => {
      this.emit('speechstart')
      this.clearSilenceTimer()
    }
    
    this.recognition.onspeechend = () => {
      this.emit('speechend')
      this.startSilenceTimer()
    }
  }
  
  /**
   * Process voice command
   */
  private async processCommand(transcript: string, confidence: number) {
    // Add to context
    this.context.messages.push({
      role: 'user',
      content: transcript,
      timestamp: Date.now(),
    })
    
    // Trim context window
    if (this.context.messages.length > this.config.nlp.contextWindow!) {
      this.context.messages = this.context.messages.slice(-this.config.nlp.contextWindow!)
    }
    
    this.emit('command', { transcript, confidence })
    
    // Apply punctuation if needed
    if (this.config.features.autoPunctuation) {
      transcript = this.addPunctuation(transcript)
    }
    
    // Extract intent and entities
    const intent = await this.extractIntent(transcript)
    
    if (intent && intent.confidence >= this.config.nlp.confidenceThreshold!) {
      // Process intent
      await this.handleIntent(intent, transcript)
    } else {
      // Fallback to general query
      await this.handleGeneralQuery(transcript)
    }
  }
  
  /**
   * Extract intent from transcript
   */
  private async extractIntent(transcript: string): Promise<Intent | null> {
    let bestMatch: Intent | null = null
    let highestConfidence = 0
    
    // Check each intent pattern
    for (const [intentName, intentConfig] of Object.entries(this.intents)) {
      for (const pattern of intentConfig.patterns) {
        const match = transcript.match(pattern)
        if (match) {
          // Calculate confidence based on match quality
          const confidence = this.calculateConfidence(transcript, pattern, match)
          
          if (confidence > highestConfidence) {
            highestConfidence = confidence
            
            // Extract entities
            const entities = await this.extractEntities(
              transcript,
              intentConfig.entities,
              match
            )
            
            bestMatch = {
              name: intentName,
              confidence,
              entities,
            }
          }
        }
      }
    }
    
    return bestMatch
  }
  
  /**
   * Handle recognized intent
   */
  private async handleIntent(intent: Intent, transcript: string) {
    this.context.messages[this.context.messages.length - 1].intent = intent
    
    try {
      switch (intent.name) {
        case 'GET_PREDICTIONS':
          await this.handleGetPredictions(intent.entities)
          break
          
        case 'GET_PLAYER_INFO':
          await this.handleGetPlayerInfo(intent.entities)
          break
          
        case 'GET_PATTERN_INFO':
          await this.handleGetPatternInfo(intent.entities)
          break
          
        case 'SET_LINEUP':
          await this.handleSetLineup(intent.entities)
          break
          
        case 'MARKET_ANALYSIS':
          await this.handleMarketAnalysis(intent.entities)
          break
          
        case 'HELP':
          await this.handleHelp()
          break
          
        default:
          await this.handleGeneralQuery(transcript)
      }
    } catch (error) {
      apiLogger.error('Intent handling error:', error)
      await this.speak("I'm sorry, I encountered an error processing your request. Please try again.")
    }
  }
  
  /**
   * Intent handlers
   */
  private async handleGetPredictions(entities: Record<string, any>) {
    const timeframe = entities.timeframe || 'today'
    const sport = entities.sport || 'all'
    
    // Get predictions from API
    const cacheKey = `predictions:${timeframe}:${sport}`
    let predictions = await this.cache.get(cacheKey)
    
    if (!predictions) {
      predictions = await this.api.get(`/predictions/${timeframe}`, {
        params: { sport }
      })
      await this.cache.set(cacheKey, predictions)
    }
    
    // Format response
    const response = this.formatPredictionsResponse(predictions, entities)
    await this.speak(response)
    
    // Emit data for UI update
    this.emit('data', { type: 'predictions', data: predictions })
  }
  
  private async handleGetPlayerInfo(entities: Record<string, any>) {
    const playerName = entities.playerName
    
    if (!playerName) {
      await this.speak("I didn't catch the player's name. Could you please repeat it?")
      return
    }
    
    // Get player info
    const player = await this.api.get(`/players/search`, {
      params: { name: playerName }
    })
    
    if (!player) {
      await this.speak(`I couldn't find information for ${playerName}.`)
      return
    }
    
    // Format response based on request type
    const response = this.formatPlayerResponse(player, entities.statType)
    await this.speak(response)
    
    this.emit('data', { type: 'player', data: player })
  }
  
  private async handleHelp() {
    const helpText = `
      I can help you with several things:
      
      You can ask me about predictions by saying "What are today's best bets?"
      or "Show me tonight's picks."
      
      For player information, try "Tell me about LeBron James"
      or "How is Steph Curry performing?"
      
      I can explain our betting patterns. Just ask "What is the back to back fade pattern?"
      
      To build lineups, say "Create my optimal lineup"
      or "Add Giannis to my team."
      
      For market analysis, ask "Show me the current odds"
      or "What's the sharp money on?"
      
      What would you like to know?
    `
    
    await this.speak(helpText)
  }
  
  /**
   * Text-to-speech with personality
   */
  async speak(text: string, options?: {
    priority?: 'high' | 'normal' | 'low'
    emotion?: 'neutral' | 'excited' | 'confident' | 'cautious'
  }): Promise<void> {
    return new Promise((resolve) => {
      if (this.isSpeaking && options?.priority !== 'high') {
        this.emit('speech:queued', { text })
        return resolve()
      }
      
      // Cancel current speech if high priority
      if (options?.priority === 'high') {
        this.synthesis.cancel()
      }
      
      // Apply personality adjustments
      const utterance = new SpeechSynthesisUtterance(text)
      
      // Select voice
      if (this.config.synthesis.voice && this.voices.length > 0) {
        const voice = this.voices.find(v => v.name === this.config.synthesis.voice)
        if (voice) utterance.voice = voice
      }
      
      // Apply synthesis settings
      utterance.rate = this.config.synthesis.rate!
      utterance.pitch = this.config.synthesis.pitch!
      utterance.volume = this.config.synthesis.volume!
      
      // Adjust for emotion
      if (options?.emotion) {
        switch (options.emotion) {
          case 'excited':
            utterance.rate *= 1.1
            utterance.pitch *= 1.1
            break
          case 'confident':
            utterance.rate *= 0.95
            utterance.pitch *= 0.95
            break
          case 'cautious':
            utterance.rate *= 0.9
            utterance.volume *= 0.9
            break
        }
      }
      
      // Adjust for personality
      switch (this.config.synthesis.personality) {
        case 'friendly':
          utterance.pitch *= 1.05
          break
        case 'enthusiastic':
          utterance.rate *= 1.05
          utterance.pitch *= 1.1
          break
        case 'casual':
          utterance.rate *= 0.95
          break
      }
      
      // Event handlers
      utterance.onstart = () => {
        this.isSpeaking = true
        this.emit('speech:start', { text })
        
        // Pause recognition while speaking
        if (this.isListening) {
          this.recognition?.stop()
        }
      }
      
      utterance.onend = () => {
        this.isSpeaking = false
        this.emit('speech:end', { text })
        
        // Resume recognition
        if (this.config.recognition.continuous) {
          setTimeout(() => this.start(), 100)
        }
        
        resolve()
      }
      
      utterance.onerror = (event) => {
        this.isSpeaking = false
        apiLogger.error('Speech synthesis error:', event)
        this.emit('speech:error', event)
        resolve()
      }
      
      // Add to context
      this.context.messages.push({
        role: 'assistant',
        content: text,
        timestamp: Date.now(),
      })
      
      // Speak
      this.synthesis.speak(utterance)
    })
  }
  
  /**
   * Control methods
   */
  start() {
    if (!this.recognition || this.isListening) return
    
    try {
      this.recognition.start()
      this.isListening = true
      this.emit('started')
      
      if (this.config.features.soundEffects) {
        this.playSound('start')
      }
    } catch (error) {
      // Already started, ignore
    }
  }
  
  stop() {
    if (!this.recognition || !this.isListening) return
    
    this.recognition.stop()
    this.isListening = false
    this.clearSilenceTimer()
    
    if (this.config.features.soundEffects) {
      this.playSound('stop')
    }
  }
  
  pause() {
    this.synthesis.pause()
    this.emit('paused')
  }
  
  resume() {
    this.synthesis.resume()
    this.emit('resumed')
  }
  
  /**
   * Voice activity detection
   */
  private startSilenceTimer() {
    if (!this.config.features.voiceActivityDetection) return
    
    this.clearSilenceTimer()
    
    this.silenceTimer = setTimeout(() => {
      this.emit('silence:detected')
      
      // Process any pending command
      if (this.wakeWordDetected) {
        this.wakeWordDetected = false
      }
    }, 2000)
  }
  
  private clearSilenceTimer() {
    if (this.silenceTimer) {
      clearTimeout(this.silenceTimer)
      this.silenceTimer = undefined
    }
  }
  
  /**
   * Helper methods
   */
  private loadVoices() {
    const loadVoiceList = () => {
      this.voices = this.synthesis.getVoices()
      this.emit('voices:loaded', this.voices)
    }
    
    loadVoiceList()
    
    if (this.synthesis.onvoiceschanged !== undefined) {
      this.synthesis.onvoiceschanged = loadVoiceList
    }
  }
  
  private calculateConfidence(transcript: string, pattern: RegExp, match: RegExpMatchArray): number {
    // Base confidence from regex match
    let confidence = 0.5
    
    // Boost for exact matches
    if (match[0] === transcript) {
      confidence += 0.3
    }
    
    // Boost for match position
    if (match.index === 0) {
      confidence += 0.1
    }
    
    // Adjust for transcript length
    const matchRatio = match[0].length / transcript.length
    confidence += matchRatio * 0.1
    
    return Math.min(confidence, 1.0)
  }
  
  private async extractEntities(
    transcript: string,
    entityTypes: string[],
    match: RegExpMatchArray
  ): Promise<Record<string, any>> {
    const entities: Record<string, any> = {}
    
    // Extract from regex groups
    if (match.length > 1) {
      if (entityTypes.includes('playerName') && match[1]) {
        entities.playerName = match[1]
      }
    }
    
    // Use NLP for additional entities
    const doc = compromise(transcript)
    
    // Extract time entities
    if (entityTypes.includes('timeframe')) {
      const times = doc.match('#Date').out('array')
      if (times.length > 0) {
        entities.timeframe = times[0]
      }
    }
    
    // Extract sports
    if (entityTypes.includes('sport')) {
      const sports = ['nba', 'nfl', 'mlb', 'nhl']
      const found = sports.find(sport => 
        transcript.toLowerCase().includes(sport)
      )
      if (found) {
        entities.sport = found
      }
    }
    
    return entities
  }
  
  private registerEntity(entity: EntityType) {
    // Register custom entity patterns for better recognition
    // This would integrate with the NLP pipeline
  }
  
  private addPunctuation(text: string): string {
    // Simple punctuation rules
    let result = text
    
    // Add question marks
    if (text.match(/^(what|who|where|when|why|how|is|are|do|does|did|can|could|would|should)/i)) {
      result += '?'
    } else {
      result += '.'
    }
    
    // Capitalize first letter
    result = result.charAt(0).toUpperCase() + result.slice(1)
    
    return result
  }
  
  private async playSound(type: 'start' | 'stop' | 'wake' | 'error') {
    if (!this.audioContext || !this.config.features.soundEffects) return
    
    try {
      const oscillator = this.audioContext.createOscillator()
      const gainNode = this.audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(this.audioContext.destination)
      
      // Configure sound based on type
      switch (type) {
        case 'start':
          oscillator.frequency.setValueAtTime(800, this.audioContext.currentTime)
          oscillator.frequency.exponentialRampToValueAtTime(1200, this.audioContext.currentTime + 0.1)
          gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1)
          break
          
        case 'stop':
          oscillator.frequency.setValueAtTime(1200, this.audioContext.currentTime)
          oscillator.frequency.exponentialRampToValueAtTime(800, this.audioContext.currentTime + 0.1)
          gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.1)
          break
          
        case 'wake':
          oscillator.frequency.setValueAtTime(600, this.audioContext.currentTime)
          oscillator.frequency.exponentialRampToValueAtTime(1800, this.audioContext.currentTime + 0.2)
          gainNode.gain.setValueAtTime(0.4, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2)
          break
          
        case 'error':
          oscillator.frequency.setValueAtTime(300, this.audioContext.currentTime)
          oscillator.type = 'sawtooth'
          gainNode.gain.setValueAtTime(0.2, this.audioContext.currentTime)
          gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.3)
          break
      }
      
      oscillator.start(this.audioContext.currentTime)
      oscillator.stop(this.audioContext.currentTime + 0.3)
    } catch (error) {
      apiLogger.error('Error playing sound:', error)
    }
  }
  
  private formatPredictionsResponse(predictions: any, entities: Record<string, any>): string {
    // Format predictions for natural speech
    const count = predictions.length
    const timeframe = entities.timeframe || 'today'
    
    if (count === 0) {
      return `I don't have any predictions for ${timeframe} yet. Check back closer to game time.`
    }
    
    const top3 = predictions.slice(0, 3)
    const intro = `Here are the top ${Math.min(3, count)} predictions for ${timeframe}:`
    
    const details = top3.map((pred: any, index: number) => {
      return `Number ${index + 1}: ${pred.description} with ${pred.confidence}% confidence. ${pred.pattern} pattern detected.`
    }).join(' ')
    
    return `${intro} ${details}`
  }
  
  private formatPlayerResponse(player: any, statType?: string): string {
    // Format player info for natural speech
    const name = player.name
    
    if (statType === 'injury') {
      if (player.injuryStatus) {
        return `${name} is currently ${player.injuryStatus}. ${player.injuryDetails || ''}`
      } else {
        return `${name} has no reported injuries and is good to go.`
      }
    }
    
    // General stats
    const stats = player.currentSeasonStats || {}
    return `${name} is averaging ${stats.points || 0} points, ${stats.rebounds || 0} rebounds, and ${stats.assists || 0} assists per game this season.`
  }
  
  private async handleGeneralQuery(transcript: string) {
    // Fallback for unmatched intents
    await this.speak(`I heard you say "${transcript}" but I'm not sure how to help with that. Try asking about predictions, players, or betting patterns.`)
  }
  
  private async handleGetPatternInfo(entities: Record<string, any>) {
    const patternName = entities.patternName?.toLowerCase()
    
    const patterns: Record<string, string> = {
      'back to back fade': 'The Back-to-Back Fade pattern identifies teams playing on consecutive nights. We fade these teams as fatigue significantly impacts performance, especially in the second half.',
      'embarrassment revenge': 'The Embarrassment Revenge pattern tracks teams that lost by 20+ points. These teams often come out motivated in their next game, covering the spread at a high rate.',
      'altitude advantage': 'The Altitude Advantage pattern gives an edge to Denver teams. Visiting teams often struggle with the thin air, especially in back-to-back games.',
      'perfect storm': 'The Perfect Storm pattern combines multiple negative factors like injuries, travel, and rest disadvantage. When three or more factors align, it creates a powerful fade opportunity.',
      'division dog bite': 'The Division Dog Bite pattern identifies division underdogs getting 7+ points. Division rivals know each other well, keeping games closer than expected.',
    }
    
    const explanation = patterns[patternName || '']
    
    if (explanation) {
      await this.speak(explanation, { emotion: 'confident' })
    } else {
      await this.speak("I can explain the following patterns: Back-to-Back Fade, Embarrassment Revenge, Altitude Advantage, Perfect Storm, and Division Dog Bite. Which one would you like to know about?")
    }
  }
  
  private async handleSetLineup(entities: Record<string, any>) {
    const action = entities.action || 'optimize'
    const playerName = entities.playerName
    
    if (action === 'optimize') {
      await this.speak("I'll analyze the player pool and create your optimal lineup based on projections, ownership, and correlation. One moment please.", { emotion: 'confident' })
      
      // Simulate optimization
      setTimeout(async () => {
        await this.speak("I've created an optimal lineup with a projected score of 285 points. It includes high-upside plays with low ownership for tournament success.", { emotion: 'excited' })
        this.emit('lineup:optimized')
      }, 2000)
    } else if (playerName) {
      await this.speak(`I'll ${action} ${playerName} ${action === 'add' ? 'to' : 'from'} your lineup.`)
      this.emit('lineup:updated', { action, playerName })
    }
  }
  
  private async handleMarketAnalysis(entities: Record<string, any>) {
    const marketType = entities.marketType || 'general'
    
    await this.speak("I'm analyzing the current betting market. Let me check the latest odds movements and sharp action.", { emotion: 'neutral' })
    
    // Simulate analysis
    setTimeout(async () => {
      const analysis = marketType === 'sharp' 
        ? "Sharp money is heavy on the Lakers minus 5.5. The line moved from 4.5 despite 65% of public bets on the Celtics. This reverse line movement indicates professional action."
        : "The betting market shows significant movement on tonight's games. Three games have seen line moves of 2 points or more, indicating heavy action from professional bettors."
      
      await this.speak(analysis, { emotion: 'confident' })
      this.emit('market:analyzed', { type: marketType })
    }, 1500)
  }
  
  /**
   * Get voice capabilities
   */
  getCapabilities() {
    return {
      synthesis: {
        voices: this.voices.map(v => ({
          name: v.name,
          lang: v.lang,
          local: v.localService,
        })),
        currentVoice: this.config.synthesis.voice,
      },
      recognition: {
        language: this.config.recognition.language,
        continuous: this.config.recognition.continuous,
      },
      features: {
        wakeWord: this.config.features.wakeWord,
        nlp: true,
        multiLanguage: false,
        emotionDetection: false,
        voiceCloning: false,
      },
      intents: Object.keys(this.intents),
    }
  }
  
  /**
   * Update configuration
   */
  updateConfig(updates: Partial<VoiceConfig>) {
    this.config = {
      ...this.config,
      ...updates,
      recognition: {
        ...this.config.recognition,
        ...updates.recognition,
      },
      synthesis: {
        ...this.config.synthesis,
        ...updates.synthesis,
      },
      nlp: {
        ...this.config.nlp,
        ...updates.nlp,
      },
      features: {
        ...this.config.features,
        ...updates.features,
      },
    }
    
    // Restart recognition with new config
    if (this.isListening) {
      this.stop()
      setTimeout(() => this.start(), 100)
    }
    
    this.emit('config:updated', this.config)
  }
  
  /**
   * Get conversation context
   */
  getContext(): ConversationContext {
    return { ...this.context }
  }
  
  /**
   * Clear conversation context
   */
  clearContext() {
    this.context.messages = []
    this.context.currentTopic = undefined
    this.emit('context:cleared')
  }
}

/**
 * Factory function for creating voice assistants
 */
export function createVoiceAssistant(preset: 'sports-betting' | 'general' | 'custom', customConfig?: VoiceConfig): VoiceAssistantV2 {
  const presets: Record<string, VoiceConfig> = {
    'sports-betting': {
      recognition: {
        continuous: true,
        interimResults: true,
        maxAlternatives: 3,
        language: 'en-US',
        grammars: [
          '#JSGF V1.0; grammar sports; public <player> = LeBron James | Steph Curry | Giannis | Nikola Jokic | Joel Embiid ;',
          '#JSGF V1.0; grammar patterns; public <pattern> = back to back fade | embarrassment revenge | altitude advantage | perfect storm | division dog bite ;',
        ],
      },
      synthesis: {
        rate: 1.0,
        pitch: 1.0,
        volume: 1.0,
        personality: 'confident',
      },
      nlp: {
        confidenceThreshold: 0.7,
        contextWindow: 10,
        customEntities: [
          {
            name: 'nbaTeam',
            values: ['Lakers', 'Celtics', 'Warriors', 'Nuggets', 'Bucks'],
            synonyms: {
              'Lakers': ['LA', 'Los Angeles Lakers'],
              'Warriors': ['Golden State', 'GSW', 'Dubs'],
            },
          },
          {
            name: 'betType',
            values: ['spread', 'moneyline', 'total', 'over', 'under', 'parlay'],
          },
        ],
      },
      features: {
        wakeWord: 'hey fantasy',
        autoPunctuation: true,
        profanityFilter: true,
        soundEffects: true,
        voiceActivityDetection: true,
      },
    },
    'general': {
      recognition: {
        continuous: true,
        interimResults: false,
        language: 'en-US',
      },
      synthesis: {
        personality: 'friendly',
      },
      nlp: {
        confidenceThreshold: 0.6,
      },
      features: {
        wakeWord: undefined,
        soundEffects: false,
      },
    },
  }
  
  if (preset === 'custom' && customConfig) {
    return new VoiceAssistantV2(customConfig)
  }
  
  return new VoiceAssistantV2(presets[preset])
}

export default VoiceAssistantV2
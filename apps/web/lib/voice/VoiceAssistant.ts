import { ElevenLabsClient } from 'elevenlabs';
import { AgentOrchestrator } from '../ai/AgentOrchestrator';
import { AgentContext } from '../ai/agents/BaseAgent';
import { ConversationalMemory } from './ConversationalMemory';
import { mcpOrchestrator } from '../mcp/MCPOrchestrator';
import { defaultLogger } from '../utils/logger';

interface VoiceConfig {
  apiKey?: string;
  voiceId?: string;
  modelId?: string;
  stability?: number;
  similarityBoost?: number;
}

export class VoiceAssistant {
  private elevenLabs: ElevenLabsClient | null = null;
  private agentOrchestrator: AgentOrchestrator;
  private conversationalMemory: ConversationalMemory;
  private voiceId: string;
  private isListening: boolean = false;
  private recognition: any = null;
  private proactiveMode: boolean = true;
  private interruptionThreshold: number = 0.8;

  constructor(config: VoiceConfig = {}) {
    // Initialize ElevenLabs if API key provided
    if (config.apiKey || process.env.ELEVENLABS_API_KEY) {
      this.elevenLabs = new ElevenLabsClient({
        apiKey: config.apiKey || process.env.ELEVENLABS_API_KEY,
      });
    }

    this.voiceId = config.voiceId || 'EXAVITQu4vr4xnSDxMaL'; // Default voice
    this.agentOrchestrator = new AgentOrchestrator();
    this.conversationalMemory = new ConversationalMemory();
  }

  async initialize() {
    // Test ElevenLabs connection
    if (this.elevenLabs) {
      try {
        const voices = await this.elevenLabs.voices.getAll();
        defaultLogger.info('ElevenLabs connected', { availableVoices: voices.voices.length });
      } catch (error) {
        defaultLogger.error('ElevenLabs connection failed', error);
        this.elevenLabs = null;
      }
    }

    // Initialize speech recognition
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      
      defaultLogger.info('Speech recognition initialized');
    }
  }

  async processVoiceCommand(
    audioBuffer: ArrayBuffer | string,
    context: AgentContext & { sessionId?: string }
  ): Promise<{
    transcript: string;
    response: string;
    audioUrl?: string;
    proactiveInsights?: string[];
    nextQuestions?: string[];
  }> {
    try {
      // Initialize conversation context
      const sessionId = context.sessionId || `session-${Date.now()}`;
      let conversationContext;
      
      if (context.userId) {
        conversationContext = await this.conversationalMemory.initializeSession(
          context.userId,
          sessionId
        );
      }

      // Convert speech to text (if audio buffer provided)
      let transcript = '';
      if (typeof audioBuffer === 'string') {
        transcript = audioBuffer; // Text input
      } else {
        transcript = await this.speechToText(audioBuffer);
      }

      defaultLogger.info('Voice transcript received', { transcript });

      // Check for emotional triggers that might need interruption
      const urgency = await this.assessUrgency(transcript, context);
      
      // Process with AI agents
      const { agent, response } = await this.agentOrchestrator.processQuery(
        transcript,
        context
      );

      defaultLogger.info('Agent responded', { agent });

      // Adapt response based on conversation memory
      let adaptedResponse = response.message;
      if (conversationContext) {
        adaptedResponse = await this.conversationalMemory.adaptResponseStyle(
          sessionId,
          response.message
        );

        // Store interaction
        await this.conversationalMemory.addInteraction(
          sessionId,
          transcript,
          adaptedResponse,
          { agent, urgency }
        );
      }

      // Generate proactive insights
      const proactiveInsights = context.userId ? 
        await this.conversationalMemory.getProactiveInsights(context.userId) : [];

      // Predict next questions
      const nextQuestions = conversationContext ? 
        await this.conversationalMemory.predictNextQuestion(sessionId) : [];

      // Convert response to speech
      let audioUrl: string | undefined;
      if (this.elevenLabs && response.success) {
        audioUrl = await this.textToSpeech(adaptedResponse);
      }

      return {
        transcript,
        response: adaptedResponse,
        audioUrl,
        proactiveInsights: proactiveInsights.slice(0, 3),
        nextQuestions: nextQuestions.slice(0, 5),
      };
    } catch (error) {
      defaultLogger.error('Voice processing error', error);
      return {
        transcript: '',
        response: "I'm sorry, I couldn't process that request. Please try again.",
      };
    }
  }

  private async speechToText(audioBuffer: ArrayBuffer): Promise<string> {
    // In production, use a speech-to-text service like:
    // - Google Cloud Speech-to-Text
    // - Azure Speech Services
    // - OpenAI Whisper
    
    // For now, return placeholder
    return "What are my best waiver wire pickups?";
  }

  private async textToSpeech(text: string): Promise<string | undefined> {
    if (!this.elevenLabs) return undefined;

    try {
      // Clean text for speech (remove markdown, etc)
      const cleanText = this.cleanTextForSpeech(text);

      // Generate audio
      const audio = await this.elevenLabs.generate({
        voice: this.voiceId,
        text: cleanText,
        model_id: 'eleven_monolingual_v1',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.5,
        },
      });

      // Convert to blob URL
      const audioBlob = new Blob([audio], { type: 'audio/mpeg' });
      return URL.createObjectURL(audioBlob);
    } catch (error) {
      defaultLogger.error('Text-to-speech error', error);
      return undefined;
    }
  }

  private cleanTextForSpeech(text: string): string {
    // Remove markdown formatting
    let clean = text
      .replace(/\*\*/g, '') // Bold
      .replace(/\*/g, '')   // Italic
      .replace(/^#+\s/gm, '') // Headers
      .replace(/^\s*[-•]\s/gm, '') // Bullet points
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1'); // Links

    // Limit length for API
    if (clean.length > 500) {
      clean = clean.substring(0, 497) + '...';
    }

    return clean;
  }

  startListening(
    onTranscript: (transcript: string) => void,
    onEnd: () => void
  ) {
    if (!this.recognition) {
      defaultLogger.error('Speech recognition not available');
      return;
    }

    this.isListening = true;

    this.recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      
      if (event.results[last].isFinal) {
        onTranscript(transcript);
      }
    };

    this.recognition.onerror = (event: any) => {
      defaultLogger.error('Speech recognition error', { error: event.error });
      this.stopListening();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };

    this.recognition.start();
    defaultLogger.info('Listening for voice input');
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      defaultLogger.info('Stopped listening');
    }
  }

  async getAvailableVoices() {
    if (!this.elevenLabs) return [];

    try {
      const voices = await this.elevenLabs.voices.getAll();
      return voices.voices.map(v => ({
        id: v.voice_id,
        name: v.name,
        preview: v.preview_url,
        labels: v.labels,
      }));
    } catch (error) {
      defaultLogger.error('Failed to get voices', error);
      return [];
    }
  }

  setVoice(voiceId: string) {
    this.voiceId = voiceId;
  }

  // Enhanced wake word detection with context awareness
  async startWakeWordDetection(onWakeWord: () => void, userId?: string) {
    if (!this.recognition) return;

    const wakeWords = ['hey fantasy', 'okay fantasy', 'fantasy'];
    
    this.recognition.continuous = true;
    this.recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.toLowerCase();
      
      if (wakeWords.some(word => transcript.includes(word))) {
        defaultLogger.info('Wake word detected');
        this.recognition.stop();
        
        // Trigger with context if available
        if (userId) {
          this.handleProactiveWakeup(userId);
        }
        
        onWakeWord();
      }
    };

    this.recognition.start();
    defaultLogger.info('Listening for wake word');
  }

  // Proactive intelligence - morning briefings
  async generateMorningBriefing(userId: string): Promise<{
    message: string;
    audioUrl?: string;
    priority: 'low' | 'medium' | 'high';
  }> {
    defaultLogger.info('Generating morning briefing', { userId });

    const briefing = await this.conversationalMemory.generateMorningBriefing(userId);
    
    // Determine priority based on content
    let priority: 'low' | 'medium' | 'high' = 'low';
    if (briefing.includes('🚨')) {
      priority = 'high';
    } else if (briefing.includes('💎') || briefing.includes('📝')) {
      priority = 'medium';
    }

    // Generate audio
    let audioUrl: string | undefined;
    if (this.elevenLabs && priority !== 'low') {
      audioUrl = await this.textToSpeech(briefing);
    }

    return {
      message: briefing,
      audioUrl,
      priority,
    };
  }

  // Real-time interruptions for urgent news
  async handleBreakingNews(
    userId: string,
    news: { 
      headline: string; 
      severity: number; 
      playerId?: string; 
      impact: string;
    }
  ): Promise<boolean> {
    if (news.severity < this.interruptionThreshold) {
      return false; // Not urgent enough to interrupt
    }

    defaultLogger.info('Handling breaking news interruption');

    const urgentMessage = await this.generateUrgentAlert(news);
    
    // Check user preferences for interruptions
    const context = await this.conversationalMemory.getLatestContext(userId);
    if (!context?.preferences.notificationSettings.breakingNews) {
      return false;
    }

    // Generate immediate audio alert
    if (this.elevenLabs) {
      const audioUrl = await this.textToSpeech(urgentMessage);
      // Trigger push notification with audio
      await this.sendPushNotification(userId, urgentMessage, audioUrl);
    }

    return true;
  }

  // Multimodal integration - voice + gesture
  async processMultimodalCommand(
    audioInput: string,
    gestureData: any,
    contextData: any
  ): Promise<any> {
    defaultLogger.info('Processing multimodal command');

    // Combine voice and gesture input
    const combinedIntent = await this.fuseInterpretation(
      audioInput,
      gestureData,
      contextData
    );

    // Enhanced processing with gesture context
    return this.processVoiceCommand(audioInput, {
      ...contextData,
      gestureContext: gestureData,
      intent: combinedIntent,
    });
  }

  // Emotion detection and response adaptation
  async detectEmotionalState(
    audioBuffer: ArrayBuffer,
    userId: string
  ): Promise<{
    emotion: string;
    confidence: number;
    responseModifier: string;
  }> {
    // Analyze audio for emotional cues
    const emotionAnalysis = await mcpOrchestrator.executeByCapability(
      'ai',
      'callTool',
      {
        name: 'analyzeAudioEmotion',
        arguments: { audio: audioBuffer },
      }
    );

    const emotion = emotionAnalysis.result?.emotion || 'neutral';
    const confidence = emotionAnalysis.result?.confidence || 0.5;

    // Determine response modifier
    const responseModifier = this.getEmotionalResponseModifier(emotion, confidence);

    // Update user's emotional context
    await this.updateEmotionalContext(userId, emotion, confidence);

    return { emotion, confidence, responseModifier };
  }

  // Contextual suggestions based on conversation flow
  async generateContextualSuggestions(
    sessionId: string,
    currentResponse: string
  ): Promise<string[]> {
    const suggestions: string[] = [];

    // Get conversation context
    const context = await this.conversationalMemory.getLatestContext(sessionId);
    if (!context) return suggestions;

    // Generate relevant follow-up suggestions
    const followUps = await this.conversationalMemory.generateFollowUps(context);
    suggestions.push(...followUps);

    // Add contextual actions
    if (currentResponse.includes('player')) {
      suggestions.push("Tell me more about their matchup");
      suggestions.push("Show me similar players");
      suggestions.push("Add to my watch list");
    }

    if (currentResponse.includes('trade')) {
      suggestions.push("Analyze the trade value");
      suggestions.push("Find better alternatives");
      suggestions.push("Check league reactions");
    }

    return suggestions.slice(0, 5);
  }

  // Voice-controlled lineup management
  async processLineupCommand(
    command: string,
    userId: string,
    leagueId: string
  ): Promise<{
    action: string;
    result: any;
    confirmation: string;
  }> {
    defaultLogger.info('Processing lineup command');

    const intent = await this.parseLineupIntent(command);
    
    let result: any = {};
    let confirmation: string = '';

    switch (intent.action) {
      case 'set_lineup':
        result = await this.setLineup(userId, leagueId, intent.players);
        confirmation = `Lineup set with ${intent.players.length} players`;
        break;
        
      case 'add_player':
        result = await this.addToLineup(userId, leagueId, intent.playerId, intent.position);
        confirmation = `Added ${intent.playerName} to your lineup`;
        break;
        
      case 'remove_player':
        result = await this.removeFromLineup(userId, leagueId, intent.playerId);
        confirmation = `Removed ${intent.playerName} from your lineup`;
        break;
        
      case 'optimize_lineup':
        result = await this.optimizeLineup(userId, leagueId, intent.strategy);
        confirmation = `Optimized lineup using ${intent.strategy} strategy`;
        break;
    }

    return {
      action: intent.action,
      result,
      confirmation,
    };
  }

  // Private helper methods
  private async assessUrgency(transcript: string, context: any): Promise<number> {
    const urgentKeywords = [
      'injury', 'hurt', 'breaking', 'urgent', 'emergency', 
      'deadline', 'trade', 'waiver', 'claim'
    ];
    
    let urgency = 0;
    for (const keyword of urgentKeywords) {
      if (transcript.toLowerCase().includes(keyword)) {
        urgency += 0.2;
      }
    }

    return Math.min(urgency, 1);
  }

  private async handleProactiveWakeup(userId: string): Promise<void> {
    // Check for proactive insights when user says wake word
    const insights = await this.conversationalMemory.getProactiveInsights(userId);
    
    if (insights.length > 0) {
      const urgentInsights = insights.filter(i => i.includes('🚨'));
      if (urgentInsights.length > 0) {
        // Queue proactive message
        setTimeout(() => {
          this.deliverProactiveMessage(userId, urgentInsights[0]);
        }, 2000);
      }
    }
  }

  private async deliverProactiveMessage(userId: string, message: string): Promise<void> {
    if (this.elevenLabs) {
      const audioUrl = await this.textToSpeech(message);
      await this.sendPushNotification(userId, message, audioUrl);
    }
  }

  private async generateUrgentAlert(news: any): Promise<string> {
    return `🚨 Breaking: ${news.headline}. This ${news.impact} your lineup. What would you like to do?`;
  }

  private async sendPushNotification(
    userId: string,
    message: string,
    audioUrl?: string
  ): Promise<void> {
    await mcpOrchestrator.executeByCapability('notifications', 'callTool', {
      name: 'sendPushNotification',
      arguments: {
        userId,
        title: 'Hey Fantasy Alert',
        message,
        audioUrl,
        priority: 'high',
      },
    });
  }

  private async fuseInterpretation(
    audioInput: string,
    gestureData: any,
    contextData: any
  ): Promise<string> {
    // Combine voice and gesture for enhanced intent understanding
    let intent = 'general';
    
    if (gestureData.type === 'point' && audioInput.includes('this')) {
      intent = 'player_selection';
    } else if (gestureData.type === 'swipe' && audioInput.includes('next')) {
      intent = 'navigation';
    }
    
    return intent;
  }

  private getEmotionalResponseModifier(emotion: string, confidence: number): string {
    if (confidence < 0.5) return 'neutral';
    
    const modifiers: Record<string, string> = {
      frustrated: 'empathetic',
      excited: 'enthusiastic',
      confused: 'explanatory',
      sad: 'supportive',
      angry: 'calming',
    };
    
    return modifiers[emotion] || 'neutral';
  }

  private async updateEmotionalContext(
    userId: string,
    emotion: string,
    confidence: number
  ): Promise<void> {
    // Store emotional context for future interactions
    await this.conversationalMemory.rememberPreference(
      userId,
      'emotional_state',
      { emotion, confidence, timestamp: new Date() }
    );
  }

  private async parseLineupIntent(command: string): Promise<any> {
    const response = await mcpOrchestrator.executeByCapability('nlp', 'callTool', {
      name: 'parseLineupCommand',
      arguments: { command },
    });
    
    return response.result || { action: 'unknown' };
  }

  private async setLineup(userId: string, leagueId: string, players: any[]): Promise<any> {
    return mcpOrchestrator.executeByCapability('fantasy', 'callTool', {
      name: 'setLineup',
      arguments: { userId, leagueId, players },
    });
  }

  private async addToLineup(
    userId: string,
    leagueId: string,
    playerId: string,
    position: string
  ): Promise<any> {
    return mcpOrchestrator.executeByCapability('fantasy', 'callTool', {
      name: 'addPlayerToLineup',
      arguments: { userId, leagueId, playerId, position },
    });
  }

  private async removeFromLineup(
    userId: string,
    leagueId: string,
    playerId: string
  ): Promise<any> {
    return mcpOrchestrator.executeByCapability('fantasy', 'callTool', {
      name: 'removePlayerFromLineup',
      arguments: { userId, leagueId, playerId },
    });
  }

  private async optimizeLineup(
    userId: string,
    leagueId: string,
    strategy: string
  ): Promise<any> {
    return mcpOrchestrator.executeByCapability('ml', 'callTool', {
      name: 'optimizeLineup',
      arguments: { userId, leagueId, strategy },
    });
  }
}
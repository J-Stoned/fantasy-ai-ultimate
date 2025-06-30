/**
 * REVOLUTIONARY VOICE ASSISTANT WITH EMOTIONAL INTELLIGENCE
 * This isn't just voice control - it's a friend who understands fantasy football
 * 
 * By Marcus "The Fixer" Rodriguez
 */

import { StreamlinedMCPOrchestrator } from '../mcp/streamlined-orchestrator';

export interface VoiceConfig {
  elevenlabs?: {
    apiKey: string;
    voiceId?: string;
  };
  openai: {
    apiKey: string;
  };
}

export interface EmotionalContext {
  mood: 'excited' | 'frustrated' | 'anxious' | 'confident' | 'neutral';
  intensity: number; // 0-1
  context: string[];
}

export class VoiceAssistant {
  private orchestrator: StreamlinedMCPOrchestrator;
  private recognition: any;
  private synthesis: SpeechSynthesis;
  private isListening = false;
  private emotionalState: EmotionalContext = {
    mood: 'neutral',
    intensity: 0.5,
    context: []
  };
  private userHistory: Map<string, any> = new Map();
  
  constructor(private config: VoiceConfig) {
    this.orchestrator = new StreamlinedMCPOrchestrator({
      supabase: {
        url: process.env.NEXT_PUBLIC_SUPABASE_URL!,
        serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY!
      },
      redis: {
        url: process.env.REDIS_URL!
      },
      openai: {
        apiKey: config.openai.apiKey
      },
      mysportsfeeds: {
        apiKey: process.env.MYSPORTSFEEDS_API_KEY!,
        password: process.env.MYSPORTSFEEDS_PASSWORD!
      }
    });
    
    this.synthesis = window.speechSynthesis;
    this.initializeRecognition();
  }
  
  /**
   * Initialize speech recognition
   */
  private initializeRecognition() {
    if ('webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = true;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      
      this.recognition.onresult = this.handleSpeechResult.bind(this);
      this.recognition.onerror = this.handleSpeechError.bind(this);
      this.recognition.onend = () => {
        if (this.isListening) {
          this.recognition.start(); // Restart if still listening
        }
      };
    }
  }
  
  /**
   * Start listening for voice commands
   */
  startListening() {
    if (!this.recognition) {
      console.error('Speech recognition not supported');
      return;
    }
    
    this.isListening = true;
    this.recognition.start();
    this.speak("Hey there! I'm ready to help with your fantasy team. What's on your mind?", 'greeting');
  }
  
  /**
   * Stop listening
   */
  stopListening() {
    this.isListening = false;
    if (this.recognition) {
      this.recognition.stop();
    }
  }
  
  /**
   * Handle speech recognition results
   */
  private async handleSpeechResult(event: any) {
    const last = event.results.length - 1;
    const transcript = event.results[last][0].transcript.toLowerCase();
    const isFinal = event.results[last].isFinal;
    
    if (isFinal) {
      console.log('User said:', transcript);
      
      // Detect emotional context
      this.detectEmotion(transcript);
      
      // Process the command
      await this.processVoiceCommand(transcript);
    }
  }
  
  /**
   * Process voice commands with emotional intelligence
   */
  private async processVoiceCommand(transcript: string) {
    try {
      // Check for wake word
      if (transcript.includes('hey fantasy') || transcript.includes('fantasy')) {
        const command = transcript.replace(/hey fantasy|fantasy/gi, '').trim();
        
        // Detect intent
        const intent = await this.detectIntent(command);
        
        // Route to appropriate handler
        switch (intent.type) {
          case 'lineup':
            await this.handleLineupCommand(command, intent);
            break;
            
          case 'player':
            await this.handlePlayerCommand(command, intent);
            break;
            
          case 'trade':
            await this.handleTradeCommand(command, intent);
            break;
            
          case 'emotional_support':
            await this.handleEmotionalSupport(command);
            break;
            
          case 'analysis':
            await this.handleAnalysisCommand(command, intent);
            break;
            
          default:
            await this.handleGeneralQuery(command);
        }
      }
    } catch (error) {
      console.error('Voice command error:', error);
      this.speak("Sorry, I had trouble understanding that. Could you try again?", 'error');
    }
  }
  
  /**
   * Detect user's emotional state from speech
   */
  private detectEmotion(transcript: string) {
    const emotions = {
      frustrated: ['damn', 'shit', 'stupid', 'terrible', 'awful', 'hate', 'sucks', 'angry'],
      anxious: ['worried', 'nervous', 'scared', 'concerned', 'afraid', 'unsure', 'help'],
      excited: ['awesome', 'great', 'amazing', 'fantastic', 'love', 'perfect', 'yes!'],
      confident: ['sure', 'definitely', 'absolutely', 'certain', 'know', 'confident']
    };
    
    let detectedMood: EmotionalContext['mood'] = 'neutral';
    let maxScore = 0;
    
    for (const [mood, keywords] of Object.entries(emotions)) {
      const score = keywords.filter(word => transcript.includes(word)).length;
      if (score > maxScore) {
        maxScore = score;
        detectedMood = mood as EmotionalContext['mood'];
      }
    }
    
    // Update emotional context
    this.emotionalState = {
      mood: detectedMood,
      intensity: Math.min(1, maxScore * 0.3),
      context: [...this.emotionalState.context.slice(-4), transcript]
    };
  }
  
  /**
   * Detect command intent using AI
   */
  private async detectIntent(command: string): Promise<any> {
    const response = await this.orchestrator.handleRequest({
      type: 'ai',
      query: `Classify this fantasy football command into one of these intents: lineup, player, trade, emotional_support, analysis, general. Command: "${command}". Return JSON with type and entities.`,
      context: { parseIntent: true }
    });
    
    try {
      return JSON.parse(response.response);
    } catch {
      // Fallback intent detection
      if (command.includes('lineup') || command.includes('start') || command.includes('bench')) {
        return { type: 'lineup', entities: {} };
      }
      if (command.includes('player') || command.includes('stats')) {
        return { type: 'player', entities: {} };
      }
      if (command.includes('trade')) {
        return { type: 'trade', entities: {} };
      }
      return { type: 'general', entities: {} };
    }
  }
  
  /**
   * Handle lineup commands with personality
   */
  private async handleLineupCommand(command: string, intent: any) {
    // Get user's team
    const userId = await this.getCurrentUserId();
    
    const response = await this.orchestrator.handleRequest({
      type: 'action',
      query: command,
      userId,
      context: { intent, emotionalState: this.emotionalState }
    });
    
    // Respond based on emotional state
    if (this.emotionalState.mood === 'anxious') {
      this.speak(
        `Don't worry, I've got your back! ${response.message || 'Your lineup is looking solid.'}. 
        Remember, we've made great calls together before. Trust the process!`,
        'supportive'
      );
    } else if (this.emotionalState.mood === 'excited') {
      this.speak(
        `Hell yeah! ${response.message || 'Lineup updated!'}. 
        This is going to be YOUR week! I can feel it!`,
        'excited'
      );
    } else {
      this.speak(response.message || 'Lineup updated successfully!', 'confident');
    }
  }
  
  /**
   * Handle player analysis with insights
   */
  private async handlePlayerCommand(command: string, intent: any) {
    const response = await this.orchestrator.handleRequest({
      type: 'data',
      query: command,
      context: { intent }
    });
    
    const analysis = await this.orchestrator.handleRequest({
      type: 'ai',
      query: `Analyze this player data and give a brief, personality-filled recommendation: ${JSON.stringify(response)}`,
      context: { emotionalState: this.emotionalState }
    });
    
    this.speak(analysis.response, 'analytical');
  }
  
  /**
   * Handle trade evaluation
   */
  private async handleTradeCommand(command: string, intent: any) {
    const response = await this.orchestrator.handleRequest({
      type: 'ai',
      query: `Evaluate this trade proposal: "${command}". Be honest but ${
        this.emotionalState.mood === 'anxious' ? 'reassuring' : 'direct'
      }.`,
      context: { intent }
    });
    
    this.speak(response.response, 'advisory');
  }
  
  /**
   * Provide emotional support - this is what makes us special
   */
  private async handleEmotionalSupport(command: string) {
    const supportResponses = {
      frustrated: [
        "I get it, fantasy can be brutal sometimes. But remember, even the pros have bad weeks. What matters is we bounce back stronger.",
        "Hey, I've seen teams go from last place to championship. Don't give up on me now!",
        "Tough break, but that's why they play the games. Let's focus on next week and crush it."
      ],
      anxious: [
        "Take a deep breath. We've prepared well, and your team is solid. Trust your instincts.",
        "I've analyzed thousands of matchups, and I believe in your team. You've got this!",
        "Remember last time you were worried? You ended up winning by 30. Let's stay positive!"
      ],
      excited: [
        "Your enthusiasm is contagious! Let's channel that energy into dominating this week!",
        "I love the confidence! Your opponents won't know what hit them!",
        "That's the spirit! With that attitude and my analysis, we're unstoppable!"
      ]
    };
    
    const responses = supportResponses[this.emotionalState.mood] || [
      "I'm here to help however you need. What's on your mind?"
    ];
    
    const response = responses[Math.floor(Math.random() * responses.length)];
    this.speak(response, 'empathetic');
  }
  
  /**
   * Handle general analysis requests
   */
  private async handleAnalysisCommand(command: string, intent: any) {
    const analysis = await this.orchestrator.handleRequest({
      type: 'ai',
      query: command,
      context: { 
        intent,
        emotionalState: this.emotionalState,
        personality: 'knowledgeable friend'
      }
    });
    
    this.speak(analysis.response, 'informative');
  }
  
  /**
   * Handle general queries
   */
  private async handleGeneralQuery(command: string) {
    const response = await this.orchestrator.handleRequest({
      type: 'ai',
      query: command,
      context: { 
        emotionalState: this.emotionalState,
        personality: 'helpful assistant'
      }
    });
    
    this.speak(response.response, 'friendly');
  }
  
  /**
   * Speak with personality and emotion
   */
  private speak(text: string, tone: string = 'neutral') {
    if (this.config.elevenlabs) {
      // Use ElevenLabs for premium voice
      this.speakWithElevenLabs(text, tone);
    } else {
      // Use browser TTS
      this.speakWithBrowserTTS(text, tone);
    }
  }
  
  /**
   * Browser-based TTS with personality
   */
  private speakWithBrowserTTS(text: string, tone: string) {
    const utterance = new SpeechSynthesisUtterance(text);
    
    // Adjust voice parameters based on tone
    switch (tone) {
      case 'excited':
        utterance.rate = 1.2;
        utterance.pitch = 1.3;
        break;
      case 'supportive':
        utterance.rate = 0.9;
        utterance.pitch = 1.0;
        break;
      case 'analytical':
        utterance.rate = 1.0;
        utterance.pitch = 0.9;
        break;
      case 'empathetic':
        utterance.rate = 0.85;
        utterance.pitch = 1.1;
        break;
    }
    
    this.synthesis.speak(utterance);
  }
  
  /**
   * ElevenLabs TTS for premium experience
   */
  private async speakWithElevenLabs(text: string, tone: string) {
    try {
      const response = await fetch('https://api.elevenlabs.io/v1/text-to-speech/' + 
        (this.config.elevenlabs?.voiceId || 'pNInz6obpgDQGcFmaJgB'), {
        method: 'POST',
        headers: {
          'xi-api-key': this.config.elevenlabs!.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text,
          voice_settings: {
            stability: tone === 'excited' ? 0.3 : 0.5,
            similarity_boost: 0.8,
            style: tone === 'analytical' ? 0.2 : 0.5,
            use_speaker_boost: true
          }
        })
      });
      
      const audioBlob = await response.blob();
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);
      audio.play();
    } catch (error) {
      // Fallback to browser TTS
      this.speakWithBrowserTTS(text, tone);
    }
  }
  
  /**
   * Handle speech recognition errors
   */
  private handleSpeechError(event: any) {
    console.error('Speech recognition error:', event.error);
    
    if (event.error === 'no-speech') {
      // Don't announce, just wait
      return;
    }
    
    this.speak("I didn't catch that. Could you try again?", 'apologetic');
  }
  
  /**
   * Get current user ID (mock for now)
   */
  private async getCurrentUserId(): Promise<string> {
    // In real implementation, get from auth context
    return 'current-user-id';
  }
  
  /**
   * Train the assistant on user preferences
   */
  async learnUserPreferences(userId: string, preferences: any) {
    this.userHistory.set(userId, {
      ...this.userHistory.get(userId),
      preferences,
      lastUpdated: new Date()
    });
  }
}
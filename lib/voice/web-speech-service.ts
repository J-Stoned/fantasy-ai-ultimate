/**
 * WEB SPEECH API SERVICE
 * 
 * Production-ready voice interface using browser APIs
 * No external dependencies needed for basic functionality
 * 
 * Features:
 * - Web Speech API for speech recognition
 * - Speech Synthesis for voice responses
 * - Wake word detection ("Hey Fantasy")
 * - Real-time transcription
 */

export interface VoiceConfig {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  wakeWords: string[];
}

export class WebSpeechService {
  private recognition: any;
  private synthesis: SpeechSynthesis;
  private isListening = false;
  private wakeWordActive = false;
  private wakeWordTimeout: NodeJS.Timeout | null = null;
  private config: VoiceConfig;
  
  constructor(config?: Partial<VoiceConfig>) {
    this.config = {
      continuous: false,
      interimResults: true,
      lang: 'en-US',
      wakeWords: ['hey fantasy', 'fantasy', 'ok fantasy'],
      ...config
    };
    
    // Initialize speech synthesis
    this.synthesis = window.speechSynthesis;
    
    // Initialize speech recognition
    this.initializeSpeechRecognition();
  }
  
  private initializeSpeechRecognition(): void {
    // Check for browser support
    const SpeechRecognition = (window as any).SpeechRecognition || 
                            (window as any).webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
      console.error('❌ Speech Recognition not supported in this browser');
      return;
    }
    
    this.recognition = new SpeechRecognition();
    this.recognition.continuous = this.config.continuous;
    this.recognition.interimResults = this.config.interimResults;
    this.recognition.lang = this.config.lang;
    
    // Set up event handlers
    this.setupRecognitionHandlers();
  }
  
  private setupRecognitionHandlers(): void {
    this.recognition.onstart = () => {
      console.log('🎤 Speech recognition started');
      this.isListening = true;
    };
    
    this.recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript;
      const isFinal = event.results[last].isFinal;
      
      console.log(`📝 ${isFinal ? 'Final' : 'Interim'}: "${transcript}"`);
      
      if (isFinal) {
        this.handleTranscript(transcript);
      }
      
      // Emit events for UI updates
      this.emit('transcript', { transcript, isFinal });
    };
    
    this.recognition.onerror = (event: any) => {
      console.error('❌ Speech recognition error:', event.error);
      this.isListening = false;
      this.emit('error', event.error);
    };
    
    this.recognition.onend = () => {
      console.log('🔴 Speech recognition ended');
      this.isListening = false;
      this.emit('end');
    };
  }
  
  private handleTranscript(transcript: string): void {
    const lowerTranscript = transcript.toLowerCase();
    
    // Check for wake word
    const hasWakeWord = this.config.wakeWords.some(word => 
      lowerTranscript.includes(word)
    );
    
    if (hasWakeWord) {
      this.wakeWordActive = true;
      this.emit('wakeword');
      
      // Reset wake word after 10 seconds
      if (this.wakeWordTimeout) {
        clearTimeout(this.wakeWordTimeout);
      }
      this.wakeWordTimeout = setTimeout(() => {
        this.wakeWordActive = false;
        this.emit('wakeword-timeout');
      }, 10000);
      
      // Process command after wake word
      const command = this.extractCommandAfterWakeWord(transcript);
      if (command) {
        this.emit('command', command);
      }
    } else if (this.wakeWordActive) {
      // Process as command if wake word was recently said
      this.emit('command', transcript);
    }
  }
  
  private extractCommandAfterWakeWord(transcript: string): string | null {
    const lowerTranscript = transcript.toLowerCase();
    
    for (const wakeWord of this.config.wakeWords) {
      const index = lowerTranscript.indexOf(wakeWord);
      if (index !== -1) {
        const command = transcript.substring(index + wakeWord.length).trim();
        if (command.length > 0) {
          return command;
        }
      }
    }
    
    return null;
  }
  
  /**
   * Start listening for voice commands
   */
  async startListening(): Promise<void> {
    if (!this.recognition) {
      throw new Error('Speech recognition not supported');
    }
    
    if (this.isListening) {
      console.log('⚠️ Already listening');
      return;
    }
    
    try {
      // Request microphone permission
      await navigator.mediaDevices.getUserMedia({ audio: true });
      
      this.recognition.start();
    } catch (error) {
      console.error('Failed to start listening:', error);
      throw error;
    }
  }
  
  /**
   * Stop listening
   */
  stopListening(): void {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
    }
  }
  
  /**
   * Toggle continuous listening for wake word
   */
  toggleWakeWordDetection(enabled: boolean): void {
    this.recognition.continuous = enabled;
    
    if (enabled && !this.isListening) {
      this.startListening();
    } else if (!enabled && this.isListening) {
      this.stopListening();
    }
  }
  
  /**
   * Speak text using speech synthesis
   */
  speak(text: string, options?: {
    voice?: SpeechSynthesisVoice;
    rate?: number;
    pitch?: number;
    volume?: number;
  }): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.synthesis) {
        reject(new Error('Speech synthesis not supported'));
        return;
      }
      
      // Cancel any ongoing speech
      this.synthesis.cancel();
      
      const utterance = new SpeechSynthesisUtterance(text);
      
      // Apply options
      if (options?.voice) {
        utterance.voice = options.voice;
      } else {
        // Try to find a good default voice
        const voices = this.synthesis.getVoices();
        const englishVoice = voices.find(v => 
          v.lang.startsWith('en') && v.localService
        ) || voices[0];
        
        if (englishVoice) {
          utterance.voice = englishVoice;
        }
      }
      
      utterance.rate = options?.rate || 1.1; // Slightly faster
      utterance.pitch = options?.pitch || 1.0;
      utterance.volume = options?.volume || 1.0;
      
      // Set up event handlers
      utterance.onend = () => {
        this.emit('speech-end');
        resolve();
      };
      
      utterance.onerror = (event) => {
        console.error('Speech synthesis error:', event);
        this.emit('speech-error', event);
        reject(event);
      };
      
      // Start speaking
      this.synthesis.speak(utterance);
      this.emit('speech-start', text);
    });
  }
  
  /**
   * Get available voices
   */
  getVoices(): SpeechSynthesisVoice[] {
    return this.synthesis.getVoices();
  }
  
  /**
   * Stop speaking
   */
  stopSpeaking(): void {
    if (this.synthesis.speaking) {
      this.synthesis.cancel();
    }
  }
  
  /**
   * Check if currently speaking
   */
  isSpeaking(): boolean {
    return this.synthesis.speaking;
  }
  
  /**
   * Process voice command with Anthropic Claude
   */
  async processCommand(transcript: string, context?: any): Promise<{
    response: string;
    confidence: number;
    actions?: any[];
  }> {
    try {
      const response = await fetch('/api/voice/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          context,
          includeAudio: false // We'll use Web Speech API for audio
        }),
      });
      
      if (!response.ok) {
        throw new Error('Failed to process command');
      }
      
      const data = await response.json();
      
      // Speak the response
      if (data.response?.text) {
        await this.speak(data.response.text);
      }
      
      return {
        response: data.response?.text || 'I didn\'t understand that command.',
        confidence: data.command?.confidence || 0,
        actions: data.response?.actions
      };
    } catch (error) {
      console.error('Command processing error:', error);
      return {
        response: 'Sorry, I had trouble processing that command.',
        confidence: 0
      };
    }
  }
  
  // Event emitter functionality
  private listeners: Map<string, Function[]> = new Map();
  
  on(event: string, callback: Function): void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, []);
    }
    this.listeners.get(event)!.push(callback);
  }
  
  off(event: string, callback: Function): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      const index = callbacks.indexOf(callback);
      if (index !== -1) {
        callbacks.splice(index, 1);
      }
    }
  }
  
  private emit(event: string, data?: any): void {
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach(callback => callback(data));
    }
  }
}

// Export singleton instance for easy use
export const webSpeechService = new WebSpeechService();
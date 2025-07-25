import { EventEmitter } from 'events';

// 2025 Best Practice: 11Labs MCP integration for ultra-realistic voice
export interface ElevenLabsMCPConfig {
  apiKey: string;
  voiceId: string;
  model: 'eleven_turbo_v2' | 'eleven_flash_v2_5';
  streamingLatency: 0 | 1 | 2 | 3;
  voiceSettings?: VoiceSettings;
}

export interface VoiceSettings {
  stability: number; // 0-1
  similarity_boost: number; // 0-1
  style?: number; // 0-1
  use_speaker_boost?: boolean;
}

export interface AudioStreamOptions {
  outputFormat?: 'mp3_44100' | 'pcm_16000' | 'pcm_22050' | 'pcm_24000';
  chunkLengthSchedule?: number[];
  enableLogging?: boolean;
  optimizeStreamingLatency?: number;
}

// 2025: Advanced voice synthesis with streaming
export class ElevenLabsMCPClient extends EventEmitter {
  private wsConnection: WebSocket | null = null;
  private audioContext: AudioContext | null = null;
  private audioQueue: AudioBuffer[] = [];
  private isPlaying = false;
  private sessionId: string | null = null;
  
  constructor(private config: ElevenLabsMCPConfig) {
    super();
    this.initializeAudioContext();
  }
  
  private initializeAudioContext() {
    if (typeof window !== 'undefined' && 'AudioContext' in window) {
      this.audioContext = new AudioContext({ 
        sampleRate: 16000,
        latencyHint: 'interactive'
      });
    }
  }
  
  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        // 11Labs WebSocket endpoint for streaming
        const wsUrl = `wss://api.elevenlabs.io/v1/text-to-speech/${this.config.voiceId}/stream-input`;
        
        this.wsConnection = new WebSocket(wsUrl);
        
        this.wsConnection.onopen = () => {
          // Send initial configuration
          this.wsConnection!.send(JSON.stringify({
            xi_api_key: this.config.apiKey,
            voice_settings: this.config.voiceSettings || {
              stability: 0.8,
              similarity_boost: 0.9,
              style: 0.5,
              use_speaker_boost: true
            },
            model_id: this.config.model,
            optimize_streaming_latency: this.config.streamingLatency
          }));
          
          this.emit('connected');
          resolve();
        };
        
        this.wsConnection.onmessage = async (event) => {
          await this.handleAudioData(event.data);
        };
        
        this.wsConnection.onerror = (error) => {
          this.emit('error', error);
          reject(error);
        };
        
        this.wsConnection.onclose = () => {
          this.emit('disconnected');
        };
        
      } catch (error) {
        reject(error);
      }
    });
  }
  
  async streamText(
    text: string, 
    options?: AudioStreamOptions
  ): Promise<string> {
    if (!this.wsConnection || this.wsConnection.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    
    this.sessionId = this.generateSessionId();
    
    // 2025: Optimized chunk scheduling for low latency
    const chunkSchedule = options?.chunkLengthSchedule || [120, 160, 250, 290];
    
    const message = {
      text,
      session_id: this.sessionId,
      chunk_length_schedule: chunkSchedule,
      enable_logging: options?.enableLogging ?? true,
      output_format: options?.outputFormat || 'pcm_16000',
      streaming: true
    };
    
    this.wsConnection.send(JSON.stringify(message));
    
    return this.sessionId;
  }
  
  async streamSSML(
    ssml: string,
    options?: AudioStreamOptions
  ): Promise<string> {
    // SSML support for advanced voice control
    const wrappedSSML = `<speak>${ssml}</speak>`;
    return this.streamText(wrappedSSML, options);
  }
  
  private async handleAudioData(data: any) {
    if (data instanceof Blob) {
      const audioData = await this.processAudioBlob(data);
      if (audioData) {
        this.audioQueue.push(audioData);
        this.emit('audioChunk', audioData);
        
        if (!this.isPlaying) {
          this.playAudioQueue();
        }
      }
    } else if (typeof data === 'string') {
      const message = JSON.parse(data);
      
      if (message.type === 'generation_complete') {
        this.emit('complete', message.session_id);
      } else if (message.type === 'error') {
        this.emit('error', new Error(message.message));
      }
    }
  }
  
  private async processAudioBlob(blob: Blob): Promise<AudioBuffer | null> {
    if (!this.audioContext) return null;
    
    try {
      const arrayBuffer = await blob.arrayBuffer();
      const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
      return audioBuffer;
    } catch (error) {
      console.error('Error processing audio:', error);
      return null;
    }
  }
  
  private async playAudioQueue() {
    if (!this.audioContext || this.audioQueue.length === 0) {
      this.isPlaying = false;
      return;
    }
    
    this.isPlaying = true;
    
    while (this.audioQueue.length > 0) {
      const audioBuffer = this.audioQueue.shift()!;
      await this.playAudioBuffer(audioBuffer);
    }
    
    this.isPlaying = false;
  }
  
  private playAudioBuffer(audioBuffer: AudioBuffer): Promise<void> {
    return new Promise((resolve) => {
      if (!this.audioContext) {
        resolve();
        return;
      }
      
      const source = this.audioContext.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.audioContext.destination);
      
      source.onended = () => {
        resolve();
      };
      
      source.start(0);
    });
  }
  
  async generateVoiceProfile(
    sampleText: string[],
    referenceAudio?: ArrayBuffer
  ): Promise<string> {
    // 2025: Voice cloning capabilities for personalized assistants
    if (!referenceAudio) {
      return this.config.voiceId; // Use default voice
    }
    
    // TODO: Implement voice cloning API call
    // This would create a custom voice profile based on reference audio
    return 'custom_voice_id';
  }
  
  stopStreaming() {
    this.audioQueue = [];
    this.isPlaying = false;
    
    if (this.audioContext) {
      this.audioContext.suspend();
    }
  }
  
  disconnect() {
    this.stopStreaming();
    
    if (this.wsConnection) {
      this.wsConnection.close();
      this.wsConnection = null;
    }
    
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
  
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  }
}
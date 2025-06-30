import { createComponentLogger } from '../utils/client-logger';

const logger = createComponentLogger('ClientVoiceService');

export interface VoiceContext {
  userId?: string;
  sessionId?: string;
  fantasyTeamId?: string;
  leagueId?: string;
}

export interface VoiceResponse {
  transcript: string;
  response: string;
  audioUrl?: string;
  proactiveInsights?: string[];
  nextQuestions?: string[];
}

export interface MorningBriefing {
  message: string;
  audioUrl?: string;
  priority: 'low' | 'medium' | 'high';
}

export interface LineupCommandResult {
  action: string;
  result: any;
  confirmation: string;
}

export class ClientVoiceService {
  private recognition: any = null;
  private isListening: boolean = false;

  constructor() {
    this.initializeSpeechRecognition();
  }

  private initializeSpeechRecognition() {
    if (typeof window !== 'undefined' && 'webkitSpeechRecognition' in window) {
      const SpeechRecognition = (window as any).webkitSpeechRecognition;
      this.recognition = new SpeechRecognition();
      this.recognition.continuous = false;
      this.recognition.interimResults = true;
      this.recognition.lang = 'en-US';
      
      logger.info('Speech recognition initialized');
    }
  }

  async processVoiceCommand(
    transcript: string,
    context: VoiceContext
  ): Promise<VoiceResponse> {
    try {
      const response = await fetch('/api/voice/process', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          transcript,
          context,
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to process voice command');
      }

      return data.result;
    } catch (error) {
      logger.error('Voice processing error', error);
      return {
        transcript,
        response: "I'm sorry, I couldn't process that request. Please try again.",
      };
    }
  }

  async generateMorningBriefing(userId: string): Promise<MorningBriefing> {
    try {
      const response = await fetch(`/api/voice/morning-briefing?userId=${userId}`);
      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate morning briefing');
      }

      return data.briefing;
    } catch (error) {
      logger.error('Morning briefing error', error);
      return {
        message: 'Unable to generate morning briefing at this time.',
        priority: 'low',
      };
    }
  }

  async processLineupCommand(
    command: string,
    userId: string,
    leagueId: string
  ): Promise<LineupCommandResult> {
    try {
      const response = await fetch('/api/voice/lineup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          command,
          userId,
          leagueId,
        }),
      });

      const data = await response.json();
      
      if (!data.success) {
        throw new Error(data.error || 'Failed to process lineup command');
      }

      return data.result;
    } catch (error) {
      logger.error('Lineup command error', error);
      return {
        action: 'error',
        result: null,
        confirmation: 'Unable to process lineup command.',
      };
    }
  }

  startListening(
    onTranscript: (transcript: string) => void,
    onEnd: () => void
  ) {
    if (!this.recognition) {
      logger.error('Speech recognition not available');
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
      logger.error('Speech recognition error', { error: event.error });
      this.stopListening();
    };

    this.recognition.onend = () => {
      this.isListening = false;
      onEnd();
    };

    this.recognition.start();
    logger.info('Listening for voice input');
  }

  stopListening() {
    if (this.recognition && this.isListening) {
      this.recognition.stop();
      this.isListening = false;
      logger.info('Stopped listening');
    }
  }

  startWakeWordDetection(onWakeWord: () => void) {
    if (!this.recognition) return;

    const wakeWords = ['hey fantasy', 'okay fantasy', 'fantasy'];
    
    this.recognition.continuous = true;
    this.recognition.onresult = (event: any) => {
      const last = event.results.length - 1;
      const transcript = event.results[last][0].transcript.toLowerCase();
      
      if (wakeWords.some(word => transcript.includes(word))) {
        logger.info('Wake word detected');
        this.recognition.stop();
        onWakeWord();
      }
    };

    this.recognition.start();
    logger.info('Listening for wake word');
  }

  playAudio(audioUrl: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const audio = new Audio(audioUrl);
      audio.onended = () => resolve();
      audio.onerror = () => reject(new Error('Failed to play audio'));
      audio.play().catch(reject);
    });
  }

  // Text-to-speech fallback using browser API
  speak(text: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if ('speechSynthesis' in window) {
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.onend = () => resolve();
        utterance.onerror = () => reject(new Error('Speech synthesis failed'));
        window.speechSynthesis.speak(utterance);
      } else {
        reject(new Error('Speech synthesis not available'));
      }
    });
  }
}
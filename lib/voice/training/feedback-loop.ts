/**
 * Feedback Loop System for Voice Assistant
 * Captures user feedback and automatically improves responses
 */

import { EventEmitter } from 'events';
import { createClient } from '@supabase/supabase-js';
import { RealTimeVoiceTrainer } from './real-time-trainer';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface FeedbackData {
  commandId: string;
  transcript: string;
  response: string;
  intent: string;
  feedback: 'positive' | 'negative' | 'neutral';
  followupAction?: string; // What the user did after
  gameResult?: 'win' | 'loss' | null; // If advice was followed
  timestamp: Date;
  userId?: string;
  sessionId: string;
}

export interface FeedbackMetrics {
  totalFeedback: number;
  positiveFeedback: number;
  negativeFeedback: number;
  successRate: number;
  commonFailures: Map<string, number>;
  intentAccuracy: Map<string, number>;
  responseTime: number;
}

export class FeedbackLoop extends EventEmitter {
  private trainer: RealTimeVoiceTrainer;
  private feedbackBuffer: FeedbackData[] = [];
  private metrics: FeedbackMetrics;
  private userSessions: Map<string, any> = new Map();
  private readonly FEEDBACK_BATCH_SIZE = 5;
  private readonly AUTO_LEARN_THRESHOLD = 0.7; // 70% confidence

  constructor(trainer: RealTimeVoiceTrainer) {
    super();
    this.trainer = trainer;
    this.metrics = {
      totalFeedback: 0,
      positiveFeedback: 0,
      negativeFeedback: 0,
      successRate: 0,
      commonFailures: new Map(),
      intentAccuracy: new Map(),
      responseTime: 0
    };

    this.startFeedbackProcessing();
    this.startBehaviorTracking();
  }

  /**
   * Capture immediate feedback on voice response
   */
  async captureFeedback(feedback: FeedbackData) {
    const startTime = Date.now();
    
    // Update metrics
    this.metrics.totalFeedback++;
    if (feedback.feedback === 'positive') {
      this.metrics.positiveFeedback++;
    } else if (feedback.feedback === 'negative') {
      this.metrics.negativeFeedback++;
      
      // Track common failures
      const failure = `${feedback.intent}:${feedback.transcript}`;
      this.metrics.commonFailures.set(
        failure,
        (this.metrics.commonFailures.get(failure) || 0) + 1
      );
    }

    // Calculate success rate
    this.metrics.successRate = this.metrics.positiveFeedback / this.metrics.totalFeedback;

    // Update intent accuracy
    const currentAccuracy = this.metrics.intentAccuracy.get(feedback.intent) || { correct: 0, total: 0 };
    currentAccuracy.total++;
    if (feedback.feedback === 'positive') {
      currentAccuracy.correct++;
    }
    this.metrics.intentAccuracy.set(feedback.intent, currentAccuracy);

    // Add to buffer
    this.feedbackBuffer.push(feedback);

    // Store in database
    await this.storeFeedback(feedback);

    // Immediate retraining on negative feedback
    if (feedback.feedback === 'negative') {
      console.log('👎 Negative feedback - triggering immediate learning');
      await this.trainer.provideFeedback(feedback.commandId, 'negative');
      
      // Analyze why it failed
      await this.analyzeFailure(feedback);
    }

    // Process batch if threshold reached
    if (this.feedbackBuffer.length >= this.FEEDBACK_BATCH_SIZE) {
      await this.processFeedbackBatch();
    }

    this.metrics.responseTime = Date.now() - startTime;
    this.emit('feedbackCaptured', feedback);
  }

  /**
   * Analyze user behavior after voice command
   */
  async trackUserBehavior(sessionId: string, action: string, metadata?: any) {
    const session = this.userSessions.get(sessionId) || { commands: [] };
    
    // Find the last command in this session
    const lastCommand = session.commands[session.commands.length - 1];
    
    if (lastCommand && Date.now() - lastCommand.timestamp < 30000) { // Within 30 seconds
      // User took action after voice command
      if (action === 'manual_search' || action === 'typed_query') {
        // Voice command likely failed
        console.log('🔍 User searched manually after voice command - marking as failure');
        await this.captureFeedback({
          ...lastCommand,
          feedback: 'negative',
          followupAction: action
        });
      } else if (action === 'clicked_suggestion' || action === 'used_result') {
        // Voice command succeeded
        await this.captureFeedback({
          ...lastCommand,
          feedback: 'positive',
          followupAction: action
        });
      }
    }

    // Update session
    session.lastAction = action;
    session.lastActionTime = Date.now();
    this.userSessions.set(sessionId, session);
  }

  /**
   * Track game results to validate advice quality
   */
  async trackGameResult(userId: string, advice: string, result: 'win' | 'loss') {
    // Find recent advice given to this user
    const { data: recentAdvice } = await supabase
      .from('voice_feedback')
      .select('*')
      .eq('user_id', userId)
      .like('response', `%${advice}%`)
      .order('created_at', { ascending: false })
      .limit(1);

    if (recentAdvice && recentAdvice.length > 0) {
      const feedback = recentAdvice[0];
      
      // Update with game result
      await supabase
        .from('voice_feedback')
        .update({ game_result: result })
        .eq('id', feedback.id);

      // Learn from results
      if (result === 'win') {
        console.log('🏆 Advice led to win - reinforcing this pattern');
        await this.trainer.provideFeedback(feedback.command_id, 'positive');
      } else {
        console.log('😔 Advice led to loss - adjusting confidence');
        // Don't mark as negative, but reduce confidence
        await this.adjustConfidence(feedback.intent, -0.1);
      }
    }
  }

  /**
   * Analyze why a command failed
   */
  private async analyzeFailure(feedback: FeedbackData) {
    console.log(`🔬 Analyzing failure for: "${feedback.transcript}"`);
    
    // Check if it's a new phrase for known intent
    const similarCommands = await this.findSimilarSuccessfulCommands(feedback.transcript);
    
    if (similarCommands.length > 0) {
      console.log(`  Found ${similarCommands.length} similar successful commands`);
      // Add this variation to training data
      await this.addCommandVariation(feedback.transcript, similarCommands[0].intent);
    } else {
      // Might be a new intent entirely
      console.log('  No similar commands found - possible new intent');
      await this.suggestNewIntent(feedback);
    }

    // Check if it's a pronunciation issue
    if (feedback.transcript.includes('?') || feedback.transcript.length < 5) {
      console.log('  Possible speech recognition issue');
      this.emit('recognitionIssue', feedback);
    }
  }

  /**
   * Process batch of feedback for training
   */
  private async processFeedbackBatch() {
    if (this.feedbackBuffer.length === 0) return;

    console.log(`📦 Processing feedback batch of ${this.feedbackBuffer.length} items`);
    
    // Group by intent for pattern analysis
    const intentGroups = new Map<string, FeedbackData[]>();
    
    this.feedbackBuffer.forEach(fb => {
      const group = intentGroups.get(fb.intent) || [];
      group.push(fb);
      intentGroups.set(fb.intent, group);
    });

    // Analyze patterns per intent
    for (const [intent, feedbacks] of intentGroups) {
      const positiveCount = feedbacks.filter(f => f.feedback === 'positive').length;
      const accuracy = positiveCount / feedbacks.length;
      
      console.log(`  Intent "${intent}": ${accuracy * 100}% accuracy`);
      
      if (accuracy < this.AUTO_LEARN_THRESHOLD) {
        // This intent needs improvement
        await this.improveIntent(intent, feedbacks);
      }
    }

    // Clear buffer
    this.feedbackBuffer = [];
  }

  /**
   * Improve specific intent based on feedback
   */
  private async improveIntent(intent: string, feedbacks: FeedbackData[]) {
    console.log(`🔧 Improving intent: ${intent}`);
    
    // Extract successful patterns
    const successfulPatterns = feedbacks
      .filter(f => f.feedback === 'positive')
      .map(f => f.transcript);
    
    // Extract failed patterns  
    const failedPatterns = feedbacks
      .filter(f => f.feedback === 'negative')
      .map(f => f.transcript);

    // Generate new training examples
    const newExamples = await this.generateTrainingExamples(
      intent,
      successfulPatterns,
      failedPatterns
    );

    // Add to training queue
    for (const example of newExamples) {
      await this.trainer.processCommand({
        id: `generated_${Date.now()}_${Math.random()}`,
        transcript: example.text,
        intent: intent,
        entities: {},
        confidence: 1.0,
        timestamp: new Date(),
        feedback: 'positive'
      });
    }
  }

  /**
   * Generate new training examples based on patterns
   */
  private async generateTrainingExamples(
    intent: string,
    successful: string[],
    failed: string[]
  ): Promise<{ text: string, intent: string }[]> {
    const examples: { text: string, intent: string }[] = [];
    
    // Analyze successful patterns
    const commonWords = this.extractCommonWords(successful);
    
    // Generate variations
    const variations = [
      // Add common sports slang
      'yo', 'bruh', 'dude', 'bro',
      // Add question variations
      'can you tell me', 'what about', 'how about', 'thoughts on',
      // Add urgency markers
      'quick', 'asap', 'urgent', 'need help'
    ];

    // Create new examples by combining patterns
    for (const word of commonWords) {
      for (const variation of variations) {
        examples.push({
          text: `${variation} ${word}`,
          intent: intent
        });
      }
    }

    return examples;
  }

  /**
   * Extract common words from successful commands
   */
  private extractCommonWords(commands: string[]): Set<string> {
    const wordCount = new Map<string, number>();
    
    commands.forEach(cmd => {
      const words = cmd.toLowerCase().split(/\s+/);
      words.forEach(word => {
        wordCount.set(word, (wordCount.get(word) || 0) + 1);
      });
    });

    // Get words that appear in >50% of commands
    const threshold = commands.length * 0.5;
    const commonWords = new Set<string>();
    
    wordCount.forEach((count, word) => {
      if (count >= threshold && word.length > 3) {
        commonWords.add(word);
      }
    });

    return commonWords;
  }

  /**
   * Find similar successful commands
   */
  private async findSimilarSuccessfulCommands(transcript: string): Promise<any[]> {
    const { data } = await supabase
      .from('voice_feedback')
      .select('*')
      .eq('feedback', 'positive')
      .textSearch('transcript', transcript.split(' ').join(' | '))
      .limit(5);

    return data || [];
  }

  /**
   * Add command variation to training
   */
  private async addCommandVariation(transcript: string, intent: string) {
    await supabase.from('voice_training_variations').insert({
      original_transcript: transcript,
      intent: intent,
      added_by: 'feedback_loop',
      created_at: new Date()
    });
  }

  /**
   * Suggest new intent based on failed commands
   */
  private async suggestNewIntent(feedback: FeedbackData) {
    await supabase.from('voice_intent_suggestions').insert({
      transcript: feedback.transcript,
      suggested_intent: 'unknown',
      confidence: 0.5,
      reason: 'No matching pattern found',
      created_at: new Date()
    });
  }

  /**
   * Adjust confidence for specific intent
   */
  private async adjustConfidence(intent: string, adjustment: number) {
    // This would update the model's confidence scoring
    console.log(`Adjusting confidence for ${intent} by ${adjustment}`);
  }

  /**
   * Store feedback in database
   */
  private async storeFeedback(feedback: FeedbackData) {
    try {
      await supabase.from('voice_feedback').insert({
        command_id: feedback.commandId,
        transcript: feedback.transcript,
        response: feedback.response,
        intent: feedback.intent,
        feedback: feedback.feedback,
        followup_action: feedback.followupAction,
        game_result: feedback.gameResult,
        user_id: feedback.userId,
        session_id: feedback.sessionId,
        created_at: feedback.timestamp
      });
    } catch (error) {
      console.error('Failed to store feedback:', error);
    }
  }

  /**
   * Start automatic feedback processing
   */
  private startFeedbackProcessing() {
    // Process feedback every minute
    setInterval(() => {
      if (this.feedbackBuffer.length > 0) {
        this.processFeedbackBatch();
      }
    }, 60 * 1000);
  }

  /**
   * Start behavior tracking
   */
  private startBehaviorTracking() {
    // Clean up old sessions every hour
    setInterval(() => {
      const oneHourAgo = Date.now() - 3600000;
      this.userSessions.forEach((session, id) => {
        if (session.lastActionTime < oneHourAgo) {
          this.userSessions.delete(id);
        }
      });
    }, 3600000);
  }

  /**
   * Get current metrics
   */
  getMetrics(): FeedbackMetrics {
    return { ...this.metrics };
  }

  /**
   * Export feedback data for analysis
   */
  async exportFeedbackData(startDate?: Date, endDate?: Date): Promise<FeedbackData[]> {
    let query = supabase.from('voice_feedback').select('*');
    
    if (startDate) {
      query = query.gte('created_at', startDate.toISOString());
    }
    if (endDate) {
      query = query.lte('created_at', endDate.toISOString());
    }

    const { data } = await query.order('created_at', { ascending: false });
    return data || [];
  }
}
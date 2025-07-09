/**
 * Voice feedback endpoint
 * Captures user feedback and triggers immediate retraining
 */

import { NextRequest, NextResponse } from 'next/server';
import { RealTimeVoiceTrainer } from '../../lib/voice/training/real-time-trainer';
import { FeedbackLoop } from '../../lib/voice/training/feedback-loop';

// Use same instances as voice processing
const trainer = new RealTimeVoiceTrainer();
const feedbackLoop = new FeedbackLoop(trainer);

export async function POST(request: NextRequest) {
  try {
    const { 
      commandId, 
      feedback, 
      followupAction,
      gameResult,
      sessionId,
      userId 
    } = await request.json();

    if (!commandId || !feedback) {
      return NextResponse.json(
        { error: 'commandId and feedback are required' },
        { status: 400 }
      );
    }

    console.log(`📝 Received ${feedback} feedback for command ${commandId}`);

    // Provide feedback to trainer
    if (feedback === 'positive' || feedback === 'negative') {
      await trainer.provideFeedback(commandId, feedback);
    }

    // Update feedback loop with additional context
    if (followupAction || gameResult) {
      // This updates the existing feedback entry
      await feedbackLoop.captureFeedback({
        commandId,
        transcript: '', // Will be filled from existing data
        response: '',
        intent: '',
        feedback,
        followupAction,
        gameResult,
        timestamp: new Date(),
        userId,
        sessionId
      });
    }

    // Get current metrics
    const trainerMetrics = trainer.getMetrics();
    const feedbackMetrics = feedbackLoop.getMetrics();

    return NextResponse.json({
      success: true,
      message: feedback === 'negative' 
        ? 'Thanks for the feedback! I\'m learning from this to improve.'
        : 'Great! I\'ll remember this worked well.',
      metrics: {
        modelAccuracy: trainerMetrics.accuracy,
        totalCommands: trainerMetrics.totalCommands,
        successRate: feedbackMetrics.successRate,
        modelVersion: trainerMetrics.modelVersion
      }
    });
  } catch (error: any) {
    console.error('Feedback processing error:', error);
    return NextResponse.json(
      { error: 'Failed to process feedback' },
      { status: 500 }
    );
  }
}

// Get feedback metrics
export async function GET(request: NextRequest) {
  try {
    const trainerMetrics = trainer.getMetrics();
    const feedbackMetrics = feedbackLoop.getMetrics();

    // Calculate intent-specific accuracy
    const intentStats: any[] = [];
    feedbackMetrics.intentAccuracy.forEach((stats: any, intent: string) => {
      intentStats.push({
        intent,
        accuracy: (stats.correct / stats.total) * 100,
        total: stats.total
      });
    });

    // Get common failures
    const failures: any[] = [];
    feedbackMetrics.commonFailures.forEach((count, pattern) => {
      failures.push({ pattern, count });
    });

    return NextResponse.json({
      success: true,
      metrics: {
        model: {
          version: trainerMetrics.modelVersion,
          accuracy: trainerMetrics.accuracy,
          totalCommands: trainerMetrics.totalCommands,
          successfulCommands: trainerMetrics.successfulCommands,
          retrainingCycles: trainerMetrics.retrainingCycles,
          lastTrainingTime: trainerMetrics.lastTrainingTime
        },
        feedback: {
          totalFeedback: feedbackMetrics.totalFeedback,
          positiveFeedback: feedbackMetrics.positiveFeedback,
          negativeFeedback: feedbackMetrics.negativeFeedback,
          successRate: feedbackMetrics.successRate * 100,
          responseTime: feedbackMetrics.responseTime
        },
        intents: intentStats.sort((a, b) => b.total - a.total),
        commonFailures: failures.sort((a, b) => b.count - a.count).slice(0, 10)
      }
    });
  } catch (error) {
    console.error('Error fetching metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch metrics' },
      { status: 500 }
    );
  }
}
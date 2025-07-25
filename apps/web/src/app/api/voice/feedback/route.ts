import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';
import { logger } from '../../../../lib/logging/logger';

// 🔥 VOICE FEEDBACK COLLECTION API - LEARNING SYSTEM

interface VoiceFeedbackRequest {
  commandId: string;
  feedback: 'positive' | 'negative';
  sessionId: string;
  userId: string;
  details?: string;
  suggestedImprovement?: string;
}

export async function POST(request: NextRequest) {
  try {
    const body: VoiceFeedbackRequest = await request.json();
    const { commandId, feedback, sessionId, userId, details, suggestedImprovement } = body;

    if (!commandId || !feedback || !sessionId || !userId) {
      return NextResponse.json({
        success: false,
        error: 'Missing required fields'
      }, { status: 400 });
    }

    // 📊 STORE FEEDBACK FOR ML IMPROVEMENT
    await pool.query(`
      INSERT INTO voice_feedback (
        command_id, user_id, session_id, feedback_type, 
        details, suggested_improvement, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, NOW())
    `, [commandId, userId, sessionId, feedback, details, suggestedImprovement]);

    // 🧠 UPDATE COMMAND ANALYTICS
    await pool.query(`
      UPDATE voice_commands 
      SET feedback = $1, updated_at = NOW()
      WHERE command_id = $2
    `, [feedback, commandId]);

    // 📈 UPDATE USER SATISFACTION METRICS
    await updateUserSatisfactionMetrics(userId, feedback);

    // 🤖 TRIGGER ML MODEL RETRAINING IF NEEDED
    await checkForRetrainingTrigger(commandId, feedback);

    return NextResponse.json({
      success: true,
      message: 'Feedback recorded successfully'
    });

  } catch (error) {
    logger.error('Voice feedback error:', { error: error });
    
    return NextResponse.json({
      success: false,
      error: 'Failed to record feedback'
    }, { status: 500 });
  }
}

async function updateUserSatisfactionMetrics(userId: string, feedback: string) {
  try {
    // Get current satisfaction metrics
    const metricsResult = await pool.query(`
      SELECT satisfaction_score, total_interactions, positive_feedback_count
      FROM user_voice_metrics 
      WHERE user_id = $1
    `, [userId]);

    const isPositive = feedback === 'positive';
    
    if (metricsResult.rows.length === 0) {
      // Create new metrics record
      await pool.query(`
        INSERT INTO user_voice_metrics (
          user_id, satisfaction_score, total_interactions, 
          positive_feedback_count, created_at, updated_at
        ) VALUES ($1, $2, 1, $3, NOW(), NOW())
      `, [userId, isPositive ? 100 : 0, isPositive ? 1 : 0]);
    } else {
      // Update existing metrics
      const current = metricsResult.rows[0];
      const newTotal = current.total_interactions + 1;
      const newPositive = current.positive_feedback_count + (isPositive ? 1 : 0);
      const newSatisfactionScore = Math.round((newPositive / newTotal) * 100);

      await pool.query(`
        UPDATE user_voice_metrics 
        SET satisfaction_score = $1, total_interactions = $2, 
            positive_feedback_count = $3, updated_at = NOW()
        WHERE user_id = $4
      `, [newSatisfactionScore, newTotal, newPositive, userId]);
    }
  } catch (error) {
    logger.error('Error updating user satisfaction metrics:', { error: error });
  }
}

async function checkForRetrainingTrigger(commandId: string, feedback: string) {
  try {
    // Get the command details
    const commandResult = await pool.query(`
      SELECT intent, confidence FROM voice_commands WHERE command_id = $1
    `, [commandId]);

    if (commandResult.rows.length === 0) return;

    const { intent, confidence } = commandResult.rows[0];

    // 🔥 TRIGGER RETRAINING CONDITIONS:
    // 1. Negative feedback on high-confidence predictions
    // 2. Pattern of negative feedback for specific intent
    // 3. Low satisfaction scores across multiple users

    if (feedback === 'negative' && confidence > 0.8) {
      // High confidence but negative feedback - model might be overconfident
      logger.info('🤖 Retraining trigger: High confidence (${confidence}) but negative feedback for intent: ${intent}');
      await queueModelRetraining('overconfidence', { intent, confidence, commandId });
    }

    // Check for pattern of negative feedback for this intent
    const recentFeedback = await pool.query(`
      SELECT feedback_type 
      FROM voice_feedback vf
      JOIN voice_commands vc ON vf.command_id = vc.command_id
      WHERE vc.intent = $1 AND vf.created_at > NOW() - INTERVAL '7 days'
      ORDER BY vf.created_at DESC
      LIMIT 10
    `, [intent]);

    const negativeFeedbackRate = recentFeedback.rows.filter(row => row.feedback_type === 'negative').length / recentFeedback.rows.length;

    if (negativeFeedbackRate > 0.6 && recentFeedback.rows.length >= 5) {
      logger.info('🤖 Retraining trigger: High negative feedback rate (${negativeFeedbackRate}) for intent: ${intent}');
      await queueModelRetraining('intent_performance', { intent, negativeFeedbackRate });
    }

  } catch (error) {
    logger.error('Error checking retraining trigger:', { error: error });
  }
}

async function queueModelRetraining(reason: string, metadata: any) {
  try {
    await pool.query(`
      INSERT INTO ml_retraining_queue (
        reason, metadata, status, created_at
      ) VALUES ($1, $2, 'pending', NOW())
    `, [reason, JSON.stringify(metadata)]);

    logger.info('🤖 ML retraining queued: ${reason}');
  } catch (error) {
    logger.error('Error queuing model retraining:', { error: error });
  }
}

// 📊 GET FEEDBACK ANALYTICS ENDPOINT
export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url);
    const userId = url.searchParams.get('userId');
    const timeframe = url.searchParams.get('timeframe') || '7d';

    let timeClause = "created_at > NOW() - INTERVAL '7 days'";
    if (timeframe === '30d') timeClause = "created_at > NOW() - INTERVAL '30 days'";
    if (timeframe === '1y') timeClause = "created_at > NOW() - INTERVAL '1 year'";

    // Overall feedback stats
    const overallStats = await pool.query(`
      SELECT 
        COUNT(*) as total_feedback,
        COUNT(CASE WHEN feedback_type = 'positive' THEN 1 END) as positive_count,
        COUNT(CASE WHEN feedback_type = 'negative' THEN 1 END) as negative_count,
        ROUND(
          (COUNT(CASE WHEN feedback_type = 'positive' THEN 1 END)::float / COUNT(*)::float) * 100, 
          2
        ) as satisfaction_rate
      FROM voice_feedback 
      WHERE ${timeClause}
      ${userId ? 'AND user_id = $1' : ''}
    `, userId ? [userId] : []);

    // Feedback by intent
    const intentStats = await pool.query(`
      SELECT 
        vc.intent,
        COUNT(*) as total_feedback,
        COUNT(CASE WHEN vf.feedback_type = 'positive' THEN 1 END) as positive_count,
        ROUND(AVG(vc.confidence), 3) as avg_confidence,
        ROUND(AVG(vc.processing_time_ms), 0) as avg_processing_time
      FROM voice_feedback vf
      JOIN voice_commands vc ON vf.command_id = vc.command_id
      WHERE ${timeClause}
      ${userId ? 'AND vf.user_id = $1' : ''}
      GROUP BY vc.intent
      ORDER BY total_feedback DESC
    `, userId ? [userId] : []);

    // Recent negative feedback for improvement
    const improvementOpportunities = await pool.query(`
      SELECT 
        vf.command_id,
        vc.transcript,
        vc.intent,
        vc.confidence,
        vf.details,
        vf.suggested_improvement,
        vf.created_at
      FROM voice_feedback vf
      JOIN voice_commands vc ON vf.command_id = vc.command_id
      WHERE vf.feedback_type = 'negative' 
        AND ${timeClause}
        ${userId ? 'AND vf.user_id = $1' : ''}
      ORDER BY vf.created_at DESC
      LIMIT 20
    `, userId ? [userId] : []);

    return NextResponse.json({
      success: true,
      data: {
        overall: overallStats.rows[0],
        byIntent: intentStats.rows,
        improvementOpportunities: improvementOpportunities.rows
      }
    });

  } catch (error) {
    logger.error('Error fetching feedback analytics:', { error: error });
    return NextResponse.json({
      success: false,
      error: 'Failed to fetch analytics'
    }, { status: 500 });
  }
}
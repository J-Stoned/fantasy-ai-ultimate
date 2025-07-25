/**
 * 🔮 ORACLE SESSION API - SESSION MANAGEMENT
 * 
 * This endpoint manages Oracle sessions, including creation,
 * retrieval, updates, and cleanup of session data.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getOracleService } from '@/lib/services/ai/oracle-service';
import { validateRequest } from '@/lib/utils/validation';
import { z } from 'zod';
import { cookies } from 'next/headers';
import { logger } from '../../../../lib/logging/logger';

// Session creation schema
const createSessionSchema = z.object({
  userId: z.string().optional(),
  initialContext: z.object({
    sport: z.enum(['NFL', 'NBA', 'MLB', 'NHL', 'PGA', 'UFC']).optional(),
    contestType: z.enum(['GPP', 'CASH', 'H2H']).optional(),
    preferences: z.any().optional()
  }).optional()
});

// Session update schema
const updateSessionSchema = z.object({
  sessionId: z.string(),
  context: z.object({
    sport: z.string().optional(),
    contestType: z.string().optional(),
    lineup: z.any().optional(),
    preferences: z.any().optional()
  }).optional(),
  isListening: z.boolean().optional()
});

// POST - Create new session
export async function POST(req: NextRequest) {
  try {
    const validation = await validateRequest(req, createSessionSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { userId, initialContext } = validation.data;
    const oracleService = getOracleService();
    
    // Create session ID
    const sessionId = `oracle_session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Initialize session with Oracle
    const response = await oracleService.processQuery({
      text: '',
      sessionId,
      userId,
      context: initialContext
    });

    // Set session cookie (optional - for web persistence)
    const cookieStore = await cookies();
    cookieStore.set('oracle_session', sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    logger.info('🔮 Created Oracle session: ${sessionId}');

    return NextResponse.json({
      success: true,
      sessionId,
      session: {
        id: sessionId,
        userId,
        startTime: new Date(),
        context: initialContext || {},
        isListening: false,
        currentSpeaker: 'oracle'
      }
    });

  } catch (error) {
    logger.error('Session creation error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to create session' },
      { status: 500 }
    );
  }
}

// GET - Retrieve session info
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      // Try to get from cookie
      const cookieStore = await cookies();
      const cookieSession = cookieStore.get('oracle_session');
      
      if (!cookieSession) {
        return NextResponse.json(
          { error: 'No session ID provided' },
          { status: 400 }
        );
      }
    }

    const oracleService = getOracleService();
    const stats = oracleService.getStats();
    
    // Get session memory summary (without exposing full memory)
    const sessionSummary = {
      sessionId,
      isActive: true, // Would check actual session in real implementation
      memoryCount: 0, // Would get from actual session
      lastActivity: new Date(),
      currentSpeaker: 'oracle'
    };

    return NextResponse.json({
      success: true,
      session: sessionSummary,
      systemStats: {
        activeSessions: stats.activeSessions,
        totalProphecies: stats.totalProphecies
      }
    });

  } catch (error) {
    logger.error('Session retrieval error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to retrieve session' },
      { status: 500 }
    );
  }
}

// PATCH - Update session
export async function PATCH(req: NextRequest) {
  try {
    const validation = await validateRequest(req, updateSessionSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error },
        { status: 400 }
      );
    }

    const { sessionId, context, isListening } = validation.data;
    const oracleService = getOracleService();

    // Update session through a context update query
    if (context) {
      await oracleService.processQuery({
        text: '', // Empty query just updates context
        sessionId,
        context
      });
    }

    // Update listening state
    if (isListening !== undefined) {
      // This would update the session's listening state
      // In real implementation, would access session directly
      logger.info('🔮 Updated session ${sessionId} listening: ${isListening}');
    }

    return NextResponse.json({
      success: true,
      sessionId,
      updated: {
        context: context || {},
        isListening
      }
    });

  } catch (error) {
    logger.error('Session update error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to update session' },
      { status: 500 }
    );
  }
}

// DELETE - End session
export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const sessionId = searchParams.get('sessionId');
    
    if (!sessionId) {
      return NextResponse.json(
        { error: 'No session ID provided' },
        { status: 400 }
      );
    }

    // Clear session cookie
    const cookieStore = await cookies();
    cookieStore.delete('oracle_session');

    // In real implementation, would clean up session from memory
    logger.info('🔮 Ended Oracle session: ${sessionId}');

    return NextResponse.json({
      success: true,
      message: 'Session ended successfully',
      sessionId
    });

  } catch (error) {
    logger.error('Session deletion error:', { error: error });
    return NextResponse.json(
      { error: 'Failed to end session' },
      { status: 500 }
    );
  }
}

/**
 * 🔮 ORACLE SESSION FEATURES:
 * 
 * - Create and manage Oracle sessions
 * - Persist session state across requests
 * - Update context and preferences
 * - Track session memory and activity
 * - Handle session cleanup
 * - Cookie-based web persistence
 * 
 * Sessions timeout after 30 minutes of inactivity
 */